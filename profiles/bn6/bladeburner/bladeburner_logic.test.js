import test from "node:test"
import assert from "node:assert/strict"
import { chooseAction, plannedChance, shouldSwitch, planSkillBuys } from "./bladeburner_logic.js"

const act = (type, name, chance, timeMs, repGain, count = 100) => ({ type, name, chance, timeMs, repGain, count })
const base = {
  rank: 0, stamina: [75, 75], cityChaos: 1, nextBlackOp: { name: "Operation Typhoon", rank: 2500 },
  actions: [
    act("Contracts", "Tracking", [0.98, 1], 11000, 1.04),
    act("Contracts", "Bounty Hunter", [0.44, 1], 21000, 3.12),
    act("Operations", "Investigation", [0.2, 0.86], 33000, 7.6),
    act("Black Operations", "Operation Typhoon", [0.04, 0.07], 241000, 173, 1),
  ],
}

test("planned chance uses low end while wide, midpoint once narrow", () => {
  assert.equal(plannedChance([0.4, 1]), 0.4)
  assert.ok(Math.abs(plannedChance([0.9, 0.94]) - 0.92) < 1e-9)
})

test("wide but clearly promising estimate triggers Field Analysis", () => {
  const s = { ...base, actions: [act("Contracts", "Tracking", [0.98, 1], 11000, 1.04), act("Contracts", "Bounty Hunter", [0.44, 1], 21000, 5)] }
  assert.equal(chooseAction(s).name, "Field Analysis")
})

test("live 2026-11-16 numbers: Investigation's wide range is worth analysing", () => {
  assert.equal(chooseAction(base).name, "Field Analysis")
})

test("an action blocked from analysis does not trigger it", () => {
  assert.notEqual(chooseAction({ ...base, analysisBlocked: ["Investigation"] }).name, "Field Analysis")
})

test("a marginal gain from narrowing is not worth Field Analysis", () => {
  const s = { ...base, actions: [act("Contracts", "Tracking", [0.98, 1], 11000, 1.04), act("Contracts", "Bounty Hunter", [0.44, 1], 21000, 3.12)] }
  assert.equal(chooseAction(s).name, "Tracking")
})

test("narrow estimates pick best rank per second", () => {
  const s = { ...base, actions: [act("Contracts", "Tracking", [0.98, 1], 11000, 1.04), act("Contracts", "Bounty Hunter", [0.9, 0.92], 21000, 3.12)] }
  assert.equal(chooseAction(s).name, "Bounty Hunter")
})

test("low stamina rests, and keeps resting until resume threshold", () => {
  assert.equal(chooseAction({ ...base, stamina: [30, 75] }).name, "Hyperbolic Regeneration Chamber")
  assert.equal(chooseAction({ ...base, stamina: [60, 75], resting: true }).resting, true)
  assert.notEqual(chooseAction({ ...base, stamina: [74, 75], resting: true }).name, "Hyperbolic Regeneration Chamber")
})

test("high chaos means Diplomacy", () => {
  assert.equal(chooseAction({ ...base, cityChaos: 80 }).name, "Diplomacy")
})

test("black op attempted only when rank and chance both clear", () => {
  const bo = act("Black Operations", "Operation Typhoon", [0.95, 0.97], 241000, 173, 1)
  assert.equal(chooseAction({ ...base, rank: 3000, actions: [...base.actions.slice(0, 3), bo] }).type, "Black Operations")
  assert.notEqual(chooseAction({ ...base, rank: 1000, actions: [...base.actions.slice(0, 3), bo] }).type, "Black Operations")
})

test("Operation Daedalus is never started automatically", () => {
  const d = act("Black Operations", "Operation Daedalus", [1, 1], 1000, 1000, 1)
  const s = { ...base, rank: 1e6, nextBlackOp: { name: "Operation Daedalus", rank: 400000 }, actions: [...base.actions.slice(0, 3), d] }
  assert.notEqual(chooseAction(s).name, "Operation Daedalus")
  assert.equal(chooseAction(s, { allowDaedalus: true }).name, "Operation Daedalus")
})

test("nothing eligible falls back to Training", () => {
  const s = { ...base, actions: [act("Contracts", "Tracking", [0.3, 0.4], 11000, 1)] }
  assert.equal(chooseAction(s).name, "Training")
})

test("switching waits for a boundary on contracts", () => {
  const cur = { type: "Contracts", name: "Tracking" }
  const want = { type: "Contracts", name: "Bounty Hunter" }
  assert.equal(shouldSwitch({ current: cur, desired: want, elapsedMs: 5000, boundary: false }), false)
  assert.equal(shouldSwitch({ current: cur, desired: want, elapsedMs: 5000, boundary: true }), true)
  assert.equal(shouldSwitch({ current: null, desired: want }), true)
  assert.equal(shouldSwitch({ current: { type: "General", name: "Training" }, desired: want, elapsedMs: 9000 }), true)
  assert.equal(shouldSwitch({ current: want, desired: want, boundary: true }), false)
})

test("skill buys follow weight per point within budget", () => {
  const skills = { "Blade's Intuition": { level: 0, cost: 3 }, Tracer: { level: 0, cost: 2 }, Hyperdrive: { level: 0, cost: 1 } }
  assert.deepEqual(planSkillBuys(skills, 5), ["Blade's Intuition", "Tracer"])
  assert.deepEqual(planSkillBuys(skills, 0), [])
})
