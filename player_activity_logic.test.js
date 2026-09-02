import test from "node:test"
import assert from "node:assert/strict"
import { actionKey, choosePlayerActivity, shouldSwitch } from "./player_activity_logic.js"

const player = { skills: { hacking: 400, strength: 1, defense: 1, dexterity: 1, agility: 1 } }

test("physical baseline selects the weakest combat stat before other work", () => {
  const result = choosePlayerActivity({ player, nextGate: { host: "catalyst", required: 401 }, config: { enabled: true, physicalTarget: 30 } })
  assert.equal(result.action, "gym")
  assert.equal(result.stat, "strength")
  assert.equal(result.target, 30)
})

test("manual override makes no player action change", () => {
  assert.equal(choosePlayerActivity({ player, config: { override: "manual" } }).action, "hold")
})

test("after physical baseline, a visible hacking gate selects Algorithms", () => {
  const ready = { skills: { hacking: 400, strength: 30, defense: 30, dexterity: 30, agility: 30 } }
  const result = choosePlayerActivity({ player: ready, nextGate: { host: "catalyst", required: 401 }, config: { physicalTarget: 30 } })
  assert.equal(result.action, "algorithms")
  assert.match(result.reason, /catalyst/)
})

test("faction work is selected only from a cash-ready observed reputation gap", () => {
  const ready = { skills: { hacking: 500, strength: 30, defense: 30, dexterity: 30, agility: 30 } }
  const result = choosePlayerActivity({ player: ready, augmentation: { ok: true, candidate: { faction: "NiteSec", name: "Cranial", repGap: 500, cashReady: true } }, config: { physicalTarget: 30 } })
  assert.equal(result.action, "faction")
})

test("hysteresis prevents repeat activity changes", () => {
  const desired = { action: "gym", gym: "Powerhouse Gym", stat: "strength", target: 30 }
  assert.equal(shouldSwitch({ now: 20_000, previous: { actionKey: actionKey(desired), lastSwitchAt: 1 }, desired }).switch, false)
  assert.equal(shouldSwitch({ now: 20_000, previous: { actionKey: "algorithms:Rothman University:Algorithms", lastSwitchAt: 15_000 }, desired, cooldownMs: 10_000 }).switch, false)
  assert.equal(shouldSwitch({ now: 30_000, previous: { actionKey: "hold", lastSwitchAt: 1 }, desired, cooldownMs: 10_000 }).switch, true)
})

test("a failed activity launch is retried rather than recorded as active", () => {
  const desired = { action: "gym", gym: "Powerhouse Gym", stat: "strength", target: 30 }
  assert.equal(shouldSwitch({ now: 20_000, previous: { actionKey: actionKey(desired), lastSwitchAt: null }, desired }).switch, true)
})
