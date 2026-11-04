import test from "node:test"
import assert from "node:assert/strict"
import { formatRamGroup, summarizeRam } from "./fleet_ram.js"

test("summarizeRam splits server classes and counts filler as weaken", () => {
  const { cloud, hacked } = summarizeRam([
    { cloud: true, max: 1024, jobs: [{ filename: "/scripts/weaken.js", ram: 10 }, { filename: "scripts/xp_weaken.js", ram: 20 }, { filename: "scripts/stack_job.js", action: "hack", ram: 5 }] },
    { cloud: false, max: 16, jobs: [{ filename: "scripts/grow.js", ram: 4 }, { filename: "dnet_phish.js", ram: 3 }] },
  ])
  assert.deepEqual(cloud, { hosts: 1, max: 1024, weaken: 30, grow: 0, hack: 5 })
  assert.deepEqual(hacked, { hosts: 1, max: 16, weaken: 0, grow: 4, hack: 0 })
})

test("formatRamGroup shows each action and idle RAM", () => {
  assert.equal(formatRamGroup("CLOUD", { hosts: 2, max: 2048, weaken: 1024, grow: 200, hack: 8 }), "CLOUD 2.0TB (2): W 1.0TB G 200GB H 8.0GB idle 816GB")
})
