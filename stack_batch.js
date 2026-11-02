/**
 * Stacked batches on one target; stack_manager.js starts one per target. Prepares it, then
 * starts timed batches every spacing so hack, weaken, grow and weaken land in order. Drift
 * pauses launching until jobs drain, then it re-prepares. MCP skips the target while its
 * status file is under two minutes old, so killing this script hands it back.
 *
 * Start: run stack_batch.js <target> [hackFraction=0.1] [spacingMs=2000] [gapMs=200] [ramBudgetGB=65536] [port=7]
 * Writes stack_status_<target>.json (batches, resets, stolen, $/s since first batch). Reads a
 * raised budget from stack_budgets.json.
 * @param {NS} ns
 */
import { JOB_RAM, batchRam, batchThreads, fitPrep, inFlightRam, isHealthy, isPrepared, landingDelays } from "stack_logic.js"

const WORKER = "scripts/stack_job.js"
const BUDGETS = "stack_budgets.json"
const REPORT_MS = 30000

function read(ns, target) {
  return { money: ns.getServerMoneyAvailable(target), maxMoney: ns.getServerMaxMoney(target), security: ns.getServerSecurityLevel(target), minSecurity: ns.getServerMinSecurityLevel(target) }
}

function hosts(ns) {
  return ns.cloud.getServerNames().map(host => ({ host, free: ns.getServerMaxRam(host) - ns.getServerUsedRam(host) })).sort((a, b) => b.free - a.free)
}

/** All jobs on one host, so a batch cannot half-launch for lack of room. */
function launch(ns, jobs, id, ram, port) {
  const host = hosts(ns)[0]
  if (!host || host.free < ram) return false
  ns.scp(WORKER, host.host, "home")
  jobs.forEach(([action, threads, delay], i) => { if (threads > 0) ns.exec(WORKER, host.host, threads, action, delay.target, delay.ms, port, id, i) })
  return true
}

async function waitForMcp(ns, target, report) {
  while (true) {
    let busy = true
    try { busy = JSON.parse(ns.read("mcp_status.json")).targets.some(t => t.target === target) } catch { /* partial write */ }
    if (!busy) return
    report("waiting for MCP cohort")
    await ns.sleep(5000)
  }
}

/** Long waits must keep reporting, or MCP takes the target back after two minutes. */
async function waitReporting(ns, ms, report, state) {
  for (const end = Date.now() + ms; Date.now() < end;) {
    report(state)
    await ns.sleep(Math.min(REPORT_MS, Math.max(1, end - Date.now())))
  }
}

function budgetFor(ns, target, fallback) {
  try { return JSON.parse(ns.read(BUDGETS))[target] || fallback } catch { return fallback /* none yet, or partial write */ }
}

async function prepare(ns, target, report) {
  let id = 0
  while (!isPrepared(read(ns, target))) {
    const s = read(ns, target), weakenPower = ns.weakenAnalyze(1)
    const grow = s.money < s.maxMoney * 0.95 ? Math.ceil(ns.growthAnalyze(target, s.maxMoney / Math.max(1, s.money))) : 0
    const weaken = Math.ceil((s.security - s.minSecurity + ns.growthAnalyzeSecurity(grow)) / weakenPower) + 1
    const waitMs = ns.getWeakenTime(target)
    const fit = fitPrep(grow, weaken, hosts(ns)[0]?.free ?? 0)
    const jobs = [["grow", fit.grow, { target, ms: 0 }], ["weaken", fit.weaken, { target, ms: 0 }]]
    launch(ns, jobs, `prep${id++}`, (fit.grow + fit.weaken) * JOB_RAM, 0)
    await waitReporting(ns, waitMs + 500, report, "preparing")
  }
}

export async function main(ns) {
  ns.disableLog("ALL")
  const [target, hackFraction = 0.1, spacingMs = 2000, gapMs = 200, ramBudget = 65536, port = 7] = ns.args
  const status = `stack_status_${target}.json`
  ns.getPortHandle(port).clear()
  const stats = { batches: 0, resets: 0, stolen: 0, startedAt: 0 }
  const report = (state, extra = {}) => {
    const seconds = stats.startedAt ? (Date.now() - stats.startedAt) / 1000 : 0
    ns.write(status, JSON.stringify({ ts: Date.now(), target, state, hackFraction, spacingMs, ramBudget: budgetFor(ns, target, ramBudget), ...stats, perSec: seconds ? stats.stolen / seconds : 0, ...read(ns, target), ...extra }), "w")
  }
  const drain = () => { const handle = ns.getPortHandle(port); while (!handle.empty()) stats.stolen += Number(handle.read()) || 0 }
  await waitForMcp(ns, target, report)
  let inFlight = [], id = 0
  while (true) {
    await prepare(ns, target, report)
    stats.startedAt ||= Date.now()
    while (true) {
      drain()
      const s = read(ns, target), now = Date.now()
      if (!isHealthy(s)) {
        stats.lastReset = { ts: now, moneyPct: s.money / s.maxMoney, securityOver: s.security - s.minSecurity, hacking: ns.getHackingLevel() }
        break
      }
      inFlight = inFlight.filter(b => b.endsAt > now)
      const times = { hackMs: ns.getHackTime(target), growMs: ns.getGrowTime(target), weakenMs: ns.getWeakenTime(target) }
      const threads = batchThreads({
        hackPercent: ns.hackAnalyze(target), hackFraction, growThreadsNeeded: ns.growthAnalyze(target, 1 / (1 - hackFraction)),
        hackSecurity: ns.hackAnalyzeSecurity(1), growSecurity: ns.growthAnalyzeSecurity(1), weakenPower: ns.weakenAnalyze(1),
      })
      const delays = landingDelays(times, gapMs), ram = batchRam(threads)
      // Only launch at the floor: a raised security would stretch this batch's timing.
      if (s.security <= s.minSecurity + 0.1 && inFlightRam(inFlight, now) + ram <= budgetFor(ns, target, ramBudget)) {
        const jobs = [
          ["hack", threads.hack, { target, ms: delays.hack }], ["weaken", threads.hackWeaken, { target, ms: delays.hackWeaken }],
          ["grow", threads.grow, { target, ms: delays.grow }], ["weaken", threads.growWeaken, { target, ms: delays.growWeaken }],
        ]
        if (launch(ns, jobs, id++, ram, port)) { stats.batches++; inFlight.push({ endsAt: now + times.weakenMs + 3 * gapMs, ram }) }
      }
      report("stacking", { threads, ram, weakenMs: times.weakenMs, inFlightRam: inFlightRam(inFlight, now) })
      await ns.sleep(spacingMs)
    }
    stats.resets++
    await waitReporting(ns, Math.max(0, ...inFlight.map(b => b.endsAt - Date.now())) + 1000, report, "draining after drift")
    inFlight = []
    drain()
  }
}
