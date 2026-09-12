import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chooseShareHost, readReputationConfig, reconcileReputation } from './mcp_reputation.js'
import { main as setObjective } from './set_objective.js'

function fixture({ enabled = true, ramGb = 256, procs = [], scp = true, exec = true } = {}) {
  const files = { 'reputation_config.json': JSON.stringify({ enabled, ramGb }), 'mcp_objective_override.txt': 'xp' }
  const calls = [], events = [], prints = []
  let processes = procs.map(p => ({ host: 'cloud', args: [], ...p }))
  const ns = {
    pid: 42, args: [], read: f => files[f] || '', getSharePower: () => 1,
    ps: host => processes.filter(p => p.host === host),
    isRunning: pid => processes.some(p => p.pid === pid),
    kill(pid) { calls.push(['kill', pid]); processes = processes.filter(p => p.pid !== pid); return true },
    getScriptRam: f => f.includes('mcp_share') ? 4 : 2,
    getServerMaxRam: () => 512,
    getServerUsedRam: host => processes.filter(p => p.host === host).reduce((n,p) => n + p.threads * ns.getScriptRam(p.filename),0),
    async scp(...args) { calls.push(['scp', ...args]); return scp },
    exec(filename,host,threads,...args) { calls.push(['exec',filename,host,threads,...args]); if (!exec) return 0; processes.push({filename,host,threads,args,pid:100}); return 100 },
    write(f,v) { files[f]=v; calls.push(['write',f,v]) }, tprint: x => prints.push(x),
  }
  const options = { objective: 'reputation', hosts: ['cloud'], reserveHomeGb:32, runId:'generation', emit:(...e)=>events.push(e) }
  return { ns, options, calls, events, files, prints }
}

test('share selection respects physical space, configured budget and hard cap', () => {
  assert.equal(chooseShareHost([{host:'big',availableRam:10000}],4,10000).threads,64)
  assert.equal(chooseShareHost([{host:'small',availableRam:19}],4,256).threads,4)
  assert.equal(chooseShareHost([{host:'big',availableRam:10000}],4,33).threads,8)
  assert.equal(chooseShareHost([{host:'small',availableRam:3}],4,256),null)
  assert.equal(chooseShareHost([{host:'big',availableRam:512}],0,256),null)
})
test('invalid policy fails closed', () => {
  for (const ramGb of [0,-1,257,Infinity,'256']) {
    const f=fixture({ramGb}); assert.equal(readReputationConfig(f.ns).enabled,false)
  }
})
test('disabled policy cannot launch or alter existing unrelated allocations', async () => {
  const f=fixture({enabled:false,procs:[{pid:1,filename:'scripts/grow.js',threads:100},{pid:2,filename:'scripts/share.js',threads:10}]})
  const result=await reconcileReputation(f.ns,{},f.options)
  assert.equal(result.state,'blocked'); assert.deepEqual(f.calls,[])
})
test('bounded start reclaims only selected host actions and repeated reconcile is idempotent', async () => {
  const f=fixture({procs:[{pid:1,filename:'scripts/grow.js',threads:200},{pid:2,filename:'scripts/share.js',threads:10}]})
  const started=await reconcileReputation(f.ns,{},f.options)
  assert.equal(started.ramGb,256); assert.equal(started.threads,64)
  assert.deepEqual(f.calls.filter(x=>x[0]==='kill'),[['kill',1]])
  const calls=f.calls.length
  const again=await reconcileReputation(f.ns,started,f.options)
  assert.equal(again.pid,started.pid); assert.equal(f.calls.length,calls)
})
test('objective exit retires only owned worker, preserving legacy shares and other work', async () => {
  const f=fixture({procs:[{pid:1,filename:'mcp_share.js',threads:64,args:[42,'generation:256']},{pid:2,filename:'scripts/share.js',threads:10},{pid:3,filename:'scripts/grow.js',threads:100}]})
  const result=await reconcileReputation(f.ns,{}, {...f.options,objective:'money'})
  assert.equal(result.state,'off'); assert.deepEqual(f.calls,[['kill',1]])
  assert.deepEqual(f.ns.ps('cloud').map(p=>p.pid),[2,3])
})
test('owner restart retires previous generation before launching replacement', async () => {
  const f=fixture({procs:[{pid:1,filename:'mcp_share.js',threads:64,args:[41,'old:256']}]})
  const result=await reconcileReputation(f.ns,{},f.options)
  assert.equal(result.pid,100); assert.deepEqual(f.calls[0],['kill',1])
  assert.deepEqual(f.ns.ps('cloud')[0].args,[42,'generation:256'])
})
test('copy failure surfaces before reclaiming active actions', async () => {
  const f=fixture({scp:false,procs:[{pid:1,filename:'scripts/grow.js',threads:100}]})
  await assert.rejects(reconcileReputation(f.ns,{},f.options),/copy failed/)
  assert.equal(f.calls.some(x=>x[0]==='kill'||x[0]==='exec'),false)
})
test('exec failure surfaces instead of reporting healthy sharing', async () => {
  const f=fixture({exec:false})
  await assert.rejects(reconcileReputation(f.ns,{},f.options),/launch failed/)
})
test('retry cooldown does not repeatedly launch', async () => {
  const f=fixture()
  const result=await reconcileReputation(f.ns,{retryAt:Date.now()+60000},f.options)
  assert.equal(result.state,'waiting'); assert.deepEqual(f.calls,[])
})
test('objective command accepts supported values and rejects unsupported values without mutation', async () => {
  for (const arg of ['money','xp','reputation','clear']) {
    const f=fixture(); f.ns.args=[arg]; await setObjective(f.ns)
    assert.equal(f.files['mcp_objective_override.txt'],arg==='clear'?'':arg)
  }
  const f=fixture(); f.ns.args=['rep']; await setObjective(f.ns)
  assert.equal(f.files['mcp_objective_override.txt'],'xp'); assert.deepEqual(f.calls,[])
})
test('disabled reputation command preserves prior objective', async () => {
  const f=fixture({enabled:false}); f.ns.args=['reputation']; await setObjective(f.ns)
  assert.equal(f.files['mcp_objective_override.txt'],'xp'); assert.deepEqual(f.calls,[])
})

test('share worker exits after owner stops, and invalid ownership never shares', async () => {
  const { main } = await import('./mcp_share.js')
  for (const args of [[],[0,'generation'],[42,'']]) {
    let calls=0
    await main({args,disableLog(){},isRunning:()=>true,share:async()=>{calls++;throw new Error('unexpected share')}})
    assert.equal(calls,0)
  }
  let calls=0, running=true
  await main({args:[42,'generation'],disableLog(){},isRunning:pid=>pid===42&&running,share:async()=>{calls++;running=false}})
  assert.equal(calls,1)
})
