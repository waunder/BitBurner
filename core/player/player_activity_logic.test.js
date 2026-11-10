import test from "node:test"
import assert from "node:assert/strict"
import { actionKey, choosePlayerActivity, covenantGymHours, expForLevel, pickCrime, shouldFocus, shouldSwitch } from "./player_activity_logic.js"

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

test("an augmentation sold by several factions is worked where its rep gap is smallest", () => {
  const ready = { money: 1e15, factions: ["The Syndicate", "Tian Di Hui"], skills: { hacking: 2000, charisma: 500 } }
  const augmentation = { ok: true, workCandidates: [
    { faction: "Tian Di Hui", name: "Shared", repGap: 900000, cashReady: true, price: 1e12, value: 0.2 },
    { faction: "The Syndicate", name: "Shared", repGap: 100000, cashReady: true, price: 1e12, value: 0.2 },
    { faction: "Tian Di Hui", name: "Other", repGap: 300000, cashReady: true, price: 1e12, value: 0.1 },
  ] }
  const result = choosePlayerActivity({ player: ready, augmentation, config: { physicalTarget: 0 } })
  assert.equal(result.faction, "The Syndicate")
  assert.equal(result.augmentation, "Shared")
  // But a faction whose climb reaches the shared name on the way to a second one is the better route.
  const both = choosePlayerActivity({ player: ready, config: { physicalTarget: 0 }, augmentation: { ok: true, workCandidates: [
    { faction: "The Syndicate", name: "Shared", repGap: 500000, cashReady: true, price: 1e12, value: 0.5 },
    { faction: "Tian Di Hui", name: "Shared", repGap: 550000, cashReady: true, price: 1e12, value: 0.5 },
    { faction: "Tian Di Hui", name: "Big", repGap: 600000, cashReady: true, price: 1e12, value: 0.2 },
  ] } })
  assert.equal(both.faction, "Tian Di Hui")
})

test("no faction work for an augmentation a donating faction also sells", () => {
  const ready = { money: 1e15, factions: ["The Syndicate", "Daedalus"], skills: { hacking: 2600, charisma: 500 } }
  const augmentation = { ok: true, workCandidates: [
    { faction: "The Syndicate", name: "Shared", repGap: 500000, cashReady: true, price: 1e12, value: 0.5, donatable: true },
    { faction: "Daedalus", name: "Shared", repGap: 100000, cashReady: true, price: 1e12, value: 0.5 },
    { faction: "Daedalus", name: "Other", repGap: 400000, cashReady: true, price: 1e12, value: 0.1 },
  ] }
  const result = choosePlayerActivity({ player: ready, augmentation, config: { physicalTarget: 0 } })
  assert.equal(result.augmentation, "Other")
})

test("with cash ready, faction work takes the smallest rep gap over the cheapest augmentation", () => {
  const ready = { money: 9.7e10, factions: ["NiteSec", "Tian Di Hui"], skills: { hacking: 257, charisma: 192 } }
  const augmentation = { ok: true, workCandidates: [
    { faction: "Tian Di Hui", name: "Nanofiber Weave", repGap: 66115, cashReady: true, price: 6.25e8 },
    { faction: "NiteSec", name: "Embedded Netburner Module", repGap: 28771, cashReady: true, price: 1.25e9 },
  ] }
  const result = choosePlayerActivity({ player: ready, augmentation, config: { physicalTarget: 0 } })
  assert.equal(result.augmentation, "Embedded Netburner Module")
})

