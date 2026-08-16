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
  evaluateFormulaSwitchVeto,
  evaluateStuckTarget,
  computeWorkWeights,
  computeTargetScore,
  computeTargetEffectiveScore,
  computeTickInvariantChecks,
  computeDesiredAllocation,
  weakenThreadsToOffset,
  hostNeedsRedeploy,
  countRunningByScript,
  missingDesiredScripts,
} from "./mcp_logic.js"

// Real values from mcp.js's own constants/RAM readouts (see
// hacking-mechanics.md — cross-checked against the game's own source).
const SECURITY_CONSTANTS = {
  hackSecIncrease: 0.002,
  growSecIncrease: 0.004,
  weakenSecDecrease: 0.05,
  weakenPerHackRatio: 4,
  weakenPerGrowRatio: 1.25,
}
const RAM_INFO = { hackRam: 1.7, growRam: 1.75, weakenRam: 1.75, minRam: 1.7 }

describe("weakenThreadsToOffset", () => {
  test("hack threads only", () => {
    // 100 * 0.002 * 4 = 0.8; 0.8 / 0.05 = 16 exactly.
    assert.equal(weakenThreadsToOffset(100, 0, SECURITY_CONSTANTS), 16)
  })

  test("grow threads only", () => {
    // 100 * 0.004 * 1.25 = 0.5; 0.5 / 0.05 = 10 exactly.
    assert.equal(weakenThreadsToOffset(0, 100, SECURITY_CONSTANTS), 10)
  })

  test("combines both and rounds up", () => {
    // (1*0.002*4 + 1*0.004*1.25) / 0.05 = 0.013/0.05 = 0.26 -> ceil 1.
    assert.equal(weakenThreadsToOffset(1, 1, SECURITY_CONSTANTS), 1)
  })

  test("zero threads need zero offset", () => {
    assert.equal(weakenThreadsToOffset(0, 0, SECURITY_CONSTANTS), 0)
  })
})

