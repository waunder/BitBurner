/**
 * Pure decision logic extracted from mcp.js: target-eviction predicates,
 * opportunity-switch comparison, work-weight bucket selection, and the
 * tick-invariant checks. Nothing here calls `ns.*` or has a side effect —
 * every export takes plain data in and returns plain data out, which is what
 * makes it testable with `node --test mcp_logic.test.js` in milliseconds,
 * with no game round trip.
 *
 * Why this exists: diagnosing the `moneyDegraded`/XP-mode eviction bug
 * (commit 81814d6) required three live restarts and watching the game over
 * CDP for 4-5 minutes each time, to observe a decision that is actually a
 * pure function of a handful of numbers. mcp.js still owns all `ns` calls
 * and all mutation (currentTarget, moneyPctSamples, etc.); this module owns
 * only the "given these inputs, what's the decision" logic, imported back
 * into mcp.js the same way dnet_deploy.js imports dnet_lib.js.
 *
 * Behavioral equivalence with the pre-extraction inline code is the goal,
 * not elegance — mcp.js runs live in-game for real money/XP, so every
 * function here was copied out verbatim (parameterizing only the config
 * values that used to be read off module-level `let`s) rather than
 * rewritten. If a helper here disagrees with what shipped in 81814d6, the
 * helper is wrong.
 */

// Security readings accumulate floating-point noise over many hack/grow/
// weaken calls, so a target sitting exactly at its floor can read as e.g.
// 9.000000000000002 instead of 9. Shared with mcp.js's own
// getTargetWeakenThreads so there is one definition, not two that could
// drift apart.
export const SECURITY_EPSILON = 1e-6

// Named tiers instead of raw weight objects so a redeploy can be triggered
// specifically when moneyPct crosses into a different tier, rather than on
// every loop tick (which would defeat the whole point of not re-execing
// long-running hack/grow threads constantly).
export const WORK_WEIGHTS_BY_BUCKET = {
  goal: { grow: 0.25, hack: 0.75 },
  high: { grow: 0.4, hack: 0.6 },
  mid: { grow: 0.55, hack: 0.45 },
  low: { grow: 0.7, hack: 0.3 },
  // Hacking a near-empty server steals close to nothing (hack take scales
  // with *available* money) while still adding security load that has to be
  // weakened back off — pure waste. Go all-in on recovery instead.
  empty: { grow: 1, hack: 0 },
}

export const BUCKET_ORDER = ["empty", "low", "mid", "high", "goal"]

export function bucketForMoneyPct(moneyPct, targetMoneyGoal) {
  if (moneyPct >= targetMoneyGoal) return "goal"
  if (moneyPct >= 0.92) return "high"
  if (moneyPct >= 0.85) return "mid"
  if (moneyPct >= 0.1) return "low"
  return "empty"
}

/**
 * The empty/low boundary (0.1) was observed live oscillating every 2-3
 * minutes for the entire time a target sat near it: "empty" is grow:1/hack:0,
 * which recovers money fast and crosses the boundary upward into "low";
 * "low" immediately reintroduces hack, which drains it straight back down.
 * 350 of 1373 work-plan log lines in one session (25%) were this single
 * flip. It isn't cosmetic — a bucket change forces forceRebalance, which
 * kills and redeploys every host's action scripts.
 *
 * Require moneyPct to clear the boundary by `bucketHysteresis`, not merely
 * touch it, before the bucket actually changes. Only resists single-step
 * transitions — a jump of more than one tier (e.g. a huge one-tick swing, or
 * a freshly adopted target where previousBucket is null) is accepted
 * immediately rather than fought.
 */
export function getWorkWeightBucket(moneyPct, previousBucket, targetMoneyGoal, bucketHysteresis) {
  const raw = bucketForMoneyPct(moneyPct, targetMoneyGoal)
  if (!previousBucket || previousBucket === raw) return raw

  const prevIdx = BUCKET_ORDER.indexOf(previousBucket)
  const rawIdx = BUCKET_ORDER.indexOf(raw)
  if (prevIdx < 0 || Math.abs(rawIdx - prevIdx) !== 1) return raw

  const movingUp = rawIdx > prevIdx
  const resisted = bucketForMoneyPct(
    movingUp ? moneyPct - bucketHysteresis : moneyPct + bucketHysteresis,
    targetMoneyGoal
  )
  return resisted === previousBucket ? previousBucket : raw
}

