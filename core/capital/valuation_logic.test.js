import test from "node:test"
import assert from "node:assert/strict"
import {
  DEFAULTS, KINDS, batchContext, batchValue, cloudReturn, costInV, expectedInstallHours, flagFor, flagsFor,
  forecastOffers, grantFor, grantsFor, kindOf, newPurchases, paybackReturn, projectedCash, requestFor, settings, sweepPlan,
  unattributed, valuePurchase,
} from "./valuation_logic.js"

const offer = (name, price, value, extra = {}) => ({ name, faction: "NiteSec", rep: 1e7, repRequired: 1e6, price, prerequisites: [], value, ...extra })
// A cash-limited batch like install 7's: dearest first, each later one x1.9.
const OFFERS = [offer("A", 400e9, 0.10), offer("B", 300e9, 0.08), offer("C", 250e9, 0.06), offer("D", 200e9, 0.05), offer("E", 100e9, 0.03)]
const READINESS = { offers: OFFERS, owned: [], priority: [], gangFaction: "NiteSec", advice: { verdict: "wait", next: { hours: 1 } } }
const LATE = 3 // hours since install

function lateCtx(cash, cashPerHour = 0) {
  return batchContext({ cash, cashPerHour, hoursSinceInstall: LATE, readiness: READINESS, s: DEFAULTS })
}

test("flags: missing, unreadable, wrong run, unknown values and sweep on wiped kinds all mean own", () => {
  assert.equal(flagFor(null, "home_ram", 5), "own")
  assert.equal(flagFor("not json", "home_ram", 5), "own")
  assert.equal(flagFor(JSON.stringify({ kinds: { home_ram: "valued" } }), "home_ram", 5), "own") // no stamp
  assert.equal(flagFor(JSON.stringify({ run: 4, kinds: { home_ram: "valued" } }), "home_ram", 5), "own")
  const text = JSON.stringify({ run: 5, kinds: { home_ram: "valued", cloud_ram: "sweep", sleeve_memory: "sweep", gang_gear: "maybe", tor: "never" } })
  assert.equal(flagFor(text, "home_ram", 5), "valued")
  assert.equal(flagFor(text, "cloud_ram", 5), "own")
  assert.equal(flagFor(text, "sleeve_memory", 5), "sweep")
  assert.equal(flagFor(text, "gang_gear", 5), "own")
  assert.equal(flagFor(text, "tor", 5), "never")
  assert.equal(flagFor(text, "programs", 5), "own")
  assert.deepEqual(Object.keys(flagsFor(null)), KINDS)
})

test("settings take capital_policy's shared keys, then its valuation block", () => {
  const s = settings({ earlyCycleHours: 2, homeDemandFloor: 0.4, cloudDemandFloor: 0, lateCloudDemandFloor: 0.5, valuation: { costMargin: 0.2 } })
  assert.equal(s.earlyCycleHours, 2)
  assert.equal(s.homeDemandFloor, 0.4)
  assert.equal(s.cloudDemandFloor, 0.5)
  assert.equal(s.costMargin, 0.2)
  assert.equal(settings({}).earlyCycleHours, 1.5)
})

test("expected install: gang minimum, the advisor's wait, the 12h cap; none without a batch", () => {
  assert.equal(expectedInstallHours({ advice: { verdict: "wait", next: { hours: 0.5 } }, cycleHours: 2, gang: true }), 2)
  assert.equal(expectedInstallHours({ advice: { verdict: "wait", next: { hours: 5 } }, cycleHours: 2, gang: true }), 5)
  assert.equal(expectedInstallHours({ advice: { verdict: "wait", next: { hours: 20 } }, cycleHours: 2, gang: true }), 10)
  assert.equal(expectedInstallHours({ advice: { verdict: "install" }, cycleHours: 5, gang: true }), 0)
  assert.equal(expectedInstallHours({ advice: { verdict: "build" }, cycleHours: 5 }), null)
  assert.equal(expectedInstallHours({ advice: null, cycleHours: 5 }), null)
})

