/**
 * Read-only stock market panel — groundwork for trading, not trading itself.
 * Never calls buyStock/sellStock/buyShort/sellShort/placeOrder/cancelOrder;
 * this script cannot move money. It exists to answer "do we have access,
 * what are we holding, and (once 4S is bought) what looks worth buying" —
 * same terse-panel family as mcp_hud.js/mcp_money.js, independently
 * startable/closeable/rollup-able.
 *
 * Built right after an augmentation install: stock *positions* are wiped by
 * that reset but WSE account / TIX API access are not (confirmed against
 * source — only a BitNode-prestige reset clears those flags), so this panel
 * should show 0 positions and live TIX access simultaneously right now.
 *
 * Without 4S Data (not yet purchased — $25b, deferred), getForecast/
 * getVolatility have no signal to report, so the panel skips the full
 * symbol dump (would be ~30+ undifferentiated rows) in favor of a one-line
 * "locked" note. Once 4S is bought, no code change is needed — the
 * watchlist section activates on its own.
 *
 * Args (all optional, any order):
 *   x=<px> y=<px>   absolute tail position, overriding the default anchor
 *   w=<px> h=<px>   absolute tail size, overriding the fitted size
 *
 * Re-running supersedes the previous instance (process + window) rather
 * than stacking another one beside it.
 *
 * Cost: 1.6GB baseline + ns.ps (0.2) + ns.kill (0.5, self-supersede) +
 * stock.hasWseAccount/hasTixApiAccess/has4SData (0.05 each) +
 * stock.getSymbols/getPrice/getPosition (2.0 each) +
 * stock.getForecast/getVolatility (2.5 each) = 11.45GB.
 *
 * @param {NS} ns
 */
const POLL_MS = 4000

const WHITE = "[37m"
const RESET = "[0m"

const DEFAULT_Y = 640
const RIGHT_MARGIN = 8
const WIDTH_CHARS = 34
const WATCHLIST_SIZE = 10

function parseArgs(ns) {
  const out = {}
  for (const raw of ns.args) {
    const text = String(raw)
    const eq = text.indexOf("=")
    if (eq < 0) continue
    const value = Number(text.slice(eq + 1))
    if (Number.isFinite(value)) out[text.slice(0, eq).trim()] = value
  }
  return out
}

function money(value) {
  const n = Number(value) || 0
  const sign = n < 0 ? "-" : ""
  const abs = Math.abs(n)
  const units = [
    [1e12, "t"],
    [1e9, "b"],
    [1e6, "m"],
    [1e3, "k"],
  ]
  for (const [scale, suffix] of units) {
    if (abs >= scale) {
      const scaled = abs / scale
      return sign + (scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(2)) + suffix
    }
  }
  return sign + abs.toFixed(0)
}

function row(left, right) {
  const gap = WIDTH_CHARS - left.length - right.length
  return gap > 0 ? left + " ".repeat(gap) + right : left + " " + right
}

function buildLines(ns, pos) {
  const hasWse = ns.stock.hasWseAccount()
  const hasTix = ns.stock.hasTixApiAccess()
  if (!hasWse || !hasTix) {
    return [
      row("NO TIX ACCESS", ""),
      row("wse", hasWse ? "yes" : "no"),
      row("tix", hasTix ? "yes" : "no"),
      row("x=" + pos.x, "y=" + pos.y),
    ]
  }

  const has4S = ns.stock.has4SData()
  const symbols = ns.stock.getSymbols()

  const positions = []
  let longValue = 0
  let shortValue = 0
  for (const sym of symbols) {
    const [longShares, longAvg, shortShares, shortAvg] = ns.stock.getPosition(sym)
    if (!longShares && !shortShares) continue
    const price = ns.stock.getPrice(sym)
    const lv = longShares * price
    const sv = shortShares * price
    longValue += lv
    shortValue += sv
    positions.push({
      sym,
      longShares,
      longAvg,
      shortShares,
      shortAvg,
      unrealized: longShares * (price - longAvg) + shortShares * (shortAvg - price),
    })
  }

  const lines = [
    row("wse/tix", "yes/yes"),
    row("4S data", has4S ? "yes" : "locked"),
    row("positions", String(positions.length)),
    row("long value", money(longValue)),
    row("short value", money(shortValue)),
  ]

  if (positions.length === 0) {
    lines.push(row("(no positions)", ""))
  } else {
    for (const p of positions) {
      const shares = p.longShares || -p.shortShares
      lines.push(row(p.sym, (shares > 0 ? "+" : "") + shares + " pl " + money(p.unrealized)))
    }
  }

  if (!has4S) {
    lines.push(row("watchlist", "locked (buy 4S)"))
  } else {
    const watch = symbols
      .map((sym) => ({ sym, forecast: ns.stock.getForecast(sym), vol: ns.stock.getVolatility(sym) }))
      .sort((a, b) => Math.abs(b.forecast - 0.5) - Math.abs(a.forecast - 0.5))
      .slice(0, WATCHLIST_SIZE)
    lines.push(row("watchlist", "fcst/vol"))
    for (const w of watch) {
      lines.push(row(w.sym, (w.forecast * 100).toFixed(0) + "% " + (w.vol * 100).toFixed(1) + "%"))
    }
  }

  lines.push(row("x=" + pos.x, "y=" + pos.y))
  return lines
}