/**
 * The work-weight selection half of buildPlan (everything after "does this
 * target need a weaken phase" has already been decided). XP mode ignores
 * moneyPct entirely and uses a single fixed split — see OBJECTIVE's comment
 * in mcp.js for why — money mode runs the bucket table above.
 *
 * @returns {{weightBucket: string, weights: {hack: number, grow: number}}}
 */
export function selectWorkWeights({
  objective,
  moneyPct,
  previousWeightBucket,
  targetMoneyGoal,
  bucketHysteresis,
  xpWeightHack,
  xpWeightGrow,
}) {
  if (objective === "xp") {
    return { weightBucket: "xp", weights: { hack: xpWeightHack, grow: xpWeightGrow } }
  }
  const weightBucket = getWorkWeightBucket(moneyPct, previousWeightBucket, targetMoneyGoal, bucketHysteresis)
  return { weightBucket, weights: WORK_WEIGHTS_BY_BUCKET[weightBucket] }
}

/**
 * The eviction predicate at the center of commit 81814d6. `moneyDegraded`
 * must be unconditionally false in XP mode: XP mode's fixed hack-heavy split
 * drains every target's money toward zero by design and never lets it
 * recover, so without the OBJECTIVE gate this fires on essentially every
 * target in an endless chain (confirmed live 2026-08-09: three evictions in
 * under a minute) — exactly defeating XP mode's point of sitting still and
 * grinding hack XP.
 *
 * @returns {{avgMoneyPct: number, windowFull: boolean, declining: boolean, moneyDegraded: boolean}}
 */
export function evaluateMoneyDegradation({ objective, moneyPctSamples, sampleTarget, degradedThreshold }) {
  const windowFull = moneyPctSamples.length === sampleTarget
  const avgMoneyPct =
    moneyPctSamples.length > 0 ? moneyPctSamples.reduce((sum, value) => sum + value, 0) / moneyPctSamples.length : 0
  // Requires an actual *decline*, not merely absence of improvement — a
  // target mid-recovery is legitimately low but climbing, and abandoning it
  // there strands it at ~0 with no grow threads for the whole skip window.
  const declining = windowFull && moneyPctSamples[moneyPctSamples.length - 1] < moneyPctSamples[0]
  const moneyDegraded = objective !== "xp" && windowFull && avgMoneyPct < degradedThreshold && declining
  return { avgMoneyPct, windowFull, declining, moneyDegraded }
}

/**
 * The opportunity-switch comparison: given a scored candidate list and the
 * current target's own score, decide whether a switch is both earned (score
 * ratio clears `factor`) and allowed (hold timer elapsed). Score computation
 * itself (getTargetScore/getTargetEffectiveScore, which call `ns`) stays in
 * mcp.js — this only compares numbers that have already been measured.
 *
 * @param {object} args
 * @param {boolean} args.idle - true when the current target is in the
 *   "empty" bucket (compare readiness-discounted scores); false when
 *   productive (compare raw potential).
 * @param {{server: string, score: number}[]} args.candidates - every ranked
 *   target's score, already measured with the same basis as currentScore.
 * @param {string} args.currentTarget
 * @param {number} args.currentScore
 * @param {number} args.heldMs - time since the current target was adopted.
 * @param {number} args.holdMs - minimum hold before a switch is considered.
 * @param {number} args.factor - OPPORTUNITY_SWITCH_FACTOR.
 */
export function evaluateOpportunitySwitch({ idle, candidates, currentTarget, currentScore, heldMs, holdMs, factor }) {
  const committed = heldMs >= holdMs
  let best = null
  for (const candidate of candidates) {
    if (!best || candidate.score > best.score) best = { server: candidate.server, score: candidate.score }
  }
  const ratio = best ? best.score / Math.max(currentScore, 1e-9) : 0
  const outbid = !!best && best.server !== currentTarget && best.score > currentScore * factor

  return {
    basis: idle ? "effective" : "potential",
    currentScore,
    best: best ? best.server : null,
    bestScore: best ? best.score : 0,
    ratio,
    factor,
    heldSeconds: Math.floor(heldMs / 1000),
    holdSeconds: Math.floor(holdMs / 1000),
    committed,
    outbid,
    // What is actually preventing a switch right now, so the HUD can say so
    // in one word instead of making it inferable from four numbers.
    blockedBy: outbid ? (committed ? null : "hold") : "score",
  }
}

