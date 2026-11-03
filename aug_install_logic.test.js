import test from "node:test"
import assert from "node:assert/strict"
import { nextHomeUpgrade, planPurchases } from "./aug_install_logic.js"

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
