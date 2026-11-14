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

import { planPurchases } from "./aug_install_logic.js"
import { DEFAULT_WEIGHTS, augValue, bestRepRate, factionRepRates, gangRepPerHour, installAdvice, multFactorNeeded, withDonations } from "./install_advisor_logic.js"

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

// Shadow-mode install advice (install_advisor_logic.js). `previous` is the last
// status, read before this run overwrites it, so rep and exp rates come from two samples.
function advise(ns, { now, player, previous, factionRep, queued, plan, candidates, gangFaction = null }) {
  let weights = DEFAULT_WEIGHTS
  try { weights = JSON.parse(ns.read("run_target.json") || "{}").augWeights || DEFAULT_WEIGHTS } catch {}
  const statsCache = new Map()
  const value = (name) => {
    if (!statsCache.has(name)) statsCache.set(name, augValue(ns.singularity.getAugmentationStats(name), weights))
    return statsCache.get(name)
  }
  // The player controller ranks rep targets by this value per rep (player_activity_logic.js).
  for (const item of candidates) item.value = value(item.name)
  const inBatch = new Set([...queued, ...plan.map((item) => item.name)])
  const batch = [...inBatch].map((name) => ({ name, value: value(name) }))
  // Many augmentations are sold by several factions, so advice is per name: rep-ready at any
  // faction means no wait; sold by any donating faction means cash buys its rep (`donatable`,
  // never a work target, as in player_activity_logic.js); otherwise the smallest workable gap.
  const ready = new Set(candidates.filter((item) => item.repGap <= 0).map((item) => item.name))
  const gaps = new Map()
  for (const item of candidates) {
    if (inBatch.has(item.name) || ready.has(item.name) || !item.canWorkForRep) continue
    const seen = gaps.get(item.name)
    const donatable = Boolean(item.donatable)
    if (!seen || (donatable && !seen.donatable) || (seen.donatable === donatable && item.repGap < seen.repGap)) {
      gaps.set(item.name, { repGap: item.repGap, donatable, faction: item.faction })
    }
  }
  const sampleHours = previous?.ok && previous.ts > 0 ? (now - previous.ts) / 3_600_000 : 0
  const repPerHour = bestRepRate(previous?.factionRep, factionRep, sampleHours)
  const rates = factionRepRates(previous?.factionRep, factionRep, sampleHours)
  const reset = resetAt(ns)
  // Gang tier: gang-faction gaps are timed by the gang's measured rate (gang_status.json).
  let gangStatus = null
  try { gangStatus = JSON.parse(ns.read("gang_status.json") || "null") } catch {}
  const gangRate = gangFaction ? gangRepPerHour(gangStatus) : null
  const gangGaps = new Map()
  if (gangFaction) {
    for (const item of candidates) {
      if (item.faction !== gangFaction || inBatch.has(item.name) || ready.has(item.name) || item.repGap <= 0) continue
      const seen = gangGaps.get(item.name)
      if (!seen || item.repGap < seen.repGap) gangGaps.set(item.name, { name: item.name, repGap: item.repGap, price: item.price, value: value(item.name) })
    }
  }
  // Cash rate: gang-controller.js measures it (capital.observedCashRate, $/s); a money delta here would be
  // corrupted by spending. Without a fresh gang status, affordability falls back to money only.
  const cashRate = Number(gangStatus?.capital?.observedCashRate)
  const cashFresh = Number(gangStatus?.ts) > now - 10 * 60_000
  const cashPerHour = cashFresh && Number.isFinite(cashRate) && cashRate > 0 ? cashRate * 3600 : null
  const advice = installAdvice({
    batch, cycleHours: reset ? (now - reset) / 3_600_000 : 0, repPerHour,
    candidates: [...gaps].map(([name, { repGap, donatable, faction }]) => ({ name, repGap, donatable, value: value(name), repPerHour: rates[faction] || null })),
    gang: gangFaction ? { rate: gangRate, candidates: [...gangGaps.values()] } : null,
    money: Number(player?.money) || 0, cashPerHour,
  })
  // Hacking exp rate only between samples within one cycle (an install resets exp).
  const prevExp = Number(previous?.hackingExp)
  const hackExpPerHour = sampleHours > 0 && previous?.resetAt === reset && player.exp.hacking > prevExp
    ? (player.exp.hacking - prevExp) / sampleHours : null
  const covenant = hackExpPerHour ? multFactorNeeded({
    level: player.skills.hacking, exp: player.exp.hacking, target: 850, expPerHour: hackExpPerHour, cycleHours: 24,
  }) : null
  return { ...advice, weightsFrom: weights === DEFAULT_WEIGHTS ? "default" : "run_target.json", hackExpPerHour, covenantHackingFactor24h: covenant }
}

