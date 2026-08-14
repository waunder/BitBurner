/**
 * Pure decision logic extracted from mcp.js: target-eviction predicates,
 * opportunity-switch comparison, work-weight sizing (computeWorkWeights —
 * see hacking-strategy.md R1), and the tick-invariant checks. Nothing here
 * calls `ns.*` or has a side effect —
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

/**
 * Replaces the old `WORK_WEIGHTS_BY_BUCKET`/`bucketForMoneyPct`/
 * `getWorkWeightBucket`/`BUCKET_HYSTERESIS` machinery entirely (2026-08-14,
 * hacking-strategy.md R1 — see that doc's §1 for the full derivation, §2.1
 * for this exact function).
 *
 * The bucket table allocated hack as a fixed fraction of free RAM (30-75%),
 * independent of the target's actual balance point. §1 of the strategy doc
 * shows the real system is bistable — money either pins at max or collapses
 * toward the floor, with no stable point in between — and the balance ratio
 * `G/H = 3.2·p/k` (grow threads per hack thread that exactly offsets it) sat
 * at 24-ish (a ~3.7% hack share) for the live target measured, meaning
 * *every* non-zero bucket (lowest was 30%) was 4-8x past the collapse
 * threshold. The bucket table wasn't mistuned, it was structurally on the
 * wrong side of the only stable point — hence a full replacement rather
 * than a retune.
 *
 * `p` (hackPercentPerThread = `ns.hackAnalyze(target)`) and `k`
 * (growLogPerThread = `Math.LN2 / ns.growthAnalyze(target, 2)`, the exact
 * per-thread growth-log constant including every player/BitNode multiplier)
 * are both read live in `buildPlan`, 1GB each, no Formulas.exe needed — see
 * hacking-strategy.md §3.1 for why `growthAnalyze` alone is sufficient for a
 * continuous-loop farm (it needs the marginal rate, not a batch thread
 * count).
 *
 * `readiness = min(1, moneyPct/targetMoneyGoal)`, squared, replaces the
 * bucket ladder with continuous proportional control: near-empty targets get
 * almost no hack (fast ramp back to full), full targets get the full
 * balanced share scaled by `safety`. The squaring is speculative shaping
 * (hacking-strategy.md §2.1) — makes the ramp faster than linear, untested
 * live at time of writing.
 *
 * `safety` (< 1) is deliberate: at the exact balance point, log-money is a
 * driftless random walk — no restoring force either way. Running below
 * balance gives a positive drift that pins money at max, at a linear income
 * cost. Ship at 0.5 (the doc's safe starting value; 0.7 is explicitly
 * speculative there) and raise while watching `avgMoneyPct` live.
 *
 * @param {object} args
 * @param {string} args.objective - "money" or "xp"; XP mode ignores
 *   moneyPct/p/k entirely and uses the fixed split, same as before.
 * @param {number} args.hackPercentPerThread - `ns.hackAnalyze(target)`.
 * @param {number} args.growLogPerThread - `Math.LN2 / ns.growthAnalyze(target, 2)`.
 * @param {number} args.moneyPct
 * @param {number} args.targetMoneyGoal
 * @param {number} args.safety - HACK_BALANCE_SAFETY, fraction of the
 *   balanced hack share actually deployed at full readiness.
 * @param {number} args.xpWeightHack
 * @param {number} args.xpWeightGrow
 * @param {number} args.hackSecIncrease
 * @param {number} args.growSecIncrease
 * @param {number} args.weakenSecDecrease
 * @param {number} args.weakenPerHackRatio
 * @param {number} args.weakenPerGrowRatio
 * @returns {{weightBucket: string, weights: {hack: number, grow: number}, balancedHackShare?: number, growPerHack?: number}}
 *   `weightBucket` is now a 3-value regime tag ("xp"/"ramp"/"harvest"),
 *   kept only so the redeploy/bucket_change plumbing that used to key off
 *   the 5-value bucket string still has something to key a "did the regime
 *   change" event off of — it is no longer used to look up the weights
 *   themselves, which are computed continuously below.
 */
