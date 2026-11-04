/**
 * Read-only R4 formulas shadow adapter.
 *
 * Usage: run formulas_r4_shadow.js [target] [poolThreads]
 * It compares current security with a minimum-security hypothetical while
 * preserving the live money balance. It never changes production decisions.
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

function metricBundle(ns, target, poolThreads, state) {
  const server = ns.getServer(target)
  const player = ns.getPlayer()
  if (state === "minimum-security") server.hackDifficulty = server.minDifficulty
  const f = ns.formulas.hacking
  const growPercent = f.growPercent(server, 1, player, 1)
  return {
    ...CONSTANTS,
    hackTimeSeconds: f.hackTime(server, player) / 1000,
    hackPercentPerThread: f.hackPercent(server, player),
    growLogPerThread: Math.log(growPercent),
    maxMoney: server.moneyMax,
    hackChance: f.hackChance(server, player),
    poolThreads,
    money: server.moneyAvailable,
  }
}

export function main(ns) {
  ns.disableLog("ALL")
  const target = String(ns.args[0] || "silver-helix")
  const poolThreads = Number(ns.args[1] || 100)
  if (!Number.isFinite(poolThreads) || poolThreads < 0) {
    ns.tprint("formulas_r4_shadow: poolThreads must be a non-negative number")
    return
  }
  try {
    if (!ns.fileExists("Formulas.exe", "home")) {
      ns.tprint("formulas_r4_shadow: Formulas.exe is required")
      return
    }
    const result = auditTargetModels({
      target,
      currentModel: metricBundle(ns, target, poolThreads, "current"),
      hypotheticalModel: metricBundle(ns, target, poolThreads, "minimum-security"),
    })
    ns.tprint(JSON.stringify({
      ...result,
      note: "Shadow-only comparison; no production decision or game-changing call was made.",
    }))
  } catch (error) {
    ns.tprint(JSON.stringify({
      eligible: false,
      target,
      error: String(error && error.message ? error.message : error),
      note: "Shadow adapter failed closed.",
    }))
  }
}
