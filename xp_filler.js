/**
 * Turns cloud and rooted-host RAM MCP is not using into hacking XP. Each pass starts one-shot
 * weakens on the best XP target, keeping the three largest cloud servers clear so MCP cohorts still fit,
 * plus servers holding the RAM budgets of running stacks so their launches never find the fleet full.
 * Weakening cannot hurt a target. Stop it by killing this script; workers finish alone.
 *
 * Start: run xp_filler.js. Writes xp_filler_status.json.
 * @param {NS} ns
 */
import { LEGACY_BUDGET_GB, readStacks } from "stack_files.js"
import { bestXpTarget, fillableCloud, fillerThreads } from "xp_filler_logic.js"

const WORKER = "scripts/xp_weaken.js"
const STATUS = "xp_filler_status.json"
const POLL_MS = 20_000

function stackReserve(ns) {
  return readStacks(ns).reduce((sum, s) => sum + (s.ramBudget || LEGACY_BUDGET_GB), 0)
}

function rootedHosts(ns) {
  const seen = new Set(["home"])
  for (const host of seen) for (const next of ns.scan(host)) seen.add(next)
  return [...seen].filter(h => h !== "home" && h !== "darkweb" && ns.hasRootAccess(h) && ns.getServerRequiredHackingLevel(h) <= ns.getHackingLevel())
}

export async function main(ns) {
  ns.disableLog("ALL")
  while (true) {
    const player = ns.getPlayer()
    const cloud = new Set(ns.cloud.getServerNames())
    const rooted = rootedHosts(ns).filter(h => !cloud.has(h))
    const target = bestXpTarget(rooted.map(host => ({
      host, exp: ns.formulas.hacking.hackExp(ns.getServer(host), player), weakenMs: ns.getWeakenTime(host),
    })))
    let started = 0, threads = 0
    // MCP schedules only on cloud servers, so rooted hosts need no margin.
    const fillable = fillableCloud([...cloud].map(host => ({ host, max: ns.getServerMaxRam(host) })), 3, stackReserve(ns))
    if (target) for (const host of [...fillable, ...rooted]) {
      const want = fillerThreads(ns.getServerMaxRam(host), ns.getServerUsedRam(host), cloud.has(host) ? 0.05 : 0)
      if (want < 1) continue
      ns.scp(WORKER, host, "home")
      if (ns.exec(WORKER, host, want, target)) { started++; threads += want }
    }
    ns.write(STATUS, JSON.stringify({ ts: Date.now(), target, started, threads }), "w")
    await ns.sleep(POLL_MS)
  }
}
