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
