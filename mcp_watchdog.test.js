import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateMcpProgress, inspectMcpWorkers, repairMcpProgress } from './mcp_watchdog.js'
const base = 1_000_000
const mcpAt = now => ({ts:now,runId:'r',config:{OBJECTIVE:'xp'},workerMode:'continuous',target:'a'})
const sample = jobs => ({capacityRam:100,actionRam:jobs.length*2,jobs,security:5,moneyPct:.02,totalHacked:0,completedBatches:0})
const job = {pid:3,host:'w',filename:'scripts/weaken.js',args:['a','once','batch',0],xp:0,money:0,securityOnly:true}
function observe({jobs=[], mcp={}, change={}, lastRecoveryAt}={}) {
 let previous
 for(let step=0;step<=6;step++) {
  const now=base+step*30_000
  previous=evaluateMcpProgress({now,mcp:{...mcpAt(now),...mcp},sample:{...sample(jobs),...(step===6?change:{})},previous,lastRecoveryAt})
 }
 return previous
}
test('fresh heartbeat with no jobs and spare capacity triggers a bounded restart',()=>{
 assert.equal(observe().action,'restart')
})
test('known security-only orphan drain is repaired without restarting manager',()=>{
 assert.equal(observe({jobs:[job],mcp:{workerMode:'finite-draining'}}).action,'cancel-security')
})
test('unknown, harvest, or mixed restoration jobs are alert-only',()=>{
 for(const jobs of [[{...job,securityOnly:false}],[job,{...job,pid:4,securityOnly:false}]]) {
  const result=observe({jobs,mcp:{workerMode:'finite-draining'}})
  assert.equal(result.action,'alert');assert.ok(result.alert)
 }
})
test('XP gains, money gains, completed jobs, or target preparation reset the grace period',()=>{
 for(const change of [{jobs:[{...job,xp:1}]},{jobs:[{...job,money:1}]},{jobs:[]},{security:4},{moneyPct:.03},{completedBatches:1},{totalHacked:1}]) {
  assert.equal(observe({jobs:[job],change}).action,'none')
 }
})
test('high utilization and unrelated RAM occupancy do not trigger',()=>{
 assert.equal(observe({change:{actionRam:80}}).action,'none')
 assert.equal(observe({change:{capacityRam:10}}).action,'none')
})
test('cooldown, stale status, share objective and no-target states never restart',()=>{
 assert.equal(observe({lastRecoveryAt:base}).action,'alert')
 assert.equal(observe({mcp:{ts:base-100_000}}).action,'none')
 assert.equal(observe({mcp:{config:{OBJECTIVE:'reputation'}}}).action,'none')
 assert.equal(observe({mcp:{target:null}}).action,'alert')
})
test('run change and sampling gaps reset observation',()=>{
 const previous=observe()
 const now=base+210_000
 assert.equal(evaluateMcpProgress({now,mcp:{...mcpAt(now),runId:'new'},sample:sample([]),previous}).action,'none')
 const later=base+400_000
 assert.equal(evaluateMcpProgress({now:later,mcp:mcpAt(later),sample:sample([]),previous}).action,'none')
})
function runtimeFixture() {
 const now=Date.now(),mcp=mcpAt(now),calls=[]
 const event={kind:'cloud_batch_start',id:'batch',target:'a',phase:'prepare-security',counts:{hack:0,grow:0,weaken:1},jobs:[{pid:3,host:'w',action:'weaken'}]}
 const ns={scan:h=>h==='home'?['w']:[],cloud:{getServerNames:()=>[]},getServerMaxRam:()=>100,hasRootAccess:()=>true,
  ps:()=>[{...job,threads:1}],read:f=>f==='mcp_events.txt'?JSON.stringify(event):JSON.stringify(mcp),
  getScriptRam:()=>1.75,getServerUsedRam:()=>21.75,getRunningScript:()=>({onlineExpGained:7,onlineMoneyMade:0}),
  kill:pid=>{calls.push(pid);return true},write:(f,value)=>calls.push([f,value])}
 return {ns,mcp,calls,event}
}
test('independent inspection excludes home and unrelated RAM, and proves exact batch identity',()=>{
 const {ns,event}=runtimeFixture()
 let s=inspectMcpWorkers(ns,{})
 assert.equal(s.capacityRam,80);assert.equal(s.actionRam,1.75);assert.equal(s.jobs[0].xp,7);assert.equal(s.jobs[0].securityOnly,true)
 event.jobs[0].pid=99
 const original=ns.read;ns.read=f=>f==='mcp_events.txt'?JSON.stringify(event):original(f)
 assert.equal(inspectMcpWorkers(ns,{}).jobs[0].securityOnly,false)
})
test('repair revalidates processes and refuses active work before idle restart',()=>{
 const {ns,mcp,calls}=runtimeFixture()
 assert.equal(repairMcpProgress(ns,{action:'restart',ts:Date.now()},mcp).ok,false)
 assert.deepEqual(calls,[])
 mcp.workerMode='finite-draining'
 assert.equal(repairMcpProgress(ns,{action:'cancel-security',sample:sample([job])},mcp).ok,true)
 assert.deepEqual(calls,[3])
})
test('repair refuses changed objective or newly unproven compensation jobs',()=>{
 const {ns,mcp,calls}=runtimeFixture()
 const changed={...mcp,config:{OBJECTIVE:'money'}}
 const original=ns.read;ns.read=f=>f==='mcp_status.json'?JSON.stringify(changed):original(f)
 assert.equal(repairMcpProgress(ns,{action:'cancel-security',sample:sample([job])},mcp).ok,false)
 assert.deepEqual(calls,[])
})

test('idle restart writes the normal supervisor token only when jobs remain absent',()=>{
 const {ns,mcp,calls}=runtimeFixture();ns.ps=()=>[]
 assert.equal(repairMcpProgress(ns,{action:'restart',ts:123},mcp).ok,true)
 assert.deepEqual(calls,[['mcp_restart.txt','progress-watchdog-123\n']])
})
test('cancellation refuses a new job or missing batch evidence',()=>{
 for (const variation of ['new-job','no-evidence']) {
  const {ns,mcp,calls}=runtimeFixture()
  mcp.workerMode='finite-draining'
  if(variation==='new-job') {const old=ns.ps;ns.ps=()=>[...old(),{...job,pid:4,threads:1}]}
  else {const old=ns.read;ns.read=f=>f==='mcp_events.txt'?'':old(f)}
  assert.equal(repairMcpProgress(ns,{action:'cancel-security',sample:sample([job])},mcp).ok,false)
  assert.deepEqual(calls,[])
 }
})
