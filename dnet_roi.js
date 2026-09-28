/**
 * One-shot matched-interval Darknet ROI measurement.
 *
 * Usage: run dnet_roi.js start <label>
 *        run dnet_roi.js finish <label>
 *
 * `start` records an immutable baseline. `finish` compares the current state
 * to that baseline and writes a durable report. It changes no Darknet or MCP
 * process, so the operator can measure either a Darknet-on or Darknet-off
 * interval while leaving the rest of the game unchanged.
 *
 * A label names one interval and its baseline file. Finish never falls back
 * to a different label's baseline: that was how a short follow-up could be
 * accidentally compared with an old cumulative sample.
 *
 * Reads: mcp_status.json, dnet_manager_registry.json,
 * dnet_deployer_home.json, player/money sources.
 * Writes: dnet_roi_baseline_<label>.json, dnet_roi_current.json,
 * dnet_roi_*.json.
 *
 * @param {NS} ns
 */
const CURRENT_FILE = "dnet_roi_current.json"
const FRESH_MANAGER_MS = 120000

function readJson(ns, file) {
  try { return JSON.parse(ns.read(file)) } catch { return null }
}

export function safeLabel(value) {
  const text = String(value || "interval").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "")
  return text || "interval"
}

export function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback
}

export function baselineFile(label) {
  return `dnet_roi_baseline_${safeLabel(label)}.json`
}

function ramCapacity(entries) {
  const valid = Array.isArray(entries) ? entries : []
  return valid.reduce((total, entry) => ({
    count: total.count + 1,
    maxRam: total.maxRam + finite(entry?.maxRam),
    usedRam: total.usedRam + finite(entry?.usedRam),
    freeRam: total.freeRam + finite(entry?.freeRam),
  }), { count: 0, maxRam: 0, usedRam: 0, freeRam: 0 })
}

function targetReadiness(ns, mcp) {
  const target = typeof mcp.target === "string" && mcp.target ? mcp.target : null
  if (!target) return { target: null, available: false }
  try {
    const server = ns.getServer(target)
    const moneyMax = finite(server?.moneyMax)
    const moneyAvailable = finite(server?.moneyAvailable)
    const minSecurity = finite(server?.minDifficulty)
    const security = finite(server?.hackDifficulty)
    return {
      target,
      available: true,
      moneyAvailable,
      moneyMax,
      moneyPct: moneyMax > 0 ? moneyAvailable / moneyMax : null,
      security,
      minSecurity,
      securityGap: security - minSecurity,
    }
  } catch {
    return {
      target,
      available: false,
      // mcp's last measured money percentage remains useful when the target
      // vanishes between status write and this diagnostic snapshot.
      moneyPct: Number.isFinite(Number(mcp.moneyPct)) ? Number(mcp.moneyPct) : null,
      security: Number.isFinite(Number(mcp.currentSecurity)) ? Number(mcp.currentSecurity) : null,
    }
  }
}

export function snapshot(ns, label) {
  const now = Date.now()
  const mcp = readJson(ns, "mcp_status.json") || {}
  const registry = readJson(ns, "dnet_manager_registry.json") || {}
  const timestamps = Object.values(registry).map((ts) => finite(ts, NaN)).filter(Number.isFinite)
  const freshTimestamps = timestamps.filter((ts) => now - ts >= 0 && now - ts <= FRESH_MANAGER_MS)
  const rootHeartbeat = readJson(ns, "dnet_deployer_home.json") || null
  const rootAgeMs = Number.isFinite(Number(rootHeartbeat?.ts)) ? Math.max(0, now - Number(rootHeartbeat.ts)) : null
  const workers = ramCapacity(mcp.workers)
  const cloudWorkers = ramCapacity(mcp.cloudWorkers)
  const player = ns.getPlayer()
  const sources = ns.getMoneySources()?.sinceInstall || {}
  return {
    schema: 2,
    ts: now,
    label: safeLabel(label),
    cash: ns.getServerMoneyAvailable("home"),
    player: { charisma: finite(player?.skills?.charisma), hacking: finite(player?.skills?.hacking) },
    moneySources: { darknet: finite(sources.darknet), hacking: finite(sources.hacking) },
    darknet: {
      registryCount: timestamps.length,
      activeManagers: freshTimestamps.length,
      staleManagers: timestamps.length - freshTimestamps.length,
      newestManagerAgeMs: freshTimestamps.length ? Math.max(0, now - Math.max(...freshTimestamps)) : null,
      oldestManagerAgeMs: freshTimestamps.length ? Math.max(0, now - Math.min(...freshTimestamps)) : null,
      managerFresh: freshTimestamps.length > 0,
      rootHeartbeatAgeMs: rootAgeMs,
      rootHeartbeatFresh: rootAgeMs !== null && rootAgeMs <= FRESH_MANAGER_MS,
      root: {
        crawlRam: finite(rootHeartbeat?.crawlRam, null),
        host: rootHeartbeat?.host || null,
        pass: finite(rootHeartbeat?.pass, null),
      },
    },
    mcp: {
      runId: typeof mcp.runId === "string" ? mcp.runId : null,
      target: typeof mcp.target === "string" ? mcp.target : null,
      plan: typeof mcp.plan === "string" ? mcp.plan : null,
      readiness: targetReadiness(ns, mcp),
      incomePerSec: finite(mcp.incomePerSec),
      expPerSec: finite(mcp.expPerSec),
      totalHacked: finite(mcp.totalHacked),
      ramUtilization: finite(mcp.ramUtilization),
      workerCount: workers.count,
      targetCount: Array.isArray(mcp.targets) ? mcp.targets.length : 0,
      workerCapacity: workers,
      cloudWorkerCapacity: cloudWorkers,
    },
  }
}

