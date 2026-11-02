import { capturePriorTailPosition, loadTailPosition, saveTailPosition } from "./tail_geometry.js"
import { readStacks } from "./stack_files.js"
import { buildPanel, WIDTH } from "./ops_hud_logic.js"
/**
 * Compact daily operations view: automation health, what the player is doing
 * and why, the next Red Pill goal and what blocks it, and what needs attention.
 *
 * Reads existing status files only. It scans nothing, controls no script and
 * writes no telemetry beyond ops_hud_version.txt. A stale file reads as stale.
 *
 * Start: run ops_hud.js [x=<px>] [y=<px>] [w=<px>] [h=<px>]
 * @param {NS} ns
 */
const ME = "ops_hud.js"
const POLL_MS = 15000
export const OPS_HUD_VERSION = "2026-11-02.1"
const OVERVIEW_DROP = 190
const RIGHT_MARGIN = 8
const COLORS = { head: "\u001b[1;37m", ok: "\u001b[1;32m", warn: "\u001b[1;33m" }
const RESET = "\u001b[0m"

function parseArgs(ns) {
  const out = {}
  for (const raw of ns.args) {
    const [key, value] = String(raw).split("=", 2)
    const number = Number(value)
    if (["x", "y", "w", "h"].includes(key) && Number.isFinite(number)) out[key] = number
  }
  return out
}

function json(ns, file, fallback = null) {
  try { return JSON.parse(ns.read(file) || "null") ?? fallback } catch { return fallback /* partial write */ }
}

function gather(ns) {
  return {
    now: Date.now(),
    mcp: json(ns, "mcp_status.json"),
    stacks: readStacks(ns, Infinity),
    stackManager: json(ns, "stack_manager_status.json"),
    capital: json(ns, "capital_status.json"),
    activity: json(ns, "player_activity_status.json"),
    install: json(ns, "aug_install_status.json"),
    root: json(ns, "dnet_deployer_home.json"),
    registry: json(ns, "dnet_manager_registry.json", {}),
    scout: json(ns, "dnet_scout_status.json"),
    lab: json(ns, "dnet_lab_status.json"),
    review: json(ns, "automation_review.json", {}),
  }
}

function closePrior(ns) {
  for (const proc of ns.ps(ns.getHostname())) {
    if (proc.pid === ns.pid || proc.filename.replace(/^\//, "") !== ME) continue
    ns.ui?.closeTail(proc.pid)
    ns.kill(proc.pid)
  }
}

function placeTail(ns, args, count, first) {
  if (!ns.ui) return
  const styles = ns.ui.getStyles?.()
  const charWidth = styles ? styles.tailFontSize * 0.6 : 8
  const lineHeight = styles ? styles.tailFontSize * styles.lineHeight : 16
  const width = args.w || Math.ceil(WIDTH * charWidth) + 34
  ns.ui.resizeTail(width, args.h || Math.ceil((count + 1) * lineHeight) + 40)
  if (!first) return
  const screenWidth = ns.ui.windowSize?.()[0] || 1280
  ns.ui.moveTail(Math.round(args.x === undefined ? Math.max(0, screenWidth - width - RIGHT_MARGIN) : args.x), Math.round(args.y === undefined ? OVERVIEW_DROP : args.y))
}

export async function main(ns) {
  ns.disableLog("ALL")
  await capturePriorTailPosition(ns, ME)
  closePrior(ns)
  // A generation marker lets mcp_launch.js refresh this panel once after a real upgrade.
  ns.write("ops_hud_version.txt", OPS_HUD_VERSION, "w")
  const parsed = parseArgs(ns)
  const args = { ...parsed, ...loadTailPosition(ns, ME, parsed) }
  ns.ui?.openTail()
  ns.ui?.setTailTitle("operations")
  let shown = 0
  while (true) {
    let rows
    try { rows = buildPanel(gather(ns)).rows } catch (e) { rows = [["warn", "ERROR"], ["warn", String(e).slice(0, WIDTH)]] }
    ns.clearLog()
    for (const [tone, text] of rows) ns.print(COLORS[tone] + text + RESET)
    if (rows.length !== shown) { placeTail(ns, args, rows.length, shown === 0); shown = rows.length }
    ns.ui?.renderTail()
    await saveTailPosition(ns, ME)
    await ns.sleep(POLL_MS)
  }
}
