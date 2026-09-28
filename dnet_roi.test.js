import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { baselineFile, inconclusiveFlags, reportFor } from "./dnet_roi.js"

function endpoint({ ts = 0, target = "megacorp", plan = "work", managerFresh = true, rootFresh = true } = {}) {
  return {
    ts,
    label: "on-1",
    cash: 100,
    player: { charisma: 1, hacking: 2 },
    moneySources: { darknet: 3, hacking: 4 },
    darknet: { managerFresh, rootHeartbeatFresh: rootFresh },
    mcp: { target, plan, incomePerSec: 9, totalHacked: 8 },
  }
}

describe("dnet ROI interval identity", () => {
  test("uses a distinct, sanitized baseline for each label", () => {
    assert.equal(baselineFile("darknet on"), "dnet_roi_baseline_darknet-on.json")
    assert.notEqual(baselineFile("darknet-on"), baselineFile("darknet-off"))
  })
})

describe("dnet ROI conclusiveness", () => {
  test("accepts matching fresh endpoints", () => {
    assert.deepEqual(inconclusiveFlags(endpoint(), endpoint({ ts: 1000 })), {
      managerFreshness: false,
      phaseMismatch: false,
      targetMismatch: false,
      reasons: [],
    })
  })

  test("flags stale manager/root, phase, and target changes explicitly", () => {
    const flags = inconclusiveFlags(
      endpoint({ target: "megacorp", plan: "work", managerFresh: false }),
      endpoint({ ts: 1000, target: "ecorp", plan: "weaken", rootFresh: false }),
    )
    assert.equal(flags.managerFreshness, true)
    assert.equal(flags.phaseMismatch, true)
    assert.equal(flags.targetMismatch, true)
    assert.equal(flags.reasons.length, 3)
  })

  test("persists the inconclusive flags in the final report", () => {
    const report = reportFor(endpoint(), endpoint({ ts: 1000, plan: "weaken" }))
    assert.equal(report.schema, 2)
    assert.equal(report.inconclusive.phaseMismatch, true)
    assert.equal(report.rates.darknetMoneyPerSec, 0)
  })
})
