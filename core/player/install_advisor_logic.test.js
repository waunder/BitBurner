import { test } from "node:test"
import assert from "node:assert/strict"
import { augValue, bestRepRate, installAdvice, multFactorNeeded, withDonations } from "./install_advisor_logic.js"
import { donationFor, planPurchases } from "./aug_install_logic.js"

test("value is weighted log gain, so stacked augmentations add", () => {
  const a = augValue({ hacking: 1.1 }, { hacking: 1 })
  assert.ok(Math.abs(a - Math.log(1.1)) < 1e-12)
  assert.ok(Math.abs(augValue({ hacking: 1.1, faction_rep: 1.1 }, { hacking: 1, faction_rep: 0.5 }) - 1.5 * a) < 1e-12)
  assert.equal(augValue({ charisma: 2 }, { hacking: 1 }), 0)
})

test("best rep rate is the fastest faction rise; resets and missing samples give null", () => {
  assert.equal(bestRepRate({ A: 100, B: 0 }, { A: 400, B: 50 }, 0.5), 600)
  assert.equal(bestRepRate({ A: 900 }, { A: 10 }, 1), null)
  assert.equal(bestRepRate(null, { A: 1 }, 1), null)
})

const batch = [{ name: "B1", value: 0.2 }]

test("wait while the next augmentation beats the cycle's average", () => {
  // Cycle average 0.2 / 8h = 0.025/h; next is 0.1 in 1h.
  const advice = installAdvice({ batch, candidates: [{ name: "X", repGap: 30000, value: 0.1 }], cycleHours: 8, repPerHour: 30000 })
  assert.equal(advice.verdict, "wait")
  assert.equal(advice.next.name, "X")
  assert.match(advice.reason, /^wait 1\.0h for X/)
})

test("install once the next augmentation is slower than the average", () => {
  // Next is 0.1 in 10h = 0.01/h, under 0.025/h.
  const advice = installAdvice({ batch, candidates: [{ name: "X", repGap: 300000, value: 0.1 }], cycleHours: 8, repPerHour: 30000 })
  assert.equal(advice.verdict, "install")
})

test("the best rate wins, not the smallest gap", () => {
  const advice = installAdvice({
    batch, cycleHours: 8, repPerHour: 10000,
    candidates: [{ name: "small", repGap: 1000, value: 0.001 }, { name: "big", repGap: 20000, value: 0.2 }],
  })
  assert.equal(advice.next.name, "big")
})

test("empty batch builds; no rate is unknown", () => {
  assert.equal(installAdvice({ batch: [], candidates: [], cycleHours: 1, repPerHour: 1 }).verdict, "build")
  assert.equal(installAdvice({ batch, candidates: [], cycleHours: 1, repPerHour: null }).verdict, "unknown")
  assert.equal(installAdvice({ batch, candidates: [], cycleHours: 1, repPerHour: 5 }).verdict, "install")
})

test("multiplier needed for a level within one cycle", () => {
  // Hacking 398 at 1.6e9 exp (live 2026-11-05): mult about 0.83. A cycle of 24h at 1e8 exp/h reaches 2.4e9.
  const f = multFactorNeeded({ level: 398, exp: 1.6e9, target: 850, expPerHour: 1e8, cycleHours: 24 })
  assert.ok(f > 2 && f < 2.3, String(f))
  assert.equal(multFactorNeeded({ level: 900, exp: 1.6e9, target: 850, expPerHour: 1e8 }), 1)
  assert.equal(multFactorNeeded({ level: 0, exp: 0, target: 850, expPerHour: 1 }), null)
})

// Live 2026-11-06 22:04 Pacific (readiness): The Syndicate favor 152 after install 11, rep 208k,
// NEMEAN Subdermal Weave needs 1.75m, cash $379t; the advisor said "build" and the player ground rep.
const nemean = { name: "NEMEAN Subdermal Weave", faction: "The Syndicate", rep: 207952, repRequired: 1.75e6, repGap: 1542048, price: 1.625e10, prerequisites: [], canWorkForRep: true }
const nitesec = { name: "Neural Thing", faction: "NiteSec", rep: 72649, repRequired: 100000, repGap: 27351, price: 1e9, prerequisites: [], canWorkForRep: true }

