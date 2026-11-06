/** Run-target banner for hud_consolidated.js. Pure: no ns calls.
 *
 * run_target.json (profile config) holds the run's goal and an ordered step
 * list, edited by hand as the plan changes. A step has `metrics` (all must be
 * met), a single `metric`, or neither (then only `done: true` finishes it).
 * Metric kinds: hacking, combat (lowest of str/def/dex/agi), money, karma,
 * installed (augmentations), gate (hacking against the controller's next
 * faction gate from player_activity_status.json).
 *
 * "Now" is the step after the last finished one, not the first unfinished
 * one: an install resets hacking and cash, and that must not send the banner
 * back to steps already passed.
 */

const BAR_WIDTH = 12

// Karma falls as it progresses, so its target is met from above.
const BELOW_BY_DEFAULT = new Set(["karma"])
const SHORT = { hacking: "hack", combat: "combat", money: "cash", karma: "karma", installed: "augs", gate: "hack" }

export function metricValue(metric, live) {
  switch (metric?.kind) {
    case "hacking": return { value: live.hacking, target: metric.target }
    case "combat": return { value: live.combat, target: metric.target }
    case "money": return { value: live.money, target: metric.target }
    case "karma": return { value: live.karma, target: metric.target }
    case "installed": return { value: live.installed, target: metric.target }
    case "gate": return { value: live.hacking, target: metric.target ?? live.gate?.required, host: live.gate?.host }
    default: return null
  }
}

export function metricProgress(metric, live) {
  const read = metricValue(metric, live)
  if (!read || !Number.isFinite(read.value) || !Number.isFinite(read.target)) return null
  const below = metric.below ?? BELOW_BY_DEFAULT.has(metric.kind)
  const met = below ? read.value <= read.target : read.value >= read.target
  const fraction = met ? 1 : read.target === 0 ? 0 : Math.max(0, Math.min(1, read.value / read.target))
  return { ...read, met, fraction }
}

export function bar(fraction, width = BAR_WIDTH) {
  // Floor, so a bar only looks full when the target is met.
  const filled = Math.floor(Math.max(0, Math.min(1, fraction)) * width)
  return "█".repeat(filled) + "░".repeat(width - filled)
}

function formatValue(kind, n, compact) {
  if (kind === "money") return "$" + compact(n, 1)
  if (kind === "karma") return compact(n, 0)
  return String(Math.floor(n))
}

function stepMetrics(step) {
  if (Array.isArray(step?.metrics)) return step.metrics
  return step?.metric ? [step.metric] : []
}

// A step with `install: true` takes its label from the readiness planner's
// install plan; `waitFor` names factions the install is being held for, shown
// until one of their augmentations joins the plan.
export function installLabel(plan, waitFor = []) {
  if (!plan || !Array.isArray(plan.names)) return "Install (plan unknown)"
  const factions = plan.factions || []
  const count = plan.names.length
  const from = factions.length ? ` from ${factions.join(", ")}` : ""
  const waiting = waitFor.filter((name) => !factions.includes(name))
  return `Install ${count} augment${count === 1 ? "" : "s"}${from}${waiting.length ? `; waiting on ${waiting.join(", ")}` : ""}`
}

export function describeStep(step, live, compact) {
  const parts = stepMetrics(step).map((metric) => {
    const progress = metricProgress(metric, live)
    if (!progress) return { text: `${SHORT[metric.kind] || metric.kind} unknown`, met: false, fraction: 0 }
    const v = formatValue(metric.kind, progress.value, compact)
    const t = formatValue(metric.kind, progress.target, compact)
    return { ...progress, text: `${SHORT[metric.kind]}${progress.host ? ` ${progress.host}` : ""} ${v}/${t}` }
  })
  const met = parts.length > 0 && parts.every((part) => part.met)
  const label = step.install ? installLabel(live.installPlan, step.waitFor) : step.label || "unnamed step"
  return { label, done: Boolean(step.done) || met, parts }
}

export function nowIndex(steps) {
  let last = -1
  steps.forEach((step, index) => { if (step.done) last = index })
  return last + 1
}

function partLine(part) {
  return `${part.met ? "✓" : " "} ${part.text} ${bar(part.fraction)} ${Math.floor(part.fraction * 100)}%`
}

export function runTargetView(config, live, compact) {
  if (!config || !Array.isArray(config.steps) || config.steps.length === 0) {
    return { compact: "none set", lines: ["Run target: none set (run_target.json missing or invalid)"] }
  }
  const steps = config.steps.map((step) => describeStep(step, live, compact))
  const index = nowIndex(steps)
  const lines = [`Goal: ${config.goal || "not set"}`]
  let compactText
  if (index >= steps.length) {
    lines.push(`Now:  all ${steps.length} steps done; set the next target`)
    compactText = "all steps done"
  } else {
    const now = steps[index]
    lines.push(`Now:  ${now.label} (step ${index + 1} of ${steps.length})`)
    for (const part of now.parts) lines.push(`  ${partLine(part)}`)
    const next = steps[index + 1]
    if (next) lines.push(`Next: ${next.label}`)
    const open = now.parts.filter((part) => !part.met)
    const lead = open.length ? open.reduce((a, b) => (a.fraction <= b.fraction ? a : b)) : null
    compactText = `${now.label}${lead ? ` · ${lead.text}` : ""}`
  }
  if (live.work) lines.push(`Work: ${live.work}`)
  // Shadow-mode install advice from augmentation_readiness.json; nothing acts on it yet.
  if (live.advice) lines.push(`Advice: ${live.advice}`)
  if (config.updated) lines.push(`Plan updated ${config.updated}`)
  return { compact: compactText, lines }
}
