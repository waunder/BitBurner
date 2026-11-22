import { NEUROFLUX, countFillers, donationFor, donationPlan, donationRate, fluxSeller, nextHomeUpgrade, planPurchases, runRules } from "./aug_install_logic.js"
import { installBlocked } from "./graft_logic.js"

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
  const rules = runRules(ns.getResetInfo(), config)
  // Factions past the favor threshold sell rep for cash, so rep stops limiting their augmentations.
  // The game refuses donations to the gang's own faction; the readiness file names it (no ns.gang RAM here).
  const gangFaction = JSON.parse(ns.read("augmentation_readiness.json") || "{}").gangFaction ?? null
  const donating = player.factions.filter((faction) => faction !== gangFaction && s.getFactionFavor(faction) >= ns.getFavorToDonate())
  const donations = donationPlan(offers, owned, player.money, donationRate(player.mults.faction_rep, rules), donating)
  let money = player.money
  const made = []
  for (const gift of donations) {
    if (!flags.dry && !s.donateToFaction(gift.faction, gift.amount)) continue
    made.push([gift.faction, gift.amount])
    money -= gift.amount
    for (const item of offers) if (item.faction === gift.faction) item.rep = flags.dry ? gift.rep : s.getFactionRep(gift.faction)
  }
  // `planByValue`: with no priorityAugs, buy the readiness plan (chosen by value; this script has no values).
  // An empty result (stale plan, cash moved) falls back to the plain plan.
  const readinessPlan = JSON.parse(ns.read("augmentation_readiness.json") || "{}").installPlan?.names || []
  const priority = config.priorityAugs?.length ? config.priorityAugs : (config.planByValue === true ? readinessPlan : [])
  let { plan } = planPurchases(offers, owned, money, rules.priceStep, priority, { only: config.priorityOnly === true || priority === readinessPlan })
  if (!plan.length && priority === readinessPlan && priority.length) ({ plan } = planPurchases(offers, owned, money, rules.priceStep, [], {}))
  // `countFillersTo` (Daedalus's augmentation count): value-0 augs count too, so cheap ones ride along while short.
  const fillTo = rules.fillersTo
  const fillers = fillTo ? countFillers(offers, owned, plan.map((item) => item.name), money, fillTo, Number(config.countFillerShare) || 0.1, rules.priceStep) : []
  if (fillers.length) ({ plan } = planPurchases(offers, owned, money, rules.priceStep, [...plan.map((item) => item.name), ...fillers], { only: true }))
  const status = { ts: Date.now(), money: player.money, donations: made, plan: plan.map((item) => [item.name, item.faction, item.price]), bought: [], failed: [], neuroflux: 0, fluxDonated: 0, homeRam: 0, homeCores: 0, installed: false }
  if (!flags.dry) {
    for (const item of plan) (s.purchaseAugmentation(item.faction, item.name) ? status.bought : status.failed).push(item.name)
    const sellers = player.factions.filter((faction) => s.getAugmentationsFromFaction(faction).includes(NEUROFLUX))
    const fluxFaction = fluxSeller(sellers.map((faction) => ({ faction, rep: s.getFactionRep(faction) })), donating)
    while (fluxFaction && status.neuroflux < 100) {
      // Each level asks more rep; a donating faction buys the gap when cash covers it and the price.
      const gap = s.getAugmentationRepReq(NEUROFLUX) - s.getFactionRep(fluxFaction)
      const gift = donating.includes(fluxFaction) ? donationFor(gap, donationRate(ns.getPlayer().mults.faction_rep, rules)) : 0
      if (gift && gift + s.getAugmentationPrice(NEUROFLUX) <= ns.getPlayer().money && s.donateToFaction(fluxFaction, gift)) status.fluxDonated += gift
      if (!s.purchaseAugmentation(fluxFaction, NEUROFLUX)) break
      status.neuroflux++
    }
  }
  ns.write("aug_install_status.json", JSON.stringify(status), "w")
  ns.tprint(JSON.stringify(status))
  // Installing cancels a graft in progress with no refund: buy, but refuse to install while one runs.
  let graftStatus = null
  try { graftStatus = JSON.parse(ns.read("graft_status.json") || "null") } catch { graftStatus = null }
  if (flags.install && !flags.dry && installBlocked(graftStatus, Date.now())) {
    status.installRefused = "graft in progress (graft_status.json ownsPlayer); rerun --install after it finishes"
    ns.write("aug_install_status.json", JSON.stringify(status), "w")
    ns.tprint(`aug_install: install refused: ${status.installRefused}`)
    return
  }
  if (flags.install && !flags.dry) {
    for (let upgrades = 0; upgrades < 100; upgrades++) {
      const pick = nextHomeUpgrade(s.getUpgradeHomeRamCost(), s.getUpgradeHomeCoresCost(), ns.getPlayer().money)
      if (!pick || !(pick.kind === "ram" ? s.upgradeHomeRam() : s.upgradeHomeCores())) break
    }
    Object.assign(status, { homeRam: ns.getServerMaxRam("home"), homeCores: ns.getServer("home").cpuCores })
    status.installed = true
    // Install count for this BitNode, read by the HUD's "Goal: BNx Cycle y" line.
    const reset = ns.getResetInfo()
    let counts = null
    try { counts = JSON.parse(ns.read("install_count.json") || "null") } catch { /* rebuilt below */ }
    const installs = counts && Number(counts.run) === Number(reset.lastNodeReset) ? Number(counts.installs) || 0 : 0
    ns.write("install_count.json", JSON.stringify({ run: reset.lastNodeReset, node: reset.currentNode, installs: installs + 1 }), "w")
    ns.write("aug_install_status.json", JSON.stringify(status), "w")
    s.installAugmentations("startup.js")
  }
}
