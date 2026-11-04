/**
 * Spends idle cash on hacking capacity and starts managers once they fit.
 * Buys TOR, port openers, home RAM and cloud RAM; never touches augmentations.
 * `capital_policy.json` is read every pass: enabled, reserve, homeRamTarget,
 * cloudFraction, saveWindowSec, homeRamFloor, cloudDemandFloor. Writes every purchase to `capital_status.json`.
 * Start: `run capital_manager.js` (startup.js launches it).
 * @param {NS} ns
 */
import { readStacks } from "stack_files.js"
import { PROGRAMS, chooseCapitalAction, nextScriptToStart } from "capital_logic.js"

const POLICY = "capital_policy.json"
const STATUS = "capital_status.json"
const POLL_MS = 10_000
const INCOME_WINDOW_SEC = 600
// Resident scripts only: one that exits at once (gang-controller.js without a
// gang) would be relaunched every pass. The profile's startup list follows.
const MANAGERS = ["maintenance_steward.js", "money.js", "stack_manager.js", "faction_join.js", "hud_consolidated.js", "run_report.js", "player_activity_controller.js", "dnet_root.js"]
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
  const name = nextScriptToStart(scripts, ns.getServerMaxRam(home) - ns.getServerUsedRam(home))
  return name && ns.run(name) ? name : null
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
    let action = null, ok = null
    if (policy.enabled !== false) {
      const input = { ...observe(ns, policy), ramUtilization: readUtilization(ns), incomePerSec, saveWindowSec: Number(policy.saveWindowSec) || 300, homeRamFloor: Number(policy.homeRamFloor) || 128, cloudDemandFloor: Number(policy.cloudDemandFloor ?? 0.5) }
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
    ns.write(STATUS, JSON.stringify({ ts: Date.now(), policy, incomePerSec, action, ok, started, purchases }), "w")
    // Keep buying while purchases succeed; otherwise wait for income.
    await ns.sleep(ok ? 200 : POLL_MS)
  }
}
