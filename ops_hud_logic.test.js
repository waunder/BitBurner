import test from "node:test"
import assert from "node:assert/strict"
import { ago, buildPanel, chooseGoal, clock, fit, freshness, labsSolved, wrap, WIDTH } from "./ops_hud_logic.js"

const NOW = Date.UTC(2026, 10, 2, 14, 0, 0)
const stack = (target, extra = {}) => ({ ts: NOW - 2000, target, state: "running", perSec: 12.3e6, resets: 0, ...extra })
const healthy = () => ({
  now: NOW,
  mcp: { ts: NOW - 4000, target: "rho-construction", phase: "harvest", player: { skills: { hacking: 535, charisma: 823 } } },
  stacks: [stack("omega-net"), stack("zb-def", { perSec: 3e6 })],
  stackManager: { ts: NOW - 30000, state: "running", failed: [] },
  capital: { ts: NOW - 5000, action: { kind: "save", reason: "next priority", cost: 1e9 }, ok: null },
  activity: {
    ts: NOW - 20000, decision: { action: "company", company: "Bachman & Associates", reason: "company rep until its faction invites" },
    gateScanOk: true, gate: { host: "run4theh111z", required: 542 },
    augmentation: { ts: NOW - 60000, resetAt: NOW - 3 * 3600000, queued: ["The B00ts of Perseus"] },
  },
  root: { ts: NOW - 10000 },
  registry: { a: NOW - 5000, b: NOW - 999999 },
  scout: { ts: NOW - 20000, state: "hopped", depth: 11 },
  lab: { ts: NOW - 600000, lab: "cru3l_l4byr1nth", state: "solved" },
  review: { alerts: [] },
})
const text = (view) => view.rows.map((r) => r[1]).join("\n")

test("time uses a fixed UTC-7 offset and rows fit the width", () => {
  assert.equal(clock(NOW), "07:00:00")
  assert.equal(fit("a", "b").length, WIDTH)
  assert.equal(wrap("one two three", 7, 2).join("|"), "one two|three")
  assert.equal(wrap("aaaa bbbb cccc dddd", 9, 1)[0].endsWith("~"), true)
  assert.equal(ago(NOW, NOW - 30000), "30s")
  assert.equal(ago(NOW, undefined), "none")
})

test("a healthy panel is OK, fits 42 columns and names the goal", () => {
  const view = buildPanel(healthy())
  assert.equal(view.health, "OK")
  assert.ok(view.rows.every(([, line]) => line.length <= WIDTH), text(view))
  assert.match(text(view), /Merciless lab d19\s+C823\/1500/)
  assert.match(text(view), /blocked\s+charisma \+677/)
  assert.match(text(view), /H gate run4theh111z\s+H542 \+7/)
  assert.match(text(view), /install HELD/)
  assert.match(text(view), /1 mgr/)
})

test("stale and missing files never read as healthy", () => {
  assert.equal(freshness(NOW, undefined, 1000), "MISSING")
  assert.equal(freshness(NOW, NOW - 5000, 1000), "STALE")
  const input = healthy()
  input.mcp.ts = NOW - 600000
  input.capital = null
  input.stacks[1].ts = NOW - 900000
  const view = buildPanel(input)
  assert.equal(view.health, "CHECK")
  assert.match(text(view), /MCP STALE 10m/)
  assert.match(text(view), /capital MISSING none/)
  assert.match(text(view), /zb-def\s+STALE 15m/)
  assert.match(text(view), /H535\? C823\?/)
})

test("failures raise ATTENTION", () => {
  const input = healthy()
  input.capital.ok = false
  input.stackManager.failed = ["omega-net"]
  input.stacks[0].resets = 2
  input.lab = { ts: NOW, lab: "m3rc1l3ss_l4byr1nth", state: "stuck" }
  input.review.alerts = [{ message: "something broke" }]
  const view = buildPanel(input)
  assert.equal(view.health, "ATTENTION")
  assert.match(text(view), /capital purchase failed/)
  assert.match(text(view), /lab stuck/)
  assert.ok(view.rows.every(([, line]) => line.length <= WIDTH))
})

test("labs solved come from the lab record, and never fall below a queued reward", () => {
  assert.equal(labsSolved({ lab: "cru3l_l4byr1nth", state: "solved" }), 2)
  assert.equal(labsSolved({ lab: "m3rc1l3ss_l4byr1nth", state: "walking" }, []), 2)
  assert.equal(labsSolved({ lab: null, state: "waiting" }, ["The B00ts of Perseus"]), 2)
  assert.equal(labsSolved(null, []), null)
})

test("goal names the next lab, its block, and when to hold the install", () => {
  const short = chooseGoal({ charisma: 823, solved: 2, lab: null, queuedCount: 1 })
  assert.equal(short.hold, true)
  assert.equal(short.block, "charisma +677")
  const walking = chooseGoal({ charisma: 1600, solved: 2, lab: { lab: "m3rc1l3ss_l4byr1nth", state: "walking" } })
  assert.equal(walking.block, "reach/solve: walking")
  assert.equal(chooseGoal({ charisma: 5, solved: null }).title, "next lab unknown")
  assert.match(chooseGoal({ charisma: 3100, solved: 5 }).block, /Red Pill/)
})
