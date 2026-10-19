/** Independent progress evidence for the maintenance steward; no player-work actions. */
const ACTIONS = new Set(['scripts/hack.js', 'scripts/grow.js', 'scripts/weaken.js'])
export const WATCHDOG_VERSION = 'progress-v1'

export function inspectMcpWorkers(ns, mcp) {
  const hosts = new Set(['home'])
  for (const host of hosts) for (const next of ns.scan(host)) hosts.add(next)
  const cloud = new Set(ns.cloud.getServerNames())
  for (const host of cloud) hosts.add(host)
  // Durable batch-start evidence lets us distinguish security preparation
  // from the final weaken that a harvested target still needs.
  const batches = new Map()
  for (const line of String(ns.read('mcp_events.txt')).split('\n')) {
    try { const e = JSON.parse(line); if (e.kind === 'cloud_batch_start') batches.set(e.id, e) } catch {}
  }
  let capacityRam = 0, actionRam = 0
  const jobs = []
  for (const host of hosts) {
    const maxRam = ns.getServerMaxRam(host)
    if (host === 'home' || maxRam <= 2.5 || (!cloud.has(host) && !ns.hasRootAccess(host))) continue
    let ownedRam = 0
    for (const p of ns.ps(host)) {
      const filename = p.filename.replace(/^\//, '')
      if (!ACTIONS.has(filename)) continue
      const ram = p.threads * ns.getScriptRam(p.filename, host)
      ownedRam += ram
      const running = ns.getRunningScript(p.pid)
      const batch = batches.get(p.args[2])
      const proven = batch?.target === p.args[0] && batch?.phase === 'prepare-security' && batch.counts?.hack === 0 && batch.counts?.grow === 0 &&
        batch.jobs?.some(j => j.pid === p.pid && j.host === host && j.action === 'weaken')
      jobs.push({ host, pid: p.pid, filename, args: p.args, threads: p.threads,
        xp: running?.onlineExpGained ?? null, money: running?.onlineMoneyMade ?? null,
        securityOnly: Boolean(proven && filename === 'scripts/weaken.js' && p.args[1] === 'once') })
    }
    actionRam += ownedRam
    capacityRam += Math.max(0, maxRam - Math.max(0, ns.getServerUsedRam(host) - ownedRam))
  }
  return { capacityRam, actionRam, jobs, completedBatches: mcp?.completedBatches ?? null,
    totalHacked: mcp?.totalHacked ?? null, security: mcp?.currentSecurity ?? null, moneyPct: mcp?.moneyPct ?? null }
}

export function evaluateMcpProgress({ now, mcp, sample, previous, lastRecoveryAt, graceMs = 180_000, cooldownMs = 900_000 }) {
  const context = JSON.stringify([mcp?.runId, mcp?.config?.OBJECTIVE, mcp?.workerMode, mcp?.target])
  const state = { version: WATCHDOG_VERSION, ts: now, context, sample, since: null, action: 'none', reason: 'healthy or intentionally occupied' }
  if (!Number.isFinite(mcp?.ts) || now - mcp.ts > 90_000 || mcp.ts > now + 5000) return { ...state, reason: 'status unavailable; stale-status recovery owns this case' }
  if (!['money', 'xp'].includes(mcp.config?.OBJECTIVE)) return { ...state, reason: 'objective does not request hacking work' }
  const low = sample.capacityRam >= 32 && sample.capacityRam - sample.actionRam >= 16 && sample.actionRam / sample.capacityRam < .25
  if (!low) return state
  const same = previous?.context === context && now - previous.ts <= 90_000 && now >= previous.ts
  const before = previous?.sample
  const progressed = same && (
    sample.completedBatches !== before?.completedBatches || sample.totalHacked !== before?.totalHacked ||
    sample.security !== before?.security || sample.moneyPct !== before?.moneyPct ||
    sample.jobs.some(j => { const old = before?.jobs?.find(p => p.pid === j.pid && p.host === j.host)
      return !old || j.xp !== old.xp || j.money !== old.money }) ||
    before?.jobs?.some(p => !sample.jobs.some(j => j.pid === p.pid && j.host === p.host)))
  state.since = same && !progressed ? previous.since ?? now : now
  state.reason = 'low utilization; observing action progress'
  if (now - state.since < graceMs) return state
  state.alert = 'MCP has spare worker capacity without observed action progress for at least 3 minutes'
  state.action = 'alert'
  if (Number.isFinite(lastRecoveryAt) && now - lastRecoveryAt < cooldownMs) return { ...state, reason: 'recovery cooldown' }
  if (!sample.jobs.length && !mcp.target) return { ...state, reason: 'no selected target; report capacity without a restart loop' }
  if (!sample.jobs.length) return { ...state, action: 'restart', reason: 'no active action jobs; restart can safely refill the pool' }
  if (mcp.config.OBJECTIVE === 'xp' && mcp.workerMode === 'finite-draining' && sample.jobs.every(j => j.securityOnly)) {
    return { ...state, action: 'cancel-security', reason: 'durable batch evidence proves all blockers are security-only preparation' }
  }
  return { ...state, reason: 'active jobs may need restoration; preserve them and report' }
}

export function repairMcpProgress(ns, assessment, mcp) {
  let currentStatus
  try { currentStatus = JSON.parse(ns.read('mcp_status.json')) } catch {}
  if (!currentStatus || Date.now() - currentStatus.ts > 90_000 || currentStatus.runId !== mcp.runId ||
      currentStatus.config?.OBJECTIVE !== mcp.config?.OBJECTIVE || currentStatus.workerMode !== mcp.workerMode || currentStatus.target !== mcp.target) {
    return { ok: false, reason: 'MCP state changed before repair' }
  }
  if (assessment.action === 'restart') {
    // Revalidate that no action has launched since inspection.
    const fresh = inspectMcpWorkers(ns, mcp)
    if (fresh.jobs.length || fresh.capacityRam < 32 || fresh.capacityRam - fresh.actionRam < 16) return { ok: false, reason: 'action jobs appeared or spare capacity disappeared before restart' }
    ns.write('mcp_restart.txt', `progress-watchdog-${assessment.ts}\n`, 'w')
    return { ok: true, requested: 'restart' }
  }
  if (assessment.action !== 'cancel-security') return null
  const fresh = inspectMcpWorkers(ns, currentStatus)
  if (fresh.jobs.some(j => !j.securityOnly) || fresh.jobs.some(j => !assessment.sample.jobs.some(old => old.pid === j.pid && old.host === j.host))) {
    return { ok: false, reason: 'unproven or new jobs appeared before cancellation' }
  }
  const results = []
  for (const job of assessment.sample.jobs) {
    const current = ns.ps(job.host).find(p => p.pid === job.pid)
    if (!current) continue
    if (current.filename.replace(/^\//, '') !== job.filename || JSON.stringify(current.args) !== JSON.stringify(job.args) || !job.securityOnly) {
      results.push({ pid: job.pid, host: job.host, ok: false }); continue
    }
    results.push({ pid: job.pid, host: job.host, ok: ns.kill(job.pid) })
  }
  return { ok: results.every(r => r.ok), requested: 'cancel-security', results }
}
