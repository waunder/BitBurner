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
    ready: (p) => combat(p, 75) && p.karma <= -18 && p.money >= 2e5 },
  // The Syndicate: Aevum or Sector-12, hacking 200, combat 200 each, karma -90, $10m. The Dark Army: Chongqing,
  // hacking 300, combat 300 each, 5 kills, karma -45. Both sell combat augmentations toward the Covenant's 850.
  { faction: "The Syndicate", city: "Sector-12",
    ready: (p) => p.skills.hacking >= 200 && combat(p, 200) && p.karma <= -90 && p.money >= 1.1e7 },
  { faction: "The Dark Army", city: "Chongqing",
    ready: (p) => p.skills.hacking >= 300 && combat(p, 300) && p.numPeopleKilled >= 5 && p.karma <= -45 },
]

function combat(p, level) {
  return ["strength", "defense", "dexterity", "agility"].every((s) => p.skills[s] >= level)
}

// The Dark Army needs 5 kills and Speakers for the Dead 30, and an install resets the kill count. Once the other
// gates are met, start Homicide (unfocused, ~3s per kill at combat 300+); the player controller takes the player
// back to its own work at its next poll, and this repeats each minute until 30 kills (added 2026-11-14).
const KILL_GATED = ["The Dark Army", "Speakers for the Dead"]
const KILLS_WANTED = 30

function seekKills(ns, player) {
  if (player.numPeopleKilled >= KILLS_WANTED || KILL_GATED.every((f) => player.factions.includes(f))) return false
  if (!(player.skills.hacking >= 300 && combat(player, 300) && player.karma <= -45)) return false
  if (ns.singularity.getCurrentWork()?.type === "CRIME") return false
  return ns.singularity.commitCrime("Homicide", false) > 0
}

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
    const killing = seekKills(ns, ns.getPlayer())
    const invites = ns.singularity.checkFactionInvitations()
    for (const faction of invites) {
      if (!CITY.has(faction) && ns.singularity.joinFaction(faction)) joined.push({ ts: Date.now(), faction })
    }
    ns.write(STATUS, JSON.stringify({ ts: Date.now(), invites, joined, killing }), "w")
    await ns.sleep(POLL_MS)
  }
}
