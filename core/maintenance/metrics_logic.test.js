import test from "node:test"
import assert from "node:assert/strict"
import { buildSample, trimLog, msToNextTick, workSummary, fresh } from "./metrics_logic.js"

const NOW = 1_000_000_000
const base = {
  now: NOW,
  resetAt: 900_000_000,
  money: 1e9,
  sources: { hacking: 5, servers: -2, augmentations: -1, darknet: 3, codingcontract: 0, total: 5, gang: 9 },
  player: {
    skills: { hacking: 480, strength: 40, defense: 41, dexterity: 42, agility: 39, charisma: 10, intelligence: 1 },
    exp: { hacking: 1.6e9, strength: 100, defense: 101, dexterity: 102, agility: 103, charisma: 7 },
    karma: -8000.5, city: "Sector-12",
  },
  sharePower: 1.46,
  readiness: {
    ts: NOW - 60_000, resetAt: 800_000_000,
    factionRep: { NiteSec: 21897.4, "The Black Hand": 15411.8 },
    favor: { NiteSec: { favor: 113.15, gain: 4.5 } },
    installedCount: 27, queuedCount: 0, advice: { verdict: "build" },
  },
  activity: {
    ts: NOW - 30_000,
    currentWork: { type: "FACTION", factionName: "NiteSec", factionWorkType: "hacking" },
    decision: { reason: "favor push" },
  },
  mcp: { ts: NOW - 5_000, rate: 4.9e8, avgRate: 2.1e8 },
  ram: { max: 65536, used: 60000 },
}

test("fresh sources are copied into the sample", () => {
  const s = buildSample(base)
  assert.equal(s.ts, NOW)
  assert.equal(s.resetAt, 900_000_000)
  assert.deepEqual(s.income, { hacking: 5, servers: -2, augmentations: -1, darknet: 3, codingcontract: 0, total: 5 })
  assert.equal(s.skills.charisma, 10)
  assert.equal(s.exp.agility, 103)
  assert.equal("charisma" in s.exp, false)
  assert.equal(s.karma, -8000.5)
  assert.deepEqual(s.work, { type: "FACTION", faction: "NiteSec", company: null, detail: "hacking" })
  assert.equal(s.reason, "favor push")
  assert.deepEqual(s.factionRep, { NiteSec: 21897.4, "The Black Hand": 15411.8 })
  assert.deepEqual(s.favor, { NiteSec: 113.15 })
  assert.equal(s.installedCount, 27)
  assert.equal(s.verdict, "build")
  assert.equal(s.mcpRate, 4.9e8)
  assert.deepEqual(s.stale, {})
})

test("stale and missing sources are nulled and listed, not copied", () => {
  const s = buildSample({ ...base, readiness: { ...base.readiness, ts: NOW - 11 * 60_000 }, mcp: null })
  assert.equal(s.factionRep, null)
  assert.equal(s.favor, null)
  assert.equal(s.installedCount, null)
  assert.equal(s.verdict, null)
  assert.equal(s.mcpRate, null)
  assert.deepEqual(s.stale, { readiness: 660, mcp: null })
  assert.equal(s.reason, "favor push")
})

test("resetAt falls back to fresh readiness", () => {
  assert.equal(buildSample({ ...base, resetAt: undefined }).resetAt, 800_000_000)
})

test("workSummary handles idle and company work", () => {
  assert.equal(workSummary(null), null)
  assert.deepEqual(workSummary({ type: "COMPANY", companyName: "Clarke" }), { type: "COMPANY", faction: null, company: "Clarke", detail: null })
})

test("fresh rejects missing ts", () => {
  assert.equal(fresh(NOW, {}), false)
  assert.equal(fresh(NOW, { ts: NOW }), true)
})

test("trimLog keeps the tail only past keep + slack", () => {
  const text = ["a", "b", "c", "d", "e"].join("\n") + "\n"
  assert.equal(trimLog(text, 3, 2), null)
  assert.equal(trimLog(text, 3, 1), "c\nd\ne\n")
  assert.equal(trimLog("", 3), null)
})

test("msToNextTick aligns to the interval", () => {
  assert.equal(msToNextTick(1000, 300), 200)
  assert.equal(msToNextTick(900, 300), 300)
})
