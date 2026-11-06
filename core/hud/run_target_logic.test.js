import { test } from "node:test"
import assert from "node:assert/strict"
import { bar, describeStep, installLabel, metricProgress, nowIndex, runTargetView } from "./run_target_logic.js"

const compact = (n, d = 1) => (Math.abs(n) >= 1e9 ? (n / 1e9).toFixed(d) + "b" : String(Math.round(n)))

const config = {
  goal: "BN10: SF10.1",
  updated: "2026-11-04",
  steps: [
    { label: "NiteSec gate", metric: { kind: "hacking", target: 211 } },
    { label: "First install", metric: { kind: "installed", target: 1 } },
    { label: "Covenant invite", metrics: [{ kind: "installed", target: 20 }, { kind: "money", target: 75e9 }] },
    { label: "World Daemon" },
  ],
}

test("karma is met from above by default", () => {
  assert.equal(metricProgress({ kind: "karma", target: -54000 }, { karma: -60000 }).met, true)
  assert.equal(metricProgress({ kind: "karma", target: -54000 }, { karma: -100 }).met, false)
})

test("unknown values give no progress rather than a false bar", () => {
  assert.equal(metricProgress({ kind: "hacking", target: 10 }, {}), null)
  const step = describeStep({ label: "x", metric: { kind: "hacking", target: 10 } }, {}, compact)
  assert.equal(step.done, false)
  assert.match(step.parts[0].text, /unknown/)
})

test("gate reads its level and host from the controller", () => {
  const p = metricProgress({ kind: "gate" }, { hacking: 207, gate: { host: "avmnite-02h", required: 211 } })
  assert.equal(p.target, 211)
  assert.equal(p.host, "avmnite-02h")
  assert.equal(p.met, false)
})

test("a multi-metric step needs every metric", () => {
  const live = { installed: 20, money: 1e9 }
  assert.equal(describeStep(config.steps[2], live, compact).done, false)
  assert.equal(describeStep(config.steps[2], { installed: 20, money: 8e10 }, compact).done, true)
})

test("an install reset does not move Now back to an earlier step", () => {
  // After the install hacking is back to 1, but step 2 is met.
  const steps = config.steps.map((s) => describeStep(s, { hacking: 1, installed: 6, money: 1e6 }, compact))
  assert.equal(steps[0].done, false)
  assert.equal(nowIndex(steps), 2)
})

test("view shows Now with a bar, Next and the controller's work", () => {
  const view = runTargetView(config, { hacking: 207, installed: 0, money: 3e10, work: "Sector-12 rep" }, compact)
  assert.equal(view.lines[0], "Goal: BN10: SF10.1")
  assert.match(view.lines[1], /^Now:  NiteSec gate \(step 1 of 4\)/)
  assert.match(view.lines[2], /hack 207\/211 .* 98%/)
  assert.equal(view.lines[3], "Next: First install")
  assert.ok(view.lines.includes("Work: Sector-12 rep"))
  assert.ok(runTargetView(config, { advice: "wait 1.0h for X" }, compact).lines.includes("Advice: wait 1.0h for X"))
  assert.equal(view.compact, "NiteSec gate · hack 207/211")
})

test("compact names the least-progressed open metric", () => {
  const view = runTargetView(config, { hacking: 300, installed: 10, money: 7e10 }, compact)
  assert.match(view.compact, /^Covenant invite · augs 10\/20/)
})

test("all steps done and missing config are explicit", () => {
  const done = runTargetView({ goal: "g", steps: [{ label: "a", done: true }] }, {}, compact)
  assert.match(done.lines[1], /all 1 steps done/)
  assert.equal(runTargetView(null, {}, compact).compact, "none set")
})

test("install step names the count, factions and what it waits on", () => {
  const plan = { names: ["a", "b", "c"], factions: ["Sector-12", "CyberSec"] }
  assert.equal(installLabel(plan, ["NiteSec"]), "Install 3 augments from Sector-12, CyberSec; waiting on NiteSec")
  assert.equal(installLabel({ ...plan, factions: [...plan.factions, "NiteSec"] }, ["NiteSec"]),
    "Install 3 augments from Sector-12, CyberSec, NiteSec")
  assert.equal(installLabel({ names: ["a"] }), "Install 1 augment")
  assert.equal(installLabel(undefined), "Install (plan unknown)")
  const step = describeStep({ install: true, waitFor: ["NiteSec"] }, { installPlan: plan }, compact)
  assert.match(step.label, /^Install 3 augments/)
})

test("bar clamps", () => {
  assert.equal(bar(2, 4), "████")
  assert.equal(bar(-1, 4), "░░░░")
  assert.equal(bar(0.98, 12), "███████████░")
})