export function computeWorkWeights({
  objective,
  hackPercentPerThread,
  growLogPerThread,
  moneyPct,
  targetMoneyGoal,
  safety,
  xpWeightHack,
  xpWeightGrow,
  hackSecIncrease,
  growSecIncrease,
  weakenSecDecrease,
  weakenPerHackRatio,
  weakenPerGrowRatio,
}) {
  if (objective === "xp") {
    return { weightBucket: "xp", weights: { hack: xpWeightHack, grow: xpWeightGrow } }
  }
  // p/k unreadable (e.g. security so high growthAnalyze/hackAnalyze return
  // 0 or NaN) — go all-in on recovery rather than divide by zero. Same
  // fallback intent as the old "empty" bucket, but triggered by the inputs
  // being unusable rather than by moneyPct.
  if (!(hackPercentPerThread > 0) || !(growLogPerThread > 0)) {
    return { weightBucket: "ramp", weights: { hack: 0, grow: 1 } }
  }
  const growTimeRatio = weakenPerHackRatio / weakenPerGrowRatio // 3.2, growTime/hackTime
  const growPerHack = (growTimeRatio * hackPercentPerThread) / growLogPerThread
  const weakenPerHackThread = (hackSecIncrease * weakenPerHackRatio) / weakenSecDecrease
  const weakenPerGrowThread = (growSecIncrease * weakenPerGrowRatio) / weakenSecDecrease
  const balancedHackShare = 1 / (1 + weakenPerHackThread + growPerHack * (1 + weakenPerGrowThread))
  const readiness = Math.min(1, moneyPct / targetMoneyGoal)
  const hack = balancedHackShare * safety * readiness * readiness
  return {
    weightBucket: hack <= 0 ? "ramp" : "harvest",
    weights: { hack, grow: 1 - hack },
    balancedHackShare,
    growPerHack,
  }
}

/**
 * Achievable-rate target score (hacking-strategy.md R4, 2026-08-14) —
 * replaces the old "yield of one hack thread at full money"
 * (`maxMoney * hackAnalyze * hackAnalyzeChance / hackTime`) with an estimate
 * of the $/s the target would actually produce if handed the whole
 * network's thread pool and run at R1's balance point (strategy doc §1). The
 * old score never read `serverGrowth`/`k` at all, so it systematically
 * favoured low-`requiredHackingSkill`, low-growth targets over ones with a
 * far higher grow-limited ceiling — see the doc's §1.3 misranking table
 * (`rho-construction` modelled #1 at $23.3M/s, ranked 5th under the old
 * score; `global-pharm` #7 modelled, ranked 28th).
 *
 * `balancedHackShare`/`growPerHack` (r) are the same balance-point
 * quantities `computeWorkWeights` derives for weight-sizing, deliberately
 * re-derived here rather than imported from there: `computeWorkWeights` also
 * folds in `safety`/`readiness²`, which are *deployment* throttles that have
 * no place in a target-potential estimate (a candidate's score should
 * reflect what it could produce at the balance point, not what today's
 * safety margin or this target's current readiness happens to allow) —
 * calling it with fabricated safety=1/readiness=1 inputs just to borrow four
 * lines of arithmetic would be more confusing than the small duplication.
 *
 * `poolThreads` is a network-wide "how many thread-slots exist" estimate.
 * mcp.js passes its already-computed `getTotalWeakenCapacity` result
 * (`maxWeaken`) as-is, rather than a fresh RAM-basis calculation, for two
 * reasons: (1) it's computed once per tick already, so reusing it costs
 * nothing extra even though this function runs once per *candidate* server
 * every tick (`rankTargets`); (2) `scripts/grow.js` and `scripts/weaken.js`
 * cost the identical 1.75GB per thread (1.6GB base + 0.15GB action each —
 * verified against both scripts' source), so a weaken-RAM-basis thread count
 * is exactly, not just approximately, a grow-RAM-basis one too. That's also
 * why the same value doubles as `growThreadsIfAllGrow` in
 * `computeTargetEffectiveScore` below, rather than needing a second pool
 * estimate sized off `growRam`.
 *
 * One known gap, carried over from the strategy doc's own caveat rather than
 * fixed here: `hackTime`/`hackPercentPerThread`/`growLogPerThread` are all
 * read at the candidate's *current* security, not the floor it would be
 * weakened to, which systematically under-rates a target sitting well above
 * its floor. The doc marks its arithmetic workaround for this as optional/
 * secondary and it is not implemented — see hacking-strategy.md §2 R4.
 *
 * @param {object} args
 * @param {number} args.hackTime - T, seconds (`ns.getHackTime(server)/1000`).
 * @param {number} args.hackPercentPerThread - p, `ns.hackAnalyze(server)`.
 * @param {number} args.growLogPerThread - k, `Math.LN2/ns.growthAnalyze(server,2)`.
 * @param {number} args.maxMoney - `ns.getServerMaxMoney(server)`.
 * @param {number} args.hackChance - `ns.hackAnalyzeChance(server)`.
 * @param {number} args.poolThreads - network-wide thread-slot estimate.
 * @param {number} args.growTimeRatio - weakenPerHackRatio/weakenPerGrowRatio (3.2).
 * @param {number} args.hackSecIncrease
 * @param {number} args.growSecIncrease
 * @param {number} args.weakenSecDecrease
 * @param {number} args.weakenPerHackRatio
 * @param {number} args.weakenPerGrowRatio
 * @returns {{score: number, growPerHack: number, balancedHackShare: number, hackThreads: number}}
 */
