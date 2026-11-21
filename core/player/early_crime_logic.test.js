import test from "node:test"
import assert from "node:assert/strict"
import { crimeChance, CRIMES, earlyGoal, FRESH_SLEEVE_SKILLS, pickEarlyCrime, rankCrimes } from "./early_crime_logic.js"

const crime = (name) => CRIMES.find((c) => c.name === name)
const ones = { hacking: 1, strength: 1, defense: 1, dexterity: 1, agility: 1, charisma: 1, intelligence: 0 }

test("chance mirrors Crime.successRate and caps at 1", () => {
  // Shoplift at dex/agi 1: (1 + 1) / (975 / 20)
  assert.ok(Math.abs(crimeChance(crime("Shoplift"), ones) - 2 / 48.75) < 1e-12)
  assert.equal(crimeChance(crime("Shoplift"), { ...ones, dexterity: 82, agility: 82 }), 1)
})

test("goal is money under the home threshold, karma at or above it", () => {
  assert.equal(earlyGoal(32), "money")
  assert.equal(earlyGoal(64), "karma")
  assert.equal(earlyGoal(64, 128), "money")
})

test("fresh player and fresh sleeves: Shoplift for money, Homicide for karma", () => {
  assert.equal(rankCrimes(ones, "money")[0].crime, "Shoplift")
  assert.equal(rankCrimes(ones, "karma")[0].crime, "Homicide")
  assert.equal(rankCrimes(FRESH_SLEEVE_SKILLS, "karma")[0].crime, "Homicide")
})

test("BN12 day one player (dex/agi 82, str/def 1, int 156, x1.54): Homicide for karma, Mug beats Shoplift for money", () => {
  const skills = { ...ones, hacking: 91, dexterity: 82, agility: 82, charisma: 169, intelligence: 156 }
  assert.equal(rankCrimes(skills, "karma", 1.5376)[0].crime, "Homicide")
  const money = rankCrimes(skills, "money", 1.5376).map((r) => r.crime)
  assert.ok(money.indexOf("Mug") < money.indexOf("Shoplift"))
})

test("keeps the current crime within the keep ratio, switches beyond it", () => {
  const skills = { ...ones, dexterity: 82, agility: 82, strength: 20, defense: 20 }
  const ranked = rankCrimes(skills, "money")
  const second = ranked[1]
  const kept = pickEarlyCrime({ skills, goal: "money", current: second.crime, keepRatio: second.score / ranked[0].score - 1e-9 })
  assert.equal(kept.crime, second.crime)
  assert.equal(pickEarlyCrime({ skills, goal: "money", current: second.crime, keepRatio: 1 }).crime, ranked[0].crime)
  assert.equal(pickEarlyCrime({ skills, goal: "money", current: "Nonexistent" }).crime, ranked[0].crime)
})
