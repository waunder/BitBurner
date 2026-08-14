/**
 * Compact live Dark Net scorecard, visually and operationally parallel to
 * mcp_money.js. It reads the durable home-side shards directly so the panel
 * does not depend on somebody manually running the three merge scripts.
 *
 * Args: x=<px> y=<px> w=<px> h=<px>. Re-running supersedes the prior panel.
 * Reads: dnet_deployer_*.json, dnet_loot_*.json, dnet_creds.txt,
 *        mcp_status.json, and ns.getMoneySources().sinceInstall.darknet.
 * Writes: nothing.
 *
 * @param {NS} ns
 */
const POLL_MS = 2000
const FRESH_MS = 120000
const WHITE = "\u001b[37m"
const RESET = "\u001b[0m"
const DEFAULT_Y = 700
const RIGHT_MARGIN = 8
const WIDTH_CHARS = 34
const STATUS_FILE = "dnet_scorecard_status.json"

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

function compact(value, digits = 1) {
  const n = Number(value) || 0
  const sign = n < 0 ? "-" : ""
  const abs = Math.abs(n)
  for (const [scale, suffix] of [[1e12, "t"], [1e9, "b"], [1e6, "m"], [1e3, "k"]]) {
    if (abs >= scale) return sign + (abs / scale).toFixed(digits) + suffix
  }
  return sign + (Number.isInteger(abs) ? String(abs) : abs.toFixed(digits))
}

function row(left, right = "") {
  const gap = WIDTH_CHARS - left.length - right.length
  return gap > 0 ? left + " ".repeat(gap) + right : left + " " + right
}

function json(ns, file) {
  try {
    return JSON.parse(ns.read(file))
  } catch {
    return null
  }
}

function credentials(ns) {
  const newest = new Map()
  const models = new Set()
  const files = ["dnet_creds.txt", ...ns.ls("home", "dnet_cred_").filter((file) => file.endsWith(".txt"))]
  for (const file of files) {
    for (const line of ns.read(file).split("\n")) {
      if (!line.trim()) continue
      try {
        const rec = JSON.parse(line)
        if (!rec || typeof rec.host !== "string") continue
        const prior = newest.get(rec.host)
        if (!prior || (rec.at ?? 0) >= (prior.at ?? 0)) newest.set(rec.host, rec)
      } catch {}
    }
  }
  for (const rec of newest.values()) if (rec.model) models.add(rec.model)
  return { hosts: newest.size, models: models.size }
}

function deployers(ns, now) {
  const records = []
  for (const file of ns.ls("home", "dnet_deployer_")) {
    if (!file.endsWith(".json")) continue
    const rec = json(ns, file)
    if (rec && Number.isFinite(rec.ts)) records.push(rec)
  }
  const newest = records.reduce((best, rec) => (!best || rec.ts > best.ts ? rec : best), null)
  const fresh = records.filter((rec) => now - rec.ts <= FRESH_MS)
  const sums = { sessions: 0, failed: 0, prepare: 0, phishThreads: 0, farmCapacity: 0, loot: 0, ramSkips: 0 }
  for (const rec of fresh) {
    const pass = rec.thisPass ?? {}
    sums.sessions += pass.sessions ?? 0
    sums.failed += pass.failed ?? 0
    sums.prepare += pass.prepareStarted ?? 0
    sums.phishThreads += pass.phishThreadsStarted ?? 0
    sums.farmCapacity += rec.farmCapacityThreads ?? 0
    sums.loot += pass.looted ?? 0
    sums.ramSkips += (pass.lootSkipped?.ram ?? 0) + (pass.prepareSkipped?.ram ?? 0) + (pass.phishSkipped?.ram ?? 0)
  }
  return { total: records.length, fresh: fresh.length, newest, sums }
}

function loot(ns) {
  const seen = new Set()
  const totals = { events: 0, ram: 0, found: 0, opened: 0, karma: 0 }
  for (const file of ns.ls("home", "dnet_loot_")) {
    if (!file.endsWith(".json") || seen.has(file)) continue
    seen.add(file)
    const rec = json(ns, file)
    if (!rec || typeof rec.host !== "string") continue
    totals.events++
    totals.ram += Math.max(0, (rec.ram?.before ?? 0) - (rec.ram?.after ?? 0))
    totals.found += rec.caches?.found ?? 0
    totals.opened += rec.caches?.opened ?? 0
    totals.karma += rec.caches?.karma ?? 0
  }
  return totals
}

