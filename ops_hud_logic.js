/** Pure view logic for ops_hud.js. No ns calls, no side effects. */
import { duration, money } from "./money_logic.js"

export const WIDTH = 42
export const PACIFIC_OFFSET_MS = 7 * 3600000
export const FRESH = { mcp: 120000, stacks: 120000, stackManager: 180000, capital: 60000, activity: 180000, dnet: 30000, install: Infinity }
export const LABS = [
  { host: "th3_l4byr1nth", name: "Normal", depth: 7, charisma: 300 },
  { host: "cru3l_l4byr1nth", name: "Cruel", depth: 12, charisma: 600 },
  { host: "m3rc1l3ss_l4byr1nth", name: "Merciless", depth: 19, charisma: 1500 },
  { host: "ub3r_l4byr1nth", name: "Uber", depth: 23, charisma: 2500 },
  { host: "et3rn4l_l4byr1nth", name: "Eternal", depth: 29, charisma: 3000 },
]
export const RED_PILL_CHARISMA = 3000
const REWARD_LABS = { "The W1ngs of Icarus": 1, "The B00ts of Perseus": 2 }
const MANAGER_FRESH_MS = 120000

export const clock = (ms) => new Date(ms - PACIFIC_OFFSET_MS).toISOString().slice(11, 19)
export const fit = (left, right = "") => {
  left = String(left); right = String(right)
  return left.length + right.length < WIDTH ? left + " ".repeat(WIDTH - left.length - right.length) + right : (left + " " + right).slice(0, WIDTH)
}
export function wrap(text, width = WIDTH, maxLines = 2) {
  const lines = []
  let line = ""
  for (const word of String(text || "").split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > width) { lines.push(line); line = "" }
    line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  const out = lines.slice(0, maxLines).map((l) => l.slice(0, width))
  if (lines.length > maxLines) out[maxLines - 1] = out[maxLines - 1].slice(0, width - 1) + "~"
  return out
}
export function ago(now, ts) {
  if (!Number.isFinite(ts)) return "none"
  const seconds = Math.max(0, Math.floor((now - ts) / 1000))
  return seconds < 90 ? `${seconds}s` : duration(seconds)
}

/** live, STALE or MISSING; a stale file never reads as healthy. */
export function freshness(now, ts, limit) {
  if (!Number.isFinite(ts)) return "MISSING"
  return now - ts > limit ? "STALE" : "live"
}

/** Labs solved so far, or null when no record says. A lab status survives installs, so it stays true. */
export function labsSolved(lab, queued = []) {
  const index = LABS.findIndex((item) => item.host === lab?.lab)
  const floor = Math.max(0, ...queued.map((name) => REWARD_LABS[name] || 0))
  const seen = index < 0 ? null : lab.state === "solved" ? index + 1 : index
  return seen === null && !floor ? null : Math.max(seen ?? 0, floor)
}

/** The next lab on the Red Pill ladder, what blocks it, and whether the install should wait for it. */
export function chooseGoal({ charisma, solved, lab, queuedCount = 0 }) {
  const next = solved === null ? null : LABS[solved] || null
  const c = Number(charisma) || 0
  const goal = { pill: `C${c}/${RED_PILL_CHARISMA}`, labs: solved === null ? "?/5" : `${solved}/5`, next, hold: false, block: "" }
  if (solved === null) return { ...goal, title: "next lab unknown", block: "no lab record yet" }
  if (!next) return { ...goal, title: "all labs solved", block: c < RED_PILL_CHARISMA ? "" : "install for The Red Pill" }
  goal.title = `${next.name} lab d${next.depth}`
  goal.cha = `C${c}/${next.charisma}`
  if (c < next.charisma) return { ...goal, hold: queuedCount > 0, block: `charisma +${next.charisma - c}` }
  const state = lab?.lab === next.host ? lab.state : "no walker yet"
  return { ...goal, block: state === "solved" ? "" : `reach/solve: ${state}` }
}

