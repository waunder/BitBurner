import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { clampCap, entryCost, nextCapAfterClose, remainingAllocation } from "./mcp_stock_trader_logic.js"

describe("adaptive portfolio cap", () => {
  test("starts at and never exceeds the ten-percent maximum", () => {
    assert.equal(clampCap(undefined), 0.1)
    assert.equal(nextCapAfterClose(0.1, 1), 0.1)
  })

  test("moves one percentage point per realized outcome and bottoms at one percent", () => {
    assert.equal(nextCapAfterClose(0.1, -1), 0.09)
    assert.equal(nextCapAfterClose(0.09, 1), 0.1)
    assert.equal(nextCapAfterClose(0.01, -1), 0.01)
  })

  test("uses recorded entry cost, with an average-price fallback for legacy positions", () => {
    assert.equal(entryCost({ shares: 10, averagePrice: 50, recordedCost: 700 }), 700)
    assert.equal(entryCost({ shares: 10, averagePrice: 50 }), 100500)
  })

  test("caps all positions together against total portfolio equity", () => {
    assert.deepEqual(remainingAllocation({ cash: 900, liquidationValue: 100, capFraction: 0.1 }), {
      equity: 1000,
      allowed: 100,
      remaining: 0,
    })
    assert.equal(remainingAllocation({ cash: 1000, liquidationValue: 0, capFraction: 0.1 }).remaining, 100)
  })
})
