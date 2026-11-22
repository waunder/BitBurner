/**
 * Purchase order for an install. Prices rise after every buy, so the dearest go
 * first; a prerequisite is bought before anything that needs it. Each pick must
 * leave enough to buy the rep-ready `priority` names afterwards, so they are never squeezed out.
 * @param {{name:string,faction:string,rep:number,repRequired:number,price:number,prerequisites:string[]}[]} offers
 * @param {string[]} owned
 * @param {string[]} priority
 * @param {{maxStepPrice?:number, minValue?:number}} limits an offer whose stepped price (price x the
 *   1.9 steps already taken) exceeds `maxStepPrice` and whose `value` is known and under `minValue` is
 *   skipped, not bought (cheaper ones still are). With `only` and a non-empty `priority`, nothing
 *   outside `priority` is bought (no filler that raises NeuroFlux prices). Defaults change nothing.
 */
export function planPurchases(offers, owned, money, priceStep = 1.9, priority = [], { maxStepPrice = Infinity, minValue = 0, only = false, byValue = false } = {}) {
  const best = new Map()
  for (const offer of offers) {
    if (offer.rep < offer.repRequired || offer.name === NEUROFLUX) continue
    if (only && priority.length && !priority.includes(offer.name)) continue
    const seen = best.get(offer.name)
    if (!seen || offer.rep > seen.rep) best.set(offer.name, offer)
  }
  // `byValue` (needs offer.value): choose the set by value per added cost first, then buy it as below.
  if (byValue) {
    const keep = selectByValue([...best.values()], owned, money, priceStep, priority)
    for (const name of [...best.keys()]) if (!keep.has(name)) best.delete(name)
  }
  const plan = []
  const held = new Set(owned)
  let left = money
  let scale = 1
  const ready = () => [...best.values()]
    .filter((offer) => !held.has(offer.name) && offer.prerequisites.every((name) => held.has(name)))
    .sort((a, b) => b.price - a.price)
  // Cost of the priority names still unbought after `pick`, dearest first at the prices that follow it.
  const reserveFor = (pick) => {
    let cost = 0
    let step = scale * priceStep
    const rest = priority.filter((name) => name !== pick.name && !held.has(name) && best.has(name))
      .map((name) => best.get(name).price).sort((a, b) => b - a)
    for (const price of rest) { cost += price * step; step *= priceStep }
    return cost
  }
  for (let next = ready(); next.length; next = ready()) {
    const pick = next.find((offer) => offer.price * scale + reserveFor(offer) <= left
      && !(offer.price * scale > maxStepPrice && Number.isFinite(offer.value) && offer.value < minValue))
    if (!pick) break
    left -= pick.price * scale
    scale *= priceStep
    held.add(pick.name)
    plan.push(pick)
  }
  return { plan, left }
}

/** Total price of buying `prices` dearest first, each buy raising the next by `priceStep`. */
export function ladderCost(prices, priceStep = 1.9) {
  let step = 1
  let cost = 0
  for (const price of [...prices].sort((a, b) => b - a)) { cost += price * step; step *= priceStep }
  return cost
}

/**
 * Which augmentations to buy when `value` matters (2026-11-17: the dearest-first plan offered ADR-V2 +
 * SmartSonar, value 0.14 for $3.46b, while Bionic Spine, Nanofiber Weave, Neurotrainer II and NutriGen gave
 * 0.54 for $2.71b). Greedy on value added per extra ladder cost: each step adds the offer (with any
 * missing prerequisite) whose value per added cost is highest and whose whole set still fits in `money`.
 * Priority names are always kept; value-0 offers are never added. Buy order stays planPurchases' job.
 * @returns {Set<string>} names to keep
 */
