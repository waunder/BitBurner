import test from "node:test";
import assert from "node:assert/strict";
import { canBuildTerritoryPower, moneyModePriority, planMoneyTasks, planReputationTasks,
  planTerritoryPower, shouldAscendMember, shouldEngageTerritoryClashes, wantedCleanupPolicy } from "./gang_logic.js";

test("money mode prioritizes wanted recovery over blocked recruitment growth", () => {
  assert.equal(moneyModePriority(true, true, true), "wanted-recovery");
  assert.equal(moneyModePriority(false, true, true), "respect");
  assert.equal(moneyModePriority(true, false, true), "respect");
  assert.equal(moneyModePriority(false, true, false), "cash");
});

test("severe cleanup escalates by 40x with hysteresis and feasible exit threshold", () => {
  let policy = wantedCleanupPolicy(0.0003, false, true, 6);
  assert.equal(policy.severeMode, true);
  assert.equal(policy.reductionFraction, 0.04);
  assert.equal(policy.cleanupMode, true);
  policy = wantedCleanupPolicy(0.07, policy.severeMode, policy.cleanupMode, 6);
  assert.equal(policy.severeMode, true);
  assert.equal(policy.cleanupMode, true);
  policy = wantedCleanupPolicy(0.10, policy.severeMode, policy.cleanupMode, 6);
  assert.equal(policy.severeMode, false);
  assert.equal(policy.reductionFraction, 0.001);
  const attainable = 6 / 7;
  policy = wantedCleanupPolicy(attainable * 0.992, false, true, 6);
  assert.equal(policy.cleanupMode, true);
  policy = wantedCleanupPolicy(attainable * 0.996, false, policy.cleanupMode, 6);
  assert.equal(policy.cleanupMode, false);
  assert.equal(wantedCleanupPolicy(0.8, false, false, 6).reductionFraction, 0.001);
});

test("territory power policy builds only in safe idle money mode", () => {
  const base = { objective: "money", cleanupMode: false, territory: 0.2, rosterFull: true, hasRivals: true,
    taskAvailable: true, combatReady: true, clashSafe: true, currentlyEngaged: false, oddsPass: false };
  assert.equal(canBuildTerritoryPower(base), true);
  assert.equal(canBuildTerritoryPower({ ...base, objective: "reputation" }), false);
  assert.equal(canBuildTerritoryPower({ ...base, cleanupMode: true }), false);
  assert.equal(canBuildTerritoryPower({ ...base, clashSafe: false }), false);
  assert.equal(canBuildTerritoryPower({ ...base, currentlyEngaged: true }), false);
  assert.equal(canBuildTerritoryPower({ ...base, clashSafe: false,
    currentlyEngaged: true, oddsPass: true }), true);
  assert.equal(canBuildTerritoryPower({ ...base, currentlyEngaged: true,
    oddsPass: false }), false);
  assert.equal(canBuildTerritoryPower({ ...base, territory: 0.99 }), false);
  assert.equal(canBuildTerritoryPower({ ...base, rosterFull: false }), false);
});

test("territory builder cohort takes only the lowest-value trained earners", () => {
  const plans = [
    { member: { name: "high" }, trained: true, choice: { task: "cash", money: 100 } },
    { member: { name: "low" }, trained: true, choice: { task: "cash", money: 10 } },
    { member: { name: "trainee" }, trained: false, choice: { task: "Train", money: 0 } },
    { member: { name: "mid" }, trained: true, choice: { task: "cash", money: 50 } },
  ];
  const result = planTerritoryPower(plans, "Territory Warfare", 0.35);
  assert.deepEqual(result.filter((plan) => plan.role === "territory-power").map((plan) => plan.member.name), ["low", "mid"]);
  assert.equal(result[2].choice.task, "Train");
});

test("clashes require both a per-rival floor and weighted expected odds", () => {
  assert.equal(shouldEngageTerritoryClashes(0.5, [
    { territory: 0.5, chance: 0.91 }, { territory: 0.5, chance: 0.95 },
  ], 0.90, 0.90).engage, true);
  assert.equal(shouldEngageTerritoryClashes(0.5, [
    { territory: 0.9, chance: 0.91 }, { territory: 0.1, chance: 0.89 },
  ], 0.90, 0.90).engage, false);
  assert.equal(shouldEngageTerritoryClashes(0.5, [
    { territory: 0.9, chance: 0.99 }, { territory: 0.1, chance: 0.10 },
  ], 0.90, 0.90).engage, false);
  assert.equal(shouldEngageTerritoryClashes(0.5, [
    { territory: 1, chance: Number.NaN },
  ], 0.90, 0.90).engage, false);
  assert.equal(shouldEngageTerritoryClashes(0.99, [
    { territory: 1, chance: 0.99 },
  ], 0.90, 0.90).engage, false);
});

test("ascension is suppressed during cleanup and territory power, and limited by wanted slack", () => {
  const candidate = { objective: "money", multiplier: 1.5, threshold: 1.25,
    respect: 100, respectToDeduct: 10, wantedLevel: 1, cleanupEnterRatio: 0.99 };
  assert.equal(shouldAscendMember({ ...candidate, cleanupMode: true }), false);
  assert.equal(shouldAscendMember({ ...candidate, severeMode: true }), false);
  assert.equal(shouldAscendMember({ ...candidate, territoryPowerMode: true }), false);
  assert.equal(shouldAscendMember({ ...candidate, objective: "reputation" }), false);
  assert.equal(shouldAscendMember({ ...candidate, respectToDeduct: 1, wantedLevel: 1 }), true);
  assert.equal(shouldAscendMember({ ...candidate, respectToDeduct: 99, wantedLevel: 1 }), false);
  assert.equal(shouldAscendMember({ ...candidate, multiplier: 1.2 }), false);
});

