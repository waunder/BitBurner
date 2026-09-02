/** Consolidated Interactive HUD
 *
 * Single unified dashboard for MCP, Darknet, Augmentation, and System status.
 * Click sections to expand/collapse for deeper details.
 * Very compact by default, resizable, bottom-right corner.
 *
 * Replaces: mcp_money.js, dnet_scorecard.js, ops_hud.js
 *
 * Usage:
 *   run hud_consolidated.js [x=<px>] [y=<px>] [w=<px>] [h=<px>]
 *
 * Click on section headers (MCP, Darknet, etc.) to expand/collapse.
 * Re-running supersedes the prior panel.
 */

const DEFAULT_X = 900
const DEFAULT_Y = 600
const DEFAULT_W = 320
const DEFAULT_H = 240
const POLL_MS = 5000
const FRESH_MS = 120000

const COLORS = {
  HEADER: "[1;37m",    // Bright white
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

function getStatus(value, thresholds = {}) {
  if (value === undefined || value === null) return "?"
  if (thresholds.critical && value <= thresholds.critical) return "🔴"
  if (thresholds.warning && value <= thresholds.warning) return "🟡"
  return "🟢"
}

function row(left, right = "", maxLen = 40) {
  const gap = maxLen - left.length - right.length
  if (gap > 0) return left + " ".repeat(gap) + right
  return left.slice(0, maxLen - right.length - 2) + " " + right
}

function mcpStatus(ns, now) {
  const status = json(ns, "mcp_status.json")
  if (!status) return { compact: "MCP     --", expanded: ["Status unavailable"] }

  const running = status.running
  const target = status.target?.hostname || "--"
  const money = status.totalHacked || 0
  const moneyRate = status.moneyPerMinute || 0
  const workers = status.workers?.length || 0
  const freshMs = now - (status.timestamp || 0)
  const fresh = freshMs < FRESH_MS ? "✓" : "⚠"

  return {
    compact: `MCP ${fresh}  ${compact(moneyRate, 1)}/m  target: ${target.slice(0, 12)}`,
    expanded: [
      `MCP Status: ${running ? "RUNNING" : "STOPPED"}`,
      `Target: ${target}`,
      `$/min: ${compact(moneyRate, 2)}`,
      `Total: ${compact(money)}`,
      `Workers: ${workers}`,
      `Freshness: ${freshMs < 10000 ? "now" : Math.floor(freshMs / 1000) + "s ago"}`,
    ],
    color: running ? COLORS.HEALTHY : COLORS.WARNING,
  }
}

function darknetStatus(ns, now) {
  // Check if canary test is running
  const canaryState = json(ns, "dnet_canary_phase1_completed.txt")
  const registryRaw = json(ns, "dnet_manager_registry.json")
  const managers = registryRaw ? Object.keys(registryRaw).filter(k => k.startsWith("host_")).length : 0

  let state = "PAUSED"
  let detail = "No active process"

  if (canaryState) {
    state = "CANARY (Phase 1)"
    detail = `${managers} manager(s) — ${canaryState.status}`
  } else if (managers > 0) {
    state = "ACTIVE"
    detail = `${managers} manager(s) running`
  }

  return {
    compact: `Darknet ${state === "PAUSED" ? "⏸" : "▶"}  ${detail}`,
    expanded: [
      `Darknet: ${state}`,
      detail,
      `Registry entries: ${registryRaw ? Object.keys(registryRaw).length : 0}`,
    ],
    color: state === "PAUSED" ? COLORS.DIMMED : (state === "CANARY (Phase 1)" ? COLORS.WARNING : COLORS.HEALTHY),
  }
}

function augmentationStatus(ns, now) {
  const mcp = json(ns, "mcp_status.json")
  if (!mcp) return { compact: "Augmentation --", expanded: ["Data unavailable"] }

  const charisma = mcp.player?.skills?.charisma || 0
  const xpRate = mcp.xpPerMinute?.xp || 0
  const nextAugMs = mcp.augmentation?.nextAugmentationMs || 0
  const nextAugMin = Math.max(0, Math.floor(nextAugMs / 60000))

  let detail = `+${compact(xpRate)}/m XP`
  if (nextAugMin > 0) {
    const hours = Math.floor(nextAugMin / 60)
    const mins = nextAugMin % 60
    detail += ` → next in ${hours}h ${mins}m`
  }

  return {
    compact: `Aug ${detail}`,
    expanded: [
      `Charisma: ${charisma}`,
      `XP/min: ${compact(xpRate, 1)}`,
      `Next augmentation: ${nextAugMin > 0 ? `${nextAugMin}m` : "unknown"}`,
    ],
    color: COLORS.HEALTHY,
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
    compact: `System  API ${apiOk ? "✓" : "⚠"}  MCP ${mcpOk ? "✓" : "⚠"}`,
    expanded: [
      `Remote API: ${apiOk ? "connected" : "stale"}`,
      `MCP Freshness: ${mcpFreshMs < 10000 ? "now" : Math.floor(mcpFreshMs / 1000) + "s ago"}`,
      `Status files: ${apiOk && mcpOk ? "healthy" : "degraded"}`,
    ],
    color: (apiOk && mcpOk) ? COLORS.HEALTHY : COLORS.WARNING,
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
  lines.push(COLORS.HEADER + "╔════════════════════════════════╗" + COLORS.RESET)
  lines.push(COLORS.HEADER + "║  CONSOLIDATED HUD              ║" + COLORS.RESET)
  lines.push(COLORS.HEADER + "╚════════════════════════════════╝" + COLORS.RESET)
  lines.push("")

  for (const section of sections) {
    const isExpanded = state.expanded === section.key
    const indicator = isExpanded ? "▼" : "▶"
    const compactLine = section.data.color + indicator + " " + section.data.compact + COLORS.RESET

    lines.push(compactLine)

    if (isExpanded) {
      lines.push(COLORS.DIMMED + "─".repeat(40) + COLORS.RESET)
      for (const detail of section.data.expanded) {
        lines.push("  " + detail)
      }
      lines.push("")
    }
  }

  lines.push(COLORS.DIMMED + `Last update: ${new Date().toLocaleTimeString()}` + COLORS.RESET)

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

function placeTail(ns, lines, pos, size) {
  if (!ns.ui) return

  ns.ui.openTail()
  ns.ui.setTailTitle("HUD")
  ns.ui.resizeTail(size.w, size.h)
  ns.ui.moveTail(pos.x, pos.y)
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
    expanded: null,  // Which section is expanded: "mcp", "darknet", "aug", "system", or null
  }

  let placed = false

  while (true) {
    try {
      const lines = buildDisplay(ns, state, pos)

      ns.clearLog()
      for (const line of lines) {
        ns.print(line)
      }

      // Persist state
      ns.write("hud_consolidated_state.json", JSON.stringify({ expanded: state.expanded }, null, 2), "w")

      if (!placed && ns.ui) {
        placeTail(ns, lines, pos, size)
        placed = true
        ns.ui.renderTail()
      } else if (ns.ui) {
        ns.ui.renderTail()
      }
    } catch (err) {
      ns.print("ERROR: " + err.message)
    }

    await ns.sleep(POLL_MS)
  }
}
