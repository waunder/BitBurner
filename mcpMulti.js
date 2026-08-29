/**
 * mcpMulti — experimental multi-target farmer. Separate from mcp.js on
 * purpose: mcp.js stays untouched and keeps farming live; this script tests
 * the "spread the worker pool across several targets instead of parking it
 * all on one" idea raised in the single- vs multi-target discussion (see
 * docs/hacking-strategy.md and docs/processes.md's mcpMulti.js section).
 *
 * DRY RUN BY DEFAULT. Every tick computes a full multi-target plan (which
 * targets, which hosts, projected $/s per target, and a side-by-side
 * `singleTargetBaselineScore` — what mcp.js's own approach would project if
 * it gave the whole pool to just the best target) and writes it to
 * mcp_multi_status.json, but calls no ns.exec/ns.scp/ns.kill. Only
 * `run mcpMulti.js live=1` deploys real threads — same shape as
 * mcp_stock_trader.js's `trade=1` gate, for the same reason: this is new,
 * unproven logic and should prove itself on paper first.
 *
 * mcp.js only exports `main`, so the ns-touching infrastructure it doesn't
 * share (network scan, RAM accounting, event log, thread exec, ...) is
 * copied here rather than imported — same "copied verbatim, not rewritten"
 * choice mcp_logic.js's own header documents for its own extraction from
 * mcp.js. Everything about what a *good plan looks like for one target*
 * (work-weight sizing, target scoring, stuck detection) is imported from
 * mcp_logic.js unchanged; only the multi-target scheduling
 * (computeTargetPoolNeed, partitionHostsAcrossTargets) is new, and lives in
 * mcpMulti_logic.js with its own `node --test` suite.
 *
 * v1 scope, deliberately narrower than mcp.js:
 *   - money objective only (no XP mode) — multi-target spreading doesn't
 *     share XP mode's "sit still and grind one target" rationale.
 *   - no R8/Formulas.exe switch veto.
 *   - no money-degradation eviction timer. mcp.js needs one because it
 *     *commits* to one target and must decide when to stop re-litigating
 *     that commitment. mcpMulti recomputes the full partition from live
 *     scores every tick, so a genuinely draining target's declining
 *     moneyPct already lowers its own future need/rank next tick — there is
 *     no long-lived "committed" decision for a timer to protect.
 *   - stuck-target detection (evaluateStuckTarget, mcp_logic.js) is kept,
 *     since a target whose security genuinely never converges would
 *     otherwise permanently occupy an assignment slot for zero income.
 *
 * Args: live=1 (deploy real threads; default is dry-run/log-only)
 * @param {NS} ns
 */
import {
  SECURITY_EPSILON,
  computeWorkWeights,
  computeTargetScore,
  computeTargetEffectiveScore,
  computeDesiredAllocation,
  hostNeedsRedeploy,
  countRunningByScript,
  missingActionLaunchPlan,
  evaluateStuckTarget,
} from "./mcp_logic.js"
import { computeTargetPoolNeed, partitionHostsAcrossTargets } from "./mcpMulti_logic.js"

let SECURITY_CAP = 1
let TARGET_MONEY_GOAL = 0.95
let WORK_SECURITY_MARGIN = 1.5
let LOOP_SLEEP_MS = 10000
let WEAKEN_STUCK_MS = 60000
let WEAKEN_STUCK_SECURITY_THRESHOLD = 0.05
let SKIP_STUCK_MS = 60000
let HACK_BALANCE_SAFETY = 0.5
let REDEPLOY_TOLERANCE_ABSOLUTE = 2
let REDEPLOY_TOLERANCE_RELATIVE = 0.2
let HOME_RAM_RESERVE = 32
let SCORE_HORIZON_SECONDS = 3600
// New tunables this file introduces — see mcpMulti_logic.js's own doc
// comments for the math each one drives.
let MAX_CONCURRENT_TARGETS = 3
let SATURATION_FRACTION = 0.9

const CONFIG_DEFAULTS = {
  SECURITY_CAP,
  TARGET_MONEY_GOAL,
  WORK_SECURITY_MARGIN,
  LOOP_SLEEP_MS,
  WEAKEN_STUCK_MS,
  WEAKEN_STUCK_SECURITY_THRESHOLD,
  SKIP_STUCK_MS,
  HACK_BALANCE_SAFETY,
  REDEPLOY_TOLERANCE_ABSOLUTE,
  REDEPLOY_TOLERANCE_RELATIVE,
  HOME_RAM_RESERVE,
  SCORE_HORIZON_SECONDS,
  MAX_CONCURRENT_TARGETS,
  SATURATION_FRACTION,
}

