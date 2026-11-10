import test from "node:test";
import assert from "node:assert/strict";
import { autoGangObjective, canBuildTerritoryPower, moneyModePriority, planMoneyTasks, planReputationTasks,
  planTerritoryPower, shouldAscendMember, shouldEngageTerritoryClashes, wantedCleanupPolicy, cheapGearQualifies, reputationCleanupMode,
  withEquipment, planReputationGear, equipmentCategory, gearCounts, ascensionCooldownElapsed } from "./gang_logic.js";

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

test("reputation cleanup band uses the absolute penalty with hysteresis", () => {
  assert.equal(reputationCleanupMode(0.997, false), false);
  assert.equal(reputationCleanupMode(0.92, false), false);
  assert.equal(reputationCleanupMode(0.89, false), true);
  assert.equal(reputationCleanupMode(0.93, true), true);
  assert.equal(reputationCleanupMode(0.95, true), false);
  assert.equal(reputationCleanupMode(0.75, false, 0.7, 0.8), false);

  // New gang at the wanted floor: respect 1, wanted 1, penalty 0.5 = attainable; no cleanup.
  assert.equal(reputationCleanupMode(0.5, true, 0.9, 0.95, 0.5), false);
  assert.equal(reputationCleanupMode(0.5, false, 0.9, 0.95, 0.5), false);
  assert.equal(reputationCleanupMode(0.4, false, 0.9, 0.95, 0.5), true);
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

test("ascension is suppressed during cleanup and territory power, and limited by the penalty floor", () => {
  // Live 2026-11-09: respect 47.6k, wanted 7.4k (penalty 0.866), top member x5.12 losing 10.4k respect.
  const candidate = { multiplier: 5.12, threshold: 1.25, respect: 47_600, respectToDeduct: 10_400,
    wantedLevel: 7_400, penaltyFloor: 0.80 };
  assert.equal(shouldAscendMember(candidate), true); // 37.2k / 44.6k = 0.834
  assert.equal(shouldAscendMember({ ...candidate, cleanupMode: true }), false);
  assert.equal(shouldAscendMember({ ...candidate, severeMode: true }), false);
  assert.equal(shouldAscendMember({ ...candidate, territoryPowerMode: true }), false);
  assert.equal(shouldAscendMember({ ...candidate, respectToDeduct: 25_000 }), false); // 22.6k / 30k = 0.75
  assert.equal(shouldAscendMember({ ...candidate, multiplier: 1.2 }), false);
  assert.equal(shouldAscendMember({ ...candidate, multiplier: 1.3 }), true);
  const { threshold, ...noThreshold } = candidate;
  assert.equal(shouldAscendMember({ ...noThreshold, multiplier: 1.26 }), true); // default threshold 1.25
  assert.equal(shouldAscendMember({ ...noThreshold, multiplier: 1.24 }), false);
  assert.equal(shouldAscendMember({ ...candidate, multiplier: undefined }), false);
  // Money mode passes the old near-1 floor: wanted at its minimum allows it, real wanted does not.
  assert.equal(shouldAscendMember({ ...candidate, wantedLevel: 1, penaltyFloor: 0.998 }), true);
  assert.equal(shouldAscendMember({ ...candidate, penaltyFloor: 0.998 }), false);
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

test("cheap gear qualifies only below the cash share and only for stats the gang uses", () => {
  const cash = 1e15;
  assert.equal(cheapGearQualifies({ cost: 5e6, stats: { hack: 1.05 }, cash, isHacking: true }), true);
  assert.equal(cheapGearQualifies({ cost: 5e6, stats: { str: 1.3 }, cash, isHacking: true }), false);
  assert.equal(cheapGearQualifies({ cost: 5e6, stats: { agi: 1.04, cha: 1.04 }, cash, isHacking: true }), true);
  assert.equal(cheapGearQualifies({ cost: 2e11, stats: { hack: 1.15 }, cash, isHacking: true }), false);
  assert.equal(cheapGearQualifies({ cost: 5e6, stats: { str: 1.3 }, cash, isHacking: false }), true);
});

test("withEquipment multiplies the stat level by the item multiplier", () => {
  const member = { hack: 1000, cha: 200, str: 50 };
  const boosted = withEquipment(member, { hack: 1.15, cha: 1.0 });
  assert.equal(boosted.hack, 1150);
  assert.equal(boosted.cha, 200);
  assert.equal(boosted.str, 50);
  assert.equal(member.hack, 1000);
  assert.deepEqual(withEquipment(member, {}), member);
});

test("equipment categories and gear counts", () => {
  assert.equal(equipmentCategory("NUKE Rootkit"), "rootkit");
  assert.equal(equipmentCategory("Quadra Sport R-7"), "vehicle");
  assert.equal(equipmentCategory("DataJack"), "augmentation");
  assert.equal(equipmentCategory("Katana"), "other");
  assert.deepEqual(gearCounts({ upgrades: ["NUKE Rootkit", "Katana", "Hmap Node"], augmentations: ["BitWire"] }),
    { rootkits: 2, augs: 1 });
});

test("reputation gear: rootkits and vehicles at 1% of cash, augmentations at 5%, ranked by respect per dollar", () => {
  const cands = [
    { item: "NUKE Rootkit", cost: 100_000, member: "a", gain: 5, ascRatio: 1 },
    { item: "Demon Rootkit", cost: 20_000_000, member: "a", gain: 50, ascRatio: 1 },   // 2% of cash: too dear
    { item: "Jack the Ripper", cost: 900_000, member: "a", gain: 0, ascRatio: 1 },     // no gain but a rootkit
    { item: "Quadra Sport R-7", cost: 500_000, member: "a", gain: 0, ascRatio: 1 },
    { item: "Katana", cost: 100_000, member: "a", gain: 0, ascRatio: 1 },              // ordinary, no respect
    { item: "Neuralstimulator", cost: 40_000_000, member: "a", gain: 400, ascRatio: 1 }, // 4% of cash
    { item: "DataJack", cost: 60_000_000, member: "a", gain: 300, ascRatio: 1 },         // 6%: too dear
  ];
  const picks = planReputationGear(cands, { cash: 1_000_000_000 });
  assert.deepEqual(picks.map((p) => p.item).sort(), ["Jack the Ripper", "NUKE Rootkit", "Neuralstimulator", "Quadra Sport R-7"]);
  assert.ok(picks.some((p) => p.item === "Neuralstimulator"));
  assert.ok(!picks.some((p) => ["Demon Rootkit", "DataJack", "Katana"].includes(p.item)));
  assert.equal(picks[0].item, "NUKE Rootkit"); // 5/100k beats 400/40m
});

test("reputation gear: skip ordinary gear near ascension but still buy augmentations; cap and reserve", () => {
  const cands = [
    { item: "NUKE Rootkit", cost: 100_000, member: "a", gain: 5, ascRatio: 1.21 },
    { item: "BitWire", cost: 100_000, member: "a", gain: 5, ascRatio: 1.21 },
    { item: "NUKE Rootkit", cost: 100_000, member: "b", gain: 5, ascRatio: 1.1 },
  ];
  const picks = planReputationGear(cands, { cash: 1e9, ascendAt: 1.25 });
  assert.deepEqual(picks.map((p) => p.member + ":" + p.item).sort(), ["a:BitWire", "b:NUKE Rootkit"]);
  const many = Array.from({ length: 40 }, (_, i) => ({ item: "NUKE Rootkit", cost: 1000, member: "m" + i, gain: 1, ascRatio: 1 }));
  assert.equal(planReputationGear(many, { cash: 1e9 }).length, 24);
  assert.equal(planReputationGear(many, { cash: 1e9, maxPurchases: 3 }).length, 3);
  assert.equal(planReputationGear(cands, { cash: 1e9, reserve: 1e9 - 150_000 }).length, 1);
  assert.equal(planReputationGear(cands, { cash: 5_000 }).length, 0);
});

test("ascension cooldown", () => {
  assert.equal(ascensionCooldownElapsed(null, 1000), true);
  assert.equal(ascensionCooldownElapsed(0, 89_999), false);
  assert.equal(ascensionCooldownElapsed(0, 90_000), true);
});

test("autoGangObjective: reputation until gang rep covers every aug, then money", () => {
  const now = 1_000_000;
  assert.equal(autoGangObjective({ ts: now - 1000, gangRep: 2e6, gangRepNeeded: 3.5e6 }, now).objective, "reputation");
  assert.equal(autoGangObjective({ ts: now - 1000, gangRep: 3.5e6, gangRepNeeded: 3.5e6 }, now).objective, "money");
  assert.equal(autoGangObjective({ ts: now - 1000, gangRep: 11e6, gangRepNeeded: 3.5e6 }, now).objective, "money");
  // after an install rep is 0 again
  assert.equal(autoGangObjective({ ts: now - 1000, gangRep: 0, gangRepNeeded: 3.5e6 }, now).objective, "reputation");
});

test("autoGangObjective: stale, missing or partial readiness keeps reputation", () => {
  const now = 10_000_000;
  assert.equal(autoGangObjective(null, now).objective, "reputation");
  assert.equal(autoGangObjective({ ts: now - 11 * 60_000, gangRep: 9e6, gangRepNeeded: 1 }, now).objective, "reputation");
  assert.equal(autoGangObjective({ ts: now, gangRep: 9e6, gangRepNeeded: null }, now).objective, "reputation");
  assert.equal(autoGangObjective({ ts: now, gangRep: null, gangRepNeeded: 5 }, now).objective, "reputation");
});
