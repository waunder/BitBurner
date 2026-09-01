/**
 * Quiet Coding Contract reward panel. It only reads the bounded durable
 * reward ledger and latest submit status; it never scans, submits, or writes.
 *
 * Start: run cct_hud.js [x=<px> y=<px> w=<px> h=<px>]
 *
 * @param {NS} ns
 */
const LEDGER = "cct_reward_ledger.json"
const STATUS = "cct_submit_status.json"
const POLL_MS = 30000
const WIDTH_CHARS = 38
const DEFAULT_Y = 700
const RIGHT_MARGIN = 8
const WHITE = "\u001b[37m"
const RESET = "\u001b[0m"
const OPENING_BALANCE = {
  accepted: 12,
  cash: 25000000,
  factionRep: { "The Black Hand": 3262, NiteSec: 3262, "Sector-12": 3540.778, CyberSec: 4095.333 },
  note: "Verified aggregate before durable per-submission ledger; CSEC outcome unconfirmed.",
}

function parseArgs(ns) {
  const out = {}
  for (const raw of ns.args) {
    const [key, value] = String(raw).split("=", 2)
    const number = Number(value)
    if (["x", "y", "w", "h"].includes(key) && Number.isFinite(number)) out[key] = number
  }
  return out
}

function readJson(ns, file, fallback) {
  try { return JSON.parse(ns.read(file)) || fallback } catch { return fallback }
}

function ensureLedger(ns) {
  const current = readJson(ns, LEDGER, null)
  if (current && Array.isArray(current.entries)) return current
  // A single bootstrap write makes the already-confirmed historical reward
  // durable. Normal HUD refreshes are read-only.
  const ledger = { version: 1, openingBalance: OPENING_BALANCE, entries: [], updatedAt: Date.now() }
  ns.write(LEDGER, JSON.stringify(ledger, null, 2), "w")
  return ledger
}

function row(left, right = "") {
  const gap = WIDTH_CHARS - left.length - right.length
  return gap > 0 ? left + " ".repeat(gap) + right : `${left} ${right}`
}

function money(value) {
  const amount = Number(value) || 0
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(2)}b`
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(2)}m`
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(1)}k`
  return `$${amount.toFixed(0)}`
}

function parseReward(reward) {
  const text = String(reward || "")
  const cash = text.match(/\$([\d,.]+)\s*([kmbt]?)/i)
  const factor = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[(cash?.[2] || "").toLowerCase()] || 1
  const parsedCash = cash ? Number(cash[1].replaceAll(",", "")) * factor : 0
  const reps = [...text.matchAll(/([\d,.]+)\s*(?:faction\s+)?reputation\s*(?:with|for)\s*([^,.;]+)/gi)]
  return { cash: Number.isFinite(parsedCash) ? parsedCash : 0, reps: reps.map((match) => ({ name: match[2].trim(), amount: Number(match[1].replaceAll(",", "")) || 0 })) }
}

function totals(ledger) {
  const totals = { accepted: Number(ledger?.openingBalance?.accepted) || 0, cash: Number(ledger?.openingBalance?.cash) || 0, reps: { ...(ledger?.openingBalance?.factionRep || {}) } }
  for (const entry of ledger?.entries || []) {
    if (!entry.ok) continue
    totals.accepted++
    const parsed = parseReward(entry.reward)
    totals.cash += parsed.cash
    for (const rep of parsed.reps) totals.reps[rep.name] = (totals.reps[rep.name] || 0) + rep.amount
  }
  return totals
}

function latest(ledger, status) {
  const entry = (ledger?.entries || []).at(-1)
  return entry || status || null
}

function buildLines(ns) {
  const ledger = ensureLedger(ns)
  const status = readJson(ns, STATUS, null)
  const total = totals(ledger)
  const recent = latest(ledger, status)
  const repLines = Object.entries(total.reps).sort((a, b) => b[1] - a[1]).slice(0, 4)
  const outcome = !recent ? "opening balance" : recent.ok ? `accepted: ${recent.type || "contract"}` : `paused: ${recent.reason || "guarded"}`
  return [
    row("CONTRACTS", recent?.ok === false ? "PAUSED" : "READY"),
    row("accepted", String(total.accepted)),
    row("cash rewards", money(total.cash)),
    ...repLines.map(([name, rep]) => row(name.slice(0, 23), `+${Number(rep).toFixed(0)} rep`)),
    row("latest", outcome.slice(0, WIDTH_CHARS - 7)),
    row("guard", recent?.ok === false ? "review / retry" : "audit + tries"),
  ]
}

function closePrior(ns) {
  for (const proc of ns.ps(ns.getHostname())) {
    const name = proc.filename.startsWith("/") ? proc.filename.slice(1) : proc.filename
    if (name !== "cct_hud.js" || proc.pid === ns.pid) continue
    ns.ui?.closeTail(proc.pid)
    ns.kill(proc.pid)
  }
}

function placeTail(ns, args, lines) {
  if (!ns.ui) return
  ns.ui.openTail()
  ns.ui.setTailTitle("contracts")
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
    if (!placed) { placeTail(ns, args, lines); placed = true }
    ns.ui?.renderTail()
    await ns.sleep(POLL_MS)
  }
}
