import {test} from 'node:test'
import assert from 'node:assert/strict'
import {planCloudBatch,placeCloudBatch,cloudTick,fitCloudPreparation} from './mcp_cloud.js'

function fixture() {
 let nowMoney=1000,seq=0
 const files=new Map([['mcp_cloud_control.json',JSON.stringify({enabled:true,expiresAt:Date.now()+60000,harvestFraction:.5,maxTargets:16})]])
 const servers={a:{hostname:'a',moneyMax:1000,moneyAvailable:1000,hackDifficulty:1,minDifficulty:1,purchasedByPlayer:false},b:{hostname:'b',moneyMax:1000,moneyAvailable:1000,hackDifficulty:1,minDifficulty:1,purchasedByPlayer:false},worker:{moneyMax:0,purchasedByPlayer:true}}
 const processes=[], launches=[],events=[]
 const ns={cloud:{getServerNames:()=>[],getRamLimit:()=>1024,getServerLimit:()=>25,getServerCost:()=>1},read:f=>files.get(f)||'',getServer:h=>({...servers[h]}),getPlayer:()=>({skills:{hacking:100}}),weakenAnalyze:()=>.05,
  formulas:{hacking:{hackPercent:()=>.01,hackChance:()=>1,weakenTime:()=>4000,growThreads:(s,p,max)=>Math.log2(max/Math.max(1,s.moneyAvailable))*10}},
  getHackTime:()=>1000,getGrowTime:()=>3200,getWeakenTime:()=>4000,getScriptRam:f=>f.includes('hack')?1.7:1.75,
  getServerSecurityLevel:h=>servers[h].hackDifficulty,getServerMinSecurityLevel:h=>servers[h].minDifficulty,
  getServerMoneyAvailable:h=>servers[h].moneyAvailable,getServerMaxMoney:h=>servers[h].moneyMax,
  fileExists:()=>true,ps:h=>processes.filter(p=>p.host===h),kill:(pid)=>{const i=processes.findIndex(p=>p.pid===pid);if(i>=0)processes.splice(i,1);return true},isRunning:(pid,h)=>processes.some(p=>p.pid===pid&&p.host===h),
  getMoneySources:()=>({sinceInstall:{hacking:nowMoney}}),hasRootAccess:()=>true,getServerRequiredHackingLevel:()=>1,getHackingLevel:()=>100,
  getServerMaxRam:()=>500,getServerUsedRam:h=>processes.filter(p=>p.host===h).reduce((n,p)=>n+p.threads*ns.getScriptRam(p.filename),0),scp:async()=>true,
  exec:(filename,host,threads,...args)=>{const p={filename,host,threads,args,pid:++seq};processes.push(p);launches.push(p);return p.pid}}
 const context={servers:['a','b','worker'],workers:['worker'],runId:'test',objective:'reputation',emit:(kind,data)=>events.push({kind,...data})}
 return {ns,context,servers,processes,launches,events,files}
}
test('full target 75% batch reserves restoration and security compensation',()=>{
 const {ns}=fixture(),p=planCloudBatch(ns,'a');assert.equal(p.phase,'harvest');assert.deepEqual(p.counts,{hack:75,grow:11,weaken:4})
})
test('security preparation contains no hack or grow',()=>{
 const {ns,servers}=fixture();servers.a.hackDifficulty=3;assert.deepEqual(planCloudBatch(ns,'a').counts,{hack:0,grow:0,weaken:40})
})
test('depleted money restores actual deficit without hacking',()=>{
 const {ns,servers}=fixture();servers.a.moneyAvailable=250;assert.deepEqual(planCloudBatch(ns,'a').counts,{hack:0,grow:20,weaken:2})
})
test('placement is all or nothing and reserves weaken/grow first',()=>{
 assert.equal(placeCloudBatch({hack:50,grow:10,weaken:3},[{host:'w',freeRam:100}],{hack:1.7,grow:1.75,weaken:1.75}),null)
 const p=placeCloudBatch({hack:50,grow:10,weaken:3},[{host:'x',freeRam:50},{host:'y',freeRam:100}],{hack:1.7,grow:1.75,weaken:1.75});assert.deepEqual(p.slice(0,2).map(p=>p.action),['weaken','grow']);assert.equal(p.filter(p=>p.action==='hack').reduce((n,p)=>n+p.threads,0),50)
})
test('multiple batches launch finite uniquely named jobs and retain slow calls',async()=>{
 const {ns,context,launches,processes}=fixture(),state={};let s=await cloudTick(ns,state,context);assert.equal(s.targets.length,2);assert.equal(s.workerLaunchFailures.length,0);assert.ok(launches.every(p=>p.args[1]==='once'))
 const count=launches.length;for(let i=processes.length-1;i>=0;i--)if(processes[i].filename.includes('hack'))processes.splice(i,1)
 s=await cloudTick(ns,state,context);assert.equal(launches.length,count);assert.equal(s.targets.length,2)
 processes.length=0;await cloudTick(ns,state,context);assert.equal(state.completed,2);assert.ok(launches.length>count)
})
test('launch failure rolls back only started batch jobs',async()=>{
 const {ns,context,processes}=fixture();const original=ns.exec;ns.exec=(file,...args)=>file.includes('grow')?0:original(file,...args)
 const s=await cloudTick(ns,{},context);assert.equal(s.workerLaunchFailures.length,1);assert.equal(processes.length,0);assert.equal(s.targets.length,0)
})
test('disabled control drains owned jobs before returning single-target control',async()=>{
 const {ns,context,files,processes}=fixture(),state={};await cloudTick(ns,state,context);files.set('mcp_cloud_control.json','{"enabled":false}');assert.equal((await cloudTick(ns,state,context)).phase,'draining');processes.length=0;assert.equal(await cloudTick(ns,state,context),null);assert.equal(processes.length,0)
})
test('XP objective does not enable cloud money batches',async()=>{
 const {ns,context,launches}=fixture();assert.equal(await cloudTick(ns,{}, {...context,objective:'xp'}),null);assert.equal(launches.length,0)
})
test('oversized money preparation progresses within available RAM with compensation',()=>{
 const ram={hack:1.7,grow:1.75,weaken:1.75},p=fitCloudPreparation({phase:'prepare-money',counts:{hack:0,grow:50000,weaken:4000}},4096,ram,.05)
 assert.ok(p.ram<=4096);assert.ok(p.counts.grow>0);assert.equal(p.counts.weaken,Math.ceil(p.counts.grow*.004/.05));assert.ok(placeCloudBatch(p.counts,[{host:'w',freeRam:4096}],ram))
})

