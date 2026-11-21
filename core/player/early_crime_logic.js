/**
 * Early-crime chooser (Ken 2026-11-16, built 2026-11-21 after BN12 day one).
 * On a fresh 32GB home the crime controller (36.8GB) and sleeve controller (30.4GB) do not fit for
 * about an hour, so this picks crimes for the player and the sleeves until they do.
 *
 * Mode: money while home RAM is under `moneyUntilHomeGB` (the first upgrades start MCP), then karma
 * (the gang gate). Crimes are ranked by expected money or karma per second.
 *
 * Crime data and the chance formula mirror bitburner-src Crime.ts / CrimeType data (as sleeve_logic.js).
 */

export const CRIMES = [
  { name: "Shoplift", time: 2e3, money: 15e3, karma: 0.1, diff: 1 / 20, weights: { dexterity: 1, agility: 1 } },
  { name: "Rob Store", time: 60e3, money: 400e3, karma: 0.5, diff: 1 / 5, weights: { hacking: 0.5, dexterity: 2, agility: 1 } },
  { name: "Mug", time: 4e3, money: 36e3, karma: 0.25, diff: 1 / 5, weights: { strength: 1.5, defense: 0.5, dexterity: 1.5, agility: 0.5 } },
  { name: "Larceny", time: 90e3, money: 800e3, karma: 1.5, diff: 1 / 3, weights: { hacking: 0.5, dexterity: 1, agility: 1 } },
  { name: "Deal Drugs", time: 10e3, money: 120e3, karma: 0.5, diff: 1, weights: { dexterity: 2, agility: 1, charisma: 3 } },
  { name: "Bond Forgery", time: 300e3, money: 4.5e6, karma: 0.1, diff: 0.5, weights: { hacking: 0.05, dexterity: 1.25 } },
  { name: "Traffick Arms", time: 40e3, money: 600e3, karma: 1, diff: 2, weights: { strength: 1, defense: 1, dexterity: 1, agility: 1, charisma: 1 } },
  { name: "Homicide", time: 3e3, money: 45e3, karma: 3, diff: 1, weights: { strength: 2, defense: 2, dexterity: 0.5, agility: 0.5 } },
  { name: "Grand Theft Auto", time: 80e3, money: 1.6e6, karma: 5, diff: 8, weights: { hacking: 1, strength: 1, dexterity: 4, agility: 2, charisma: 2 } },
  { name: "Kidnap", time: 120e3, money: 3.6e6, karma: 6, diff: 5, weights: { strength: 1, dexterity: 1, agility: 1, charisma: 1 } },
  { name: "Assassination", time: 300e3, money: 12e6, karma: 10, diff: 8, weights: { strength: 1, dexterity: 2, agility: 1 } },
  { name: "Heist", time: 600e3, money: 120e6, karma: 15, diff: 18, weights: { hacking: 1, strength: 1, defense: 1, dexterity: 1, agility: 1, charisma: 1 } },
]

/** A sleeve at the start of a BitNode: every stat 1 (memory keeps none; shock ~98 slows training to ~2%). */
export const FRESH_SLEEVE_SKILLS = { hacking: 1, strength: 1, defense: 1, dexterity: 1, agility: 1, charisma: 1, intelligence: 0 }

function number(value) { return Number.isFinite(Number(value)) ? Number(value) : 0 }

/** Crime.successRate: weighted skills plus intelligence, over 975 x difficulty, times the crime mult. */
export function crimeChance(crime, skills = {}, successMult = 1) {
  let chance = 0
  for (const [skill, weight] of Object.entries(crime.weights)) chance += weight * number(skills[skill])
  chance += 0.025 * number(skills.intelligence)
  chance /= 975 * crime.diff
  chance *= number(successMult) || 1
  chance *= 1 + Math.pow(number(skills.intelligence), 0.8) / 600
  return Math.max(0, Math.min(chance, 1))
}

/** Crimes by expected money or karma per second, best first. */
export function rankCrimes(skills, goal, successMult = 1) {
  return CRIMES.map((crime) => {
    const chance = crimeChance(crime, skills, successMult)
    const perSecond = chance / (crime.time / 1000)
    return { crime: crime.name, chance, score: (goal === "karma" ? crime.karma : crime.money) * perSecond }
  }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score || a.crime.localeCompare(b.crime))
}

/** money while home is small, karma after. */
export function earlyGoal(homeMaxRam, moneyUntilHomeGB = 64) {
  return number(homeMaxRam) < moneyUntilHomeGB ? "money" : "karma"
}

/** Best crime, but keep `current` unless the best beats it by more than 1/keepRatio (no flapping). */
export function pickEarlyCrime({ skills, goal, successMult = 1, current = null, keepRatio = 0.9 }) {
  const ranked = rankCrimes(skills, goal, successMult)
  if (!ranked.length) return null
  const best = ranked[0]
  const kept = current ? ranked.find((row) => row.crime === current) : null
  if (kept && kept.score >= best.score * keepRatio) return kept
  return best
}