function resolvePosition(ns, args) {
  const styles = ns.ui && typeof ns.ui.getStyles === "function" ? ns.ui.getStyles() : null
  const charWidth = styles ? styles.tailFontSize * 0.6 : 8
  const approxWidth = args.w || Math.ceil(WIDTH_CHARS * charWidth) + 34

  let x = args.x
  if (x === undefined) {
    const screenWidth = ns.ui && typeof ns.ui.windowSize === "function" ? ns.ui.windowSize()[0] : 1280
    x = Math.max(0, screenWidth - approxWidth - RIGHT_MARGIN)
  }
  const y = args.y === undefined ? DEFAULT_Y : args.y
  return { x: Math.round(x), y: Math.round(y) }
}

function placeTail(ns, args, lines, pos) {
  if (!ns.ui) return
  if (typeof ns.ui.openTail === "function") ns.ui.openTail()
  if (typeof ns.ui.setTailTitle === "function") ns.ui.setTailTitle("mcp_stocks")

  let width = args.w
  let height = args.h
  if (!width || !height) {
    const styles = typeof ns.ui.getStyles === "function" ? ns.ui.getStyles() : null
    const charWidth = styles ? styles.tailFontSize * 0.6 : 8
    const lineHeight = styles ? styles.tailFontSize * styles.lineHeight : 16
    width = width || Math.ceil(WIDTH_CHARS * charWidth) + 34
    height = height || Math.ceil((lines.length + 1) * lineHeight) + 40
  }
  if (typeof ns.ui.resizeTail === "function") ns.ui.resizeTail(width, height)
  if (typeof ns.ui.moveTail === "function") ns.ui.moveTail(pos.x, pos.y)
}

function killPriorInstances(ns) {
  const self = ns.pid
  const me = "mcp_stocks.js"
  for (const proc of ns.ps(ns.getHostname())) {
    const name = proc.filename.startsWith("/") ? proc.filename.slice(1) : proc.filename
    if (name === me && proc.pid !== self) {
      if (ns.ui && typeof ns.ui.closeTail === "function") ns.ui.closeTail(proc.pid)
      ns.kill(proc.pid)
    }
  }
}

export async function main(ns) {
  ns.disableLog("ALL")
  killPriorInstances(ns)
  const args = parseArgs(ns)
  const pos = resolvePosition(ns, args)
  // Line count varies a lot here (0 positions vs several, 4S locked vs a
  // full watchlist) — re-placing whenever it changes avoids the truncation
  // bug documented in CLAUDE.md (a tail only renders what fits its
  // configured height; a stale small size silently drops new rows).
  let placedLineCount = -1

  while (true) {
    let lines
    try {
      lines = buildLines(ns, pos)
    } catch (e) {
      lines = [row("ERROR", "--"), String(e).slice(0, WIDTH_CHARS), row("x=" + pos.x, "y=" + pos.y)]
    }

    ns.clearLog()
    for (const line of lines) ns.print(WHITE + line + RESET)

    if (lines.length !== placedLineCount) {
      placeTail(ns, args, lines, pos)
      placedLineCount = lines.length
    }
    if (ns.ui && typeof ns.ui.renderTail === "function") ns.ui.renderTail()

    await ns.sleep(POLL_MS)
  }
}