function delta(end, start, key) { return finite(end?.[key]) - finite(start?.[key]) }

function endpointManagerFresh(snapshot) {
  return snapshot?.darknet?.managerFresh === true && snapshot?.darknet?.rootHeartbeatFresh === true
}

export function inconclusiveFlags(start, end) {
  const managerFreshness = !endpointManagerFresh(start) || !endpointManagerFresh(end)
  const startPlan = start?.mcp?.plan || null
  const endPlan = end?.mcp?.plan || null
  const phaseMismatch = !startPlan || !endPlan || startPlan !== endPlan
  const startTarget = start?.mcp?.target || null
  const endTarget = end?.mcp?.target || null
  const targetMismatch = !startTarget || !endTarget || startTarget !== endTarget
  const reasons = []
  if (managerFreshness) reasons.push("Darknet manager or root heartbeat was absent/stale at an endpoint")
  if (phaseMismatch) reasons.push("MCP plan phase changed or was unavailable between endpoints")
  if (targetMismatch) reasons.push("MCP target changed or was unavailable between endpoints")
  return { managerFreshness, phaseMismatch, targetMismatch, reasons }
}

export function reportFor(start, end) {
  const elapsedSec = Math.max(0, (end.ts - start.ts) / 1000)
  const elapsedMin = elapsedSec / 60
  const dnetMoney = delta(end.moneySources, start.moneySources, "darknet")
  const hackedMoney = delta(end.moneySources, start.moneySources, "hacking")
  return {
    schema: 2,
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
    inconclusive: inconclusiveFlags(start, end),
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
  const rawLabel = ns.args[1]
  if ((mode !== "start" && mode !== "finish") || rawLabel === undefined || String(rawLabel).trim() === "") {
    ns.tprint("dnet_roi: use start <label> or finish <label>")
    return
  }
  const label = safeLabel(rawLabel)
  const current = snapshot(ns, label)
  if (mode === "start") {
    ns.write(baselineFile(label), JSON.stringify(current, null, 2), "w")
    ns.tprint(`dnet_roi: started ${current.label}; managers=${current.darknet.activeManagers}, root=${current.darknet.rootHeartbeatFresh ? "fresh" : "stale"}, MCP=${compact(current.mcp.incomePerSec)}/s`)
    return
  }
  const start = readJson(ns, baselineFile(label))
  if (!start || !Number.isFinite(start.ts) || start.label !== label) {
    ns.tprint(`dnet_roi: no matching '${label}' baseline; run dnet_roi.js start ${label} first`)
    return
  }
  const report = reportFor(start, current)
  const reportFile = `dnet_roi_${current.label}_${start.ts}.json`
  ns.write(reportFile, JSON.stringify(report, null, 2), "w")
  ns.write(CURRENT_FILE, JSON.stringify(report, null, 2), "w")
  const flags = Object.entries(report.inconclusive).filter(([key, value]) => key !== "reasons" && value).map(([key]) => key).join(",") || "none"
  ns.tprint(`dnet_roi: ${compact(report.elapsedSec)}s; dnet=${compact(report.rates.darknetMoneyPerSec)}/s, hack=${compact(report.rates.hackingMoneyPerSec)}/s, cha=${compact(report.rates.charismaPerMin)}/min; inconclusive=${flags}; ${reportFile}`)
}
