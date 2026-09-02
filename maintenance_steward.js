/**
 * Low-frequency operations steward. It observes every 30 seconds and only
 * performs one bounded MCP recovery after a sustained stale status. Contract
 * discovery/submission remains in cct_watcher.js on a cloud worker.
 */
import { shouldRequestMcpRecovery } from "maintenance_logic.js"

const STATUS = "maintenance_status.json"
const HISTORY = "maintenance_history.txt"
const POLL_MS = 30_000
const HISTORY_LIMIT = 100

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
function startAugmentationReadiness(ns) {
  if (!ns.isRunning("augmentation_readiness.js", "home")) return ns.run("augmentation_readiness.js", 1)
  return -1
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
    const state = {
      ts: now, pollMs: POLL_MS, mcp: { stale, ageMs: Number.isFinite(mcp?.ts) ? now - mcp.ts : null },
      contracts: readJson(ns, "cct_queue_status.json", { action: "waiting" }),
      recovery: prior.recovery || { count: 0, lastAt: null },
      watcherPid: startWatcher(ns),
      augmentationReadinessPid: startAugmentationReadiness(ns),
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
