import test from "node:test"
import assert from "node:assert/strict"
import { chooseSleeveTasks, crimeChance, factionTargets, rankCrimes, sameTask, sleeveApiUnavailable } from "./sleeve_logic.js"

const NOW = 1_000_000
const strong = { hacking: 100, strength: 200, defense: 200, dexterity: 200, agility: 200, charisma: 100, intelligence: 0 }
const sleeve = (index, extra = {}) => ({ index, shock: 0, sync: 100, skills: strong, mults: { crime_success: 1 }, task: null, ...extra })
const cand = (faction, name, repGap, extra = {}) => ({ faction, name, repGap, price: 1e6, cashReady: true, canWorkForRep: true, ...extra })
const readiness = (workCandidates, extra = {}) => ({ ok: true, ts: NOW, workCandidates, gangFaction: null, ...extra })
const run = (args) => chooseSleeveTasks({ now: NOW, karma: -60_000, money: 1e9, ...args })

test("crime chance follows Crime.successRate and caps at 1", () => {
  const shoplift = { weights: { dexterity: 1, agility: 1 }, diff: 1 / 20 }
  assert.ok(Math.abs(crimeChance(shoplift, { dexterity: 10, agility: 10 }) - (20 / 975) * 20) < 1e-9)
  assert.equal(crimeChance(shoplift, { dexterity: 900, agility: 900 }), 1)
  assert.ok(crimeChance(shoplift, { dexterity: 10, agility: 10 }, { crime_success: 2 }) > crimeChance(shoplift, { dexterity: 10, agility: 10 }))
})

test("karma crime ranks by sync-scaled karma rate, money crime by money rate", () => {
  const s = sleeve(0, { skills: { strength: 100, defense: 100, dexterity: 100, agility: 100, charisma: 100, hacking: 100 } })
  const karma = rankCrimes(s, "karma")
  const money = rankCrimes(s, "money")
  assert.equal(karma[0].crime, "Homicide")
  assert.notEqual(money[0].crime, "Homicide")
  assert.ok(rankCrimes({ ...s, sync: 50 }, "karma")[0].score < karma[0].score)
  assert.equal(rankCrimes({ ...s, sync: 50 }, "money")[0].score, money[0].score)
})

test("a hopeless crime is never chosen", () => {
  const weak = sleeve(0, { skills: {} })
  assert.deepEqual(rankCrimes(weak, "money"), [])
  assert.equal(run({ sleeves: [weak], karma: 0 })[0].task.action, "hold")
  assert.equal(run({ sleeves: [{ ...weak, sync: 80 }], karma: -60_000 })[0].task.action, "synchronize")
})

test("shock above the threshold means recovery, with hysteresis while recovering", () => {
  assert.equal(run({ sleeves: [sleeve(0, { shock: 90 })] })[0].task.action, "recovery")
  assert.notEqual(run({ sleeves: [sleeve(0, { shock: 30 })] })[0].task.action, "recovery")
  assert.equal(run({ sleeves: [sleeve(0, { shock: 30, task: { type: "RECOVERY" } })] })[0].task.action, "recovery")
  assert.notEqual(run({ sleeves: [sleeve(0, { shock: 3, task: { type: "RECOVERY" } })] })[0].task.action, "recovery")
})

test("karmaWhileShocked lets a shocked sleeve earn karma, which the source does not scale by shock", () => {
  const out = run({ sleeves: [sleeve(0, { shock: 90 })], karma: -6_500, config: { karmaWhileShocked: true } })
  assert.equal(out[0].task.action, "crime")
  assert.equal(out[0].task.goal, "karma")
})

test("low sync synchronizes only while karma, the sync-scaled goal, is needed", () => {
  assert.equal(run({ sleeves: [sleeve(0, { sync: 20 })], karma: -6_500 })[0].task.action, "synchronize")
  assert.equal(run({ sleeves: [sleeve(0, { sync: 80, task: { type: "SYNCHRO" } })], karma: -6_500 })[0].task.action, "synchronize")
  assert.equal(run({ sleeves: [sleeve(0, { sync: 20 })], karma: -60_000, readiness: readiness([cand("NiteSec", "A", 100)]), config: { crimeKarmaTarget: -54_000 } })[0].task.action, "faction")
})

test("karma above the target sends a recovered sleeve to crime for karma", () => {
  const out = run({ sleeves: [sleeve(0)], karma: -6_500 })
  assert.equal(out[0].task.action, "crime")
  assert.equal(out[0].task.goal, "karma")
  assert.equal(out[0].task.crime, "Homicide")
})

test("karma already at target moves the sleeves to faction rep", () => {
  const out = run({ sleeves: [sleeve(0)], readiness: readiness([cand("NiteSec", "Cranial", 500)]) })
  assert.equal(out[0].task.action, "faction")
  assert.equal(out[0].task.faction, "NiteSec")
  assert.equal(out[0].task.augmentation, "Cranial")
})

test("sleeves take factions the player is not working before sharing the player's", () => {
  const candidates = [cand("CyberSec", "A", 100), cand("NiteSec", "B", 900)]
  const activity = { ts: NOW, decision: { action: "faction", faction: "CyberSec", workType: "hacking" } }
  const one = run({ sleeves: [sleeve(0)], readiness: readiness(candidates), activity })
  assert.equal(one[0].task.faction, "NiteSec")
  const two = run({ sleeves: [sleeve(0), sleeve(1)], readiness: readiness(candidates), activity })
  assert.deepEqual(two.map((r) => r.task.faction), ["NiteSec", "CyberSec"])
  assert.match(two[1].reason, /shared with the player/)
})