describe("computeDesiredAllocation — R3's pass 1 (2026-08-13)", () => {
  test("weaken plan: shared budget is drawn down in host order, never exceeded", () => {
    const hosts = [
      { host: "a", reclaimableRam: 20 },
      { host: "b", reclaimableRam: 20 },
      { host: "c", reclaimableRam: 20 },
    ]
    const { allocations, weakenBudgetRemaining } = computeDesiredAllocation({
      hosts,
      plan: { type: "weaken" },
      weakenBudget: 15, // less than any single host's own capacity (11) x3
      ramInfo: RAM_INFO,
      securityConstants: SECURITY_CONSTANTS,
    })
    // Host a takes its full share (11, capped by its own RAM, not the
    // budget), leaving 4; host b takes the remaining 4 (+1 more from its own
    // grow-security offset); host c gets none of the primary budget and
    // puts its whole leftover RAM into grow, plus 1 offset weaken thread.
    assert.deepEqual(allocations, [
      { host: "a", hack: 0, grow: 0, weaken: 11 },
      { host: "b", hack: 0, grow: 6, weaken: 5 },
      { host: "c", hack: 0, grow: 9, weaken: 1 },
    ])
    assert.ok(allocations[2].grow > 0, "leftover RAM on a host past the budget still goes to grow")
    // The primary-draw budget itself: 11 (a) + 4 (b) + 0 (c) = 15, exactly
    // exhausted — this is the number weakenBudgetNonNegative now asserts on,
    // deliberately excluding the grow-offset additions (see the function's
    // own doc comment for why conflating the two would be a false alarm).
    assert.equal(weakenBudgetRemaining, 0)
  })

  test("weaken plan: budget larger than total network capacity leaves a positive remainder", () => {
    const hosts = [
      { host: "a", reclaimableRam: 20 },
      { host: "b", reclaimableRam: 20 },
      { host: "c", reclaimableRam: 20 },
    ]
    const { allocations, weakenBudgetRemaining } = computeDesiredAllocation({
      hosts,
      plan: { type: "weaken" },
      weakenBudget: 50, // total capacity is only 3*11=33
      ramInfo: RAM_INFO,
      securityConstants: SECURITY_CONSTANTS,
    })
    for (const a of allocations) assert.equal(a.weaken, 11, `${a.host} should max out its own capacity`)
    assert.equal(weakenBudgetRemaining, 50 - 33)
  })

  test("weaken plan: regression, sum of primary draws never exceeds the budget across many hosts", () => {
    // The exact class of bug this replaced: with 37 hosts and a budget of
    // 75 (hacking-strategy.md's live numbers), no combination of per-host
    // rounding should ever let the total primary draw exceed 75.
    const hosts = Array.from({ length: 37 }, (_, i) => ({ host: `h${i}`, reclaimableRam: 16 }))
    const { allocations, weakenBudgetRemaining } = computeDesiredAllocation({
      hosts,
      plan: { type: "weaken" },
      weakenBudget: 75,
      ramInfo: RAM_INFO,
      securityConstants: SECURITY_CONSTANTS,
    })
    assert.ok(weakenBudgetRemaining >= 0, "the shared budget must never go negative by construction")
    const totalPrimaryDraw = 75 - weakenBudgetRemaining
    assert.ok(totalPrimaryDraw <= 75)
    assert.ok(allocations.some((a) => a.grow > 0), "hosts past the budget still get grow, not left idle")
  })

  test("work plan: hack/grow/weaken split by weight, maintenance weaken sized off the actual provisional threads", () => {
    const hosts = [{ host: "a", reclaimableRam: 100 }]
    const { allocations } = computeDesiredAllocation({
      hosts,
      plan: { type: "work", weights: { hack: 0.3, grow: 0.7 } },
      weakenBudget: 0,
      ramInfo: RAM_INFO,
      securityConstants: SECURITY_CONSTANTS,
    })
    // provisionalHack=floor(30/1.7)=17, provisionalGrow=floor((100-28.9)/1.75)=40,
    // maintenanceThreads=ceil((17*0.002*4+40*0.004*1.25)/0.05)=ceil(0.336/0.05)=7,
    // actionRam=100-7*1.75=87.75, hack=floor(87.75*0.3/1.7)=15,
    // grow=floor((87.75-15*1.7)/1.75)=35.
    assert.deepEqual(allocations, [{ host: "a", hack: 15, grow: 35, weaken: 7 }])
  })

  test("work plan: maintenance weaken saturating the whole host deploys no hack or grow", () => {
    const hosts = [{ host: "a", reclaimableRam: 100 }]
    const { allocations } = computeDesiredAllocation({
      hosts,
      plan: { type: "work", weights: { hack: 1, grow: 0 } },
      weakenBudget: 0,
      ramInfo: RAM_INFO,
      // Exaggerated hackSecIncrease forces maintenanceThreads past
      // maxWeakenThreads regardless of realistic constants, to exercise
      // the saturation branch deterministically.
      securityConstants: { ...SECURITY_CONSTANTS, hackSecIncrease: 10 },
    })
    assert.deepEqual(allocations, [{ host: "a", hack: 0, grow: 0, weaken: 57 }]) // floor(100/1.75)
  })

  test("regression: R3's fix — hack is desired once weights want it, even coming off a weaken phase", () => {
    // The live bug: WORK_WEIGHTS_BY_BUCKET's non-zero hack share used to
    // never actually get deployed once a host was already running grow from
    // a prior weaken phase (see hostNeedsRedeploy below). computeDesiredAllocation
    // itself is not where that bug lived, but this confirms desired.hack is
    // genuinely nonzero whenever weights.hack is, which is the number
    // hostNeedsRedeploy now diffs against.
    const hosts = [{ host: "a", reclaimableRam: 50 }]
    const { allocations } = computeDesiredAllocation({
      hosts,
      plan: { type: "work", weights: { hack: 0.3, grow: 0.7 } },
      weakenBudget: 0,
      ramInfo: RAM_INFO,
      securityConstants: SECURITY_CONSTANTS,
    })
    assert.ok(allocations[0].hack > 0, "a nonzero hack weight must produce a nonzero desired hack allocation")
  })

  describe("growSecurityIncreaseForThreads (hacking-strategy.md R7, 2026-08-14)", () => {
    test("omitted: weaken-phase leftover-grow reserve matches the old linear growSecIncrease estimate exactly", () => {
      // Same numbers as the "weaken plan" tests above with reclaimableRam=20,
      // weakenBudget=0 (all leftover, none of the shared budget): confirms
      // every pre-R7 caller/test that doesn't pass the new option keeps its
      // current behavior unchanged.
      const hosts = [{ host: "a", reclaimableRam: 20 }]
      const { allocations } = computeDesiredAllocation({
        hosts,
        plan: { type: "weaken" },
        weakenBudget: 0,
        ramInfo: RAM_INFO,
        securityConstants: SECURITY_CONSTANTS,
      })
      assert.deepEqual(allocations, [{ host: "a", hack: 0, grow: 9, weaken: 1 }])
    })

    test("a function returning the same linear estimate reproduces the omitted-option result exactly", () => {
      const hosts = [{ host: "a", reclaimableRam: 20 }]
      const calls = []
      const { allocations } = computeDesiredAllocation({
        hosts,
        plan: { type: "weaken" },
        weakenBudget: 0,
        ramInfo: RAM_INFO,
        securityConstants: SECURITY_CONSTANTS,
        growSecurityIncreaseForThreads: (growThreads) => {
          calls.push(growThreads)
          return growThreads * SECURITY_CONSTANTS.growSecIncrease
        },
      })
      assert.deepEqual(allocations, [{ host: "a", hack: 0, grow: 9, weaken: 1 }])
      // Called once for the initial leftover-RAM grow count (11), and again
      // after the reserve carve-out shrinks it (9) — the second call is what
      // lets a saturating ns.growthAnalyzeSecurity clamp shrink the reserve
      // itself, not just the grow count it's sized from.
      assert.deepEqual(calls, [11, 9])
    })

    test("a clamped function (e.g. ns.growthAnalyzeSecurity near moneyMax) can zero out the reserve entirely", () => {
      // Stands in for the game's own min(threads, maxThreadsNeeded) clamp
      // (source, NetscriptFunctions.ts) reporting that extra grow threads
      // add no further security once the target is close enough to
      // moneyMax — the whole point of R7's switch away from the unclamped
      // linear estimate above, which would keep reserving weaken forever.
      const hosts = [{ host: "a", reclaimableRam: 20 }]
      const { allocations } = computeDesiredAllocation({
        hosts,
        plan: { type: "weaken" },
        weakenBudget: 0,
        ramInfo: RAM_INFO,
        securityConstants: SECURITY_CONSTANTS,
        growSecurityIncreaseForThreads: () => 0,
      })
      // vs. grow:9/weaken:1 above — none of the leftover RAM needs to be
      // reserved for weaken, so it all goes to grow instead.
      assert.deepEqual(allocations, [{ host: "a", hack: 0, grow: 11, weaken: 0 }])
    })
  })
})

