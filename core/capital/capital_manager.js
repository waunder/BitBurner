/**
 * Spends idle cash on hacking capacity and starts managers once they fit.
 * Buys TOR, port openers, home RAM and cloud RAM; never touches augmentations.
 * `capital_policy.json` is read every pass: enabled, reserve, homeRamTarget,
 * cloudFraction, saveWindowSec, homeRamFloor, cloudDemandFloor, and optionally lateCloudDemandFloor and
 * earlyCycleHours (cloudDemandFloorFor: a stricter floor late in each install-to-install cycle), and
 * homeDemandFloor (default 0.5: home RAM is bought only while scripts need that share of it), and
 * lateSpendFraction (lateCycleLimit: late in a cycle home RAM may cost at most that share of cash).
 * Writes every purchase, and `cyclePhase`, to `capital_status.json`.
 * Start: `run capital_manager.js` (startup.js launches it).
 * @param {NS} ns
 */
import { readStacks } from "stack_files.js"
import { PROGRAMS, chooseCapitalAction, portsUseful, cloudDemandFloorFor, lateCycleLimit, nextScriptToStart } from "capital_logic.js"

const POLICY = "capital_policy.json"
const STATUS = "capital_status.json"
const POLL_MS = 10_000
const INCOME_WINDOW_SEC = 600
// Resident scripts only: one that exits at once (gang-controller.js without a
// gang) would be relaunched every pass. The profile's startup list follows.
const MANAGERS = ["maintenance_steward.js", "money.js", "stack_manager.js", "faction_join.js", "hud_consolidated.js", "run_report.js", "player_activity_controller.js", "dnet_root.js", "metrics_logger.js"]
const LAST = ["xp_filler.js"]

function readPolicy(ns) {
  try { return JSON.parse(ns.read(POLICY) || "{}") } catch { return {} }
}

/** MANAGERS, then the active profile's startup scripts, then leftovers fillers. */
function managerList(ns) {
  let profile = []
  try { profile = JSON.parse(ns.read("sync_manifest.json") || "{}").startup ?? [] } catch { /* core only */ }
  return [...new Set([...MANAGERS, ...profile, ...LAST])]
}

function observe(ns, policy) {
  const hasTor = ns.hasTorRouter()
  const cloud = ns.cloud.getServerNames()
  const limit = ns.cloud.getServerLimit(), maxRam = ns.cloud.getRamLimit()
  const cloudQuotes = []
  for (let ram = 8; ram <= maxRam; ram *= 2) cloudQuotes.push({ ram, cost: ns.cloud.getServerCost(ram) })
  const upgradeQuotes = cloud.map(host => {
    const fromRam = ns.getServerMaxRam(host), toRam = fromRam * 2
    return toRam <= maxRam ? { host, fromRam, toRam, cost: ns.cloud.getServerUpgradeCost(host, toRam) } : null
  }).filter(Boolean)
  return {
    spendable: ns.getServerMoneyAvailable("home") - (Number(policy.reserve) || 0),
    hasTor,
    programs: hasTor ? PROGRAMS.map(name => ({ name, owned: ns.fileExists(name, "home"), cost: ns.singularity.getDarkwebProgramCost(name) })) : [],
    homeRam: ns.getServerMaxRam("home"),
    homeRamTarget: Number(policy.homeRamTarget) || 512,
    homeRamCost: ns.singularity.getUpgradeHomeRamCost(),
    cloud, cloudLimit: limit, cloudQuotes, upgradeQuotes,
    cloudFraction: Number(policy.cloudFraction) || 0.5,
  }
}

function buy(ns, action, serverCount) {
  if (action.kind === "tor") return ns.singularity.purchaseTor()
  if (action.kind === "program") return ns.singularity.purchaseProgram(action.name)
  if (action.kind === "home") return ns.singularity.upgradeHomeRam()
  if (action.kind === "cloud") return Boolean(ns.cloud.purchaseServer(`mcp-worker-${serverCount}`, action.ram))
  if (action.kind === "upgrade") return ns.cloud.upgradeServer(action.host, action.toRam)
  return false
}

function startWaitingManager(ns) {
  const home = "home"
  const scripts = managerList(ns).map(name => ({ name, running: ns.scriptRunning(name, home), ram: ns.getScriptRam(name, home) }))
  // mcp.js is started by the steward's recovery, not from this list; while it is
  // down, keep its RAM free so residents cannot crowd out the income engine
  // (BN10 run 2, 128GB home: residents filled 127.95GB and MCP was down 2.6h).
  // While mcp.js runs but cannot fit a batch, hold that batch's RAM too, so killed monitors
  // (HUD, run_report, mcp_xp; Ken 2026-11-11: monitors may always be killed for RAM) stay down.
  const mcpHold = ns.scriptRunning("mcp.js", home) ? readMcpWait(ns).need : ns.getScriptRam("mcp.js", home)
  const name = nextScriptToStart(scripts, ns.getServerMaxRam(home) - ns.getServerUsedRam(home) - mcpHold)
  return name && ns.run(name) ? name : null
}

/** Share of home RAM that scripts need: everything running there except xp_filler's leftover
 * workers, plus managers still waiting for room (and mcp.js while it is down). */