test("a donating faction's augmentation reads as rep-ready, with the donation that buys it", () => {
  const { candidates, gifts, left } = withDonations([nemean, nitesec], { money: 3.79e14, repMult: 2, donating: ["The Syndicate"] })
  const [n, other] = candidates
  assert.equal(n.donatable, true)
  assert.equal(n.repGap, 0)
  assert.equal(n.rep, 1.75e6)
  assert.equal(n.donation, donationFor(1542048, 2))
  assert.deepEqual(gifts.map((gift) => gift.faction), ["The Syndicate"])
  assert.equal(left, 3.79e14 - n.donation)
  assert.equal(other, nitesec, "a faction below favor 150 is untouched")
  assert.equal(nemean.repGap, 1542048, "inputs are not mutated")
})

test("a donating faction cash cannot yet cover stays donatable with its gap", () => {
  // $1t at 25% share is $250b; the 1.54m gap needs about $771b at rep mult 2.
  const { candidates, gifts, left } = withDonations([nemean], { money: 1e12, repMult: 2, donating: ["The Syndicate"] })
  assert.equal(gifts.length, 0)
  assert.equal(left, 1e12)
  assert.equal(candidates[0].donatable, true)
  assert.equal(candidates[0].repGap, 1542048)
})

test("no donating factions or no rep mult leaves candidates as they are", () => {
  assert.deepEqual(withDonations([nemean], { money: 3.79e14, repMult: 2, donating: [] }).candidates, [nemean])
  assert.deepEqual(withDonations([nemean], { money: 3.79e14, repMult: 0, donating: ["The Syndicate"] }).candidates[0].repGap, 1542048)
})

test("the advisor never waits on rep that cash buys", () => {
  const advice = installAdvice({
    batch, cycleHours: 8, repPerHour: 30000,
    candidates: [{ name: "Donated", repGap: 30000, value: 1, donatable: true }, { name: "Worked", repGap: 300000, value: 0.1 }],
  })
  assert.equal(advice.next.name, "Worked")
  assert.equal(advice.verdict, "install")
  assert.deepEqual(advice.cashLimited, ["Donated"])
  const only = installAdvice({ batch: [], cycleHours: 1, repPerHour: 1, candidates: [{ name: "Donated", repGap: 5, value: 1, donatable: true }] })
  assert.equal(only.next, null)
})

test("live case: with Syndicate favor 152, NEMEAN joins the install batch instead of 2.2h of work", () => {
  const { candidates, left } = withDonations([nemean], { money: 3.79e14, repMult: 2, donating: ["The Syndicate"] })
  const { plan } = planPurchases(candidates, [], left)
  assert.deepEqual(plan.map((item) => item.name), ["NEMEAN Subdermal Weave"])
  const value = 0.7884573603642703
  const advice = installAdvice({ batch: plan.map((item) => ({ name: item.name, value })), candidates: [], cycleHours: 0.81, repPerHour: 711589 })
  assert.equal(advice.verdict, "install")
  // Before the fix: the same inputs without donations built toward it by work.
  const before = installAdvice({ batch: [], candidates: [{ name: nemean.name, repGap: nemean.repGap, value }], cycleHours: 0.81, repPerHour: 711589 })
  assert.equal(before.verdict, "build")
})

import { factionRepRates, gangAdvice, gangRepPerHour } from "./install_advisor_logic.js"

test("hacking_money/grow/chance/speed count in augValue by default", () => {
  assert.ok(augValue({ hacking_money: 2 }) > 0)
  assert.ok(augValue({ hacking_chance: 1.3, hacking_speed: 1.3, hacking_grow: 1.3 }) > 0)
})

test("gang rate is rep/s x 3600; per-faction rates keep only risers", () => {
  assert.equal(gangRepPerHour({ observedFactionRepRate: 10 }), 36000)
  assert.equal(gangRepPerHour({ observedFactionRepRate: null }), null)
  assert.deepEqual(factionRepRates({ A: 0, B: 5 }, { A: 100, B: 5 }, 2), { A: 50 })
})

const gangItems = [{ name: "G1", repGap: 200000, price: 1e9, value: 0.1 }]

test("gang: minimum cycle forces wait before 4h", () => {
  const a = installAdvice({ batch, candidates: [], cycleHours: 2, repPerHour: 1000, gang: { rate: null, candidates: [] } })
  assert.equal(a.verdict, "wait")
  assert.match(a.reason, /minimum/)
})


