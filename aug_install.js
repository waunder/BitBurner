import { NEUROFLUX, planPurchases } from "./aug_install_logic.js"

/** Buys what rep and cash allow, then installs on --install. See docs/processes.md. @param {NS} ns */
export async function main(ns) {
  const flags = ns.flags([["dry", false], ["install", false]])
  const s = ns.singularity
  const player = ns.getPlayer()
  const owned = s.getOwnedAugmentations(true)
  const offers = player.factions.flatMap((faction) => s.getAugmentationsFromFaction(faction).map((name) => ({
    name, faction, rep: s.getFactionRep(faction), repRequired: s.getAugmentationRepReq(name),
    price: s.getAugmentationPrice(name), prerequisites: s.getAugmentationPrereq(name),
  })))
  const { plan } = planPurchases(offers, owned, player.money)
  const status = { ts: Date.now(), money: player.money, plan: plan.map((item) => [item.name, item.faction, item.price]), bought: [], failed: [], neuroflux: 0, installed: false }
  if (!flags.dry) {
    for (const item of plan) (s.purchaseAugmentation(item.faction, item.name) ? status.bought : status.failed).push(item.name)
    const fluxFaction = player.factions.slice().sort((a, b) => s.getFactionRep(b) - s.getFactionRep(a))
      .find((faction) => s.getAugmentationsFromFaction(faction).includes(NEUROFLUX))
    while (fluxFaction && status.neuroflux < 100 && s.purchaseAugmentation(fluxFaction, NEUROFLUX)) status.neuroflux++
  }
  ns.write("aug_install_status.json", JSON.stringify(status), "w")
  ns.tprint(JSON.stringify(status))
  if (flags.install && !flags.dry) {
    status.installed = true
    ns.write("aug_install_status.json", JSON.stringify(status), "w")
    s.installAugmentations("startup.js")
  }
}
