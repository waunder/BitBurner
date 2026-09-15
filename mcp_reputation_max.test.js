import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readReputationConfig, reconcileReputation } from './mcp_reputation.js'

function fixture({ procs = [], capacities = { home: 128, cloud1: 4096, cloud2: 4096 }, scp = true } = {}) {
  let processes = procs.map(p => ({ args: [], ...p }))
  let nextPid = 100
  const calls = [], events = []
  const files = { 'reputation_config.json': JSON.stringify({ enabled: true, allocation: 'all' }) }
  const ns = {
    pid: 42, read: f => files[f] || '', getSharePower: () => 1.17,
    ps: host => processes.filter(p => p.host === host),
    isRunning: (pid, host) => processes.some(p => p.pid === pid && p.host === host),
    getScriptRam: f => f.replace(/^\//, '') === 'mcp_share.js' ? 4 : 2,
    getServerMaxRam: host => capacities[host],
    getServerUsedRam: host => ns.ps(host).reduce((sum, p) => sum + p.threads * ns.getScriptRam(p.filename), 0),
    async scp(...args) { calls.push(['scp', ...args]); return scp },
    kill(pid, host) {
      calls.push(['kill', pid, host])
      const found = processes.some(p => p.pid === pid && p.host === host)
      processes = processes.filter(p => !(p.pid === pid && p.host === host))
      return found
    },
    exec(filename, host, threads, ...args) {
      calls.push(['exec', filename, host, threads, ...args])
      if (threads * ns.getScriptRam(filename) > capacities[host] - ns.getServerUsedRam(host)) return 0
      const pid = nextPid++
      processes.push({ filename, host, threads, args, pid })
      return pid
    },
  }
  return { ns, calls, events, files, options: { objective: 'reputation', hosts: Object.keys(capacities), reserveHomeGb: 32, runId: 'generation', emit: (...args) => events.push(args) } }
}

test('all allocation is an explicit valid reputation policy without a numeric cap', () => {
  const f = fixture()
  const config = readReputationConfig(f.ns)
  assert.equal(config.enabled, true)
  assert.equal(config.allocation, 'all')
})

test('maximum reputation uses every host while preserving home reserve and unrelated scripts', async () => {
  const f = fixture({ procs: [
    { host: 'home', pid: 1, filename: 'mcp.js', threads: 10 },
    { host: 'cloud1', pid: 2, filename: 'scripts/grow.js', threads: 1500, args: ['phantasy', 'once', 'cohort'] },
    { host: 'cloud1', pid: 3, filename: 'unrelated.js', threads: 6 },
    { host: 'cloud2', pid: 4, filename: '/scripts/hack.js', threads: 100 },
    { host: 'cloud2', pid: 5, filename: 'scripts/share.js', threads: 2 },
  ] })
  const result = await reconcileReputation(f.ns, {}, f.options)
  assert.equal(result.state, 'sharing')
  assert.equal(result.hostCount, 3)
  assert.equal(result.threads, 2063)
  assert.equal(result.ramGb, 8252)
  assert.equal(result.allocations.length, 3)
  assert.deepEqual(f.calls.filter(c => c[0] === 'kill').map(c => c[1]).sort(), [2, 4])
  for (const host of f.options.hosts) {
    const shares = f.ns.ps(host).filter(p => p.filename === 'mcp_share.js')
    assert.equal(shares.length, 1)
    assert.deepEqual(shares[0].args, [42, 'generation:all'])
    assert.ok(f.ns.getServerUsedRam(host) <= f.ns.getServerMaxRam(host) - (host === 'home' ? 32 : 0))
  }
  assert.equal(f.ns.ps('cloud1').some(p => p.pid === 3), true)
  assert.equal(f.ns.ps('cloud2').some(p => p.pid === 5), true)
  const count = f.calls.length
  const again = await reconcileReputation(f.ns, result, f.options)
  assert.equal(again.threads, result.threads)
  assert.equal(f.calls.length, count)
})

test('objective exit retires all managed shares and preserves other work', async () => {
  const f = fixture({ procs: [
    { host: 'cloud1', pid: 1, filename: 'mcp_share.js', threads: 100, args: [42, 'generation:all'] },
    { host: 'cloud2', pid: 2, filename: 'mcp_share.js', threads: 100, args: [42, 'generation:all'] },
    { host: 'cloud2', pid: 3, filename: 'scripts/share.js', threads: 5 },
    { host: 'home', pid: 4, filename: 'scripts/weaken.js', threads: 3 },
  ] })
  const result = await reconcileReputation(f.ns, {}, { ...f.options, objective: 'money' })
  assert.equal(result.state, 'off')
  assert.equal(result.threads, 0)
  assert.equal(result.ramGb, 0)
  assert.deepEqual(f.calls.filter(c => c[0] === 'kill').map(c => c[1]).sort(), [1, 2])
  assert.equal(f.ns.ps('home').some(p => p.pid === 4), true)
  assert.equal(f.ns.ps('cloud2').some(p => p.pid === 3), true)
})

test('old generations are replaced without duplicate share processes', async () => {
  const f = fixture({ procs: [
    { host: 'cloud1', pid: 1, filename: 'mcp_share.js', threads: 64, args: [41, 'old:256'] },
    { host: 'cloud2', pid: 2, filename: 'mcp_share.js', threads: 64, args: [41, 'old:all'] },
  ] })
  const result = await reconcileReputation(f.ns, {}, f.options)
  assert.equal(result.hostCount, 3)
  assert.deepEqual(f.calls.filter(c => c[0] === 'kill').map(c => c[1]).sort(), [1, 2])
  for (const host of f.options.hosts) assert.equal(f.ns.ps(host).filter(p => p.filename === 'mcp_share.js').length, 1)
})

test('hosts with less than one share thread are skipped without launching zero threads', async () => {
  const f = fixture({ capacities: { home: 32, tiny: 3, cloud1: 4096 } })
  const result = await reconcileReputation(f.ns, {}, f.options)
  assert.equal(result.hostCount, 1)
  assert.equal(result.threads, 1024)
  assert.equal(result.ramGb, 4096)
  assert.equal(f.calls.filter(c => c[0] === 'exec').length, 1)
})

test('copy failure does not preempt action workers on the failing host', async () => {
  const f = fixture({ capacities: { cloud1: 4096 }, scp: false, procs: [
    { host: 'cloud1', pid: 1, filename: 'scripts/weaken.js', threads: 1000, args: ['phantasy', 'once'] },
  ] })
  await assert.rejects(reconcileReputation(f.ns, {}, f.options), /copy failed/)
  assert.equal(f.calls.some(c => c[0] === 'kill' || c[0] === 'exec'), false)
})