// Security added per action thread, expressed in weaken-threads needed to
// cancel it. See weakenPerHackRatio/weakenPerGrowRatio: worker scripts loop,
// so the relevant comparison is security-per-unit-time, not
// security-per-call — moved here from mcp.js 2026-08-13 (R3, see
// computeDesiredAllocation below) alongside its only callers, parameterized
// on the constants that used to be read off mcp.js's module-level `const`s
// directly.
export function weakenThreadsToOffset(
  hackThreads,
  growThreads,
  { hackSecIncrease, growSecIncrease, weakenSecDecrease, weakenPerHackRatio, weakenPerGrowRatio }
) {
  return Math.ceil(
    (hackThreads * hackSecIncrease * weakenPerHackRatio + growThreads * growSecIncrease * weakenPerGrowRatio) /
      weakenSecDecrease
  )
}

/**
 * Pass 1 of the two-pass allocation R3 replaced `allocateThreads`'s old
 * single-pass, per-host-only logic with (2026-08-13, hacking-strategy.md
 * R3). Computes every host's *desired* thread allocation from its
 * reclaimable RAM (free RAM plus whatever our own scripts already hold
 * there — mcp.js's `getHostReclaimableRam`), independent of what is
 * actually currently running, so "desired" is a stable function of current
 * security/RAM state rather than ratcheting based on a prior tick's
 * allocation decision.
 *
 * The per-host formulas are copied verbatim from the old inline
 * `allocateThreads` (same weaken/grow math for a "weaken" plan, same
 * hack/grow/weaken-for-maintenance math for a "work" plan) — the only
 * change is that this now runs for *every* host up front, in the fixed
 * order `hosts` is given, rather than only for whichever host
 * `hostNeedsRedeploy` happened to already be redeploying that tick. That
 * ordering is what fixes `weakenBudgetNonNegative`: the shared weaken
 * budget is drawn down against the network's *freshly computed* desired
 * total every tick, not inflated by already-running threads that were
 * sized for a stale, higher security reading from an earlier tick — see
 * hacking-strategy.md's R3 for the live numbers (172 weaken threads running
 * against a `needWeaken` of 75).
 *
 * @param {object} args
 * @param {{host: string, reclaimableRam: number}[]} args.hosts - in the
 *   fixed order the shared weaken budget (for a "weaken" plan) is drawn
 *   down against.
 * @param {{type: string, weights?: {hack: number, grow: number}}} args.plan
 * @param {number} args.weakenBudget - total weaken threads needed
 *   network-wide this tick. Only meaningful when `plan.type === "weaken"`;
 *   ignored for "work" plans, where each host's own maintenance weaken only
 *   offsets that same host's own hack/grow security contribution and needs
 *   no cross-host sharing.
 * @param {{hackRam: number, growRam: number, weakenRam: number, minRam: number}} args.ramInfo
 * @param {{hackSecIncrease: number, growSecIncrease: number, weakenSecDecrease: number, weakenPerHackRatio: number, weakenPerGrowRatio: number}} args.securityConstants
 * @returns {{allocations: {host: string, hack: number, grow: number, weaken: number}[], weakenBudgetRemaining: number}}
 *   `allocations` is in the same order as `args.hosts`. `weakenBudgetRemaining`
 *   is what's left of `args.weakenBudget` after only the *primary* per-host
 *   draw (`Math.min(hostMaxWeaken, remaining)`) — deliberately **not**
 *   reduced by the grow-security-offset addition below, matching exactly
 *   what the pre-R3 code tracked (see the old `weakenBudget.remaining -=
 *   weakenThreads` line, which ran before that addition existed). The
 *   offset addition is a separate, self-justifying expense — RAM a host
 *   already isn't contributing to the shared need, spent cancelling its own
 *   grow threads' security cost — not a second draw against the same
 *   budget. Conflating the two would make this assertion fire on every
 *   tick a grow offset is nonzero, which is normal and not a bug.
 */
