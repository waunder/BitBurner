import { capturePriorTailPosition, loadTailPosition, saveTailPosition } from "./tail_geometry.js"

// Ken's BC time, UTC-7 year-round. The game browser's older time zone data shows Vancouver an hour
// behind, so toLocaleTimeString() is wrong here (same fix as money.js).
const bcTime = (ms) => new Date(ms - 7 * 3600000).toISOString().slice(11, 19)
/** Run report tail window.
 *
 * Shows run_report.json, which the hourly scheduled task writes and pushes:
 * {"ts": <ms>, "title": "...", "lines": ["..."]}. Rereads it every 10 seconds,
 * so a new report needs a push only, never a restart.
 *
 * Usage: run run_report.js
 */

const FILE = "run_report.json"
const POLL_MS = 10000
const DEFAULT_X = 380
const DEFAULT_Y = 0
const WIDTH = 520
// The task runs hourly; past two hours a report is overdue, so say so.
const OVERDUE_MS = 2 * 60 * 60 * 1000

function age(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60000))
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function readReport(ns) {
  try { return JSON.parse(ns.read(FILE)) } catch { return null }
}

function render(report, now) {
  if (!report || !Array.isArray(report.lines)) return ["No run report yet (run_report.json missing or invalid)."]
  const posted = Number.isFinite(report.ts) ? bcTime(report.ts) : "unknown time"
  const overdue = Number.isFinite(report.ts) && now - report.ts > OVERDUE_MS ? "  ⚠ overdue" : ""
  return [
    `${report.title || "Run report"}`,
    `Posted ${posted} (${Number.isFinite(report.ts) ? age(now - report.ts) : "?"} ago)${overdue}`,
    "─".repeat(40),
    ...report.lines.map(String),
  ]
}

export async function main(ns) {
  ns.disableLog("ALL")
  await capturePriorTailPosition(ns, "run_report.js")
  for (const proc of ns.ps("home")) {
    if (proc.filename.replace(/^\//, "") === "run_report.js" && proc.pid !== ns.pid) {
      ns.ui.closeTail(proc.pid)
      ns.kill(proc.pid)
    }
  }
  const open = () => {
    const pos = loadTailPosition(ns, "run_report.js")
    ns.ui.openTail()
    ns.ui.setTailTitle("Run report")
    ns.ui.moveTail(pos.x ?? DEFAULT_X, pos.y ?? DEFAULT_Y)
  }
  open()
  let shownTs = readReport(ns)?.ts
  while (true) {
    const report = readReport(ns)
    // Closing the window leaves the script running; a new report reopens it.
    if (report?.ts !== shownTs) {
      shownTs = report?.ts
      open()
    }
    const lines = render(report, Date.now())
    ns.clearLog()
    for (const line of lines) ns.print(line)
    const styles = ns.ui.getStyles?.() || {}
    const lineHeight = (styles.tailFontSize || 14) * (styles.lineHeight || 1.2)
    ns.ui.resizeTail(WIDTH, Math.ceil((lines.length + 1) * lineHeight) + 40)
    ns.ui.renderTail()
    await saveTailPosition(ns, "run_report.js")
    await ns.sleep(POLL_MS)
  }
}