const CONFIG_FILE = "mcp_multi_config.json"
const EVENT_FILE = "mcp_multi_events.txt"
const EVENT_FILE_KEEP = 300
const STATUS_EVENT_COUNT = 20
const STATUS_FILE = "mcp_multi_status.json"
const STATUS_LOG_FILE = "mcp_multi_status_log.txt"
const TARGET_STATE_FILE = "mcp_multi_target_state.json"

const ACTION_SCRIPTS = ["/scripts/grow.js", "/scripts/hack.js", "/scripts/weaken.js"]
const HACK_SEC_INCREASE = 0.002
const GROW_SEC_INCREASE = 0.004
const WEAKEN_SEC_DECREASE = 0.05
const WEAKEN_PER_HACK_RATIO = 4
const WEAKEN_PER_GROW_RATIO = 1.25
const GROW_TIME_RATIO = WEAKEN_PER_HACK_RATIO / WEAKEN_PER_GROW_RATIO
const SECURITY_CONSTANTS = {
  hackSecIncrease: HACK_SEC_INCREASE,
  growSecIncrease: GROW_SEC_INCREASE,
  weakenSecDecrease: WEAKEN_SEC_DECREASE,
  weakenPerHackRatio: WEAKEN_PER_HACK_RATIO,
  weakenPerGrowRatio: WEAKEN_PER_GROW_RATIO,
}

function parseArgs(ns) {
  const out = { live: false }
  for (const raw of ns.args) {
    if (raw === "live=1" || raw === "live=true") out.live = true
  }
  return out
}

/** Re-read tunables from mcp_multi_config.json. Called at the top of every tick. */
function loadConfig(ns, state) {
  const raw = ns.read(CONFIG_FILE)
  if (raw === state.lastRaw) return null
  state.lastRaw = raw

  let parsed = {}
  if (raw.trim()) {
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      return { error: String(e) }
    }
  }

  const resolved = {}
  const rejected = []
  for (const key of Object.keys(CONFIG_DEFAULTS)) {
    const value = parsed[key]
    if (value === undefined) {
      resolved[key] = CONFIG_DEFAULTS[key]
    } else if (typeof value === "number" && Number.isFinite(value)) {
      resolved[key] = value
    } else {
      resolved[key] = CONFIG_DEFAULTS[key]
      rejected.push(key)
    }
  }
  for (const key of Object.keys(parsed)) {
    if (!(key in CONFIG_DEFAULTS)) rejected.push(key)
  }

  const changes = {}
  const current = {
    SECURITY_CAP,
    TARGET_MONEY_GOAL,
    WORK_SECURITY_MARGIN,
    LOOP_SLEEP_MS,
    WEAKEN_STUCK_MS,
    WEAKEN_STUCK_SECURITY_THRESHOLD,
    SKIP_STUCK_MS,
    HACK_BALANCE_SAFETY,
    REDEPLOY_TOLERANCE_ABSOLUTE,
    REDEPLOY_TOLERANCE_RELATIVE,
    HOME_RAM_RESERVE,
    SCORE_HORIZON_SECONDS,
    MAX_CONCURRENT_TARGETS,
    SATURATION_FRACTION,
  }
  for (const key of Object.keys(CONFIG_DEFAULTS)) {
    if (current[key] !== resolved[key]) changes[key] = { from: current[key], to: resolved[key] }
  }

  SECURITY_CAP = resolved.SECURITY_CAP
  TARGET_MONEY_GOAL = resolved.TARGET_MONEY_GOAL
  WORK_SECURITY_MARGIN = resolved.WORK_SECURITY_MARGIN
  LOOP_SLEEP_MS = resolved.LOOP_SLEEP_MS
  WEAKEN_STUCK_MS = resolved.WEAKEN_STUCK_MS
  WEAKEN_STUCK_SECURITY_THRESHOLD = resolved.WEAKEN_STUCK_SECURITY_THRESHOLD
  SKIP_STUCK_MS = resolved.SKIP_STUCK_MS
  HACK_BALANCE_SAFETY = resolved.HACK_BALANCE_SAFETY
  REDEPLOY_TOLERANCE_ABSOLUTE = resolved.REDEPLOY_TOLERANCE_ABSOLUTE
  REDEPLOY_TOLERANCE_RELATIVE = resolved.REDEPLOY_TOLERANCE_RELATIVE
  HOME_RAM_RESERVE = resolved.HOME_RAM_RESERVE
  SCORE_HORIZON_SECONDS = resolved.SCORE_HORIZON_SECONDS
  MAX_CONCURRENT_TARGETS = resolved.MAX_CONCURRENT_TARGETS
  SATURATION_FRACTION = resolved.SATURATION_FRACTION

  if (Object.keys(changes).length === 0 && rejected.length === 0) return null
  return { changes, rejected }
}