export function computeTargetScore({
  hackTime,
  hackPercentPerThread,
  growLogPerThread,
  maxMoney,
  hackChance,
  poolThreads,
  growTimeRatio,
  hackSecIncrease,
  growSecIncrease,
  weakenSecDecrease,
  weakenPerHackRatio,
  weakenPerGrowRatio,
}) {
  if (!(hackTime > 0) || !(hackPercentPerThread > 0) || !(growLogPerThread > 0)) {
    return { score: 0, growPerHack: 0, balancedHackShare: 0, hackThreads: 0 }
  }
  const growPerHack = (growTimeRatio * hackPercentPerThread) / growLogPerThread
  const weakenPerHackThread = (hackSecIncrease * weakenPerHackRatio) / weakenSecDecrease
  const weakenPerGrowThread = (growSecIncrease * weakenPerGrowRatio) / weakenSecDecrease
  const balancedHackShare = 1 / (1 + weakenPerHackThread + growPerHack * (1 + weakenPerGrowThread))
  const hackThreads = Math.max(0, poolThreads) * balancedHackShare
  const drained = 1 - Math.exp(-growTimeRatio * hackThreads * hackPercentPerThread)
  const score = (maxMoney * hackChance * drained) / (growTimeRatio * hackTime)
  return { score, growPerHack, balancedHackShare, hackThreads }
}

