/**
 * Compact XP/progression panel.  It deliberately consumes MCP's already
 * durable status record, so a twenty-second refresh creates no additional
 * player polling, telemetry writes, or network scan.  The only exceptional
 * read is a cached gate walk (at most once every ten minutes), kept here
 * because it answers the player-facing question that MCP target selection
 * intentionally does not: what hacking level unlocks the next server?
 *
 * Start: run mcp_xp.js [x=<px> y=<px> w=<px> h=<px>]
 *
 * @param {NS} ns
 */
import { chooseProgressionGuidance } from "./progression_guidance_logic.js"

const POLL_MS = 20_000
const GATE_REFRESH_MS = 600_000
const DNET_LIVE_MS = 30_000
const WIDTH_CHARS = 34
const DEFAULT_Y = 570
const RIGHT_MARGIN = 8
const WHITE = "\u001b[37m"
const RESET = "\u001b[0m"

let gateCache = { refreshedAt: 0, gates: [], ok: false }

function parseArgs(ns) {
  const out = {}
  for (const raw of ns.args) {
    const [key, value] = String(raw).split("=", 2)
    const number = Number(value)
    if (["x", "y", "w", "h"].includes(key) && Number.isFinite(number)) out[key] = number
  }
  return out
}

function readJson(ns, file) {
  try {
    const text = ns.read(file)
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

function row(left, right = "") {
  left = String(left)
  right = String(right)
  const gap = WIDTH_CHARS - left.length - right.length
  return gap > 0 ? left + " ".repeat(gap) + right : `${left} ${right}`
}

function compact(value) {
  const n = Number(value) || 0
  for (const [scale, suffix] of [[1e9, "b"], [1e6, "m"], [1e3, "k"]]) {
    if (Math.abs(n) >= scale) return (n / scale).toFixed(Math.abs(n) / scale >= 100 ? 0 : 1) + suffix
  }
  return n.toFixed(n >= 100 ? 0 : 1)
}

function statusAge(now, ts) {
  if (!Number.isFinite(ts)) return "missing"
  const seconds = Math.max(0, Math.floor((now - ts) / 1000))
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`
}

// This is intentionally not target selection. MCP has better target data and
// owns allocation; the panel merely gives the player the nearest discovered
// hacking-level gate. It is cached for ten minutes, never once per render.
function nextGate(ns, hacking) {
  const now = Date.now()
  if (now - gateCache.refreshedAt >= GATE_REFRESH_MS) {
    try {
      const seen = new Set(["home"])
      const queue = ["home"]
      const gates = []
      for (let i = 0; i < queue.length; i++) {
        const host = queue[i]
        for (const neighbor of ns.scan(host)) {
          if (!seen.has(neighbor)) {
            seen.add(neighbor)
            queue.push(neighbor)
          }
        }
        if (host !== "home") {
          const required = Number(ns.getServerRequiredHackingLevel(host))
          if (Number.isFinite(required)) gates.push({ host, required })
        }
      }
      gates.sort((a, b) => a.required - b.required || a.host.localeCompare(b.host))
      gateCache = { refreshedAt: now, gates, ok: true }
    } catch {
      // Keep the last known gate rather than replacing useful guidance with a
      // transient API failure. The age row makes the staleness visible.
      if (!gateCache.refreshedAt) gateCache = { refreshedAt: now, gates: [], ok: false }
    }
  }
  return { gate: gateCache.gates.find((gate) => gate.required > hacking) || null, ok: gateCache.ok }
}

function buildLines(ns) {
  const now = Date.now()
  const mcp = readJson(ns, "mcp_status.json")
  if (!mcp) return [row("XP / PROGRESSION", "NO DATA"), row("MCP status", "missing")]

  const skills = mcp.player?.skills || {}
  const hacking = Number(skills.hacking) || 0
  const charisma = Number(skills.charisma) || 0
  const gateState = nextGate(ns, hacking)
  const root = readJson(ns, "dnet_deployer_home.json")
  const darknetLive = Number.isFinite(root?.ts) && now - root.ts <= DNET_LIVE_MS
  const stale = !Number.isFinite(mcp.ts) || now - mcp.ts > 90_000
  const objective = String(mcp.OBJECTIVE || mcp.objective || "--").toUpperCase()
  const target = String(mcp.target || "--")
  const guidance = chooseProgressionGuidance({
    hacking,
    charisma,
    gate: gateState.gate,
    gateScanOk: gateState.ok,
    darknetLive,
  })

  return [
    row("XP / PROGRESSION", stale ? "STALE" : "LIVE"),
    row(`YOU H${hacking}`, `C${charisma}`),
    row("MCP XP", `${compact(mcp.expPerSec)} / sec`),
    row("mode / target", `${objective} ${target}`.slice(0, 20)),
    row("NEXT", guidance.next),
    row("gate", guidance.gate),
    row("BEST NOW", guidance.best),
    row("basis", `${guidance.confidence}: ${guidance.basis}`.slice(0, 22)),
    row("status age", statusAge(now, mcp.ts)),
  ]
}

function closePrior(ns) {
  for (const proc of ns.ps(ns.getHostname())) {
    if (proc.pid === ns.pid || proc.filename.replace(/^\//, "") !== "mcp_xp.js") continue
    ns.ui?.closeTail(proc.pid)
    ns.kill(proc.pid)
  }
}

function placeTail(ns, args, lines) {
  if (!ns.ui) return
  ns.ui.openTail()
  ns.ui.setTailTitle("mcp_xp")
  const styles = ns.ui.getStyles?.()
  const charWidth = styles ? styles.tailFontSize * 0.6 : 8
  const lineHeight = styles ? styles.tailFontSize * styles.lineHeight : 16
  const width = args.w || Math.ceil(WIDTH_CHARS * charWidth) + 34
  const screenWidth = ns.ui.windowSize?.()[0] || 1280
  ns.ui.resizeTail(width, args.h || Math.ceil((lines.length + 1) * lineHeight) + 40)
  ns.ui.moveTail(Math.round(args.x === undefined ? Math.max(0, screenWidth - width - RIGHT_MARGIN) : args.x), Math.round(args.y === undefined ? DEFAULT_Y : args.y))
}

export async function main(ns) {
  ns.disableLog("ALL")
  closePrior(ns)
  const args = parseArgs(ns)
  let placed = false
  while (true) {
    const lines = buildLines(ns)
    ns.clearLog()
    for (const line of lines) ns.print(WHITE + line + RESET)
    if (!placed) {
      placeTail(ns, args, lines)
      placed = true
    }
    ns.ui?.renderTail()
    await ns.sleep(POLL_MS)
  }
}
