/**
 * Purchase order for an install. Prices rise after every buy, so the dearest go
 * first; a prerequisite is bought before anything that needs it.
 * @param {{name:string,faction:string,rep:number,repRequired:number,price:number,prerequisites:string[]}[]} offers
 * @param {string[]} owned
 */
export function planPurchases(offers, owned, money, priceStep = 1.9) {
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
  for (let next = ready(); next.length; next = ready()) {
    const pick = next.find((offer) => offer.price * scale <= left)
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
