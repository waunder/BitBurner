import test from "node:test"
import assert from "node:assert/strict"
import { countFillers, donationFor, donationPlan, fluxSeller, ladderCost, nextHomeUpgrade, planPurchases, selectByValue } from "./aug_install_logic.js"

const offer = (name, price, extra = {}) => ({ name, faction: "F", rep: 10, repRequired: 5, price, prerequisites: [], ...extra })

test("buys the dearest first and skips what rep does not allow", () => {
  const { plan } = planPurchases([offer("a", 1), offer("b", 5), offer("c", 9, { repRequired: 50 })], [], 100)
  assert.deepEqual(plan.map((item) => item.name), ["b", "a"])
})

test("a prerequisite comes before the augmentation needing it", () => {
  const { plan } = planPurchases([offer("gen2", 9, { prerequisites: ["gen1"] }), offer("gen1", 1)], [], 100)
  assert.deepEqual(plan.map((item) => item.name), ["gen1", "gen2"])
})

test("prices compound and an unaffordable item is passed over", () => {
  const { plan, left } = planPurchases([offer("a", 10), offer("b", 8)], [], 12)
  assert.deepEqual(plan.map((item) => item.name), ["a"])
  assert.equal(left, 2)
})

test("a priority augmentation keeps its cash even when dearer ones would use it all", () => {
  const offers = [offer("a", 10), offer("b", 8), offer("p", 3)]
  assert.deepEqual(planPurchases(offers, [], 15).plan.map((item) => item.name), ["a"])
  assert.deepEqual(planPurchases(offers, [], 15, 1.9, ["p"]).plan.map((item) => item.name), ["b", "p"])
})

test("leftover cash takes the cheaper home upgrade and stops when neither is affordable", () => {
  assert.deepEqual(nextHomeUpgrade(10, 4, 5), { kind: "cores", cost: 4 })
  assert.deepEqual(nextHomeUpgrade(4, 10, 5), { kind: "ram", cost: 4 })
  assert.equal(nextHomeUpgrade(10, 20, 5), null)
})

test("donations lift a donating faction to its dearest offer within the cash share", () => {
  const offers = [offer("a", 1, { faction: "D", rep: 100, repRequired: 900 }), offer("b", 1, { faction: "D", rep: 100, repRequired: 500 }),
    offer("c", 1, { faction: "N", rep: 0, repRequired: 900 }), offer("owned", 1, { faction: "D", rep: 100, repRequired: 5000 })]
  assert.deepEqual(donationPlan(offers, ["owned"], 1e10, 2, ["D"]), [{ faction: "D", amount: donationFor(800, 2), rep: 900 }])
  assert.deepEqual(donationPlan(offers, ["owned"], 1e9, 2, ["D"]), [])
  assert.equal(donationFor(800, 2), 400400000)
})

test("a donation is skipped when the cash left cannot buy anything it unlocks (BN10 prices)", () => {
  const offers = [offer("dear", 5e9, { faction: "D", rep: 0, repRequired: 100 })]
  // The whole $1b would cover the gift, but the augmentation then costs $5b: nothing would be bought.
  assert.deepEqual(donationPlan(offers, [], 1e9, 1, ["D"], 1), [])
  assert.equal(donationPlan(offers, [], 1e10, 1, ["D"]).length, 1)
})

test("the cheapest unlocked offer decides, so a dear one beside an affordable one still gets its gift", () => {
  const offers = [offer("cheap", 1e8, { faction: "D", rep: 0, repRequired: 100 }), offer("dear", 5e9, { faction: "D", rep: 0, repRequired: 200 })]
  assert.equal(donationPlan(offers, [], 1e9, 1e6, ["D"]).length, 1)
})

test("a donation is not sized by an augmentation another faction already sells rep-ready", () => {
  const offers = [
    { name: "Shared", faction: "A", rep: 0, repRequired: 1e6, price: 1, prerequisites: [] },
    { name: "Shared", faction: "B", rep: 2e6, repRequired: 1e6, price: 1, prerequisites: [] },
    { name: "Own", faction: "A", rep: 0, repRequired: 1e3, price: 1, prerequisites: [] },
  ]
  assert.deepEqual(donationPlan(offers, [], 1e20, 1, ["A"]).map((gift) => gift.rep), [1e3])
})

test("an augmentation sold by two donating factions is donated for where the gap is smaller", () => {
  const offers = [
    { name: "Shared", faction: "A", rep: 0, repRequired: 1e6, price: 1, prerequisites: [] },
    { name: "Shared", faction: "B", rep: 9e5, repRequired: 1e6, price: 1, prerequisites: [] },
  ]
  const plan = donationPlan(offers, [], 1e20, 1, ["A", "B"])
  assert.deepEqual(plan.map((gift) => [gift.faction, gift.rep]), [["B", 1e6]])
})

