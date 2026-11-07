import test from "node:test"
import assert from "node:assert/strict"
import { donationRows, splitOther } from "./donation_view.js"

test("other splits into donations from this cycle's aug_install run and the rest", () => {
  const last = { ts: 50, donations: [["NiteSec", 30]], fluxDonated: 20 }
  assert.deepEqual(splitOther(-90, last, 10), [{ key: "donations", value: -50 }, { key: "programs/TOR", value: -40 }])
  // A run before the last install is in the previous cycle's totals.
  assert.deepEqual(splitOther(-90, last, 60), [{ key: "donations", value: -0 }, { key: "programs/TOR", value: -90 }])
  assert.deepEqual(splitOther(-90, last, undefined), [{ key: "donations/TOR/other", value: -90 }])
})

const money = (n) => `$${n}`
const ago = () => "1h"

test("open factions, planned gifts, next to open and the last install's spend", () => {
  const readiness = {
    ok: true, ts: 100, donating: ["NiteSec"], gangFaction: "The Black Hand",
    installPlan: { donations: [["NiteSec", 5]] },
    favor: { NiteSec: { favor: 200, gain: 1 }, Daedalus: { favor: 0, gain: 52 }, "The Black Hand": { favor: 183, gain: 0 } },
  }
  const last = { ts: 1, donations: [["The Syndicate", 3]], fluxDonated: 7, neuroflux: 11 }
  assert.deepEqual(donationRows(readiness, last, 200, money, ago), [
    ["donations", ""],
    ["open (favor 150+)", "1 factions"],
    ["at next install", "$5"],
    ["  NiteSec", "$5"],
    ["next: Daedalus", "fav 52"],
    ["last aug_install", "1h"],
    ["  donated", "$10"],
    ["  for 11 NeuroFlux", "$7"],
    ["  The Syndicate", "$3"],
  ])
})

test("stale planner and no install record say so", () => {
  assert.deepEqual(donationRows({ ok: true, ts: 0 }, null, 10 * 60 * 1000, money, ago),
    [["donations", ""], ["planner", "stale"], ["last aug_install", "no record"]])
})