describe("countRunningByScript (hacking-strategy.md R5, 2026-08-14)", () => {
  test("sums threads per script, defaulting scripts with nothing running to zero", () => {
    const running = [
      { script: "grow", threads: 10 },
      { script: "weaken", threads: 5 },
      { script: "grow", threads: 3 },
    ]
    assert.deepEqual(countRunningByScript(running), { hack: 0, grow: 13, weaken: 5 })
  })

  test("no running actions gives all zeros", () => {
    assert.deepEqual(countRunningByScript([]), { hack: 0, grow: 0, weaken: 0 })
  })
})

describe("missingDesiredScripts — action-specific redeploy escape hatch", () => {
  test("starts missing grow without requiring an immature weaken loop to be killed", () => {
    const running = [{ script: "weaken", target: "t", threads: 1800, elapsedS: 30 }]
    assert.deepEqual(missingDesiredScripts(running, { hack: 0, grow: 9000, weaken: 62 }), ["grow"])
  })

  test("does not relaunch an action that already has threads running", () => {
    const running = [{ script: "grow", target: "t", threads: 10, elapsedS: 1 }]
    assert.deepEqual(missingDesiredScripts(running, { hack: 0, grow: 50, weaken: 0 }), [])
  })
})

describe("hostNeedsRedeploy — 2026-08-13 rewrite: allocation-quantity diff, not action-type match (R3)", () => {
  // Replaces the pre-R3 forceRebalance/action-type version (see git history
  // for that comment) — a work-weight bucket change now shows up as a
  // desired-vs-running mismatch automatically, so it no longer needs its
  // own flag; see mcp_logic.js's own comment on the function for the two
  // live bugs this fixed.
  const actionDurationsS = { hack: 5, grow: 15, weaken: 16 }
  const tolerance = { absolute: 2, relative: 0.2 }

  test("regression: a quantity mismatch does not kill a grow call that hasn't had time to finish", () => {
    const running = [{ script: "grow", target: "foodnstuff", threads: 10, elapsedS: 4 }] // 4s into a 15s call
    const needsRedeploy = hostNeedsRedeploy({
      target: "foodnstuff",
      plan: { type: "work" },
      running,
      desired: { hack: 0, grow: 50, weaken: 0 },
      tolerance,
      actionDurationsS,
    })
    assert.equal(needsRedeploy, false, "a quantity mismatch must not cut off an in-flight grow call")
  })

  test("a quantity mismatch redeploys once every running action has had a full call's worth of time", () => {
    const running = [{ script: "grow", target: "foodnstuff", threads: 10, elapsedS: 15 }] // >= growTimeS
    const needsRedeploy = hostNeedsRedeploy({
      target: "foodnstuff",
      plan: { type: "work" },
      running,
      desired: { hack: 0, grow: 50, weaken: 0 },
      tolerance,
      actionDurationsS,
    })
    assert.equal(needsRedeploy, true)
  })

  test("waits for the slowest running action type, not just any of them", () => {
    // grow has had enough time (15 >= 15) but weaken hasn't (10 < 16) — must
    // not redeploy and cut the weaken call short just because grow is ready.
    const running = [
      { script: "grow", target: "foodnstuff", threads: 10, elapsedS: 15 },
      { script: "weaken", target: "foodnstuff", threads: 5, elapsedS: 10 },
    ]
    const needsRedeploy = hostNeedsRedeploy({
      target: "foodnstuff",
      plan: { type: "weaken" },
      running,
      desired: { hack: 0, grow: 50, weaken: 20 },
      tolerance,
      actionDurationsS,
    })
    assert.equal(needsRedeploy, false)
  })

  test("running actions within tolerance of desired never redeploy regardless of elapsed time", () => {
    const running = [{ script: "grow", target: "foodnstuff", threads: 10, elapsedS: 0.1 }]
    const needsRedeploy = hostNeedsRedeploy({
      target: "foodnstuff",
      plan: { type: "work" },
      running,
      desired: { hack: 0, grow: 11, weaken: 0 }, // within the absolute-2 slack
      tolerance,
      actionDurationsS,
    })
    assert.equal(needsRedeploy, false)
  })

  test("structural mismatch — no running actions at all — redeploys immediately", () => {
    const needsRedeploy = hostNeedsRedeploy({
      target: "foodnstuff",
      plan: { type: "work" },
      running: [],
      desired: { hack: 5, grow: 5, weaken: 0 },
      tolerance,
      actionDurationsS,
    })
    assert.equal(needsRedeploy, true)
  })

  test("structural mismatch — running against the wrong target — redeploys immediately, ignoring elapsed time", () => {
    const running = [{ script: "grow", target: "some-other-server", threads: 10, elapsedS: 0 }]
    const needsRedeploy = hostNeedsRedeploy({
      target: "foodnstuff",
      plan: { type: "work" },
      running,
      desired: { hack: 0, grow: 10, weaken: 0 },
      tolerance,
      actionDurationsS,
    })
    assert.equal(needsRedeploy, true, "stale target's actions are never worth waiting out")
  })

  test("structural mismatch — weaken plan with a hack thread running — redeploys immediately even if quantities match", () => {
    const running = [{ script: "hack", target: "foodnstuff", threads: 3, elapsedS: 0 }]
    const needsRedeploy = hostNeedsRedeploy({
      target: "foodnstuff",
      plan: { type: "weaken" },
      running,
      desired: { hack: 3, grow: 0, weaken: 0 }, // a "matching" desired still can't save it
      tolerance,
      actionDurationsS,
    })
    assert.equal(needsRedeploy, true, "hack fights an active weaken phase and must go regardless of quantity match")
  })

  test("regression: hack is deployed once desired, even though grow already running 'satisfied' the old type-only check", () => {
    // The 2026-08-13 live bug: a host running grow+weaken from a prior
    // weaken phase was judged "fine" by the old hasGrow-only check once the
    // plan flipped to "work", so hack never got deployed even when the
    // weights wanted it — confirmed live at 846 grow / 145 weaken / 0 hack
    // threads network-wide. desired.hack > 0 while have.hack === 0 must now
    // register as a mismatch on its own.
    const running = [
      { script: "grow", target: "foodnstuff", threads: 20, elapsedS: 30 },
      { script: "weaken", target: "foodnstuff", threads: 5, elapsedS: 30 },
    ]
    const needsRedeploy = hostNeedsRedeploy({
      target: "foodnstuff",
      plan: { type: "work" },
      running,
      desired: { hack: 15, grow: 10, weaken: 2 },
      tolerance,
      actionDurationsS,
    })
    assert.equal(
      needsRedeploy,
      true,
      "wanting hack while none is running must count as a mismatch, not 'fine because grow is present'"
    )
  })

  test("regression: an over-provisioned weaken allocation (the weakenBudgetNonNegative bug) gets scaled back down", () => {
    // The exact live shape from hacking-strategy.md R3: 172 weaken threads
    // running, 75 actually desired.
    const running = [{ script: "weaken", target: "silver-helix", threads: 172, elapsedS: 90 }]
    const needsRedeploy = hostNeedsRedeploy({
      target: "silver-helix",
      plan: { type: "weaken" },
      running,
      desired: { hack: 0, grow: 0, weaken: 75 },
      tolerance,
      actionDurationsS,
    })
    assert.equal(needsRedeploy, true, "an over-provisioned weaken allocation must be scaled back down, not left running")
  })
})

