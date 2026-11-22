import { test } from "node:test"
import assert from "node:assert/strict"
import { decide, expectedReturn, holdingsValue, accessPurchase, shouldLiquidate, sharesBlockInstall, COMMISSION } from "./stock_engine_logic.js"

const stock = (o) => ({ sym: "A", forecast: 0.6, volatility: 0.01, ask: 101, bid: 99, maxShares: 1e7, shares: 0, ...o })
const cfg = { enabled: true, trade: true, minOrder: 1e6, investFraction: 1, reserveCash: 0 }

test("expected return grows with forecast and volatility", () => {
  assert.ok(expectedReturn(stock({ forecast: 0.7 })) > expectedReturn(stock({ forecast: 0.6 })))
  assert.ok(expectedReturn(stock({ volatility: 0.02 })) > expectedReturn(stock()))
  assert.ok(expectedReturn(stock({ forecast: 0.4 })) < 0)
})

test("buys the best expected return first, within the budget", () => {
  const stocks = [stock({ sym: "LOW", forecast: 0.58 }), stock({ sym: "HIGH", forecast: 0.7 })]
  const { buys } = decide({ stocks, cash: 5e8, config: cfg })
  assert.equal(buys[0].sym, "HIGH")
  assert.ok(buys.reduce((n, b) => n + b.cost, 0) <= 5e8)
})

test("respects maxShares and moves on to the next stock", () => {
  const stocks = [stock({ sym: "HIGH", forecast: 0.7, maxShares: 1e6 }), stock({ sym: "NEXT", forecast: 0.65 })]
  const { buys } = decide({ stocks, cash: 5e8, config: cfg })
  assert.deepEqual(buys.map((b) => b.sym), ["HIGH", "NEXT"])
  assert.equal(buys[0].shares, 1e6)
})

test("ignores weak forecasts and orders below the minimum", () => {
  assert.equal(decide({ stocks: [stock({ forecast: 0.56 })], cash: 5e8, config: cfg }).buys.length, 0)
  assert.equal(decide({ stocks: [stock()], cash: 5e5, config: cfg }).buys.length, 0)
})

test("keeps the reserve", () => {
  const { buys } = decide({ stocks: [stock()], cash: 5e8, config: { ...cfg, reserveCash: 4e8 } })
  assert.ok(buys[0].cost <= 1e8)
})

test("sells when the forecast turns, and reinvests the proceeds", () => {
  const stocks = [stock({ sym: "OLD", forecast: 0.45, shares: 1e6 }), stock({ sym: "NEW", forecast: 0.7 })]
  const { sells, buys } = decide({ stocks, cash: 0, config: cfg })
  assert.deepEqual(sells.map((s) => s.sym), ["OLD"])
  assert.equal(buys[0].sym, "NEW")
  assert.ok(buys[0].cost <= 1e6 * 99 - COMMISSION)
})

test("holds while the forecast stays at or above sellBelow", () => {
  assert.equal(decide({ stocks: [stock({ forecast: 0.5, shares: 10 })], cash: 0, config: cfg }).sells.length, 0)
})

test("liquidate sells everything and buys nothing", () => {
  const stocks = [stock({ sym: "A", shares: 5, forecast: 0.9 }), stock({ sym: "B", shares: 7, forecast: 0.2 }), stock({ sym: "C", forecast: 0.9 })]
  const { sells, buys } = decide({ stocks, cash: 1e12, config: cfg, liquidate: true })
  assert.deepEqual(sells.map((s) => s.sym).sort(), ["A", "B"])
  assert.equal(buys.length, 0)
})

test("holdings value at the bid, less commission", () => {
  assert.equal(holdingsValue([stock({ shares: 1000 }), stock({ shares: 0 })]), 1000 * 99 - COMMISSION)
})

test("access is bought only with room to trade", () => {
  const costs = { wse: 2e8, tix: 5e9, api: 1e11 }
  assert.equal(accessPurchase({ cash: 2e11, costs, config: cfg }).buy, false)
  assert.equal(accessPurchase({ cash: 4e11, costs, config: cfg }).buy, true)
  assert.equal(accessPurchase({ cash: 4e11, costs, config: { ...cfg, buyAccess: false } }).buy, false)
  assert.equal(accessPurchase({ cash: 0, costs: { wse: 0, tix: 0, api: 0 }, config: cfg }).buy, false)
})

test("liquidates on an install verdict or a fresh request", () => {
  assert.equal(shouldLiquidate({ verdict: "install", now: 0 }).liquidate, true)
  assert.equal(shouldLiquidate({ verdict: "wait", requestTs: 1000, now: 2000 }).liquidate, true)
  assert.equal(shouldLiquidate({ verdict: "wait", requestTs: 1000, now: 1000 + 7200e3 }).liquidate, false)
  assert.equal(shouldLiquidate({ verdict: "wait", now: 0 }).liquidate, false)
})

test("an install is refused while shares are held", () => {
  assert.equal(sharesBlockInstall(null), "")
  assert.equal(sharesBlockInstall({ holdings: [], holdingsValue: 0 }), "")
  assert.match(sharesBlockInstall({ holdings: [{ sym: "ECP", shares: 5 }], holdingsValue: 1e9 }), /ECP/)
})