test("two sleeves never get the same faction", () => {
  const out = run({ sleeves: [sleeve(0), sleeve(1)], readiness: readiness([cand("NiteSec", "A", 100), cand("NiteSec", "B", 200)]) })
  assert.equal(out[0].task.faction, "NiteSec")
  assert.equal(out[1].task.action, "crime")
  assert.equal(out[1].task.goal, "money")
})

test("a sleeve already on a wanted faction keeps it instead of swapping", () => {
  const candidates = [cand("CyberSec", "A", 100), cand("NiteSec", "B", 900)]
  const out = run({
    sleeves: [sleeve(0), sleeve(1, { task: { type: "FACTION", factionName: "CyberSec", factionWorkType: "hacking" } })],
    readiness: readiness(candidates),
  })
  assert.equal(out[1].task.faction, "CyberSec")
  assert.equal(out[0].task.faction, "NiteSec")
})

test("the gang faction, finished augmentations and unaffordable prices are not rep targets", () => {
  const list = readiness([
    cand("Slum Snakes", "G", 100, { canWorkForRep: false }),
    cand("NiteSec", "Done", 0),
    cand("CyberSec", "Done", 50),
    cand("BitRunners", "Pricey", 100, { cashReady: false, price: 1e15 }),
    cand("Tian Di Hui", "Fine", 300),
  ], { gangFaction: "Slum Snakes" })
  const targets = factionTargets(list, { gangFaction: "Slum Snakes", money: 1e6 })
  assert.deepEqual(targets.map((t) => t.faction), ["Tian Di Hui"])
})

test("a stale or failed readiness snapshot yields no rep target, so sleeves fall back to money crime", () => {
  const stale = { ...readiness([cand("NiteSec", "A", 100)]), ts: NOW - 3_600_000 }
  assert.equal(run({ sleeves: [sleeve(0)], readiness: stale })[0].task.goal, "money")
  assert.equal(run({ sleeves: [sleeve(0)], readiness: { ok: false, ts: NOW } })[0].task.goal, "money")
})

test("faction work types start with the player's, then hacking, field, security", () => {
  const activity = { ts: NOW, decision: { action: "faction", faction: "X", workType: "field" } }
  const out = run({ sleeves: [sleeve(0)], readiness: readiness([cand("NiteSec", "A", 100)]), activity })
  assert.deepEqual(out[0].task.workTypes, ["field", "hacking", "security"])
})

test("the current crime is kept unless the best beats it clearly", () => {
  const s = sleeve(0, { skills: { strength: 100, defense: 100, dexterity: 100, agility: 100, charisma: 100, hacking: 100 } })
  const best = rankCrimes(s, "karma")
  const runnerUp = best[1].crime
  const near = run({ sleeves: [{ ...s, task: { type: "CRIME", crimeType: runnerUp } }], karma: -1 })[0]
  assert.equal(near.task.crime, best[1].score >= best[0].score * 0.9 ? runnerUp : best[0].crime)
  const far = run({ sleeves: [{ ...s, task: { type: "CRIME", crimeType: "Shoplift" } }], karma: -1 })[0]
  assert.equal(far.task.crime, best[0].crime)
})

test("disabled config holds every sleeve", () => {
  const out = run({ sleeves: [sleeve(0), sleeve(1)], config: { enabled: false } })
  assert.deepEqual(out.map((r) => r.task.action), ["hold", "hold"])
})

test("sameTask recognises an equivalent running task", () => {
  assert.equal(sameTask({ type: "RECOVERY" }, { action: "recovery" }), true)
  assert.equal(sameTask({ type: "SYNCHRO" }, { action: "recovery" }), false)
  assert.equal(sameTask({ type: "CRIME", crimeType: "Mug" }, { action: "crime", crime: "Mug" }), true)
  assert.equal(sameTask({ type: "CRIME", crimeType: "Mug" }, { action: "crime", crime: "Homicide" }), false)
  const desired = { action: "faction", faction: "NiteSec", workTypes: ["hacking", "field"] }
  assert.equal(sameTask({ type: "FACTION", factionName: "NiteSec", factionWorkType: "field" }, desired), true)
  assert.equal(sameTask({ type: "FACTION", factionName: "NiteSec", factionWorkType: "security" }, desired), false)
  assert.equal(sameTask(null, { action: "hold" }), true)
  assert.equal(sameTask(null, { action: "recovery" }), false)
})

test("the unavailable-API error is recognised", () => {
  assert.equal(sleeveApiUnavailable(new Error("sleeve.getSleeve: You do not have access to the Sleeve API. This is either because you are not in BitNode-10 or because you do not have Source-File 10.")), true)
  assert.equal(sleeveApiUnavailable(new Error("Invalid sleeve number: 3")), false)
})

test("sleeve faction targets skip names the gang faction sells", () => {
  const list = readiness([cand("Tetrads", "Bionic Arms", 100), cand("Slum Snakes", "Other", 200)], { gangSells: ["Bionic Arms"] })
  assert.deepEqual(factionTargets(list, { money: 1e6 }).map((t) => t.faction), ["Slum Snakes"])
})