function hashSource(text) {
  let hash = 5381
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}

function makeEventLog(ns, runId, scriptVersion) {
  const raw = ns.read(EVENT_FILE)
  if (raw) {
    const lines = raw.split("\n").filter((l) => l.trim())
    if (lines.length > EVENT_FILE_KEEP) {
      ns.write(EVENT_FILE, lines.slice(-EVENT_FILE_KEEP).join("\n") + "\n", "w")
    }
  }
  let seq = 0
  const recent = []
  const log = {
    recent,
    lastWriteError: null,
    emit(kind, data) {
      seq += 1
      const event = Object.assign({ t: Date.now(), seq, runId, ver: scriptVersion, kind }, data)
      recent.push(event)
      if (recent.length > STATUS_EVENT_COUNT) recent.shift()
      try {
        ns.write(EVENT_FILE, JSON.stringify(event) + "\n", "a")
        log.lastWriteError = null
      } catch (e) {
        log.lastWriteError = String(e)
        ns.print("mcpMulti: failed to write event: " + e)
      }
      return event
    },
  }
  return log
}

const INVARIANT_TOAST_MS = 8000

function makeInvariants(ns, events) {
  const counts = {}
  const toasted = new Set()
  return {
    counts,
    check(name, ok, data) {
      if (ok) return true
      counts[name] = (counts[name] || 0) + 1
      events.emit("invariant_violation", Object.assign({ invariant: name, count: counts[name] }, data))
      if (!toasted.has(name)) {
        toasted.add(name)
        ns.toast(`mcpMulti invariant violated: ${name}`, "error", INVARIANT_TOAST_MS)
      }
      return false
    },
  }
}

function disableLogs(ns) {
  const logs = [
    "scan",
    "run",
    "getServerSecurityLevel",
    "getServerMoneyAvailable",
    "getServerMaxMoney",
    "getServerMinSecurityLevel",
    "getServerRequiredHackingLevel",
    "getHackingLevel",
    "getServerUsedRam",
    "getScriptRam",
    "getPlayer",
  ]
  for (const log of logs) ns.disableLog(log)
}