function buildLines(ns, state, pos) {
  const now = Date.now()
  const d = deployers(ns, now)
  const c = credentials(ns)
  const l = loot(ns)
  const mcp = json(ns, "mcp_status.json")
  const charisma = Number(mcp?.player?.skills?.charisma) || 0
  if (state.baseCharisma === null && charisma) state.baseCharisma = charisma
  const elapsedMin = Math.max((now - state.startedAt) / 60000, 1 / 60)
  const charismaGain = charisma - (state.baseCharisma ?? charisma)
  const chaRate = charismaGain / elapsedMin
  const moneySources = ns.getMoneySources()?.sinceInstall ?? {}
  const dnetMoney = moneySources.darknet ?? 0
  const newestAge = d.newest ? Math.max(0, Math.floor((now - d.newest.ts) / 1000)) : null
  const instability = d.newest?.instability
  const healthy = newestAge !== null && newestAge <= FRESH_MS / 1000

  return [
    row("DARK NET", healthy ? "LIVE" : "STALE"),
    row("charisma", `${charisma}  +${compact(charismaGain, 0)}`),
    row("charisma / min", compact(chaRate, 1)),
    row("darknet $ / install", compact(dnetMoney, 2)),
    row("crawlers fresh / known", `${d.fresh} / ${d.total}`),
    row("sessions / failures", `${d.sums.sessions} / ${d.sums.failed}`),
    row("phish thread capacity", compact(d.sums.farmCapacity || d.sums.phishThreads, 0)),
    row("prep / loot this pass", `${d.sums.prepare} / ${d.sums.loot}`),
    row("RAM decision skips", compact(d.sums.ramSkips, 0)),
    row("credentials / models", `${c.hosts} / ${c.models}`),
    row("RAM reclaimed", `${compact(l.ram, 1)} GB`),
    row("caches opened / found", `${l.opened} / ${l.found}`),
    row("cache karma", compact(l.karma, 0)),
    row("instability", instability ? `${instability.authenticationDurationMultiplier.toFixed(2)}x / ${(100 * instability.authenticationTimeoutChance).toFixed(1)}%` : "--"),
    row("newest heartbeat", newestAge === null ? "--" : `${newestAge}s ago`),
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
  return { x: Math.round(x), y: Math.round(args.y === undefined ? DEFAULT_Y : args.y) }
}

function placeTail(ns, args, lines, pos) {
  if (!ns.ui) return
  ns.ui.openTail()
  ns.ui.setTailTitle("dnet_scorecard")
  const styles = typeof ns.ui.getStyles === "function" ? ns.ui.getStyles() : null
  const charWidth = styles ? styles.tailFontSize * 0.6 : 8
  const lineHeight = styles ? styles.tailFontSize * styles.lineHeight : 16
  ns.ui.resizeTail(args.w || Math.ceil(WIDTH_CHARS * charWidth) + 34, args.h || Math.ceil((lines.length + 1) * lineHeight) + 40)
  ns.ui.moveTail(pos.x, pos.y)
}

function killPriorInstances(ns) {
  for (const proc of ns.ps(ns.getHostname())) {
    const name = proc.filename.startsWith("/") ? proc.filename.slice(1) : proc.filename
    if (name === "dnet_scorecard.js" && proc.pid !== ns.pid) {
      ns.ui.closeTail(proc.pid)
      ns.kill(proc.pid)
    }
  }
}

export async function main(ns) {
  ns.disableLog("ALL")
  killPriorInstances(ns)
  const args = parseArgs(ns)
  const pos = resolvePosition(ns, args)
  const state = { startedAt: Date.now(), baseCharisma: null }
  let placed = false
  while (true) {
    let lines
    try {
      lines = buildLines(ns, state, pos)
    } catch (err) {
      lines = [row("DARK NET", "ERROR"), String(err).slice(0, WIDTH_CHARS), row("x=" + pos.x, "y=" + pos.y)]
    }
    ns.clearLog()
    for (const line of lines) ns.print(WHITE + line + RESET)
    ns.write(STATUS_FILE, JSON.stringify({ ts: Date.now(), ok: lines[0]?.includes("ERROR") !== true, lines }, null, 2), "w")
    if (!placed) {
      placeTail(ns, args, lines, pos)
      placed = true
    }
    ns.ui.renderTail()
    await ns.sleep(POLL_MS)
  }
}
