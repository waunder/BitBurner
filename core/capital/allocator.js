/**
 * Shadow allocator (docs/allocator-design.md, R1). Every minute it values every purchase the spenders
 * made and every purchase they are about to make on one scale (valuation_logic.js), and logs the
 * verdict beside what was actually done. It buys nothing and no spender reads its output yet: every
 * purchase kind still runs on its own script's rule.
 *
 * Reads:  capital_status.json, sleeve_buyer_status.json, gang_status.json, mcp_status.json,
 *         augmentation_readiness.json (offers, advice), capital_policy.json (settings and its
 *         `valuation` block), valuation_flags.json (reported only), cash, money counters.
 * Writes: spend_grants.json (overwritten each pass: phase, projected batch, free cash, per-kind
 *         grants, pending verdicts, sweep plan), allocator_shadow_log.txt (one JSON line per purchase
 *         and per unexplained spend; last 2000 lines kept).
 * Start:  run allocator.js (bn10 profile startup; capital_manager.js restarts it). Replaces a prior copy.
 * @param {NS} ns
 */
import {
  batchContext, flagsFor, grantsFor, newPurchases, requestFor, settings, sweepPlan, unattributed, valuePurchase,
} from "./valuation_logic.js"
import { equipmentCategory } from "./gang_logic.js"
import { trimLog } from "./metrics_logic.js"

const STATUS = "spend_grants.json"
const LOG = "allocator_shadow_log.txt"
const PASS_MS = 60_000
const KEEP = 2000
const FRESH_MS = 10 * 60_000

function readJson(ns, file) {
  try { return JSON.parse(ns.read(file) || "null") } catch { return null }
}

function fresh(status, now) {
  return status && Number(status.ts) > now - FRESH_MS ? status : null
}

/** MCP's share of cloud RAM (as capital_manager.js measures it, without stacks), total cloud RAM, MCP rate. */
function cloudUse(mcp) {
  const workers = Array.isArray(mcp?.cloudWorkers) ? mcp.cloudWorkers : []
  const total = workers.reduce((sum, w) => sum + (Number(w.maxRam) || 0), 0)
  const threads = workers.flatMap((w) => w.actions || []).reduce((sum, a) => sum + (Number(a.threads) || 0), 0)
  return { totalCloudRam: total, utilization: total > 0 ? threads * 1.75 / total : 0, mcpRate: Number(mcp?.rate) || 0 }
}