test("projected cash counts income at 75%", () => {
  assert.equal(projectedCash({ cash: 1e12, cashPerHour: 1e12, hours: 2 }), 2.5e12)
})

test("forecast lifts only the gang faction's rep", () => {
  const out = forecastOffers([offer("G", 1, 1, { rep: 0 }), offer("H", 1, 1, { faction: "CyberSec", rep: 0 })], { gangFaction: "NiteSec", gangRepPerHour: 1e6, hours: 2 })
  assert.equal(out[0].rep, 2e6)
  assert.equal(out[1].rep, 0)
})

test("batch value follows the 1.9 step; cost in v is lumpy", () => {
  // 400 + 300x1.9 = 970b buys A and B; C would need 250 x 3.61 = 902.5b more.
  const b = batchValue(OFFERS, [], 1000e9)
  assert.deepEqual(b.plan.map((o) => o.name), ["A", "B"])
  assert.ok(Math.abs(b.value - 0.18) < 1e-9)
  assert.equal(costInV(OFFERS, [], 1000e9, 20e9), 0) // out of the 30b leftover
  // $50b more drops B (0.08); planPurchases then fits C (0.06) instead: the batch loses 0.02.
  assert.ok(Math.abs(costInV(OFFERS, [], 1000e9, 50e9) - 0.02) < 1e-9)
})

test("The Red Pill counts although augValue scores it 0", () => {
  const offers = [offer("The Red Pill", 0, 0)]
  assert.ok(batchValue(offers, [], 1e9).value >= 1000)
})

test("early phase: no reserve, rebuild purchases granted", () => {
  const ctx = batchContext({ cash: 1e12, hoursSinceInstall: 0.5, readiness: READINESS })
  assert.equal(ctx.phase, "early")
  assert.equal(ctx.reserve, 0)
  const v = valuePurchase({ kind: "cloud_ram", cost: 500e9 }, ctx)
  assert.equal(v.verdict, "grant")
})

test("incident replay, cycle 7: a late cloud upgrade while MCP fills 0.2% is refused", () => {
  const ctx = lateCtx(1000e9)
  const back = cloudReturn({ addedRam: 2 ** 20, totalRam: 4 * 2 ** 20, utilization: 0.002, mcpRatePerSec: 400e6, hours: ctx.hours })
  assert.equal(back, 0)
  const v = valuePurchase({ kind: "cloud_ram", cost: 271e9, cashReturn: back }, ctx)
  assert.equal(v.verdict, "refuse")
  assert.equal(v.class, "wiped")
  assert.ok(v.costV > 0)
})

test("incident replay, 2026-11-10 14:53: a home step nothing would use is refused in any phase", () => {
  const req = { kind: "home_ram", cost: 4.74e12, homeRam: 65536, homeDemand: 0.0023 }
  assert.equal(valuePurchase(req, lateCtx(5e12)).verdict, "refuse")
  assert.equal(valuePurchase(req, batchContext({ cash: 5e12, hoursSinceInstall: 0.2, readiness: READINESS })).verdict, "refuse")
})

test("incident replay, Covenant join: late sleeve memory that would cost the batch goes to the sweep", () => {
  const v = valuePurchase({ kind: "sleeve_memory", cost: 900e9 }, lateCtx(1000e9))
  assert.equal(v.verdict, "sweep")
  assert.ok(v.costV > 0)
})

test("necessities are granted late with a batch reserve; home RAM in demand is a necessity", () => {
  const ctx = lateCtx(1000e9)
  assert.equal(valuePurchase({ kind: "tor", cost: 200e3 }, ctx).verdict, "grant")
  assert.equal(valuePurchase({ kind: "programs", cost: 250e6 }, ctx).verdict, "grant")
  assert.equal(valuePurchase({ kind: "home_ram", cost: 5e9, homeRam: 64, homeDemand: 0.1 }, ctx).verdict, "grant") // below the floor
  assert.equal(valuePurchase({ kind: "home_ram", cost: 5e9, homeRam: 4096, homeDemand: 0.8 }, ctx).verdict, "grant")
})

