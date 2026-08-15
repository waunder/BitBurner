/**
 * Read-only Formulas.exe API probe for the R4 audit.
 *
 * Usage: run formulas_probe.js [target]
 * It never hacks, grows, weakens, buys, sells, deploys, or changes state.
 * Its output is the evidence needed before building a live formulas adapter.
 * @param {NS} ns
 */
function finite(value) {
  return typeof value === "number" && Number.isFinite(value)
}

function snapshot(ns, target, state) {
  const server = ns.getServer(target)
  const player = ns.getPlayer()
  if (state === "minimum-security") {
    server.hackDifficulty = server.minDifficulty
    server.moneyAvailable = server.moneyMax
  }
  const f = ns.formulas.hacking
  const values = {
    state,
    target,
    serverFields: {
      hackDifficulty: server.hackDifficulty,
      minDifficulty: server.minDifficulty,
      moneyAvailable: server.moneyAvailable,
      moneyMax: server.moneyMax,
      serverGrowth: server.serverGrowth,
      requiredHackingSkill: server.requiredHackingSkill,
    },
    hackChance: f.hackChance(server, player),
    hackPercent: f.hackPercent(server, player),
    hackTimeMs: f.hackTime(server, player),
    growTimeMs: f.growTime(server, player),
    weakenTimeMs: f.weakenTime(server, player),
    growThreadsToMax: f.growThreads(server, player, server.moneyMax),
  }
  const invalid = Object.entries(values)
    .filter(([key, value]) => typeof value === "number" && !finite(value))
    .map(([key]) => key)
  return { ...values, invalid }
}

export function main(ns) {
  ns.disableLog("ALL")
  const target = String(ns.args[0] || "silver-helix")
  try {
    if (!ns.fileExists("Formulas.exe", "home")) {
      ns.tprint(JSON.stringify({ ok: false, reason: "Formulas.exe not found on home", target }))
      return
    }
    const result = {
      ok: true,
      api: "formulas.hacking",
      target,
      current: snapshot(ns, target, "current"),
      minimumSecurity: snapshot(ns, target, "minimum-security"),
      note: "Read-only probe; no game-changing calls were made.",
    }
    ns.tprint(JSON.stringify(result))
  } catch (error) {
    ns.tprint(JSON.stringify({
      ok: false,
      target,
      error: String(error && error.message ? error.message : error),
      note: "Read-only probe failed before any game-changing call.",
    }))
  }
}