function pass(ns, state) {
  const now = Date.now()
  const reset = ns.getResetInfo()
  const cash = ns.getServerMoneyAvailable("home")
  const policy = readJson(ns, "capital_policy.json") || {}
  const s = settings(policy)
  const capital = readJson(ns, "capital_status.json")
  const sleeve = readJson(ns, "sleeve_buyer_status.json")
  const gang = readJson(ns, "gang_status.json")
  const readiness = fresh(readJson(ns, "augmentation_readiness.json"), now)
  const flags = flagsFor(ns.read("valuation_flags.json"), reset.lastNodeReset)
  const hoursSinceInstall = (now - reset.lastAugReset) / 3.6e6

  // Cash rate as readiness measures it (gang-controller's observedCashRate), else capital_manager's average.
  const gangFresh = fresh(gang, now)
  const gangRate = Number(gangFresh?.capital?.observedCashRate)
  const cashPerHour = Number.isFinite(gangRate) && gangRate > 0 ? gangRate * 3600 : Math.max(0, Number(capital?.incomePerSec) || 0) * 3600
  const gangRepPerHour = Math.max(0, Number(gangFresh?.observedFactionRepRate) || 0) * 3600
  const ctx = batchContext({ cash, cashPerHour, hoursSinceInstall, readiness, gangRepPerHour, s })

  const candidate = gang?.capital?.candidate
  const env = {
    homeRam: ns.getServerMaxRam("home"), homeDemand: Number(capital?.homeDemand),
    ...cloudUse(fresh(readJson(ns, "mcp_status.json"), now)), hours: ctx.hours ?? 0,
    gangCategory: equipmentCategory,
    gangPayback: (item) => (candidate && candidate.item === item ? candidate.paybackSeconds : null),
  }

  // Purchases since the last pass, each with the verdict the valuation gives it now.
  const { records, seen } = newPurchases({ capital, sleeve, gang }, state.seen)
  state.seen = seen
  const lines = []
  const valued = records.map((r) => {
    const req = requestFor(r.source, r, env, s)
    return { r, req, v: valuePurchase(req, ctx, s) }
  })
  for (const { r, req, v } of valued) {
    lines.push({ ts: r.ts, logged: now, source: r.source, kind: req.kind, item: r.item, cost: r.cost, flag: flags[req.kind] ?? "own",
      phase: ctx.phase, verdict: v.verdict, class: v.class, costV: v.costV, gainV: v.gainV, cashReturn: req.cashReturn,
      freeCash: ctx.freeCash, reserve: ctx.reserve, reason: v.reason })
  }
  // Spending the money counters show but no record explains (a missed gang update, a manual buy).
  const counters = ns.getMoneySources().sinceInstall
  if (state.counters) {
    const extra = unattributed(state.counters, counters, valued.map(({ r, req }) => ({ kind: req.kind, cost: r.cost })))
    for (const [counter, amount] of Object.entries(extra)) {
      lines.push({ ts: now, logged: now, source: "counter", kind: counter, item: null, cost: amount, flag: null, phase: ctx.phase,
        verdict: "unattributed", reason: `${counter} spending no script recorded this pass`, freeCash: ctx.freeCash, reserve: ctx.reserve })
    }
  }
  state.counters = { servers: counters.servers, sleeves: counters.sleeves, gang_expenses: counters.gang_expenses, other: counters.other }

  // What each spender is about to buy, and the verdict it would get.
  const pendingIn = []
  if (capital?.action && ["tor", "program", "home", "cloud", "upgrade"].includes(capital.action.kind)) pendingIn.push(["capital", capital.action])
  if (sleeve?.action && ["aug", "memory", "sleeve"].includes(sleeve.action.kind)) pendingIn.push(["sleeve", sleeve.action])
  const next = gang?.equipment?.nextItem
  if (next?.item) pendingIn.push(["gang", { item: next.item, cost: next.cost }])
  const pending = pendingIn.map(([source, action]) => {
    const req = requestFor(source, action, env, s)
    const v = valuePurchase(req, ctx, s)
    return { source, kind: req.kind, item: action.item ?? action.name ?? action.host ?? action.kind, cost: req.cost,
      cashReturn: req.cashReturn, verdict: v.verdict, class: v.class, costV: v.costV, gainV: v.gainV, reason: v.reason }
  })
  const lasting = pending.filter((p) => p.verdict === "sweep").map((p) => ({ ...p, valueV: 0 }))
  const sweep = sweepPlan(lasting, ctx.batch ? ctx.freeCash : 0)

  if (lines.length) {
    ns.write(LOG, lines.map((l) => JSON.stringify(l)).join("\n") + "\n", "a")
    const trimmed = trimLog(ns.read(LOG), KEEP, 200)
    if (trimmed !== null) ns.write(LOG, trimmed, "w")
  }
  state.logged += lines.length
  ns.write(STATUS, JSON.stringify({
    ts: now, ok: true, mode: "shadow", ttlSec: s.ttlSec, run: reset.lastNodeReset, resetAt: reset.lastAugReset, flags,
    phase: ctx.phase, hoursSinceInstall, cash, cashPerHour, expectedInstallHours: ctx.hours, projectedCash: ctx.projected,
    batch: ctx.batch, reserve: ctx.reserve, freeCash: ctx.freeCash, marginalAug: ctx.marginal, reason: ctx.reason,
    readinessAgeMs: readiness ? now - readiness.ts : null, env: { homeRam: env.homeRam, homeDemand: env.homeDemand, utilization: env.utilization, totalCloudRam: env.totalCloudRam, mcpRate: env.mcpRate },
    grants: grantsFor(ctx, env, s), pending, refused: pending.filter((p) => p.verdict !== "grant"),
    sweepPlan: sweep.plan, seen: state.seen, counters: state.counters, loggedThisPass: lines.length, loggedSinceStart: state.logged,
  }, null, 2), "w")
}

export async function main(ns) {
  ns.disableLog("ALL")
  for (const proc of ns.ps("home")) {
    if (proc.pid !== ns.pid && proc.filename.replace(/^\//, "") === "allocator.js") ns.kill(proc.pid)
  }
  // Resume where the last copy stopped, so a restart neither repeats nor (within 50 records) skips
  // purchases. A first start logs nothing from before it.
  const prior = readJson(ns, STATUS)
  const start = Date.now()
  const state = {
    seen: prior?.seen && typeof prior.seen === "object" ? prior.seen : { capital: start, sleeve: start, gang: start },
    counters: null, logged: 0,
  }
  while (true) {
    try {
      pass(ns, state)
    } catch (error) {
      ns.write(STATUS, JSON.stringify({ ts: Date.now(), ok: false, mode: "shadow", error: String(error?.message || error), seen: state.seen }, null, 2), "w")
    }
    await ns.sleep(PASS_MS)
  }
}