test('XP transition cancels long security preparation but drains restoration',async()=>{
 const {ns,context,servers,processes,events}=fixture(),state={}
 servers.a.hackDifficulty=3
 await cloudTick(ns,state,context)
 const securityJobs=state.batches.get('a').jobs.map(j=>j.pid)
 const restorationJobs=state.batches.get('b').jobs.map(j=>j.pid)
 const draining=await cloudTick(ns,state,{...context,objective:'xp'})
 assert.equal(draining.phase,'draining')
 assert.ok(securityJobs.every(pid=>!processes.some(p=>p.pid===pid)))
 assert.ok(restorationJobs.every(pid=>processes.some(p=>p.pid===pid)))
 assert.ok(events.some(e=>e.kind==='cloud_batch_cancel'&&e.target==='a'))
 processes.length=0
 assert.equal(await cloudTick(ns,state,{...context,objective:'xp'}),null)
})
test('XP resumes in the same tick when only security preparation remains',async()=>{
 const {ns,context,servers}=fixture(),state={}
 servers.a.hackDifficulty=3;servers.b.hackDifficulty=3
 await cloudTick(ns,state,context)
 assert.equal(await cloudTick(ns,state,{...context,objective:'xp'}),null)
 assert.equal(state.batches.size,0)
})

import {cloudWakeDelay,cloudAdmissionHosts} from './mcp_cloud.js'
test('completion wake targets final harvest action with margin, preserving other modes',()=>{
 const status={workerMode:'finite',targets:[{phase:'harvest',startedAt:1000,counts:{hack:5,grow:10,weaken:1},durations:{hack:2,grow:6.4,weaken:8}}]}
 assert.equal(cloudWakeDelay(status,1000,10000,true),8100)
 assert.equal(cloudWakeDelay(status,9200,10000,true),200)
 assert.equal(cloudWakeDelay(status,1000,10000,false),10000)
 assert.equal(cloudWakeDelay({...status,workerMode:'finite-draining'},1000,10000,true),10000)
 assert.equal(cloudWakeDelay({workerMode:'finite',targets:[{phase:'prepare-security'}]},1000,10000,true),10000)
})
test('finished hack slots stay reserved until the harvest cohort is settled',()=>{
 const ns={getServerMaxRam:()=>100,getServerUsedRam:()=>35,isRunning:pid=>pid===2}
 const batches=new Map([['a',{phase:'harvest',jobs:[{pid:1,host:'w',action:'hack',threads:20},{pid:2,host:'w',action:'grow',threads:20}]}]])
 const ram={hack:1.7,grow:1.75,weaken:1.75}
 assert.equal(cloudAdmissionHosts(ns,['w'],batches,ram,true)[0].freeRam,31)
 assert.equal(cloudAdmissionHosts(ns,['w'],batches,ram,false)[0].freeRam,65)
 batches.clear();assert.equal(cloudAdmissionHosts(ns,['w'],batches,ram,true)[0].freeRam,65)
})
test('completion admission retains in-flight work and does not borrow its released slots for preparation',async()=>{
 const {ns,context,servers,processes}=fixture(),state={}
 servers.b.hackDifficulty=3
 await cloudTick(ns,state,{...context,servers:['a'],reserveHarvestRam:true})
 const aJobs=state.batches.get('a').jobs
 for(let i=processes.length-1;i>=0;i--)if(processes[i].filename.includes('hack'))processes.splice(i,1)
 const running=aJobs.filter(j=>ns.isRunning(j.pid,j.host)).map(j=>j.pid)
 const before=cloudAdmissionHosts(ns,['worker'],state.batches,{hack:1.7,grow:1.75,weaken:1.75},true)[0]
 const status=await cloudTick(ns,state,{...context,reserveHarvestRam:true})
 assert.ok(running.every(pid=>processes.some(p=>p.pid===pid)))
 assert.ok(status.reservedRestorationRam>0)
 const prep=state.batches.get('b')
 assert.ok(!prep||prep.ram<=before.freeRam+1e-9)
})

