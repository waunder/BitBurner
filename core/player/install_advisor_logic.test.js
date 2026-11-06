import { test } from "node:test"
import assert from "node:assert/strict"
import { augValue, bestRepRate, installAdvice, multFactorNeeded } from "./install_advisor_logic.js"

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