export function selectByValue(pool, owned, money, priceStep = 1.9, priority = []) {
  const byName = new Map(pool.map((offer) => [offer.name, offer]))
  const held = new Set(owned)
  const keep = new Set(priority.filter((name) => byName.has(name) && !held.has(name)))
  const withPrereqs = (offer) => {
    const add = [offer.name]
    for (const name of offer.prerequisites || []) {
      if (held.has(name) || keep.has(name)) continue
      if (!byName.has(name)) return null
      add.push(name)
    }
    return add
  }
  const costOf = (names) => ladderCost([...names].map((name) => byName.get(name).price), priceStep)
  let current = costOf(keep)
  for (;;) {
    let pick = null
    for (const offer of pool) {
      if (keep.has(offer.name) || held.has(offer.name) || !(Number(offer.value) > 0)) continue
      const add = withPrereqs(offer)
      if (!add) continue
      const cost = costOf([...keep, ...add])
      if (cost > money) continue
      const gain = add.reduce((sum, name) => sum + (Number(byName.get(name).value) || 0), 0)
      const score = gain / Math.max(cost - current, 1)
      if (!pick || score > pick.score) pick = { add, cost, score }
    }
    if (!pick) return keep
    for (const name of pick.add) keep.add(name)
    current = pick.cost
  }
}

/**
 * Count fillers (2026-11-21, BN12): Daedalus invites at `target` installed augmentations (the game counts
 * `player.augmentations.length`, NeuroFlux once), and a value-0 augmentation counts like any other. While
 * owned + `planNames` is short of `target`, add rep-ready offers outside the plan, cheapest first (they cost
 * the least ladder), as long as the whole ladder (plan + fillers, dearest first) stays within `share` of
 * `money`. Never NeuroFlux; a filler's prerequisites must already be owned or planned.
 * @returns {string[]} names to add to the plan
 */
export function countFillers(offers, owned, planNames, money, target, share = 0.1, priceStep = 1.9) {
  const held = new Set([...owned, ...planNames])
  const prices = new Map()
  for (const offer of offers) {
    if (offer.rep < offer.repRequired || offer.name === NEUROFLUX || held.has(offer.name)) continue
    if (!prices.has(offer.name) || offer.price < prices.get(offer.name).price) prices.set(offer.name, offer)
  }
  const byName = new Map(offers.map((offer) => [offer.name, offer]))
  const planPrices = planNames.map((name) => byName.get(name)?.price || 0)
  const add = []
  for (const offer of [...prices.values()].sort((a, b) => a.price - b.price)) {
    if (held.size >= target) break
    if (!(offer.prerequisites || []).every((name) => held.has(name))) continue
    const cost = ladderCost([...planPrices, ...add.map((name) => prices.get(name).price), offer.price], priceStep)
    if (cost > money * share) break
    add.push(offer.name)
    held.add(offer.name)
  }
  return add
}

/** Home RAM and cores survive an install, so leftover cash goes on the cheaper of the two. */
export function nextHomeUpgrade(ramCost, coreCost, money) {
  const pick = coreCost < ramCost ? { kind: "cores", cost: coreCost } : { kind: "ram", cost: ramCost }
  return pick.cost <= money ? pick : null
}

/**
 * The numbers that change with the BitNode, the run and the Source-Files, so no profile copies them by hand
 * (hands-off test, 2026-11-22). From the installed game's v3.0.1 bundle: getBitNodeMultipliers and
 * getGenericAugmentationPriceMultiplier. A number in player_activity_config.json still wins.
 * @param {{currentNode?:number, ownedSF?:Map<number,number>}} reset ns.getResetInfo()
 */
export function runRules(reset, config = {}) {
  const node = Number(reset?.currentNode) || 1
  const level = (n) => Number(reset?.ownedSF?.get?.(n)) || 0
  const scale = 1.02 ** (level(12) + 1) // BitNode-12 grows 2% a run
  const repGain = node === 12 ? 1 / scale : ({ 2: 0.5, 4: 0.75, 13: 0.6, 14: 0.2 })[node] ?? 1
  const augs = node === 12 ? Math.floor(Math.min(30 + scale, 40)) : ({ 6: 35, 7: 35, 15: 20 })[node] ?? 30
  return {
    priceStep: 1.9 * [1, 0.96, 0.94, 0.93][Math.min(3, level(11))],
    donationRepGain: Number(config?.donationRepGain) > 0 ? Number(config.donationRepGain) : repGain,
    daedalusAugs: Number(config?.countFillersTo) > 0 ? Number(config.countFillersTo) : augs,
    fillersTo: config?.countFillersTo === "auto" ? augs : Number(config?.countFillersTo) || 0,
  }
}

