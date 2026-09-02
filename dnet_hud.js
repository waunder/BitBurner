/**
 * Low-impact Darknet health panel.
 *
 * Unlike dnet_scorecard.js, this deliberately does not scan credential,
 * deployer, or loot shards. It reads only the root heartbeat and the small
 * active-manager registry that dnet_root.js already maintains, then refreshes
 * every 15 seconds. It writes no status file of its own.
 *
 * Start: run dnet_hud.js [x=<px> y=<px> w=<px> h=<px>]
 *
 * @param {NS} ns
 */
const POLL_MS = 15000
const STALE_MS = POLL_MS * 2
const ROOT_HEARTBEAT = "dnet_deployer_home.json"
const MANAGER_REGISTRY = "dnet_manager_registry.json"
const WIDTH_CHARS = 34
const DEFAULT_Y = 700
const RIGHT_MARGIN = 8
const WHITE = "\u001b[37m"
const RESET = "\u001b[0m"

function parseArgs(ns) {
  const out = {}
  for (const raw of ns.args) {
    const [key, value] = String(raw).split("=", 2)
    if (!["x", "y", "w", "h"].includes(key)) continue
    const number = Number(value)
    if (Number.isFinite(number)) out[key] = number
  }
  return out
}

function row(left, right = "") {
  const gap = WIDTH_CHARS - left.length - right.length
  return gap > 0 ? left + " ".repeat(gap) + right : `${left} ${right}`
}

function readJson(ns, file, fallback) {
  try {
    const raw = ns.read(file)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function age(seconds) {
  if (!Number.isFinite(seconds)) return "--"
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m${seconds % 60}s`
}

function activeManagers(registry, now) {
  if (!registry || typeof registry !== "object") return { active: 0, newestAge: null }
  const timestamps = Object.values(registry).filter((ts) => Number.isFinite(ts))
  if (!timestamps.length) return { active: 0, newestAge: null }
  return {
    active: timestamps.length,
    newestAge: Math.max(0, Math.floor((now - Math.max(...timestamps)) / 1000)),
  }
}

function buildLines(ns) {
  const now = Date.now()
  const root = readJson(ns, ROOT_HEARTBEAT, null)
  const managers = activeManagers(readJson(ns, MANAGER_REGISTRY, {}), now)
  const rootAge = Number.isFinite(root?.ts) ? Math.max(0, Math.floor((now - root.ts) / 1000)) : null
  const live = rootAge !== null && rootAge * 1000 <= STALE_MS
  const pass = root?.thisPass ?? {}
  const lifetime = root?.sinceProcessStart ?? {}
  const instability = root?.instability
  const failure = root?.lastFailure
  const failureText = failure ? `${failure.stage ?? "?"}:${failure.target ?? "?"}` : "none"

  return [
    row("DARKNET", live ? "LIVE" : "STALE"),
    row("root heartbeat", age(rootAge)),
    row("managers active", managers.active ? `${managers.active} (${age(managers.newestAge)})` : "0"),
    row("credentials known", String(root?.localKnownCreds ?? "--")),
    row("last pass sessions", String(pass.sessions ?? "--")),
    row("last pass delegated", String(pass.delegated ?? "--")),
    row("last pass prepared/fail", `${pass.prepared ?? "--"} / ${pass.failed ?? "--"}`),
    row("lifetime delegated", String(lifetime.delegated ?? "--")),
    row("lifetime failures", String(lifetime.failed ?? "--")),
    row("instability", instability ? `${Number(instability.authenticationDurationMultiplier).toFixed(2)}x / ${(100 * Number(instability.authenticationTimeoutChance)).toFixed(1)}%` : "--"),
    row("last failure", failureText.slice(0, WIDTH_CHARS - 13)),
  ]
}

function closePrior(ns) {
  for (const proc of ns.ps(ns.getHostname())) {
    const name = proc.filename.startsWith("/") ? proc.filename.slice(1) : proc.filename
    if (name !== "dnet_hud.js" || proc.pid === ns.pid) continue
    if (ns.ui?.closeTail) ns.ui.closeTail(proc.pid)
    ns.kill(proc.pid)
  }
}

function placeTail(ns, args, lines) {
  if (!ns.ui) return
  ns.ui.openTail()
  ns.ui.setTailTitle("dnet")
  const styles = typeof ns.ui.getStyles === "function" ? ns.ui.getStyles() : null
  const charWidth = styles ? styles.tailFontSize * 0.6 : 8
  const lineHeight = styles ? styles.tailFontSize * styles.lineHeight : 16
  const width = args.w || Math.ceil(WIDTH_CHARS * charWidth) + 34
  const screenWidth = typeof ns.ui.windowSize === "function" ? ns.ui.windowSize()[0] : 1280
  const x = args.x === undefined ? Math.max(0, screenWidth - width - RIGHT_MARGIN) : args.x
  ns.ui.resizeTail(width, args.h || Math.ceil((lines.length + 1) * lineHeight) + 40)
  ns.ui.moveTail(Math.round(x), Math.round(args.y === undefined ? DEFAULT_Y : args.y))
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