function scanNetwork(ns) {
  const queue = ["home"]
  const visited = new Set(queue)
  for (let i = 0; i < queue.length; i++) {
    for (const neighbor of ns.scan(queue[i])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }
  return Array.from(visited)
}

function isHackableTarget(ns, server) {
  return (
    ns.hasRootAccess(server) &&
    ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(server) &&
    ns.getServerMaxMoney(server) > 0
  )
}

// Same shared read-from-ns step mcp.js's getTargetScore/getTargetEffectiveScore
// use (readTargetScoreInputs there) — see that function's own comment.
function readTargetScoreInputs(ns, server) {
  if (!isHackableTarget(ns, server)) return null
  const hackTime = ns.getHackTime(server) / 1000
  const hackPercentPerThread = ns.hackAnalyze(server)
  const growCycles = ns.growthAnalyze(server, 2)
  if (hackTime <= 0 || !(hackPercentPerThread > 0) || !Number.isFinite(growCycles) || growCycles <= 0) return null
  return {
    hackTime,
    hackPercentPerThread,
    growLogPerThread: Math.LN2 / growCycles,
    maxMoney: ns.getServerMaxMoney(server),
    hackChance: ns.hackAnalyzeChance(server),
  }
}

function getTargetEffectiveScore(ns, server, poolThreads) {
  const inputs = readTargetScoreInputs(ns, server)
  if (!inputs) return 0
  const { score } = computeTargetScore({ ...inputs, poolThreads, growTimeRatio: GROW_TIME_RATIO, ...SECURITY_CONSTANTS })
  if (score <= 0) return 0
  const { effective } = computeTargetEffectiveScore({
    score,
    hackTime: inputs.hackTime,
    growLogPerThread: inputs.growLogPerThread,
    maxMoney: inputs.maxMoney,
    money: ns.getServerMoneyAvailable(server),
    targetMoneyGoal: TARGET_MONEY_GOAL,
    growThreadsIfAllGrow: poolThreads,
    growTimeRatio: GROW_TIME_RATIO,
    horizonSeconds: SCORE_HORIZON_SECONDS,
  })
  return effective
}

// How many pool-thread-slots this target wants before it saturates
// (mcpMulti_logic.js's computeTargetPoolNeed) — 0 when its score inputs
// aren't readable, matching computeTargetScore's own "unreadable -> 0" fallback.
function getTargetPoolNeed(ns, server) {
  const inputs = readTargetScoreInputs(ns, server)
  if (!inputs) return 0
  const { poolThreadsNeeded } = computeTargetPoolNeed({
    hackPercentPerThread: inputs.hackPercentPerThread,
    growLogPerThread: inputs.growLogPerThread,
    growTimeRatio: GROW_TIME_RATIO,
    saturationFraction: SATURATION_FRACTION,
    ...SECURITY_CONSTANTS,
  })
  return poolThreadsNeeded
}

/** @param {number} [margin] - see mcp.js's getTargetWeakenThreads. */
function getTargetWeakenThreads(ns, target, margin = 0) {
  const currentSecurity = ns.getServerSecurityLevel(target)
  const minSecurity = ns.getServerMinSecurityLevel(target)
  const goalSecurity = Math.max(minSecurity, SECURITY_CAP) + margin
  const delta = currentSecurity - goalSecurity
  return delta > SECURITY_EPSILON ? Math.ceil(delta / WEAKEN_SEC_DECREASE) : 0
}

function getHostFreeRam(ns, host) {
  const usedRam = ns.getServerUsedRam(host)
  let freeRam = ns.getServerMaxRam(host) - usedRam
  if (host === "home") freeRam -= HOME_RAM_RESERVE
  return Math.max(0, freeRam)
}

function getWorkerHosts(ns, servers) {
  const workers = []
  for (const server of servers) {
    if (!ns.hasRootAccess(server)) continue
    if (ns.getServerMaxRam(server) <= 2.5) continue
    workers.push(server)
  }
  return workers
}

function getRunningActions(ns, host) {
  const running = []
  for (const proc of ns.ps(host)) {
    const normalized = proc.filename.startsWith("/") ? proc.filename : "/" + proc.filename
    if (ACTION_SCRIPTS.includes(normalized)) running.push({ proc, normalized })
  }
  return running
}

// RAM held by *any* currently-running action script is treated as
// reclaimable — same semantics as mcp.js's getHostReclaimableRam, and
// deliberately kept even in dry-run: the point of this number, and of
// `singleTargetBaselineScore` below, is "what would this strategy achieve
// if it took over the pool," which means simulating as if today's live
// occupant's threads were freed for reallocation, not pretending they don't
// exist. ACTION_SCRIPTS are only ever launched by mcp.js or mcpMulti in this
// codebase, so there's no ambiguity about whose thread is being counted.
function getHostReclaimableRam(ns, host, ramInfoByScript) {
  let reclaimable = getHostFreeRam(ns, host)
  for (const { proc, normalized } of getRunningActions(ns, host)) {
    reclaimable += proc.threads * (ramInfoByScript[normalized] || 0)
  }
  return reclaimable
}

function killActionScripts(ns, host) {
  for (const { proc } of getRunningActions(ns, host)) {
    ns.kill(proc.pid, host)
  }
}

function copyActionScripts(ns, host) {
  ns.scp(ACTION_SCRIPTS, host)
}

function cleanupOrphanedActionScripts(ns, workers) {
  let killedHosts = 0
  for (const host of workers) {
    if (getRunningActions(ns, host).length === 0) continue
    killActionScripts(ns, host)
    killedHosts++
  }
  if (killedHosts > 0) ns.tprint(`mcpMulti: cleaned up orphaned action scripts on ${killedHosts} host(s)`)
}

function describeRunningActions(ns, running) {
  return running.map(({ proc, normalized }) => {
    let elapsedS = Infinity
    const runningScript = ns.getRunningScript(proc.pid)
    if (runningScript) elapsedS = runningScript.onlineRunningTime
    return {
      script: normalized.replace("/scripts/", "").replace(".js", ""),
      target: proc.args[0],
      threads: proc.threads,
      elapsedS,
    }
  })
}

// Live-mode-only "pass 2" — identical shape to mcp.js's allocateThreads.
function allocateThreads(ns, host, target, plan, desired, tolerance, actionDurationsS) {
  const actions = []
  const allocation = { host, maxRam: ns.getServerMaxRam(host), usedRam: 0, freeRam: 0, actions }

  const running = getRunningActions(ns, host)
  const describedRunning = describeRunningActions(ns, running)
  const needsRedeploy = hostNeedsRedeploy({ target, plan, running: describedRunning, desired, tolerance, actionDurationsS })
  const missingLaunches = missingActionLaunchPlan(describedRunning, desired, getHostFreeRam(ns, host), {
    weaken: ns.getScriptRam("/scripts/weaken.js"),
    grow: ns.getScriptRam("/scripts/grow.js"),
    hack: ns.getScriptRam("/scripts/hack.js"),
  })

  if (!needsRedeploy) {
    if (missingLaunches.length > 0) {
      if (host !== "home") copyActionScripts(ns, host)
      for (const { proc, normalized } of running) {
        actions.push({ script: normalized.replace("/scripts/", "").replace(".js", ""), threads: proc.threads })
      }
      for (const { script, threads } of missingLaunches) {
        if (ns.exec(`/scripts/${script}.js`, host, threads, target) !== 0) actions.push({ script, threads })
      }
    } else {
      for (const { proc, normalized } of running) {
        actions.push({ script: normalized.replace("/scripts/", "").replace(".js", ""), threads: proc.threads })
      }
    }
    allocation.usedRam = ns.getServerUsedRam(host)
    allocation.freeRam = getHostFreeRam(ns, host)
    return allocation
  }

  if (host !== "home") copyActionScripts(ns, host)
  const have = countRunningByScript(describedRunning)
  const runningByScript = {}
  for (const { proc, normalized } of running) {
    runningByScript[normalized.replace("/scripts/", "").replace(".js", "")] = proc
  }
  for (const script of ["weaken", "grow", "hack"]) {
    const want = desired[script] || 0
    if (want === have[script]) {
      if (want > 0) actions.push({ script, threads: want })
      continue
    }
    const proc = runningByScript[script]
    if (proc) ns.kill(proc.pid, host)
    if (want > 0 && ns.exec(`/scripts/${script}.js`, host, want, target) !== 0) actions.push({ script, threads: want })
  }
  allocation.usedRam = ns.getServerUsedRam(host)
  allocation.freeRam = getHostFreeRam(ns, host)
  return allocation
}

function expireSkipped(skippedTargets) {
  const now = Date.now()
  for (const [server, ts] of skippedTargets) {
    if (now - ts >= SKIP_STUCK_MS) skippedTargets.delete(server)
  }
}

function loadTargetState(ns) {
  const skippedTargets = new Map()
  const raw = ns.read(TARGET_STATE_FILE)
  if (!raw) return skippedTargets
  try {
    const parsed = JSON.parse(raw)
    const now = Date.now()
    for (const [server, ts] of Object.entries(parsed.skipped || {})) {
      if (now - ts < SKIP_STUCK_MS) skippedTargets.set(server, ts)
    }
  } catch (e) {
    // Corrupt/unexpected content — start fresh rather than crash.
  }
  return skippedTargets
}

function saveTargetState(ns, skippedTargets) {
  ns.write(TARGET_STATE_FILE, JSON.stringify({ skipped: Object.fromEntries(skippedTargets) }), "w")
}

function formatMoney(value) {
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`
  return value.toFixed(0)
}

function totalThreadsFromHosts(hostReclaimable, weakenRam) {
  let total = 0
  for (const { reclaimableRam } of hostReclaimable) total += Math.floor(reclaimableRam / weakenRam)
  return Math.max(0, total)
}

/**
 * Builds one target's plan (weaken vs. work) — same math as mcp.js's
 * buildPlan/computeWorkWeights, objective hardcoded to "money" (see the file
 * header's v1-scope note).
 */
function buildPlan(ns, target, wasWorking) {
  const currentSecurity = ns.getServerSecurityLevel(target)
  const moneyPct = ns.getServerMoneyAvailable(target) / ns.getServerMaxMoney(target)
  const requiredWeaken = getTargetWeakenThreads(ns, target, wasWorking ? WORK_SECURITY_MARGIN : 0)
  if (requiredWeaken > 0) return { type: "weaken", currentSecurity, moneyPct }

  const hackPercentPerThread = ns.hackAnalyze(target)
  const growLogPerThread = Math.LN2 / ns.growthAnalyze(target, 2)
  const { weightBucket, weights } = computeWorkWeights({
    objective: "money",
    hackPercentPerThread,
    growLogPerThread,
    moneyPct,
    targetMoneyGoal: TARGET_MONEY_GOAL,
    safety: HACK_BALANCE_SAFETY,
    xpWeightHack: 0,
    xpWeightGrow: 0,
    ...SECURITY_CONSTANTS,
  })
  return { type: "work", currentSecurity, moneyPct, weightBucket, weights }
}

function formatStatus(status) {
  const parts = [
    `mcpMulti mode=${status.mode}`,
    `targets=${status.assignments.length}/${MAX_CONCURRENT_TARGETS}`,
    `pool=${status.totalPoolThreads}`,
    `ram=${(status.ramUtilization * 100).toFixed(0)}%`,
    `single=${formatMoney(status.singleTargetBaselineScore)}/s`,
    `multi=${formatMoney(status.multiTargetProjectedTotal)}/s`,
    `uplift=${status.upliftRatio.toFixed(2)}x`,
    `run=${status.runId}`,
    `ver=${status.scriptVersion}`,
  ]
  for (const a of status.assignments) {
    parts.push(`[${a.target} h=${a.hosts.length} plan=${a.plan} sec=${a.currentSecurity.toFixed(1)} moneyPct=${a.moneyPct.toFixed(2)} proj=${formatMoney(a.projectedScore)}/s]`)
  }
  const violations = Object.keys(status.invariantViolations || {})
  if (violations.length > 0) parts.push(`violations=${JSON.stringify(status.invariantViolations)}`)
  return parts.join(" ")
}

export async function main(ns) {
  disableLogs(ns)
  const args = parseArgs(ns)

  if (args.live && ns.scriptRunning("mcp.js", "home")) {
    ns.tprint(
      "mcpMulti: refusing to start live=1 — mcp.js is already running on home and would fight it for the same worker RAM. Kill mcp.js first (or run mcpMulti.js without live=1 to stay in dry-run alongside it)."
    )
    return
  }

  const runId = Date.now().toString(36) + "-" + Math.floor(Math.random() * 1679616).toString(36)
  const scriptVersion = hashSource(ns.read("mcpMulti.js"))
  const events = makeEventLog(ns, runId, scriptVersion)
  const invariants = makeInvariants(ns, events)
  const configState = { lastRaw: null }
  ns.tprint(`mcpMulti: run=${runId} ver=${scriptVersion} mode=${args.live ? "LIVE" : "DRY-RUN"}`)

  if (args.live) cleanupOrphanedActionScripts(ns, getWorkerHosts(ns, scanNetwork(ns)))

  const skippedTargets = loadTargetState(ns)
  const targetState = new Map() // target -> { securityProgressTime, bestSecuritySeen, lastPlanType }
  let lastTickTime = Date.now()
  let tickIndex = 0
  let lastLogSignature = null

  events.emit("startup", { mode: args.live ? "live" : "dry-run", restoredSkipped: skippedTargets.size })

  while (true) {
    const configUpdate = loadConfig(ns, configState)
    if (configUpdate) {
      if (configUpdate.error) {
        ns.print(`mcpMulti: ${CONFIG_FILE} is not valid JSON, keeping current values (${configUpdate.error})`)
        invariants.check("configParses", false, { error: configUpdate.error })
      } else {
        ns.tprint(`mcpMulti: config updated ${JSON.stringify(configUpdate.changes)}`)
        events.emit("config_change", configUpdate)
      }
    }

    const servers = scanNetwork(ns)
    const workers = getWorkerHosts(ns, servers)
    const hackRam = ns.getScriptRam("/scripts/hack.js")
    const growRam = ns.getScriptRam("/scripts/grow.js")
    const weakenRam = ns.getScriptRam("/scripts/weaken.js")
    const minRam = Math.min(hackRam, growRam, weakenRam)
    const ramInfo = { hackRam, growRam, weakenRam, minRam }
    const ramInfoByScript = { "/scripts/weaken.js": weakenRam, "/scripts/grow.js": growRam, "/scripts/hack.js": hackRam }

    expireSkipped(skippedTargets)

    const hostReclaimable = workers.map((host) => ({ host, reclaimableRam: getHostReclaimableRam(ns, host, ramInfoByScript) }))
    const reclaimableByHost = Object.fromEntries(hostReclaimable.map((h) => [h.host, h.reclaimableRam]))
    const totalPoolThreads = totalThreadsFromHosts(hostReclaimable, weakenRam)

    const buildCandidates = (ignoreExclusions) => {
      const list = []
      for (const server of servers) {
        if (!isHackableTarget(ns, server)) continue
        if (!ignoreExclusions && skippedTargets.has(server)) continue
        const effectiveScore = getTargetEffectiveScore(ns, server, totalPoolThreads)
        const requiredWeaken = getTargetWeakenThreads(ns, server)
        const need = requiredWeaken > 0 ? requiredWeaken : getTargetPoolNeed(ns, server)
        list.push({ server, effectiveScore, need, requiredWeaken })
      }
      return list
    }

    let candidates = buildCandidates(false)
    if (candidates.length === 0) candidates = buildCandidates(true)

    if (candidates.length === 0) {
      ns.tprint(`mcpMulti: no hackable target found (servers=${servers.length} pool=${totalPoolThreads})`)
      events.emit("stall", { reason: "no_target", servers: servers.length, totalPoolThreads, hackingLevel: ns.getHackingLevel() })
      if (args.live) for (const host of workers) killActionScripts(ns, host)
      await ns.sleep(60000)
      continue
    }

    const { assignments: rawAssignments } = partitionHostsAcrossTargets({
      candidates: candidates.map(({ server, effectiveScore, need }) => ({ server, effectiveScore, need })),
      hosts: hostReclaimable,
      maxConcurrentTargets: MAX_CONCURRENT_TARGETS,
      weakenRam,
    })

    const activeTargetNames = new Set(rawAssignments.map((a) => a.target))
    for (const target of targetState.keys()) {
      if (!activeTargetNames.has(target)) targetState.delete(target)
    }

    const assignments = []
    const redeployTolerance = { absolute: REDEPLOY_TOLERANCE_ABSOLUTE, relative: REDEPLOY_TOLERANCE_RELATIVE }
    let poolRamClaimed = 0
    let weakenBudgetViolation = null

    for (const raw of rawAssignments) {
      const target = raw.target
      const state = targetState.get(target) || { securityProgressTime: 0, bestSecuritySeen: Infinity, lastPlanType: null }

      const plan = buildPlan(ns, target, state.lastPlanType === "work")

      const requiredWeakenNow = getTargetWeakenThreads(ns, target)
      const stuckWindowMs = Math.max(WEAKEN_STUCK_MS, ns.getWeakenTime(target) * 2)
      const stuckEval = evaluateStuckTarget({
        currentSecurity: plan.currentSecurity,
        bestSecuritySeen: state.bestSecuritySeen,
        securityProgressTime: state.securityProgressTime,
        requiredWeaken: requiredWeakenNow,
        now: Date.now(),
        stuckWindowMs,
        progressThreshold: WEAKEN_STUCK_SECURITY_THRESHOLD,
      })

      if (stuckEval.stuck) {
        ns.tprint(`mcpMulti: target ${target} not weakening (sec=${plan.currentSecurity.toFixed(2)}); skipping this tick`)
        events.emit("target_drop", { target, reason: "stuck", ...stuckEval })
        skippedTargets.set(target, Date.now())
        targetState.delete(target)
        continue // this tick's hosts for `target` sit idle; next tick's partition excludes it
      }

      targetState.set(target, { securityProgressTime: stuckEval.securityProgressTime, bestSecuritySeen: stuckEval.bestSecuritySeen, lastPlanType: plan.type })

      const actionDurationsS = {
        hack: ns.getHackTime(target) / 1000,
        grow: ns.getGrowTime(target) / 1000,
        weaken: ns.getWeakenTime(target) / 1000,
      }
      const hostsForTarget = raw.hosts.map((host) => ({ host, reclaimableRam: reclaimableByHost[host] }))
      const { allocations: desiredByHost, weakenBudgetRemaining } = computeDesiredAllocation({
        hosts: hostsForTarget,
        plan,
        weakenBudget: plan.type === "weaken" ? requiredWeakenNow : 0,
        ramInfo,
        securityConstants: SECURITY_CONSTANTS,
        growSecurityIncreaseForThreads: (growThreads) => ns.growthAnalyzeSecurity(growThreads, target, 1),
      })
      if (weakenBudgetRemaining < 0 && weakenBudgetViolation === null) {
        weakenBudgetViolation = { target, remaining: weakenBudgetRemaining, required: requiredWeakenNow }
      }

      const hostAllocations = []
      for (const { host, hack, grow, weaken } of desiredByHost) {
        poolRamClaimed += hack * hackRam + grow * growRam + weaken * weakenRam
        if (args.live) {
          hostAllocations.push(allocateThreads(ns, host, target, plan, { hack, grow, weaken }, redeployTolerance, actionDurationsS))
        } else {
          hostAllocations.push({ host, hack, grow, weaken, projected: true })
        }
      }

      assignments.push({
        target,
        hosts: raw.hosts,
        poolThreadsAssigned: raw.poolThreadsAssigned,
        plan: plan.type,
        weightBucket: plan.weightBucket || null,
        currentSecurity: plan.currentSecurity,
        moneyPct: plan.moneyPct,
        requiredWeaken: requiredWeakenNow,
        // Ramp-discounted (getTargetEffectiveScore), not the raw steady-state
        // rate — a target still priming (low moneyPct, elevated security)
        // would otherwise report as if it were already producing at full
        // achievable rate. See the 2026-08-29 skim_probe.js analysis: priming
        // alone runs 30min-50hr depending on the target, so an undiscounted
        // number here would systematically overstate near-term reality the
        // same way the pre-R4 single-target score used to.
        projectedScore: getTargetEffectiveScore(ns, target, raw.poolThreadsAssigned),
        hostAllocations,
      })
    }

    const topCandidate = [...candidates].sort((a, b) => b.effectiveScore - a.effectiveScore)[0]
    // Reuses the candidate's own ranking-time effectiveScore (same
    // getTargetEffectiveScore(ns, server, totalPoolThreads) call
    // buildCandidates already made) rather than recomputing — both for the
    // free efficiency and to guarantee this is exactly the number that
    // decided ranking, not a second, possibly-drifted read of live state.
    const singleTargetBaselineScore = topCandidate ? topCandidate.effectiveScore : 0
    const multiTargetProjectedTotal = assignments.reduce((sum, a) => sum + a.projectedScore, 0)
    const upliftRatio = singleTargetBaselineScore > 0 ? multiTargetProjectedTotal / singleTargetBaselineScore : 0

    const poolRamTotal = hostReclaimable.reduce((sum, h) => sum + h.reclaimableRam, 0)
    const ramUtilization = poolRamTotal > 0 ? poolRamClaimed / poolRamTotal : 0

    const now = Date.now()
    const interval = Math.max(0.001, (now - lastTickTime) / 1000)
    lastTickTime = now

    invariants.check("eventLogWrites", !events.lastWriteError, { error: events.lastWriteError })
    invariants.check("weakenBudgetNonNegative", weakenBudgetViolation === null, weakenBudgetViolation || {})
    if (tickIndex > 0) {
      const nominal = LOOP_SLEEP_MS / 1000
      invariants.check("tickWithinBounds", interval >= nominal * 0.5 && interval <= nominal * 3, { interval, nominal })
    }
    invariants.check("poolNotIdle", ramUtilization >= 0.5 || hostReclaimable.length === 0, { ramUtilization, hosts: hostReclaimable.length })
    tickIndex += 1

    const status = {
      ts: Date.now(),
      runId,
      scriptVersion,
      mode: args.live ? "live" : "dry-run",
      tickSeconds: interval,
      totalPoolThreads,
      ramUtilization,
      singleTargetBaselineScore,
      multiTargetProjectedTotal,
      upliftRatio,
      assignments: assignments.map(({ hostAllocations, ...rest }) => (args.live ? { ...rest, hostAllocations } : rest)),
      unassignedHosts: workers.filter((h) => !assignments.some((a) => a.hosts.includes(h))),
      invariantViolations: invariants.counts,
      recentEvents: events.recent,
      config: {
        SECURITY_CAP, TARGET_MONEY_GOAL, WORK_SECURITY_MARGIN, LOOP_SLEEP_MS, WEAKEN_STUCK_MS,
        WEAKEN_STUCK_SECURITY_THRESHOLD, SKIP_STUCK_MS, HACK_BALANCE_SAFETY, REDEPLOY_TOLERANCE_ABSOLUTE,
        REDEPLOY_TOLERANCE_RELATIVE, HOME_RAM_RESERVE, SCORE_HORIZON_SECONDS, MAX_CONCURRENT_TARGETS, SATURATION_FRACTION,
      },
    }

    const line = formatStatus(status)
    ns.print(line)

    try {
      ns.write(STATUS_FILE, JSON.stringify(status), "w")
      const signature = assignments.map((a) => `${a.target}:${a.plan}`).join(",")
      if (signature !== lastLogSignature) {
        ns.write(STATUS_LOG_FILE, `[${new Date(status.ts).toISOString()}] ${line}\n`, "a")
        lastLogSignature = signature
      }
    } catch (e) {
      ns.print("mcpMulti: failed to write status file: " + e)
    }

    try {
      saveTargetState(ns, skippedTargets)
    } catch (e) {
      ns.print("mcpMulti: failed to persist target state: " + e)
    }

    await ns.sleep(LOOP_SLEEP_MS)
  }
}
