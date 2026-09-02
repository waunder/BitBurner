/**
 * @param {NS} ns
 */

// Pure decision logic (no `ns` calls, no side effects) lives in mcp_logic.js
// and is unit-tested with `node --test mcp_logic.test.js` — see that file's
// header for why. Imported the same way dnet_deploy.js imports dnet_lib.js.
import {
  SECURITY_EPSILON,
  computeWorkWeights,
  computeTargetScore,
  computeXpTargetScore,
  computeTargetEffectiveScore,
  evaluateMoneyDegradation,
  evaluateOpportunitySwitch,
  evaluateFormulaSwitchVeto,
  evaluateStuckTarget,
  computeTickInvariantChecks,
  computeDesiredAllocation,
  hostNeedsRedeploy,
  countRunningByScript,
  missingActionLaunchPlan,
} from "mcp_logic.js"
import { auditTargetModels } from "./formulas_logic.js"

// Tunables are declared with `let`, not `const`, so loadConfig can reassign
// them in place from mcp_config.json at the top of every tick. Threading a
// config object through every helper would be a large diff for no behavioural
// gain; this way every existing reference keeps working untouched.
//
// The point is not remote control — the supervisor already gives us that. The
// point is that a *restart* wipes rateSamples, moneyPctSamples, totalHacked
// and lastSwitchTime. Automating restarts made the evidence-destruction cycle
// faster, not smaller. Retuning through this file is the only way to change a
// constant and still have the history that says whether it helped.
// hacking-strategy.md R7: was 6, a no-op for every target worth farming
// (their security floors run 7-28) — only binds on low-tier servers, where
// 1 buys ~13-16% on hack time and steal percentage. Cosmetic at current
// scale; tidied while touching config anyway.
let SECURITY_CAP = 1
let TARGET_MONEY_GOAL = 0.95
let MIN_TARGET_HOLD_MS = 60000
// Absolute security margin (not a fraction) tolerated before a working target
// is torn down for a weaken phase. Must exceed the security injected by one
// grow/hack cycle landing at once (~1.0 observed), or the plan flips every
// couple of ticks and no grow/hack thread ever survives to completion.
let WORK_SECURITY_MARGIN = 1.5
let RATE_DROP_FACTOR = 0.75
let LOOP_SLEEP_MS = 10000
let RATE_SAMPLE_COUNT = 5
let WEAKEN_STUCK_MS = 60000
let WEAKEN_STUCK_SECURITY_THRESHOLD = 0.05
let SKIP_STUCK_MS = 60000
// A target is considered "drained" once its money share averages below this
// AND is not trending upward. Averaged rather than "continuously below"
// because an over-leveled player can make grow() spike a near-empty server's
// money hugely for one tick before hack() drains it right back down — a
// single high sample shouldn't reset the whole detector.
//
// This MUST sit below the "empty" recovery tier (0.1): a target in recovery
// is by definition under that tier, so a higher threshold here would mark it
// drained ~90s into a recovery that legitimately takes far longer, then
// starve it of the grow threads it needs to ever climb back out.
let DEGRADED_MONEY_PCT = 0.05
let MONEY_PCT_SAMPLE_COUNT = 9
// A target only gets abandoned for a better one when it is itself producing
// nothing (still in the "empty" tier, so hack threads are off) AND the
// alternative scores this many times higher. Deliberately steep: switching
// throws away accumulated grow progress, so it must clear a wide bar rather
// than chase small differences and thrash.
// hacking-strategy.md R4 (2026-08-14): dropped 3 -> 1.3 (the doc's
// 1.25-1.3 range, safer end) *together* with the getTargetScore rewrite and
// the ramp-cost discount below, never before — a 3x bar was calibrated
// against a score that barely varied target-to-target (the old score never
// read serverGrowth), so it forbade real, large improvements the new score
// can actually see. The ramp discount already prices in the cost of
// switching, so 1.3 only needs to cover model error, not switching cost too.
let OPPORTUNITY_SWITCH_FACTOR = 1.3
// R8's production-ready integration is present but inert until its attested
// canary/production contracts deliberately set this numeric flag to 1.
let R8_SWITCH_VETO_ENABLED = 0
// How long a *productive* target is committed to before better options are
// even considered. Much longer than MIN_TARGET_HOLD_MS because leaving one
// throws away its accumulated grow progress and the replacement must be
// grown up from wherever it currently sits — so the move only pays off over
// a long horizon, and shouldn't be re-litigated every minute.
let MIN_TARGET_COMMIT_MS = 600000
// How long a drained target is deprioritized before it's eligible again —
// long enough to make real progress on other (harder) targets first.
let DEGRADED_SKIP_MS = 900000
// Fraction of the balance-point hack share (computeWorkWeights,
// mcp_logic.js) actually deployed at full readiness — see hacking-strategy.md
// R1. At the exact balance point log-money is a driftless random walk with
// no restoring force either way; running below it gives a positive drift
// that pins money at max, at a linear income cost. 0.5 is the doc's safe
// starting value (0.7 is explicitly speculative there) — raise it while
// watching avgMoneyPct in the status file hold near max over ~15 minutes.
let HACK_BALANCE_SAFETY = 0.5
// hostNeedsRedeploy's slack, per action type, before a desired-vs-running
// thread-count difference counts as a real mismatch worth killing and
// redeploying for: max(REDEPLOY_TOLERANCE_ABSOLUTE, want * REDEPLOY_TOLERANCE_RELATIVE).
// Absorbs the per-host Math.floor/Math.ceil rounding that
// computeDesiredAllocation's arithmetic already does, not a policy choice —
// see hacking-strategy.md R3. Speculative starting values; the failure mode
// of too-tight is redeploy churn (visible as plan_flip-adjacent noise in
// mcp_events.txt), of too-loose is the exact weakenBudgetNonNegative-style
// drift this replaced.
let REDEPLOY_TOLERANCE_ABSOLUTE = 2
let REDEPLOY_TOLERANCE_RELATIVE = 0.2
// GB kept off-limits on `home` before any of it counts as free for worker
// threads (hacking-strategy.md R7). home is ~128GB and, unlike every other
// worker host, is also where mcp.js/the HUD/the supervisor themselves run —
// under-reserving starves those and is a farm-stopping failure, not a
// throughput loss, so this gates getHostFreeRam's home case rather than
// being a soft preference.
let HOME_RAM_RESERVE = 32
// The horizon getTargetEffectiveScore's ramp-cost discount amortises a
// drained candidate's grow-up time against (hacking-strategy.md R4,
// 2026-08-14): effective = score * horizon/(horizon + rampSeconds). Shipped
// at 3600 per the doc — the bot runs for hours, so a target that takes 15-20
// minutes to ramp up should still win against a cheaper-but-worse one over
// that horizon, which a short horizon (e.g. MIN_TARGET_COMMIT_MS's 600s,
// which is what implicitly stood in for this before R4) would refuse to let
// it do.
let SCORE_HORIZON_SECONDS = 3600

// What the bot is farming for. "money" sizes hack/grow from the target's
// actual balance point (computeWorkWeights, mcp_logic.js — see
// hacking-strategy.md R1) — near-zero hack share on a drained target,
// ramping up toward the balanced share as it fills, because hack's take
// scales with *available* money and stealing from a near-empty target is
// close to free security cost for near-zero reward.
//
// "xp" exists because that reasoning doesn't apply to experience: the
// game's own hackExp(server, player) formula takes no money/percent
// argument at all — XP per completed action is independent of how much was
// actually stolen. So unlike money mode, there is no reason to avoid
// hacking a drained target for XP purposes, and no reason for the weighting
// to depend on moneyPct at all. XP mode uses a single flat split
// (XP_WEIGHT_HACK / XP_WEIGHT_GROW below) instead of the balance-point calc.
//
// Target SELECTION is unchanged in both modes — still scored by $/s. Making
// selection itself XP-aware is a larger, riskier change than reweighting
// hack/grow, and isn't happening until real per-action XP/sec numbers exist
// to justify a specific formula (see econ_probe.js) rather than a guess.
let OBJECTIVE = "money"

// Provisional XP-mode split — hack favoured because it has the shortest
// cycle time of the three actions, so more threads complete (and therefore
// grant XP) per second, all else equal. This is reasoned, not measured: it
// has not been checked against real exp/sec/thread numbers for grow or
// weaken, which econ_probe.js exists to gather. Expect these two numbers
// specifically to change once that data exists — that's why they're
// separate hot-reloadable config keys rather than a hardcoded table.
// Hack gives the best XP per GB-second. Keep a small grow share solely to
// prevent a target reaching exactly $0, where hacks only pay failure XP.
let XP_WEIGHT_HACK = 0.95
let XP_WEIGHT_GROW = 0.05
const ACTION_SCRIPTS = ["/scripts/grow.js", "/scripts/hack.js", "/scripts/weaken.js"]
const HACK_SEC_INCREASE = 0.002
const GROW_SEC_INCREASE = 0.004
const WEAKEN_SEC_DECREASE = 0.05
// Bitburner fixes weakenTime = 4x hackTime and growTime = 3.2x hackTime. A
// looping worker thread therefore completes (and re-applies its security
// effect) far more often than a weaken thread counteracts it, so raw
// per-call security deltas understate what maintenance actually costs:
// each hack thread needs 4x, each grow thread 4/3.2 = 1.25x more weaken than
// a naive one-shot comparison suggests.
const WEAKEN_PER_HACK_RATIO = 4
const WEAKEN_PER_GROW_RATIO = 1.25
// Bundled for computeDesiredAllocation/weakenThreadsToOffset (mcp_logic.js),
// which take these as data rather than reading mcp.js's module scope
// directly, so they stay pure and node --test-able.
const SECURITY_CONSTANTS = {
  hackSecIncrease: HACK_SEC_INCREASE,
  growSecIncrease: GROW_SEC_INCREASE,
  weakenSecDecrease: WEAKEN_SEC_DECREASE,
  weakenPerHackRatio: WEAKEN_PER_HACK_RATIO,
  weakenPerGrowRatio: WEAKEN_PER_GROW_RATIO,
}

const CONFIG_FILE = "mcp_config.json"