test("gang: waits for a reachable, affordable gang aug; money-only note without cash rate", () => {
  const a = installAdvice({ batch, candidates: [], cycleHours: 5, repPerHour: 1000, money: 5e9, gang: { rate: 100000, candidates: gangItems } })
  assert.equal(a.verdict, "wait")
  assert.match(a.reason, /gang aug G1.*money only/)
})

test("gang: beyond the 12h cap or unaffordable at its batch position is no reason to wait", () => {
  const far = [{ name: "G1", repGap: 900000, price: 1e9, value: 0.1 }]
  assert.notEqual(installAdvice({ batch, candidates: [], cycleHours: 5, repPerHour: 1000, money: 5e9, gang: { rate: 100000, candidates: far } }).reason.startsWith("wait"), true)
  // 1e9 x 1.9 = 1.9e9 > 1e9 cash with one batch item; arrives affordable with cash income.
  const poor = installAdvice({ batch, candidates: [], cycleHours: 5, repPerHour: 1000, money: 1e9, gang: { rate: 100000, candidates: gangItems } })
  assert.equal(poor.verdict, "install")
  const rich = installAdvice({ batch, candidates: [], cycleHours: 5, repPerHour: 1000, money: 1e9, cashPerHour: 1e9, gang: { rate: 100000, candidates: gangItems } })
  assert.equal(rich.verdict, "wait")
})

test("gangAdvice without a gang has no opinion; own-faction rate times a candidate", () => {
  assert.equal(gangAdvice({ gang: null, cycleHours: 1 }), null)
  const a = installAdvice({ batch, cycleHours: 8, repPerHour: 1000, candidates: [{ name: "X", repGap: 30000, value: 0.1, repPerHour: 30000 }] })
  assert.equal(a.verdict, "wait")
  assert.match(a.reason, /^wait 1\.0h/)
})

test("planPurchases batch stop skips dear low-value offers, default unchanged", () => {
  const offers = [
    { name: "A", faction: "F", rep: 1, repRequired: 0, price: 100, prerequisites: [], value: 0 },
    { name: "B", faction: "F", rep: 1, repRequired: 0, price: 10, prerequisites: [], value: 0 },
  ]
  assert.deepEqual(planPurchases(offers, [], 1e6).plan.map((o) => o.name), ["A", "B"])
  // Both exceed 5 and are worthless, so both are skipped.
  assert.deepEqual(planPurchases(offers, [], 1e6, 1.9, [], { maxStepPrice: 5, minValue: 0.01 }).plan.map((o) => o.name), [])
  assert.deepEqual(planPurchases(offers, [], 1e6, 1.9, [], { maxStepPrice: 50, minValue: 0.01 }).plan.map((o) => o.name), ["B"])
})

import { batchMark, favorGate, floorState } from "./install_advisor_logic.js"

const HOUR = 3_600_000
const settled = { cycleHours: 1.1, now: 1.1 * HOUR, mark: { since: 0.2 * HOUR }, gangRep: 2e6, gangRepNeeded: 1.785e6 }

test("settling: creep adds up against one mark, a fall is not growth, a new cycle starts again", () => {
  const first = batchMark({ batchValue: 1, now: 10, reset: 1 })
  assert.equal(batchMark({ batchValue: 1.015, now: 20, reset: 1, previous: first }), first)
  assert.equal(batchMark({ batchValue: 0.8, now: 20, reset: 1, previous: first }), first)
  assert.equal(batchMark({ batchValue: 1.021, now: 30, reset: 1, previous: first }).since, 30)
  assert.equal(batchMark({ batchValue: 0.5, now: 40, reset: 2, previous: first }).since, 40)
})

test("the floor lapses only when every condition holds", () => {
  assert.equal(floorState(settled).lapsed, true)
  assert.equal(floorState({ ...settled, cycleHours: 0.9 }).lapsed, false)
  assert.equal(floorState({ ...settled, mark: { since: 1.0 * HOUR } }).lapsed, false)
  assert.equal(floorState({ ...settled, gangRep: undefined }).lapsed, false)
  assert.equal(floorState({ ...settled, gate: { reason: "gate" } }).lapsed, false)
  assert.equal(floorState({ ...settled, endgame: true }).lapsed, false)
})