test("valued candidates rank by value per rep, and zero-value ones are skipped", () => {
  const ready = { money: 5e11, factions: ["NiteSec", "Tian Di Hui"], skills: { hacking: 309, charisma: 192 } }
  const workCandidates = [
    { faction: "NiteSec", name: "DataJack", repGap: 224865, cashReady: true, price: 4.5e9, value: 0 },
    { faction: "Tian Di Hui", name: "Small", repGap: 1000, cashReady: true, price: 1e8, value: 0.001 },
    { faction: "Tian Di Hui", name: "Big", repGap: 20000, cashReady: true, price: 1e9, value: 0.1 },
  ]
  const result = choosePlayerActivity({ player: ready, augmentation: { ok: true, workCandidates }, config: { physicalTarget: 0 } })
  assert.equal(result.augmentation, "Big")
  // Only worthless targets left: no rep work, so the next gate or karma decides instead.
  const none = choosePlayerActivity({
    player: ready, augmentation: { ok: true, workCandidates: workCandidates.slice(0, 1) },
    nextGate: { host: "run4theh111z", required: 505 }, config: { physicalTarget: 0, repBeforeGates: true },
  })
  assert.equal(none.action, "algorithms")
  assert.equal(none.host, "run4theh111z")
})

test("a target counts the faction's cheaper valued augmentations its rep unlocks on the way", () => {
  const ready = { money: 5e11, factions: ["NiteSec", "The Black Hand"], skills: { hacking: 400, charisma: 300 } }
  // Alone, Solo beats Far (0.04/10k vs 0.1/40k), but Far's 40k at The Black Hand also reaches Near and Shared.
  const workCandidates = [
    { faction: "NiteSec", name: "Solo", repGap: 10000, cashReady: true, price: 1e9, value: 0.04 },
    { faction: "NiteSec", name: "Shared", repGap: 30000, cashReady: true, price: 1e9, value: 0.04 },
    { faction: "The Black Hand", name: "Shared", repGap: 20000, cashReady: true, price: 1e9, value: 0.04 },
    { faction: "The Black Hand", name: "Near", repGap: 15000, cashReady: true, price: 1e9, value: 0.04 },
    { faction: "The Black Hand", name: "Far", repGap: 40000, cashReady: true, price: 1e9, value: 0.1 },
  ]
  const result = choosePlayerActivity({ player: ready, augmentation: { ok: true, workCandidates }, config: { physicalTarget: 0 } })
  assert.equal(result.faction, "The Black Hand")
  assert.equal(result.augmentation, "Far")
})

test("favor push works the target faction until favor plus pending gain reaches the donation threshold", () => {
  const player = { money: 5e11, factions: ["NiteSec", "The Black Hand"], skills: { hacking: 458, charisma: 319 } }
  const workCandidates = [{ faction: "The Black Hand", name: "Big", repGap: 20000, cashReady: true, price: 1e9, value: 0.1 }]
  const config = { physicalTarget: 0, favorTarget: "NiteSec" }
  const short = { ok: true, workCandidates, favorToDonate: 150, favor: { NiteSec: { favor: 113, gain: 20 } } }
  const pushed = choosePlayerActivity({ player, augmentation: short, config })
  assert.equal(pushed.faction, "NiteSec")
  assert.match(pushed.reason, /favor 113 \+20\.0 pending → 150/)
  const reached = { ...short, favor: { NiteSec: { favor: 113, gain: 37 } } }
  assert.equal(choosePlayerActivity({ player, augmentation: reached, config }).augmentation, "Big")
  // Not joined, or no favor data: no push.
  assert.equal(choosePlayerActivity({ player: { ...player, factions: ["The Black Hand"] }, augmentation: short, config }).augmentation, "Big")
  assert.equal(choosePlayerActivity({ player, augmentation: { ok: true, workCandidates }, config }).augmentation, "Big")
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
  assert.equal(result.city, "Sector-12")
})

test("covenantTarget is off by default and outside BN10", () => {
  assert.notEqual(choosePlayerActivity({ ...covenantBase, config: { ...covenantBase.config, covenantTarget: false } }).action, "gym")
  assert.notEqual(choosePlayerActivity({ ...covenantBase, bitNode: 15 }).action, "gym")
})