import {adoptCloudCohorts} from './mcp_cloud.js'
test('restart adopts only cohorts with exact live process identity',async()=>{
 const {ns,context,files,state,processes}=fixture(),prior={}
 await cloudTick(ns,prior,context)
 const batches=[...prior.batches.values()]
 files.set('mcp_cloud_status.json',JSON.stringify({targets:batches}))
 assert.equal(adoptCloudCohorts(ns,['worker']).length,2)
 processes[0].args[2]='different-cohort'
 assert.equal(adoptCloudCohorts(ns,['worker']).length,1)
 assert.equal(adoptCloudCohorts(ns,[]).length,0)
})

import {retireLegacyActionWorkers} from './mcp_cloud.js'
test('manager startup retires old loops but preserves finite jobs and unrelated work',()=>{
 const killed=[]
 const ns={ps:host=>[{pid:1,filename:'/scripts/grow.js',args:['a','once','batch']},{pid:2,filename:'scripts/hack.js',args:['a']},{pid:3,filename:'other.js',args:[]}],kill:(pid,host)=>{killed.push([pid,host]);return true}}
 assert.equal(retireLegacyActionWorkers(ns,['home','w','w']),2)
 assert.deepEqual(killed,[[2,'home'],[2,'w']])
})

test('malformed prior cohort status is ignored without process inspection',()=>{
 for(const previous of [{targets:{}},{targets:[{target:'a',id:'x',counts:{},durations:{},startedAt:0,jobs:[{}]}]}]) {
  const ns={read:()=>JSON.stringify(previous),isRunning:()=>{throw Error('must not inspect invalid process identity')}}
  assert.deepEqual(adoptCloudCohorts(ns,['worker']),[])
 }
})

test('preparation waits for a useful chunk, then starts when capacity returns',async()=>{
 const {ns,context,servers,processes}=fixture(),state={}
 servers.a.hackDifficulty=8 // Complete 245GB security preparation fits first.
 servers.b.hackDifficulty=101 // Only a token remainder would fit afterwards.
 let s=await cloudTick(ns,state,context)
 assert.equal(s.targets.length,1)
 assert.equal(s.targets[0].target,'a')
 const deferred=s.waiting.find(p=>p.target==='b')
 assert.equal(deferred.reason,'waiting for useful preparation chunk')
 assert.ok(deferred.availableRam<deferred.minimumRam)
 assert.equal(s.cloudControl.effectiveMinimumPreparationRam,81.25)
 // Completed work releases RAM; the deferred target is not excluded/locked.
 processes.length=0
 s=await cloudTick(ns,state,{...context,servers:['b','worker']})
 assert.equal(s.targets.length,1)
 assert.equal(s.targets[0].target,'b')
 assert.ok(s.targets[0].ram>=81.25)
})

test('zero minimum restores legacy remainder admission without changing harvests',async()=>{
 const {ns,context,servers,files}=fixture()
 servers.a.hackDifficulty=8;servers.b.hackDifficulty=101
 files.set('mcp_cloud_control.json',JSON.stringify({enabled:true,minimumPreparationFraction:0}))
 const s=await cloudTick(ns,{},context)
 assert.equal(s.targets.length,2)
 assert.ok(s.targets.find(p=>p.target==='b').ram<81.25)
})

test('fragmented grow preparation cannot fall below its useful minimum',()=>{
 const ram={hack:1.7,grow:1.75,weaken:1.75}
 const plan={phase:'prepare-money',counts:{hack:0,grow:100,weaken:8}}
 const fitted=fitCloudPreparation(plan,100,ram,.05,[{host:'a',freeRam:1},{host:'b',freeRam:1},{host:'c',freeRam:98}],99)
 assert.equal(fitted.ram,0)
 assert.equal(fitted.counts.grow,0)
})