/**
 * Ramp-cost discount (hacking-strategy.md R4, 2026-08-14) — replaces
 * `READINESS_FLOOR`'s dimensionally-arbitrary `max(moneyPct, 0.05)`
 * multiplier with an explicit cost: the wall-clock time to grow a drained
 * target up to `targetMoneyGoal` of its max, if the whole pool ran grow
 * against it. A candidate that would take 20 minutes to ramp is worth less
 * over the next hour than one already sitting near its goal, even with a
 * higher raw balance-point score — but by less and less as the horizon
 * lengthens, which is what `horizonSeconds` (new config, `SCORE_HORIZON_SECONDS`,
 * shipped at 3600 per the doc — the bot runs for hours) is for. Before this,
 * `MIN_TARGET_COMMIT_MS`'s 600s commit window was implicitly standing in as
 * the horizon, which the doc's own worked example shows is too short to let
 * a target with a longer but more valuable ramp win.
 *
 * `rampSeconds` uses the same log-growth model `computeWorkWeights`/
 * `computeTargetScore` are built on: growing from `money` to `goalMoney`
 * takes `ln(goalMoney/money) / k` grow-cycles-worth of log-growth, each
 * cycle taking `growTimeRatio * hackTime` seconds.
 *
 * A negative raw ramp (money already above goal — possible since
 * `targetMoneyGoal` is typically < 1) is clamped to 0 rather than left
 * negative, which would otherwise *boost* the effective score above the raw
 * potential instead of just leaving an already-ready target undiscounted.
 *
 * @param {object} args
 * @param {number} args.score - `computeTargetScore`'s raw potential for this
 *   server (same `poolThreads` basis as `growThreadsIfAllGrow` below).
 * @param {number} args.hackTime - T, seconds.
 * @param {number} args.growLogPerThread - k.
 * @param {number} args.maxMoney
 * @param {number} args.money - current `ns.getServerMoneyAvailable(server)`.
 * @param {number} args.targetMoneyGoal - TARGET_MONEY_GOAL.
 * @param {number} args.growThreadsIfAllGrow - see `computeTargetScore`'s
 *   `poolThreads` doc; mcp.js passes the same value for both.
 * @param {number} args.growTimeRatio
 * @param {number} args.horizonSeconds - SCORE_HORIZON_SECONDS.
 * @returns {{effective: number, rampSeconds: number}}
 */
