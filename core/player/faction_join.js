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
// Factions that invite only in certain cities. Travel there once the other requirements are met.
// Tian Di Hui: hacking 50, $1m. Tetrads (bitburner-src FactionInfo.tsx): combat 75 each, karma -18,
// Chongqing, New Tokyo or Ishima; sells cheap combat augmentations.
const CITY_GATED = [
  { faction: "Tian Di Hui", city: "Chongqing", ready: (p) => p.skills.hacking >= 50 && p.money >= 1.5e6 },
  { faction: "Tetrads", city: "Chongqing",
    ready: (p) => ["strength", "defense", "dexterity", "agility"].every((s) => p.skills[s] >= 75) && p.karma <= -18 && p.money >= 2e5 },
]

function seekCityFactions(ns) {
  const player = ns.getPlayer()
  const next = CITY_GATED.find((gate) => !player.factions.includes(gate.faction) && gate.ready(player))
  if (next && player.city !== next.city) ns.singularity.travelToCity(next.city)
}

export async function main(ns) {
  ns.disableLog("ALL")
  const joined = []
  while (true) {
    seekCityFactions(ns)
    const invites = ns.singularity.checkFactionInvitations()
    for (const faction of invites) {
      if (!CITY.has(faction) && ns.singularity.joinFaction(faction)) joined.push({ ts: Date.now(), faction })
    }
    ns.write(STATUS, JSON.stringify({ ts: Date.now(), invites, joined }), "w")
    await ns.sleep(POLL_MS)
  }
}