test("run 1 cycle 3: a young gang's flat batch does not lapse the floor", () => {
  const young = { cycleHours: 3.4, now: 3.4 * HOUR, mark: { since: 3.06 * HOUR }, gangRep: 11, gangRepNeeded: 1.785e6 }
  assert.equal(floorState(young).lapsed, false)
})

test("favor gate: join, favor, pill, then nothing", () => {
  const at = { faction: "Daedalus", threshold: 153 }
  assert.equal(favorGate({ ...at, joined: false, eligible: false }), null)
  assert.equal(favorGate({ ...at, joined: false, eligible: true }).kind, "join")
  // donations open but not yet a member: still wait to join, or the pill misses the batch
  assert.equal(favorGate({ ...at, joined: false, eligible: true, favor: 173 }).kind, "join")
  const short = favorGate({ ...at, joined: true, gain: 100, rate: 261000 })
  assert.equal(short.kind, "favor")
  assert.ok(Math.abs(short.hours - 25000 * (1.02 ** 153 - 1.02 ** 100) / 261000) < 1e-9)
  assert.equal(favorGate({ ...at, joined: true, gain: 154 }), null)
  assert.equal(favorGate({ ...at, joined: true, favor: 173 }).kind, "pill")
  assert.equal(favorGate({ ...at, joined: true, favor: 173, planned: ["The Red Pill"] }), null)
  assert.equal(favorGate({ ...at, joined: false, eligible: true, held: ["The Red Pill"] }), null)
})

test("gang: a lapsed floor installs before 4h, but not over a reachable gang aug", () => {
  const input = { batch, candidates: [], cycleHours: 1.1, repPerHour: 1000, floor: { lapsed: true } }
  assert.equal(installAdvice({ ...input, gang: { rate: null, candidates: [] } }).verdict, "install")
  const waiting = installAdvice({ ...input, money: 5e9, gang: { rate: 100000, candidates: gangItems } })
  assert.equal(waiting.verdict, "wait")
  assert.match(waiting.reason, /gang aug G1/)
})

test("gang: a favor gate in reach holds past 4h; out of reach or unmeasured it does not", () => {
  const input = { batch, candidates: [], cycleHours: 5, repPerHour: 1000, gang: { rate: null, candidates: [] } }
  assert.equal(installAdvice({ ...input, gate: { kind: "favor", hours: 1, reason: "favor" } }).verdict, "wait")
  assert.equal(installAdvice({ ...input, gate: { kind: "favor", hours: 8, reason: "favor" } }).verdict, "install")
  assert.equal(installAdvice({ ...input, gate: { kind: "favor", hours: null, reason: "favor" } }).verdict, "install")
})

test("The Red Pill alone installs from 1h, only with the flag and nothing else in reach", () => {
  const alone = { batch: [{ name: "The Red Pill", value: 0 }], candidates: [], cycleHours: 1.1, repPerHour: null, pillAlone: true }
  assert.equal(installAdvice(alone).verdict, "install") // no gang and no rep rate needed
  assert.equal(installAdvice({ ...alone, gang: { rate: null, candidates: [] } }).verdict, "install") // no 4h wait
  assert.equal(installAdvice({ ...alone, cycleHours: 0.5 }).verdict, "wait")
  assert.notEqual(installAdvice({ ...alone, pillAlone: false }).verdict, "install")
  assert.equal(installAdvice({ ...alone, batch: [{ name: "Filler", value: 0 }], repPerHour: 1000 }).verdict, "build")
  const near = { name: "X", repGap: 2000, value: 0.1 }, far = { name: "Y", repGap: 50000, value: 5 }
  const waits = installAdvice({ ...alone, repPerHour: 1000, candidates: [far, near] })
  assert.equal(waits.verdict, "wait")
  assert.equal(waits.next.name, "X")
  assert.equal(installAdvice({ ...alone, repPerHour: 1000, candidates: [far] }).verdict, "install")
  const gang = { rate: 100000, candidates: gangItems }
  assert.equal(installAdvice({ ...alone, cycleHours: 5, money: 5e9, gang }).verdict, "wait") // a gang aug in reach goes in with it
})
