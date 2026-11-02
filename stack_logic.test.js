import test from "node:test"
import assert from "node:assert/strict"
import { batchRam, batchThreads, estimateStack, fitPrep, inFlightRam, isHealthy, isPrepared, landingDelays, planStacks } from "./stack_logic.js"

test("jobs land hack, weaken, grow, weaken in order", () => {
  const times = { hackMs: 25000, growMs: 80000, weakenMs: 100000 }, d = landingDelays(times, 200)
  const lands = [d.hack + times.hackMs, d.hackWeaken + times.weakenMs, d.grow + times.growMs, d.growWeaken + times.weakenMs]
  assert.deepEqual(lands, [99800, 100000, 100200, 100400])
})

test("batchThreads offsets the security it adds", () => {
  const t = batchThreads({ hackPercent: 0.001, growThreadsNeeded: 100, hackSecurity: 0.002, growSecurity: 0.004, weakenPower: 0.05, hackFraction: 0.1 })
  assert.deepEqual(t, { hack: 100, grow: 111, hackWeaken: 5, growWeaken: 10 })
  assert.equal(batchRam(t), 452)
})

test("health and prepared gates", () => {
  const good = { money: 100, maxMoney: 100, security: 10, minSecurity: 10 }
  assert.equal(isPrepared(good), true)
  assert.equal(isHealthy({ ...good, money: 40 }), false)
  assert.equal(isHealthy({ ...good, security: 16 }), false)
})

test("inFlightRam ignores finished batches", () => {
  assert.equal(inFlightRam([{ endsAt: 5, ram: 10 }, { endsAt: 20, ram: 4 }], 10), 4)
})

test("fitPrep scales threads down to one host", () => {
  assert.deepEqual(fitPrep(300, 100, 400), { grow: 150, weaken: 50 })
  assert.deepEqual(fitPrep(3, 1, 400), { grow: 3, weaken: 1 })
  assert.deepEqual(fitPrep(0, 0, 400), { grow: 0, weaken: 0 })
})

test("estimateStack prices one batch per spacing", () => {
  const e = estimateStack({ target: "t", maxMoney: 1000, hackPercent: 0.01, chance: 0.5, weakenMs: 10000, threads: { hack: 10, grow: 10, hackWeaken: 1, growWeaken: 1 } })
  assert.equal(e.ram, 44)
  assert.equal(e.perSec, 25)
  assert.equal(e.ramNeeded, 220)
})

const est = (target, perTB, perSec, ramNeeded) => ({ target, perTB, perSec, ramNeeded, ram: 1 })

test("planStacks starts the best yields that fit and skips the weak", () => {
  const plan = planStacks([est("a", 10, 100, 50), est("b", 8, 90, 60), est("small", 12, 5, 10), est("thin", 1, 100, 50)], [], 200)
  assert.deepEqual(plan.map(p => [p.target, p.ramBudget]), [["a", 50], ["b", 60]])
})

test("planStacks gives a small fleet one partial stack only", () => {
  assert.deepEqual(planStacks([est("a", 10, 100, 500), est("b", 9, 90, 500)], [], 100).map(p => [p.target, p.ramBudget]), [["a", 100]])
  assert.deepEqual(planStacks([est("a", 10, 100, 500)], [], 10), [])
})

test("planStacks grows a running stack before adding one and never drops it", () => {
  const plan = planStacks([est("a", 10, 100, 80), est("b", 9, 90, 50)], [{ target: "a", ramBudget: 40, port: 101 }], 130)
  assert.deepEqual(plan.map(p => [p.target, p.ramBudget]), [["a", 80], ["b", 50]])
  assert.equal(plan[0].port, 101)
  assert.deepEqual(planStacks([est("b", 9, 90, 50)], [{ target: "gone", ramBudget: 40 }], 10).map(p => p.target), ["gone"])
})

test("planStacks stops at the stack limit", () => {
  assert.equal(planStacks([est("a", 10, 100, 1), est("b", 9, 90, 1), est("c", 8, 80, 1)], [], 100, { maxStacks: 2, minBudgetBatches: 1 }).length, 2)
})
