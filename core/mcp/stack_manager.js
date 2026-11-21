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
// 2026-11-19 13:40: HACK_FRACTION 0.1 -> 0.25. Live: nine stacks earned ~$265b/s (measured within 2-15% of
// estimate) on ~51TB while ~5.7PB of the fleet sat unused and MCP earned $0.12b/s per TB, so stack size, not RAM,
// was the limit. Expect ~2.5x per stack for ~2.7x RAM (grow threads scale with ln(1/(1-f))). Applies to stacks
// started after the change (next install). Revert to 0.1 if stacks fall out of isHealthy or earn under 2x.
// 2026-11-20: 0.25 -> 0.4 and spacing 2000 -> 1000ms (Ken: max cash for the 8th sleeve). No stack was running and
// the fleet (~6.9PB) was idle, so RAM is no limit. The fraction stays under 0.5: isHealthy reads money >= 50%, and
// a check between a batch's hack and grow landing would otherwise reset the stack. A batch's four landings span
// 3 x GAP_MS = 600ms, under the 1000ms spacing, so batches do not interleave. Expect ~3.2x per stack.
// 2026-11-20 19:31 (one-time task, Ken approved 18:20): spacing 1000 -> 500ms, gap 200 -> 100ms for more cash
// toward the 8th sleeve. After an hour stable (9 stacks, 0 resets, $1.54t/s) the stacks were RAM-budget bound,
// and the budget scales with batches in flight, so twice the batches should roughly double income. Landings now
// span 3 x 100 = 300ms, under 500ms. Kept only if income beats $1.54t/s by 20% with no resets; else back to 1000/200.
const HACK_FRACTION = 0.4, SPACING_MS = 500, GAP_MS = 100
// MCP and its preparation work get the rest, plus whatever the stacks leave unused.
// 2026-11-18: 0.6 -> 0.9 and 4 -> 5 stacks. Live: stacks earned $0.9-1.9m/s per TB, MCP $0.2-0.3m/s on
// 21TB, and silver-helix (est $55m/s, 29TB) could not fit beside the four running stacks.
// 2026-11-19: 5 -> 10. Running stacks are never dropped, so the five picked at low hacking early in
// cycle 8 (121TB of a 6.4PB share) blocked megacorp (est $516m/s per TB vs alpha-ent measured $17m/s).
const FLEET_SHARE = 0.9, MAX_STACKS = 10
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

/** Files from runs that ended, such as before an install, would count as stacks. A file looks live for two minutes, so this runs every pass. */
function clearDeadStatus(ns) {
  const live = new Set(readStacks(ns).map(s => s.target))
  for (const file of ns.ls("home", "stack_status")) {
    try { if (!live.has(JSON.parse(ns.read(file))?.target)) ns.rm(file) } catch { /* partial write */ }
  }
}

export async function main(ns) {
  ns.disableLog("ALL")
  while (true) {
    clearDeadStatus(ns)
    const status = { ts: Date.now(), state: "waiting for Formulas.exe", plan: [], started: [], failed: [] }
    if (ns.fileExists("Formulas.exe", "home")) {
      const player = ns.getPlayer()
      const estimates = rootedTargets(ns).map(t => estimate(ns, t, player)).filter(Boolean)
      const capacity = ns.cloud.getServerNames().reduce((sum, h) => sum + ns.getServerMaxRam(h), 0) * FLEET_SHARE
      const plan = planStacks(estimates, runningStacks(ns), capacity, { maxStacks: MAX_STACKS })
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
