/**
 * Conservative long-only stock trader.
 *
 * Default mode is DRY RUN. Pass trade=1 only after reviewing the panel output.
 * Requires 4S Market Data TIX API: without it there is no reliable scripted
 * entry signal, and commission/spread make guessing a poor starting metric.
 *
 * Rules:
 *   - Buy only when forecast > 0.5.
 *   - Keep all positions within a portfolio-wide adaptive allocation cap.
 *     It starts at 10% of total equity, falls 1 percentage point after each
 *     realized loss, and rises 1 point after each realized gain (1%-10%).
 *   - Sell when net sale proceeds exceed the purchase cost by >10%.
 *   - One long position per symbol; no shorts.
 *
 * Args: trade=1, interval=<ms>
 * @param {NS} ns
 */
import {
  COMMISSION,
  DEFAULT_CAP_FRACTION,
  entryCost,
  nextCapAfterClose,
  remainingAllocation,
} from "./mcp_stock_trader_logic.js"

const POLL_MS = 4000
const PROFIT_TARGET = 0.10
const STATE_FILE = "mcp_stock_trader_state.json"

function parseArgs(ns) {
  const out = {}
  for (const raw of ns.args) {
    const [key, value] = String(raw).split("=", 2)
    if (key === "trade") out.trade = value === "1" || value === "true"
    if (key === "interval") {
      const n = Number(value)
      if (Number.isFinite(n)) out[key] = n
    }
  }
  return out
}

function money(value) {
  return nsFormat(value)
}

function nsFormat(value) {
  const n = Number(value) || 0
  const abs = Math.abs(n)
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + "b"
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + "m"
  if (abs >= 1e3) return (n / 1e3).toFixed(2) + "k"
  return n.toFixed(0)
}

function readState(ns) {
  try {
    const parsed = JSON.parse(ns.read(STATE_FILE) || "{}")
    return {
      capFraction: Number.isFinite(parsed.capFraction) ? parsed.capFraction : DEFAULT_CAP_FRACTION,
      positions: parsed.positions && typeof parsed.positions === "object" ? parsed.positions : {},
      wins: Number(parsed.wins) || 0,
      losses: Number(parsed.losses) || 0,
    }
  } catch (_) {
    return { capFraction: DEFAULT_CAP_FRACTION, positions: {}, wins: 0, losses: 0 }
  }
}

function writeState(ns, state) {
  ns.write(STATE_FILE, JSON.stringify(state), "w")
}

function longPosition(ns, symbol, state) {
  const [shares, averagePrice] = ns.stock.getPosition(symbol)
  const saleValue = shares > 0 ? ns.stock.getSaleGain(symbol, shares, "L") : 0
  return {
    shares,
    averagePrice,
    saleValue,
    cost: entryCost({ shares, averagePrice, recordedCost: state.positions[symbol]?.cost }),
  }
}

function buyShares(ns, symbol, budget) {
  if (budget <= COMMISSION) return 0
  const price = ns.stock.getPrice(symbol)
  const shares = Math.floor((budget - COMMISSION) / price)
  if (shares <= 0) return 0
  const cost = ns.stock.getPurchaseCost(symbol, shares, "L")
  return cost <= budget ? shares : 0
}

function positionStatus(ns, symbol, state, budget, live) {
  const position = longPosition(ns, symbol, state)
  if (position.shares > 0) {
    const netProfit = position.saleValue - position.cost
    const takeProfit = netProfit > position.cost * PROFIT_TARGET
    // A forecast reversal is the loss exit. Without one, the trader could
    // hold every loser forever and the requested loss-based cap reduction
    // would be unreachable.
    const stopLoss = netProfit < 0 && ns.stock.getForecast(symbol) <= 0.5
    if (takeProfit || stopLoss) {
      if (live && ns.stock.sellStock(symbol, position.shares) !== 0) {
        state.capFraction = nextCapAfterClose(state.capFraction, netProfit)
        if (netProfit > 0) state.wins += 1
        else state.losses += 1
        delete state.positions[symbol]
      }
      return `${symbol} SELL ${position.shares} net ${money(netProfit)} ${takeProfit ? "target" : "forecast-loss"}${live ? " EXEC" : " DRY"}`
    }
    return `${symbol} HOLD ${position.shares} pl ${money(netProfit)} / ${money(position.cost * PROFIT_TARGET)}`
  }

  if (ns.stock.getForecast(symbol) <= 0.5) return ""
  if (budget <= 0) return ""
  const sharesToBuy = buyShares(ns, symbol, budget)
  if (!sharesToBuy) return `${symbol} SKIP budget/price`
  if (live && ns.stock.buyStock(symbol, sharesToBuy) !== 0) {
    state.positions[symbol] = { cost: ns.stock.getPurchaseCost(symbol, sharesToBuy, "L") }
  }
  return `${symbol} BUY ${sharesToBuy}${live ? " EXEC" : " DRY"}`
}

export async function main(ns) {
  ns.disableLog("ALL")
  const args = parseArgs(ns)
  const live = args.trade === true
  const interval = args.interval || POLL_MS
  if (!ns.stock.hasWseAccount() || !ns.stock.hasTixApiAccess()) {
    ns.tprint("mcp_stock_trader: WSE account and TIX API access required")
    return
  }
  if (!ns.stock.has4SDataTixApi()) {
    ns.tprint("mcp_stock_trader: stopped; 4S Market Data TIX API required")
    return
  }

  while (true) {
    const state = readState(ns)
    const actions = []
    const symbols = ns.stock.getSymbols()
    // Sells run first: their realized gain/loss adjusts the cap before any
    // new purchase, and their proceeds become available to this same poll.
    for (const symbol of symbols) {
      const action = positionStatus(ns, symbol, state, 0, live)
      if (action) actions.push(action)
    }
    const liquidationValue = symbols.reduce((total, symbol) => total + longPosition(ns, symbol, state).saleValue, 0)
    let budget = remainingAllocation({
      cash: ns.getServerMoneyAvailable("home"),
      liquidationValue,
      capFraction: state.capFraction,
    }).remaining
    for (const symbol of symbols) {
      if (longPosition(ns, symbol, state).shares > 0) continue
      const action = positionStatus(ns, symbol, state, budget, live)
      if (action) actions.push(action)
      if (live) {
        const refreshed = remainingAllocation({
          cash: ns.getServerMoneyAvailable("home"),
          liquidationValue: symbols.reduce((total, ticker) => total + longPosition(ns, ticker, state).saleValue, 0),
          capFraction: state.capFraction,
        })
        budget = refreshed.remaining
      }
    }
    if (live) writeState(ns, state)
    ns.clearLog()
    ns.print(`mcp_stock_trader ${live ? "LIVE" : "DRY RUN"}`)
    ns.print(`cap ${(state.capFraction * 100).toFixed(0)}% | available ${money(budget)} | wins/losses ${state.wins}/${state.losses}`)
    ns.print(actions.length ? actions.join("\n") : "no signal/action")
    await ns.sleep(interval)
  }
}
