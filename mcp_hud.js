/**
 * Terse status panel for mcp.js, sized to sit under the game's Overview.
 *
 * Reads mcp_status.json rather than measuring anything itself. That is
 * deliberate: a second observer that re-derives the numbers can disagree with
 * the orchestrator, and then you are debugging the disagreement instead of the
 * bot. get_stats.js is the wide per-server view; this is the "is it healthy?"
 * glance.
 *
 * Args (all optional, any order):
 *   x=<px> y=<px>   absolute tail position, overriding the default anchor
 *   w=<px> h=<px>   absolute tail size, overriding the fitted size
 *
 * Re-running with new args supersedes the previous instance rather than
 * stacking another window beside it, so repositioning is just a re-run.
 *
 * Costs the 1.6GB script baseline plus ~0.75GB for that self-supersede check
 * (ns.ps + ns.kill); everything in the display path itself is 0GB.
 *
 * @param {NS} ns
 */
const STATUS_FILE = "mcp_status.json"
const POLL_MS = 2000

// Bitburner renders ANSI escapes in tail windows (its own ns.print docs
// demonstrate it). White separates our panels from the game's green at a
// glance. Basic codes only — this build has no 256-colour support, so
// \u001b[38;5;15m would render as literal text.
const WHITE = "\u001b[37m"
const RESET = "\u001b[0m"

// A status file older than this means mcp.js is wedged or dead. Its own loop
// sleeps 10s, and ticks have been observed stretching past 60s, so this is
// generous on purpose: the point is to catch "stopped", not "slow".
const STALE_MS = 90000

// Thresholds for the verdict line. DRAINED matches mcp.js's DEGRADED_MONEY_PCT
// so the HUD and the orchestrator agree on what "drained" means.
const DRAINED_MONEY_PCT = 0.05
const SLOW_TICK_S = 30

// Distance from the top of the screen to hang the panel, i.e. roughly the
// height of the game's Overview box. Adjust with the y= arg if your overview
// is a different height (it grows as you unlock more stats).
const OVERVIEW_DROP = 190
const RIGHT_MARGIN = 8

const WIDTH_CHARS = 26

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

