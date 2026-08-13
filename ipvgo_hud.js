/**
 * Terse status panel for ipvgo_player.js, same shape and reasoning as
 * mcp_hud.js (see that file's own header) — stacks below it and
 * mcp_money.js/mcp_stocks.js on the right edge of the screen.
 *
 * Built after Ken asked for the dashboard artifact to refresh on a
 * schedule, which turned out to be the wrong shape for the problem: the
 * dashboard is redeployed by Claude from outside the game, but the live
 * IPvGO numbers only exist on Ken's machine (pulled by the daemon into
 * ipvgo_status.json, gitignored, never on GitHub) — no cloud-scheduled
 * agent can reach them, and even a local-bridge routine's 1-hour minimum
 * cron interval doesn't read as "regular interval" for a game that plays
 * several 7x7 games a minute. A panel that reads the same status file
 * in-game, the way mcp_hud.js already does for mcp.js, has no refresh
 * problem at all — it's live for exactly as long as it's open, no
 * scheduling required.
 *
 * Reads ipvgo_status.json rather than measuring anything itself, same
 * "don't re-derive what the source already computed" reasoning as
 * mcp_hud.js.
 *
 * Args (all optional, any order):
 *   x=<px> y=<px>   absolute tail position, overriding the default anchor
 *   w=<px> h=<px>   absolute tail size, overriding the fitted size
 *
 * Re-running with new args supersedes the previous instance rather than
 * stacking another window beside it, same as mcp_hud.js.
 *
 * Costs the 1.6GB script baseline plus ~0.75GB for the self-supersede
 * check (ns.ps + ns.kill); everything else in the display path is 0GB
 * (ns.read, JSON.parse, ns.ui.*).
 *
 * @param {NS} ns
 */
const STATUS_FILE = "ipvgo_status.json"
const POLL_MS = 2000

// Matches mcp_hud.js's WHITE/RESET choice for the same reason: separates
// our panels from the game's green at a glance.
const WHITE = "\u001b[37m"
const RESET = "\u001b[0m"

// ipvgo_player.js plays continuously once a game is active, but a single
// game can run for minutes without a status write (writes happen on move
// and on game-end, not on a fixed tick like mcp.js's 10s loop) -- so this
// needs to be generous compared to mcp_hud.js's STALE_MS, or a panel
// showing a script that's actually fine mid-game would read as dead.
const STALE_MS = 180000

// Stacks below mcp_hud.js (y=190), mcp_money.js (y=430), and
// mcp_stocks.js (y=640) on the right edge -- see docs/processes.md's HUD
// layout diagram. Each prior panel's actual rendered height differs
// slightly, so this is a deliberate round-number slot with margin, not a
// measured exact value; adjust with y= if a future panel's real height
// collides with it.
const DEFAULT_Y = 850
const RIGHT_MARGIN = 8

const WIDTH_CHARS = 28

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

function row(left, right) {
  const gap = WIDTH_CHARS - left.length - right.length
  return gap > 0 ? left + " ".repeat(gap) + right : left + " " + right
}

function readStatus(ns) {
  const raw = ns.read(STATUS_FILE)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

function pct(value) {
  return Number.isFinite(value) ? Math.round(value * 100) + "%" : "--"
}

function verdict(status, ageMs) {
  if (!status) return "NO DATA"
  if (ageMs > STALE_MS) return "STALE"
  return "OK"
}

function buildLines(status, pos) {
  if (!status) {
    return [row("NO DATA", "--"), row(STATUS_FILE, ""), row("ipvgo_player running?", ""), row("x=" + pos.x, "y=" + pos.y)]
  }
  const ageS = Math.max(0, Math.round((Date.now() - status.ts) / 1000))
  const last = status.lastResult
  const lastLine = last ? (last.won ? "WIN " : "loss ") + last.blackScore + "-" + last.whiteScore : "--"
  const moveLine = last ? Math.round(last.avgMoveMs || 0) + "/" + Math.round(last.maxMoveMs || 0) + "ms" : "--"

  return [
    row(verdict(status, Date.now() - status.ts), status.opponent || "-"),
    row("algo", status.algorithm || "-"),
    row("win " + pct(status.recentWinRate), "n=" + (status.recentGamesCount ?? "-")),
    row("record", (status.wins ?? "-") + "/" + (status.gamesPlayed ?? "-")),
    row("streak " + (status.winStreak ?? "-"), "best " + (status.highestWinStreak ?? "-")),
    row("last", lastLine),
    row("move ms", moveLine),
    row("bonus", (status.bonusPercent != null ? status.bonusPercent.toFixed(0) + "%" : "--")),
    row("vs opp", (status.opponentLifetimeWins ?? "-") + "-" + (status.opponentLifetimeLosses ?? "-")),
    row("age " + ageS + "s", ""),
    row("x=" + pos.x, "y=" + pos.y),
  ]
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
  if (typeof ns.ui.setTailTitle === "function") ns.ui.setTailTitle("ipvgo")

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

// Same reasoning as mcp_hud.js's killPriorInstances: ns.kill does not close
// the killed script's tail window, so an explicit ns.ui.closeTail(pid) is
// needed too, or every restart leaves one more ghost panel behind.
function killPriorInstances(ns) {
  const self = ns.pid
  const me = "ipvgo_hud.js"
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
    let status = null
    let lines
    try {
      status = readStatus(ns)
      lines = buildLines(status, pos)
    } catch (e) {
      lines = [row("HUD ERROR", "--"), String(e).slice(0, WIDTH_CHARS), row("check ipvgo_hud.js", ""), row("x=" + pos.x, "y=" + pos.y)]
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
