/**
 * @param {NS} ns
 */

const SECURITY_CAP = 6
const TARGET_MONEY_GOAL = 0.95
const MIN_TARGET_HOLD_MS = 60000
const SWITCH_HYSTERESIS = 0.08
const RATE_DROP_FACTOR = 0.75
const SCORE_WEIGHT = 0.1
const LOOP_SLEEP_MS = 10000
const RATE_SAMPLE_COUNT = 5
const WEAKEN_STUCK_MS = 60000
const WEAKEN_STUCK_SECURITY_THRESHOLD = 0.05
const SKIP_STUCK_MS = 60000
const IGNORE_SERVERS = ["darkweb"]
const HOME_RAM_RESERVE = 8
const ACTION_SCRIPTS = ["/scripts/grow.js", "/scripts/hack.js", "/scripts/weaken.js"]
const HACK_SEC_INCREASE = 0.002
const GROW_SEC_INCREASE = 0.004
const WEAKEN_SEC_DECREASE = 0.05

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

function getTargetScore(ns, server) {
  if (!isHackableTarget(ns, server)) return 0
  const maxMoney = ns.getServerMaxMoney(server)
  return getTargetExpectedIncome(ns, server) + maxMoney * SCORE_WEIGHT
}

function getTargetWeakenThreads(ns, target) {
  const currentSecurity = ns.getServerSecurityLevel(target)
  const minSecurity = ns.getServerMinSecurityLevel(target)
  const goalSecurity = Math.max(minSecurity, SECURITY_CAP)
  const delta = currentSecurity - goalSecurity
  return delta > 0 ? Math.ceil(delta / WEAKEN_SEC_DECREASE) : 0
}

function canWeakenTarget(ns, target, maxWeaken) {
  return getTargetWeakenThreads(ns, target) <= maxWeaken
}

function getTotalWeakenCapacity(ns) {
  const weakenRam = ns.getScriptRam("/scripts/weaken.js")
  let totalThreads = 0
  for (const server of getWorkerHosts(ns)) {
    const freeRam = getHostFreeRam(ns, server)
    if (freeRam < weakenRam) continue
    totalThreads += Math.floor(freeRam / weakenRam)
  }
  return totalThreads
}

function getTargetPriority(ns, server, maxWeaken) {
  const requiredWeaken = getTargetWeakenThreads(ns, server)
  if (requiredWeaken > maxWeaken) return -Infinity

  const maxMoney = ns.getServerMaxMoney(server)
  const income = getTargetExpectedIncome(ns, server)
  const base = maxMoney + income * 0.1

  if (requiredWeaken === 0) {
    return base + 1e12
  }

  return base - requiredWeaken * 1e7
}