// The defaults, captured before anything can overwrite them, so a malformed or
// partial config falls back per-key rather than wholesale.
const CONFIG_DEFAULTS = {
  SECURITY_CAP,
  TARGET_MONEY_GOAL,
  MIN_TARGET_HOLD_MS,
  WORK_SECURITY_MARGIN,
  RATE_DROP_FACTOR,
  LOOP_SLEEP_MS,
  RATE_SAMPLE_COUNT,
  WEAKEN_STUCK_MS,
  WEAKEN_STUCK_SECURITY_THRESHOLD,
  SKIP_STUCK_MS,
  DEGRADED_MONEY_PCT,
  MONEY_PCT_SAMPLE_COUNT,
  OPPORTUNITY_SWITCH_FACTOR,
  R8_SWITCH_VETO_ENABLED,
  MIN_TARGET_COMMIT_MS,
  DEGRADED_SKIP_MS,
  HACK_BALANCE_SAFETY,
  XP_WEIGHT_HACK,
  XP_WEIGHT_GROW,
  REDEPLOY_TOLERANCE_ABSOLUTE,
  REDEPLOY_TOLERANCE_RELATIVE,
  HOME_RAM_RESERVE,
  SCORE_HORIZON_SECONDS,
}

// OBJECTIVE is handled separately from CONFIG_DEFAULTS: it's a string enum,
// not a number, so it needs its own validation rather than the numeric
// typeof check every other tunable goes through.
const OBJECTIVE_VALUES = ["money", "xp"]

// A manual live lever (set_objective.js), separate from mcp_config.json on
// purpose. mcp_config.json is the git-tracked, disk-authoritative source
// pushed one-way disk->game (CLAUDE.md's own sync model) — an in-game edit
// straight to it would work until the next disk resync, then silently
// revert with no signal, which is exactly the footgun a self-serve script
// shouldn't have. This file is never written from disk, only read here and
// written in-game by set_objective.js, so it survives resyncs of everything
// else. Empty/absent means "no override, use mcp_config.json's OBJECTIVE".
const OBJECTIVE_OVERRIDE_FILE = "mcp_objective_override.txt"
let objectiveOverrideActive = false

/**
 * Re-read tunables from mcp_config.json. Called at the top of every tick.
 *
 * Returns a diff of what changed, or null if nothing did — so a config_change
 * event records what was tuned and when, which was previously unrecoverable
 * from any log.
 *
 * Only numbers are accepted, and only keys that exist in CONFIG_DEFAULTS. A
 * corrupt file leaves the previous values in place rather than reverting to
 * defaults mid-run, because a half-saved file should not silently undo a
 * deliberate tune.
 */
function loadConfig(ns, state) {
  const raw = ns.read(CONFIG_FILE)
  const overrideRaw = ns.read(OBJECTIVE_OVERRIDE_FILE)
  if (raw === state.lastRaw && overrideRaw === state.lastOverrideRaw) return null
  state.lastRaw = raw
  state.lastOverrideRaw = overrideRaw

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

  let resolvedObjective = OBJECTIVE
  if (parsed.OBJECTIVE === undefined) {
    resolvedObjective = OBJECTIVE
  } else if (typeof parsed.OBJECTIVE === "string" && OBJECTIVE_VALUES.includes(parsed.OBJECTIVE)) {
    resolvedObjective = parsed.OBJECTIVE
  } else {
    rejected.push("OBJECTIVE")
  }

  // set_objective.js's override, applied last so it wins over
  // mcp_config.json's OBJECTIVE whenever it's set — see
  // OBJECTIVE_OVERRIDE_FILE's own comment for why this lives in a separate
  // file rather than being folded into mcp_config.json itself.
  const overrideTrimmed = overrideRaw.trim().toLowerCase()
  let resolvedObjectiveOverrideActive = false
  if (overrideTrimmed !== "") {
    if (OBJECTIVE_VALUES.includes(overrideTrimmed)) {
      resolvedObjective = overrideTrimmed
      resolvedObjectiveOverrideActive = true
    } else {
      rejected.push("OBJECTIVE_OVERRIDE")
    }
  }

  for (const key of Object.keys(parsed)) {
    if (!(key in CONFIG_DEFAULTS) && key !== "OBJECTIVE") rejected.push(key)
  }

  const changes = {}
  const current = {
    SECURITY_CAP,
    TARGET_MONEY_GOAL,
    MIN_TARGET_HOLD_MS,
    WORK_SECURITY_MARGIN,
    RATE_DROP_FACTOR,
    LOOP_SLEEP_MS,
    RATE_SAMPLE_COUNT,
    WEAKEN_STUCK_MS,
    WEAKEN_STUCK_SECURITY_THRESHOLD,
    SKIP_STUCK_MS,
    DEGRADED_MONEY_PCT,
    MONEY_PCT_SAMPLE_COUNT,
    OPPORTUNITY_SWITCH_FACTOR,
    R8_SWITCH_VETO_ENABLED,
    MIN_TARGET_COMMIT_MS,
    DEGRADED_SKIP_MS,
    HACK_BALANCE_SAFETY,
    XP_WEIGHT_HACK,
    XP_WEIGHT_GROW,
    REDEPLOY_TOLERANCE_ABSOLUTE,
    REDEPLOY_TOLERANCE_RELATIVE,
    HOME_RAM_RESERVE,
    SCORE_HORIZON_SECONDS,
  }
  for (const key of Object.keys(CONFIG_DEFAULTS)) {
    if (current[key] !== resolved[key]) changes[key] = { from: current[key], to: resolved[key] }
  }
  if (OBJECTIVE !== resolvedObjective) changes.OBJECTIVE = { from: OBJECTIVE, to: resolvedObjective }
  if (objectiveOverrideActive !== resolvedObjectiveOverrideActive) {
    changes.OBJECTIVE_OVERRIDE_ACTIVE = { from: objectiveOverrideActive, to: resolvedObjectiveOverrideActive }
  }

  SECURITY_CAP = resolved.SECURITY_CAP
  TARGET_MONEY_GOAL = resolved.TARGET_MONEY_GOAL
  MIN_TARGET_HOLD_MS = resolved.MIN_TARGET_HOLD_MS
  WORK_SECURITY_MARGIN = resolved.WORK_SECURITY_MARGIN
  RATE_DROP_FACTOR = resolved.RATE_DROP_FACTOR
  LOOP_SLEEP_MS = resolved.LOOP_SLEEP_MS
  RATE_SAMPLE_COUNT = resolved.RATE_SAMPLE_COUNT
  WEAKEN_STUCK_MS = resolved.WEAKEN_STUCK_MS
  WEAKEN_STUCK_SECURITY_THRESHOLD = resolved.WEAKEN_STUCK_SECURITY_THRESHOLD
  SKIP_STUCK_MS = resolved.SKIP_STUCK_MS
  DEGRADED_MONEY_PCT = resolved.DEGRADED_MONEY_PCT
  MONEY_PCT_SAMPLE_COUNT = resolved.MONEY_PCT_SAMPLE_COUNT
  OPPORTUNITY_SWITCH_FACTOR = resolved.OPPORTUNITY_SWITCH_FACTOR
  R8_SWITCH_VETO_ENABLED = resolved.R8_SWITCH_VETO_ENABLED
  MIN_TARGET_COMMIT_MS = resolved.MIN_TARGET_COMMIT_MS
  DEGRADED_SKIP_MS = resolved.DEGRADED_SKIP_MS
  HACK_BALANCE_SAFETY = resolved.HACK_BALANCE_SAFETY
  XP_WEIGHT_HACK = resolved.XP_WEIGHT_HACK
  XP_WEIGHT_GROW = resolved.XP_WEIGHT_GROW
  REDEPLOY_TOLERANCE_ABSOLUTE = resolved.REDEPLOY_TOLERANCE_ABSOLUTE
  REDEPLOY_TOLERANCE_RELATIVE = resolved.REDEPLOY_TOLERANCE_RELATIVE
  HOME_RAM_RESERVE = resolved.HOME_RAM_RESERVE
  SCORE_HORIZON_SECONDS = resolved.SCORE_HORIZON_SECONDS
  OBJECTIVE = resolvedObjective
  objectiveOverrideActive = resolvedObjectiveOverrideActive

  if (Object.keys(changes).length === 0 && rejected.length === 0) return null
  return { changes, rejected }
}

/**
 * Fingerprint of our own source, recorded in the status file so a reader can
 * tell which code produced it.
 *
 * The loop now edits code here, lets the sync watcher push it, and restarts
 * via a token write — nobody looks at the game in between. "Is the running
 * code the code on disk?" therefore gets asked on nearly every iteration and,
 * until this existed, was unanswerable. mcp_hud.js hashes mcp.js itself and
 * compares, so a version drift shows up as a verdict rather than as an hour
 * of confusion about why a fix "didn't work".
 *
 * djb2 rather than length: a retuned constant is exactly the same-size edit
 * that a length check would miss. ns.read costs 0GB.
 */
function hashSource(text) {
  let hash = 5381
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}

// Content is JSON-lines (one JSON object per line), but the extension is
// .txt, not .jsonl: Bitburner's ns.write only accepts a path ending in
// .txt/.json/.css or a script extension, and throws "File path should be a
// text file or script" otherwise. This is the exact same bug class as the
// .log lesson in CLAUDE.md, and it bit this file specifically: every write
// to mcp_events.jsonl threw from the moment this shipped, caught by the
// try/catch below and printed only to ns.print, which nobody was reading —
// the file never existed in the game at all, though the in-memory
// `recent` ring buffer kept working (it's populated before the write is
// attempted), which is why mcp_status.json's recentEvents looked fine the
// whole time and hid the problem.
const EVENT_FILE = "mcp_events.txt"
// Events are transitions only — roughly 40 in a long session, not 1353 — so
// the file stays small. Trimmed once at startup rather than rewritten per
// event, which bounds growth inside the save game while still letting the
// record survive the restarts that wipe every in-memory sample.
const EVENT_FILE_KEEP = 300
const STATUS_EVENT_COUNT = 20

/**
 * Transition log. The rule, which is the whole point of it:
 *
 *   An event records the value of every variable that appeared in the
 *   predicate that fired it — not the state afterward.
 *
 * A `target_drop` carrying `{moneyDegraded:false, rateDropped:true}` kills a
 * wrong theory on sight. The same event carrying only `{reason:"drained"}`
 * costs three restart cycles to disambiguate, because the reader has to infer
 * backwards from effect to cause. That inference step is where this project
 * repeatedly lost hours.
 */
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
  // Exposed rather than only ns.print'd, so the tick loop can route a
  // persistent write failure through the invariant system — a silent
  // ns.print is exactly how mcp_events.jsonl's invalid extension went
  // unnoticed from the moment it shipped.
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
        ns.print("mcp: failed to write event: " + e)
      }
      return event
    },
  }
  return log
}

