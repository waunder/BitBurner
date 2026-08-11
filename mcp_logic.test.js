/**
 * Tests for mcp_logic.js — the pure decision logic pulled out of mcp.js.
 * Run with: node --test mcp_logic.test.js
 *
 * These exist because diagnosing the moneyDegraded/XP-mode eviction bug
 * (fixed in commit 81814d6) took three live restarts and 4-5 minutes of
 * watching the game over CDP each time, for a decision that is actually a
 * pure function of a handful of numbers. The first test below is a direct
 * regression test for that exact bug: it asserts the OBJECTIVE gate mcp.js
 * now has, and would have failed against the code as it was before the fix.
 *
 * Coverage is deliberately a handful of sharp cases, not exhaustive: see
 * docs/process-backlog.md's "Pure functions + node --test" entry for why
 * this kind of extraction was worth doing at all.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  evaluateMoneyDegradation,
  evaluateOpportunitySwitch,
  selectWorkWeights,
  getWorkWeightBucket,
  bucketForMoneyPct,
  computeTickInvariantChecks,
  hostNeedsRedeploy,
  WORK_WEIGHTS_BY_BUCKET,
} from "./mcp_logic.js"

describe("hostNeedsRedeploy — the 2026-08-11 forceRebalance/redeploy-timing bug", () => {
  // The exact scenario found live: a target's work-weight bucket flips every
  // tick (moneyPct swinging faster than BUCKET_HYSTERESIS can resist), and
  // growTimeS/weakenTimeS (13-16s) are longer than the 10s tick. Before the
  // fix, forceRebalance short-circuited to `true` unconditionally, so this
  // host was killed and redeployed every single tick and no grow/weaken call
  // ever survived long enough to finish.
  const actionDurationsS = { hack: 5, grow: 15, weaken: 16 }

  test("regression: forceRebalance alone does not kill a grow call that hasn't had time to finish", () => {
    const running = [{ script: "grow", target: "foodnstuff", elapsedS: 4 }] // 4s into a 15s call
    const needsRedeploy = hostNeedsRedeploy({
      target: "foodnstuff",
      plan: { type: "work" },
      running,
      forceRebalance: true,
      actionDurationsS,
    })
    assert.equal(needsRedeploy, false, "a bucket flip must not cut off an in-flight grow call")
  })

  test("forceRebalance redeploys once every running action has had a full call's worth of time", () => {
    const running = [{ script: "grow", target: "foodnstuff", elapsedS: 15 }] // >= growTimeS
    const needsRedeploy = hostNeedsRedeploy({
      target: "foodnstuff",
      plan: { type: "work" },
      running,
      forceRebalance: true,
      actionDurationsS,
    })
    assert.equal(needsRedeploy, true)
  })

  test("forceRebalance waits for the slowest running action type, not just any of them", () => {
    // grow has had enough time (15 >= 15) but weaken hasn't (10 < 16) — must
    // not redeploy and cut the weaken call short just because grow is ready.
    const running = [
      { script: "grow", target: "foodnstuff", elapsedS: 15 },
      { script: "weaken", target: "foodnstuff", elapsedS: 10 },
    ]
    const needsRedeploy = hostNeedsRedeploy({
      target: "foodnstuff",
      plan: { type: "weaken" },
      running,
      forceRebalance: true,
      actionDurationsS,
    })
    assert.equal(needsRedeploy, false)
  })

  test("without forceRebalance, matching running actions never redeploy regardless of elapsed time", () => {
    const running = [{ script: "grow", target: "foodnstuff", elapsedS: 0.1 }]
    const needsRedeploy = hostNeedsRedeploy({
      target: "foodnstuff",
      plan: { type: "work" },
      running,
      forceRebalance: false,
      actionDurationsS,
    })
    assert.equal(needsRedeploy, false)
  })

  test("structural mismatch — no running actions at all — redeploys immediately even without forceRebalance", () => {
    const needsRedeploy = hostNeedsRedeploy({
      target: "foodnstuff",
      plan: { type: "work" },
      running: [],
      forceRebalance: false,
      actionDurationsS,
    })
    assert.equal(needsRedeploy, true)
  })

  test("structural mismatch — running against the wrong target — redeploys immediately, ignoring elapsed time", () => {
    const running = [{ script: "grow", target: "some-other-server", elapsedS: 0 }]
    const needsRedeploy = hostNeedsRedeploy({
      target: "foodnstuff",
      plan: { type: "work" },
      running,
      forceRebalance: false,
      actionDurationsS,
    })
    assert.equal(needsRedeploy, true, "stale target's actions are never worth waiting out")
  })

  test("structural mismatch — weaken plan with a hack thread running — redeploys immediately", () => {
    const running = [{ script: "hack", target: "foodnstuff", elapsedS: 0 }]
    const needsRedeploy = hostNeedsRedeploy({
      target: "foodnstuff",
      plan: { type: "weaken" },
      running,
      forceRebalance: false,
      actionDurationsS,
    })
    assert.equal(needsRedeploy, true, "hack fights an active weaken phase and must go regardless of forceRebalance")
  })

  test("structural mismatch — work plan with only weaken running (no grow/hack yet) — redeploys immediately", () => {
    const running = [{ script: "weaken", target: "foodnstuff", elapsedS: 0 }]
    const needsRedeploy = hostNeedsRedeploy({
      target: "foodnstuff",
      plan: { type: "work" },
      running,
      forceRebalance: false,
      actionDurationsS,
    })
    assert.equal(needsRedeploy, true)
  })
})

describe("evaluateMoneyDegradation — the moneyDegraded/OBJECTIVE bug", () => {
  // A full, declining, low-average sample window — the exact shape that
  // triggered three evictions in under a minute in XP mode before 81814d6.
  const decliningLowSamples = [0.09, 0.07, 0.06, 0.04, 0.03, 0.03, 0.02, 0.02, 0.01]

  test("regression: XP mode never reports moneyDegraded, no matter how low/declining money is", () => {
    const result = evaluateMoneyDegradation({
      objective: "xp",
      moneyPctSamples: decliningLowSamples,
      sampleTarget: decliningLowSamples.length,
      degradedThreshold: 0.05,
    })
    // windowFull/declining/avgMoneyPct still reflect reality — only the
    // OBJECTIVE gate on moneyDegraded itself changes. A test that also
    // forced those false would hide a regression where the gate moved to
    // the wrong field.
    assert.equal(result.windowFull, true)
    assert.equal(result.declining, true)
    assert.ok(result.avgMoneyPct < 0.05)
    assert.equal(result.moneyDegraded, false, "moneyDegraded must be false in xp mode regardless of avgMoneyPct/declining")
  })

  test("money mode: old behavior unchanged — degrades on a full, declining, low window", () => {
    const result = evaluateMoneyDegradation({
      objective: "money",
      moneyPctSamples: decliningLowSamples,
      sampleTarget: decliningLowSamples.length,
      degradedThreshold: 0.05,
    })
    assert.equal(result.moneyDegraded, true)
  })

  test("money mode: not degraded when the window isn't full yet", () => {
    const result = evaluateMoneyDegradation({
      objective: "money",
      moneyPctSamples: [0.02, 0.01], // fewer than sampleTarget
      sampleTarget: 9,
      degradedThreshold: 0.05,
    })
    assert.equal(result.windowFull, false)
    assert.equal(result.moneyDegraded, false)
  })

  test("money mode: not degraded when low but recovering (not declining)", () => {
    // Mid-recovery: legitimately low, but climbing — must not be punished,
    // or the target is starved of grow threads right when it needs them.
    const recovering = [0.01, 0.01, 0.02, 0.02, 0.03, 0.03, 0.04, 0.04, 0.045]
    const result = evaluateMoneyDegradation({
      objective: "money",
      moneyPctSamples: recovering,
      sampleTarget: recovering.length,
      degradedThreshold: 0.05,
    })
    assert.equal(result.declining, false)
    assert.equal(result.moneyDegraded, false)
  })

  test("money mode: not degraded when average is above the threshold, even if declining", () => {
    const highButDeclining = [0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5]
    const result = evaluateMoneyDegradation({
      objective: "money",
      moneyPctSamples: highButDeclining,
      sampleTarget: highButDeclining.length,
      degradedThreshold: 0.05,
    })
    assert.equal(result.declining, true)
    assert.ok(result.avgMoneyPct >= 0.05)
    assert.equal(result.moneyDegraded, false)
  })
})

describe("evaluateOpportunitySwitch — opportunity-switch comparison", () => {
  test("switches: candidate clears the factor and hold has elapsed", () => {
    const result = evaluateOpportunitySwitch({
      idle: false,
      candidates: [
        { server: "current", score: 100 },
        { server: "rich-target", score: 500 }, // 5x, clears factor=3
      ],
      currentTarget: "current",
      currentScore: 100,
      heldMs: 700_000,
      holdMs: 600_000, // MIN_TARGET_COMMIT_MS-shaped
      factor: 3,
    })
    assert.equal(result.committed, true)
    assert.equal(result.outbid, true)
    assert.equal(result.best, "rich-target")
    assert.equal(result.blockedBy, null)
    assert.ok(Math.abs(result.ratio - 5) < 1e-9)
  })

  test("blocked by hold: candidate clears the factor but hold time hasn't elapsed", () => {
    const result = evaluateOpportunitySwitch({
      idle: false,
      candidates: [
        { server: "current", score: 100 },
        { server: "rich-target", score: 500 },
      ],
      currentTarget: "current",
      currentScore: 100,
      heldMs: 100_000,
      holdMs: 600_000,
      factor: 3,
    })
    assert.equal(result.committed, false)
    assert.equal(result.outbid, true)
    assert.equal(result.blockedBy, "hold")
  })

  test("blocked by score: held long enough, but candidate doesn't clear the factor", () => {
    const result = evaluateOpportunitySwitch({
      idle: false,
      candidates: [
        { server: "current", score: 100 },
        { server: "slightly-better", score: 200 }, // only 2x, factor is 3
      ],
      currentTarget: "current",
      currentScore: 100,
      heldMs: 700_000,
      holdMs: 600_000,
      factor: 3,
    })
    assert.equal(result.committed, true)
    assert.equal(result.outbid, false)
    assert.equal(result.blockedBy, "score")
  })

  test("current target is itself the best candidate: never outbid", () => {
    const result = evaluateOpportunitySwitch({
      idle: true,
      candidates: [
        { server: "current", score: 900 },
        { server: "other", score: 10 },
      ],
      currentTarget: "current",
      currentScore: 900,
      heldMs: 120_000,
      holdMs: 60_000,
      factor: 3,
    })
    assert.equal(result.outbid, false)
    assert.equal(result.blockedBy, "score")
  })

  test("idle regime uses the shorter hold and is tagged 'effective'", () => {
    const result = evaluateOpportunitySwitch({
      idle: true,
      candidates: [
        { server: "current", score: 1 },
        { server: "much-better", score: 100 },
      ],
      currentTarget: "current",
      currentScore: 1,
      heldMs: 61_000,
      holdMs: 60_000, // MIN_TARGET_HOLD_MS-shaped
      factor: 3,
    })
    assert.equal(result.basis, "effective")
    assert.equal(result.committed, true)
    assert.equal(result.outbid, true)
  })
})

describe("selectWorkWeights / getWorkWeightBucket — bucket-based work-weight selection", () => {
  const targetMoneyGoal = 0.95
  const bucketHysteresis = 0.02

  test("money mode at the goal tier picks the goal weights", () => {
    const { weightBucket, weights } = selectWorkWeights({
      objective: "money",
      moneyPct: 0.97,
      previousWeightBucket: null,
      targetMoneyGoal,
      bucketHysteresis,
      xpWeightHack: 0.8,
      xpWeightGrow: 0.2,
    })
    assert.equal(weightBucket, "goal")
    assert.deepEqual(weights, WORK_WEIGHTS_BY_BUCKET.goal)
  })

  test("money mode mid-tier (50%) picks the low bucket, grow-heavy", () => {
    const { weightBucket, weights } = selectWorkWeights({
      objective: "money",
      moneyPct: 0.5,
      previousWeightBucket: null,
      targetMoneyGoal,
      bucketHysteresis,
      xpWeightHack: 0.8,
      xpWeightGrow: 0.2,
    })
    assert.equal(weightBucket, "low")
    assert.deepEqual(weights, WORK_WEIGHTS_BY_BUCKET.low)
  })

  test("money mode near-empty (2%) picks the empty bucket: all grow, no hack", () => {
    const { weightBucket, weights } = selectWorkWeights({
      objective: "money",
      moneyPct: 0.02,
      previousWeightBucket: null,
      targetMoneyGoal,
      bucketHysteresis,
      xpWeightHack: 0.8,
      xpWeightGrow: 0.2,
    })
    assert.equal(weightBucket, "empty")
    assert.deepEqual(weights, { grow: 1, hack: 0 })
  })

  test("xp mode ignores moneyPct entirely and always uses the fixed split", () => {
    for (const moneyPct of [0.01, 0.5, 0.99]) {
      const { weightBucket, weights } = selectWorkWeights({
        objective: "xp",
        moneyPct,
        previousWeightBucket: null,
        targetMoneyGoal,
        bucketHysteresis,
        xpWeightHack: 0.8,
        xpWeightGrow: 0.2,
      })
      assert.equal(weightBucket, "xp")
      assert.deepEqual(weights, { hack: 0.8, grow: 0.2 })
    }
  })

  test("hysteresis resists a single-step boundary flip (the empty/low thrash fix)", () => {
    // bucketForMoneyPct(0.09) is "empty" outright, but with previousBucket
    // "low" the resisted check (0.09 + 0.02 = 0.11) is still "low", so the
    // bucket should hold rather than flip every tick near the 0.1 line.
    const held = getWorkWeightBucket(0.09, "low", targetMoneyGoal, bucketHysteresis)
    assert.equal(held, "low")

    // But a genuine, larger drop is accepted immediately.
    const dropped = getWorkWeightBucket(0.03, "low", targetMoneyGoal, bucketHysteresis)
    assert.equal(dropped, "empty")
  })

  test("bucketForMoneyPct boundaries", () => {
    assert.equal(bucketForMoneyPct(0.95, 0.95), "goal")
    assert.equal(bucketForMoneyPct(0.94, 0.95), "high")
    assert.equal(bucketForMoneyPct(0.92, 0.95), "high")
    assert.equal(bucketForMoneyPct(0.91, 0.95), "mid")
    assert.equal(bucketForMoneyPct(0.85, 0.95), "mid")
    assert.equal(bucketForMoneyPct(0.84, 0.95), "low")
    assert.equal(bucketForMoneyPct(0.1, 0.95), "low")
    assert.equal(bucketForMoneyPct(0.099, 0.95), "empty")
  })
})

describe("computeTickInvariantChecks", () => {
  const baseCtx = {
    eventLogLastWriteError: null,
    weakenBudgetRemaining: 10,
    requiredWeaken: 10,
    interval: 10,
    firstTick: false,
    ramUtilization: 0.9,
    allocations: [],
    ramInfo: { hackRam: 1.7, growRam: 1.75, weakenRam: 1.75 },
  }
  const config = { LOOP_SLEEP_MS: 10000 }

  test("all-healthy tick produces only passing checks", () => {
    const checks = computeTickInvariantChecks(baseCtx, config)
    assert.ok(checks.length > 0)
    assert.ok(checks.every((c) => c.ok))
  })

  test("weakenBudgetNonNegative fires when the budget went negative", () => {
    const checks = computeTickInvariantChecks({ ...baseCtx, weakenBudgetRemaining: -1 }, config)
    const violation = checks.find((c) => c.name === "weakenBudgetNonNegative")
    assert.ok(violation)
    assert.equal(violation.ok, false)
    assert.equal(violation.data.remaining, -1)
  })

  test("tickWithinBounds is skipped entirely on the first tick", () => {
    // A 200ms interval would fail the bound check on any later tick, but
    // firstTick must suppress it — tick 0 measures only startup work.
    const checks = computeTickInvariantChecks({ ...baseCtx, interval: 0.2, firstTick: true }, config)
    assert.equal(
      checks.find((c) => c.name === "tickWithinBounds"),
      undefined
    )
  })

  test("tickWithinBounds fires on a later tick stretched far past nominal", () => {
    const checks = computeTickInvariantChecks({ ...baseCtx, interval: 90, firstTick: false }, config)
    const violation = checks.find((c) => c.name === "tickWithinBounds")
    assert.ok(violation)
    assert.equal(violation.ok, false)
  })

  test("threadsFitHost stops after the first failing host (one report per tick)", () => {
    const allocations = [
      {
        host: "over-allocated-1",
        maxRam: 16,
        usedRam: 20,
        actions: [{ script: "hack", threads: 20 }], // 20*1.7=34 > 16, fails
      },
      {
        host: "over-allocated-2",
        maxRam: 16,
        usedRam: 20,
        actions: [{ script: "hack", threads: 20 }], // would also fail
      },
    ]
    const checks = computeTickInvariantChecks({ ...baseCtx, allocations }, config)
    const threadsFitHostChecks = checks.filter((c) => c.name === "threadsFitHost")
    assert.equal(threadsFitHostChecks.length, 1, "should stop after the first failing allocation")
    assert.equal(threadsFitHostChecks[0].ok, false)
    assert.equal(threadsFitHostChecks[0].data.host, "over-allocated-1")
  })

  test("threadsFitHost passes and continues checking when threads fit", () => {
    const allocations = [
      { host: "fine-1", maxRam: 100, usedRam: 34, actions: [{ script: "hack", threads: 20 }] },
      { host: "fine-2", maxRam: 100, usedRam: 34, actions: [{ script: "hack", threads: 20 }] },
    ]
    const checks = computeTickInvariantChecks({ ...baseCtx, allocations }, config)
    const threadsFitHostChecks = checks.filter((c) => c.name === "threadsFitHost")
    assert.equal(threadsFitHostChecks.length, 2)
    assert.ok(threadsFitHostChecks.every((c) => c.ok))
  })
})
