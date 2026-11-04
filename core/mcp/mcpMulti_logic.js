/**
 * Pure decision logic for mcpMulti.js — how many concurrent targets to run
 * and how to split the worker host pool across them. This does NOT replace
 * mcp_logic.js: everything about what a *good plan looks like for one
 * target* (work-weight sizing, target scoring, stuck/degraded/switch
 * detection, per-host RAM allocation) stays exactly as it is there, and
 * mcpMulti.js imports those functions directly. This file only adds the two
 * things single-target mcp.js never had to answer: how much of the pool one
 * target actually wants, and which hosts go to which target.
 *
 * See docs/hacking-strategy.md and the "single vs multi-target" discussion
 * that motivated this file for the reasoning: mcp.js's `computeTargetScore`
 * already models a target's money-drained fraction saturating as
 * `1 - exp(-growTimeRatio * hackThreads * hackPercentPerThread)` — i.e. past
 * some thread count, more RAM on that one target stops buying meaningfully
 * more $/s. `computeTargetPoolNeed` below solves that same formula for "how
 * many threads until it's basically saturated," instead of leaving all of a
 * large pool parked on one target indefinitely.
 *
 * No `ns` calls anywhere in this file — same node --test-able contract as
 * mcp_logic.js.
 */

/**
 * Pool-thread need for one target, derived from the same balance-point
 * model computeTargetScore (mcp_logic.js) uses — deliberately re-derived
 * here rather than imported, same call computeTargetEffectiveScore's own
 * comment makes: borrowing computeTargetScore with fabricated pool/threshold
 * inputs just to reuse four lines of arithmetic would be more confusing than
 * the small duplication.
 *
 * Solves `1 - exp(-growTimeRatio * hackThreads * hackPercentPerThread) =
 * saturationFraction` for `hackThreads`, then recovers the pool-thread count
 * via `computeTargetScore`'s own `hackThreads = poolThreads *
 * balancedHackShare` relationship.
 *
 * @param {object} args
 * @param {number} args.hackPercentPerThread - p, `ns.hackAnalyze(server)`.
 * @param {number} args.growLogPerThread - k, `Math.LN2/ns.growthAnalyze(server,2)`.
 * @param {number} args.growTimeRatio - weakenPerHackRatio/weakenPerGrowRatio (3.2).
 * @param {number} args.hackSecIncrease
 * @param {number} args.growSecIncrease
 * @param {number} args.weakenSecDecrease
 * @param {number} args.weakenPerHackRatio
 * @param {number} args.weakenPerGrowRatio
 * @param {number} args.saturationFraction - SATURATION_FRACTION, e.g. 0.9.
 *   Outside (0,1) fails open to "unbounded" (Infinity) rather than a
 *   nonsensical number, same fail-open-to-existing-behaviour instinct as
 *   evaluateFormulaSwitchVeto (mcp_logic.js) — a misconfigured value should
 *   make this target absorb the whole pool (today's mcp.js behaviour), not
 *   silently starve it.
 * @returns {{poolThreadsNeeded: number, hackThreadsNeeded: number, balancedHackShare: number}}
 */
export function computeTargetPoolNeed({
  hackPercentPerThread,
  growLogPerThread,
  growTimeRatio,
  hackSecIncrease,
  growSecIncrease,
  weakenSecDecrease,
  weakenPerHackRatio,
  weakenPerGrowRatio,
  saturationFraction,
}) {
  if (!(hackPercentPerThread > 0) || !(growLogPerThread > 0)) {
    return { poolThreadsNeeded: 0, hackThreadsNeeded: 0, balancedHackShare: 0 }
  }
  const growPerHack = (growTimeRatio * hackPercentPerThread) / growLogPerThread
  const weakenPerHackThread = (hackSecIncrease * weakenPerHackRatio) / weakenSecDecrease
  const weakenPerGrowThread = (growSecIncrease * weakenPerGrowRatio) / weakenSecDecrease
  const balancedHackShare = 1 / (1 + weakenPerHackThread + growPerHack * (1 + weakenPerGrowThread))
  if (!(saturationFraction > 0 && saturationFraction < 1)) {
    return { poolThreadsNeeded: Infinity, hackThreadsNeeded: Infinity, balancedHackShare }
  }
  const hackThreadsNeeded = -Math.log(1 - saturationFraction) / (growTimeRatio * hackPercentPerThread)
  const poolThreadsNeeded = hackThreadsNeeded / balancedHackShare
  return { poolThreadsNeeded, hackThreadsNeeded, balancedHackShare }
}

