/**
 * @param {NS} ns
 */

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
let SECURITY_CAP = 6
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
let OPPORTUNITY_SWITCH_FACTOR = 3
// How long a *productive* target is committed to before better options are
// even considered. Much longer than MIN_TARGET_HOLD_MS because leaving one
// throws away its accumulated grow progress and the replacement must be
// grown up from wherever it currently sits — so the move only pays off over
// a long horizon, and shouldn't be re-litigated every minute.
let MIN_TARGET_COMMIT_MS = 600000
// How long a drained target is deprioritized before it's eligible again —
// long enough to make real progress on other (harder) targets first.
let DEGRADED_SKIP_MS = 900000
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
  MIN_TARGET_COMMIT_MS,
  DEGRADED_SKIP_MS,
}

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
    MIN_TARGET_COMMIT_MS,
    DEGRADED_SKIP_MS,
  }
  for (const key of Object.keys(CONFIG_DEFAULTS)) {
    if (current[key] !== resolved[key]) changes[key] = { from: current[key], to: resolved[key] }
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
  MIN_TARGET_COMMIT_MS = resolved.MIN_TARGET_COMMIT_MS
  DEGRADED_SKIP_MS = resolved.DEGRADED_SKIP_MS

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

const EVENT_FILE = "mcp_events.jsonl"
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
  return {
    recent,
    emit(kind, data) {
      seq += 1
      const event = Object.assign({ t: Date.now(), seq, runId, ver: scriptVersion, kind }, data)
      recent.push(event)
      if (recent.length > STATUS_EVENT_COUNT) recent.shift()
      try {
        ns.write(EVENT_FILE, JSON.stringify(event) + "\n", "a")
      } catch (e) {
        ns.print("mcp: failed to write event: " + e)
      }
      return event
    },
  }
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
 * actually happened and took multiple restart cycles to find.
 */
function checkTickInvariants(invariants, ctx) {
  // Budget over-allocation was found only because maxWeaken happened to
  // decrement by exactly needWeaken each tick — an accident of two unrelated
  // fields lining up. This makes it an alarm instead.
  invariants.check("weakenBudgetNonNegative", ctx.weakenBudget.remaining >= 0, {
    remaining: ctx.weakenBudget.remaining,
    required: ctx.requiredWeaken,
  })

  // Tab throttling stretched "10s" ticks to 70-380s, silently multiplying
  // every rate several-fold and tripping the degradation detector on an
  // artifact. Bounds are wide because the point is to catch the 7-38x case.
  //
  // Skipped on the first tick: lastTickTime is seeded just before the loop, so
  // tick 0 measures only its own startup work and lands well under the floor.
  // That fired on the very first run — a false positive baked into startup,
  // and a persistent false alarm is worse than no alarm.
  const nominal = LOOP_SLEEP_MS / 1000
  if (!ctx.firstTick) {
    invariants.check("tickWithinBounds", ctx.interval >= nominal * 0.5 && ctx.interval <= nominal * 3, {
      interval: ctx.interval,
      nominal,
    })
  }

  // The idle-network finding: utilization sat at 7% during weaken phases while
  // the code believed it was saturating the pool. Only meaningful once there
  // is a pool to speak of.
  invariants.check("poolNotIdle", ctx.ramUtilization >= 0.5 || ctx.allocations.length === 0, {
    ramUtilization: ctx.ramUtilization,
    hosts: ctx.allocations.length,
  })

  // Threads deployed must fit the host that is running them. This is the
  // inconsistent-RAM class: mcp once reported usedRam 3.5, freeRam 16 and
  // maxRam 16 for the same host and had no way to see the contradiction.
  for (const allocation of ctx.allocations) {
    if (!allocation.actions || allocation.actions.length === 0) continue
    let claimed = 0
    for (const action of allocation.actions) {
      const perThread =
        action.script === "hack"
          ? ctx.ramInfo.hackRam
          : action.script === "grow"
            ? ctx.ramInfo.growRam
            : ctx.ramInfo.weakenRam
      claimed += action.threads * perThread
    }
    if (
      !invariants.check("threadsFitHost", claimed <= allocation.maxRam + SECURITY_EPSILON, {
        host: allocation.host,
        claimed,
        maxRam: allocation.maxRam,
        usedRam: allocation.usedRam,
      })
    ) {
      // One report per tick is enough; the rest would be the same story.
      break
    }
  }
}

/**
 * The single field list.
 *
 * Both the tail line and the log line derive from the status object, so a
 * field added to the status cannot be invisible to whichever channel is
 * actually being read. Three hand-maintained lists is how `lowMoneySeconds`
 * ended up in ns.print only, and how `switchEval` initially went into the JSON
 * only — the same miss, twelve hours apart. Add fields to `status`; this
 * function is the only place that decides how they render.
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

// Income rate the server would yield at *full* money, so drained-but-rich and
// full-but-poor servers compare on the same footing. The previous form added
// raw maxMoney to an income-per-second term seven orders of magnitude smaller,
// which meant the income half contributed nothing at all.
function getTargetScore(ns, server) {
  if (!isHackableTarget(ns, server)) return 0
  const maxMoney = ns.getServerMaxMoney(server)
  const hackTime = ns.getHackTime(server) / 1000
  if (hackTime <= 0) return 0
  return (maxMoney * ns.hackAnalyze(server) * ns.hackAnalyzeChance(server)) / hackTime
}

// An empty server is still worth adopting if its ceiling is high enough to
// justify the (long) grow-up, so readiness is floored rather than zeroed —
// otherwise a rich-but-drained server could never be chosen at all.
const READINESS_FLOOR = 0.05

// Potential income rate discounted by how ready the server actually is right
// now. Selection previously ranked purely on required hacking level, which
// ignored current money entirely: on restart it abandoned a target sitting at
// 65% money earning ~$4.6M/s to grind one at 0.6% earning nothing, and then
// (correctly, per the recovery rules) refused to reconsider while that one
// slowly climbed.
//
// Hacking level is deliberately no longer a sort key. isHackableTarget already
// excludes anything above the player's level, and getTargetScore divides by
// hackTime — so "easier servers cycle faster" is already priced in, and having
// it as a *primary* key let it override the money signal completely.
function getTargetEffectiveScore(ns, server) {
  const potential = getTargetScore(ns, server)
  if (potential <= 0) return 0
  const maxMoney = ns.getServerMaxMoney(server)
  const readiness = Math.max(ns.getServerMoneyAvailable(server) / maxMoney, READINESS_FLOOR)
  return potential * readiness
}

// Security readings accumulate floating-point noise over many hack/grow/weaken
// calls, so a target sitting exactly at its floor can read as e.g.
// 9.000000000000002 instead of 9. Ignore deltas below this before rounding up
// to a thread count, or such targets look like they perpetually need 1 more
// weaken thread and never move on to hacking/growing.
const SECURITY_EPSILON = 1e-6

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
 * Ranks viable targets by income rate discounted for current readiness, so a
 * server that is already grown and immediately productive beats an equally
 * capable one that would need many minutes of grow first.
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

    candidates.push({ server, score: getTargetEffectiveScore(ns, server) })
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

function getHostFreeRam(ns, host) {
  if (host === "home") {
    return 0
  }
  const usedRam = ns.getServerUsedRam(host)
  let freeRam = ns.getServerMaxRam(host) - usedRam
  return Math.max(0, freeRam)
}

function getWorkerHosts(ns, servers = null) {
  const hosts = servers || scanNetwork(ns)
  const workers = []
  for (const server of hosts) {
    if (server === "home") continue
    if (!ns.hasRootAccess(server)) continue
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

// Named tiers instead of raw weight objects so a redeploy can be triggered
// specifically when moneyPct crosses into a different tier, rather than on
// every loop tick (which would defeat the whole point of not re-execing
// long-running hack/grow threads constantly).
const WORK_WEIGHTS_BY_BUCKET = {
  goal: { grow: 0.25, hack: 0.75 },
  high: { grow: 0.4, hack: 0.6 },
  mid: { grow: 0.55, hack: 0.45 },
  low: { grow: 0.7, hack: 0.3 },
  // Hacking a near-empty server steals close to nothing (hack take scales
  // with *available* money) while still adding security load that has to be
  // weakened back off — pure waste. Go all-in on recovery instead.
  empty: { grow: 1, hack: 0 },
}

function getWorkWeightBucket(moneyPct) {
  if (moneyPct >= TARGET_MONEY_GOAL) return "goal"
  if (moneyPct >= 0.92) return "high"
  if (moneyPct >= 0.85) return "mid"
  if (moneyPct >= 0.1) return "low"
  return "empty"
}

function buildPlan(ns, target, wasWorking) {
  const currentSecurity = ns.getServerSecurityLevel(target)
  const moneyPct = ns.getServerMoneyAvailable(target) / ns.getServerMaxMoney(target)
  // Only apply hysteresis when coming FROM a work phase, so a target that's
  // actually stuck above the cap still switches to weaken right away — this
  // just stops security drifting slightly over goal from instantly killing
  // grow/hack threads every loop.
  const requiredWeaken = getTargetWeakenThreads(ns, target, wasWorking ? WORK_SECURITY_MARGIN : 0)

  if (requiredWeaken > 0) {
    return { type: "weaken", currentSecurity, moneyPct }
  }

  const weightBucket = getWorkWeightBucket(moneyPct)
  return {
    type: "work",
    currentSecurity,
    moneyPct,
    weightBucket,
    weights: WORK_WEIGHTS_BY_BUCKET[weightBucket],
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

// hack/grow/weaken calls routinely take 1-4+ minutes (see hackTime/growTime/
// weakenTime in the status line), far longer than one mcp loop tick. Killing
// and re-execing every tick regardless of state means threads never survive
// long enough to complete, so a host is only redeployed when its currently
// running actions no longer match what's actually needed.
function hostNeedsRedeploy(target, plan, running, forceRebalance) {
  if (forceRebalance) return true
  if (running.length === 0) return true
  if (running.some(({ proc }) => proc.args[0] !== target)) return true

  const hasGrow = running.some(({ normalized }) => normalized === "/scripts/grow.js")
  const hasHack = running.some(({ normalized }) => normalized === "/scripts/hack.js")
  if (plan.type === "work" && !hasGrow && !hasHack) return true
  // Grow is welcome during a weaken phase (leftover capacity goes to it, and
  // refilling money is always useful); hack is not — it fights the weaken by
  // adding security while stealing from a server we're trying to stabilize.
  if (plan.type === "weaken" && hasHack) return true

  return false
}

// Security added per action thread, expressed in weaken-threads needed to
// cancel it. See WEAKEN_PER_*_RATIO: worker scripts loop, so the relevant
// comparison is security-per-unit-time, not security-per-call.
function weakenThreadsToOffset(hackThreads, growThreads) {
  return Math.ceil(
    (hackThreads * HACK_SEC_INCREASE * WEAKEN_PER_HACK_RATIO +
      growThreads * GROW_SEC_INCREASE * WEAKEN_PER_GROW_RATIO) /
      WEAKEN_SEC_DECREASE
  )
}

function allocateThreads(ns, host, target, plan, ramInfo, forceRebalance, weakenBudget) {
  /** @type {{script: string, threads: number}[]} */
  const actions = []
  const allocation = {
    host,
    maxRam: ns.getServerMaxRam(host),
    usedRam: 0,
    freeRam: 0,
    actions,
  }

  if (host === "home") {
    allocation.usedRam = ns.getServerUsedRam(host)
    return allocation
  }

  const running = getRunningActions(ns, host)
  if (!hostNeedsRedeploy(target, plan, running, forceRebalance)) {
    allocation.usedRam = ns.getServerUsedRam(host)
    allocation.freeRam = getHostFreeRam(ns, host)
    for (const { proc, normalized } of running) {
      const script = normalized.replace("/scripts/", "").replace(".js", "")
      allocation.actions.push({ script, threads: proc.threads })
      // Threads left running still count against the shared budget — not
      // charging for them re-spent the whole budget on every host each tick,
      // deploying several times the weaken actually needed. Only meaningful
      // during a "weaken" plan, which is the only place anything is actually
      // drawn from this budget (maintenance weaken during "work" is computed
      // independently via weakenThreadsToOffset). Charging it unconditionally
      // drove it negative on every tick a host kept its maintenance weaken
      // threads running — a real accounting bug the weakenBudgetNonNegative
      // invariant caught on the first live run, harmless only because nothing
      // had read `remaining` outside a weaken plan before that invariant
      // existed.
      if (script === "weaken" && plan.type === "weaken") weakenBudget.remaining -= proc.threads
    }
    return allocation
  }

  killActionScripts(ns, host)
  copyActionScripts(ns, host)

  const freeRam = getHostFreeRam(ns, host)
  if (freeRam < ramInfo.minRam) {
    allocation.usedRam = ns.getServerUsedRam(host)
    allocation.freeRam = freeRam
    return allocation
  }

  let weakenThreads = 0
  let growThreads = 0
  let hackThreads = 0

  if (plan.type === "weaken") {
    const maxWeaken = Math.floor(freeRam / ramInfo.weakenRam)
    weakenThreads = Math.max(0, Math.min(maxWeaken, weakenBudget.remaining))
    weakenBudget.remaining -= weakenThreads
    // Whatever this host isn't contributing to the (network-wide, capped)
    // weaken need would otherwise sit idle for the whole weaken phase —
    // often the large majority of the network. Grow is always useful and
    // doesn't require the target to be at its security floor first.
    const leftoverRam = freeRam - weakenThreads * ramInfo.weakenRam
    growThreads = Math.floor(leftoverRam / ramInfo.growRam)
    // Growing adds security too, so it has to pay for its own offset out of
    // the same leftover rather than undermining the weaken it runs beside.
    const growOffset = weakenThreadsToOffset(0, growThreads)
    if (growOffset > 0) {
      const reserveRam = growOffset * ramInfo.weakenRam
      growThreads = Math.max(0, Math.floor((leftoverRam - reserveRam) / ramInfo.growRam))
      weakenThreads += weakenThreadsToOffset(0, growThreads)
    }
  } else {
    const workWeights = plan.weights
    const maxWeakenThreads = Math.floor(freeRam / ramInfo.weakenRam)

    const provisionalHack = Math.floor((freeRam * workWeights.hack) / ramInfo.hackRam)
    const provisionalGrow = Math.floor(
      (freeRam - provisionalHack * ramInfo.hackRam) / ramInfo.growRam
    )
    const maintenanceThreads = weakenThreadsToOffset(provisionalHack, provisionalGrow)

    if (maintenanceThreads >= maxWeakenThreads) {
      weakenThreads = maxWeakenThreads
    } else {
      weakenThreads = maintenanceThreads
      const actionRam = freeRam - weakenThreads * ramInfo.weakenRam
      if (actionRam >= ramInfo.minRam) {
        hackThreads = Math.floor((actionRam * workWeights.hack) / ramInfo.hackRam)
        growThreads = Math.floor((actionRam - hackThreads * ramInfo.hackRam) / ramInfo.growRam)
      }
    }
  }

  if (weakenThreads > 0 && ns.exec("/scripts/weaken.js", host, weakenThreads, target) !== 0) {
    allocation.actions.push({ script: "weaken", threads: weakenThreads })
  }
  if (growThreads > 0 && ns.exec("/scripts/grow.js", host, growThreads, target) !== 0) {
    allocation.actions.push({ script: "grow", threads: growThreads })
  }
  if (hackThreads > 0 && ns.exec("/scripts/hack.js", host, hackThreads, target) !== 0) {
    allocation.actions.push({ script: "hack", threads: hackThreads })
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
        if (securityProgressTime === 0 || currentSecurity < bestSecuritySeen - WEAKEN_STUCK_SECURITY_THRESHOLD) {
          securityProgressTime = Date.now()
          bestSecuritySeen = currentSecurity
        } else if (currentRequiredWeaken > 0 && Date.now() - securityProgressTime > WEAKEN_STUCK_MS) {
          ns.tprint(
            `mcp: target ${currentTarget} not weakening (sec=${currentSecurity.toFixed(2)} best=${bestSecuritySeen.toFixed(2)} need=${currentRequiredWeaken}); switching target`
          )
          events.emit("target_drop", {
            target: currentTarget,
            reason: "stuck",
            currentSecurity,
            bestSecuritySeen,
            progressThreshold: WEAKEN_STUCK_SECURITY_THRESHOLD,
            stalledMs: Date.now() - securityProgressTime,
            stuckAfterMs: WEAKEN_STUCK_MS,
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
        const avgMoneyPct = moneyPctSamples.reduce((sum, value) => sum + value, 0) / moneyPctSamples.length
        // "Low" alone isn't drained — a target mid-recovery is legitimately
        // low but climbing, and abandoning it there strands it at ~0 with no
        // grow threads for the whole skip window.
        //
        // Requires an actual *decline*, not merely absence of improvement.
        // growTime scales inversely with hacking level, so early on a single
        // grow can take longer than the whole 90s sample window: the earlier
        // `!improving` test read "too slow to see yet" as "dead" and drained
        // a perfectly good target on a level-1 character. Money genuinely
        // being drained faster than it regrows shows up as a falling series.
        const windowFull = moneyPctSamples.length === MONEY_PCT_SAMPLE_COUNT
        const declining = windowFull && moneyPctSamples[moneyPctSamples.length - 1] < moneyPctSamples[0]
        const moneyDegraded = windowFull && avgMoneyPct < DEGRADED_MONEY_PCT && declining

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
      //   - current target producing nothing ("empty"): compare readiness-
      //     discounted scores, and move quickly. Escaping a dud is urgent.
      //   - current target productive: both it and the candidate would sit at
      //     their own equilibrium, so compare raw potential instead — current
      //     money says nothing about which is the better long-run farm. Held
      //     much longer first, since switching discards grow progress and the
      //     replacement has to be grown up from wherever it sits.
      if (currentTarget) {
        const heldMs = Date.now() - lastSwitchTime
        const currentMoneyPct = ns.getServerMoneyAvailable(currentTarget) / ns.getServerMaxMoney(currentTarget)
        const idle = getWorkWeightBucket(currentMoneyPct) === "empty"
        const holdMs = idle ? MIN_TARGET_HOLD_MS : MIN_TARGET_COMMIT_MS
        const committed = heldMs >= holdMs

        // Evaluate every tick, act only when committed. Previously the whole
        // comparison was skipped while the hold timer ran, so "why is it still
        // on this target?" had no recorded answer — and the two possible
        // answers (losing on score / not held long enough) call for completely
        // different responses. Recording both sides of the predicate is the
        // rule from the process audit; the extra ranking pass is cheap next to
        // the one chooseTarget already does each tick.
        const ranked = rankTargets(ns, servers, maxWeaken, skippedTargets, drainedTargets)
        const measure = idle
          ? (server) => getTargetEffectiveScore(ns, server)
          : (server) => getTargetScore(ns, server)
        let best = null
        for (const { server } of ranked) {
          const score = measure(server)
          if (!best || score > best.score) best = { server, score }
        }
        const currentScore = measure(currentTarget)
        const ratio = best ? best.score / Math.max(currentScore, 1e-9) : 0
        const outbid =
          !!best && best.server !== currentTarget && best.score > currentScore * OPPORTUNITY_SWITCH_FACTOR

        switchEval = {
          basis: idle ? "effective" : "potential",
          currentScore,
          best: best ? best.server : null,
          bestScore: best ? best.score : 0,
          ratio,
          factor: OPPORTUNITY_SWITCH_FACTOR,
          heldSeconds: Math.floor(heldMs / 1000),
          holdSeconds: Math.floor(holdMs / 1000),
          committed,
          outbid,
          // What is actually preventing a switch right now, so the HUD can say
          // so in one word instead of making it inferable from four numbers.
          blockedBy: outbid ? (committed ? null : "hold") : "score",
        }

        if (committed && outbid) {
          ns.tprint(
            `mcp: ${best.server} (${formatMoney(best.score)}/s) outperforms ${idle ? "idle" : "current"} ${currentTarget} (${formatMoney(currentScore)}/s) by ${ratio.toFixed(1)}x after ${Math.floor(heldMs / 1000)}s; switching`
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

    const candidateTarget = chooseTarget(ns, servers, maxWeaken, skippedTargets, drainedTargets)
    const candidateExpectedIncome = candidateTarget ? getTargetExpectedIncome(ns, candidateTarget) : 0
    const candidateScore = candidateTarget ? getTargetEffectiveScore(ns, candidateTarget) : 0

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
    // Redeploy when moneyPct crosses into a different hack/grow weight tier,
    // so the ratio actually adapts as money drains or recovers — otherwise
    // whatever split was deployed first just runs forever unchanged.
    const forceRebalance = plan.type === "work" && plan.weightBucket !== lastWeightBucket
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
    if (plan.type === "work" && previousWeightBucket !== null && previousWeightBucket !== plan.weightBucket) {
      events.emit("bucket_change", {
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

    // Shared across hosts so a weaken-phase target only ever gets exactly as
    // many threads as it actually needs, rather than every host independently
    // maxing out. Hosts that keep already-running weaken threads charge the
    // budget too (see allocateThreads), so the cap holds across ticks.
    const weakenBudget = { remaining: plan.type === "weaken" ? getTargetWeakenThreads(ns, currentTarget) : 0 }

    const allocations = []
    for (const host of workers) {
      allocations.push(allocateThreads(ns, host, currentTarget, plan, ramInfo, forceRebalance, weakenBudget))
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
    const requiredWeaken = getTargetWeakenThreads(ns, currentTarget)
    const hackTimeS = ns.getHackTime(currentTarget) / 1000
    const growTimeS = ns.getGrowTime(currentTarget) / 1000
    const weakenTimeS = ns.getWeakenTime(currentTarget) / 1000
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
      interval,
      ramUtilization,
      weakenBudget,
      requiredWeaken,
      allocations,
      ramInfo,
      firstTick: tickIndex === 0,
    })
    tickIndex += 1

    // Build the status object first, then derive every rendering from it.
    const player = ns.getPlayer()
    const status = {
      ts: Date.now(),
      runId: runId,
      scriptVersion: scriptVersion,
      player: {
        money: player.money,
        hp: player.hp,
        skills: player.skills,
      },
      target: currentTarget,
      plan: plan.type,
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
        MIN_TARGET_COMMIT_MS,
        DEGRADED_SKIP_MS,
      },
      invariantViolations: invariants.counts,
      // Last few transitions inline, so one file read gives both "now" and
      // "how we got here" without cross-referencing a second file by hand.
      recentEvents: events.recent,
    }

    const line = formatStatus(status)
    ns.print(line)

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
      ns.print("mcp: failed to write status file: " + e)
    }

    // Outside the try above: a status-write failure must not silently skip
    // persisting which targets we've learned to avoid.
    try {
      saveTargetState(ns, skippedTargets, drainedTargets)
    } catch (e) {
      ns.print("mcp: failed to persist target state: " + e)
    }

    lastAvgRate = avgRate
    await ns.sleep(LOOP_SLEEP_MS)
  }
}