function assess(ns, previous = null) {
  const now = Date.now()
  const player = ns.getPlayer()
  // Keep calls directly qualified. Netscript's static RAM analyser charges
  // the entire Singularity namespace if it is assigned to an alias, whereas
  // direct members are charged individually.
  if (!ns.singularity || typeof ns.singularity.getOwnedAugmentations !== "function") {
    return { ts: now, ok: false, reason: "Singularity augmentation API unavailable", resetAt: resetAt(ns) }
  }

  try {
    const installed = unique(ns.singularity.getOwnedAugmentations(false) || [])
    const includingQueued = unique(ns.singularity.getOwnedAugmentations(true) || [])
    const owned = new Set(includingQueued)
    const queued = includingQueued.filter((name) => !installed.includes(name))
    const factions = Array.isArray(player?.factions) ? player.factions : []
    let gangFaction = null
    try { if (ns.gang.inGang()) gangFaction = ns.gang.getGangInformation().faction } catch {}
    const candidates = []
    let gangRepNeeded = 0 // most rep any unowned gang-faction aug needs; the gang's "auto" objective reads it
    for (const faction of factions) {
      const rep = Number(ns.singularity.getFactionRep(faction)) || 0
      for (const name of ns.singularity.getAugmentationsFromFaction(faction) || []) {
        if (owned.has(name) || name === "NeuroFlux Governor") continue
        const repRequired = Number(ns.singularity.getAugmentationRepReq(name)) || 0
        // Before the prerequisite filter: a locked aug still needs its rep in a later cycle.
        if (faction === gangFaction) gangRepNeeded = Math.max(gangRepNeeded, repRequired)
        const prerequisites = ns.singularity.getAugmentationPrereq(name) || []
        if (!prerequisites.every((prereq) => owned.has(prereq))) continue
        const price = Number(ns.singularity.getAugmentationPrice(name)) || 0
        candidates.push({
          name, faction, rep, repRequired, repGap: Math.max(0, repRequired - rep),
          price, cashReady: Number(player?.money) >= price, prerequisites,
          canWorkForRep: faction !== gangFaction,
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
    const factionRep = Object.fromEntries(factions.map((faction) => [faction, Number(ns.singularity.getFactionRep(faction)) || 0]))
    // Favor now and what an install would add; the player controller's favor push reads it.
    const favor = Object.fromEntries(factions.map((faction) => [faction, {
      favor: Number(ns.singularity.getFactionFavor(faction)) || 0, gain: Number(ns.singularity.getFactionFavorGain(faction)) || 0,
    }]))
    const favorToDonate = Number(ns.getFavorToDonate()) || 150
    // At favor 150 rep is bought with cash (aug_install.js donates first), so plan and advise on
    // the candidates as they stand after those donations. A gang faction takes no donations.
    const donating = factions.filter((faction) => faction !== gangFaction && favor[faction].favor >= favorToDonate)
    // What `aug_install.js` would buy right now, before NeuroFlux and home upgrades.
    let priority = []
    let priorityOnly = false
    try {
      const activity = JSON.parse(ns.read("player_activity_config.json") || "{}")
      priority = activity.priorityAugs || []
      priorityOnly = activity.priorityOnly === true
    } catch {}
    const money = Number(player?.money) || 0
    const donated = withDonations(candidates, { money, repMult: Number(player?.mults?.faction_rep) || 0, donating, owned: includingQueued })
    const { plan, left } = planPurchases(donated.candidates, includingQueued, donated.left, 1.9, priority, { only: priorityOnly })
    const installPlan = {
      names: plan.map((item) => item.name), cost: money - left,
      factions: [...new Set(plan.map((item) => item.faction))],
      donations: donated.gifts.map((gift) => [gift.faction, gift.amount]),
    }
    let advice
    try { advice = advise(ns, { now, player, previous, factionRep, queued, plan, candidates: donated.candidates, gangFaction }) } catch (error) { advice = { verdict: "error", reason: String(error?.message || error) } }
    // After advise(), which sets each one's value. Donatable ones stay listed, marked, so the
    // player controller can see them and skip them.
    const workCandidates = donated.candidates.filter((item) => item.canWorkForRep)
    // Names the gang faction sells that we neither own nor have queued: its rep is the gang's, so
    // player and sleeve work must not chase them (workCandidates drops those rows).
    const gangSells = gangFaction ? unique(candidates.filter((item) => item.faction === gangFaction).map((item) => item.name)) : []
    const gangRep = gangFaction ? factionRep[gangFaction] ?? null : null
    const workCandidate = workCandidates.find((item) => !item.donatable) || null
    // Every prerequisite-ready offer with its value, as planPurchases takes them, for allocator.js's
    // batch valuation (valuation_logic.js). No extra Singularity calls: all were read above.
    const offers = donated.candidates.map(({ name, faction, rep, repRequired, price, prerequisites, value, donatable }) =>
      ({ name, faction, rep, repRequired, price, prerequisites, value: Number(value) || 0, donatable: Boolean(donatable) }))
    return {
      offers, owned: includingQueued, priority,
      ts: now, ok: true, resetAt: resetAt(ns), money, factionRep, favor, favorToDonate, hackingExp: Number(player?.exp?.hacking) || 0, advice,
      installedCount: installed.length, queuedCount: queued.length, queued, installPlan,
      factionCount: factions.length, candidate, workCandidate, workCandidates, donating,
      gangFaction, gangSells, gangRep, gangRepNeeded: gangFaction ? gangRepNeeded : null, candidatesConsidered: candidates.length,
    }
  } catch (error) {
    return { ts: now, ok: false, reason: String(error?.message || error), resetAt: resetAt(ns) }
  }
}

export async function main(ns) {
  ns.disableLog("ALL")
  // Leave an immediate, durable launch marker.  It distinguishes inability to
  // allocate this optional observer from a later live-API assessment error.
  let previous = null
  try { previous = JSON.parse(ns.read(STATUS)) } catch { /* first run */ }
  writeStatus(ns, { ts: Date.now(), ok: false, starting: true, resetAt: resetAt(ns) })
  if (ns.args.some((arg) => String(arg) === "--once")) {
    writeStatus(ns, assess(ns, previous))
    return
  }
  while (true) {
    previous = assess(ns, previous)
    writeStatus(ns, previous)
    await ns.sleep(POLL_MS)
  }
}
