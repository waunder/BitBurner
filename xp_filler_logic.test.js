import test from "node:test"
import assert from "node:assert/strict"
import { bestXpTarget, fillableCloud, fillerThreads } from "./xp_filler_logic.js"

test("fillerThreads leaves the margin free", () => {
  assert.equal(fillerThreads(32768, 0), Math.floor(32768 * 0.95 / 1.75))
  assert.equal(fillerThreads(32768, 32000), 0)
  assert.equal(fillerThreads(16, 0, 0), 9)
})

test("fillableCloud keeps the largest servers clear", () => {
  assert.deepEqual(fillableCloud([{ host: "a", max: 8 }, { host: "b", max: 32 }, { host: "c", max: 16 }], 1), ["c", "a"])
})

test("bestXpTarget ranks XP per weaken time", () => {
  assert.equal(bestXpTarget([{ host: "slow", exp: 30, weakenMs: 300 }, { host: "fast", exp: 15, weakenMs: 100 }]), "fast")
  assert.equal(bestXpTarget([{ host: "bad", exp: 0, weakenMs: 1 }]), null)
})
