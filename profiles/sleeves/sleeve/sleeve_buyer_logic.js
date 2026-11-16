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

/** BN6: augmentations that help Bladeburner contract work (combat stats), plus Neurotrainer I (all exp). */
export const BN6_SLEEVE_AUGS = ["Wired Reflexes", "Neurotrainer I", "LuminCloaking-V1 Skin Implant",
  "Augmented Targeting I", "LuminCloaking-V2 Skin Implant", "HemoRecirculator"]

/**
 * Next sleeve augmentation batch, or null. Rules (bitburner-src dev, src/PersonObjects/Sleeve/Sleeve.ts):
 * the sleeve's shock must be 0, the list is getSleevePurchasableAugs (factions' augs the player has
 * rep for, sleeve-valid multipliers only), the price is the augmentation's base cost (no escalation),
 * and every player install wipes sleeve augmentations, so they are bought again after it.
 *
 * Sleeve.installAugmentation zeroes the sleeve's exp, but a second purchase on a zeroed sleeve costs
 * nothing more. So augmentations are bought per sleeve, as a batch in one pass (Ken 2026-11-16):
 * one reset buys every wanted augmentation the budget (`batchShare` of spendable) covers, cheapest
 * first. A fresh sleeve (exp below `freshExp`, i.e. just after an install) loses nothing and takes
 * any amount; any other sleeve needs a batch of at least `minAugs` or its whole remaining set.
 * `freshOnly` (karma crime still needed) restricts buying to fresh sleeves. The caller passes
 * spendable 0 late in a cycle (lateCycleLimit), when an install would soon wipe the purchase.
 * Order: fresh sleeves, then highest `priority` (best Bladeburner contract odds), then biggest batch.
 * sleeves: [{ index, shock, exp, priority, augs: [{ name, cost }] }]; wanted: names, or null for all.
 */
export function chooseSleeveAugBatch({ sleeves = [], spendable, batchShare = 0.5, wanted = null, freshOnly = false, freshExp = 1000, minAugs = 3 } = {}) {
  const budget = Math.max(0, Number(spendable) || 0) * batchShare
  const candidates = []
  for (const s of sleeves) {
    if (Number(s.shock) !== 0) continue
    const fresh = (Number(s.exp) || 0) < freshExp
    if (freshOnly && !fresh) continue
    const want = (s.augs || []).filter((a) => !wanted || wanted.includes(a.name))
      .map((a) => ({ name: a.name, cost: Number(a.cost) })).filter((a) => Number.isFinite(a.cost))
      .sort((a, b) => a.cost - b.cost)
    if (!want.length) continue
    const names = []
    let cost = 0
    for (const a of want) { if (cost + a.cost > budget) break; names.push(a.name); cost += a.cost }
    const complete = names.length === want.length
    if (!names.length || (!fresh && !complete && names.length < minAugs)) continue
    candidates.push({ sleeve: s.index, names, cost, complete, fresh, priority: Number(s.priority) || 0 })
  }
  candidates.sort((a, b) => (b.fresh - a.fresh) || (b.priority - a.priority) || (b.names.length - a.names.length) || (a.sleeve - b.sleeve))
  const pick = candidates[0]
  if (!pick) return null
  return { kind: "aug", sleeve: pick.sleeve, names: pick.names, cost: pick.cost, complete: pick.complete, fresh: pick.fresh,
    model: "sleeve augmentation batch: one exp reset, multiplies the sleeve's stats until the next install", paybackHours: null }
}

/** A Covenant sleeve first, then augmentations, then memory; `covenant` is null outside The Covenant. */
export function chooseNextPurchase({ covenant = null, aug = null } = {}) {
  if (covenant?.kind === "sleeve") return covenant
  if (aug) return aug
  if (covenant) return covenant
  return { kind: "save", reason: "no affordable sleeve augmentation; not a member of The Covenant" }
}