function plan(name, respect, wanted, cleanRespect, cleanWanted) {
  return {
    member: { name }, trained: true,
    choice: { task: "money-task", respect: respect, wanted: wanted },
    respect: { task: "respect-task", respect, wanted },
    clean: { task: "clean-task", respect: cleanRespect, wanted: cleanWanted },
  };
}

test("reputation allocation uses respect tasks for non-cleaners and meets wanted target", () => {
  const plans = [plan("a", 10, 5, 4, -10), plan("b", 9, 4, 3, -10)];
  const result = planReputationTasks(plans, 1000, 0.001);
  assert.equal(result.targetMet, true);
  assert.ok(Math.abs(result.projectedWantedRate + 5.095) < 1e-9);
  assert.deepEqual(result.assignments.map((item) => item.choice.task), ["respect-task", "clean-task"]);
  assert.deepEqual(result.assignments.map((item) => item.role), ["respect", "wanted-recovery"]);
  assert.equal(result.projectedRespectRate, 13);
});

test("if the wanted target is infeasible, allocation maximizes wanted reduction", () => {
  const plans = [plan("a", 10, 20, 4, -0.2)];
  const result = planReputationTasks(plans, 1000, 0.02);
  assert.equal(result.targetMet, false);
  assert.ok(Math.abs(result.projectedWantedRate + 0.2998) < 1e-9);
  assert.deepEqual(result.assignments.map((item) => item.choice.task), ["clean-task"]);
});

test("cleaner multiplier applies after batched task wanted gains", () => {
  const item = plan("a", 100, 5, 0, -10);
  const result = planReputationTasks([item], 1000, 0.001, 10);
  const actualPerCycle = ((1000 + (-10 * 10)) * 0.999 - 1000) / 10;
  assert.ok(Math.abs(result.projectedWantedRate - actualPerCycle) < 1e-9);
});

test("wanted target is per batch, preserving respect work when one cleaner suffices", () => {
  const plans = Array.from({ length: 10 }, (_, i) => plan(String(i), 10, 0, 0.1, -0.01));
  const result = planReputationTasks(plans, 1000, 0.001, 10);
  assert.equal(result.targetWantedRate, -0.1);
  assert.equal(result.cleanerCount, 1);
  assert.equal(result.targetMet, true);
  assert.ok(result.projectedRespectRate >= 90);
});

test("wanted target and projection stay in per-cycle units for shorter batches", () => {
  const result = planReputationTasks([plan("a", 10, 0, 0.1, -0.01)], 1000, 0.001, 5);
  assert.equal(result.targetWantedRate, -0.2);
  assert.ok(Math.abs(result.projectedWantedRate - (-0.20999)) < 1e-9);
});

test("money cleanup chooses the highest-money subset that meets wanted target", () => {
  const plans = Array.from({ length: 4 }, (_, i) => ({
    member: { name: String(i) }, trained: true,
    choice: { task: "money", money: 100, respect: 0, wanted: 0.02 },
    clean: { task: "clean", money: 0, respect: 0, wanted: -0.01 },
  }));
  const result = planMoneyTasks(plans, 1000, 0.001, 10);
  assert.equal(result.targetMet, true);
  assert.equal(result.cleanerCount, 2);
  assert.equal(result.projectedMoneyRate, 200);
  assert.deepEqual(result.assignments.map((item) => item.role), [
    "wanted-recovery", "wanted-recovery", "money", "money",
  ]);
});

test("severe wanted target uses more cleaners and projects faster recovery", () => {
  const plans = Array.from({ length: 5 }, (_, i) => ({
    member: { name: String(i) }, trained: true,
    choice: { task: "money", money: 100, respect: 0, wanted: 50 },
    clean: { task: "clean", money: 0, respect: 0, wanted: -50 },
  }));
  const normal = planMoneyTasks(plans, 20_000, 0.001, 10);
  const severe = planMoneyTasks(plans, 20_000, 0.04, 10);
  assert.equal(normal.cleanerCount, 3);
  assert.equal(severe.cleanerCount, 4);
  assert.ok(severe.projectedWantedRate < normal.projectedWantedRate);
  assert.equal(severe.targetWantedRate, -80);
});

test("money cleanup falls back to the greatest wanted reduction when target is impossible", () => {
  const plans = [
    { member: { name: "cleaner" }, trained: true,
      choice: { task: "money", money: 100, respect: 0, wanted: 0.1 },
      clean: { task: "clean", money: 0, respect: 0, wanted: -0.001 } },
    { member: { name: "worker" }, trained: true,
      choice: { task: "money", money: 100, respect: 0, wanted: 1 }, clean: null },
  ];
  const result = planMoneyTasks(plans, 1000, 0.001, 10);
  assert.equal(result.targetMet, false);
  assert.equal(result.cleanerCount, 1);
  assert.equal(result.assignments[0].choice.task, "clean");
});

test("untrained members retain their training assignment", () => {
  const trainee = { member: { name: "trainee" }, trained: false,
    choice: { task: "Train Hacking", respect: 0, wanted: 0 },
    respect: { task: "respect-task", respect: 8, wanted: 4 },
    clean: { task: "clean-task", respect: 1, wanted: -10 } };
  const result = planReputationTasks([trainee], 1000, 0.001);
  assert.equal(result.assignments[0].choice.task, "Train Hacking");
  assert.equal(result.projectedRespectRate, 0);
});
