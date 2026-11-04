/**
 * Accepts faction invitations so reputation work can start. City factions lock
 * each other out, so those stay for a deliberate choice.
 *
 * Start: run faction_join.js. Writes faction_join_status.json.
 * @param {NS} ns
 */
const CITY = new Set(["Sector-12", "Aevum", "Chongqing", "New Tokyo", "Ishima", "Volhaven"])
const STATUS = "faction_join_status.json"
const POLL_MS = 60_000
// Tian Di Hui sells the cheapest charisma augmentations and only invites in these cities.
const TIAN_DI_HUI = { faction: "Tian Di Hui", city: "Chongqing", hacking: 50, cash: 1.5e6 }

function seekTianDiHui(ns) {
  const player = ns.getPlayer()
  const { faction, city, hacking, cash } = TIAN_DI_HUI
  if (player.factions.includes(faction) || player.city === city) return
  if (player.skills.hacking >= hacking && player.money >= cash) ns.singularity.travelToCity(city)
}

export async function main(ns) {
  ns.disableLog("ALL")
  const joined = []
  while (true) {
    seekTianDiHui(ns)
    const invites = ns.singularity.checkFactionInvitations()
    for (const faction of invites) {
      if (!CITY.has(faction) && ns.singularity.joinFaction(faction)) joined.push({ ts: Date.now(), faction })
    }
    ns.write(STATUS, JSON.stringify({ ts: Date.now(), invites, joined }), "w")
    await ns.sleep(POLL_MS)
  }
}
