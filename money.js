import { capturePriorTailPosition, loadTailPosition, saveTailPosition } from "./tail_geometry.js"
import { addSample, augOutlook, duration, money, nextStackTotal, ramYield, streams, windowRate, WINDOWS_MS } from "./money_logic.js"
/**
 * Money panel: how fast cash is growing, which stream earns it, where it goes,
 * and whether cash or rep limits the next augmentations.
 *
 * Income comes from ns.getMoneySources; the stacked target is split out of
 * hacking with stack_status.json. Rates need a panel running through their
 * window, so they show -- at first. Writes money_status.json each poll.
 *
 * Start: run money.js [x=<px>] [y=<px>] [w=<px>] [h=<px>]
 * @param {NS} ns
 */
const ME = "money.js"
const STATUS = "money_status.json"
const POLL_MS = 5000
const STALE_MS = 120000
const WIDTH_CHARS = 42
const DEFAULT_Y = 430
const RIGHT_MARGIN = 8
// Fixed UTC-7: the game browser's older time zone data still drops Vancouver an hour.
const PACIFIC_OFFSET_MS = 7 * 3600000
const WHITE = "\u001b[1;37m", GREEN = "\u001b[1;32m", YELLOW = "\u001b[1;33m", RESET = "\u001b[0m"

function json(ns, file) {
  try { return JSON.parse(ns.read(file) || "null") } catch { return null /* partial write */ }
}

function parseArgs(ns) {
  const out = {}
  for (const raw of ns.args) {
    const [key, value] = String(raw).split("=")
    if (Number.isFinite(Number(value))) out[key] = Number(value)
  }
  return out
}

const fit = (left, right) => left + " ".repeat(Math.max(1, WIDTH_CHARS - left.length - right.length)) + right
const cell = (value) => (value === null ? "--" : money(value)).padStart(8)
const columns = (label, one, ten, total) => label.slice(0, 18).padEnd(18) + one.padStart(8) + ten.padStart(8) + total.padStart(8)
const rateRow = (row) => columns(row.label, cell(row.rates[0]), cell(row.rates[1]), money(row.total))

/** One reading of everything the panel derives from. */
function read(ns, previous, now) {
  const sources = ns.getMoneySources().sinceInstall
  const stack = json(ns, "stack_status.json")
  const stackTotal = nextStackTotal(previous, Number(stack?.stolen) || 0, sources.hacking || 0)
  return { t: now, sources, stack: stackTotal.total, stackRaw: stackTotal, stackTarget: stack?.target, stackLive: now - (stack?.ts || 0) < STALE_MS, stackRam: stack?.inFlightRam || 0 }
}

function summarize(ns, samples, now) {
  const last = samples.at(-1)
  const net = WINDOWS_MS.map((ms) => windowRate(samples, ms, (s) => s.sources.total || 0))
  const mcp = json(ns, "mcp_status.json")
  const mcpRam = now - (mcp?.ts || 0) < STALE_MS ? (mcp.targets || []).reduce((sum, t) => sum + (t.ram || 0), 0) : 0
  const flows = streams(samples)
  const steady = (row) => row?.rates[1] ?? row?.rates[0] ?? null
  const activity = json(ns, "player_activity_status.json")
  const cash = ns.getServerMoneyAvailable("home")
  return {
    ts: now, cash, net, ...flows,
    augs: augOutlook(cash, activity?.augmentation?.workCandidates, net[1] ?? net[0] ?? 0),
    yields: {
      stack: last.stackLive ? ramYield(steady(flows.income.find((r) => r.key === "stack")), last.stackRam) : null,
      rest: ramYield(steady(flows.income.find((r) => r.key === "rest")), mcpRam),
    },
    stackTarget: last.stackTarget,
  }
}

function buildLines(view, pos) {
  const lines = [
    [WHITE, fit("MONEY", new Date(view.ts - PACIFIC_OFFSET_MS).toISOString().slice(11, 19))],
    [GREEN, columns("cash", "", "", money(view.cash))],
    [WHITE, columns("$/s", "1m", "10m", "total")],
    [GREEN, columns("net", cell(view.net[0]), cell(view.net[1]), "")],
    ...view.income.map((row) => [GREEN, rateRow(row)]),
  ]
  if (view.spending.length) lines.push([WHITE, "spent"], ...view.spending.map((row) => [YELLOW, rateRow(row)]))
  const { augs, yields } = view
  lines.push([WHITE, "per TB of RAM"])
  if (yields.stack !== null) lines.push([GREEN, fit(view.stackTarget || "stack", `${money(yields.stack)}/s`)])
  if (yields.rest !== null) lines.push([GREEN, fit("MCP targets", `${money(yields.rest)}/s`)])
  lines.push([WHITE, fit("augmentations", `limited by ${augs.limit}`)])
  lines.push([GREEN, fit(`ready ${augs.ready}`, money(augs.readyCost))])
  lines.push([GREEN, fit(`all ${augs.all} offered`, money(augs.allCost) + (augs.allWait > 0 ? ` in ${duration(augs.allWait)}` : ""))])
  if (augs.limit === "cash") lines.push([YELLOW, fit("ready in", duration(augs.readyWait))])
  else lines.push([GREEN, fit("spare after ready", money(augs.spare))])
  if (augs.next) lines.push([GREEN, fit(augs.next.name.slice(0, 28), `+${Math.ceil(augs.next.repGap)} rep`)])
  lines.push([GREEN, fit(`x=${pos.x}`, `y=${pos.y}`)])
  return lines
}

function resolvePosition(ns, args, styles) {
  const width = args.w || Math.ceil(WIDTH_CHARS * styles.tailFontSize * 0.6) + 34
  const x = args.x ?? Math.max(0, ns.ui.windowSize()[0] - width - RIGHT_MARGIN)
  return { x: Math.round(x), y: Math.round(args.y ?? DEFAULT_Y), width }
}

function killPriorInstances(ns) {
  for (const proc of ns.ps(ns.getHostname())) {
    if (proc.filename.replace(/^\//, "") !== ME || proc.pid === ns.pid) continue
    ns.ui.closeTail(proc.pid)
    ns.kill(proc.pid)
  }
}

export async function main(ns) {
  ns.disableLog("ALL")
  await capturePriorTailPosition(ns, ME)
  killPriorInstances(ns)
  const parsed = parseArgs(ns)
  const args = { ...parsed, ...loadTailPosition(ns, ME, parsed) }
  const styles = ns.ui.getStyles()
  const pos = resolvePosition(ns, args, styles)
  const samples = []
  let previous = null, shown = 0

  ns.ui.openTail()
  ns.ui.setTailTitle("money")
  ns.ui.moveTail(pos.x, pos.y)
  while (true) {
    let lines
    try {
      const now = Date.now(), sample = read(ns, previous, now)
      previous = sample.stackRaw
      addSample(samples, sample)
      const view = summarize(ns, samples, now)
      lines = buildLines(view, pos)
      ns.write(STATUS, JSON.stringify(view), "w")
    } catch (e) {
      lines = [[YELLOW, "ERROR"], [YELLOW, String(e).slice(0, WIDTH_CHARS)]]
    }
    ns.clearLog()
    for (const [color, line] of lines) ns.print(color + line + RESET)
    if (lines.length !== shown) {
      shown = lines.length
      ns.ui.resizeTail(pos.width, args.h || Math.ceil((shown + 1) * styles.tailFontSize * styles.lineHeight) + 40)
    }
    ns.ui.renderTail()
    await saveTailPosition(ns, ME)
    await ns.sleep(POLL_MS)
  }
}
