/**
 * Low-frequency, read-only augmentation runway assessment.
 *
 * It records only facts exposed by the live Singularity API: owned and
 * purchased augmentations, current faction reputation, and prerequisite-ready
 * faction offerings.  It never buys, installs, starts faction work, or
 * changes player activity.  The HUDs consume the resulting JSON so their
 * ordinary refresh costs no Singularity calls.
 *
 * Start: automatic with MCP/startup, or `run augmentation_readiness.js`.
 * @param {NS} ns
 */

const STATUS = "augmentation_readiness.json"
const POLL_MS = 120_000

function writeStatus(ns, status) {
  ns.write(STATUS, JSON.stringify(status, null, 2), "w")
}

function resetAt(ns) {
  try {
    const value = Number(ns.getResetInfo?.().lastAugReset)
    return Number.isFinite(value) && value > 0 ? value : null
  } catch { return null }
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b))
}

function assess(ns) {
  const now = Date.now()
  const player = ns.getPlayer()
  const singularity = ns.singularity
  if (!singularity || typeof singularity.getOwnedAugmentations !== "function") {
    return { ts: now, ok: false, reason: "Singularity augmentation API unavailable", resetAt: resetAt(ns) }
  }

  try {
    const installed = unique(singularity.getOwnedAugmentations(false) || [])
    const includingQueued = unique(singularity.getOwnedAugmentations(true) || [])
    const owned = new Set(includingQueued)
    const queued = includingQueued.filter((name) => !installed.includes(name))
    const factions = Array.isArray(player?.factions) ? player.factions : []
    const candidates = []
    for (const faction of factions) {
      const rep = Number(singularity.getFactionRep(faction)) || 0
      for (const name of singularity.getAugmentationsFromFaction(faction) || []) {
        if (owned.has(name) || name === "NeuroFlux Governor") continue
        const prerequisites = singularity.getAugmentationPrereq(name) || []
        if (!prerequisites.every((prereq) => owned.has(prereq))) continue
        const repRequired = Number(singularity.getAugmentationRepReq(name)) || 0
        const price = Number(singularity.getAugmentationPrice(name)) || 0
        candidates.push({
          name, faction, rep, repRequired, repGap: Math.max(0, repRequired - rep),
          price, cashReady: Number(player?.money) >= price, prerequisites,
        })
      }
    }
    // A smallest positive reputation gap is the next concrete faction-work
    // target. Ties favour an affordable item, then lower price/name, making
    // the output deterministic without pretending it is an augmentation tier
    // ranking.
    candidates.sort((a, b) =>
      (a.repGap > 0 ? 0 : 1) - (b.repGap > 0 ? 0 : 1) ||
      a.repGap - b.repGap || Number(b.cashReady) - Number(a.cashReady) ||
      a.price - b.price || a.name.localeCompare(b.name) || a.faction.localeCompare(b.faction))
    const candidate = candidates[0] || null
    return {
      ts: now, ok: true, resetAt: resetAt(ns), money: Number(player?.money) || 0,
      installedCount: installed.length, queuedCount: queued.length, queued,
      factionCount: factions.length, candidate,
      candidatesConsidered: candidates.length,
    }
  } catch (error) {
    return { ts: now, ok: false, reason: String(error?.message || error), resetAt: resetAt(ns) }
  }
}

export async function main(ns) {
  ns.disableLog("ALL")
  // Leave an immediate, durable launch marker.  It distinguishes inability to
  // allocate this optional observer from a later live-API assessment error.
  writeStatus(ns, { ts: Date.now(), ok: false, starting: true, resetAt: resetAt(ns) })
  while (true) {
    writeStatus(ns, assess(ns))
    await ns.sleep(POLL_MS)
  }
}