// A violated invariant toasts once per name per run. The count keeps climbing
// in the status file, which is what the HUD and the out-of-game watcher read,
// so a repeat violation still raises an alarm without spamming the UI.
const INVARIANT_TOAST_MS = 8000

/**
 * Assert on the code's own intentions, never on game state.
 *
 * Game state is allowed to surprise us — a server can be richer or more
 * secure than expected and nothing is wrong. Our own bookkeeping is not
 * allowed to surprise us: if the weaken budget goes negative, or a host is
 * running more RAM than it has, the code's beliefs are wrong and every number
 * downstream is suspect.
 */
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
        ns.toast(`mcp invariant violated: ${name}`, "error", INVARIANT_TOAST_MS)
      }
      return false
    },
  }
}

/**
 * The per-tick invariant sweep. Each entry here corresponds to a bug that
 * actually happened and took multiple restart cycles to find. The predicates
 * themselves (what's checked and against what data) live in mcp_logic.js's
 * computeTickInvariantChecks, tested with `node --test`; this function is
 * just the thin ns/side-effect wiring that feeds it and applies the results
 * through `invariants.check` (toast + count + event, see makeInvariants).
 */
function checkTickInvariants(invariants, ctx) {
  const checks = computeTickInvariantChecks(
    {
      eventLogLastWriteError: ctx.events.lastWriteError,
      weakenBudgetRemaining: ctx.weakenBudgetRemaining,
      requiredWeaken: ctx.requiredWeaken,
      interval: ctx.interval,
      firstTick: ctx.firstTick,
      ramUtilization: ctx.ramUtilization,
      allocations: ctx.allocations,
      ramInfo: ctx.ramInfo,
    },
    { LOOP_SLEEP_MS }
  )
  for (const check of checks) {
    invariants.check(check.name, check.ok, check.data)
  }
}

/**
 * The single field list.
 *
 * The transition-log line derives from the status object, so a field added to
 * status cannot be invisible to the durable channel.  Per-tick `ns.print`
 * was deliberately removed: it was a 10-second tail-console write that
 * duplicated `mcp_status.json` and buried the transitions worth reading.
 */
function formatStatus(status) {
  const parts = [
    `mcp target=${status.target}`,
    `plan=${status.plan}${status.weightBucket ? "/" + status.weightBucket : ""}`,
    `held=${status.heldSeconds}s`,
    `tick=${status.tickSeconds.toFixed(1)}s`,
    `sec=${status.currentSecurity.toFixed(2)}`,
    `moneyPct=${status.moneyPct.toFixed(4)}`,
    `avgMoneyPct=${status.avgMoneyPct.toFixed(4)}`,
    `moneySamples=${status.moneyPctSampleCount}/${status.moneyPctSampleTarget}`,
    `needWeaken=${status.needWeaken}`,
    `maxWeaken=${status.maxWeaken}`,
    `ram=${(status.ramUtilization * 100).toFixed(0)}%`,
    `hacked=${formatMoney(status.hacked)}`,
    `rate=${formatMoney(status.rate)}/s`,
    `avg=${formatMoney(status.avgRate)}/s`,
    `income=${formatMoney(status.incomePerSec)}/s`,
    `exp=${status.expPerSec.toFixed(1)}/s`,
    `total=${formatMoney(status.totalHacked)}`,
    `workers=${status.workers.length}`,
    `hackTime=${status.hackTimeS.toFixed(1)}s`,
    `growTime=${status.growTimeS.toFixed(1)}s`,
    `weakenTime=${status.weakenTimeS.toFixed(1)}s`,
    `hackChance=${(status.hackChance * 100).toFixed(1)}%`,
    `playerMoney=${formatMoney(status.player.money)}`,
    `hackLvl=${status.player.skills.hacking}`,
    `run=${status.runId}`,
    `ver=${status.scriptVersion}`,
    `objective=${status.config ? status.config.OBJECTIVE : "?"}${status.objectiveOverrideActive ? "(override)" : ""}`,
  ]
  if (status.switchEval) {
    parts.push(
      `next=${status.switchEval.best || "-"}`,
      `nextRatio=${status.switchEval.ratio.toFixed(2)}`,
      `blockedBy=${status.switchEval.blockedBy || "none"}`
    )
  }
  const violations = Object.keys(status.invariantViolations || {})
  if (violations.length > 0) {
    parts.push(`violations=${JSON.stringify(status.invariantViolations)}`)
  }
  return parts.join(" ")
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
  for (const log of logs) {
    ns.disableLog(log)
  }
}