test("a purchase out of free cash costs nothing and is granted", () => {
  const ctx = lateCtx(1000e9)
  assert.ok(ctx.freeCash > 0 && ctx.freeCash < 100e9)
  assert.equal(valuePurchase({ kind: "sleeve_augs", cost: 10e9 }, ctx).verdict, "grant")
})

test("a purchase that returns more before the install than the batch loses is granted", () => {
  const ctx = lateCtx(1000e9)
  const back = paybackReturn({ cost: 100e9, paybackSeconds: 600, hours: ctx.hours }) // pays back 6x per hour
  const v = valuePurchase({ kind: "gang_gear", cost: 100e9, cashReturn: back }, ctx)
  assert.equal(v.verdict, "grant")
  assert.ok(v.gainV >= v.costV && v.costV > 0)
})

test("no batch expected (advisor build) means no reserve", () => {
  const ctx = batchContext({ cash: 1000e9, hoursSinceInstall: LATE, readiness: { ...READINESS, advice: { verdict: "build" } } })
  assert.equal(ctx.reserve, 0)
  assert.equal(valuePurchase({ kind: "cloud_ram", cost: 900e9 }, ctx).verdict, "grant")
})

test("missing offers mean no reserve, not a refusal", () => {
  const ctx = batchContext({ cash: 1000e9, hoursSinceInstall: LATE, readiness: { advice: { verdict: "wait" } } })
  assert.equal(ctx.batch, null)
  assert.equal(valuePurchase({ kind: "sleeve_memory", cost: 900e9 }, ctx).verdict, "grant")
})

test("batch kinds are not judged mid-cycle", () => {
  assert.equal(valuePurchase({ kind: "neuroflux", cost: 1 }, lateCtx(1e12)).verdict, "n/a")
})

test("the marginal aug is the next one the batch cannot afford, at its stepped price", () => {
  const ctx = lateCtx(1000e9)
  assert.equal(ctx.marginal.name, "C")
  assert.ok(Math.abs(ctx.marginal.steppedPrice - 250e9 * 1.9 ** 2) < 1)
})

test("sweep plan buys lasting requests by value, never wiped ones", () => {
  const { plan, left } = sweepPlan([
    { kind: "sleeve_memory", cost: 50, valueV: 0.1 }, { kind: "cloud_ram", cost: 10, valueV: 9 },
    { kind: "home_ram", cost: 40, valueV: 0.2 }, { kind: "gang_gear", cost: 30, valueV: 0 },
  ], 100)
  assert.deepEqual(plan.map((r) => r.kind), ["home_ram", "sleeve_memory"])
  assert.equal(left, 10)
})

test("grantFor: stale, previous-cycle or missing grants fall back; over-grant refused", () => {
  const now = 1_000_000_000
  const grants = { ts: now - 60_000, ttlSec: 300, grants: { home_ram: { max: 100, reason: "free cash" } } }
  assert.deepEqual(grantFor(grants, "home_ram", 50, now), { ok: true, fallback: false, reason: "free cash" })
  assert.equal(grantFor(grants, "home_ram", 150, now).ok, false)
  assert.equal(grantFor(grants, "home_ram", 150, now).fallback, false)
  assert.equal(grantFor(grants, "cloud_ram", 1, now).fallback, true)
  assert.equal(grantFor({ ...grants, ts: now - 10 * 60_000 }, "home_ram", 1, now).fallback, true)
  assert.equal(grantFor(grants, "home_ram", 1, now, now - 30_000).fallback, true)
  assert.equal(grantFor(null, "home_ram", 1, now).fallback, true)
})