// Treats a missing/NaN need as "never satisfied" (absorbs hosts
// indefinitely, i.e. falls back to today's single-target-style behaviour
// for that candidate) but a genuine 0 (already saturated / at security
// floor with nothing left to do) as immediately satisfied — those are
// different situations and collapsing them would make a fully-grown target
// wrongly hog the whole pool.
function needOf(candidate) {
  return Number.isFinite(candidate.need) ? Math.max(0, candidate.need) : Infinity
}

/**
 * The scheduler: given ranked candidate targets and the worker host pool,
 * greedily assigns whole hosts to the highest-scoring target first, moving
 * to the next target once the current one's `need` (weaken-thread-equivalent
 * units — see the module comment on why grow/weaken RAM cost is
 * interchangeable) is met. Once every target within `maxConcurrentTargets`
 * has what it needs, remaining hosts go back to the single highest scorer
 * rather than wherever the walk happened to stop — extra capacity is worth
 * more on the best target than split further or left idle.
 *
 * Whole-host granularity: a host is never split across two targets' plans,
 * so each assignment's host list can be fed straight into
 * `computeDesiredAllocation` (mcp_logic.js) unmodified, once per target.
 *
 * @param {object} args
 * @param {{server: string, effectiveScore: number, need: number}[]} args.candidates
 *   - `need` is this candidate's pool-thread requirement: the caller passes
 *   its live `requiredWeaken` when mid-weaken, else
 *   `computeTargetPoolNeed(...).poolThreadsNeeded`.
 * @param {{host: string, reclaimableRam: number}[]} args.hosts
 * @param {number} args.maxConcurrentTargets - MAX_CONCURRENT_TARGETS.
 * @param {number} args.weakenRam - GB per weaken/grow thread (identical for
 *   both — see mcp_logic.js's computeTargetScore doc), used to convert a
 *   host's reclaimable RAM into the same thread-count units `need` is in.
 * @returns {{assignments: {target: string, hosts: string[], poolThreadsAssigned: number}[], unassignedHosts: string[]}}
 */
export function partitionHostsAcrossTargets({ candidates, hosts, maxConcurrentTargets, weakenRam }) {
  const sortedHosts = [...hosts].sort(
    (a, b) => b.reclaimableRam - a.reclaimableRam || a.host.localeCompare(b.host)
  )
  const cap = Math.max(1, Math.floor(maxConcurrentTargets) || 1)
  const ranked = [...candidates].sort((a, b) => b.effectiveScore - a.effectiveScore).slice(0, cap)

  if (ranked.length === 0) {
    return { assignments: [], unassignedHosts: sortedHosts.map((h) => h.host) }
  }

  const assignments = ranked.map((c) => ({ target: c.server, hosts: [], poolThreadsAssigned: 0 }))
  let ti = 0
  for (const h of sortedHosts) {
    while (ti < assignments.length - 1 && assignments[ti].poolThreadsAssigned >= needOf(ranked[ti])) {
      ti++
    }
    const currentSatisfied =
      ti === assignments.length - 1 && assignments[ti].poolThreadsAssigned >= needOf(ranked[ti])
    const slot = currentSatisfied ? assignments[0] : assignments[ti]
    slot.hosts.push(h.host)
    slot.poolThreadsAssigned += Math.floor(h.reclaimableRam / weakenRam)
  }

  return { assignments: assignments.filter((a) => a.hosts.length > 0), unassignedHosts: [] }
}