import {rankAffordableHarvests} from './mcp_cloud.js'
test('affordable harvest ranking ignores misleading full-plan ranks and charges reservations',()=>{
 const {ns,servers}=fixture()
 servers.b.moneyAvailable=servers.b.moneyMax=10000
 const a={...planCloudBatch(ns,'a'),rank:1e9},b={...planCloudBatch(ns,'b'),rank:0}
 const ram={hack:1.7,grow:1.75,weaken:1.75}
 const ranked=rankAffordableHarvests(ns,[a,b],[{host:'worker',freeRam:80}],ram,true)
 assert.equal(ranked[0].target,'b')
 for(const p of ranked) {
  assert.ok(p.ram<=80)
  assert.ok(p.counts.hack>0 && p.counts.weaken>0)
  assert.equal(p.chargedRamSeconds,p.ram*4)
  assert.equal(p.admissionScore,p.expectedWithdrawal/p.chargedRamSeconds)
 }
})

test('competing ready harvests receive bounded cohorts and preserve their jobs',async()=>{
 const {ns,context,files,processes}=fixture(),state={}
 ns.getServerMaxRam=()=>160
 files.set('mcp_cloud_control.json',JSON.stringify({enabled:true,efficientHarvestAdmission:true}))
 let s=await cloudTick(ns,state,{...context,reserveHarvestRam:true})
 assert.equal(s.targets.length,2)
 assert.equal(s.cloudControl.effectiveHarvestRamCap,80)
 assert.ok(s.targets.every(p=>p.ram<=80 && p.counts.hack>0))
 assert.ok(s.targets.every(p=>p.admissionAlternatives?.length && p.admissionScore>0))
 const pids=processes.map(p=>p.pid)
 s=await cloudTick(ns,state,{...context,reserveHarvestRam:true})
 assert.deepEqual(processes.map(p=>p.pid),pids)
 assert.equal(s.workerLaunchFailures.length,0)
})

test('single ready target can use the whole fleet under efficient admission',async()=>{
 const {ns,context,files}=fixture()
 ns.getServerMaxRam=()=>160
 files.set('mcp_cloud_control.json',JSON.stringify({enabled:true,efficientHarvestAdmission:true}))
 const s=await cloudTick(ns,{}, {...context,servers:['a','worker']})
 assert.equal(s.cloudControl.effectiveHarvestRamCap,160)
 assert.ok(s.targets[0].ram>80)
})

test('disabled efficient admission keeps legacy large cohorts and switching never kills active jobs',async()=>{
 const {ns,context,files,processes}=fixture(),state={}
 ns.getServerMaxRam=()=>160
 files.set('mcp_cloud_control.json',JSON.stringify({enabled:true,efficientHarvestAdmission:false}))
 let s=await cloudTick(ns,state,{...context,reserveHarvestRam:true})
 assert.ok(s.targets.some(p=>p.ram>80))
 const pids=processes.map(p=>p.pid)
 files.set('mcp_cloud_control.json',JSON.stringify({enabled:true,efficientHarvestAdmission:true}))
 s=await cloudTick(ns,state,{...context,reserveHarvestRam:true})
 assert.deepEqual(processes.map(p=>p.pid),pids)
 assert.equal(s.workerLaunchFailures.length,0)
})

import {weightedHarvestCaps} from './mcp_cloud.js'
test('weighted shares do not give a low-yield target an equal claim on fleet RAM',()=>{
 const caps=weightedHarvestCaps([{target:'phantasy',score:265},{target:'max',score:163},{target:'sushi',score:122},{target:'n00dles',score:7}],540)
 assert.ok(caps.phantasy>250)
 assert.ok(caps.n00dles<7)
 assert.ok(Math.abs(Object.values(caps).reduce((a,b)=>a+b,0)-540)<1e-9)
 assert.deepEqual(weightedHarvestCaps([{target:'only',score:1}],540),{only:540})
 assert.deepEqual(weightedHarvestCaps([{target:'bad',score:NaN}],540),{})
})

test('weighted admission gives more RAM to a more profitable ready target',async()=>{
 const {ns,context,servers,files}=fixture()
 ns.getServerMaxRam=()=>160
 servers.b.moneyAvailable=servers.b.moneyMax=10000
 files.set('mcp_cloud_control.json',JSON.stringify({enabled:true,efficientHarvestAdmission:true,weightedHarvestShares:true}))
 const s=await cloudTick(ns,{}, {...context,reserveHarvestRam:true})
 const caps=s.cloudControl.effectiveHarvestRamCaps
 assert.ok(caps.b>caps.a*9)
 assert.ok(s.targets.find(p=>p.target==='b').ram>s.targets.find(p=>p.target==='a').ram)
 assert.ok(s.targets.every(p=>p.ram<=caps[p.target]+1e-9))
 assert.equal(s.workerLaunchFailures.length,0)
})
