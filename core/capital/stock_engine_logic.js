/**
 * Stock engine decisions (pure). Built 2026-11-22 for BN11 (hacking money x0.01, so the market is the earner)
 * and BN8 (stocks are the only income). Game rules read from Bitburner 3.0.1 source:
 *  - 4S forecast = chance the next price move is up; a move is up to volatility (fraction) of the price,
 *    so the expected move per update is about volatility * (forecast - 0.5).
 *  - Trades do not move the price; large ones pull the forecast toward 0.55 (never past it).
 *  - Cost of a round trip: the ask/bid spread plus $100k commission each way.
 *  - An augmentation install or a BitNode finish resets the market: every held share is lost.
 * Long only: shorting needs SF8.2 or BitNode 8.
 */

export const COMMISSION = 100e3

export const DEFAULT_STOCK_CONFIG = {
  enabled: false,          // a profile turns it on
  trade: false,            // false: decide and report only
  buyAccess: true,         // buy WSE, TIX API and 4S TIX API once cash covers accessCashMultiple x their cost
  accessCashMultiple: 3,
  reserveCash: 0,          // never invest this much cash
  investFraction: 0.9,     // of cash above the reserve
  buyAbove: 0.575,         // forecast to open
  sellBelow: 0.5,          // forecast to close
  minOrder: 100e6,         // commission under 0.1% of an order
}

/** Expected fractional gain per market update for a long position. */
export function expectedReturn(stock) {
  return (Number(stock.volatility) || 0) * ((Number(stock.forecast) || 0.5) - 0.5)
}

/** Market value of the held shares if sold now (bid, less commission per position). */
export function holdingsValue(stocks) {
  return stocks.reduce((sum, s) => sum + (s.shares > 0 ? s.shares * s.bid - COMMISSION : 0), 0)
}

/**
 * Orders for one market update.
 * stocks: [{sym, forecast, volatility, ask, bid, maxShares, shares}]
 * Returns {sells: [{sym, shares, why}], buys: [{sym, shares, cost}]}
 */
export function decide({ stocks, cash, config, liquidate = false }) {
  const c = { ...DEFAULT_STOCK_CONFIG, ...(config || {}) }
  const sells = []
  for (const s of stocks) {
    if (!(s.shares > 0)) continue
    if (liquidate) sells.push({ sym: s.sym, shares: s.shares, why: "liquidate" })
    else if (s.forecast < c.sellBelow) sells.push({ sym: s.sym, shares: s.shares, why: `forecast ${s.forecast.toFixed(3)}` })
  }
  if (liquidate) return { sells, buys: [] }

  const sold = new Set(sells.map((o) => o.sym))
  let budget = (cash + stocks.filter((s) => sold.has(s.sym)).reduce((n, s) => n + s.shares * s.bid - COMMISSION, 0)
    - c.reserveCash) * c.investFraction
  const buys = []
  const ranked = stocks.filter((s) => !sold.has(s.sym) && s.forecast >= c.buyAbove && s.ask > 0)
    .sort((a, b) => expectedReturn(b) - expectedReturn(a))
  for (const s of ranked) {
    if (budget < c.minOrder) break
    const room = Math.max(0, (s.maxShares || 0) - (s.shares || 0))
    const shares = Math.min(room, Math.floor((budget - COMMISSION) / s.ask))
    const cost = shares * s.ask + COMMISSION
    if (shares <= 0 || cost < c.minOrder) continue
    buys.push({ sym: s.sym, shares, cost })
    budget -= cost
  }
  return { sells, buys }
}

/** Should the engine buy market access now? costs: {wse, tix, api} still unpaid (0 when owned). */
export function accessPurchase({ cash, costs, config }) {
  const c = { ...DEFAULT_STOCK_CONFIG, ...(config || {}) }
  const need = (costs.wse || 0) + (costs.tix || 0) + (costs.api || 0)
  if (need === 0) return { buy: false, why: "access owned" }
  if (!c.buyAccess) return { buy: false, why: "buyAccess off" }
  if (cash - c.reserveCash < need * c.accessCashMultiple) return { buy: false, why: `waiting for ${need * c.accessCashMultiple} cash` }
  return { buy: true, why: `buying access for ${need}` }
}

/** Sell everything before an install: the advisor says install, or a liquidate request is fresh. */
export function shouldLiquidate({ verdict, requestTs, now, maxRequestAgeMs = 3600e3 }) {
  if (verdict === "install") return { liquidate: true, why: "install advisor says install" }
  if (requestTs && now - requestTs < maxRequestAgeMs) return { liquidate: true, why: "liquidate requested" }
  return { liquidate: false, why: "" }
}

/** An install would wipe held shares: refuse while the engine's status shows any (fresh or not). */
export function sharesBlockInstall(status) {
  const held = (status?.holdings || []).filter((h) => h.shares > 0)
  if (!held.length && !(status?.holdingsValue > 0)) return ""
  return `shares held (${held.map((h) => h.sym).join(", ") || "value " + status.holdingsValue}); stock_engine sells them first`
}
