/**
 * Consolidated, low-impact operations HUD.
 *
 * It combines already-produced status records; it never scans the network,
 * parses Darknet shards, controls scripts, or writes telemetry.  This is the
 * compact daily view; the specialist HUDs remain available for investigation.
 *
 * Start: run ops_hud.js [x=<px> y=<px> w=<px> h=<px>]
 *
 * @param {NS} ns
 */
const POLL_MS = 30000
const GATE_REFRESH_MS = 600000
const MCP_STALE_MS = 300000
const DNET_STALE_MS = 30000
const MANAGER_FRESH_MS = 120000
const WIDTH_CHARS = 42
const OVERVIEW_DROP = 190
const RIGHT_MARGIN = 8
const WHITE = "\u001b[37m"
const RESET = "\u001b[0m"
let gateCache = { ts: 0, gates: [] }

function parseArgs(ns) {
  const out = {}
  for (const raw of ns.args) {
    const [key, value] = String(raw).split("=", 2)
    const number = Number(value)
    if (["x", "y", "w", "h"].includes(key) && Number.isFinite(number)) out[key] = number
  }
  return out
}

function readJson(ns, file, fallback = null) {
  try {
    const raw = ns.read(file)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
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
  const sign = n < 0 ? "-" : ""
  const abs = Math.abs(n)
  for (const [scale, suffix] of [[1e12, "t"], [1e9, "b"], [1e6, "m"], [1e3, "k"]]) {
    if (abs >= scale) return sign + (abs / scale).toFixed(abs / scale >= 100 ? 0 : 1) + suffix
  }
  return sign + abs.toFixed(0)
}

function age(now, ts) {
  if (!Number.isFinite(ts)) return "missing"
  const seconds = Math.max(0, Math.floor((now - ts) / 1000))
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m${seconds % 60}s`
}

function parseReward(reward) {
  const text = String(reward || "")
  const cash = text.match(/\$([\d,.]+)\s*([kmbt]?)/i)
  const factor = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[(cash?.[2] || "").toLowerCase()] || 1
  const parsedCash = cash ? Number(cash[1].replaceAll(",", "")) * factor : 0
  const reps = [...text.matchAll(/([\d,.]+)\s*(?:faction\s+)?reputation\s*(?:with|for)\s*([^,.;]+)/gi)]
  return { cash: Number.isFinite(parsedCash) ? parsedCash : 0, reps: reps.map((match) => ({ name: match[2].trim(), amount: Number(match[1].replaceAll(",", "")) || 0 })) }
}

function contractTotals(ledger) {
  const opening = ledger?.openingBalance || {}
  const out = { accepted: Number(opening.accepted) || 0, cash: Number(opening.cash) || 0, reps: { ...(opening.factionRep || {}) } }
  for (const entry of ledger?.entries || []) {
    if (!entry.ok) continue
    out.accepted++
    const parsed = parseReward(entry.reward)
    out.cash += parsed.cash
    for (const rep of parsed.reps) out.reps[rep.name] = (out.reps[rep.name] || 0) + rep.amount
  }
  return out
}

function workerRam(mcp, cloudNames) {
  const cloud = new Set(cloudNames)
  let used = 0
  let max = 0
  for (const worker of mcp?.workers || []) {
    if (!cloud.has(worker.host)) continue
    used += Number(worker.usedRam) || 0
    max += Number(worker.maxRam) || 0
  }
  return { used, max }
}

// Read-only network walk: this is deliberately a *gate* finder, not target
// selection.  It tells the player what the next discovered hacking-level
// threshold is; MCP remains solely responsible for choosing a worker target.
function nextHackingGate(ns, hacking) {
  const now = Date.now()
  if (now - gateCache.ts < GATE_REFRESH_MS) {
    return gateCache.gates.find((gate) => gate.required > hacking) || null
  }
  try {
    const seen = new Set(["home"])
    const queue = ["home"]
    const gates = []
    for (let i = 0; i < queue.length; i++) {
      const host = queue[i]
      for (const next of ns.scan(host)) {
        if (!seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
      if (host === "home") continue
      const required = Number(ns.getServerRequiredHackingLevel(host))
      if (Number.isFinite(required) && required > hacking) gates.push({ host, required })
    }
    gates.sort((a, b) => a.required - b.required || a.host.localeCompare(b.host))
    gateCache = { ts: now, gates }
    return gates[0] || null
  } catch {
    gateCache = { ts: now, gates: [] }
    return null
  }
}

// This HUD cannot see an augmentation's individual reputation gap, so it
// never claims faction work is blocking unless another system supplies it.
function playerTimeAdvice(ns, mcp) {
  const skills = mcp?.player?.skills || {}
  const hacking = Number(skills.hacking) || 0
  const charisma = Number(skills.charisma) || 0
  const objective = mcp?.OBJECTIVE || mcp?.objective || "--"
  const scriptXp = Number(mcp?.expPerSec) || 0
  const gate = nextHackingGate(ns, hacking)
  const gateText = gate
    ? `need +${gate.required - hacking} H: ${gate.host} (H${gate.required})`
    : "no higher discovered H gate"
  if (objective === "xp") {
    return {
      stats: `YOU H${hacking} C${charisma}`,
      recommendation: gate ? `NEXT H${gate.required}` : "NEXT GATE --",
      gate: gateText,
      best: "Best: Rothman Algorithms",
      detail: `MCP +${compact(scriptXp)} XP/s independent`,
    }
  }
  return {
    stats: `YOU H${hacking} C${charisma}`,
    recommendation: gate ? `NEXT H${gate.required}` : "NEXT GATE --",
    gate: gateText,
    best: gate ? "Best: Rothman Algorithms" : "Best: pursue current objective",
    detail: `MCP +${compact(scriptXp)} XP/s`,
  }
}

function buildLines(ns) {
  const now = Date.now()
  const mcp = readJson(ns, "mcp_status.json")
  const root = readJson(ns, "dnet_deployer_home.json")
  const registry = readJson(ns, "dnet_manager_registry.json", {})
  const review = readJson(ns, "automation_review.json", {})
  const ledger = readJson(ns, "cct_reward_ledger.json", { openingBalance: {}, entries: [] })
  const latestSubmit = readJson(ns, "cct_submit_status.json")
  const inventory = readJson(ns, "cct_inventory.json")
  const cctWatch = readJson(ns, "cct_watch_status.json")
  const cctQueue = readJson(ns, "cct_queue_status.json", {})
  const cloudNames = ns.cloud.getServerNames()
  const cloudRam = workerRam(mcp, cloudNames)
  const mcpAge = Number.isFinite(mcp?.ts) ? now - mcp.ts : Infinity
  const dnetAge = Number.isFinite(root?.ts) ? now - root.ts : Infinity
  const managers = Object.values(registry).filter((ts) => Number.isFinite(ts) && now - ts < MANAGER_FRESH_MS).length
  const totals = contractTotals(ledger)
  const recent = (ledger.entries || []).at(-1) || latestSubmit
  const reps = Object.entries(totals.reps).sort((a, b) => b[1] - a[1]).slice(0, 2)
  const alerts = Array.isArray(review?.alerts) ? review.alerts : []
  const mcpState = !mcp ? "MISSING" : mcpAge > MCP_STALE_MS ? "STALE" : "LIVE"
  const dnetState = !root ? "MISSING" : dnetAge > DNET_STALE_MS ? "STALE" : "LIVE"
  const health = alerts.length ? "ATTENTION" : mcpState !== "LIVE" || dnetState === "STALE" ? "CHECK" : "OK"
  const threadCount = (mcp?.workers || []).reduce((total, worker) => total + (worker.actions || []).reduce((sum, action) => sum + (Number(action.threads) || 0), 0), 0)
  const cloudPct = cloudRam.max ? `${Math.round(100 * cloudRam.used / cloudRam.max)}%` : "--"
  const recentText = !recent ? "no recorded submission" : recent.ok ? `accepted ${recent.type || "contract"}` : `paused ${recent.reason || "guard"}`
  const playerTime = playerTimeAdvice(ns, mcp)

  return [
    row("OPERATIONS", health),
    row(`MCP ${mcpState}`, `${mcp?.target || "--"} / ${mcp?.OBJECTIVE || mcp?.objective || "--"}`),
    row(`rate ${compact(mcp?.rate)}/s`, `avg ${compact(mcp?.avgRate)}/s`),
    row(`workers ${threadCount} threads`, `${(mcp?.workers || []).length} hosts / ${age(now, mcp?.ts)}`),
    row(playerTime.stats, playerTime.recommendation),
    row("gate", playerTime.gate),
    row("best now", playerTime.best),
    row("script XP", playerTime.detail),
    row(`contracts ${totals.accepted} accepted`, `$${compact(totals.cash)}`),
    row(`discovery ${inventory?.contracts?.length ?? "--"} available`, `${cctWatch?.ok === false ? "SCAN ERROR" : age(now, inventory?.ts)}`),
    row("CCT queue", `${cctQueue.action || "waiting"}: ${String(cctQueue.reason || "next scan").slice(0, 24)}`),
    ...reps.map(([name, rep]) => row(name.slice(0, 27), `+${compact(rep)} rep`)),
    row("latest CCT", recentText.slice(0, WIDTH_CHARS - 11)),
    row(`DNET ${dnetState}`, `${managers} managers / ${age(now, root?.ts)}`),
    row(`cloud ${cloudNames.length} servers`, `${compact(cloudRam.used)}/${compact(cloudRam.max)} GB ${cloudPct}`),
    row("automation", alerts.length ? alerts[0].message.slice(0, WIDTH_CHARS - 11) : "no active alerts"),
  ]
}

function closePrior(ns) {
  for (const proc of ns.ps(ns.getHostname())) {
    if (proc.pid === ns.pid || proc.filename.replace(/^\//, "") !== "ops_hud.js") continue
    ns.ui?.closeTail(proc.pid)
    ns.kill(proc.pid)
  }
}

function placeTail(ns, args, lines) {
  if (!ns.ui) return
  ns.ui.openTail()
  ns.ui.setTailTitle("operations")
  const styles = ns.ui.getStyles?.()
  const charWidth = styles ? styles.tailFontSize * 0.6 : 8
  const lineHeight = styles ? styles.tailFontSize * styles.lineHeight : 16
  const width = args.w || Math.ceil(WIDTH_CHARS * charWidth) + 34
  const screenWidth = ns.ui.windowSize?.()[0] || 1280
  ns.ui.resizeTail(width, args.h || Math.ceil((lines.length + 1) * lineHeight) + 40)
  ns.ui.moveTail(Math.round(args.x === undefined ? Math.max(0, screenWidth - width - RIGHT_MARGIN) : args.x), Math.round(args.y === undefined ? OVERVIEW_DROP : args.y))
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
    if (!placed) { placeTail(ns, args, lines); placed = true }
    ns.ui?.renderTail()
    await ns.sleep(POLL_MS)
  }
}