export function computeDesiredAllocation({ hosts, plan, weakenBudget, ramInfo, securityConstants }) {
  const allocations = []
  let remaining = weakenBudget

  for (const { host, reclaimableRam } of hosts) {
    if (plan.type === "weaken") {
      const hostMaxWeaken = Math.floor(reclaimableRam / ramInfo.weakenRam)
      let weaken = Math.max(0, Math.min(hostMaxWeaken, remaining))
      remaining -= weaken
      // Whatever this host isn't contributing to the (network-wide, capped)
      // weaken need would otherwise sit idle for the whole weaken phase —
      // often the large majority of the network. Grow is always useful and
      // doesn't require the target to be at its security floor first.
      const leftoverRam = reclaimableRam - weaken * ramInfo.weakenRam
      let grow = Math.floor(leftoverRam / ramInfo.growRam)
      // Growing adds security too, so it has to pay for its own offset out
      // of the same leftover rather than undermining the weaken it runs
      // beside.
      const growOffset = weakenThreadsToOffset(0, grow, securityConstants)
      if (growOffset > 0) {
        const reserveRam = growOffset * ramInfo.weakenRam
        grow = Math.max(0, Math.floor((leftoverRam - reserveRam) / ramInfo.growRam))
        weaken += weakenThreadsToOffset(0, grow, securityConstants)
      }
      allocations.push({ host, hack: 0, grow, weaken })
      continue
    }

    const weights = plan.weights
    const maxWeakenThreads = Math.floor(reclaimableRam / ramInfo.weakenRam)
    const provisionalHack = Math.floor((reclaimableRam * weights.hack) / ramInfo.hackRam)
    const provisionalGrow = Math.floor((reclaimableRam - provisionalHack * ramInfo.hackRam) / ramInfo.growRam)
    const maintenanceThreads = weakenThreadsToOffset(provisionalHack, provisionalGrow, securityConstants)

    let weaken, hack, grow
    if (maintenanceThreads >= maxWeakenThreads) {
      weaken = maxWeakenThreads
      hack = 0
      grow = 0
    } else {
      weaken = maintenanceThreads
      const actionRam = reclaimableRam - weaken * ramInfo.weakenRam
      if (actionRam >= ramInfo.minRam) {
        hack = Math.floor((actionRam * weights.hack) / ramInfo.hackRam)
        grow = Math.floor((actionRam - hack * ramInfo.hackRam) / ramInfo.growRam)
      } else {
        hack = 0
        grow = 0
      }
    }
    allocations.push({ host, hack, grow, weaken })
  }

  return { allocations, weakenBudgetRemaining: remaining }
}

/**
 * hostNeedsRedeploy — rewritten 2026-08-13 (hacking-strategy.md R3) from an
 * action-*type* comparison to an allocation-*quantity* comparison. The old
 * version (see git history) only checked which action types were running
 * against the plan, never how many threads — which meant two live bugs:
 * (1) weaken threads sized for an earlier tick's higher security were never
 * scaled back down as the target's security dropped, so the no-redeploy
 * branch kept charging a shrinking `weakenBudget` for a stale, oversized
 * allocation and drove it negative every tick
 * (`weakenBudgetNonNegative`, confirmed live: 172 threads running against a
 * `needWeaken` of 75); (2) once a host ran `weaken + grow` (any weaken
 * phase's leftover-capacity branch), a plan flip to "work" judged it
 * already fine as long as `grow` was present, so hack was only ever
 * introduced by a work-weight bucket change — confirmed live at 0 hack
 * threads network-wide despite `plan.weights.hack` being nonzero.
 *
 * Both are the same root cause (comparing *kind* instead of *amount*), so
 * one general fix closes both: compare `desired` (this tick's freshly
 * computed allocation from `computeDesiredAllocation`, pass 1) against what
 * is actually running, per action type, with a tolerance band to avoid
 * churn from rounding noise. `forceRebalance` as a separate signal is gone
 * — a work-weight bucket change already changes `desired.hack`/`desired.grow`,
 * so it is caught by the same general diff instead of needing its own flag.
 *
 * Preserved from the 2026-08-11 redeploy-cadence fix (see git history for
 * the original comment): a mismatch is a real reason to redeploy but never
 * an urgent one on its own, so it still waits until every currently running
 * action type has had at least one full call's worth of time
 * (`elapsedS >= its own actionDurationsS`) before killing and redeploying —
 * a quantity mismatch that lands mid-call just gets picked up on the next
 * tick that's still mismatched, instead of cutting the in-flight call
 * short. The two structural checks (wrong target; hack running during an
 * active weaken phase, which actively fights it) still redeploy
 * immediately, unconditionally, same as before.
 *
 * @param {object} args
 * @param {string} args.target
 * @param {{type: string}} args.plan
 * @param {{script: string, target: string, elapsedS: number, threads: number}[]} args.running
 *   - one entry per currently-running action process on the host.
 * @param {{hack: number, grow: number, weaken: number}} args.desired - this
 *   host's row from `computeDesiredAllocation`.
 * @param {{absolute: number, relative: number}} args.tolerance - slack
 *   before a quantity difference counts as a real mismatch, as
 *   `max(absolute, want * relative)` per action type.
 * @param {{hack: number, grow: number, weaken: number}} args.actionDurationsS
 *   - current ns.get*Time()-derived duration for each action type, seconds.
 */
