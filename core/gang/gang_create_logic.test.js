import test from "node:test"
import assert from "node:assert/strict"
import { gangCreateStep } from "./gang_create_logic.js"

const base = { inGang: false, controllerRunning: false, karma: -54_000, bitNode: 10, factions: ["The Black Hand"] }

test("waits until karma reaches -54k outside BN2", () => {
  assert.equal(gangCreateStep({ ...base, karma: -53_999 }).action, "wait")
  assert.equal(gangCreateStep({ ...base, karma: undefined }).action, "wait")
  assert.equal(gangCreateStep(base).action, "create")
})

test("BN2 needs no karma", () => {
  assert.equal(gangCreateStep({ ...base, karma: 0, bitNode: 2 }).action, "create")
})

test("waits for faction membership", () => {
  assert.equal(gangCreateStep({ ...base, factions: ["NiteSec"] }).action, "wait")
  assert.equal(gangCreateStep({ ...base, factions: ["NiteSec"], faction: "NiteSec" }).action, "create")
})

test("existing gang starts the controller once, then finishes", () => {
  assert.equal(gangCreateStep({ ...base, inGang: true }).action, "start-controller")
  assert.equal(gangCreateStep({ ...base, inGang: true, controllerRunning: true }).action, "done")
})