test("NeuroFlux is bought from a donating faction first, then the one with most rep", () => {
  const sellers = [{ faction: "A", rep: 5 }, { faction: "B", rep: 9 }, { faction: "C", rep: 1 }]
  assert.equal(fluxSeller(sellers, ["C"]), "C")
  assert.equal(fluxSeller(sellers, []), "B")
  assert.equal(fluxSeller([], []), null)
})

test("only: buys nothing outside the priority list, so no filler raises later prices", () => {
  const offers = [offer("filler", 9), offer("want", 5), offer("also", 1)]
  assert.deepEqual(planPurchases(offers, [], 100, 1.9, ["want", "also"], { only: true }).plan.map((item) => item.name), ["want", "also"])
  assert.deepEqual(planPurchases(offers, [], 100, 1.9, [], { only: true }).plan.map((item) => item.name), ["filler", "want", "also"])
  assert.deepEqual(planPurchases(offers, [], 100, 1.9, ["want"]).plan.map((item) => item.name), ["filler", "want", "also"])
})

test("ladderCost buys dearest first with the price step", () => {
  assert.equal(ladderCost([1, 10], 2), 10 + 1 * 2)
  assert.equal(ladderCost([], 1.9), 0)
})

test("byValue picks the cheap valuable set over the dearest low-value one (2026-11-17 batch)", () => {
  const offers = [
    offer("ADR-V2", 2.75, { value: 0.091 }), offer("SmartSonar", 0.375, { value: 0.052 }),
    offer("Bionic Spine", 0.625, { value: 0.224 }), offer("Neurotrainer II", 0.225, { value: 0.098 }),
    offer("NutriGen", 0.0125, { value: 0.073 }), offer("Speech Processor", 0.25, { value: 0 }),
  ]
  assert.deepEqual(planPurchases(offers, [], 3.48).plan.map((o) => o.name), ["ADR-V2", "SmartSonar"])
  const { plan, left } = planPurchases(offers, [], 3.48, 1.9, [], { byValue: true })
  assert.deepEqual(plan.map((o) => o.name), ["Bionic Spine", "SmartSonar", "Neurotrainer II", "NutriGen"])
  assert.ok(!plan.some((o) => o.name === "Speech Processor"), "value 0 is never added")
  assert.ok(left >= 0)
  const value = plan.reduce((sum, o) => sum + o.value, 0)
  assert.ok(value > 0.143, `value ${value}`)
})

test("selectByValue keeps priority names and adds a missing prerequisite with its dependant", () => {
  const pool = [offer("p", 5, { value: 0 }), offer("gen2", 2, { value: 0.5, prerequisites: ["gen1"] }), offer("gen1", 1, { value: 0 })]
  const keep = selectByValue(pool, [], 100, 1.9, ["p"])
  assert.deepEqual([...keep].sort(), ["gen1", "gen2", "p"])
  assert.deepEqual([...selectByValue(pool, [], 5, 1.9, ["p"])], ["p"])
  assert.deepEqual(planPurchases(pool, [], 100, 1.9, [], { byValue: true }).plan.map((o) => o.name), ["gen1", "gen2"])
})

test("count fillers add the cheapest rep-ready augs until the Daedalus count, within the cash share", () => {
  const offer = (name, price, extra = {}) => ({ name, faction: "F", rep: 10, repRequired: 5, price, prerequisites: [], ...extra })
  const offers = [offer("Plan", 100), offer("A", 10), offer("B", 20), offer("C", 30), offer("Locked", 1, { rep: 0 }),
    offer("NeuroFlux Governor", 1), offer("Needs", 2, { prerequisites: ["Missing"] })]
  // owned 2 + plan 1 = 3; target 5 needs two fillers: A and B (cheapest), skipping locked, NeuroFlux and prereq-blocked.
  assert.deepEqual(countFillers(offers, ["X", "Y"], ["Plan"], 1e6, 5), ["A", "B"])
  // Already at the target: nothing added.
  assert.deepEqual(countFillers(offers, ["X", "Y", "Z", "W"], ["Plan"], 1e6, 5), [])
  // Cash share: ladder Plan 100 + A 10x1.9 = 119 fits 10% of 1200; adding B (100 + 20x1.9 + 10x3.61 = 174.1) does not.
  assert.deepEqual(countFillers(offers, [], ["Plan"], 1200, 10), ["A"])
})
