import test from "node:test"
import assert from "node:assert/strict"
import { planPurchases } from "./aug_install_logic.js"

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
