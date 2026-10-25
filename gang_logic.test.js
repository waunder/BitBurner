import test from "node:test";
import assert from "node:assert/strict";
import { moneyModePriority, planMoneyTasks, planReputationTasks } from "./gang_logic.js";

test("money mode prioritizes wanted recovery over blocked recruitment growth", () => {
  assert.equal(moneyModePriority(true, true, true), "wanted-recovery");
  assert.equal(moneyModePriority(false, true, true), "respect");
  assert.equal(moneyModePriority(true, false, true), "respect");
  assert.equal(moneyModePriority(false, true, false), "cash");
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
