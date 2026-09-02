/** Consolidated Interactive HUD - Clickable Sections
 *
 * Single summary window showing MCP, Darknet, Augmentation, System status.
 * Each section clickable to expand/collapse.
 *
 * Also spawns a background click detector (hud_click_monitor.js) that tracks
 * mouse position and toggles sections when you click on them.
 *
 * Usage:
 *   run hud_consolidated.js [x=<px>] [y=<px>] [w=<px>] [h=<px>]
 *
 * Click on any section header to expand/collapse.
 */

const DEFAULT_X = 0    // Top-left, resolution-agnostic
const DEFAULT_Y = 0
const DEFAULT_W = 360
const DEFAULT_H = 280
const POLL_MS = 5000
const FRESH_MS = 120000
const STATE_FILE = "hud_consolidated_state.json"
const POSITION_FILE = "hud_consolidated_position.json"

const COLORS = {
  HEADER: "[1;37m",    // Bright white
  SECTION: "[1;36m",   // Bright cyan (for clickable sections)
  HEALTHY: "[1;32m",   // Bright green
  WARNING: "[1;33m",   // Bright yellow
  CRITICAL: "[1;31m",  // Bright red
  DIMMED: "[90m",      // Dark gray
  RESET: "[0m",
}

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

function json(ns, file) {
  try {
    return JSON.parse(ns.read(file))
  } catch {
    return null
  }
}

function compact(value, digits = 1) {
  const n = Number(value) || 0
  const sign = n < 0 ? "-" : ""
  const abs = Math.abs(n)
  for (const [scale, suffix] of [[1e12, "t"], [1e9, "b"], [1e6, "m"], [1e3, "k"]]) {
    if (abs >= scale) return sign + (abs / scale).toFixed(digits) + suffix
  }
  return sign + (Number.isInteger(abs) ? String(abs) : abs.toFixed(digits))
}

function mcpStatus(ns, now) {
  const status = json(ns, "mcp_status.json")
  if (!status) return { compact: "-- unavailable", expanded: [] }

  // MCP is running if status file is fresh (not stale); same logic as mcp_hud.js
  const STALE_MS = 300000
  const ageMs = now - (status.ts || 0)
  const running = ageMs < STALE_MS

  const target = status.target || "--"
  const money = status.totalHacked || 0
  const rate = status.rate || 0  // Current rate
  const avgRate = status.avgRate || 0  // Average rate
  const workers = status.workers || []
  const workerCount = workers.length

  // Convert rate (per second) to per minute for display
  const moneyPerMin = rate * 60

  // Count actions across all workers
  let weakenTotal = 0, growTotal = 0, hackTotal = 0, threadTotal = 0
  for (const worker of workers) {
    for (const action of (worker.actions || [])) {
      const threads = action.threads || 0
      threadTotal += threads
      if (action.script === "weaken") weakenTotal += threads
      else if (action.script === "grow") growTotal += threads
      else if (action.script === "hack") hackTotal += threads
    }
  }

  const actionSummary = `${weakenTotal}w ${growTotal}g ${hackTotal}h`
  const deployment = `${workerCount}h ${threadTotal}t (${actionSummary})`

  return {
    compact: `${running ? "✓" : "⊘"} ${compact(moneyPerMin, 1)}/m ${actionSummary}`,
    expanded: [
      `Status: ${running ? "RUNNING" : "STOPPED"}`,
      `Target: ${target}`,
      `Rate: ${compact(rate, 2)}/s (avg ${compact(avgRate, 2)}/s)`,
      `Total hacked: ${compact(money)}`,
      `Deployment: ${deployment}`,
    ],
  }
}

function darknetStatus(ns, now) {
  const canaryState = json(ns, "dnet_canary_phase1_completed.txt")
  const registryRaw = json(ns, "dnet_manager_registry.json")
  const managers = registryRaw ? Object.keys(registryRaw).filter(k => k.startsWith("host_")).length : 0

  // Get phish thread capacity from latest deployer shard
  let phishThreads = 0
  const deployerFiles = ns.ls("home", "dnet_deployer_")
  for (const file of deployerFiles) {
    if (!file.endsWith(".json")) continue
    const rec = json(ns, file)
    if (rec && Number.isFinite(rec.farmCapacityThreads)) {
      phishThreads = Math.max(phishThreads, rec.farmCapacityThreads)
    }
  }

  let state = "PAUSED"
  let detail = "Paused"
  let threadStr = "0t"

  if (canaryState) {
    state = "CANARY"
    detail = `Phase 1: ${managers} manager(s)`
    threadStr = `${phishThreads}t`
  } else if (managers > 0) {
    state = "ACTIVE"
    detail = `${managers} manager(s) running`
    threadStr = `${phishThreads}t`
  }

  return {
    compact: `${state === "PAUSED" ? "⏸" : "▶"} ${detail} ${threadStr}`,
    expanded: [
      `Status: ${state}`,
      detail,
      `Phish threads: ${phishThreads}`,
      `Registry entries: ${registryRaw ? Object.keys(registryRaw).length : 0}`,
    ],
  }
}

function augmentationStatus(ns, now) {
  const mcp = json(ns, "mcp_status.json")
  if (!mcp) return { compact: "-- unavailable", expanded: [] }

  const charisma = mcp.player?.skills?.charisma || 0
  const xpRate = mcp.xpPerMinute?.xp || 0
  const nextAugMs = mcp.augmentation?.nextAugmentationMs || 0
  const nextAugMin = Math.max(0, Math.floor(nextAugMs / 60000))

  let detail = `+${compact(xpRate)}/m`
  if (nextAugMin > 0) {
    const h = Math.floor(nextAugMin / 60)
    const m = nextAugMin % 60
    detail += ` → ${h}h ${m}m`
  }

  return {
    compact: detail,
    expanded: [
      `Charisma: ${charisma}`,
      `XP/min: ${compact(xpRate, 1)}`,
      `Next aug: ${nextAugMin > 0 ? `${nextAugMin}m` : "unknown"}`,
    ],
  }
}

