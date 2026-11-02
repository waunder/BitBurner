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

test("charisma gate trains Leadership ahead of the hacking gate", () => {
  const player = { skills: { hacking: 100, charisma: 282 } }
  const config = { physicalTarget: 0, charismaTarget: 300 }
  const below = choosePlayerActivity({ player, nextGate: { host: "x", required: 355 }, config })
  assert.equal(below.course, "Leadership")
  assert.equal(actionKey(below), "leadership:ZB Institute of Technology:Leadership")
  const met = choosePlayerActivity({ player: { skills: { hacking: 100, charisma: 300 } }, nextGate: { host: "x", required: 355 }, config })
  assert.equal(met.course, "Algorithms")
})

test("charisma below target picks Leadership ahead of a hacking gate", () => {
  const result = choosePlayerActivity({ player: { skills: { hacking: 300, charisma: 282 } }, nextGate: { host: "I.I.I.I", required: 355 }, config: { physicalTarget: 0, charismaTarget: 600 } })
  assert.equal(result.action, "leadership")
  assert.equal(result.city, "Volhaven")
  assert.equal(actionKey(result), "leadership:ZB Institute of Technology:Leadership")
})

test("charisma at target, or no target, falls through to the hacking gate", () => {
  const gate = { host: "I.I.I.I", required: 355 }
  assert.equal(choosePlayerActivity({ player: { skills: { hacking: 300, charisma: 600 } }, nextGate: gate, config: { physicalTarget: 0, charismaTarget: 600 } }).action, "algorithms")
  assert.equal(choosePlayerActivity({ player: { skills: { hacking: 300, charisma: 1 } }, nextGate: gate, config: { physicalTarget: 0 } }).action, "algorithms")
})

test("repBeforeGates works for faction rep ahead of a hack gate", () => {
  const augmentation = { ok: true, workCandidates: [{ name: "BitWire", faction: "NiteSec", repGap: 100, price: 1, cashReady: true }] }
  const args = { player: { money: 10, skills: { hacking: 300, charisma: 600 } }, nextGate: { host: "x", required: 355 }, augmentation }
  assert.equal(choosePlayerActivity({ ...args, config: { physicalTarget: 0, repBeforeGates: true } }).action, "faction")
  assert.equal(choosePlayerActivity({ ...args, config: { physicalTarget: 0 } }).action, "algorithms")
  assert.equal(choosePlayerActivity({ ...args, augmentation: { ok: true, workCandidates: [] }, config: { physicalTarget: 0, repBeforeGates: true } }).action, "algorithms")
})

test("too little cash for tuition picks crime ahead of Leadership", () => {
  const crimeCandidate = { action: "crime", crime: "Shoplift", chance: 1 }
  const player = { money: 1600, karma: 0, skills: { charisma: 54, hacking: 1 } }
  const config = { override: "auto", physicalTarget: 0, charismaTarget: 600 }
  assert.equal(choosePlayerActivity({ player, nextGate: null, augmentation: null, crimeCandidate, config }).action, "crime")
  const funded = { ...player, money: 2e7 }
  assert.equal(choosePlayerActivity({ player: funded, nextGate: null, augmentation: null, crimeCandidate, config }).action, "leadership")
})

test("a listed charisma augmentation takes faction work ahead of Leadership, others do not", () => {
  const ready = { money: 1e8, skills: { hacking: 200, charisma: 150 } }
  const augmentation = { ok: true, workCandidates: [{ faction: "Tian Di Hui", name: "Speech Processor Implant", repGap: 500, cashReady: true, price: 1e6 }] }
  const config = { physicalTarget: 0, charismaTarget: 600, charismaAugs: ["Speech Processor Implant"] }
  assert.equal(choosePlayerActivity({ player: ready, augmentation, config }).faction, "Tian Di Hui")
  assert.equal(choosePlayerActivity({ player: ready, augmentation, config: { ...config, charismaAugs: [] } }).action, "leadership")
})
