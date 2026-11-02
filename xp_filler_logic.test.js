import test from "node:test"
import assert from "node:assert/strict"
import { bestXpTarget, fillerThreads } from "./xp_filler_logic.js"

test("fillerThreads leaves the reserve free", () => {
  assert.equal(fillerThreads(32768, 0), Math.floor(32768 * 0.7 / 1.75))
  assert.equal(fillerThreads(1024, 0), 0)
  assert.equal(fillerThreads(32768, 30000), 0)
})

test("bestXpTarget ranks XP per weaken time", () => {
  assert.equal(bestXpTarget([{ host: "slow", exp: 30, weakenMs: 300 }, { host: "fast", exp: 15, weakenMs: 100 }]), "fast")
  assert.equal(bestXpTarget([{ host: "bad", exp: 0, weakenMs: 1 }]), null)
})