function readHomeDemand(ns) {
  const home = "home", max = ns.getServerMaxRam(home)
  if (!(max > 0)) return 1
  const fillers = new Set(["scripts/xp_weaken.js", "scripts/share.js"])
  const used = ns.ps(home).filter(p => !fillers.has(p.filename))
    .reduce((sum, p) => sum + ns.getScriptRam(p.filename, home) * p.threads, 0)
  const waiting = [...managerList(ns), "mcp.js"].filter(name => !ns.scriptRunning(name, home))
    .reduce((sum, name) => sum + ns.getScriptRam(name, home), 0)
  return (used + waiting) / max
}

/** Ports the next rootable servers need (see portsUseful). */
function readPortsNeeded(ns) {
  const seen = new Set(["home"]), queue = ["home"], servers = []
  while (queue.length) {
    for (const host of ns.scan(queue.shift())) {
      if (seen.has(host)) continue
      seen.add(host)
      queue.push(host)
      servers.push({ rooted: ns.hasRootAccess(host), required: ns.getServerRequiredHackingLevel(host), ports: ns.getServerNumPortsRequired(host) })
    }
  }
  return portsUseful(servers, ns.getHackingLevel())
}

/** GB of MCP's smallest waiting batch while it runs in status `capacity-wait` (under a minute old),
 * plus whether any worker already has that much free. 0 when MCP is not waiting. */
function readMcpWait(ns) {
  try {
    if (!ns.scriptRunning("mcp.js", "home")) return { need: 0, fits: true }
    const s = JSON.parse(ns.read("mcp_status.json"))
    if (s.phase !== "capacity-wait" || !(Date.now() - s.ts < 60_000)) return { need: 0, fits: true }
    const need = Math.min(...(s.waiting ?? []).map(w => Number(w.minimumRam)).filter(r => r > 0))
    if (!Number.isFinite(need)) return { need: 0, fits: true }
    const most = Math.max(0, ...(s.workers ?? []).map(w => Number(w.freeRam) || 0))
    return { need, fits: most >= need || ns.getServerMaxRam("home") - ns.getServerUsedRam("home") >= need }
  } catch { return { need: 0, fits: true } }
}

/** GB MCP needs to buy for when no worker can hold its smallest batch; 0 otherwise. */
function readMcpStarvedRam(ns) {
  const wait = readMcpWait(ns)
  return wait.fits ? 0 : wait.need
}

/** MCP's and the stacks' demand for cloud RAM; xp_filler.js is excluded because it only uses leftovers. */
function readUtilization(ns) {
  try {
    const workers = JSON.parse(ns.read("mcp_status.json")).cloudWorkers
    const threads = workers.flatMap(w => w.actions).reduce((sum, a) => sum + a.threads, 0)
    const stackRam = readStacks(ns).reduce((sum, s) => sum + (s.inFlightRam || 0), 0)
    return (threads * 1.75 + stackRam) / workers.reduce((sum, w) => sum + w.maxRam, 0)
  } catch { return 1 }
}

export async function main(ns) {
  ns.disableLog("ALL")
  const purchases = []
  let last = null, incomePerSec = 0
  while (true) {
    const now = Date.now(), cash = ns.getServerMoneyAvailable("home")
    if (last && now > last.at) {
      // Harvests land in bursts, so average over about ten minutes; a short
      // average flips between saving and spending on every quiet spell.
      const seconds = (now - last.at) / 1000
      const sample = Math.max(0, cash + last.spent - last.cash) / seconds
      const weight = 1 - Math.exp(-seconds / INCOME_WINDOW_SEC)
      incomePerSec = incomePerSec ? incomePerSec + (sample - incomePerSec) * weight : sample
    }
    let spent = 0
    const policy = readPolicy(ns)
    let action = null, ok = null, cyclePhase = null, homeDemand = null, portsNeeded = null
    if (policy.enabled !== false) {
      const hoursSinceInstall = (now - ns.getResetInfo().lastAugReset) / 3.6e6
      cyclePhase = cloudDemandFloorFor(policy, hoursSinceInstall)
      const homeLimit = lateCycleLimit({ policy, hoursSinceInstall, cash })
      const input = { ...observe(ns, policy), ramUtilization: readUtilization(ns), incomePerSec, saveWindowSec: Number(policy.saveWindowSec) || 300, homeRamFloor: Number(policy.homeRamFloor) || 128, cloudDemandFloor: cyclePhase.floor,
        homeDemand: readHomeDemand(ns), homeDemandFloor: Number(policy.homeDemandFloor ?? 0.5), homeSpendLimit: homeLimit.limit,
        mcpBlocked: !ns.scriptRunning("mcp.js", "home") && ns.getServerMaxRam("home") - ns.getServerUsedRam("home") < ns.getScriptRam("mcp.js", "home"),
        mcpStarvedRam: readMcpStarvedRam(ns), portsNeeded: readPortsNeeded(ns) }
      homeDemand = input.homeDemand
      portsNeeded = input.portsNeeded
      action = chooseCapitalAction(input)
      if (action && action.kind !== "save") {
        ok = buy(ns, action, input.cloud.length)
        if (ok) spent = action.cost
        purchases.push({ ts: Date.now(), ok, ...action })
        purchases.splice(0, Math.max(0, purchases.length - 50))
      }
    }
    last = { at: now, cash, spent }
    const started = startWaitingManager(ns)
    ns.write(STATUS, JSON.stringify({ ts: Date.now(), policy, cyclePhase, homeDemand, portsNeeded, incomePerSec, action, ok, started, purchases }), "w")
    // Keep buying while purchases succeed; otherwise wait for income.
    await ns.sleep(ok ? 200 : POLL_MS)
  }
}
