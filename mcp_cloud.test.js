import {test} from 'node:test'
import assert from 'node:assert/strict'
import {planCloudBatch,placeCloudBatch,cloudTick,fitCloudPreparation} from './mcp_cloud.js'

function fixture() {
 let nowMoney=1000,seq=0
 const files=new Map([['mcp_cloud_control.json',JSON.stringify({enabled:true,expiresAt:Date.now()+60000,harvestFraction:.5,maxTargets:16})]])
 const servers={a:{hostname:'a',moneyMax:1000,moneyAvailable:1000,hackDifficulty:1,minDifficulty:1,purchasedByPlayer:false},b:{hostname:'b',moneyMax:1000,moneyAvailable:1000,hackDifficulty:1,minDifficulty:1,purchasedByPlayer:false},worker:{moneyMax:0,purchasedByPlayer:true}}
 const processes=[], launches=[],events=[]
 const ns={read:f=>files.get(f)||'',getServer:h=>({...servers[h]}),getPlayer:()=>({skills:{hacking:100}}),weakenAnalyze:()=>.05,
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
test('full target 50% batch reserves restoration and security compensation',()=>{
 const {ns}=fixture(),p=planCloudBatch(ns,'a');assert.equal(p.phase,'harvest');assert.deepEqual(p.counts,{hack:50,grow:10,weaken:3})
})
test('security preparation contains no hack or grow',()=>{
 const {ns,servers}=fixture();servers.a.hackDifficulty=2;assert.deepEqual(planCloudBatch(ns,'a').counts,{hack:0,grow:0,weaken:20})
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
test('disabled control releases owned jobs and returns single-target control',async()=>{
 const {ns,context,files,processes}=fixture(),state={};await cloudTick(ns,state,context);files.set('mcp_cloud_control.json','{"enabled":false}');assert.equal(await cloudTick(ns,state,context),null);assert.equal(processes.length,0)
})
test('XP objective does not enable cloud money batches',async()=>{
 const {ns,context,launches}=fixture();assert.equal(await cloudTick(ns,{}, {...context,objective:'xp'}),null);assert.equal(launches.length,0)
})
test('oversized money preparation progresses within available RAM with compensation',()=>{
 const ram={hack:1.7,grow:1.75,weaken:1.75},p=fitCloudPreparation({phase:'prepare-money',counts:{hack:0,grow:50000,weaken:4000}},4096,ram,.05)
 assert.ok(p.ram<=4096);assert.ok(p.counts.grow>0);assert.equal(p.counts.weaken,Math.ceil(p.counts.grow*.004/.05));assert.ok(placeCloudBatch(p.counts,[{host:'w',freeRam:4096}],ram))
})