export function computeTargetEffectiveScore({
  score,
  hackTime,
  growLogPerThread,
  maxMoney,
  money,
  targetMoneyGoal,
  growThreadsIfAllGrow,
  growTimeRatio,
  horizonSeconds,
}) {
  if (!(score > 0)) return { effective: 0, rampSeconds: Infinity }
  if (!(growThreadsIfAllGrow > 0) || !(growLogPerThread > 0) || !(hackTime > 0)) {
    return { effective: 0, rampSeconds: Infinity }
  }
  const goalMoney = maxMoney * targetMoneyGoal
  const currentMoney = Math.max(money, 1)
  const rawRampSeconds =
    (growTimeRatio * hackTime * Math.log(goalMoney / currentMoney)) / (growThreadsIfAllGrow * growLogPerThread)
  const rampSeconds = Math.max(0, rawRampSeconds)
  const effective = (score * horizonSeconds) / (horizonSeconds + rampSeconds)
  return { effective, rampSeconds }
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
 * `declining` compares the average of the older half of the window against
 * the average of the newer half, not raw endpoint samples — changed
 * 2026-08-14 (hacking-strategy.md R1) because harvest-mode money now
 * legitimately sawtooths between ~45% and 100% of max within a single grow
 * cycle (hack fires every `hackTime`, grow only lands every `3.2×hackTime`),
 * and `MONEY_PCT_SAMPLE_COUNT`'s ~90s window can span less than two full
 * sawtooth cycles on a fast target. A raw first-sample/last-sample
 * comparison could read "declining" purely because the window happened to
 * open near a peak and close near a trough of the *same* sawtooth, with no
 * actual degradation underneath. Averaging each half cancels a single
 * unlucky endpoint sample while still catching a genuine multi-tick decline
 * (verified against the existing regression cases below — same
 * `declining`/`moneyDegraded` verdict on every one of them, since a true
 * decline or a true recovery moves both half-averages together, not just
 * the endpoints).
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
  const half = Math.max(1, Math.floor(moneyPctSamples.length / 2))
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length
  const declining =
    windowFull && mean(moneyPctSamples.slice(-half)) < mean(moneyPctSamples.slice(0, half))
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
 * @param {boolean} args.idle - true when the current target is producing
 *   essentially nothing (compare readiness-discounted scores); false when
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
 * Grow-only weaken offset for computeDesiredAllocation's weaken-phase
 * leftover-grow branch (hacking-strategy.md R7, 2026-08-14). Same
 * weakenPerGrowRatio/weakenSecDecrease rate-correction math
 * `weakenThreadsToOffset(0, growThreads, ...)` always did (grow threads loop
 * every `growTime`, weaken every `weakenTime` = 1.25x less often, so a
 * one-shot per-call comparison understates what maintenance actually costs)
 * — the only thing that changes is *where the raw per-call security number
 * comes from*.
 *
 * Without `growSecurityIncreaseForThreads`, the raw number is
 * `growThreads * growSecIncrease` (linear, uncapped) — reproduces the exact
 * old `weakenThreadsToOffset(0, growThreads, ...)` result, so every existing
 * caller/test that doesn't pass the function keeps its current numbers.
 *
 * With it, the raw number is whatever the function returns —
 * `ns.growthAnalyzeSecurity(growThreads, target, 1)` in mcp.js, which
 * applies the game's own `min(threads, maxThreadsNeeded)` clamp (source,
 * NetscriptFunctions.ts) so the reserve stops growing once the target is
 * close enough to `moneyMax` that extra grow threads can't add more growth
 * (and therefore can't add more security) than the clamp allows. This is an
 * `ns` call, so it has to be injected from mcp.js rather than called
 * directly here — this file stays free of any literal `ns.*` reference.
 */
function growWeakenOffsetThreads(growThreads, securityConstants, growSecurityIncreaseForThreads) {
  const rawIncrease = growSecurityIncreaseForThreads
    ? growSecurityIncreaseForThreads(growThreads)
    : growThreads * securityConstants.growSecIncrease
  return Math.ceil((rawIncrease * securityConstants.weakenPerGrowRatio) / securityConstants.weakenSecDecrease)
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
 * @param {(growThreads: number) => number} [args.growSecurityIncreaseForThreads] - optional,
 *   hacking-strategy.md R7: `ns.growthAnalyzeSecurity(growThreads, target, 1)`
 *   from mcp.js, used only in the weaken-phase leftover-grow branch below.
 *   Omit to keep the old linear `growThreads * growSecIncrease` estimate
 *   (what every pre-R7 caller/test still gets) — see
 *   `growWeakenOffsetThreads`'s own comment for why the clamped version is
 *   worth having and why it has to be injected rather than called directly.
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
export function computeDesiredAllocation({
  hosts,
  plan,
  weakenBudget,
  ramInfo,
  securityConstants,
  growSecurityIncreaseForThreads,
}) {
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
      // beside. hacking-strategy.md R7: sized from ns.growthAnalyzeSecurity
      // (via growSecurityIncreaseForThreads) when available, so the reserve
      // saturates the same way the game's own grow() call does as the
      // target nears moneyMax, instead of growing linearly forever.
      let growOffset = growWeakenOffsetThreads(grow, securityConstants, growSecurityIncreaseForThreads)
      if (growOffset > 0) {
        const reserveRam = growOffset * ramInfo.weakenRam
        grow = Math.max(0, Math.floor((leftoverRam - reserveRam) / ramInfo.growRam))
        weaken += growWeakenOffsetThreads(grow, securityConstants, growSecurityIncreaseForThreads)
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
 * Sums running per-script thread counts into `{hack, grow, weaken}` — the
 * "have" side of the desired-vs-running diff `hostNeedsRedeploy` (below)
 * uses to decide *whether* a host needs a redeploy. Extracted as its own
 * export 2026-08-14 (hacking-strategy.md R5) so `allocateThreads` (mcp.js)
 * can reuse the exact same counting for its own per-script kill/re-exec
 * decision, instead of recomputing an equivalent tally a second way that
 * could drift out of sync with this one.
 *
 * @param {{script: string, threads: number}[]} running - one entry per
 *   currently-running action process (only `script`/`threads` are read, so
 *   `hostNeedsRedeploy`'s richer per-entry shape works here unchanged).
 * @returns {{hack: number, grow: number, weaken: number}}
 */
export function countRunningByScript(running) {
  const have = { hack: 0, grow: 0, weaken: 0 }
  for (const r of running) have[r.script] = (have[r.script] || 0) + r.threads
  return have
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

  const have = countRunningByScript(running)

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
