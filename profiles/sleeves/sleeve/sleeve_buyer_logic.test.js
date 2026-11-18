import test from "node:test"
import assert from "node:assert/strict"
import { chooseNextPurchase, chooseSleeveAugBatch, chooseSleevePurchase, eligibility, memoryCost, payoff, sleeveAugHold, smoothIncome } from "./sleeve_buyer_logic.js"

test("sleeveAugHold is the cash for the cheapest acceptable batch, capped", () => {
  const augs = [{ name: "a", cost: 10e6 }, { name: "b", cost: 2e6 }, { name: "c", cost: 5e6 }, { name: "d", cost: 50e6 }]
  // Seasoned sleeve: three cheapest (2+5+10) at batchShare 0.5.
  assert.equal(sleeveAugHold({ sleeves: [{ index: 0, shock: 0, exp: 5000, augs }] }), 34e6)
  // Fresh sleeve: cheapest one is enough.
  assert.equal(sleeveAugHold({ sleeves: [{ index: 0, shock: 0, exp: 0, augs }] }), 4e6)
  // Shocked sleeves and empty offers ask nothing; a need over the cap holds nothing.
  assert.equal(sleeveAugHold({ sleeves: [{ index: 0, shock: 5, exp: 0, augs }, { index: 1, shock: 0, exp: 0, augs: [] }] }), 0)
  assert.equal(sleeveAugHold({ sleeves: [{ index: 0, shock: 0, exp: 5000, augs }], max: 20e6 }), 0)
  assert.equal(sleeveAugHold({ sleeves: [{ index: 0, shock: 0, exp: 5000, augs }], freshOnly: true }), 0)
})

test("memory cost follows the game formula", () => {
  assert.equal(memoryCost(1, 1), 1e12)
  assert.ok(Math.abs(memoryCost(1, 2) - 2.02e12) < 1)
  assert.equal(memoryCost(99, 2), Infinity)
  assert.equal(memoryCost(1, 0), Infinity)
})

test("eligibility explains why it cannot act", () => {
  assert.match(eligibility({ bitNode: 15, factions: ["The Covenant"] }), /not BitNode 10/)
  assert.match(eligibility({ bitNode: 10, factions: [] }), /Covenant/)
  assert.equal(eligibility({ bitNode: 10, factions: ["The Covenant"] }), null)
})

test("buys a sleeve when spendable covers the cost", () => {
  const pick = chooseSleevePurchase({ spendable: 11e12, sleeveCost: 10e12, income: 1e9 })
  assert.equal(pick.kind, "sleeve")
  assert.equal(pick.cost, 10e12)
  assert.ok(pick.paybackHours > 0)
})

test("saves for the first sleeve rather than buying memory", () => {
  const pick = chooseSleevePurchase({ spendable: 5e12, sleeveCost: 10e12, boughtCount: 0, sleeves: [{ index: 0, memory: 1 }] })
  assert.equal(pick.kind, "save")
})

test("after a sleeve, memory goes to the lowest-memory sleeve, largest affordable batch", () => {
  const sleeves = [{ index: 0, memory: 50 }, { index: 1, memory: 5 }]
  const pick = chooseSleevePurchase({ spendable: 3.5e12, sleeveCost: 100e12, boughtCount: 1, sleeves })
  assert.equal(pick.kind, "memory")
  assert.equal(pick.sleeve, 1)
  assert.ok(pick.points >= 1 && pick.points <= 3)
  assert.ok(pick.cost <= 3.5e12)
})

test("sleeve outranks memory when both are affordable", () => {
  const pick = chooseSleevePurchase({ spendable: 200e12, sleeveCost: 100e12, boughtCount: 1, sleeves: [{ index: 0, memory: 1 }] })
  assert.equal(pick.kind, "sleeve")
})

test("capped sleeves and capped memory wait cleanly", () => {
  assert.equal(chooseSleevePurchase({ spendable: 1e18, sleeveCost: Infinity, boughtCount: 5, sleeves: [{ index: 0, memory: 100 }] }).kind, "save")
})

