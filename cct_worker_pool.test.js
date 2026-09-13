import test from 'node:test'
import assert from 'node:assert/strict'
import { selectContractWorker, prepareContractWorker } from './cct_worker_pool.js'
test('finite cohorts cannot be reclaimed by maintenance', async () => {
 const killed=[]
 const ns={cloud:{getServerNames:()=>['cloud']},scan:()=>[],hasRootAccess:()=>true,getServerMaxRam:()=>4096,getServerUsedRam:()=>4000,ps:()=>[{filename:'scripts/weaken.js',args:['target','once'],pid:7}],kill:p=>killed.push(p)}
 assert.equal(selectContractWorker(ns,200),null)
 assert.equal((await prepareContractWorker(ns,{host:'cloud',cloud:true},200)).ok,false)
 assert.deepEqual(killed,[])
})
test('free capacity does not preempt legacy loops', async () => {
 const killed=[]
 const ns={ps:()=>[{filename:'scripts/weaken.js',args:['target'],pid:7}],getServerMaxRam:()=>4096,getServerUsedRam:()=>100,kill:p=>killed.push(p)}
 assert.equal((await prepareContractWorker(ns,{host:'cloud',cloud:true},200)).ok,true)
 assert.deepEqual(killed,[])
})
