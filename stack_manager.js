/**
 * Runs stack_batch.js on the best targets the cloud fleet can hold. Each pass prices every
 * rooted target as if prepared, starts stacks that fit, and raises budgets as the fleet grows.
 * Started by startup.js. Killing it leaves running stacks alone; it never stops one.
 *
 * Start: run stack_manager.js. Writes stack_manager_status.json and stack_budgets.json.
 * @param {NS} ns
 */
import { LEGACY_BUDGET_GB, readStacks } from "stack_files.js"
import { batchThreads, estimateStack, planStacks } from "stack_logic.js"

const RUNNER = "stack_batch.js"
const STATUS = "stack_manager_status.json"
const BUDGETS = "stack_budgets.json"
const POLL_MS = 60_000
const HACK_FRACTION = 0.1, SPACING_MS = 2000, GAP_MS = 200
// MCP and its preparation work need the rest of the fleet.
const FLEET_SHARE = 0.6
const FIRST_PORT = 101

function rootedTargets(ns) {
  const seen = new Set(["home"]), cloud = new Set(ns.cloud.getServerNames())
  for (const host of seen) for (const next of ns.scan(host)) seen.add(next)
  return [...seen].filter(h => h !== "home" && !cloud.has(h) && ns.hasRootAccess(h) && ns.getServerMaxMoney(h) > 0 && ns.getServerRequiredHackingLevel(h) <= ns.getHackingLevel())
}

function estimate(ns, target, player) {
  const f = ns.formulas.hacking, server = ns.getServer(target)
  Object.assign(server, { hackDifficulty: server.minDifficulty, moneyAvailable: server.moneyMax })
  const hackPercent = f.hackPercent(server, player), chance = f.hackChance(server, player), weakenMs = f.weakenTime(server, player)
  server.moneyAvailable = server.moneyMax * (1 - HACK_FRACTION)
  if (!(hackPercent > 0)) return null
  const threads = batchThreads({
    hackPercent, growThreadsNeeded: f.growThreads(server, player, server.moneyMax), hackFraction: HACK_FRACTION,
    hackSecurity: ns.hackAnalyzeSecurity(1), growSecurity: ns.growthAnalyzeSecurity(1), weakenPower: ns.weakenAnalyze(1),
  })
  return estimateStack({ target, maxMoney: server.moneyMax, hackPercent, chance, weakenMs, threads, hackFraction: HACK_FRACTION, spacingMs: SPACING_MS })
}

function runningStacks(ns) {
  return ns.ps("home").filter(p => p.filename.replace(/^\//, "") === RUNNER).map(p => ({ target: String(p.args[0]), ramBudget: Number(p.args[4]) || LEGACY_BUDGET_GB, port: Number(p.args[5]) || 7 }))
}

function freePort(plan) {
  const used = new Set(plan.map(p => p.port))
  let port = FIRST_PORT
  while (used.has(port)) port++
  return port
}

/** Files from runs that ended, such as before an install, would read as live stolen totals. */
function clearDeadStatus(ns) {
  const live = new Set(readStacks(ns).map(s => s.target))
  for (const file of ns.ls("home", "stack_status")) {
    try { if (!live.has(JSON.parse(ns.read(file))?.target)) ns.rm(file) } catch { /* partial write */ }
  }
}

export async function main(ns) {
  ns.disableLog("ALL")
  clearDeadStatus(ns)
  while (true) {
    const status = { ts: Date.now(), state: "waiting for Formulas.exe", plan: [], started: [], failed: [] }
    if (ns.fileExists("Formulas.exe", "home")) {
      const player = ns.getPlayer()
      const estimates = rootedTargets(ns).map(t => estimate(ns, t, player)).filter(Boolean)
      const capacity = ns.cloud.getServerNames().reduce((sum, h) => sum + ns.getServerMaxRam(h), 0) * FLEET_SHARE
      const plan = planStacks(estimates, runningStacks(ns), capacity)
      for (const item of plan.filter(p => p.added)) {
        item.port = freePort(plan)
        const ok = ns.run(RUNNER, 1, item.target, HACK_FRACTION, SPACING_MS, GAP_MS, Math.round(item.ramBudget), item.port)
        ;(ok ? status.started : status.failed).push(item.target)
        if (!ok) item.port = undefined
      }
      ns.write(BUDGETS, JSON.stringify(Object.fromEntries(plan.map(p => [p.target, p.ramBudget]))), "w")
      Object.assign(status, { state: "running", capacity, plan, estimates: estimates.sort((a, b) => b.perTB - a.perTB).slice(0, 8) })
    }
    ns.write(STATUS, JSON.stringify(status), "w")
    await ns.sleep(POLL_MS)
  }
}
