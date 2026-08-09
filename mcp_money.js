/**
 * Terse money sources/sinks panel — a second small log window alongside
 * mcp_hud.js, independently startable/closeable/rollup-able like any tail
 * window, since it answers a different question than the HUD does: not "is
 * the bot healthy" but "where is money actually coming from and going".
 *
 * Reads ns.getMoneySources().sinceInstall directly rather than going through
 * mcp_status.json — this data isn't specific to the bot's own target/plan,
 * it's whole-player accounting the game already tracks, so there's no
 * "orchestrator's belief vs this panel's belief" disagreement risk the way
 * there would be for anything mcp.js-specific.
 *
 * "Since install" (not "since start") deliberately, matching mcp_hud.js's
 * earned-income row: survives script and game restarts, only resetting on
 * an actual augmentation install.
 *
 * Expense categories (hacknet_expenses, gang_expenses) are already negative
 * numbers at the source — confirmed against the game's own code, not
 * assumed: loseMoney() calls recordMoneySource(-1 * amount, category). A
 * plain signed formatter renders them correctly with no special-casing.
 *
 * Args (all optional, any order):
 *   x=<px> y=<px>   absolute tail position, overriding the default anchor
 *   w=<px> h=<px>   absolute tail size, overriding the fitted size
 *
 * Re-running supersedes the previous instance (process + window) rather
 * than stacking another one beside it.
 *
 * Cost: 1.6GB baseline + ns.getMoneySources (1.0GB) + ns.ps (0.2GB) +
 * ns.kill (0.5GB, self-supersede) = 3.3GB. Every ns.ui.* call is 0GB.
 *
 * @param {NS} ns
 */
const POLL_MS = 2000

const WHITE = "[37m"
const RESET = "[0m"

// Positioned below where mcp_hud.js typically sits by default, so the two
// don't overlap out of the box; x=/y= override either independently.
const DEFAULT_Y = 430
const RIGHT_MARGIN = 8
const WIDTH_CHARS = 30

// Categories the game tracks that aren't really "sources or sinks" in the
// sense this panel cares about — total is a summary, not a category.
const SKIP = new Set(["total"])

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
  const sources = ns.getMoneySources()
  const since = sources && sources.sinceInstall
  if (!since) return [row("NO DATA", "--"), row("getMoneySources", "empty"), row("x=" + pos.x, "y=" + pos.y)]

  const entries = Object.keys(since)
    .filter((key) => !SKIP.has(key) && since[key])
    .map((key) => ({ key, value: since[key] }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))

  // "since install" was genuinely ambiguous — reads easily as "since the
  // game was installed" (i.e. ever) rather than its actual meaning, "since
  // your last augmentation install". Spelled out to remove the ambiguity.
  const lines = [row("since last aug", ""), row("total", money(since.total || 0))]
  if (entries.length === 0) {
    lines.push(row("(nothing yet)", ""))
  } else {
    for (const { key, value } of entries) lines.push(row(key, money(value)))
  }
  lines.push(row("x=" + pos.x, "y=" + pos.y))
  return lines
}

/**
 * Resolves where the window will land, independent of rendering it. No
 * getter for a tail window's actual position/size exists anywhere in the
 * ui cost table — checked, not assumed — so a manual drag can never be read
 * back. This is the substitute: show what was actually applied (args, or
 * the computed default), so dialing in a position is "adjust the number,
 * see where it lands, read the confirmation" rather than "drag, then
 * capture". width here is approximate (WIDTH_CHARS-derived, not the
 * post-content-fit value) — fine for the right-edge anchor, and it means
 * position doesn't have to wait on line count to resolve.
 */
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
  if (typeof ns.ui.setTailTitle === "function") ns.ui.setTailTitle("mcp_money")

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

/**
 * Same self-supersede pattern as mcp_hud.js/get_stats.js/mcp_supervisor.js:
 * ns.kill alone leaves an orphaned, frozen tail window behind, so
 * ns.ui.closeTail(pid) has to run first, while the prior instance's PID is
 * still visible to ns.ps.
 */
function killPriorInstances(ns) {
  const self = ns.pid
  const me = "mcp_money.js"
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
  let placed = false

  while (true) {
    let lines
    try {
      lines = buildLines(ns, pos)
    } catch (e) {
      lines = [row("ERROR", "--"), String(e).slice(0, WIDTH_CHARS), row("x=" + pos.x, "y=" + pos.y)]
    }

    ns.clearLog()
    for (const line of lines) ns.print(WHITE + line + RESET)

    if (!placed) {
      placeTail(ns, args, lines, pos)
      placed = true
    }
    if (ns.ui && typeof ns.ui.renderTail === "function") ns.ui.renderTail()

    await ns.sleep(POLL_MS)
  }
}