export const NEUROFLUX = "NeuroFlux Governor"

/**
 * Augmentations the run cannot finish without. They carry no multipliers, so the by-value plan would
 * never add them. (valuation_logic.js keeps its own list: the steward's remote advisor copies only this file.)
 */
const RUN_GATES = ["The Red Pill"]

/** Names of run gates that are rep-ready among `offers` and not yet held, for the plan's priority. */
export function readyGates(offers, owned) {
  const held = new Set(owned)
  return [...new Set(offers.filter((offer) => RUN_GATES.includes(offer.name) && !held.has(offer.name) && offer.rep >= offer.repRequired)
    .map((offer) => offer.name))]
}

/**
 * Rep per $1m donated. The game multiplies by the BitNode's FactionWorkRepGain as well as the player's
 * faction rep multiplier (src/Faction/formulas/donation.ts); `donationRepGain` in player_activity_config.json
 * carries the former, so the 4GB getBitNodeMultipliers call is not needed. Missing means 1.
 */
export function donationRate(repMult, config) {
  const gain = Number(config?.donationRepGain)
  return (Number(repMult) || 0) * (gain > 0 ? gain : 1)
}

/**
 * Faction to buy NeuroFlux from. Every faction but a gang sells it at one rep requirement, so the
 * best seller is a donating one (cash tops up its rep), then the one with the most rep.
 * @param {{faction:string, rep:number}[]} sellers
 */
export function fluxSeller(sellers, donating) {
  return [...sellers].sort((a, b) => Number(donating.includes(b.faction)) - Number(donating.includes(a.faction)) || b.rep - a.rep)[0]?.faction || null
}

/** Money that buys `gap` faction rep: the game gives amount / 1e6 * `repMult` (pass donationRate). */
export function donationFor(gap, repMult) {
  return gap > 0 ? Math.ceil(gap * 1e6 / repMult * 1.001) : 0
}

/**
 * Donations that lift each donating faction to the dearest rep any of its unowned offers needs,
 * while the total stays within `cashShare` of cash. Cheapest factions first.
 * @param {string[]} donating factions whose favor allows donations
 */
export function donationPlan(offers, owned, money, repMult, donating, cashShare = 0.25) {
  const held = new Set(owned)
  // Many augmentations are sold by several factions. One rep-ready anywhere needs no gift, and
  // one sold by several donating factions is bought through the one with the smallest rep gap,
  // so a faction's gift is never sized by a name another faction gets cheaper.
  const ready = new Set(offers.filter((offer) => offer.rep >= offer.repRequired).map((offer) => offer.name))
  const via = new Map()
  for (const offer of offers) {
    if (!donating.includes(offer.faction) || held.has(offer.name) || ready.has(offer.name) || offer.name === NEUROFLUX) continue
    const seen = via.get(offer.name)
    if (!seen || offer.repRequired - offer.rep < seen.repRequired - seen.rep) via.set(offer.name, offer)
  }
  const need = new Map()
  for (const offer of via.values()) {
    const seen = need.get(offer.faction)
    // Cheapest offer the gift would newly unlock: with augmentation prices at x5 (BN10) cash can
    // be the limit, and a donation that leaves nothing affordable only burns cash.
    need.set(offer.faction, { rep: offer.rep, target: Math.max(seen?.target || 0, offer.repRequired), cheapest: Math.min(seen?.cheapest ?? Infinity, offer.price) })
  }
  let budget = money * cashShare
  let cash = money
  const plan = []
  for (const [faction, { rep, target, cheapest }] of [...need].sort((a, b) => (a[1].target - a[1].rep) - (b[1].target - b[1].rep))) {
    const amount = donationFor(target - rep, repMult)
    if (!amount || amount > budget || cash - amount < cheapest) continue
    budget -= amount
    cash -= amount
    plan.push({ faction, amount, rep: target })
  }
  return plan
}