test("kinds of the spenders' records", () => {
  assert.equal(kindOf("capital", { kind: "upgrade" }), "cloud_ram")
  assert.equal(kindOf("capital", { kind: "home" }), "home_ram")
  assert.equal(kindOf("capital", { kind: "program" }), "programs")
  assert.equal(kindOf("sleeve", { kind: "memory" }), "sleeve_memory")
  assert.equal(kindOf("sleeve", { kind: "sleeve" }), "covenant_sleeve")
  assert.equal(kindOf("gang", {}, "augmentation"), "gang_augs")
  assert.equal(kindOf("gang", {}, "rootkit"), "gang_gear")
})

test("new purchases since the last pass, from each spender, once", () => {
  const capital = { purchases: [{ ts: 10, ok: true, kind: "home", cost: 5 }, { ts: 20, ok: false, kind: "cloud", ram: 8, cost: 1 }, { ts: 30, ok: true, kind: "upgrade", host: "w-1", fromRam: 8, toRam: 16, cost: 2 }] }
  const sleeve = { purchases: [{ ts: 15, kind: "memory", sleeve: 1, points: 2, cost: 7, outcome: { ok: true } }] }
  const gang = { ts: 40, equipment: { boughtItems: [{ item: "NUKE Rootkit", member: "m", cost: 3 }] } }
  const first = newPurchases({ capital, sleeve, gang }, {})
  assert.deepEqual(first.records.map((r) => [r.source, r.ts]), [["capital", 10], ["sleeve", 15], ["capital", 30], ["gang", 40]])
  assert.deepEqual(first.seen, { capital: 30, sleeve: 15, gang: 40 })
  assert.equal(newPurchases({ capital, sleeve, gang }, first.seen).records.length, 0)
})

test("requests: cloud upgrades add the RAM step; gang gear returns cash by payback", () => {
  const env = { homeRam: 65536, homeDemand: 0.9, utilization: 0.8, totalCloudRam: 64, mcpRate: 1e6, hours: 2,
    gangCategory: (n) => (n === "Neuralstimulator" ? "augmentation" : "rootkit"), gangPayback: () => 600 }
  const up = requestFor("capital", { kind: "upgrade", fromRam: 8, toRam: 16, cost: 10 }, env)
  assert.equal(up.kind, "cloud_ram")
  assert.equal(up.cashReturn, 1e6 * 3600 * 2 * (8 / 64))
  const gear = requestFor("gang", { item: "NUKE Rootkit", cost: 100 }, env)
  assert.equal(gear.kind, "gang_gear")
  assert.equal(gear.cashReturn, 100 * 7200 / 600)
  assert.equal(requestFor("gang", { item: "Neuralstimulator", cost: 1 }, env).kind, "gang_augs")
  assert.equal(requestFor("capital", { kind: "home", cost: 1 }, env).homeDemand, 0.9)
})

test("grants: free cash late, whole cash early, nothing for home RAM nobody needs", () => {
  const late = grantsFor(lateCtx(1000e9), { homeRam: 65536, homeDemand: 0.002 })
  assert.equal(late.home_ram.max, 0)
  assert.ok(late.cloud_ram.max > 0 && late.cloud_ram.max < 100e9)
  assert.ok(late.tor.max >= 1e9)
  assert.equal(late.neuroflux, undefined)
  const early = grantsFor(batchContext({ cash: 5e9, hoursSinceInstall: 0.1, readiness: READINESS }), { homeRam: 65536, homeDemand: 0.9 })
  assert.equal(early.cloud_ram.max, 5e9)
  assert.equal(early.home_ram.max, 5e9)
})

test("unattributed spending: counter deltas no record explains; an install reset counts from zero", () => {
  const before = { servers: -100, sleeves: -50, gang_expenses: -10, other: 0 }
  const after = { servers: -2_000_100, sleeves: -50, gang_expenses: -3_000_010, other: 0 }
  const records = [{ kind: "home_ram", cost: 2_000_000 }, { kind: "gang_gear", cost: 1_000_000 }]
  assert.deepEqual(unattributed(before, after, records), { gang_expenses: 2_000_000 })
  assert.deepEqual(unattributed({ servers: -9e9 }, { servers: -5e6 }, []), { servers: 5e6 })
})
