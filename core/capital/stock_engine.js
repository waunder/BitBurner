/**
 * Stock engine: the earner where hacking money is cut (BN11) or absent (BN8). Built 2026-11-22.
 * Off unless stock_config.json says enabled; decides without trading unless trade is true.
 * Decisions in stock_engine_logic.js. Each market update: liquidate if the install advisor says install
 * (an install wipes every share) or stock_liquidate.txt holds a fresh timestamp; otherwise sell what turned,
 * buy the best forecasts. Buys WSE, TIX API and 4S TIX API once cash allows.
 * Status: stock_engine_status.json (holdings value is part of net worth: shares are not cash).
 * @param {NS} ns
 */
import { decide, accessPurchase, shouldLiquidate, holdingsValue, DEFAULT_STOCK_CONFIG, COMMISSION } from "./stock_engine_logic.js"

const CONFIG = "stock_config.json"
const STATUS = "stock_engine_status.json"
const REQUEST = "stock_liquidate.txt"
const READINESS = "augmentation_readiness.json"

function readJson(ns, file) {
  try { return JSON.parse(ns.read(file)) } catch { return null }
}

function accessCosts(ns) {
  let mult = { FourSigmaMarketDataApiCost: 1 }
  try { mult = ns.getBitNodeMultipliers() } catch { /* needs SF5; base costs then */ }
  const k = ns.stock.getConstants()
  return {
    wse: ns.stock.hasWseAccount() ? 0 : k.WseAccountCost,
    tix: ns.stock.hasTixApiAccess() ? 0 : k.TixApiCost,
    api: ns.stock.has4SDataTixApi() ? 0 : k.MarketDataTixApi4SCost * (mult.FourSigmaMarketDataApiCost || 1),
  }
}

function buyAccess(ns) {
  if (!ns.stock.hasWseAccount()) ns.stock.purchaseWseAccount()
  if (!ns.stock.hasTixApiAccess()) ns.stock.purchaseTixApi()
  if (!ns.stock.has4SDataTixApi()) ns.stock.purchase4SMarketDataTixApi()
}

function readMarket(ns) {
  return ns.stock.getSymbols().map((sym) => {
    const [shares, avg] = ns.stock.getPosition(sym)
    return {
      sym, shares, avg,
      forecast: ns.stock.getForecast(sym), volatility: ns.stock.getVolatility(sym),
      ask: ns.stock.getAskPrice(sym), bid: ns.stock.getBidPrice(sym), maxShares: ns.stock.getMaxShares(sym),
    }
  })
}

export async function main(ns) {
  ns.disableLog("ALL")
  const realized = { gain: 0, trades: 0, since: Date.now() }
  while (true) {
    const config = { ...DEFAULT_STOCK_CONFIG, ...(readJson(ns, CONFIG) || {}) }
    const status = { ts: Date.now(), enabled: config.enabled, trade: config.trade, mode: "off", realized }
    const cash = ns.getServerMoneyAvailable("home")
    if (config.enabled) {
      const costs = accessCosts(ns)
      const access = accessPurchase({ cash, costs, config })
      status.access = access.why
      const bought = access.buy && config.trade
      if (bought) buyAccess(ns)
      // the game builds the market at the first update after access is bought: trade from the next one
      if (bought) status.mode = "access bought; trading from the next market update"
      else if (ns.stock.hasTixApiAccess() && ns.stock.has4SDataTixApi()) {
       try {
        const stocks = readMarket(ns)
        const verdict = readJson(ns, READINESS)?.advice?.verdict
        const requestTs = Number(ns.read(REQUEST)) || 0
        const liq = shouldLiquidate({ verdict, requestTs, now: Date.now() })
        const orders = decide({ stocks, cash, config, liquidate: liq.liquidate })
        status.mode = liq.liquidate ? `liquidating: ${liq.why}` : "trading"
        if (config.trade) {
          for (const o of orders.sells) {
            const s = stocks.find((x) => x.sym === o.sym)
            const price = ns.stock.sellStock(o.sym, o.shares)
            if (price > 0) {
              realized.gain += o.shares * (price - s.avg) - 2 * COMMISSION
              realized.trades += 1
              ns.print(`sold ${o.shares} ${o.sym} at ${price.toFixed(2)} (${o.why})`)
            }
          }
          for (const o of orders.buys) {
            if (ns.stock.buyStock(o.sym, o.shares) > 0) ns.print(`bought ${o.shares} ${o.sym}`)
          }
        }
        const after = config.trade ? readMarket(ns) : stocks
        status.orders = { sells: orders.sells.length, buys: orders.buys.length }
        status.holdings = after.filter((s) => s.shares > 0)
          .map((s) => ({ sym: s.sym, shares: s.shares, avg: s.avg, bid: s.bid, forecast: Number(s.forecast.toFixed(3)) }))
        status.holdingsValue = holdingsValue(after)
       } catch (error) {
        status.mode = `market read failed: ${String(error).slice(0, 200)}`
       }
      } else {
        status.mode = "no market access"
      }
    }
    status.cash = ns.getServerMoneyAvailable("home")
    status.holdingsValue = status.holdingsValue || 0
    status.netWorth = status.cash + status.holdingsValue
    ns.write(STATUS, JSON.stringify(status), "w")
    if (ns.stock.hasTixApiAccess()) await ns.stock.nextUpdate()
    else await ns.sleep(10000)
  }
}
