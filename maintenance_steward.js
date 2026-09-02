/**
 * Low-frequency operations steward. It observes every 30 seconds and only
 * performs one bounded MCP recovery after a sustained stale status. Contract
 * discovery/submission remains in cct_watcher.js on a cloud worker.
 */
import { shouldRequestMcpRecovery } from "maintenance_logic.js"
import { prepareContractWorker, selectContractWorker } from "cct_worker_pool.js"

const STATUS = "maintenance_status.json"
const HISTORY = "maintenance_history.txt"
const POLL_MS = 30_000
const HISTORY_LIMIT = 100
const AUGMENTATION_REFRESH_MS = 120_000

function readJson(ns, file, fallback = null) {
  try { const raw = ns.read(file); return raw ? JSON.parse(raw) : fallback } catch { return fallback }
}
function appendHistory(ns, item) {
  const lines = String(ns.read(HISTORY) || "").split("\n").filter(Boolean)
  lines.push(JSON.stringify(item))
  ns.write(HISTORY, lines.slice(-HISTORY_LIMIT).join("\n") + "\n", "w")
}
function startWatcher(ns) {
  if (!ns.isRunning("cct_watcher.js", "home")) return ns.run("cct_watcher.js", 1)
  return -1
}
async function refreshAugmentationReadiness(ns) {
  const current = readJson(ns, "augmentation_readiness.json", null)
  if (Number.isFinite(current?.ts) && Date.now() - current.ts < AUGMENTATION_REFRESH_MS) return { refreshed: false, status: current }
  try {
    // Singularity's augmentation API has a large static-RAM footprint. Use
    // a briefly-preemptible worker, then copy the compact result home.
    const ram = ns.getScriptRam("augmentation_readiness.js", "home")
    const prepared = await prepareContractWorker(ns, selectContractWorker(ns, ram), ram)
    if (!prepared.ok) return { refreshed: false, error: prepared.reason, requiredRam: ram, status: current }
    const copied = await ns.scp("augmentation_readiness.js", prepared.worker, "home")
    const pid = copied ? ns.exec("augmentation_readiness.js", prepared.worker, 1, "--once") : 0
    if (!pid) return { refreshed: false, error: `could not start on ${prepared.worker}`, status: current }
    while (ns.isRunning(pid, prepared.worker)) await ns.sleep(100)
    const pulled = await ns.scp("augmentation_readiness.json", "home", prepared.worker)
    const status = pulled ? readJson(ns, "augmentation_readiness.json", null) : null
    return { refreshed: Boolean(status), worker: prepared.worker, source: prepared.source, status, error: status?.ok ? null : status?.reason || "assessment did not produce status" }
  } catch (error) {
    return { refreshed: false, error: String(error), status: current }
  }
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  // mcp_launch refreshes the watcher before MCP is allocated. Do not kill it
  // here: that would reintroduce a scheduling race on a RAM-full home.
  let prior = readJson(ns, STATUS, {})
  while (true) {
    const now = Date.now()
    const mcp = readJson(ns, "mcp_status.json")
    const stale = !Number.isFinite(mcp?.ts) || now - mcp.ts > 90_000
    const augmentation = await refreshAugmentationReadiness(ns)
    const state = {
      ts: now, pollMs: POLL_MS, mcp: { stale, ageMs: Number.isFinite(mcp?.ts) ? now - mcp.ts : null },
      contracts: readJson(ns, "cct_queue_status.json", { action: "waiting" }),
      recovery: prior.recovery || { count: 0, lastAt: null },
      watcherPid: startWatcher(ns),
      augmentation,
    }
    if (stale) state.mcpStaleSince = prior.mcpStaleSince || now
    if (shouldRequestMcpRecovery({ now, mcp, previous: { ...prior, mcpStaleSince: state.mcpStaleSince, lastRecoveryAt: state.recovery.lastAt } })) {
      const token = `maintenance-${now}`
      ns.write("mcp_restart.txt", `${token}\n`, "w")
      state.recovery = { count: Number(prior.recovery?.count || 0) + 1, lastAt: now, reason: "MCP status stale for at least 60s" }
      state.recoveryRequested = true
      appendHistory(ns, { ts: now, event: "mcp-recovery-requested", ...state.recovery })
    }
    if (!stale && prior.mcpStaleSince) appendHistory(ns, { ts: now, event: "mcp-status-recovered" })
    ns.write(STATUS, JSON.stringify(state, null, 2), "w")
    prior = state
    await ns.sleep(POLL_MS)
  }
}
