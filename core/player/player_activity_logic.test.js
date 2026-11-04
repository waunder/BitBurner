import test from "node:test"
import assert from "node:assert/strict"
import { actionKey, choosePlayerActivity, pickCrime, shouldFocus, shouldSwitch } from "./player_activity_logic.js"

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

test("a listed charisma augmentation beats cheaper faction work once charismaTarget is passed", () => {
  const ready = { money: 1e12, factions: ["Bachman & Associates"], skills: { hacking: 700, charisma: 950 } }
  const augmentation = { ok: true, workCandidates: [
    { faction: "BitRunners", name: "Neural Wit Amplifier", repGap: 4000, cashReady: true, price: 5e7 },
    { faction: "Bachman & Associates", name: "SmartJaw", repGap: 375000, cashReady: true, price: 5e10 },
  ] }
  const config = { physicalTarget: 0, charismaTarget: 600, charismaAugs: ["SmartJaw"], companyTarget: { company: "Bachman & Associates" } }
  assert.equal(choosePlayerActivity({ player: ready, augmentation, config }).faction, "Bachman & Associates")
})

test("a priority augmentation takes faction work ahead of charisma augmentations", () => {
  const ready = { money: 4e8, factions: ["Bachman & Associates"], skills: { hacking: 100, charisma: 100 } }
  const augmentation = { ok: true, workCandidates: [
    { faction: "Bachman & Associates", name: "SmartJaw", repGap: 375000, cashReady: false, price: 1.5e10 },
    { faction: "Tian Di Hui", name: "Neuroreceptor Management Implant", repGap: 72000, cashReady: false, price: 1.65e9 },
  ] }
  const config = { physicalTarget: 0, charismaAugs: ["SmartJaw"], priorityAugs: ["Neuroreceptor Management Implant"] }
  const result = choosePlayerActivity({ player: ready, augmentation, config })
  assert.equal(result.faction, "Tian Di Hui")
  assert.match(result.reason, /priority/)
})

test("no faction work for an augmentation another faction already sells", () => {
  const ready = { money: 1e12, factions: ["BitRunners", "NiteSec", "Tian Di Hui"], skills: { hacking: 1000, charisma: 3000 } }
  const augmentation = { ok: true, workCandidates: [
    { faction: "BitRunners", name: "DataJack", repGap: 16000, cashReady: true, price: 2.5e9 },
    { faction: "NiteSec", name: "DataJack", repGap: 0, cashReady: true, price: 2.5e9 },
    { faction: "BitRunners", name: "BitRunners Neurolink", repGap: 780000, cashReady: true, price: 2.5e10 },
  ] }
  const result = choosePlayerActivity({ player: ready, augmentation, config: { physicalTarget: 0 } })
  assert.equal(result.augmentation, "BitRunners Neurolink")
})

test("crime is picked by money rate when cash is short and karma rate otherwise", () => {
  const rows = [
    { crime: "Shoplift", chance: 0.5, time: 2000, karma: 0.01, money: 15000 },
    { crime: "Homicide", chance: 0.02, time: 3000, karma: 3, money: 45000 },
  ]
  assert.equal(pickCrime(rows, true).crime, "Shoplift")
  assert.equal(pickCrime(rows, false).crime, "Homicide")
})

test("works for the target company until its faction has joined", () => {
  const config = { companyTarget: { company: "Bachman & Associates", field: "Business" }, minTrainingCash: 1e7, physicalTarget: 0 }
  const crimeCandidate = { action: "crime", crime: "Shoplift" }
  const decide = (factions, money = 1e9) => choosePlayerActivity({ player: { factions, money, skills: {} }, crimeCandidate, config })
  assert.equal(decide([]).action, "company")
  assert.equal(actionKey(decide([])), "company:Bachman & Associates")
  assert.notEqual(decide(["Bachman & Associates"]).action, "company")
  assert.notEqual(decide([], 100).action, "company")
})

test("focuses rep work hourly only while it is the selected activity", () => {
  const base = { config: { focusWork: true }, action: "company", selected: true, focused: false, now: 4e6, lastFocusAt: 0 }
  assert.equal(shouldFocus(base), true)
  assert.equal(shouldFocus({ ...base, lastFocusAt: 3e6 }), false)
  assert.equal(shouldFocus({ ...base, focused: true }), false)
  assert.equal(shouldFocus({ ...base, action: "crime" }), false)
  assert.equal(shouldFocus({ ...base, selected: false }), false)
  assert.equal(shouldFocus({ ...base, config: {} }), false)
})

const covenantBase = {
  bitNode: 10,
  player: { money: 60e9, factions: [], skills: { hacking: 900, strength: 500, defense: 700, dexterity: 800, agility: 850 } },
  augmentation: { ok: true, installedCount: 18, queuedCount: 3 },
  config: { covenantTarget: true, physicalTarget: 0, minTrainingCash: 0 },
}

test("covenantTarget trains the weakest combat stat to 850 once augs and cash are close", () => {
  const result = choosePlayerActivity(covenantBase)
  assert.equal(result.action, "gym")
  assert.equal(result.stat, "strength")
  assert.equal(result.target, 850)
})

test("covenantTarget is off by default and outside BN10", () => {
  assert.notEqual(choosePlayerActivity({ ...covenantBase, config: { ...covenantBase.config, covenantTarget: false } }).action, "gym")
  assert.notEqual(choosePlayerActivity({ ...covenantBase, bitNode: 15 }).action, "gym")
})

test("covenantTarget waits for augmentations and cash", () => {
  assert.notEqual(choosePlayerActivity({ ...covenantBase, augmentation: { ok: true, installedCount: 10, queuedCount: 2 } }).action, "gym")
  assert.notEqual(choosePlayerActivity({ ...covenantBase, player: { ...covenantBase.player, money: 1e9 } }).action, "gym")
})

test("covenantTarget falls through to hacking, then stops once the faction is joined", () => {
  const trained = { ...covenantBase.player, skills: { hacking: 700, strength: 850, defense: 850, dexterity: 850, agility: 850 } }
  assert.equal(choosePlayerActivity({ ...covenantBase, player: trained }).action, "algorithms")
  const joined = { ...covenantBase.player, factions: ["The Covenant"] }
  assert.notEqual(choosePlayerActivity({ ...covenantBase, player: joined }).action, "gym")
})