function systemStatus(ns, now) {
  const statusOk = json(ns, "dnet_scorecard_status.json")
  const freshMs = now - (statusOk?.ts || 0)
  const apiOk = freshMs < 30000

  const mcp = json(ns, "mcp_status.json")
  const mcpFreshMs = now - (mcp?.timestamp || 0)
  const mcpOk = mcpFreshMs < 60000

  return {
    compact: `API ${apiOk ? "✓" : "⚠"} MCP ${mcpOk ? "✓" : "⚠"}`,
    expanded: [
      `Remote API: ${apiOk ? "connected" : "stale"}`,
      `MCP: ${mcpOk ? "fresh" : "stale"}`,
    ],
  }
}

function buildDisplay(ns, state, pos) {
  const now = Date.now()

  const sections = [
    { key: "mcp", label: "MCP", data: mcpStatus(ns, now) },
    { key: "darknet", label: "Darknet", data: darknetStatus(ns, now) },
    { key: "aug", label: "Augmentation", data: augmentationStatus(ns, now) },
    { key: "system", label: "System", data: systemStatus(ns, now) },
  ]

  const lines = []
  lines.push(COLORS.HEADER + "╔═══════════════════════════════════╗" + COLORS.RESET)
  lines.push(COLORS.HEADER + "║        CONSOLIDATED HUD           ║" + COLORS.RESET)
  lines.push(COLORS.HEADER + "╚═══════════════════════════════════╝" + COLORS.RESET)
  lines.push("")

  let lineNum = 4

  for (const section of sections) {
    const isExpanded = state.expanded === section.key
    const indicator = isExpanded ? "▼" : "▶"
    const keyHint = { mcp: "hm", darknet: "hd", aug: "ha", system: "hs" }[section.key]
    const hint = COLORS.DIMMED + `[${keyHint}]` + COLORS.RESET
    const sectionHeader = COLORS.SECTION + `${indicator} ${section.label}` + COLORS.RESET
    const compactLine = sectionHeader + " " + section.data.compact + " " + hint

    lines.push(compactLine)
    lineNum++

    if (isExpanded) {
      lines.push(COLORS.DIMMED + "  " + "─".repeat(30) + COLORS.RESET)
      lineNum++
      for (const detail of section.data.expanded) {
        lines.push("  " + detail)
        lineNum++
      }
      lines.push("")
      lineNum++
    }
  }

  lines.push(COLORS.DIMMED + `Updated: ${new Date().toLocaleTimeString()}` + COLORS.RESET)

  return lines
}

function killPriorInstances(ns) {
  for (const proc of ns.ps(ns.getHostname())) {
    const name = proc.filename.startsWith("/") ? proc.filename.slice(1) : proc.filename
    if (name === "hud_consolidated.js" && proc.pid !== ns.pid) {
      ns.ui.closeTail(proc.pid)
      ns.kill(proc.pid)
    }
  }
}

function placeTail(ns, pos, size) {
  if (!ns.ui) return

  ns.ui.openTail()
  ns.ui.setTailTitle("HUD")
  ns.ui.resizeTail(size.w, size.h)
  ns.ui.moveTail(pos.x, pos.y)
}

function resizeTail(ns, lines, size) {
  if (!ns.ui) return

  // Use actual font metrics from game if available, otherwise estimate
  let lineHeight = 16
  try {
    const styles = ns.ui.getStyles?.()
    if (styles) {
      lineHeight = styles.tailFontSize * (styles.lineHeight || 1)
    }
  } catch (e) {
    // Fallback to 16px if styles unavailable
  }

  const calculatedHeight = Math.ceil((lines.length + 1) * lineHeight) + 40

  ns.ui.resizeTail(size.w, calculatedHeight)
}

export async function main(ns) {
  ns.disableLog("ALL")
  killPriorInstances(ns)

  const args = parseArgs(ns)
  const pos = {
    x: args.x ?? DEFAULT_X,
    y: args.y ?? DEFAULT_Y,
  }
  const size = {
    w: args.w ?? DEFAULT_W,
    h: args.h ?? DEFAULT_H,
  }

  const state = {
    expanded: null,
  }

  let placed = false

  // Start click detector background process
  try {
    ns.run("hud_click_monitor.js", 1)
  } catch (e) {
    // Click monitor not available yet
  }

  // Save position for click detector to use
  ns.write(POSITION_FILE, JSON.stringify(pos), "w")

  while (true) {
    try {
      // Read current expanded state (might be toggled by click detector)
      const savedState = json(ns, STATE_FILE)
      if (savedState?.expanded !== undefined) {
        state.expanded = savedState.expanded
      }

      const lines = buildDisplay(ns, state, pos)

      ns.clearLog()
      for (const line of lines) {
        ns.print(line)
      }

      if (!placed && ns.ui) {
        placeTail(ns, pos, size)
        placed = true
      }

      if (ns.ui) {
        resizeTail(ns, lines, size)
        ns.ui.renderTail()
      }
    } catch (err) {
      ns.print("ERROR: " + err.message)
    }

    await ns.sleep(POLL_MS)
  }
}