test("payoff is zero-safe", () => {
  assert.equal(payoff({ kind: "sleeve", cost: 1e13, income: 0 }).paybackHours, null)
})

test("income smoothing ignores spending", () => {
  assert.equal(smoothIncome({ cash: 1100, lastCash: 1000, spent: 0, seconds: 10 }), 10)
  assert.equal(smoothIncome({ cash: 500, lastCash: 1000, spent: 500, seconds: 10 }), 0)
})

test("sleeve augmentation batch: shock 0 only, cheapest first, one sleeve, within the batch share", () => {
  const sleeves = [
    { index: 0, shock: 0, exp: 0, augs: [{ name: "B", cost: 3e9 }, { name: "A", cost: 1e9 }] },
    { index: 1, shock: 5, exp: 0, augs: [{ name: "C", cost: 1e6 }] },
  ]
  const all = chooseSleeveAugBatch({ sleeves, spendable: 1e12 })
  assert.deepEqual([all.sleeve, all.names, all.cost, all.complete], [0, ["A", "B"], 4e9, true])
  // Fresh sleeve: a partial batch is fine (the reset costs nothing).
  assert.deepEqual(chooseSleeveAugBatch({ sleeves, spendable: 2e9 }).names, ["A"])
  assert.equal(chooseSleeveAugBatch({ sleeves, spendable: 1e9 }), null)
  assert.equal(chooseSleeveAugBatch({ sleeves, spendable: 0 }), null)
})

test("sleeve augmentation batch: trained sleeves need a real batch; wanted filter; priority order", () => {
  const augs = [{ name: "a", cost: 1 }, { name: "b", cost: 2 }, { name: "c", cost: 3 }, { name: "d", cost: 4 }, { name: "hack", cost: 0.5 }]
  const sleeves = [
    { index: 0, shock: 0, exp: 5e5, priority: 0.5, augs },
    { index: 1, shock: 0, exp: 5e5, priority: 0.9, augs },
  ]
  const wanted = ["a", "b", "c", "d"]
  // Budget 2*share covers a+b only (2 < minAugs 3): a trained sleeve waits.
  assert.equal(chooseSleeveAugBatch({ sleeves, spendable: 6, wanted }), null)
  const pick = chooseSleeveAugBatch({ sleeves, spendable: 12, wanted })
  assert.deepEqual([pick.sleeve, pick.names], [1, ["a", "b", "c"]])
  // A fresh sleeve outranks priority.
  const fresh = chooseSleeveAugBatch({ sleeves: [...sleeves, { index: 2, shock: 0, exp: 10, priority: 0, augs }], spendable: 12, wanted })
  assert.equal(fresh.sleeve, 2)
  // Completing a short remaining set is allowed even below minAugs.
  assert.deepEqual(chooseSleeveAugBatch({ sleeves: [{ index: 0, shock: 0, exp: 5e5, augs: [{ name: "d", cost: 4 }] }], spendable: 8, wanted }).names, ["d"])
})

test("sleeve augmentation batch: freshOnly holds trained sleeves (karma crime)", () => {
  const sleeves = [
    { index: 0, shock: 0, exp: 13000, augs: [{ name: "A", cost: 1e9 }] },
    { index: 1, shock: 0, exp: 200, augs: [{ name: "B", cost: 2e9 }] },
  ]
  assert.equal(chooseSleeveAugBatch({ sleeves, spendable: 1e12, freshOnly: true }).sleeve, 1)
  assert.equal(chooseSleeveAugBatch({ sleeves: sleeves.slice(0, 1), spendable: 1e12, freshOnly: true }), null)
})

test("purchase order: Covenant sleeve, then augmentation, then memory", () => {
  const aug = { kind: "aug", name: "A" }
  assert.equal(chooseNextPurchase({ covenant: { kind: "sleeve" }, aug }).kind, "sleeve")
  assert.equal(chooseNextPurchase({ covenant: { kind: "memory" }, aug }).kind, "aug")
  assert.equal(chooseNextPurchase({ covenant: { kind: "memory" } }).kind, "memory")
  assert.equal(chooseNextPurchase({}).kind, "save")
})