function readStatus(ns) {
  // ns.read returns "" for a file that does not exist, which costs nothing and
  // avoids ns.fileExists (0.1GB).
  const raw = ns.read(STATUS_FILE)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

function threadTotals(status) {
  const totals = { weaken: 0, grow: 0, hack: 0 }
  for (const worker of status.workers || []) {
    for (const action of worker.actions || []) {
      if (totals[action.script] !== undefined) totals[action.script] += action.threads
    }
  }
  return totals
}

function ramUtilization(status) {
  let max = 0
  let used = 0
  for (const worker of status.workers || []) {
    max += worker.maxRam || 0
    used += worker.usedRam || 0
  }
  return max > 0 ? used / max : 0
}

/**
 * One word for "should Ken look closer?", plus — per the diagnosis rule — the
 * lines below always carry the inputs that produced it, so the verdict is
 * never the only evidence.
 */
function verdict(status, ageMs) {
  if (!status) return "NO DATA"
  if (ageMs > STALE_MS) return "STALE"
  if (status.needWeaken > status.maxWeaken) return "WEAKEN"
  if (status.avgMoneyPct < DRAINED_MONEY_PCT) return "DRAINED"
  if (status.tickSeconds > SLOW_TICK_S) return "SLOW"
  return "OK"
}

function buildLines(ns, status) {
  if (!status) {
    return [row("NO DATA", "--"), row(STATUS_FILE, ""), row("mcp running?", "")]
  }
  const ageS = Math.max(0, Math.round((Date.now() - status.ts) / 1000))
  const threads = threadTotals(status)
  const pct = (value) => (Number.isFinite(value) ? Math.round(value * 100) + "%" : "--")

  return [
    row(verdict(status, Date.now() - status.ts), status.target || "-"),
    row("plan", status.plan || "-"),
    row("money " + pct(status.moneyPct), "sec " + (status.currentSecurity || 0).toFixed(2)),
    row("rate " + money(status.rate), "avg " + money(status.avgRate)),
    row("wkn " + status.needWeaken + "/" + status.maxWeaken, "w" + threads.weaken + " g" + threads.grow + " h" + threads.hack),
    row("ram " + pct(ramUtilization(status)), (status.workers || []).length + " hosts"),
    row("lvl " + (status.player && status.player.skills ? status.player.skills.hacking : "-"), money(status.player ? status.player.money : 0)),
    switchRow(status),
    row("tick " + (status.tickSeconds || 0).toFixed(1) + "s", "age " + ageS + "s"),
  ]
}

/**
 * "Why is it still on this target?" — the question that came up over and over
 * while debugging, whose answer was always computable and never written down.
 *
 * Three distinct states, and they call for different responses:
 *   = <name>     nothing outranks the current target. Working as intended.
 *   hold Ns      a better target exists but the commit timer is still running.
 *   <name> N.Nx  a better target exists and it is not winning by enough.
 * The last one is the interesting case: it means OPPORTUNITY_SWITCH_FACTOR is
 * the thing standing between the bot and a richer server.
 */
function switchRow(status) {
  const evaluation = status.switchEval
  if (!evaluation) return row("next", status.target ? "-" : "choosing")
  if (!evaluation.best || evaluation.best === status.target) return row("next", "= current")
  if (evaluation.blockedBy === "hold") {
    const left = Math.max(0, evaluation.holdSeconds - evaluation.heldSeconds)
    return row("next " + evaluation.best, "hold " + left + "s")
  }
  return row("next " + evaluation.best, evaluation.ratio.toFixed(1) + "/" + evaluation.factor + "x")
}

function placeTail(ns, args, lines) {
  if (!ns.ui) return
  if (typeof ns.ui.openTail === "function") ns.ui.openTail()
  if (typeof ns.ui.setTailTitle === "function") ns.ui.setTailTitle("mcp")

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

  if (typeof ns.ui.moveTail === "function") {
    let x = args.x
    let y = args.y
    if (x === undefined) {
      // Hang off the right edge, under the Overview, without hardcoding a
      // screen width. windowSize() is 0GB; fall back to a sane constant if
      // this Bitburner build predates it.
      const screenWidth =
        typeof ns.ui.windowSize === "function" ? ns.ui.windowSize()[0] : 1280
      x = Math.max(0, screenWidth - width - RIGHT_MARGIN)
    }
    if (y === undefined) y = OVERVIEW_DROP
    ns.ui.moveTail(x, y)
  }
}

/**
 * Bitburner gives every running script its own tail window, so `run mcp_hud.js
 * y=220` to reposition would otherwise leave the old window behind rather than
 * moving it. Kill any earlier copy of ourselves first.
 *
 * ns.ps reports filenames without a leading slash, which is the same trap that
 * made mcp.js's killActionScripts silently match nothing for hours — normalize
 * before comparing.
 */
function killPriorInstances(ns) {
  const self = ns.pid
  const me = "mcp_hud.js"
  for (const proc of ns.ps(ns.getHostname())) {
    const name = proc.filename.startsWith("/") ? proc.filename.slice(1) : proc.filename
    if (name === me && proc.pid !== self) ns.kill(proc.pid)
  }
}

export async function main(ns) {
  ns.disableLog("ALL")
  killPriorInstances(ns)
  const args = parseArgs(ns)
  let placed = false

  while (true) {
    const status = readStatus(ns)
    const lines = buildLines(ns, status)

    ns.clearLog()
    for (const line of lines) ns.print(WHITE + line + RESET)

    // Placed once rather than every tick: repositioning on a loop makes the
    // window impossible to drag somewhere else.
    if (!placed) {
      placeTail(ns, args, lines)
      placed = true
    }
    if (ns.ui && typeof ns.ui.renderTail === "function") ns.ui.renderTail()

    await ns.sleep(POLL_MS)
  }
}