describe("evaluateStuckTarget — the 2026-08-13 floor-eviction bug", () => {
  test("regression: a target sitting at its security floor is never stuck, no matter how long it's been there", () => {
    // The exact live shape: bestSecuritySeen frozen at the floor from a long
    // time ago, stalledMs already far past the window — the case that used
    // to fire the instant requiredWeaken next went nonzero. requiredWeaken
    // is 0 here (at/under goal security), which is what must reset it.
    const result = evaluateStuckTarget({
      currentSecurity: 10,
      bestSecuritySeen: 10,
      securityProgressTime: 1_000,
      requiredWeaken: 0,
      now: 1_000_000,
      stuckWindowMs: 60_000,
      progressThreshold: 0.05,
    })
    assert.equal(result.stuck, false, "a target needing no weaken right now has nothing to be stuck on")
    assert.equal(result.securityProgressTime, 0, "the window must reset, not just be skipped this tick")
    assert.equal(result.bestSecuritySeen, Infinity)
  })

  test("regression: the floor-reset means the very next tick that needs weaken again starts a fresh window", () => {
    // Two consecutive ticks: first at the floor (resets), then security has
    // risen (e.g. a hack thread landed) so requiredWeaken is nonzero again.
    // Before the fix this tick would have inherited the stale, already-
    // expired window and evicted immediately.
    const atFloor = evaluateStuckTarget({
      currentSecurity: 10,
      bestSecuritySeen: 10,
      securityProgressTime: 1_000,
      requiredWeaken: 0,
      now: 500_000,
      stuckWindowMs: 60_000,
      progressThreshold: 0.05,
    })
    const nextTick = evaluateStuckTarget({
      currentSecurity: 12,
      bestSecuritySeen: atFloor.bestSecuritySeen,
      securityProgressTime: atFloor.securityProgressTime,
      requiredWeaken: 40,
      now: 500_100,
      stuckWindowMs: 60_000,
      progressThreshold: 0.05,
    })
    assert.equal(nextTick.stuck, false)
    assert.equal(nextTick.securityProgressTime, 500_100, "a fresh window opens rather than inheriting the stale one")
  })

  test("genuine stall still evicts: security not improving while weaken is actually needed", () => {
    const result = evaluateStuckTarget({
      currentSecurity: 40,
      bestSecuritySeen: 40,
      securityProgressTime: 0,
      requiredWeaken: 300,
      now: 70_000,
      stuckWindowMs: 60_000,
      progressThreshold: 0.05,
    })
    // First call with securityProgressTime 0 only opens the window —
    // eviction requires a second tick past the window with no improvement.
    assert.equal(result.stuck, false)
    const secondTick = evaluateStuckTarget({
      currentSecurity: 40,
      bestSecuritySeen: result.bestSecuritySeen,
      securityProgressTime: result.securityProgressTime,
      requiredWeaken: 300,
      now: result.securityProgressTime + 70_000,
      stuckWindowMs: 60_000,
      progressThreshold: 0.05,
    })
    assert.equal(secondTick.stuck, true, "a target that genuinely never improves must still be evicted")
  })

  test("real improvement resets the window, not stuck", () => {
    const result = evaluateStuckTarget({
      currentSecurity: 30,
      bestSecuritySeen: 40,
      securityProgressTime: 1_000,
      requiredWeaken: 100,
      now: 61_500,
      stuckWindowMs: 60_000,
      progressThreshold: 0.05,
    })
    assert.equal(result.stuck, false)
    assert.equal(result.bestSecuritySeen, 30)
    assert.equal(result.securityProgressTime, 61_500)
  })

  test("within the window with no improvement yet is not stuck", () => {
    const result = evaluateStuckTarget({
      currentSecurity: 40,
      bestSecuritySeen: 40,
      securityProgressTime: 1_000,
      requiredWeaken: 100,
      now: 30_000,
      stuckWindowMs: 60_000,
      progressThreshold: 0.05,
    })
    assert.equal(result.stuck, false)
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

  test("R1 (2026-08-14): a single sawtooth-trough sample at the window's tail no longer reads as declining", () => {
    // Steadily rising trend (0.5 -> 0.85 across 8 samples) — the target is
    // genuinely recovering — but the 9th and final sample happens to land
    // right as a harvest-mode hack call drains money, crashing it to 0.3.
    // The OLD endpoint-only check (last < first) would read 0.3 < 0.5 as
    // "declining" — a false positive purely from sawtooth phase, exactly
    // the noise hacking-strategy.md R1 warns about. The half-window-average
    // check must not be fooled by one unlucky endpoint.
    const risingWithTrailingDip = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.3]
    const result = evaluateMoneyDegradation({
      objective: "money",
      moneyPctSamples: risingWithTrailingDip,
      sampleTarget: risingWithTrailingDip.length,
      degradedThreshold: 0.05,
    })
    assert.equal(result.declining, false, "one low trailing sample on an otherwise rising trend must not read as declining")
    assert.equal(result.moneyDegraded, false)
  })

  test("a genuine sustained decline across both halves of the window still reads as declining", () => {
    // Same shape of noise (one dip doesn't matter) but this time the second
    // half is actually lower on average than the first — the detector must
    // still catch a real decline, not just become permanently deaf to it.
    const trulyDeclining = [0.9, 0.85, 0.8, 0.75, 0.4, 0.35, 0.3, 0.25, 0.6]
    const result = evaluateMoneyDegradation({
      objective: "money",
      moneyPctSamples: trulyDeclining,
      sampleTarget: trulyDeclining.length,
      degradedThreshold: 0.9, // high threshold so this test isolates `declining`
    })
    assert.equal(result.declining, true)
  })
})

describe("evaluateFormulaSwitchVeto — veto-only formulas guard", () => {
  test("is inert while disabled", () => {
    const result = evaluateFormulaSwitchVeto({
      enabled: false, currentTarget: "current", candidateTarget: "candidate", currentScore: 100, candidateScore: 1,
    })
    assert.equal(result.veto, false)
    assert.equal(result.reason, "disabled")
  })

  test("vetoes only an inferior scheduler candidate", () => {
    const result = evaluateFormulaSwitchVeto({
      enabled: true, currentTarget: "current", candidateTarget: "candidate", currentScore: 100, candidateScore: 79,
    })
    assert.equal(result.available, true)
    assert.equal(result.veto, true)
    assert.equal(result.ratio, 0.79)
    assert.equal(result.reason, "candidate-below-threshold")
  })

  test("passes a candidate at the threshold and never substitutes another", () => {
    const result = evaluateFormulaSwitchVeto({
      enabled: true, currentTarget: "current", candidateTarget: "candidate", currentScore: 100, candidateScore: 80,
    })
    assert.equal(result.veto, false)
    assert.equal(result.candidateTarget, "candidate")
    assert.equal(result.reason, "candidate-clears-threshold")
  })

  test("fails closed to the existing switch when formulas data is unavailable", () => {
    const result = evaluateFormulaSwitchVeto({
      enabled: true, currentTarget: "current", candidateTarget: "candidate", currentScore: NaN, candidateScore: 80,
    })
    assert.equal(result.available, false)
    assert.equal(result.veto, false)
    assert.equal(result.reason, "unavailable-score")
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

describe("computeWorkWeights — balance-point sizing (hacking-strategy.md R1, 2026-08-14)", () => {
  const targetMoneyGoal = 0.95

  // p=0.0075, k=0.001 -> growPerHack (r = G/H = 3.2p/k) = 24, matching the
  // doc's own worked example for silver-helix at its floor (§1.1: "r ≈ 24,
  // i.e. a hack share of 3.7%").
  const BALANCED = {
    hackPercentPerThread: 0.0075,
    growLogPerThread: 0.001,
    ...SECURITY_CONSTANTS,
  }

  test("xp mode ignores p/k/moneyPct entirely and always uses the fixed split", () => {
    for (const moneyPct of [0.01, 0.5, 0.99]) {
      const { weightBucket, weights } = computeWorkWeights({
        objective: "xp",
        // Deliberately invalid p/k — xp mode must short-circuit before ever
        // touching them, so this would blow up the balance-point math if it
        // didn't.
        hackPercentPerThread: 0,
        growLogPerThread: 0,
        moneyPct,
        targetMoneyGoal,
        safety: 0.5,
        xpWeightHack: 0.8,
        xpWeightGrow: 0.2,
        ...SECURITY_CONSTANTS,
      })
      assert.equal(weightBucket, "xp")
      assert.deepEqual(weights, { hack: 0.8, grow: 0.2 })
    }
  })

  test("ramp-fallback: unreadable p or k goes all-grow rather than dividing by zero", () => {
    const base = {
      objective: "money",
      moneyPct: 0.5,
      targetMoneyGoal,
      safety: 0.5,
      xpWeightHack: 0.8,
      xpWeightGrow: 0.2,
      ...SECURITY_CONSTANTS,
    }
    for (const bad of [
      { hackPercentPerThread: 0, growLogPerThread: 0.001 },
      { hackPercentPerThread: 0.0075, growLogPerThread: 0 },
      { hackPercentPerThread: -0.01, growLogPerThread: 0.001 },
      { hackPercentPerThread: 0.0075, growLogPerThread: NaN },
    ]) {
      const { weightBucket, weights } = computeWorkWeights({ ...base, ...bad })
      assert.equal(weightBucket, "ramp")
      assert.deepEqual(weights, { hack: 0, grow: 1 })
    }
  })

  test("balanced-point worked example: full readiness, safety=1 matches the doc's ~3.7% hack share", () => {
    const { weightBucket, weights, balancedHackShare, growPerHack } = computeWorkWeights({
      objective: "money",
      ...BALANCED,
      moneyPct: targetMoneyGoal, // readiness = 1
      targetMoneyGoal,
      safety: 1,
      xpWeightHack: 0.8,
      xpWeightGrow: 0.2,
    })
    assert.equal(growPerHack, 24) // r = 3.2 * 0.0075 / 0.001
    // 1 / (1.16 + 1.1*24) = 1/27.56 = 0.036284...
    assert.ok(Math.abs(balancedHackShare - 0.036284) < 1e-5)
    assert.ok(Math.abs(weights.hack - 0.036284) < 1e-5, "safety=1, readiness=1 -> hack share equals the raw balanced share")
    assert.equal(weightBucket, "harvest")
  })

  test("safety scales the hack share linearly at full readiness", () => {
    const withSafety = (safety) =>
      computeWorkWeights({
        objective: "money",
        ...BALANCED,
        moneyPct: targetMoneyGoal,
        targetMoneyGoal,
        safety,
        xpWeightHack: 0.8,
        xpWeightGrow: 0.2,
      }).weights.hack
    const half = withSafety(0.5)
    const full = withSafety(1)
    assert.ok(Math.abs(half - full / 2) < 1e-9, "safety=0.5 must halve the safety=1 hack share exactly")
  })

  test("readiness² ramp: half money gives a quarter of the full-readiness hack share, not half", () => {
    const atReadiness = (readinessFraction) =>
      computeWorkWeights({
        objective: "money",
        ...BALANCED,
        moneyPct: targetMoneyGoal * readinessFraction,
        targetMoneyGoal,
        safety: 1,
        xpWeightHack: 0.8,
        xpWeightGrow: 0.2,
      }).weights.hack
    const full = atReadiness(1)
    const half = atReadiness(0.5)
    assert.ok(Math.abs(half - full * 0.25) < 1e-9, "readiness=0.5 -> readiness²=0.25, quartering the hack share")
  })

  test("moneyPct at exactly zero is the only case that still lands in ramp (hack==0)", () => {
    const result = computeWorkWeights({
      objective: "money",
      ...BALANCED,
      moneyPct: 0,
      targetMoneyGoal,
      safety: 1,
      xpWeightHack: 0.8,
      xpWeightGrow: 0.2,
    })
    assert.equal(result.weights.hack, 0)
    assert.equal(result.weightBucket, "ramp")

    // Any nonzero money at all already yields harvest (a tiny nonzero hack
    // share), unlike the old bucket ladder's hard 0.1 "empty" cutoff.
    const barelyAbove = computeWorkWeights({
      objective: "money",
      ...BALANCED,
      moneyPct: 1e-6,
      targetMoneyGoal,
      safety: 1,
      xpWeightHack: 0.8,
      xpWeightGrow: 0.2,
    })
    assert.ok(barelyAbove.weights.hack > 0)
    assert.equal(barelyAbove.weightBucket, "harvest")
  })

  test("readiness is capped at 1 — money above the goal doesn't push the hack share past the balanced share", () => {
    const atGoal = computeWorkWeights({
      objective: "money",
      ...BALANCED,
      moneyPct: targetMoneyGoal,
      targetMoneyGoal,
      safety: 1,
      xpWeightHack: 0.8,
      xpWeightGrow: 0.2,
    }).weights.hack
    const aboveGoal = computeWorkWeights({
      objective: "money",
      ...BALANCED,
      moneyPct: 1, // 100% money > targetMoneyGoal (0.95)
      targetMoneyGoal,
      safety: 1,
      xpWeightHack: 0.8,
      xpWeightGrow: 0.2,
    }).weights.hack
    assert.ok(Math.abs(atGoal - aboveGoal) < 1e-12)
  })

  test("weights.hack + weights.grow sums to 1 (or effectively 1) across the input space", () => {
    const moneyPcts = [0, 0.001, 0.05, 0.3, 0.5, 0.7, 0.95, 1]
    const safeties = [0, 0.5, 0.7, 1]
    const pkPairs = [
      { hackPercentPerThread: 0.0075, growLogPerThread: 0.001 }, // r = 24
      { hackPercentPerThread: 0.5, growLogPerThread: 0.01 }, // r small
      { hackPercentPerThread: 0.001, growLogPerThread: 0.5 }, // r tiny
    ]
    for (const moneyPct of moneyPcts) {
      for (const safety of safeties) {
        for (const pk of pkPairs) {
          const { weights } = computeWorkWeights({
            objective: "money",
            ...pk,
            ...SECURITY_CONSTANTS,
            moneyPct,
            targetMoneyGoal,
            safety,
            xpWeightHack: 0.8,
            xpWeightGrow: 0.2,
          })
          assert.ok(
            Math.abs(weights.hack + weights.grow - 1) < 1e-9,
            `hack+grow must sum to 1 (got ${weights.hack + weights.grow} for moneyPct=${moneyPct} safety=${safety})`
          )
        }
      }
    }
  })
})

describe("computeTargetScore — achievable-rate target score (hacking-strategy.md R4, 2026-08-14)", () => {
  // Same p=0.0075/k=0.001 pair (r=24) computeWorkWeights's own R1 tests use,
  // traceable to the doc's silver-helix-at-its-floor worked example
  // (§1.1: "r ≈ 24, i.e. a hack share of 3.7%"). poolThreads=1008 approximates
  // the live baseline's 1764GB pool at ~1.75GB/thread (1764/1.75≈1008). The
  // doc's own §1.3 table entry for silver-helix ($13.3M/s, H*=38) isn't
  // independently reproducible from what's written there — it bakes in
  // specific p/T/chance/mults values the doc never states together as a
  // single row — so this is a hand-derived regression value (computed and
  // asserted the same way the R1 tests assert `1/(1.16+1.1*24)`), not a
  // literal transcription of the table. It does land close to the table's
  // $13.3M/s ($14.07M/s here), which is a reasonable sanity cross-check.
  const WORKED = {
    hackTime: 14.6,
    hackPercentPerThread: 0.0075,
    growLogPerThread: 0.001,
    maxMoney: 1.125e9,
    hackChance: 1,
    poolThreads: 1008,
    growTimeRatio: 3.2,
    ...SECURITY_CONSTANTS,
  }

  test("growPerHack/balancedHackShare match computeWorkWeights's identical p/k inputs (shared balance-point math)", () => {
    const workWeights = computeWorkWeights({
      objective: "money",
      hackPercentPerThread: 0.0075,
      growLogPerThread: 0.001,
      moneyPct: 0.95,
      targetMoneyGoal: 0.95,
      safety: 1,
      xpWeightHack: 0.8,
      xpWeightGrow: 0.2,
      ...SECURITY_CONSTANTS,
    })
    const { growPerHack, balancedHackShare } = computeTargetScore(WORKED)
    assert.equal(growPerHack, workWeights.growPerHack)
    assert.ok(Math.abs(balancedHackShare - workWeights.balancedHackShare) < 1e-12)
  })

  test("worked example: balance-point rate for a silver-helix-like target", () => {
    const { score, growPerHack, balancedHackShare, hackThreads } = computeTargetScore(WORKED)
    assert.equal(growPerHack, 24) // r = 3.2 * 0.0075 / 0.001
    assert.ok(Math.abs(balancedHackShare - 0.036284470246734396) < 1e-9)
    assert.ok(Math.abs(hackThreads - 36.574746008708274) < 1e-6)
    assert.ok(Math.abs(score - 14069748.62627649) < 1)
  })

  test("zero score when hackTime/p/k are unreadable, instead of dividing by zero", () => {
    for (const bad of [
      { hackTime: 0 },
      { hackTime: -1 },
      { hackPercentPerThread: 0 },
      { hackPercentPerThread: -0.01 },
      { growLogPerThread: 0 },
      { growLogPerThread: NaN },
    ]) {
      const { score } = computeTargetScore({ ...WORKED, ...bad })
      assert.equal(score, 0, `expected 0 for ${JSON.stringify(bad)}`)
    }
  })

  test("score is zero when poolThreads is zero — no threads, nothing drained", () => {
    const { score } = computeTargetScore({ ...WORKED, poolThreads: 0 })
    assert.equal(score, 0)
  })

  test("score rises with poolThreads but saturates at the grow-throughput ceiling", () => {
    const s1 = computeTargetScore({ ...WORKED, poolThreads: 100 }).score
    const s2 = computeTargetScore({ ...WORKED, poolThreads: 1000 }).score
    const s3 = computeTargetScore({ ...WORKED, poolThreads: 5000 }).score
    const s4 = computeTargetScore({ ...WORKED, poolThreads: 100000 }).score
    assert.ok(s1 < s2 && s2 < s3 && s3 < s4, "more pool capacity should never lower the score")
    const ceiling = (WORKED.maxMoney * WORKED.hackChance) / (WORKED.growTimeRatio * WORKED.hackTime)
    // <= rather than strictly <: at a large enough poolThreads, `drained`'s
    // exp(-huge) term underflows to exactly 0 in double precision, so the
    // score reaches the ceiling exactly rather than approaching it forever.
    assert.ok(s4 <= ceiling, "score can never exceed the fully-drained ceiling")
    assert.ok(ceiling - s3 < ceiling * 0.02, "a large pool should nearly saturate the ceiling")
  })

  test("a better grow-per-hack ratio (r) scores higher even with identical maxMoney/hackTime/p — the whole point of R4", () => {
    const base = { hackTime: 20, maxMoney: 1e9, hackChance: 1, poolThreads: 1000, growTimeRatio: 3.2, ...SECURITY_CONSTANTS }
    const goodGrowth = computeTargetScore({ ...base, hackPercentPerThread: 0.01, growLogPerThread: 0.01 }).score // r = 3.2
    const poorGrowth = computeTargetScore({ ...base, hackPercentPerThread: 0.01, growLogPerThread: 0.0005 }).score // r = 64
    assert.ok(
      goodGrowth > poorGrowth,
      "the old maxMoney*p*chance/hackTime score can't tell these apart at all (identical maxMoney/hackTime/p) — R4's score must, since it's exactly the case the doc's misranking table demonstrates"
    )
  })
})

describe("computeTargetEffectiveScore — ramp-cost discount (hacking-strategy.md R4, 2026-08-14)", () => {
  const BASE = {
    score: 14069748.62627649,
    hackTime: 14.6,
    growLogPerThread: 0.001,
    maxMoney: 1.125e9,
    growThreadsIfAllGrow: 1008,
    growTimeRatio: 3.2,
    horizonSeconds: 3600,
    targetMoneyGoal: 0.95,
  }

  test("zero raw score stays zero regardless of ramp inputs", () => {
    const { effective } = computeTargetEffectiveScore({ ...BASE, score: 0, money: 1e6 })
    assert.equal(effective, 0)
  })

  test("no pool to grow with (growThreadsIfAllGrow<=0) collapses effective to zero even with a positive raw score", () => {
    const { effective } = computeTargetEffectiveScore({ ...BASE, growThreadsIfAllGrow: 0, money: 1e6 })
    assert.equal(effective, 0)
  })

  test("unreadable growLogPerThread/hackTime collapse effective to zero", () => {
    for (const bad of [{ growLogPerThread: 0 }, { growLogPerThread: NaN }, { hackTime: 0 }]) {
      const { effective } = computeTargetEffectiveScore({ ...BASE, ...bad, money: 1e6 })
      assert.equal(effective, 0, `expected 0 for ${JSON.stringify(bad)}`)
    }
  })

  test("already at or above the goal money: zero ramp, effective equals the raw score exactly", () => {
    const { effective, rampSeconds } = computeTargetEffectiveScore({ ...BASE, money: BASE.maxMoney })
    assert.equal(rampSeconds, 0)
    assert.equal(effective, BASE.score)
  })

  test("worked example: a drained silver-helix-like target discounted by its modelled ramp time", () => {
    const { effective, rampSeconds } = computeTargetEffectiveScore({ ...BASE, money: BASE.maxMoney * 0.05 })
    assert.ok(Math.abs(rampSeconds - 136.47240982803183) < 0.01)
    assert.ok(Math.abs(effective - 13555859.51106395) < 1)
    assert.ok(effective < BASE.score, "a drained target must be discounted below its raw potential")
  })

  test("a longer horizon discounts less; effective approaches the raw score as horizon -> infinity", () => {
    const args = { ...BASE, score: 1e6, growThreadsIfAllGrow: 500, money: 1e6 }
    const short = computeTargetEffectiveScore({ ...args, horizonSeconds: 60 }).effective
    const mid = computeTargetEffectiveScore({ ...args, horizonSeconds: 3600 }).effective
    const veryLong = computeTargetEffectiveScore({ ...args, horizonSeconds: 1e9 }).effective
    assert.ok(short < mid && mid < veryLong, "a longer horizon must never discount more than a shorter one")
    assert.ok(veryLong / args.score > 0.999, "an enormous horizon should nearly erase the ramp discount")
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
