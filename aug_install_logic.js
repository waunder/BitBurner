/**
 * Purchase order for an install. Prices rise after every buy, so the dearest go
 * first; a prerequisite is bought before anything that needs it. Each pick must
 * leave enough to buy the rep-ready `priority` names afterwards, so they are never squeezed out.
 * @param {{name:string,faction:string,rep:number,repRequired:number,price:number,prerequisites:string[]}[]} offers
 * @param {string[]} owned
 * @param {string[]} priority
 */
export function planPurchases(offers, owned, money, priceStep = 1.9, priority = []) {
  const best = new Map()
  for (const offer of offers) {
    if (offer.rep < offer.repRequired || offer.name === NEUROFLUX) continue
    const seen = best.get(offer.name)
    if (!seen || offer.rep > seen.rep) best.set(offer.name, offer)
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
    const pick = next.find((offer) => offer.price * scale + reserveFor(offer) <= left)
    if (!pick) break
    left -= pick.price * scale
    scale *= priceStep
    held.add(pick.name)
    plan.push(pick)
  }
  return { plan, left }
}

/** Home RAM and cores survive an install, so leftover cash goes on the cheaper of the two. */
export function nextHomeUpgrade(ramCost, coreCost, money) {
  const pick = coreCost < ramCost ? { kind: "cores", cost: coreCost } : { kind: "ram", cost: ramCost }
  return pick.cost <= money ? pick : null
}

export const NEUROFLUX = "NeuroFlux Governor"