export function hostNeedsRedeploy({ target, plan, running, desired, tolerance, actionDurationsS }) {
  if (running.length === 0) return true
  if (running.some((r) => r.target !== target)) return true
  // Hack fights an active weaken phase (adds security while stealing from a
  // server we're trying to stabilize) — urgent regardless of quantity.
  if (plan.type === "weaken" && running.some((r) => r.script === "hack")) return true

  const have = { hack: 0, grow: 0, weaken: 0 }
  for (const r of running) have[r.script] = (have[r.script] || 0) + r.threads

  let mismatched = false
  for (const script of ["hack", "grow", "weaken"]) {
    const want = desired[script] || 0
    const slack = Math.max(tolerance.absolute, want * tolerance.relative)
    if (Math.abs(want - have[script]) > slack) {
      mismatched = true
      break
    }
  }
  if (!mismatched) return false

  return running.every((r) => r.elapsedS >= (actionDurationsS[r.script] ?? 0))
}

/**
 * The stuck-target detector's decision, extracted from mcp.js 2026-08-13
 * after finding it live-evicting healthy targets. `bestSecuritySeen` tracks
 * the lowest security observed since the window opened; once a target
 * reaches its security *floor* — the normal, desired outcome of a weaken
 * phase — `currentSecurity` can never again read below
 * `bestSecuritySeen - progressThreshold`, because the game's own
 * `capDifficulty()` hard-clamps security at the floor. Before this fix,
 * `securityProgressTime` therefore froze at the moment the floor was first
 * touched and the stall clock kept running through every subsequent
 * productive minute, only to fire the instant security next rose above the
 * cap — by which point `stalledMs` was already far past the window.
 * **confirmed live**: all three `reason:"stuck"` evictions in one session's
 * event log had `bestSecuritySeen` exactly equal to the target's floor and
 * `stalledMs` 1.2-2.7x past `stuckWindowMs`; none of them were actually
 * failing to weaken (`weakenTimeMs` well under the window in every case).
 *
 * `requiredWeaken === 0` means the target is already at or under its goal
 * security right now — nothing to be stuck on — so that case resets the
 * window outright rather than merely being excluded from the eviction
 * check, so a target that later needs weaken again starts a fresh window
 * instead of inheriting a stale one.
 *
 * @param {object} args
 * @param {number} args.currentSecurity
 * @param {number} args.bestSecuritySeen - Infinity means no window is open.
 * @param {number} args.securityProgressTime - 0 means no window is open yet.
 * @param {number} args.requiredWeaken - this tick's weaken-thread need; 0
 *   means the target needs no weaken right now.
 * @param {number} args.now
 * @param {number} args.stuckWindowMs
 * @param {number} args.progressThreshold - WEAKEN_STUCK_SECURITY_THRESHOLD.
 * @returns {{securityProgressTime: number, bestSecuritySeen: number, stuck: boolean, stalledMs: number}}
 */
export function evaluateStuckTarget({
  currentSecurity,
  bestSecuritySeen,
  securityProgressTime,
  requiredWeaken,
  now,
  stuckWindowMs,
  progressThreshold,
}) {
  if (requiredWeaken === 0) {
    return { securityProgressTime: 0, bestSecuritySeen: Infinity, stuck: false, stalledMs: 0 }
  }
  if (securityProgressTime === 0 || currentSecurity < bestSecuritySeen - progressThreshold) {
    return { securityProgressTime: now, bestSecuritySeen: currentSecurity, stuck: false, stalledMs: 0 }
  }
  const stalledMs = now - securityProgressTime
  return {
    securityProgressTime,
    bestSecuritySeen,
    stuck: stalledMs > stuckWindowMs,
    stalledMs,
  }
}

