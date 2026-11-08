import { NEUROFLUX, donationFor, donationPlan, fluxSeller, nextHomeUpgrade, planPurchases } from "./aug_install_logic.js"

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
  const config = JSON.parse(ns.read("player_activity_config.json") || "{}")
  // Factions past the favor threshold sell rep for cash, so rep stops limiting their augmentations.
  // The game refuses donations to the gang's own faction; the readiness file names it (no ns.gang RAM here).
  const gangFaction = JSON.parse(ns.read("augmentation_readiness.json") || "{}").gangFaction ?? null
  const donating = player.factions.filter((faction) => faction !== gangFaction && s.getFactionFavor(faction) >= ns.getFavorToDonate())
  const donations = donationPlan(offers, owned, player.money, player.mults.faction_rep, donating)
  let money = player.money
  const made = []
  for (const gift of donations) {
    if (!flags.dry && !s.donateToFaction(gift.faction, gift.amount)) continue
    made.push([gift.faction, gift.amount])
    money -= gift.amount
    for (const item of offers) if (item.faction === gift.faction) item.rep = flags.dry ? gift.rep : s.getFactionRep(gift.faction)
  }
  const { plan } = planPurchases(offers, owned, money, 1.9, config.priorityAugs || [])
  const status = { ts: Date.now(), money: player.money, donations: made, plan: plan.map((item) => [item.name, item.faction, item.price]), bought: [], failed: [], neuroflux: 0, fluxDonated: 0, homeRam: 0, homeCores: 0, installed: false }
  if (!flags.dry) {
    for (const item of plan) (s.purchaseAugmentation(item.faction, item.name) ? status.bought : status.failed).push(item.name)
    const sellers = player.factions.filter((faction) => s.getAugmentationsFromFaction(faction).includes(NEUROFLUX))
    const fluxFaction = fluxSeller(sellers.map((faction) => ({ faction, rep: s.getFactionRep(faction) })), donating)
    while (fluxFaction && status.neuroflux < 100) {
      // Each level asks more rep; a donating faction buys the gap when cash covers it and the price.
      const gap = s.getAugmentationRepReq(NEUROFLUX) - s.getFactionRep(fluxFaction)
      const gift = donating.includes(fluxFaction) ? donationFor(gap, ns.getPlayer().mults.faction_rep) : 0
      if (gift && gift + s.getAugmentationPrice(NEUROFLUX) <= ns.getPlayer().money && s.donateToFaction(fluxFaction, gift)) status.fluxDonated += gift
      if (!s.purchaseAugmentation(fluxFaction, NEUROFLUX)) break
      status.neuroflux++
    }
  }
  ns.write("aug_install_status.json", JSON.stringify(status), "w")
  ns.tprint(JSON.stringify(status))
  if (flags.install && !flags.dry) {
    for (let upgrades = 0; upgrades < 100; upgrades++) {
      const pick = nextHomeUpgrade(s.getUpgradeHomeRamCost(), s.getUpgradeHomeCoresCost(), ns.getPlayer().money)
      if (!pick || !(pick.kind === "ram" ? s.upgradeHomeRam() : s.upgradeHomeCores())) break
    }
    Object.assign(status, { homeRam: ns.getServerMaxRam("home"), homeCores: ns.getServer("home").cpuCores })
    status.installed = true
    ns.write("aug_install_status.json", JSON.stringify(status), "w")
    s.installAugmentations("startup.js")
  }
}