test("covenantTarget waits for augmentations and cash", () => {
  assert.notEqual(choosePlayerActivity({ ...covenantBase, augmentation: { ok: true, installedCount: 10, queuedCount: 2 } }).action, "gym")
  assert.notEqual(choosePlayerActivity({ ...covenantBase, player: { ...covenantBase.player, money: 1e9 } }).action, "gym")
})

test("covenantTarget skips the gym while 850 combat is out of reach", () => {
  // BN10 live 2026-11-05: strength 92 at 14.2k exp needs about 1e16 exp for 850.
  const weak = { ...covenantBase.player, skills: { hacking: 398, strength: 92, defense: 101, dexterity: 96, agility: 99 },
    exp: { strength: 14161, defense: 14176, dexterity: 27727, agility: 25292 } }
  assert.ok(expForLevel(92, 14161, 850) > 1e15)
  assert.notEqual(choosePlayerActivity({ ...covenantBase, player: weak }).action, "gym")
  // Strength 840 at 2m exp needs about 2.2m for 850: a few hours at 20 exp/s.
  const near = { ...covenantBase.player, skills: { hacking: 900, strength: 840, defense: 850, dexterity: 850, agility: 850 },
    exp: { strength: 2e6 } }
  assert.ok(covenantGymHours(near, 20) < 48)
  assert.equal(choosePlayerActivity({ ...covenantBase, player: near }).action, "gym")
})

test("covenantTarget falls through to hacking, then stops once the faction is joined", () => {
  const trained = { ...covenantBase.player, skills: { hacking: 700, strength: 850, defense: 850, dexterity: 850, agility: 850 } }
  assert.equal(choosePlayerActivity({ ...covenantBase, player: trained }).action, "algorithms")
  const joined = { ...covenantBase.player, factions: ["The Covenant"] }
  assert.notEqual(choosePlayerActivity({ ...covenantBase, player: joined }).action, "gym")
})

test("a donating faction's augmentation is bought with cash, not worked for", () => {
  const ready = { money: 3.79e14, skills: { hacking: 2400, strength: 300, defense: 300, dexterity: 300, agility: 300 } }
  const syndicate = { faction: "The Syndicate", name: "NEMEAN Subdermal Weave", repGap: 1542048, price: 1.625e10, cashReady: true, value: 0.79, donatable: true }
  const nitesec = { faction: "NiteSec", name: "Neural Thing", repGap: 27351, price: 1e9, cashReady: true, value: 0.01 }
  const config = { physicalTarget: 30 }
  const both = choosePlayerActivity({ player: ready, augmentation: { ok: true, workCandidates: [syndicate, nitesec] }, config })
  assert.equal(both.action, "faction")
  assert.equal(both.faction, "NiteSec")
  const onlyDonatable = choosePlayerActivity({ player: ready, augmentation: { ok: true, workCandidates: [syndicate] }, config })
  assert.notEqual(onlyDonatable.faction, "The Syndicate")
  // A priority name sold only by a donating faction is not worked for either.
  const priority = choosePlayerActivity({ player: ready, augmentation: { ok: true, workCandidates: [syndicate] }, config: { ...config, priorityAugs: [syndicate.name] } })
  assert.notEqual(priority.faction, "The Syndicate")
})

test("rep work skips augmentations the gang faction sells", () => {
  const rows = [{ name: "Bionic Arms", faction: "Tetrads", repGap: 100, price: 1, cashReady: true }]
  const args = { player: { money: 10, skills: { hacking: 300, charisma: 600 } }, nextGate: { host: "x", required: 355 }, config: { physicalTarget: 0, repBeforeGates: true } }
  assert.equal(choosePlayerActivity({ ...args, augmentation: { ok: true, workCandidates: rows } }).action, "faction")
  assert.equal(choosePlayerActivity({ ...args, augmentation: { ok: true, workCandidates: rows, gangSells: ["Bionic Arms"] } }).action, "algorithms")
})