function chooseTarget(ns, servers, maxWeaken = null, skippedTargets = null) {
  if (maxWeaken === null) {
    maxWeaken = getTotalWeakenCapacity(ns)
  }
  if (!skippedTargets) skippedTargets = new Map()

  const now = Date.now()
  const candidates = []

  for (const server of servers) {
    if (IGNORE_SERVERS.includes(server)) continue
    if (!isHackableTarget(ns, server)) continue

    if (skippedTargets.has(server)) {
      const skipTime = skippedTargets.get(server)
      if (now - skipTime < SKIP_STUCK_MS) continue
      skippedTargets.delete(server)
    }

    const requiredWeaken = getTargetWeakenThreads(ns, server)
    if (requiredWeaken > maxWeaken) continue

    const maxMoney = ns.getServerMaxMoney(server)
    const incomeBonus = getTargetExpectedIncome(ns, server) * 0.1
    const score = maxMoney + incomeBonus - requiredWeaken * 1e8 + (requiredWeaken === 0 ? 1e10 : 0)
    candidates.push({ server, score })
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates.length > 0 ? candidates[0].server : null
}

function getHostFreeRam(ns, host) {
  if (host === "home") {
    return 0
  }
  const usedRam = ns.getServerUsedRam(host)
  let freeRam = ns.getServerMaxRam(host) - usedRam
  return Math.max(0, freeRam)
}

function getWorkerHosts(ns) {
  const servers = scanNetwork(ns)
  const workers = []
  for (const server of servers) {
    if (server === "home") continue
    if (!ns.hasRootAccess(server)) continue
    const maxRam = ns.getServerMaxRam(server)
    if (maxRam <= 2.5) continue
    workers.push(server)
  }
  return workers
}

function killActionScripts(ns, host) {
  for (const proc of ns.ps(host)) {
    if (ACTION_SCRIPTS.includes(proc.filename)) {
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

function getWorkWeights(moneyPct) {
  if (moneyPct >= TARGET_MONEY_GOAL) {
    return { grow: 0.25, hack: 0.75 }
  }
  if (moneyPct >= 0.92) {
    return { grow: 0.4, hack: 0.6 }
  }
  if (moneyPct >= 0.85) {
    return { grow: 0.55, hack: 0.45 }
  }
  return { grow: 0.7, hack: 0.3 }
}

function buildPlan(ns, target) {
  const currentSecurity = ns.getServerSecurityLevel(target)
  const moneyPct = ns.getServerMoneyAvailable(target) / ns.getServerMaxMoney(target)
  const requiredWeaken = getTargetWeakenThreads(ns, target)

  if (requiredWeaken > 0) {
    return { type: "weaken", currentSecurity, moneyPct }
  }

  return {
    type: "work",
    currentSecurity,
    moneyPct,
    weights: getWorkWeights(moneyPct),
  }
}

function allocateThreads(ns, host, target, plan, ramInfo) {
  const allocation = {
    host,
    maxRam: ns.getServerMaxRam(host),
    usedRam: ns.getServerUsedRam(host),
    freeRam: 0,
    actions: [],
  }

  if (host === "home") {
    return allocation
  }

  killActionScripts(ns, host)
  copyActionScripts(ns, host)

  let freeRam = getHostFreeRam(ns, host)
  allocation.freeRam = freeRam
  if (freeRam < ramInfo.minRam) return allocation

  if (plan.type === "weaken") {
    const threads = Math.floor(freeRam / ramInfo.weakenRam)
    if (threads > 0) {
      ns.exec("/scripts/weaken.js", host, threads, target)
      allocation.actions.push({ script: "weaken", threads })
    }
    return allocation
  }

  const workWeights = plan.weights
  const maxWeakenThreads = Math.floor(freeRam / ramInfo.weakenRam)

  let targetWorkRam = Math.floor(freeRam * workWeights.hack)
  let hackThreads = Math.floor(targetWorkRam / ramInfo.hackRam)
  let remainingRam = freeRam - hackThreads * ramInfo.hackRam
  let growThreads = Math.floor(remainingRam / ramInfo.growRam)

  const maintenanceThreads = Math.ceil(
    (hackThreads * HACK_SEC_INCREASE + growThreads * GROW_SEC_INCREASE) / WEAKEN_SEC_DECREASE
  )

  if (maintenanceThreads >= maxWeakenThreads) {
    const weakenThreads = maxWeakenThreads
    if (weakenThreads > 0) {
      ns.exec("/scripts/weaken.js", host, weakenThreads, target)
      allocation.actions.push({ script: "weaken", threads: weakenThreads })
    }
    return allocation
  }

  const weakenThreads = maintenanceThreads
  const actionRam = freeRam - weakenThreads * ramInfo.weakenRam
  if (actionRam < ramInfo.minRam) {
    if (weakenThreads > 0) {
      ns.exec("/scripts/weaken.js", host, weakenThreads, target)
      allocation.actions.push({ script: "weaken", threads: weakenThreads })
    }
    return allocation
  }

  hackThreads = Math.floor((actionRam * workWeights.hack) / ramInfo.hackRam)
  remainingRam = actionRam - hackThreads * ramInfo.hackRam
  growThreads = Math.floor(remainingRam / ramInfo.growRam)

  if (weakenThreads > 0) {
    ns.exec("/scripts/weaken.js", host, weakenThreads, target)
    allocation.actions.push({ script: "weaken", threads: weakenThreads })
  }
  if (growThreads > 0) {
    ns.exec("/scripts/grow.js", host, growThreads, target)
    allocation.actions.push({ script: "grow", threads: growThreads })
  }
  if (hackThreads > 0) {
    ns.exec("/scripts/hack.js", host, hackThreads, target)
    allocation.actions.push({ script: "hack", threads: hackThreads })
  }

  return allocation
}

export async function main(ns) {
  disableLogs(ns)
  let currentTarget = null
  let currentTargetMoney = 0
  let currentTargetScore = 0
  let lastSwitchTime = 0
  let totalHacked = 0
  let weakenStuckStart = 0
  let weakenStuckSecurity = 0
  const rateSamples = []
  const skippedTargets = new Map()
  let lastAvgRate = null

  while (true) {
    const servers = scanNetwork(ns)
    const maxWeaken = getTotalWeakenCapacity(ns)
    const candidateTarget = chooseTarget(ns, servers, maxWeaken)
    const candidateTarget = chooseTarget(ns, servers, maxWeaken, skippedTargets)
    const candidateExpectedIncome = candidateTarget ? getTargetExpectedIncome(ns, candidateTarget) : 0

    if (currentTarget) {
      const currentRequiredWeaken = getTargetWeakenThreads(ns, currentTarget)
      if (!isHackableTarget(ns, currentTarget) || !canWeakenTarget(ns, currentTarget, maxWeaken)) {
        currentTarget = null
        skippedTargets.set(currentTarget, Date.now())
      } else if (currentRequiredWeaken > 0) {
        const currentSecurity = ns.getServerSecurityLevel(currentTarget)
        if (weakenStuckStart === 0) {
          weakenStuckStart = Date.now()
          weakenStuckSecurity = currentSecurity
        } else if (currentSecurity > weakenStuckSecurity - WEAKEN_STUCK_SECURITY_THRESHOLD) {
          if (Date.now() - weakenStuckStart > WEAKEN_STUCK_MS) {
            ns.tprint(`mcp: target ${currentTarget} appears stuck at sec=${currentSecurity.toFixed(2)}; switching to next richest target`)
            currentTarget = null
            skippedTargets.set(currentTarget, Date.now())
          }
        } else {
          weakenStuckStart = Date.now()
          weakenStuckSecurity = currentSecurity
        }
      }
    }

    const currentScore = currentTarget ? getTargetScore(ns, currentTarget) : 0
    const currentExpectedIncome = currentTarget ? getTargetExpectedIncome(ns, currentTarget) : 0
    const heldLongEnough = Date.now() - lastSwitchTime >= MIN_TARGET_HOLD_MS
    const rateDropped =
      lastAvgRate !== null && rateSamples.length === RATE_SAMPLE_COUNT &&
      rateSamples[rateSamples.length - 1] < lastAvgRate * RATE_DROP_FACTOR

    const shouldSwitch =
      !currentTarget ||
      (candidateTarget && candidateTarget !== currentTarget && heldLongEnough && candidateScore > currentScore * (1 + SWITCH_HYSTERESIS)) ||
      rateDropped

    if (shouldSwitch && candidateTarget) {
      const requiredWeaken = getTargetWeakenThreads(ns, candidateTarget)
      currentTarget = candidateTarget
      currentTargetMoney = ns.getServerMoneyAvailable(currentTarget)
      currentTargetScore = candidateScore
      lastSwitchTime = Date.now()
      rateSamples.length = 0
      lastAvgRate = null
      ns.tprint(`mcp: switching target to ${currentTarget} expectedIncome=${formatMoney(candidateExpectedIncome)}/s score=${formatMoney(candidateScore)}/s needWeaken=${requiredWeaken} availWeaken=${maxWeaken}`)
    }

    if (!currentTarget) {
      ns.tprint("mcp: no hackable target found")
      await ns.sleep(60000)
      continue
    }

    const plan = buildPlan(ns, currentTarget)
    const workers = getWorkerHosts(ns)
    const hackRam = ns.getScriptRam("/scripts/hack.js")
    const growRam = ns.getScriptRam("/scripts/grow.js")
    const weakenRam = ns.getScriptRam("/scripts/weaken.js")
    const minRam = Math.min(hackRam, growRam, weakenRam)
    const ramInfo = { hackRam, growRam, weakenRam, minRam }

    const allocations = []
    for (const host of workers) {
      allocations.push(allocateThreads(ns, host, currentTarget, plan, ramInfo))
    }

    const currentMoney = ns.getServerMoneyAvailable(currentTarget)
    const hacked = Math.max(0, currentTargetMoney - currentMoney)
    const interval = LOOP_SLEEP_MS / 1000
    const rate = hacked / interval
    totalHacked += hacked
    currentTargetMoney = currentMoney

    rateSamples.push(rate)
    if (rateSamples.length > RATE_SAMPLE_COUNT) rateSamples.shift()
    const avgRate = rateSamples.reduce((sum, value) => sum + value, 0) / rateSamples.length
    const homeFreeRam = getHostFreeRam(ns, "home")
    const heldSeconds = Math.max(0, Math.floor((Date.now() - lastSwitchTime) / 1000))
    const requiredWeaken = getTargetWeakenThreads(ns, currentTarget)
    ns.print(
      `mcp target=${currentTarget} plan=${plan.type} held=${heldSeconds}s sec=${plan.currentSecurity.toFixed(2)} moneyPct=${plan.moneyPct.toFixed(3)} needWeaken=${requiredWeaken} maxWeaken=${maxWeaken} homeFreeRam=${homeFreeRam.toFixed(2)}GB hacked=${formatMoney(hacked)} rate=${formatMoney(rate)}/s avg=${formatMoney(avgRate)}/s total=${formatMoney(totalHacked)} workers=${workers.length}`
    )

    // Write structured status JSON (overwritten each loop) so the Bitburner File Sync extension can pull it
    try {
      const status = {
        ts: Date.now(),
        target: currentTarget,
        plan: plan.type,
        currentSecurity: plan.currentSecurity,
        moneyPct: plan.moneyPct,
        needWeaken: requiredWeaken,
        maxWeaken: maxWeaken,
        homeFreeRam: homeFreeRam,
        hacked: hacked,
        rate: rate,
        avgRate: avgRate,
        totalHacked: totalHacked,
        workers: allocations,
        candidate: candidateTarget || null,
        candidateScore: candidateScore || 0,
        candidateExpectedIncome: candidateExpectedIncome || 0,
      }
      ns.write("mcp_status.json", JSON.stringify(status), "w")

      // Append a single-line human readable log for quick review
      const line = `[${new Date(status.ts).toISOString()}] target=${status.target} plan=${status.plan} needWeaken=${status.needWeaken} maxWeaken=${status.maxWeaken} hacked=${formatMoney(status.hacked)} rate=${formatMoney(status.rate)}/s workers=${status.workers.length}\n`
      ns.write("mcp_status.log", line, "a")
    } catch (e) {
      ns.print("mcp: failed to write status file: " + e)
    }

    lastAvgRate = avgRate
    await ns.sleep(LOOP_SLEEP_MS)
  }
}
