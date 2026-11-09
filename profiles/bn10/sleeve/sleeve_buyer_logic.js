/**
 * Pure decisions for sleeve_buyer.js. No ns calls.
 *
 * Rules, from bitburner-src dev (src/PersonObjects/Sleeve/SleeveCovenantPurchases.tsx):
 * - purchaseSleeve needs BitNode 10, membership of The Covenant, fewer than 5 bought, and cash >= cost.
 *   Cost is 10^bought * $10t. It debits the cost, then adds one sleeve; the purchase is permanent.
 * - upgradeMemory(sleeve, n) needs BN10, membership, memory + n <= 100 and cash >= cost.
 *   n points cost $1t * sum(1.02^(memory-1+i)) for i in 0..n-1.
 */
export const COVENANT = "The Covenant"
export const MAX_COVENANT_SLEEVES = 5
export const MEMORY_BASE_COST = 1e12
export const MEMORY_GROWTH = 1.02
export const MAX_MEMORY = 100

/** Game formula for `n` memory points on a sleeve at `memory`; Infinity when past the cap. */
export function memoryCost(memory, n) {
  if (!Number.isInteger(n) || n < 1 || memory + n > MAX_MEMORY) return Infinity
  let total = 0
  for (let i = 0; i < n; i++) total += MEMORY_GROWTH ** (memory - 1 + i)
  return total * MEMORY_BASE_COST
}

/** Covenant sleeves already bought, recovered from getSleeveCost() = 10^bought * $10t (Infinity once 5 are bought). */
export function boughtFromCost(sleeveCost) {
  return Number.isFinite(sleeveCost) && sleeveCost > 0 ? Math.max(0, Math.round(Math.log10(sleeveCost / 1e13))) : MAX_COVENANT_SLEEVES
}

/** Why the buyer cannot act at all, or null. */
export function eligibility({ bitNode, factions = [] } = {}) {
  if (Number(bitNode) !== 10) return `not BitNode 10 (in ${bitNode ?? "unknown"}): Covenant sleeves exist only in BN10`
  if (!factions.includes(COVENANT)) return "not a member of The Covenant yet"
  return null
}

/**
 * Payoff model. A sleeve's output (exp, karma, money) scales with sync, and sync restarts at memory,
 * so a sleeve at memory m yields about m/100 of a full sleeve. A full sleeve is assumed to earn
 * `sleeveShare` of the player's smoothed income per second (an assumption, recorded with each
 * purchase, not a measurement). Shock recovery delays the first return by about a day of game time.
 */
export function payoff({ kind, cost, income = 0, sleeveShare = 0.25, memory = 1, points = 0 }) {
  const fullRate = Math.max(0, income) * sleeveShare
  const gainPerSec = kind === "sleeve" ? fullRate * (memory / 100) : fullRate * (points / 100)
  return {
    model: kind === "sleeve"
      ? "new sleeve earns sleeveShare x income x memory/100 per second"
      : "points add points/100 of one full sleeve's earnings",
    income, sleeveShare, gainPerSec,
    paybackHours: gainPerSec > 0 ? cost / gainPerSec / 3600 : null,
  }
}

/**
 * Next purchase, or a reason to wait. A Covenant sleeve outranks memory when affordable.
 * Memory comes only once a sleeve was bought here, cheapest next point first, in batches of
 * up to `memoryBatch` that `spendable` covers.
 * sleeves: [{ index, memory }]; sleeveCost: getSleeveCost() (Infinity at the cap).
 */
export function chooseSleevePurchase({ spendable, sleeveCost, boughtCount = 0, sleeves = [], income = 0, sleeveShare = 0.25, memoryBatch = 10 } = {}) {
  if (Number.isFinite(sleeveCost) && sleeveCost <= spendable) {
    // The new sleeve starts at memory 1, which is what the model prices in.
    return { kind: "sleeve", cost: sleeveCost, ...payoff({ kind: "sleeve", cost: sleeveCost, income, sleeveShare, memory: 1 }) }
  }
  if (boughtCount < 1) {
    return { kind: "save", reason: Number.isFinite(sleeveCost) ? `saving for sleeve: ${sleeveCost.toExponential(2)}` : "sleeve cap reached before any purchase" }
  }
  const open = sleeves.filter((s) => s.memory < MAX_MEMORY).sort((a, b) => a.memory - b.memory || a.index - b.index)
  for (const sleeve of open) {
    for (let n = Math.min(memoryBatch, MAX_MEMORY - sleeve.memory); n >= 1; n--) {
      const cost = memoryCost(sleeve.memory, n)
      if (cost <= spendable) {
        return { kind: "memory", sleeve: sleeve.index, points: n, cost, ...payoff({ kind: "memory", cost, income, sleeveShare, memory: sleeve.memory, points: n }) }
      }
    }
  }
  return { kind: "save", reason: open.length ? "memory upgrade not yet affordable" : "all sleeves at memory cap" }
}

/** Smoothed income from cash deltas, as capital_manager.js does it. */
export function smoothIncome({ previous = 0, cash, lastCash, spent = 0, seconds, windowSec = 600 }) {
  if (!(seconds > 0)) return previous
  const sample = Math.max(0, cash + spent - lastCash) / seconds
  const weight = 1 - Math.exp(-seconds / windowSec)
  return previous ? previous + (sample - previous) * weight : sample
}

/**
 * Next sleeve augmentation, or null. Rules (bitburner-src dev, src/PersonObjects/Sleeve/Sleeve.ts):
 * the sleeve's shock must be 0, the list is getSleevePurchasableAugs (factions' augs the player has
 * rep for, sleeve-valid multipliers only), the price is the augmentation's base cost, and every
 * player install wipes sleeve augmentations (Sleeve.prestige), so they are bought again after it.
 * Cheapest first, each costing at most `augShare` of spendable. No Covenant membership needed.
 * Sleeve.installAugmentation zeroes the sleeve's exp, so while karma is still needed (sleeves on
 * crime, whose chance follows their stats) only sleeves whose combat exp is below `freshExp` (just
 * after a player install) buy; the rest wait for the karma gate. On 2026-11-08 about 23:00 thirty
 * purchases reset every sleeve and halved Homicide chance (29% to 15%).
 * sleeves: [{ index, shock, exp, augs: [{ name, cost }] }]
 */
export function chooseSleeveAug({ sleeves = [], spendable, augShare = 0.05, karmaNeeded = false, freshExp = 1000 } = {}) {
  const limit = Math.max(0, Number(spendable) || 0) * augShare
  const options = sleeves.filter((s) => Number(s.shock) === 0)
    .filter((s) => !karmaNeeded || (Number(s.exp) || 0) < freshExp)
    .flatMap((s) => (s.augs || []).map((aug) => ({ sleeve: s.index, name: aug.name, cost: Number(aug.cost) })))
    .filter((o) => Number.isFinite(o.cost) && o.cost <= limit)
    .sort((a, b) => a.cost - b.cost || a.sleeve - b.sleeve)
  if (!options.length) return null
  const pick = options[0]
  return { kind: "aug", ...pick, model: "sleeve augmentation: multiplies the sleeve's stats and gains until the next install", paybackHours: null }
}

/** A Covenant sleeve first, then augmentations, then memory; `covenant` is null outside The Covenant. */
export function chooseNextPurchase({ covenant = null, aug = null } = {}) {
  if (covenant?.kind === "sleeve") return covenant
  if (aug) return aug
  if (covenant) return covenant
  return { kind: "save", reason: "no affordable sleeve augmentation; not a member of The Covenant" }
}
