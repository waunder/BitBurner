import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { auditTargetModels } from "./formulas_logic.js"

function model(overrides = {}) {
  return {
    hackTimeSeconds: 10,
    hackPercentPerThread: 0.01,
    growLogPerThread: 0.001,
    maxMoney: 1e6,
    hackChance: 0.9,
    poolThreads: 100,
    money: 1e6,
    targetMoneyGoal: 0.95,
    horizonSeconds: 3600,
    growTimeRatio: 3.2,
    hackSecIncrease: 0.002,
    growSecIncrease: 0.004,
    weakenSecDecrease: 0.05,
    weakenPerHackRatio: 1,
    weakenPerGrowRatio: 1,
    ...overrides,
  }
}

describe("auditTargetModels", () => {
  test("returns labeled, finite current and hypothetical results", () => {
    const result = auditTargetModels({ target: "alpha", currentModel: model(), hypotheticalModel: model({ hackTimeSeconds: 8 }) })
    assert.equal(result.eligible, true)
    assert.equal(result.recommendationStatus, "compare")
    assert.equal(result.models.current.state, "current")
    assert.equal(result.models.hypothetical.state, "hypothetical")
    assert.ok(Number.isFinite(result.models.current.effectiveScore))
    assert.ok(Number.isFinite(result.models.hypothetical.effectiveScore))
  })

  test("fails closed for invalid input", () => {
    const result = auditTargetModels({ currentModel: model({ poolThreads: -1 }), hypotheticalModel: model() })
    assert.equal(result.eligible, false)
    assert.equal(result.models, null)
    assert.match(result.errors[0], /poolThreads/)
  })

  test("zero capacity produces zero scores", () => {
    const result = auditTargetModels({ currentModel: model({ poolThreads: 0 }), hypotheticalModel: model({ poolThreads: 0 }) })
    assert.equal(result.eligible, true)
    assert.equal(result.models.current.rawScore, 0)
    assert.equal(result.models.current.effectiveScore, 0)
  })

  test("longer horizon cannot reduce effective score", () => {
    const short = auditTargetModels({ currentModel: model({ horizonSeconds: 60 }), hypotheticalModel: model({ horizonSeconds: 60 }) })
    const long = auditTargetModels({ currentModel: model({ horizonSeconds: 3600 }), hypotheticalModel: model({ horizonSeconds: 3600 }) })
    assert.ok(long.models.current.effectiveScore >= short.models.current.effectiveScore)
  })

  test("same immutable input is deterministic", () => {
    const input = { target: "alpha", currentModel: model(), hypotheticalModel: model({ hackTimeSeconds: 8 }) }
    assert.deepEqual(auditTargetModels(input), auditTargetModels(input))
  })
})
