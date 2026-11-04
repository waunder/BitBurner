/**
 * Tests for mcpMulti_logic.js — the multi-target partitioning logic.
 * Run with: node --test mcpMulti_logic.test.js
 *
 * This is the "test logic to experiment" deliverable: the partitioning
 * heuristic (how much pool a target needs before it saturates, how hosts
 * get split across targets) is exercised here with synthetic scenarios,
 * deterministically and in milliseconds, before mcpMulti.js ever risks a
 * live thread against the game.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { computeTargetPoolNeed, partitionHostsAcrossTargets } from "./mcpMulti_logic.js"

// Same real constants mcp_logic.test.js uses (mcp.js's own RAM/security
// readouts — see hacking-mechanics.md).
const SECURITY_CONSTANTS = {
  hackSecIncrease: 0.002,
  growSecIncrease: 0.004,
  weakenSecDecrease: 0.05,
  weakenPerHackRatio: 4,
  weakenPerGrowRatio: 1.25,
}
const GROW_TIME_RATIO = SECURITY_CONSTANTS.weakenPerHackRatio / SECURITY_CONSTANTS.weakenPerGrowRatio // 3.2
const WEAKEN_RAM = 1.75

describe("computeTargetPoolNeed", () => {
  test("unreadable inputs need nothing (mirrors computeTargetScore's own guard)", () => {
    const result = computeTargetPoolNeed({
      hackPercentPerThread: 0,
      growLogPerThread: 0.1,
      growTimeRatio: GROW_TIME_RATIO,
      saturationFraction: 0.9,
      ...SECURITY_CONSTANTS,
    })
    assert.equal(result.poolThreadsNeeded, 0)
    assert.equal(result.hackThreadsNeeded, 0)
  })

  test("invalid saturationFraction fails open to unbounded need", () => {
    const readable = { hackPercentPerThread: 0.01, growLogPerThread: 0.05 }
    for (const bad of [0, 1, -0.5, 1.5, NaN, undefined]) {
      const result = computeTargetPoolNeed({
        ...readable,
        growTimeRatio: GROW_TIME_RATIO,
        saturationFraction: bad,
        ...SECURITY_CONSTANTS,
      })
      assert.equal(result.poolThreadsNeeded, Infinity, `saturationFraction=${bad}`)
    }
  })

  test("higher hackPercentPerThread (easier target) needs fewer threads to saturate", () => {
    const base = {
      growLogPerThread: 0.05,
      growTimeRatio: GROW_TIME_RATIO,
      saturationFraction: 0.9,
      ...SECURITY_CONSTANTS,
    }
    const easy = computeTargetPoolNeed({ ...base, hackPercentPerThread: 0.05 })
    const hard = computeTargetPoolNeed({ ...base, hackPercentPerThread: 0.005 })
    assert.ok(easy.poolThreadsNeeded < hard.poolThreadsNeeded)
  })

  test("need is finite and positive for a normal readable target", () => {
    const result = computeTargetPoolNeed({
      hackPercentPerThread: 0.02,
      growLogPerThread: 0.08,
      growTimeRatio: GROW_TIME_RATIO,
      saturationFraction: 0.9,
      ...SECURITY_CONSTANTS,
    })
    assert.ok(Number.isFinite(result.poolThreadsNeeded))
    assert.ok(result.poolThreadsNeeded > 0)
  })
})

describe("partitionHostsAcrossTargets", () => {
  const hosts = (spec) => spec.map(([host, reclaimableRam]) => ({ host, reclaimableRam }))

  test("single dominant target absorbs the whole pool (regression: matches today's single-target mcp.js)", () => {
    const result = partitionHostsAcrossTargets({
      candidates: [{ server: "only-target", effectiveScore: 100, need: 500 }],
      hosts: hosts([["home", 128], ["n1", 16], ["n2", 8]]),
      maxConcurrentTargets: 3,
      weakenRam: WEAKEN_RAM,
    })
    assert.equal(result.assignments.length, 1)
    assert.equal(result.assignments[0].target, "only-target")
    assert.deepEqual(result.assignments[0].hosts.sort(), ["home", "n1", "n2"])
    assert.equal(result.unassignedHosts.length, 0)
  })

  test("low-need top target gets only what it needs, rest spills to the next target", () => {
    // home (128GB / 1.75 ~= 73 threads) alone covers target A's need of 20.
    const result = partitionHostsAcrossTargets({
      candidates: [
        { server: "A", effectiveScore: 100, need: 20 },
        { server: "B", effectiveScore: 50, need: 1000 },
      ],
      hosts: hosts([["home", 128], ["n1", 32]]),
      maxConcurrentTargets: 2,
      weakenRam: WEAKEN_RAM,
    })
    const byTarget = Object.fromEntries(result.assignments.map((a) => [a.target, a]))
    assert.deepEqual(byTarget.A.hosts, ["home"])
    assert.deepEqual(byTarget.B.hosts, ["n1"])
  })

  test("small saturating targets each get satisfied and leftover spills to the top scorer", () => {
    const result = partitionHostsAcrossTargets({
      candidates: [
        { server: "top", effectiveScore: 100, need: 10 },
        { server: "mid", effectiveScore: 80, need: 10 },
        { server: "low", effectiveScore: 60, need: 10 },
      ],
      // 4 hosts of 32GB (~18 threads each): first three satisfy each
      // target's need of 10 in turn, the fourth has nowhere else to go and
      // should return to "top" rather than pile onto "low".
      hosts: hosts([["h1", 32], ["h2", 32], ["h3", 32], ["h4", 32]]),
      maxConcurrentTargets: 3,
      weakenRam: WEAKEN_RAM,
    })
    const byTarget = Object.fromEntries(result.assignments.map((a) => [a.target, a]))
    assert.deepEqual(byTarget.top.hosts.sort(), ["h1", "h4"])
    assert.deepEqual(byTarget.mid.hosts, ["h2"])
    assert.deepEqual(byTarget.low.hosts, ["h3"])
  })

  test("maxConcurrentTargets caps how many candidates are ever considered", () => {
    const result = partitionHostsAcrossTargets({
      candidates: [
        { server: "A", effectiveScore: 100, need: 1 },
        { server: "B", effectiveScore: 90, need: 1 },
        { server: "C", effectiveScore: 80, need: 1 },
        { server: "D", effectiveScore: 70, need: 1000 },
      ],
      hosts: hosts([["h1", 4], ["h2", 4], ["h3", 4], ["h4", 4]]),
      maxConcurrentTargets: 2,
      weakenRam: WEAKEN_RAM,
    })
    const targets = result.assignments.map((a) => a.target).sort()
    assert.deepEqual(targets, ["A", "B"])
  })

  test("a weaken-phase need (finite, passed as-is) is honored before any saturation math applies", () => {
    // Caller is responsible for passing requiredWeaken as `need` when a
    // target is mid-weaken (see mcpMulti.js) — this just confirms the
    // partitioner treats that number like any other finite need.
    const result = partitionHostsAcrossTargets({
      candidates: [
        { server: "weakening", effectiveScore: 100, need: 5 },
        { server: "other", effectiveScore: 90, need: 1000 },
      ],
      hosts: hosts([["h1", 16], ["h2", 16]]),
      maxConcurrentTargets: 2,
      weakenRam: WEAKEN_RAM,
    })
    const byTarget = Object.fromEntries(result.assignments.map((a) => [a.target, a]))
    assert.deepEqual(byTarget.weakening.hosts, ["h1"])
    assert.deepEqual(byTarget.other.hosts, ["h2"])
  })

  test("no candidates leaves every host unassigned", () => {
    const result = partitionHostsAcrossTargets({
      candidates: [],
      hosts: hosts([["h1", 16], ["h2", 8]]),
      maxConcurrentTargets: 3,
      weakenRam: WEAKEN_RAM,
    })
    assert.equal(result.assignments.length, 0)
    assert.deepEqual(result.unassignedHosts.sort(), ["h1", "h2"])
  })

  test("a tiny host still gets assigned predictably (0 threads worth, but tracked)", () => {
    const result = partitionHostsAcrossTargets({
      candidates: [{ server: "only", effectiveScore: 100, need: 1000 }],
      hosts: hosts([["tiny", 1]]), // 1GB / 1.75 -> 0 threads
      maxConcurrentTargets: 1,
      weakenRam: WEAKEN_RAM,
    })
    assert.equal(result.assignments.length, 1)
    assert.deepEqual(result.assignments[0].hosts, ["tiny"])
    assert.equal(result.assignments[0].poolThreadsAssigned, 0)
  })
})