/**
 * The per-tick invariant sweep's predicates, decoupled from the toast/count/
 * event-emit side effects that live in mcp.js's `invariants.check`. Returns
 * checks in the same order they used to run inline, including the
 * `threadsFitHost` "stop after the first failing host" behaviour — one
 * report per tick is enough, the rest would be the same story.
 *
 * @param {object} ctx
 * @param {string|null} ctx.eventLogLastWriteError
 * @param {number} ctx.weakenBudgetRemaining
 * @param {number} ctx.requiredWeaken
 * @param {number} ctx.interval - real elapsed seconds since the last tick.
 * @param {boolean} ctx.firstTick
 * @param {number} ctx.ramUtilization
 * @param {{host: string, maxRam: number, usedRam: number, actions?: {script: string, threads: number}[]}[]} ctx.allocations
 * @param {{hackRam: number, growRam: number, weakenRam: number}} ctx.ramInfo
 * @param {object} config
 * @param {number} config.LOOP_SLEEP_MS
 * @returns {{name: string, ok: boolean, data: object}[]}
 */
export function computeTickInvariantChecks(ctx, config) {
  const checks = []

  // A write failing is exactly the kind of belief-vs-reality gap invariants
  // exist for — mcp_events.jsonl threw on every single write for its entire
  // life, caught and printed to a channel nobody read, and nothing else
  // would have surfaced it: the in-memory ring buffer that feeds
  // recentEvents keeps working regardless of whether the write succeeds.
  checks.push({
    name: "eventLogWrites",
    ok: !ctx.eventLogLastWriteError,
    data: { error: ctx.eventLogLastWriteError },
  })

  // Budget over-allocation was found only because maxWeaken happened to
  // decrement by exactly needWeaken each tick — an accident of two unrelated
  // fields lining up. This makes it an alarm instead.
  checks.push({
    name: "weakenBudgetNonNegative",
    ok: ctx.weakenBudgetRemaining >= 0,
    data: { remaining: ctx.weakenBudgetRemaining, required: ctx.requiredWeaken },
  })

  // Tab throttling stretched "10s" ticks to 70-380s, silently multiplying
  // every rate several-fold and tripping the degradation detector on an
  // artifact. Bounds are wide because the point is to catch the 7-38x case.
  //
  // Skipped on the first tick: lastTickTime is seeded just before the loop,
  // so tick 0 measures only its own startup work and lands well under the
  // floor — a false positive baked into startup, and a persistent false
  // alarm is worse than no alarm.
  const nominal = config.LOOP_SLEEP_MS / 1000
  if (!ctx.firstTick) {
    checks.push({
      name: "tickWithinBounds",
      ok: ctx.interval >= nominal * 0.5 && ctx.interval <= nominal * 3,
      data: { interval: ctx.interval, nominal },
    })
  }

  // The idle-network finding: utilization sat at 7% during weaken phases
  // while the code believed it was saturating the pool. Only meaningful once
  // there is a pool to speak of.
  checks.push({
    name: "poolNotIdle",
    ok: ctx.ramUtilization >= 0.5 || ctx.allocations.length === 0,
    data: { ramUtilization: ctx.ramUtilization, hosts: ctx.allocations.length },
  })

  // Threads deployed must fit the host that is running them. This is the
  // inconsistent-RAM class: mcp once reported usedRam 3.5, freeRam 16 and
  // maxRam 16 for the same host and had no way to see the contradiction.
  for (const allocation of ctx.allocations) {
    if (!allocation.actions || allocation.actions.length === 0) continue
    let claimed = 0
    for (const action of allocation.actions) {
      const perThread =
        action.script === "hack"
          ? ctx.ramInfo.hackRam
          : action.script === "grow"
            ? ctx.ramInfo.growRam
            : ctx.ramInfo.weakenRam
      claimed += action.threads * perThread
    }
    const ok = claimed <= allocation.maxRam + SECURITY_EPSILON
    checks.push({
      name: "threadsFitHost",
      ok,
      data: { host: allocation.host, claimed, maxRam: allocation.maxRam, usedRam: allocation.usedRam },
    })
    // One report per tick is enough; the rest would be the same story.
    if (!ok) break
  }

  return checks
}
