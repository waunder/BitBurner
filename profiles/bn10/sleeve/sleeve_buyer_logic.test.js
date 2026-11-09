import test from "node:test"
import assert from "node:assert/strict"
import { chooseNextPurchase, chooseSleeveAug, chooseSleevePurchase, eligibility, memoryCost, payoff, smoothIncome } from "./sleeve_buyer_logic.js"

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

test("sleeve augmentations: shock 0 only, cheapest first, within the cash share", () => {
  const sleeves = [
    { index: 0, shock: 0, augs: [{ name: "B", cost: 3e9 }, { name: "A", cost: 1e9 }] },
    { index: 1, shock: 5, augs: [{ name: "C", cost: 1e6 }] },
  ]
  assert.deepEqual([chooseSleeveAug({ sleeves, spendable: 1e12 })].map((p) => [p.sleeve, p.name]), [[0, "A"]])
  assert.equal(chooseSleeveAug({ sleeves, spendable: 1e10 }), null)
})

test("purchase order: Covenant sleeve, then augmentation, then memory", () => {
  const aug = { kind: "aug", name: "A" }
  assert.equal(chooseNextPurchase({ covenant: { kind: "sleeve" }, aug }).kind, "sleeve")
  assert.equal(chooseNextPurchase({ covenant: { kind: "memory" }, aug }).kind, "aug")
  assert.equal(chooseNextPurchase({ covenant: { kind: "memory" } }).kind, "memory")
  assert.equal(chooseNextPurchase({}).kind, "save")
})

test("sleeve augmentations wait while karma is needed, unless the sleeve's exp is fresh", () => {
  const sleeves = [
    { index: 0, shock: 0, exp: 13000, augs: [{ name: "A", cost: 1e9 }] },
    { index: 1, shock: 0, exp: 200, augs: [{ name: "B", cost: 2e9 }] },
  ]
  assert.deepEqual([chooseSleeveAug({ sleeves, spendable: 1e12, karmaNeeded: true })].map((p) => [p.sleeve, p.name]), [[1, "B"]])
  assert.equal(chooseSleeveAug({ sleeves: sleeves.slice(0, 1), spendable: 1e12, karmaNeeded: true }), null)
  assert.deepEqual([chooseSleeveAug({ sleeves, spendable: 1e12 })].map((p) => [p.sleeve, p.name]), [[0, "A"]])
})