function scanNetwork(ns) {
  const queue = ["home"]
  const visited = new Set(queue)
  for (let i = 0; i < queue.length; i++) {
    const server = queue[i]
    for (const neighbor of ns.scan(server)) {
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

function getTargetExpectedIncome(ns, server) {
  if (!isHackableTarget(ns, server)) return 0
  const availMoney = ns.getServerMoneyAvailable(server)
  const hackAnalyze = ns.hackAnalyze(server)
  const hackChance = ns.hackAnalyzeChance(server)
  const hackTime = ns.getHackTime(server) / 1000
  return hackTime > 0 ? availMoney * hackAnalyze * hackChance / hackTime : 0
}

// Shared read-from-ns step for both getTargetScore and
// getTargetEffectiveScore below (hacking-strategy.md R4, 2026-08-14) — pulls
// the handful of 0-1GB ns.* calls the achievable-rate formula needs once, so
// getTargetEffectiveScore (which needs hackTime/growLogPerThread/maxMoney for
// its own ramp-seconds calc on top of the score) doesn't read them a second
// time. Returns null for anything computeTargetScore couldn't use anyway
// (unhackable, or p/growCycles unreadable at the current security), so both
// callers can short-circuit to a score of 0 the same way.
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

// Achievable-rate score (hacking-strategy.md R4, 2026-08-14) — see
// computeTargetScore's own doc comment in mcp_logic.js for the full
// derivation and for why poolThreads reuses getTotalWeakenCapacity's result
// as-is. Replaces the old "yield of one hack thread at full money" score,
// which never read serverGrowth and systematically misranked grow-limited
// targets (strategy doc §1.3/§2 R4).
function getTargetScore(ns, server, poolThreads) {
  const inputs = readTargetScoreInputs(ns, server)
  if (!inputs) return 0
  const { score } = computeTargetScore({
    ...inputs,
    poolThreads,
    growTimeRatio: WEAKEN_PER_HACK_RATIO / WEAKEN_PER_GROW_RATIO,
    ...SECURITY_CONSTANTS,
  })
  return score
}

// Potential income rate discounted by an explicit ramp cost (hacking-strategy.md
// R4, 2026-08-14) — replaces the old READINESS_FLOOR/max(moneyPct, 0.05)
// multiplier, which was dimensionally arbitrary, with the modelled wall-clock
// time to grow this target up to TARGET_MONEY_GOAL if the whole pool ran grow
// against it, amortised over SCORE_HORIZON_SECONDS. See
// computeTargetEffectiveScore's own doc comment in mcp_logic.js.
//
// Hacking level is deliberately not a sort key. isHackableTarget already
// excludes anything above the player's level, and the score divides by
// hackTime — so "easier servers cycle faster" is already priced in, and having
// it as a *primary* key let it override the money signal completely.
function getTargetEffectiveScore(ns, server, poolThreads) {
  const inputs = readTargetScoreInputs(ns, server)
  if (!inputs) return 0
  const growTimeRatio = WEAKEN_PER_HACK_RATIO / WEAKEN_PER_GROW_RATIO
  const { score } = computeTargetScore({ ...inputs, poolThreads, growTimeRatio, ...SECURITY_CONSTANTS })
  if (score <= 0) return 0
  const { effective } = computeTargetEffectiveScore({
    score,
    hackTime: inputs.hackTime,
    growLogPerThread: inputs.growLogPerThread,
    maxMoney: inputs.maxMoney,
    money: ns.getServerMoneyAvailable(server),
    targetMoneyGoal: TARGET_MONEY_GOAL,
    // Same pool-size value as poolThreads above — see computeTargetScore's
    // doc comment for why growRam===weakenRam makes this exact, not just a
    // convenient stand-in.
    growThreadsIfAllGrow: poolThreads,
    growTimeRatio,
    horizonSeconds: SCORE_HORIZON_SECONDS,
  })
  return effective
}

// XP mode needs its own selector: money potential is irrelevant to XP per
// thread-second and strongly favours slow, high-money targets. The score is
// intentionally based on the target's current chance/time, matching the
// scheduler's existing "can work it now" eligibility check.
function getTargetXpScore(ns, server) {
  if (!isHackableTarget(ns, server)) return 0
  return computeXpTargetScore({
    baseSecurity: ns.getServerBaseSecurityLevel(server),
    hackChance: ns.hackAnalyzeChance(server),
    hackTime: ns.getHackTime(server) / 1000,
  })
}

function getTargetSelectionScore(ns, server, poolThreads) {
  return OBJECTIVE === "xp" ? getTargetXpScore(ns, server) : getTargetEffectiveScore(ns, server, poolThreads)
}

// The optional R8 decision uses the game's formulas against a minimum-security
// copy of each server. It is called only after the existing scheduler has
// already selected a switch candidate, so it cannot become a parallel target
// selector. Any problem returns null and lets the established scheduler act.
function getFormulaMinimumSecurityScore(ns, target, poolThreads) {
  if (!target || !ns.fileExists("Formulas.exe", "home") || !ns.formulas || !ns.formulas.hacking) return null
  try {
    const server = ns.getServer(target)
    server.hackDifficulty = server.minDifficulty
    const player = ns.getPlayer()
    const formulas = ns.formulas.hacking
    const model = {
      targetMoneyGoal: TARGET_MONEY_GOAL,
      horizonSeconds: SCORE_HORIZON_SECONDS,
      growTimeRatio: WEAKEN_PER_HACK_RATIO / WEAKEN_PER_GROW_RATIO,
      hackSecIncrease: HACK_SEC_INCREASE,
      growSecIncrease: GROW_SEC_INCREASE,
      weakenSecDecrease: WEAKEN_SEC_DECREASE,
      weakenPerHackRatio: WEAKEN_PER_HACK_RATIO,
      weakenPerGrowRatio: WEAKEN_PER_GROW_RATIO,
      hackTimeSeconds: formulas.hackTime(server, player) / 1000,
      hackPercentPerThread: formulas.hackPercent(server, player),
      growLogPerThread: Math.log(formulas.growPercent(server, 1, player, 1)),
      maxMoney: server.moneyMax,
      hackChance: formulas.hackChance(server, player),
      poolThreads,
      money: server.moneyAvailable,
    }
    const audit = auditTargetModels({ target, currentModel: model, hypotheticalModel: model })
    return audit.eligible ? audit.models.hypothetical.effectiveScore : null
  } catch (_) {
    return null
  }
}

// SECURITY_EPSILON is imported from mcp_logic.js (used there by
// computeTickInvariantChecks' threadsFitHost check too, hence one shared
// definition): security readings accumulate floating-point noise over many
// hack/grow/weaken calls, so a target sitting exactly at its floor can read
// as e.g. 9.000000000000002 instead of 9. Ignore deltas below this before
// rounding up to a thread count, or such targets look like they perpetually
// need 1 more weaken thread and never move on to hacking/growing.

/**
 * @param {number} [margin] - Absolute security points allowed above the goal
 *   before flagging a weaken need. Stops the work/weaken plan from thrashing
 *   every loop when maintenance weaken slightly undershoots the continuous
 *   security increase from looping hack/grow threads.
 */
function getTargetWeakenThreads(ns, target, margin = 0) {
  const currentSecurity = ns.getServerSecurityLevel(target)
  const minSecurity = ns.getServerMinSecurityLevel(target)
  const goalSecurity = Math.max(minSecurity, SECURITY_CAP) + margin
  const delta = currentSecurity - goalSecurity
  return delta > SECURITY_EPSILON ? Math.ceil(delta / WEAKEN_SEC_DECREASE) : 0
}

// RAM currently held by *our own* action scripts is reclaimable — a target
// switch kills them all anyway. Excluding it (i.e. counting only free RAM)
// made capacity read 0 during any steady work phase, which then filtered
// every non-trivial candidate out of chooseTarget and pinned the bot to
// whatever servers happened to already sit at their security floor.
function getHostReclaimableRam(ns, host, ramInfoByScript) {
  let reclaimable = getHostFreeRam(ns, host)
  for (const { proc, normalized } of getRunningActions(ns, host)) {
    reclaimable += proc.threads * (ramInfoByScript[normalized] || 0)
  }
  return reclaimable
}

function getTotalWeakenCapacity(ns, workers) {
  const weakenRam = ns.getScriptRam("/scripts/weaken.js")
  const ramInfoByScript = {
    "/scripts/weaken.js": weakenRam,
    "/scripts/grow.js": ns.getScriptRam("/scripts/grow.js"),
    "/scripts/hack.js": ns.getScriptRam("/scripts/hack.js"),
  }
  let totalThreads = 0
  for (const server of workers) {
    const ram = getHostReclaimableRam(ns, server, ramInfoByScript)
    if (ram < weakenRam) continue
    totalThreads += Math.floor(ram / weakenRam)
  }
  return totalThreads
}

// Drop exclusion entries whose penalty window has elapsed. Kept separate so
// chooseTarget stays a pure read of the maps rather than mutating them.
function expireTargetExclusions(skippedTargets, drainedTargets) {
  const now = Date.now()
  for (const [server, ts] of skippedTargets) {
    if (now - ts >= SKIP_STUCK_MS) skippedTargets.delete(server)
  }
  for (const [server, ts] of drainedTargets) {
    if (now - ts >= DEGRADED_SKIP_MS) drainedTargets.delete(server)
  }
}

/**
 * Ranks viable targets by the active objective. Money mode uses income rate
 * discounted for readiness; XP mode uses XP per hack thread-second.
 * @param {Map<string, number>} skippedTargets
 * @param {Map<string, number>} drainedTargets
 * @returns {{server: string, score: number}[]} ranked best-first
 */
function rankTargets(ns, servers, maxWeaken, skippedTargets, drainedTargets, ignoreExclusions = false) {
  const candidates = []

  for (const server of servers) {
    if (!isHackableTarget(ns, server)) continue
    if (!ignoreExclusions && (skippedTargets.has(server) || drainedTargets.has(server))) continue

    const requiredWeaken = getTargetWeakenThreads(ns, server)
    if (requiredWeaken > maxWeaken) continue

    candidates.push({ server, score: getTargetSelectionScore(ns, server, maxWeaken) })
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates
}

// Exclusions are a *preference*, not a ban. When they rule out everything the
// bot has nothing to run, and the no-target branch then kills all action
// scripts every 60s — so it earns nothing, gains no XP, and cannot improve
// the very conditions that would make a target attractive again. Observed
// early-game: n00dles (the only weakenable target) got marked drained, and
// the bot sat dead until the 15-minute penalty expired, then repeated.
// Working a mediocre target always beats idling.
function chooseTarget(ns, servers, maxWeaken, skippedTargets, drainedTargets) {
  let ranked = rankTargets(ns, servers, maxWeaken, skippedTargets, drainedTargets)
  if (ranked.length === 0) {
    ranked = rankTargets(ns, servers, maxWeaken, skippedTargets, drainedTargets, true)
    if (ranked.length > 0) {
      ns.print(`mcp: all candidates excluded; falling back to ${ranked[0].server}`)
    }
  }
  return ranked.length > 0 ? ranked[0].server : null
}

// Retained for config compatibility and any diagnostics that calculate home
// headroom. Home is deliberately not a worker host: it is the control plane
// and should remain available for tools, contracts, and future RAM upgrades.
function getHostFreeRam(ns, host) {
  const usedRam = ns.getServerUsedRam(host)
  let freeRam = ns.getServerMaxRam(host) - usedRam
  if (host === "home") freeRam -= HOME_RAM_RESERVE
  return Math.max(0, freeRam)
}

function getWorkerHosts(ns, servers = null) {
  // Cloud servers are not guaranteed to appear in the normal network walk.
  // They have no money and are never target candidates, but are dedicated
  // rooted worker capacity and must be added to the allocation pool.
  const hosts = servers ? [...servers] : scanNetwork(ns)
  const cloudHosts = new Set(ns.cloud.getServerNames())
  for (const cloudHost of cloudHosts) {
    if (!hosts.includes(cloudHost)) hosts.push(cloudHost)
  }
  const workers = []
  for (const server of hosts) {
    if (server === "home") continue
    // Cloud servers are bought by us and accept work even though the normal
    // rooted-network predicate need not identify them in the Cloud API era.
    if (!cloudHosts.has(server) && !ns.hasRootAccess(server)) continue
    // Needs room for at least a couple of action threads to be worth the
    // scp/exec overhead; the largest action script is ~1.75GB.
    if (ns.getServerMaxRam(server) <= 2.5) continue
    workers.push(server)
  }
  return workers
}

function killActionScripts(ns, host) {
  // ns.ps() returns filenames without a leading slash (e.g. "scripts/weaken.js"),
  // but ACTION_SCRIPTS uses absolute paths (e.g. "/scripts/weaken.js") for scp/exec.
  // Normalize before comparing, or this never matches and never kills anything.
  for (const proc of ns.ps(host)) {
    const normalized = proc.filename.startsWith("/") ? proc.filename : "/" + proc.filename
    if (ACTION_SCRIPTS.includes(normalized)) {
      ns.kill(proc.pid, host)
    }
  }
}

function copyActionScripts(ns, host) {
  ns.scp(ACTION_SCRIPTS, host)
}

function formatMoney(value) {
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`
  return value.toFixed(0)
}

// computeWorkWeights (hacking-strategy.md R1, 2026-08-14) replaced
// WORK_WEIGHTS_BY_BUCKET/bucketForMoneyPct/getWorkWeightBucket entirely —
// see mcp_logic.js's own comment on the function for why the bucket ladder
// was structurally wrong rather than mistuned, and the doc's §1/§2.1 for the
// balance-point derivation this sizes hack/grow from instead. `p`
// (hackPercentPerThread) and `k` (growLogPerThread) are read live here, 1GB
// each, no Formulas.exe needed (§3.1) — they carry every player/BitNode
// multiplier the game itself applies, so the weights track reality without
// hardcoding any of them.
function buildPlan(ns, target, wasWorking) {
  const currentSecurity = ns.getServerSecurityLevel(target)
  const moneyPct = ns.getServerMoneyAvailable(target) / ns.getServerMaxMoney(target)
  // Only apply the extra margin when coming FROM a work phase, so a target
  // that's actually stuck above the cap still switches to weaken right away
  // — this just stops security drifting slightly over goal from instantly
  // killing grow/hack threads every loop.
  const requiredWeaken = getTargetWeakenThreads(ns, target, wasWorking ? WORK_SECURITY_MARGIN : 0)

  if (requiredWeaken > 0) {
    return { type: "weaken", currentSecurity, moneyPct }
  }

  // ns.growthAnalyze(target, 2) is numCycleForGrowth = log(2)/growthLog
  // (source, NetscriptFunctions.ts), so Math.LN2 divided by it recovers
  // growthLog exactly — see hacking-strategy.md §1 for the derivation this
  // formula (and computeWorkWeights's balance-point math) rests on.
  const hackPercentPerThread = ns.hackAnalyze(target)
  const growLogPerThread = Math.LN2 / ns.growthAnalyze(target, 2)
  const { weightBucket, weights, balancedHackShare, growPerHack } = computeWorkWeights({
    objective: OBJECTIVE,
    hackPercentPerThread,
    growLogPerThread,
    moneyPct,
    targetMoneyGoal: TARGET_MONEY_GOAL,
    safety: HACK_BALANCE_SAFETY,
    xpWeightHack: XP_WEIGHT_HACK,
    xpWeightGrow: XP_WEIGHT_GROW,
    ...SECURITY_CONSTANTS,
  })
  return {
    type: "work",
    currentSecurity,
    moneyPct,
    weightBucket,
    weights,
    // Added 2026-08-14 chasing why incomePerSec sat at 0 with 0 hack
    // threads network-wide despite moneyPct=1 shortly after R1 shipped —
    // turned out correct, not a bug (foodnstuff's growPerHack ~117 means a
    // ~0.8% balanced hack share, which floors to 0 threads on every host).
    // Kept as a standing field rather than reverted — cheap, and worth
    // watching per-target once R4 stops the bot parking on poor-fit ones.
    debugWorkWeights: { hackPercentPerThread, growLogPerThread, balancedHackShare, growPerHack },
  }
}

function getRunningActions(ns, host) {
  const running = []
  for (const proc of ns.ps(host)) {
    const normalized = proc.filename.startsWith("/") ? proc.filename : "/" + proc.filename
    if (ACTION_SCRIPTS.includes(normalized)) {
      running.push({ proc, normalized })
    }
  }
  return running
}

// hostNeedsRedeploy itself now lives in mcp_logic.js (imported above) so the
// action-duration fix from 2026-08-11 and the allocation-diff rewrite from
// R3 (2026-08-13) are both node --test-able — see that file's comment on
// the function for the full story. This helper translates mcp.js's
// `ns`-shaped running-process info into the plain data the pure function
// takes: which script, which target, how many threads, and how long (in
// seconds) the process has actually been running — the last of which is
// what lets a mismatch-only redeploy wait for an in-flight call to finish
// instead of cutting it short.
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

// allocateThreads (2026-08-13, R3; per-script redeploy 2026-08-14, R5): the
// per-host math that used to live here inline now lives in mcp_logic.js's
// computeDesiredAllocation, run network-wide as "pass 1" before this
// function is ever called (see the main loop) — desired is this host's
// already-computed row from that pass. This function is "pass 2": decide
// whether the host's running threads actually match desired closely enough
// (hostNeedsRedeploy, now an allocation-quantity diff rather than an
// action-type check — see that function's own comment for why the old
// version under- and over-fired), and if not, kill and re-exec only the
// script(s) whose desired count actually changed. weakenThreadsToOffset
// moved with pass 1 since its only callers did.
//
// R5's fix: a mismatch used to kill and re-exec all three action scripts,
// even when e.g. only `hack`'s count had drifted. Weaken has by far the
// longest cycle (4x hackTime), so every such redeploy opened a full
// weaken-cycle window during which hack/grow kept landing and fortifying
// security with nothing counteracting it — consistent with the observed
// security ratchet (see hacking-strategy.md R5). Now only scripts whose
// desired count actually differs from what's running get killed/re-exec'd,
// in the order weaken/grow/hack so weaken's long cycle starts earliest.
function allocateThreads(ns, host, target, plan, desired, tolerance, actionDurationsS) {
  /** @type {{script: string, threads: number}[]} */
  const actions = []
  const allocation = {
    host,
    maxRam: ns.getServerMaxRam(host),
    usedRam: 0,
    freeRam: 0,
    actions,
  }

  const running = getRunningActions(ns, host)
  const describedRunning = describeRunningActions(ns, running)
  const needsRedeploy = hostNeedsRedeploy({
    target,
    plan,
    running: describedRunning,
    desired,
    tolerance,
    actionDurationsS,
  })
  const missingLaunches = missingActionLaunchPlan(describedRunning, desired, getHostFreeRam(ns, host), {
    weaken: ns.getScriptRam("/scripts/weaken.js"),
    grow: ns.getScriptRam("/scripts/grow.js"),
    hack: ns.getScriptRam("/scripts/hack.js"),
  })
  if (!needsRedeploy) {
    // A still-young action must not block launching an entirely missing
    // complementary action. Keep the in-flight process intact, but use the
    // otherwise idle RAM for the newly desired script now.
    if (missingLaunches.length > 0) {
      if (host !== "home") copyActionScripts(ns, host)
      for (const { proc, normalized } of running) {
        const script = normalized.replace("/scripts/", "").replace(".js", "")
        allocation.actions.push({ script, threads: proc.threads })
      }
      for (const { script, threads } of missingLaunches) {
        if (ns.exec(`/scripts/${script}.js`, host, threads, target) !== 0) {
          allocation.actions.push({ script, threads })
        }
      }
      allocation.usedRam = ns.getServerUsedRam(host)
      allocation.freeRam = getHostFreeRam(ns, host)
      return allocation
    }
    allocation.usedRam = ns.getServerUsedRam(host)
    allocation.freeRam = getHostFreeRam(ns, host)
    for (const { proc, normalized } of running) {
      const script = normalized.replace("/scripts/", "").replace(".js", "")
      allocation.actions.push({ script, threads: proc.threads })
    }
    return allocation
  }

  // The scripts already live on every worker host except home (R7: home is
  // now a worker too, but it's where mcp.js itself runs, so scripts/ is
  // already there — scp-ing home to itself is pure overhead). Matches the
  // same guard share_deploy.js uses for the same reason.
  if (host !== "home") copyActionScripts(ns, host)

  const have = countRunningByScript(describedRunning)
  const runningByScript = {}
  for (const { proc, normalized } of running) {
    const script = normalized.replace("/scripts/", "").replace(".js", "")
    runningByScript[script] = proc
  }
  for (const script of ["weaken", "grow", "hack"]) {
    const want = desired[script] || 0
    if (want === have[script]) {
      if (want > 0) allocation.actions.push({ script, threads: want })
      continue
    }
    const proc = runningByScript[script]
    if (proc) ns.kill(proc.pid, host)
    if (want > 0 && ns.exec(`/scripts/${script}.js`, host, want, target) !== 0) {
      allocation.actions.push({ script, threads: want })
    }
  }

  // Read RAM back *after* exec so maxRam/usedRam/freeRam describe one
  // consistent moment and actually reconcile with the actions listed.
  allocation.usedRam = ns.getServerUsedRam(host)
  allocation.freeRam = getHostFreeRam(ns, host)
  return allocation
}

function getTargetOverride(ns) {
  for (const arg of ns.args) {
    if (typeof arg === "string" && arg.startsWith("target=")) {
      const value = arg.slice("target=".length)
      // "target=null" / "target=" are explicit ways to say "no override",
      // same as leaving the arg off entirely — not a literal hostname.
      if (value === "" || value.toLowerCase() === "null") {
        return null
      }
      return value
    }
  }
  return null
}

function cleanupOrphanedActionScripts(ns) {
  // Orphaned weaken/grow/hack threads from a previous mcp.js run (killed
  // without this loop ever getting a chance to redeploy them) hold RAM
  // forever otherwise — that starves getTotalWeakenCapacity() down to 0,
  // which then blocks every candidate in chooseTarget() and the bot can
  // never recover on its own. Sweep them all before doing anything else.
  let killedHosts = 0
  // Home was a worker historically. Sweep it explicitly even though it no
  // longer appears in getWorkerHosts(), so a restart releases old workers.
  if (getRunningActions(ns, "home").length > 0) {
    killActionScripts(ns, "home")
    killedHosts++
  }
  for (const host of getWorkerHosts(ns)) {
    const before = getRunningActions(ns, host).length
    if (before === 0) continue
    killActionScripts(ns, host)
    killedHosts++
  }
  if (killedHosts > 0) {
    ns.tprint(`mcp: cleaned up orphaned action scripts on ${killedHosts} host(s)`)
  }
}

const TARGET_STATE_FILE = "mcp_target_state.json"

// skippedTargets/drainedTargets used to be in-memory only, which meant every
// kill+restart forgot everything it had just learned about which targets
// were unweakenable or drained — a target correctly avoided minutes earlier
// was immediately fair game again. Persist them so that knowledge survives
// restarts, same way mcp_status.json does.
function loadTargetState(ns) {
  const skippedTargets = new Map()
  const drainedTargets = new Map()
  const raw = ns.read(TARGET_STATE_FILE)
  if (!raw) return { skippedTargets, drainedTargets }

  try {
    const parsed = JSON.parse(raw)
    const now = Date.now()
    const maxAge = Math.max(SKIP_STUCK_MS, DEGRADED_SKIP_MS)
    for (const [server, ts] of Object.entries(parsed.skipped || {})) {
      if (now - ts < maxAge) skippedTargets.set(server, ts)
    }
    for (const [server, ts] of Object.entries(parsed.drained || {})) {
      if (now - ts < maxAge) drainedTargets.set(server, ts)
    }
  } catch (e) {
    // Corrupt or unexpected content on disk — start fresh rather than crash.
  }
  return { skippedTargets, drainedTargets }
}

function saveTargetState(ns, skippedTargets, drainedTargets) {
  const state = {
    skipped: Object.fromEntries(skippedTargets),
    drained: Object.fromEntries(drainedTargets),
  }
  ns.write(TARGET_STATE_FILE, JSON.stringify(state), "w")
}

export async function main(ns) {
  disableLogs(ns)

  // Stamp every status write and every event with which run and which code
  // produced it. Without this, a log interleaving several revisions has to be
  // dated by the *shape of its trailing fields*, which is archaeology.
  const runId = Date.now().toString(36) + "-" + Math.floor(Math.random() * 1679616).toString(36)
  const scriptVersion = hashSource(ns.read("mcp.js"))
  const events = makeEventLog(ns, runId, scriptVersion)
  const invariants = makeInvariants(ns, events)
  // Holds the last raw config text so an unchanged file costs one 0GB read
  // per tick and nothing else.
  const configState = { lastRaw: null }
  ns.tprint(`mcp: run=${runId} ver=${scriptVersion}`)

  cleanupOrphanedActionScripts(ns)
  const targetOverride = getTargetOverride(ns)
  if (targetOverride) {
    if (!ns.serverExists(targetOverride)) {
      ns.tprint(`mcp: target override "${targetOverride}" is not a known host — check for typos. Exiting.`)
      return
    }
    // Without this, an unrooted / too-high-level / zero-money server sails
    // through: moneyPct becomes 0/0 = NaN, every bucket comparison is false,
    // and it falls through to "empty" and grows a server forever for nothing.
    if (!isHackableTarget(ns, targetOverride)) {
      ns.tprint(
        `mcp: target override "${targetOverride}" is not hackable (needs root, hacking level >= ${ns.getServerRequiredHackingLevel(targetOverride)}, and non-zero max money). Exiting.`
      )
      return
    }
    ns.tprint(`mcp: target override active -> ${targetOverride} (automatic target selection disabled)`)
  }
  let currentTarget = targetOverride
  let currentTargetMoney = targetOverride ? ns.getServerMoneyAvailable(targetOverride) : 0
  let lastSwitchTime = 0
  let totalHacked = 0
  let securityProgressTime = 0
  let bestSecuritySeen = Infinity
  let lastTickTime = Date.now()
  let tickIndex = 0
  const moneyPctSamples = []
  const rateSamples = []
  const { skippedTargets, drainedTargets } = loadTargetState(ns)
  if (skippedTargets.size > 0 || drainedTargets.size > 0) {
    ns.tprint(`mcp: restored target state (skipped=${skippedTargets.size} drained=${drainedTargets.size})`)
  }
  let lastAvgRate = null
  let lastPlanType = null
  let lastWeightBucket = null
  let lastLogSignature = null

  events.emit("startup", {
    targetOverride: targetOverride || null,
    restoredSkipped: skippedTargets.size,
    restoredDrained: drainedTargets.size,
    hackingLevel: ns.getHackingLevel(),
  })

  while (true) {
    const configUpdate = loadConfig(ns, configState)
    if (configUpdate) {
      if (configUpdate.error) {
        ns.print(`mcp: ${CONFIG_FILE} is not valid JSON, keeping current values (${configUpdate.error})`)
        invariants.check("configParses", false, { error: configUpdate.error })
      } else {
        ns.tprint(`mcp: config updated ${JSON.stringify(configUpdate.changes)}`)
        events.emit("config_change", configUpdate)
      }
    }
    // The one cross-tunable constraint worth enforcing: a drain threshold at
    // or above the "empty" recovery tier marks a target drained partway into
    // a recovery that is going exactly as intended, then starves it of the
    // grow threads it needs to climb out.
    invariants.check("drainBelowEmptyTier", DEGRADED_MONEY_PCT < 0.1, {
      DEGRADED_MONEY_PCT,
      emptyTier: 0.1,
    })

    const servers = scanNetwork(ns)
    const workers = getWorkerHosts(ns, servers)
    const maxWeaken = getTotalWeakenCapacity(ns, workers)
    expireTargetExclusions(skippedTargets, drainedTargets)

    // Filled by the opportunity-switch predicate below and surfaced in the
    // status file. Null when there is no current target to compare against.
    let switchEval = null
    let formulaSwitchVeto = null

    if (targetOverride) {
      // Automatic selection/switching disabled — just keep working the
      // pinned target regardless of score, hold time, or stuck detection.
    } else if (currentTarget) {
      // Must use the same margin buildPlan will use, or security sitting
      // healthily *inside* the tolerated band still reads as "needs weaken"
      // here and the stuck timer below evicts a target that is working fine.
      const currentRequiredWeaken = getTargetWeakenThreads(
        ns,
        currentTarget,
        lastPlanType === "work" ? WORK_SECURITY_MARGIN : 0
      )
      // Note: NOT gated on canWeakenTarget here — a momentary RAM crunch
      // (e.g. most network capacity briefly tied up in an already-adopted
      // target's own grow allocation) shouldn't instantly evict it with zero
      // grace period. The stuck branch below already catches "can't actually
      // make progress" within WEAKEN_STUCK_MS, which is the same underlying
      // problem with a sane grace window instead of none.
      if (!isHackableTarget(ns, currentTarget)) {
        events.emit("target_drop", {
          target: currentTarget,
          reason: "unhackable",
          hasRoot: ns.hasRootAccess(currentTarget),
          requiredLevel: ns.getServerRequiredHackingLevel(currentTarget),
          hackingLevel: ns.getHackingLevel(),
          maxMoney: ns.getServerMaxMoney(currentTarget),
        })
        skippedTargets.set(currentTarget, Date.now())
        currentTarget = null
        securityProgressTime = 0
        bestSecuritySeen = Infinity
        lastPlanType = null
        lastWeightBucket = null
        moneyPctSamples.length = 0
      } else {
        // Measure "time since security last actually improved" rather than
        // "time since needWeaken became nonzero". The old framing reset its
        // timer every time needWeaken touched 0, so a target oscillating
        // weaken<->work never accumulated the full window — the detector was
        // disarmed in exactly the thrashing case it exists to catch.
        const currentSecurity = ns.getServerSecurityLevel(currentTarget)
        // WEAKEN_STUCK_MS is a floor, not the actual patience window. A
        // weaken call has to COMPLETE before it can show progress, and
        // weakenTime scales with target difficulty — omega-net sat at an
        // identical sec/need reading across three consecutive 60s windows
        // in the terminal log because its weakenTime exceeded 60s, so the
        // very first completion hadn't happened yet each time the fixed
        // window expired. ×2 leaves room for one full cycle plus slack
        // against tick-boundary timing, rather than exactly one cycle with
        // no margin.
        const stuckWindowMs = Math.max(WEAKEN_STUCK_MS, ns.getWeakenTime(currentTarget) * 2)
        const stuckEval = evaluateStuckTarget({
          currentSecurity,
          bestSecuritySeen,
          securityProgressTime,
          requiredWeaken: currentRequiredWeaken,
          now: Date.now(),
          stuckWindowMs,
          progressThreshold: WEAKEN_STUCK_SECURITY_THRESHOLD,
        })
        securityProgressTime = stuckEval.securityProgressTime
        bestSecuritySeen = stuckEval.bestSecuritySeen
        if (stuckEval.stuck) {
          ns.tprint(
            `mcp: target ${currentTarget} not weakening (sec=${currentSecurity.toFixed(2)} best=${bestSecuritySeen.toFixed(2)} need=${currentRequiredWeaken} window=${(stuckWindowMs / 1000).toFixed(0)}s); switching target`
          )
          events.emit("target_drop", {
            target: currentTarget,
            reason: "stuck",
            currentSecurity,
            bestSecuritySeen,
            progressThreshold: WEAKEN_STUCK_SECURITY_THRESHOLD,
            stalledMs: stuckEval.stalledMs,
            stuckAfterMs: stuckWindowMs,
            weakenTimeMs: ns.getWeakenTime(currentTarget),
            requiredWeaken: currentRequiredWeaken,
            maxWeaken,
          })
          skippedTargets.set(currentTarget, Date.now())
          currentTarget = null
          securityProgressTime = 0
          bestSecuritySeen = Infinity
          lastPlanType = null
          lastWeightBucket = null
          moneyPctSamples.length = 0
        }
      }

      // Degradation check — must run (and mark drainedTargets) BEFORE
      // chooseTarget below, or chooseTarget still doesn't know this target
      // is drained yet and just hands it straight back as the "candidate",
      // so the switch never actually happens.
      if (currentTarget) {
        const currentMoneyPct = ns.getServerMoneyAvailable(currentTarget) / ns.getServerMaxMoney(currentTarget)
        const heldLongEnough = Date.now() - lastSwitchTime >= MIN_TARGET_HOLD_MS

        // One spurious low sample used to be enough to trigger a 15-minute
        // penalty, and the raw signal alternates between 0 and a big number
        // tick-to-tick, so require the whole trailing window to be depressed.
        const rateDropped =
          lastAvgRate !== null &&
          rateSamples.length === RATE_SAMPLE_COUNT &&
          rateSamples.every((sample) => sample < lastAvgRate * RATE_DROP_FACTOR)

        moneyPctSamples.push(currentMoneyPct)
        if (moneyPctSamples.length > MONEY_PCT_SAMPLE_COUNT) moneyPctSamples.shift()
        // "Low" alone isn't drained — a target mid-recovery is legitimately
        // low but climbing, and abandoning it there strands it at ~0 with no
        // grow threads for the whole skip window. Requires an actual
        // *decline*, not merely absence of improvement — growTime scales
        // inversely with hacking level, so early on a single grow can take
        // longer than the whole 90s sample window: the earlier `!improving`
        // test read "too slow to see yet" as "dead" and drained a perfectly
        // good target on a level-1 character.
        //
        // XP mode's fixed hack:0.95/grow:0.05 split (see buildPlan) drains
        // every target's money toward zero by design and never lets it
        // recover — moneyDegraded would fire on essentially every target in
        // an endless chain, defeating XP mode's point of sitting still and
        // grinding hack XP. Money-based eviction only makes sense when the
        // objective is money; rateDropped (a real stall) still applies. See
        // mcp_logic.js's evaluateMoneyDegradation for the pure predicate and
        // its regression test — this exact OBJECTIVE gate is what commit
        // 81814d6 fixed after three restart cycles of live diagnosis.
        const { avgMoneyPct, windowFull, declining, moneyDegraded } = evaluateMoneyDegradation({
          objective: OBJECTIVE,
          moneyPctSamples,
          sampleTarget: MONEY_PCT_SAMPLE_COUNT,
          degradedThreshold: DEGRADED_MONEY_PCT,
        })

        if (heldLongEnough && (rateDropped || moneyDegraded)) {
          // Only give up if there is somewhere else to go. Draining the sole
          // viable target strands the bot with nothing to run, which stops
          // the grow that would have recovered it — the penalty outlives the
          // problem it was meant to solve.
          const alternatives = rankTargets(ns, servers, maxWeaken, skippedTargets, drainedTargets).filter(
            (c) => c.server !== currentTarget
          )
          // Every value in the predicate that fired this, so a wrong theory
          // dies on reading rather than three restarts later.
          const predicate = {
            target: currentTarget,
            avgMoneyPct,
            moneyPctSamples: moneyPctSamples.slice(),
            sampleCount: moneyPctSamples.length,
            sampleTarget: MONEY_PCT_SAMPLE_COUNT,
            windowFull,
            declining,
            moneyDegraded,
            degradedThreshold: DEGRADED_MONEY_PCT,
            rateDropped,
            rateSamples: rateSamples.slice(),
            lastAvgRate,
            rateDropFactor: RATE_DROP_FACTOR,
            heldMs: Date.now() - lastSwitchTime,
            alternatives: alternatives.length,
          }
          if (alternatives.length === 0) {
            ns.print(
              `mcp: ${currentTarget} looks degraded (avgMoneyPct=${avgMoneyPct.toFixed(4)}) but is the only viable target; holding`
            )
            events.emit("degraded_held", predicate)
            moneyPctSamples.length = 0
          } else {
            ns.tprint(
              `mcp: target ${currentTarget} yield degraded (avgMoneyPct=${avgMoneyPct.toFixed(4)} declining=${declining} rateDropped=${rateDropped}); moving on`
            )
            events.emit("target_drop", Object.assign({ reason: "drained" }, predicate))
            drainedTargets.set(currentTarget, Date.now())
            currentTarget = null
            securityProgressTime = 0
            bestSecuritySeen = Infinity
            lastPlanType = null
            lastWeightBucket = null
            moneyPctSamples.length = 0
          }
        }
      }

      // Opportunity switch. Adoption alone only happens when currentTarget is
      // null, and BOTH abandonment paths (degraded, stuck) assume a target
      // eventually runs dry. Now that grow keeps pace with hack, a target can
      // be farmed sustainably forever — it never degrades, never empties, and
      // without this the bot would happily farm the smallest server on the
      // network indefinitely while far richer ones sit untouched.
      //
      // Two regimes, because the fair comparison differs:
      //   - current target producing nothing (moneyPct below the same 0.1
      //     floor drainBelowEmptyTier enforces DEGRADED_MONEY_PCT stays under
      //     — formerly the "empty" bucket boundary, now just an inline
      //     threshold since the bucket ladder itself is gone (R1)): compare
      //     readiness-discounted scores, and move quickly. Escaping a dud is
      //     urgent.
      //   - current target productive: both it and the candidate would sit at
      //     their own equilibrium, so compare raw potential instead — current
      //     money says nothing about which is the better long-run farm. Held
      //     much longer first, since switching discards grow progress and the
      //     replacement has to be grown up from wherever it sits.
      if (currentTarget) {
        const heldMs = Date.now() - lastSwitchTime
        const currentMoneyPct = ns.getServerMoneyAvailable(currentTarget) / ns.getServerMaxMoney(currentTarget)
        const idle = currentMoneyPct < 0.1
        const holdMs = idle ? MIN_TARGET_HOLD_MS : MIN_TARGET_COMMIT_MS

        // Evaluate every tick, act only when committed. Previously the whole
        // comparison was skipped while the hold timer ran, so "why is it still
        // on this target?" had no recorded answer — and the two possible
        // answers (losing on score / not held long enough) call for completely
        // different responses. Recording both sides of the predicate is the
        // rule from the process audit; the extra ranking pass is cheap next to
        // the one chooseTarget already does each tick.
        const ranked = rankTargets(ns, servers, maxWeaken, skippedTargets, drainedTargets)
        // maxWeaken (this tick's already-computed network-wide capacity) is
        // captured by closure as poolThreads — see getTargetScore/
        // getTargetEffectiveScore's own comments for why reusing it costs
        // nothing extra.
        const measure = OBJECTIVE === "xp"
          ? (server) => getTargetXpScore(ns, server)
          : idle
            ? (server) => getTargetEffectiveScore(ns, server, maxWeaken)
            : (server) => getTargetScore(ns, server, maxWeaken)
        const candidates = ranked.map(({ server }) => ({ server, score: measure(server) }))
        const currentScore = measure(currentTarget)

        // The comparison itself — best-of, ratio, outbid, blockedBy — is a
        // pure function of the scores above; see mcp_logic.js.
        switchEval = evaluateOpportunitySwitch({
          idle,
          candidates,
          currentTarget,
          currentScore,
          heldMs,
          holdMs,
          factor: OPPORTUNITY_SWITCH_FACTOR,
        })

        if (switchEval.committed && switchEval.outbid) {
          const formulaEnabled = R8_SWITCH_VETO_ENABLED > 0
          const formulaCurrentScore = formulaEnabled ? getFormulaMinimumSecurityScore(ns, currentTarget, maxWeaken) : NaN
          const formulaCandidateScore = formulaEnabled ? getFormulaMinimumSecurityScore(ns, switchEval.best, maxWeaken) : NaN
          formulaSwitchVeto = evaluateFormulaSwitchVeto({
            enabled: formulaEnabled,
            currentTarget,
            candidateTarget: switchEval.best,
            currentScore: formulaCurrentScore,
            candidateScore: formulaCandidateScore,
          })
          if (formulaSwitchVeto.enabled) events.emit("r8_switch_veto_eval", formulaSwitchVeto)
          if (formulaSwitchVeto.veto) {
            events.emit("r8_switch_veto", formulaSwitchVeto)
            ns.tprint(`mcp: R8 retained ${currentTarget}; ${switchEval.best} formulas ratio ${formulaSwitchVeto.ratio.toFixed(2)} is below ${formulaSwitchVeto.threshold}`)
          } else {
          ns.tprint(
            `mcp: ${switchEval.best} (${formatMoney(switchEval.bestScore)}/s) outperforms ${idle ? "idle" : "current"} ${currentTarget} (${formatMoney(currentScore)}/s) by ${switchEval.ratio.toFixed(1)}x after ${switchEval.heldSeconds}s; switching`
          )
          events.emit("target_drop", Object.assign({ target: currentTarget, reason: "outbid" }, switchEval))
          currentTarget = null
          securityProgressTime = 0
          bestSecuritySeen = Infinity
          lastPlanType = null
          lastWeightBucket = null
          moneyPctSamples.length = 0
          }
        }
      }
    }

    const candidateTarget = chooseTarget(ns, servers, maxWeaken, skippedTargets, drainedTargets)
    const candidateExpectedIncome = candidateTarget ? getTargetExpectedIncome(ns, candidateTarget) : 0
    const candidateScore = candidateTarget ? getTargetSelectionScore(ns, candidateTarget, maxWeaken) : 0

    if (!targetOverride && !currentTarget && candidateTarget) {
      const requiredWeaken = getTargetWeakenThreads(ns, candidateTarget)
      currentTarget = candidateTarget
      currentTargetMoney = ns.getServerMoneyAvailable(currentTarget)
      lastSwitchTime = Date.now()
      securityProgressTime = 0
      bestSecuritySeen = Infinity
      lastPlanType = null
      lastWeightBucket = null
      moneyPctSamples.length = 0
      rateSamples.length = 0
      lastAvgRate = null
      ns.tprint(`mcp: switching target to ${currentTarget} expectedIncome=${formatMoney(candidateExpectedIncome)}/s score=${formatMoney(candidateScore)}/s needWeaken=${requiredWeaken} availWeaken=${maxWeaken}`)
      events.emit("target_adopt", {
        target: currentTarget,
        expectedIncome: candidateExpectedIncome,
        score: candidateScore,
        requiredWeaken,
        maxWeaken,
        moneyPct: ns.getServerMoneyAvailable(currentTarget) / ns.getServerMaxMoney(currentTarget),
        security: ns.getServerSecurityLevel(currentTarget),
        minSecurity: ns.getServerMinSecurityLevel(currentTarget),
        skipped: skippedTargets.size,
        drained: drainedTargets.size,
      })
    }

    if (!currentTarget) {
      let hackableCount = 0
      let minRequiredWeaken = Infinity
      for (const server of servers) {
        if (!isHackableTarget(ns, server)) continue
        hackableCount++
        const requiredWeaken = getTargetWeakenThreads(ns, server)
        if (requiredWeaken < minRequiredWeaken) minRequiredWeaken = requiredWeaken
      }
      ns.tprint(
        `mcp: no hackable target found (servers=${servers.length} hackable=${hackableCount} minRequiredWeaken=${minRequiredWeaken === Infinity ? "n/a" : minRequiredWeaken} maxWeaken=${maxWeaken} skipped=${skippedTargets.size} drained=${drainedTargets.size})`
      )
      events.emit("stall", {
        reason: "no_target",
        servers: servers.length,
        hackable: hackableCount,
        minRequiredWeaken: minRequiredWeaken === Infinity ? null : minRequiredWeaken,
        maxWeaken,
        workers: workers.length,
        skipped: skippedTargets.size,
        drained: drainedTargets.size,
        hackingLevel: ns.getHackingLevel(),
      })
      // Release the network before idling. Leaving orphaned threads running
      // keeps every host saturated, which keeps weaken capacity at zero,
      // which keeps every candidate inadmissible — a stall with no exit.
      for (const host of workers) {
        killActionScripts(ns, host)
      }
      await ns.sleep(60000)
      continue
    }

    const previousPlanType = lastPlanType
    const previousWeightBucket = lastWeightBucket
    const plan = buildPlan(ns, currentTarget, lastPlanType === "work")
    lastPlanType = plan.type
    if (plan.type === "work") lastWeightBucket = plan.weightBucket

    // Plan oscillation was previously noticed by eyeballing a wall of
    // per-tick lines. As discrete events it is countable, and the hysteresis
    // inputs travel with each flip so a thrash can be diagnosed from the
    // record rather than reproduced.
    if (previousPlanType !== null && previousPlanType !== plan.type) {
      events.emit("plan_flip", {
        target: currentTarget,
        from: previousPlanType,
        to: plan.type,
        security: plan.currentSecurity,
        securityCap: SECURITY_CAP,
        workMargin: WORK_SECURITY_MARGIN,
        moneyPct: plan.moneyPct,
      })
    }
    // Replaces the old 5-value bucket_change event (R1, 2026-08-14) — same
    // "did the regime change" purpose, now over computeWorkWeights's 3-value
    // weightBucket ("xp"/"ramp"/"harvest") instead of the deleted bucket
    // ladder's 5 tiers. Renamed rather than reused so a reader scanning
    // mcp_events.txt for old-style bucket_change lines from before this
    // shipped doesn't mistake them for the new shape.
    if (plan.type === "work" && previousWeightBucket !== null && previousWeightBucket !== plan.weightBucket) {
      events.emit("weight_regime_change", {
        target: currentTarget,
        from: previousWeightBucket,
        to: plan.weightBucket,
        moneyPct: plan.moneyPct,
        moneyGoal: TARGET_MONEY_GOAL,
      })
    }
    const hackRam = ns.getScriptRam("/scripts/hack.js")
    const growRam = ns.getScriptRam("/scripts/grow.js")
    const weakenRam = ns.getScriptRam("/scripts/weaken.js")
    const minRam = Math.min(hackRam, growRam, weakenRam)
    const ramInfo = { hackRam, growRam, weakenRam, minRam }

    // Computed here (rather than down with the rest of the status fields)
    // because allocateThreads/hostNeedsRedeploy need them this tick, to
    // decide whether a mismatch-only redeploy should wait for an in-flight
    // call to finish — see hostNeedsRedeploy's comment in mcp_logic.js.
    const hackTimeS = ns.getHackTime(currentTarget) / 1000
    const growTimeS = ns.getGrowTime(currentTarget) / 1000
    const weakenTimeS = ns.getWeakenTime(currentTarget) / 1000
    const actionDurationsS = { hack: hackTimeS, grow: growTimeS, weaken: weakenTimeS }

    // Pass 1 (R3, 2026-08-13): compute every host's desired allocation
    // network-wide, up front, from reclaimable RAM — see
    // computeDesiredAllocation's own comment in mcp_logic.js for why this
    // has to run for every host rather than only ones already flagged for
    // redeploy. requiredWeaken is read fresh here (no margin) and reused
    // below for status/invariants rather than recomputed.
    const requiredWeaken = getTargetWeakenThreads(ns, currentTarget)
    const ramInfoByScript = {
      "/scripts/weaken.js": weakenRam,
      "/scripts/grow.js": growRam,
      "/scripts/hack.js": hackRam,
    }
    const hostReclaimable = workers.map((host) => ({
      host,
      reclaimableRam: getHostReclaimableRam(ns, host, ramInfoByScript),
    }))
    // weakenBudgetRemaining is what weakenBudgetNonNegative now asserts on:
    // pass 1's own primary-draw arithmetic never hands out more than the
    // budget it was drawn from (see computeDesiredAllocation's own comment
    // for why the grow-security-offset addition is deliberately excluded).
    // Under the old per-host-consumption design this could go negative from
    // already-running threads sized for a stale, higher security reading —
    // structurally impossible now, so this is a regression guard on pass
    // 1's own math, not a runtime accounting bug. Kept per
    // hacking-strategy.md R3's own instruction not to delete the invariant.
    const { allocations: desiredByHost, weakenBudgetRemaining } = computeDesiredAllocation({
      hosts: hostReclaimable,
      plan,
      weakenBudget: plan.type === "weaken" ? requiredWeaken : 0,
      ramInfo,
      securityConstants: SECURITY_CONSTANTS,
      // hacking-strategy.md R7: the weaken-phase leftover-grow branch's
      // security reserve, sized from the game's own clamped formula
      // (min(threads, maxThreadsNeeded), source NetscriptFunctions.ts)
      // instead of the linear growThreads*growSecIncrease estimate, so the
      // reserve stops growing once extra grow threads can't add more growth
      // (and therefore no more security) near moneyMax. cores=1 matches the
      // doc's exact call — mcp.js doesn't currently track per-host cores.
      growSecurityIncreaseForThreads: (growThreads) => ns.growthAnalyzeSecurity(growThreads, currentTarget, 1),
    })

    // Pass 2: per host, diff desired against what's actually running and
    // redeploy only if they disagree beyond tolerance.
    const redeployTolerance = { absolute: REDEPLOY_TOLERANCE_ABSOLUTE, relative: REDEPLOY_TOLERANCE_RELATIVE }
    const allocations = []
    for (const { host, hack, grow, weaken } of desiredByHost) {
      allocations.push(
        allocateThreads(ns, host, currentTarget, plan, { hack, grow, weaken }, redeployTolerance, actionDurationsS)
      )
    }

    const currentMoney = ns.getServerMoneyAvailable(currentTarget)
    const hacked = Math.max(0, currentTargetMoney - currentMoney)
    // Real elapsed time, not the nominal sleep: browser tab throttling
    // routinely stretches a "10s" tick to 70-380s, which would overstate the
    // rate several-fold and trip the degradation detector on an artifact.
    const now = Date.now()
    const interval = Math.max(0.001, (now - lastTickTime) / 1000)
    lastTickTime = now
    const rate = hacked / interval
    totalHacked += hacked
    currentTargetMoney = currentMoney

    rateSamples.push(rate)
    if (rateSamples.length > RATE_SAMPLE_COUNT) rateSamples.shift()
    const avgRate = rateSamples.reduce((sum, value) => sum + value, 0) / rateSamples.length
    const heldSeconds = Math.max(0, Math.floor((Date.now() - lastSwitchTime) / 1000))
    const avgMoneyPct =
      moneyPctSamples.length > 0
        ? moneyPctSamples.reduce((sum, value) => sum + value, 0) / moneyPctSamples.length
        : plan.moneyPct
    // hackTimeS/growTimeS/weakenTimeS/requiredWeaken were already computed
    // earlier this tick (actionDurationsS, used by allocateThreads/
    // hostNeedsRedeploy; requiredWeaken by computeDesiredAllocation) —
    // reused here rather than re-read, since currentTarget hasn't changed.
    const hackChance = ns.hackAnalyzeChance(currentTarget)

    // Deployed action RAM over total worker RAM. A single number that made an
    // audit-length finding (the network sitting 93% idle during weaken phases)
    // into a glance. Read from the allocations, which re-read RAM after exec,
    // so it describes one consistent moment.
    let poolRam = 0
    let poolUsed = 0
    for (const allocation of allocations) {
      poolRam += allocation.maxRam || 0
      poolUsed += allocation.usedRam || 0
    }
    const ramUtilization = poolRam > 0 ? poolUsed / poolRam : 0

    // Ground truth, rather than the money-decrease proxy `rate` computes.
    // getTotalScriptIncome()[0] is $/s across all running scripts;
    // getTotalScriptExpGain() is the XP rate, which matters because after an
    // augmentation XP — not money — is the binding constraint.
    const incomePair = ns.getTotalScriptIncome()
    const incomePerSec = Array.isArray(incomePair) ? incomePair[0] : incomePair
    const expPerSec = ns.getTotalScriptExpGain()

    checkTickInvariants(invariants, {
      events,
      interval,
      ramUtilization,
      weakenBudgetRemaining,
      requiredWeaken,
      allocations,
      ramInfo,
      firstTick: tickIndex === 0,
    })
    tickIndex += 1

    // Build the status object first, then derive every rendering from it.
    const player = ns.getPlayer()
    // Cloud hosts are not part of target discovery. Surface their raw
    // properties separately so a failed allocation can distinguish an
    // ownership/RAM problem from an MCP scheduling problem.
    const cloudWorkers = ns.cloud.getServerNames().map((host) => ({
      host,
      rooted: ns.hasRootAccess(host),
      maxRam: ns.getServerMaxRam(host),
      usedRam: ns.getServerUsedRam(host),
    }))
    const status = {
      ts: Date.now(),
      runId: runId,
      scriptVersion: scriptVersion,
      player: {
        money: player.money,
        hp: player.hp,
        skills: player.skills,
        // R1's one real open unknown (hacking-strategy.md §1.2/§4 item 1):
        // every $/s figure in that doc's modelled network table assumes this
        // is 1.0, and scales roughly linearly with it. Surfaced here so it
        // can finally be read off a live status file instead of assumed.
        hackingGrowMult: player.mults.hacking_grow,
      },
      // Added 2026-08-14, answering Ken's "what's the benefit of buying more
      // home cores" question: getCoreBonus (1 + (cores-1)/16, source
      // ServerHelpers.ts) applies to grow()/weaken()/share() on whichever
      // host actually runs the call, not the target — so this only matters
      // for the fraction of the pool's grow/weaken threads that land on
      // home specifically. Surfaced here rather than assumed, same as
      // hackingGrowMult above.
      homeCores: ns.getServer("home").cpuCores,
      target: currentTarget,
      plan: plan.type,
      debugWorkWeights: plan.debugWorkWeights || null,
      weightBucket: plan.weightBucket || null,
      currentSecurity: plan.currentSecurity,
      moneyPct: plan.moneyPct,
      needWeaken: requiredWeaken,
      maxWeaken: maxWeaken,
      tickSeconds: interval,
      hacked: hacked,
      rate: rate,
      avgRate: avgRate,
      incomePerSec: incomePerSec,
      expPerSec: expPerSec,
      totalHacked: totalHacked,
      ramUtilization: ramUtilization,
      workers: allocations,
      cloudWorkers,
      candidate: candidateTarget || null,
      candidateScore: candidateScore || 0,
      candidateExpectedIncome: candidateExpectedIncome || 0,
      avgMoneyPct: avgMoneyPct,
      moneyPctSampleCount: moneyPctSamples.length,
      moneyPctSampleTarget: MONEY_PCT_SAMPLE_COUNT,
      heldSeconds: heldSeconds,
      hackTimeS: hackTimeS,
      growTimeS: growTimeS,
      weakenTimeS: weakenTimeS,
      hackChance: hackChance,
      switchEval: switchEval,
      formulaSwitchVeto: formulaSwitchVeto,
      // set_objective.js's live override — see OBJECTIVE_OVERRIDE_FILE's own
      // comment. True means OBJECTIVE (below) came from
      // mcp_objective_override.txt, not mcp_config.json.
      objectiveOverrideActive: objectiveOverrideActive,
      // The tunables actually in force, so a reader can confirm a config edit
      // took effect rather than assuming it did.
      config: {
        SECURITY_CAP,
        TARGET_MONEY_GOAL,
        MIN_TARGET_HOLD_MS,
        WORK_SECURITY_MARGIN,
        RATE_DROP_FACTOR,
        LOOP_SLEEP_MS,
        RATE_SAMPLE_COUNT,
        WEAKEN_STUCK_MS,
        WEAKEN_STUCK_SECURITY_THRESHOLD,
        SKIP_STUCK_MS,
        DEGRADED_MONEY_PCT,
        MONEY_PCT_SAMPLE_COUNT,
        OPPORTUNITY_SWITCH_FACTOR,
        R8_SWITCH_VETO_ENABLED,
        MIN_TARGET_COMMIT_MS,
        DEGRADED_SKIP_MS,
        HACK_BALANCE_SAFETY,
        OBJECTIVE,
        XP_WEIGHT_HACK,
        XP_WEIGHT_GROW,
        REDEPLOY_TOLERANCE_ABSOLUTE,
        REDEPLOY_TOLERANCE_RELATIVE,
        HOME_RAM_RESERVE,
        SCORE_HORIZON_SECONDS,
      },
      invariantViolations: invariants.counts,
      // Last few transitions inline, so one file read gives both "now" and
      // "how we got here" without cross-referencing a second file by hand.
      recentEvents: events.recent,
    }

    const line = formatStatus(status)

    try {
      ns.write("mcp_status.json", JSON.stringify(status), "w")

      // Log only when something actually changed. Appending every tick grew
      // this file without bound *inside the save game* (~800KB/day), and the
      // vast majority of lines were byte-identical to their neighbour, which
      // buried the handful of transitions that actually explain behaviour.
      const signature = `${currentTarget}|${plan.type}|${plan.weightBucket || ""}`
      if (signature !== lastLogSignature) {
        ns.write("mcp_status_log.txt", `[${new Date(status.ts).toISOString()}] ${line}\n`, "a")
        lastLogSignature = signature
      }
    } catch (e) {
      // Do not turn a persistent disk error into a tail flood.  The game UI
      // still gets a visible critical notice, while the next invariant sweep
      // records the failure in the durable event stream.
      ns.toast("mcp: status-file write failed", "error", INVARIANT_TOAST_MS)
    }

    // Outside the try above: a status-write failure must not silently skip
    // persisting which targets we've learned to avoid.
    try {
      saveTargetState(ns, skippedTargets, drainedTargets)
    } catch (e) {
      ns.toast("mcp: target-state write failed", "error", INVARIANT_TOAST_MS)
    }

    lastAvgRate = avgRate
    await ns.sleep(LOOP_SLEEP_MS)
  }
}
