/**
 * @param {NS} ns
 */

const SECURITY_CAP = 6
const TARGET_MONEY_GOAL = 0.95
const MIN_TARGET_HOLD_MS = 60000
// Absolute security margin (not a fraction) tolerated before a working target
// is torn down for a weaken phase. Must exceed the security injected by one
// grow/hack cycle landing at once (~1.0 observed), or the plan flips every
// couple of ticks and no grow/hack thread ever survives to completion.
const WORK_SECURITY_MARGIN = 1.5
const RATE_DROP_FACTOR = 0.75
const LOOP_SLEEP_MS = 10000
const RATE_SAMPLE_COUNT = 5
const WEAKEN_STUCK_MS = 60000
const WEAKEN_STUCK_SECURITY_THRESHOLD = 0.05
const SKIP_STUCK_MS = 60000
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
const DEGRADED_MONEY_PCT = 0.05
const MONEY_PCT_SAMPLE_COUNT = 9
// A target only gets abandoned for a better one when it is itself producing
// nothing (still in the "empty" tier, so hack threads are off) AND the
// alternative scores this many times higher. Deliberately steep: switching
// throws away accumulated grow progress, so it must clear a wide bar rather
// than chase small differences and thrash.
const OPPORTUNITY_SWITCH_FACTOR = 3
// How long a drained target is deprioritized before it's eligible again —
// long enough to make real progress on other (harder) targets first.
const DEGRADED_SKIP_MS = 900000
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
function rankTargets(ns, servers, maxWeaken, skippedTargets, drainedTargets) {
  const candidates = []

  for (const server of servers) {
    if (!isHackableTarget(ns, server)) continue
    if (skippedTargets.has(server) || drainedTargets.has(server)) continue

    const requiredWeaken = getTargetWeakenThreads(ns, server)
    if (requiredWeaken > maxWeaken) continue

    candidates.push({ server, score: getTargetEffectiveScore(ns, server) })
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates
}

function chooseTarget(ns, servers, maxWeaken, skippedTargets, drainedTargets) {
  const ranked = rankTargets(ns, servers, maxWeaken, skippedTargets, drainedTargets)
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
      // deploying several times the weaken actually needed.
      if (script === "weaken") weakenBudget.remaining -= proc.threads
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

  while (true) {
    const servers = scanNetwork(ns)
    const workers = getWorkerHosts(ns, servers)
    const maxWeaken = getTotalWeakenCapacity(ns, workers)
    expireTargetExclusions(skippedTargets, drainedTargets)

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
        // grow threads for the whole skip window. Only give up if it's also
        // failing to improve across the sample window.
        const windowFull = moneyPctSamples.length === MONEY_PCT_SAMPLE_COUNT
        const improving = windowFull && moneyPctSamples[moneyPctSamples.length - 1] > moneyPctSamples[0]
        const moneyDegraded = windowFull && avgMoneyPct < DEGRADED_MONEY_PCT && !improving

        if (heldLongEnough && (rateDropped || moneyDegraded)) {
          ns.tprint(
            `mcp: target ${currentTarget} yield degraded (avgMoneyPct=${avgMoneyPct.toFixed(4)} improving=${improving} rateDropped=${rateDropped}); moving on`
          )
          drainedTargets.set(currentTarget, Date.now())
          currentTarget = null
          securityProgressTime = 0
          bestSecuritySeen = Infinity
          lastPlanType = null
          lastWeightBucket = null
          moneyPctSamples.length = 0
        }
      }

      // Opportunity switch: adoption alone only happens when currentTarget is
      // null, so without this the bot will grind an unproductive target for as
      // long as it keeps inching upward (it isn't "degraded" — it's improving)
      // while a fully grown, immediately productive server sits idle.
      // Restricted to targets that are themselves producing nothing, so a
      // working target is never interrupted mid-earn.
      if (currentTarget && Date.now() - lastSwitchTime >= MIN_TARGET_HOLD_MS) {
        const currentMoneyPct = ns.getServerMoneyAvailable(currentTarget) / ns.getServerMaxMoney(currentTarget)
        if (getWorkWeightBucket(currentMoneyPct) === "empty") {
          const best = rankTargets(ns, servers, maxWeaken, skippedTargets, drainedTargets)[0]
          const currentEffective = getTargetEffectiveScore(ns, currentTarget)
          if (best && best.server !== currentTarget && best.score > currentEffective * OPPORTUNITY_SWITCH_FACTOR) {
            ns.tprint(
              `mcp: ${best.server} (score=${formatMoney(best.score)}/s) far outperforms idle ${currentTarget} (${formatMoney(currentEffective)}/s); switching`
            )
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
      // Release the network before idling. Leaving orphaned threads running
      // keeps every host saturated, which keeps weaken capacity at zero,
      // which keeps every candidate inadmissible — a stall with no exit.
      for (const host of workers) {
        killActionScripts(ns, host)
      }
      await ns.sleep(60000)
      continue
    }

    const plan = buildPlan(ns, currentTarget, lastPlanType === "work")
    lastPlanType = plan.type
    // Redeploy when moneyPct crosses into a different hack/grow weight tier,
    // so the ratio actually adapts as money drains or recovers — otherwise
    // whatever split was deployed first just runs forever unchanged.
    const forceRebalance = plan.type === "work" && plan.weightBucket !== lastWeightBucket
    if (plan.type === "work") lastWeightBucket = plan.weightBucket
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
    ns.print(
      `mcp target=${currentTarget} plan=${plan.type}${plan.weightBucket ? "/" + plan.weightBucket : ""} held=${heldSeconds}s tick=${interval.toFixed(1)}s sec=${plan.currentSecurity.toFixed(2)} moneyPct=${plan.moneyPct.toFixed(4)} avgMoneyPct=${avgMoneyPct.toFixed(4)} moneySamples=${moneyPctSamples.length}/${MONEY_PCT_SAMPLE_COUNT} needWeaken=${requiredWeaken} maxWeaken=${maxWeaken} hacked=${formatMoney(hacked)} rate=${formatMoney(rate)}/s avg=${formatMoney(avgRate)}/s total=${formatMoney(totalHacked)} workers=${workers.length} hackTime=${hackTimeS.toFixed(1)}s growTime=${growTimeS.toFixed(1)}s weakenTime=${weakenTimeS.toFixed(1)}s hackChance=${(hackChance * 100).toFixed(1)}%`
    )

    // Write structured status JSON (overwritten each loop) so the Bitburner File Sync extension can pull it
    try {
      const player = ns.getPlayer()
      const status = {
        ts: Date.now(),
        player: {
          money: player.money,
          hp: player.hp,
          skills: player.skills,
        },
        target: currentTarget,
        plan: plan.type,
        currentSecurity: plan.currentSecurity,
        moneyPct: plan.moneyPct,
        needWeaken: requiredWeaken,
        maxWeaken: maxWeaken,
        tickSeconds: interval,
        hacked: hacked,
        rate: rate,
        avgRate: avgRate,
        totalHacked: totalHacked,
        workers: allocations,
        candidate: candidateTarget || null,
        candidateScore: candidateScore || 0,
        candidateExpectedIncome: candidateExpectedIncome || 0,
        avgMoneyPct: avgMoneyPct,
        moneyPctSampleCount: moneyPctSamples.length,
      }
      ns.write("mcp_status.json", JSON.stringify(status), "w")

      // Log only when something actually changed. Appending every tick grew
      // this file without bound *inside the save game* (~800KB/day), and the
      // vast majority of lines were byte-identical to their neighbour, which
      // buried the handful of transitions that actually explain behaviour.
      const signature = `${currentTarget}|${plan.type}|${plan.weightBucket || ""}`
      if (signature !== lastLogSignature) {
        const line = `[${new Date(status.ts).toISOString()}] target=${status.target} plan=${status.plan}${plan.weightBucket ? "/" + plan.weightBucket : ""} needWeaken=${status.needWeaken} maxWeaken=${status.maxWeaken} tick=${interval.toFixed(1)}s rate=${formatMoney(status.rate)}/s workers=${status.workers.length} avgMoneyPct=${status.avgMoneyPct.toFixed(4)} playerMoney=${formatMoney(status.player.money)} hackLvl=${status.player.skills.hacking}\n`
        ns.write("mcp_status_log.txt", line, "a")
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
