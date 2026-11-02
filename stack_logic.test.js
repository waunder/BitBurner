import test from "node:test"
import assert from "node:assert/strict"
import { batchRam, batchThreads, inFlightRam, isHealthy, isPrepared, landingDelays } from "./stack_logic.js"

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
