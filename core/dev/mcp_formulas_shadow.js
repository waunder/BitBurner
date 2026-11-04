/**
 * Read-only long-running R4 formulas shadow monitor.
 *
 * Usage: run mcp_formulas_shadow.js [intervalMs] [samples]
 * Reads mcp_status.json for the manager's observed target/income/pool and
 * compares it with a formulas-backed minimum-security ranking. It never
 * changes target selection or worker allocation.
 * @param {NS} ns
 */
import { auditTargetModels } from "./formulas_logic.js"

const CONSTANTS = {
  targetMoneyGoal: 0.95,
  horizonSeconds: 3600,
  growTimeRatio: 4 / 1.25,
  hackSecIncrease: 0.002,
  growSecIncrease: 0.004,
  weakenSecDecrease: 0.05,
  weakenPerHackRatio: 4,
  weakenPerGrowRatio: 1.25,
}
const SNAPSHOT_FILE = "mcp_formulas_shadow.txt"

function writeSnapshot(ns, snapshot) {
  const line = JSON.stringify(snapshot)
  ns.write(SNAPSHOT_FILE, `${line}\n`, "a")
  ns.print(`snapshot: ${line}`)
}

function allServers(ns) {
  const seen = new Set(["home"])
  const queue = ["home"]
  while (queue.length) {
    const host = queue.shift()
    for (const next of ns.scan(host)) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return [...seen]
}

function model(ns, target, poolThreads, state) {
  const server = ns.getServer(target)
  const player = ns.getPlayer()
  if (state === "minimum-security") server.hackDifficulty = server.minDifficulty
  const f = ns.formulas.hacking
  return {
    ...CONSTANTS,
    hackTimeSeconds: f.hackTime(server, player) / 1000,
    hackPercentPerThread: f.hackPercent(server, player),
    growLogPerThread: Math.log(f.growPercent(server, 1, player, 1)),
    maxMoney: server.moneyMax,
    hackChance: f.hackChance(server, player),
    poolThreads,
    money: server.moneyAvailable,
  }
}

function managerStatus(ns) {
  try {
    const raw = ns.read("mcp_status.json")
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}

function rankMinimumSecurity(ns, poolThreads) {
  const rows = []
  for (const target of allServers(ns)) {
    const server = ns.getServer(target)
    if (!server.hasAdminRights || server.moneyMax <= 0 || ns.getHackingLevel() < server.requiredHackingSkill) continue
    const result = auditTargetModels({
      target,
      currentModel: model(ns, target, poolThreads, "current"),
      hypotheticalModel: model(ns, target, poolThreads, "minimum-security"),
    })
    if (!result.eligible) continue
    rows.push({
      target,
      current: result.models.current.effectiveScore,
      minimum: result.models.hypothetical.effectiveScore,
    })
  }
  return rows.sort((a, b) => b.minimum - a.minimum)
}

export async function main(ns) {
  ns.disableLog("ALL")
  const intervalMs = Math.max(60000, Number(ns.args[0] || 120000))
  const sampleLimit = Math.max(0, Math.floor(Number(ns.args[1] || 0)))
  if (!ns.fileExists("Formulas.exe", "home")) {
    ns.tprint("mcp_formulas_shadow: Formulas.exe is required")
    return
  }
  let samples = 0
  while (sampleLimit === 0 || samples < sampleLimit) {
    try {
      const status = managerStatus(ns)
      const poolThreads = Number(status && status.maxWeaken)
      if (!(poolThreads > 0)) {
        const snapshot = { ts: Date.now(), ready: false, reason: "waiting for mcp_status.json/maxWeaken" }
        ns.clearLog()
        writeSnapshot(ns, snapshot)
        ns.print("mcp_formulas_shadow: waiting for mcp_status.json/maxWeaken")
      } else {
        const ranking = rankMinimumSecurity(ns, poolThreads)
        const top = ranking.slice(0, 5).map((row) => `${row.target} ${row.minimum.toFixed(0)}/s`)
        const snapshot = {
          ts: Date.now(),
          ready: true,
          poolThreads,
          managerTarget: status.target || null,
          incomePerSec: Number(status.incomePerSec || 0),
          invariantViolations: status.invariantViolations || {},
          minimumSecurityTop: ranking.slice(0, 10),
        }
        ns.clearLog()
        writeSnapshot(ns, snapshot)
        ns.print(`formulas shadow pool=${poolThreads} manager=${status.target || "none"} income=${Number(status.incomePerSec || 0).toFixed(0)}/s`)
        ns.print(`minimum-security top: ${top.join(" | ")}`)
        ns.print(`baseline invariants: ${JSON.stringify(status.invariantViolations || {})}`)
      }
    } catch (error) {
      ns.clearLog()
      writeSnapshot(ns, { ts: Date.now(), ready: false, error: String(error && error.message ? error.message : error) })
      ns.print(`mcp_formulas_shadow error: ${String(error && error.message ? error.message : error)}`)
    }
    samples++
    if (sampleLimit > 0 && samples >= sampleLimit) break
    await ns.sleep(intervalMs)
  }
}