function describeAction(action, ok) {
  if (!action) return "idle"
  const what = action.kind === "save" ? `save: ${action.reason || "next"}` : `${action.kind}${action.name ? " " + action.name : ""} ${money(action.cost)}`
  return ok === false ? `FAILED ${what}` : what
}

function describeDecision(decision) {
  if (!decision) return "no decision yet"
  const target = decision.company || decision.faction || decision.course || decision.stat || decision.crime || ""
  return `${decision.action}${target ? " " + String(target).split(" &")[0] : ""}`
}

/** Everything the panel shows, as [tone, text]; tone is head, ok or warn. */
export function buildPanel(f) {
  const { now } = f
  const mcpAge = freshness(now, f.mcp?.ts, FRESH.mcp)
  const stackMgrAge = freshness(now, f.stackManager?.ts, FRESH.stackManager)
  const capitalAge = freshness(now, f.capital?.ts, FRESH.capital)
  const actAge = freshness(now, f.activity?.ts, FRESH.activity)
  const dnetAge = freshness(now, f.root?.ts, FRESH.dnet)
  const scoutAge = freshness(now, f.scout?.ts, FRESH.dnet * 6)
  const items = []
  const alert = (text) => items.push({ alert: true, text })
  const stale = (text) => items.push({ alert: false, text })
  const tone = (state) => (state === "live" ? "ok" : "warn")
  const mark = (state, ts) => (state === "live" ? ago(now, ts) : `${state} ${ago(now, ts)}`)
  const rows = []

  const skills = f.mcp?.player?.skills || {}
  const hacking = Number(skills.hacking) || 0
  const charisma = Number(skills.charisma) || 0
  const queued = f.activity?.augmentation?.queued || []
  const solved = labsSolved(f.lab, queued)
  const goal = chooseGoal({ charisma, solved, lab: f.lab, queuedCount: queued.length })

  rows.push(["head", "AUTOMATION"])
  rows.push([tone(mcpAge), fit(`MCP ${mark(mcpAge, f.mcp?.ts)}`, `${f.mcp?.target || "--"} ${f.mcp?.phase || ""}`.trim().slice(0, 26))])
  if (mcpAge !== "live") stale(`MCP status ${mcpAge.toLowerCase()}`)
  for (const issue of Object.entries(f.mcp?.invariantViolations || {}).filter(([, n]) => Number(n) > 0)) alert(`MCP invariant ${issue[0]} x${issue[1]}`)

  const stacks = [...(f.stacks || [])].sort((a, b) => (Number(b.perSec) || 0) - (Number(a.perSec) || 0))
  const liveStacks = stacks.filter((s) => now - s.ts < FRESH.stacks)
  rows.push([tone(stackMgrAge), fit(`stacks ${mark(stackMgrAge, f.stackManager?.ts)}`, `${liveStacks.length}/${stacks.length} live ${f.stackManager?.state || ""}`.trim().slice(0, 24))])
  if (stackMgrAge !== "live") stale(`stack manager ${stackMgrAge.toLowerCase()}`)
  if (f.stackManager?.failed?.length) alert(`stack start failed: ${f.stackManager.failed.join(",")}`)
  for (const s of stacks.slice(0, 3)) {
    const fresh = now - s.ts < FRESH.stacks
    rows.push([fresh ? "ok" : "warn", fit(` ${s.target}`.slice(0, 18), fresh ? `${s.state || ""} ${money(s.perSec)}/s r${s.resets || 0}`.slice(0, 23) : `STALE ${ago(now, s.ts)}`)])
    if (!fresh) stale(`stack ${s.target} stale`)
    else if (s.resets > 0 && s.state !== "stacking") alert(`stack ${s.target} ${s.state}, reset x${s.resets}`)
  }
  if (stacks.length > 3) rows.push(["ok", ` +${stacks.length - 3} more stacks`])

  rows.push([capitalAge === "live" && f.capital?.ok !== false ? "ok" : "warn", fit(`capital ${mark(capitalAge, f.capital?.ts)}`, describeAction(f.capital?.action, f.capital?.ok).slice(0, 26))])
  if (capitalAge !== "live") stale(`capital manager ${capitalAge.toLowerCase()}`)
  else if (f.capital?.ok === false) alert(`capital purchase failed: ${f.capital.action?.kind}`)

  const managers = Object.values(f.registry || {}).filter((ts) => Number.isFinite(ts) && now - ts < MANAGER_FRESH_MS).length
  rows.push([tone(dnetAge), fit(`darknet ${mark(dnetAge, f.root?.ts)}`, managers ? `${managers} mgr` : "")])
  if (dnetAge !== "live") stale(`darknet ${dnetAge.toLowerCase()}`)
  if (f.scout) rows.push([tone(scoutAge), fit(" scout", `${f.scout.state || "?"} d${f.scout.depth ?? "?"} ${ago(now, f.scout.ts)}`.slice(0, 30))])
  if (f.lab) {
    const bad = ["stuck", "failing"].includes(f.lab.state)
    rows.push([bad ? "warn" : "ok", fit(` lab ${LABS.find((l) => l.host === f.lab.lab)?.name || "?"}`, `${f.lab.state || "?"} ${ago(now, f.lab.ts)}`)])
    if (bad) alert(`lab ${f.lab.state}: ${f.lab.lab}`)
  }

  rows.push(["head", fit("PLAYER", `H${hacking}${mcpAge === "live" ? "" : "?"} C${charisma}${mcpAge === "live" ? "" : "?"}`)])
  rows.push([tone(actAge), fit(`do ${describeDecision(f.activity?.decision)}`.slice(0, 28), mark(actAge, f.activity?.ts))])
  if (actAge !== "live") stale(`player activity ${actAge.toLowerCase()}`)
  if (f.activity?.apiUnavailable) alert("Singularity API unavailable")
  if (f.activity?.error) alert(`activity error: ${String(f.activity.error).slice(0, 24)}`)
  for (const line of wrap(`why ${f.activity?.decision?.reason || "none recorded"}`)) rows.push(["ok", line])
  const gate = f.activity?.gate
  if (f.activity?.gateScanOk && gate && gate.required > hacking) rows.push(["ok", fit(`H gate ${gate.host}`.slice(0, 28), `H${gate.required} +${gate.required - hacking}`)])

  rows.push(["head", fit("GOAL", `labs ${goal.labs}`)])
  rows.push(["ok", fit(goal.title, goal.cha || "")])
  if (goal.block) rows.push([goal.block.startsWith("charisma") ? "ok" : "warn", fit("blocked", goal.block.slice(0, 30))])
  rows.push(["ok", fit("Red Pill", goal.pill)])
  const aug = f.activity?.augmentation
  const augStale = aug && now - aug.ts > 1800000
  const sinceInstall = Number.isFinite(aug?.resetAt) ? ago(now, aug.resetAt) : "?"
  rows.push([augStale ? "warn" : "ok", fit(`install ${goal.hold ? "HELD" : queued.length ? "open" : "none queued"}`, `${queued.length} queued, last ${sinceInstall}`.slice(0, 30))])
  if (augStale) stale(`augmentation record ${ago(now, aug.ts)} old`)
  if (f.install?.failed?.length) alert(`install buy failed: ${f.install.failed.slice(0, 2).join(",").slice(0, 20)}`)

  const alerts = Array.isArray(f.review?.alerts) ? f.review.alerts : []
  for (const a of alerts.slice(0, 2)) alert(String(a.message))
  const shown = [...items.filter((i) => i.alert), ...items.filter((i) => !i.alert)].slice(0, 4)
  const health = items.some((i) => i.alert) ? "ATTENTION" : items.length ? "CHECK" : "OK"
  rows.push(["head", fit("ATTENTION", items.length ? `${items.length}` : "none")])
  for (const item of shown) rows.push(["warn", item.text.slice(0, WIDTH)])
  rows.unshift(["head", fit(`OPERATIONS ${health}`, clock(now))])
  return { health, rows }
}
