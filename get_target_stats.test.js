import {test} from 'node:test'
import assert from 'node:assert/strict'
import {pageCommand,selectPage} from './get_target_stats.js'

test('page commands are recognized without treating arbitrary text as a command',()=>{
  for(const command of ['next','prev','previous','first','last','1','12'])assert.equal(pageCommand(command),true)
  for(const command of ['', '0', '-1', 'next page'])assert.equal(pageCommand(command),false)
})

test('page navigation clamps at the ends and numbers are one-based',()=>{
  assert.equal(selectPage('next',0,3),1)
  assert.equal(selectPage('next',2,3),2)
  assert.equal(selectPage('prev',0,3),0)
  assert.equal(selectPage('previous',2,3),1)
  assert.equal(selectPage('first',2,3),0)
  assert.equal(selectPage('last',0,3),2)
  assert.equal(selectPage('2',0,3),1)
  assert.equal(selectPage('99',0,3),2)
})

import {buildTargetReport,selectedTargets,updateIncomeWindow} from './get_target_stats.js'
const action=(target,threads,kind='hack')=>({target,threads,action:kind,ram:threads*1.75})
test('worker RAM excludes reserved home and inaccessible hosts; rows retain every observed target',()=>{
 const report=buildTargetReport({targets:[{target:'planned',phase:'harvest',counts:{hack:20,grow:10,weaken:2}}]},[
  {host:'home',eligible:false,max:2048,used:100,actions:[]},
  {host:'locked',eligible:false,max:1024,used:0,actions:[]},
  {host:'worker',eligible:true,max:128,used:35,actions:[action('unlisted',10),action('planned',2,'weaken')]},
 ])
 assert.equal(report.pool.max,128);assert.equal(report.pool.actions,21);assert.equal(report.pool.other,14);assert.equal(report.pool.free,93)
 assert.equal(report.home.max,2048);assert.equal(report.totalThreads,12)
 assert.equal(report.rows.find(r=>r.target==='unlisted').listed,false)
 const planned=report.rows.find(r=>r.target==='planned');assert.equal(planned.hack,0);assert.equal(planned.weaken,2);assert.equal(planned.planned.hack,20)
})
test('finished batch remains listed with zero live jobs; no invented active threads',()=>{
 const report=buildTargetReport({targets:[{target:'a',phase:'harvest',counts:{hack:99,grow:5,weaken:1}}]},[])
 assert.equal(report.rows.length,1);assert.equal(report.totalThreads,0);assert.equal(report.rows[0].planned.hack,99)
})
test('duplicate manager targets do not inflate totals and draining strings inherit manager phase',()=>{
 const report=buildTargetReport({targets:['a','a'],phase:'draining'},[{host:'w',eligible:true,max:64,used:7,actions:[action('a',4)]}])
 assert.equal(report.rows.length,1);assert.equal(report.totalThreads,4);assert.equal(report.rows[0].phase,'draining')
 assert.equal(selectedTargets({target:'a',phase:'work'})[0].target,'a')
})
test('realized income persists when short hack jobs finish between process samples',()=>{
 let result=updateIncomeWindow([],0,100)
 assert.equal(result.rate,null)
 result=updateIncomeWindow(result.history,5000,1_000_100)
 assert.equal(result.rate,200_000)
 result=updateIncomeWindow(result.history,10000,1_000_100)
 assert.equal(result.rate,100_000);assert.equal(result.gained,1_000_000)
})
test('rolling income expires old payouts and resets across counter or clock resets',()=>{
 let result=updateIncomeWindow([],0,0)
 result=updateIncomeWindow(result.history,5000,100)
 for(let t=10000;t<=70000;t+=5000)result=updateIncomeWindow(result.history,t,100)
 assert.equal(result.rate,0);assert.ok(result.history.length<=14)
 result=updateIncomeWindow(result.history,75000,0);assert.equal(result.rate,null)
 result=updateIncomeWindow(result.history,1000,1);assert.equal(result.rate,null)
 result=updateIncomeWindow(result.history,1000,2);assert.equal(result.rate,null)
 assert.equal(updateIncomeWindow([],1000,undefined).rate,null)
})
