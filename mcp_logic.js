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

/**
 * hostNeedsRedeploy — moved here from mcp.js verbatim (see that file's own
 * comment, preserved below) plus one fix for the bug found live 2026-08-11:
 * "farm may be stuck" traced back to `foodnstuff`'s moneyPct swinging ~0.08
 * every 10s tick, well past `BUCKET_HYSTERESIS` (0.02 at the time), which
 * flipped its work-weight bucket every single tick. Every bucket flip sets
 * `forceRebalance = true`, which this function used to treat as an
 * unconditional "kill and redeploy" — but grow/weaken calls on that target
 * were taking 13-16s, longer than the 10s tick, so every single one was cut
 * off before it could ever finish. Not a policy bug (the hack/grow weights
 * were correct for each bucket) — a redeploy-cadence bug that made the
 * correct policy meaningless: nothing ever ran long enough to matter.
 *
 * Raising BUCKET_HYSTERESIS to 0.08 mitigated this by making flips rarer,
 * but it's a per-target tuning knob, not a fix — a different target with a
 * bigger natural swing could thrash the exact same way. The structural fix:
 * a forceRebalance that isn't backed by anything actually wrong with what's
 * running (see the structural checks below — those still redeploy
 * immediately, unconditionally) now waits until every currently running
 * action type has had at least one full call's worth of time
 * (elapsedS >= its own current *TimeS) to complete before it's allowed to
 * kill and redeploy. A bucket flip that lands mid-call just sets the new
 * weights for the *next* redeploy instead of retroactively invalidating the
 * call already in flight.
 *
 * mcp.js's original comment, preserved: "hack/grow/weaken calls routinely
 * take 1-4+ minutes (see hackTime/growTime/weakenTime in the status line),
 * far longer than one mcp loop tick. Killing and re-execing every tick
 * regardless of state means threads never survive long enough to complete,
 * so a host is only redeployed when its currently running actions no
 * longer match what's actually needed."
 *
 * @param {object} args
 * @param {string} args.target
 * @param {{type: string}} args.plan
 * @param {{script: string, target: string, elapsedS: number}[]} args.running
 *   - one entry per currently-running action process on the host.
 * @param {boolean} args.forceRebalance
 * @param {{hack: number, grow: number, weaken: number}} args.actionDurationsS
 *   - current ns.get*Time()-derived duration for each action type, seconds.
 */
export function hostNeedsRedeploy({ target, plan, running, forceRebalance, actionDurationsS }) {
  if (running.length === 0) return true
  if (running.some((r) => r.target !== target)) return true

  const hasGrow = running.some((r) => r.script === "grow")
  const hasHack = running.some((r) => r.script === "hack")
  // Grow is welcome during a weaken phase (leftover capacity goes to it, and
  // refilling money is always useful); hack is not — it fights the weaken by
  // adding security while stealing from a server we're trying to stabilize.
  if (plan.type === "work" && !hasGrow && !hasHack) return true
  if (plan.type === "weaken" && hasHack) return true

  if (!forceRebalance) return false

  // The only reason left to redeploy is forceRebalance itself (e.g. a
  // work-weight bucket change) — nothing structurally wrong with what's
  // running. Hold off until every action type currently running has had at
  // least one full call's worth of time to complete, so the redeploy lands
  // between calls instead of inside one.
  return running.every((r) => r.elapsedS >= (actionDurationsS[r.script] ?? 0))
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
