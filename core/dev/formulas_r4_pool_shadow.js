/**
 * Read-only target-pool shadow scan for the R4 formulas audit.
 *
 * Usage: run formulas_r4_pool_shadow.js [poolThreads] [limit]
 * No target selection, deployment, hacking, or configuration is changed.
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

export function main(ns) {
  ns.disableLog("ALL")
  const poolThreads = Number(ns.args[0] || 100)
  const limit = Math.max(1, Math.floor(Number(ns.args[1] || 15)))
  if (!Number.isFinite(poolThreads) || poolThreads < 0) {
    ns.tprint("formulas_r4_pool_shadow: poolThreads must be non-negative")
    return
  }
  try {
    if (!ns.fileExists("Formulas.exe", "home")) {
      ns.tprint("formulas_r4_pool_shadow: Formulas.exe is required")
      return
    }
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
        deltaPct: ((result.models.hypothetical.effectiveScore / Math.max(result.models.current.effectiveScore, 1e-9)) - 1) * 100,
      })
    }
    const rank = (key) => rows.slice().sort((a, b) => b[key] - a[key]).slice(0, limit)
    ns.tprint(JSON.stringify({
      ok: true,
      poolThreads,
      targetCount: rows.length,
      currentRanking: rank("current"),
      minimumSecurityRanking: rank("minimum"),
      note: "Read-only target-pool shadow; no production decision or game-changing call was made.",
    }))
  } catch (error) {
    ns.tprint(JSON.stringify({
      ok: false,
      error: String(error && error.message ? error.message : error),
      note: "Pool shadow failed closed.",
    }))
  }
}
