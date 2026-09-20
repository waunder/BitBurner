/**
 * One-shot matched-interval Darknet ROI measurement.
 *
 * Usage: run dnet_roi.js start [label]
 *        run dnet_roi.js finish [label]
 *
 * `start` records an immutable baseline. `finish` compares the current state
 * to that baseline and writes a durable report. It changes no Darknet or MCP
 * process, so the operator can measure either a Darknet-on or Darknet-off
 * interval while leaving the rest of the game unchanged.
 *
 * Reads: mcp_status.json, dnet_manager_registry.json, player/money sources.
 * Writes: dnet_roi_baseline.json, dnet_roi_current.json, dnet_roi_*.json.
 *
 * @param {NS} ns
 */
const BASELINE_FILE = "dnet_roi_baseline.json"
const CURRENT_FILE = "dnet_roi_current.json"
const FRESH_MANAGER_MS = 120000

function readJson(ns, file) {
  try { return JSON.parse(ns.read(file)) } catch { return null }
}

function safeLabel(value) {
  const text = String(value || "interval").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "")
  return text || "interval"
}

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback
}

function snapshot(ns, label) {
  const now = Date.now()
  const mcp = readJson(ns, "mcp_status.json") || {}
  const registry = readJson(ns, "dnet_manager_registry.json") || {}
  const activeManagers = Object.values(registry).filter((ts) => now - finite(ts, 0) <= FRESH_MANAGER_MS).length
  const player = ns.getPlayer()
  const sources = ns.getMoneySources()?.sinceInstall || {}
  return {
    schema: 1,
    ts: now,
    label: safeLabel(label),
    cash: ns.getServerMoneyAvailable("home"),
    player: { charisma: finite(player?.skills?.charisma), hacking: finite(player?.skills?.hacking) },
    moneySources: { darknet: finite(sources.darknet), hacking: finite(sources.hacking) },
    darknet: { activeManagers },
    mcp: {
      incomePerSec: finite(mcp.incomePerSec),
      expPerSec: finite(mcp.expPerSec),
      totalHacked: finite(mcp.totalHacked),
      ramUtilization: finite(mcp.ramUtilization),
      workerCount: Array.isArray(mcp.workers) ? mcp.workers.length : 0,
      targetCount: Array.isArray(mcp.targets) ? mcp.targets.length : 0,
    },
  }
}

function delta(end, start, key) { return finite(end?.[key]) - finite(start?.[key]) }

function reportFor(start, end) {
  const elapsedSec = Math.max(0, (end.ts - start.ts) / 1000)
  const elapsedMin = elapsedSec / 60
  const dnetMoney = delta(end.moneySources, start.moneySources, "darknet")
  const hackedMoney = delta(end.moneySources, start.moneySources, "hacking")
  return {
    schema: 1,
    label: end.label,
    startedAt: start.ts,
    endedAt: end.ts,
    elapsedSec,
    start,
    end,
    delta: {
      cash: end.cash - start.cash,
      darknetMoney: dnetMoney,
      hackingMoney: hackedMoney,
      charisma: delta(end.player, start.player, "charisma"),
      hackingLevel: delta(end.player, start.player, "hacking"),
      mcpHacked: delta(end.mcp, start.mcp, "totalHacked"),
    },
    rates: {
      darknetMoneyPerSec: elapsedSec ? dnetMoney / elapsedSec : 0,
      hackingMoneyPerSec: elapsedSec ? hackedMoney / elapsedSec : 0,
      charismaPerMin: elapsedMin ? delta(end.player, start.player, "charisma") / elapsedMin : 0,
      mcpIncomePerSecStart: start.mcp.incomePerSec,
      mcpIncomePerSecEnd: end.mcp.incomePerSec,
    },
    interpretation: "Compare paired intervals with the same MCP objective and similar target readiness. Darknet is competitive only if its added money/progression exceeds its RAM and operational cost.",
  }
}

function compact(value) {
  const n = finite(value)
  for (const [size, suffix] of [[1e12, "t"], [1e9, "b"], [1e6, "m"], [1e3, "k"]]) if (Math.abs(n) >= size) return `${(n / size).toFixed(2)}${suffix}`
  return n.toFixed(2)
}

export async function main(ns) {
  ns.disableLog("ALL")
  const mode = String(ns.args[0] || "").toLowerCase()
  const label = safeLabel(ns.args[1])
  if (mode !== "start" && mode !== "finish") {
    ns.tprint("dnet_roi: use start [label] or finish [label]")
    return
  }
  const current = snapshot(ns, label)
  if (mode === "start") {
    ns.write(BASELINE_FILE, JSON.stringify(current, null, 2), "w")
    ns.tprint(`dnet_roi: started ${current.label}; managers=${current.darknet.activeManagers}, MCP=${compact(current.mcp.incomePerSec)}/s`)
    return
  }
  const start = readJson(ns, BASELINE_FILE)
  if (!start || !Number.isFinite(start.ts)) {
    ns.tprint("dnet_roi: no baseline; run dnet_roi.js start [label] first")
    return
  }
  const report = reportFor(start, current)
  const reportFile = `dnet_roi_${current.label}_${start.ts}.json`
  ns.write(reportFile, JSON.stringify(report, null, 2), "w")
  ns.write(CURRENT_FILE, JSON.stringify(report, null, 2), "w")
  ns.tprint(`dnet_roi: ${compact(report.elapsedSec)}s; dnet=${compact(report.rates.darknetMoneyPerSec)}/s, hack=${compact(report.rates.hackingMoneyPerSec)}/s, cha=${compact(report.rates.charismaPerMin)}/min; ${reportFile}`)
}
