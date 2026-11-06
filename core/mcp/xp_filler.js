/**
 * Turns cloud and rooted-host RAM MCP is not using into hacking XP. Each pass starts one-shot
 * weakens on the best XP target, keeping the three largest cloud servers clear so MCP cohorts still fit,
 * plus servers holding the RAM budgets of running stacks so their launches never find the fleet full.
 * Weakening cannot hurt a target. Stop it by killing this script; workers finish alone.
 * Also keeps share.js on the smallest fillable cloud servers (`share_policy.json` cloudServers, default 8,
 * set by `share_deploy.js cloud N` / `stop`), so share comes back by itself after an install.
 *
 * Start: run xp_filler.js. Writes xp_filler_status.json.
 * @param {NS} ns
 */
import { LEGACY_BUDGET_GB, readStacks } from "stack_files.js"
import { SHARE_POLICY, bestXpTarget, fillableCloud, fillerThreads, shareCloudHosts, shareServers } from "xp_filler_logic.js"

const WORKER = "scripts/xp_weaken.js"
const SHARE = "scripts/share.js"
const STATUS = "xp_filler_status.json"
const POLL_MS = 20_000

function stackReserve(ns) {
  return readStacks(ns).reduce((sum, s) => sum + (s.ramBudget || LEGACY_BUDGET_GB), 0)
}

function rootedHosts(ns) {
  const seen = new Set(["home"])
  for (const host of seen) for (const next of ns.scan(host)) seen.add(next)
  return [...seen].filter(h => h !== "home" && h !== "darkweb" && ns.hasRootAccess(h) && ns.getServerRequiredHackingLevel(h) <= ns.getHackingLevel())
}

/** Fills the share servers with share.js and stops it on every other cloud server. */
function keepSharing(ns, cloud, hosts) {
  for (const host of cloud) if (!hosts.includes(host)) ns.scriptKill(SHARE, host)
  let threads = 0
  for (const host of hosts) {
    ns.scriptKill(WORKER, host)
    const want = Math.floor((ns.getServerMaxRam(host) - ns.getServerUsedRam(host)) / ns.getScriptRam(SHARE, "home"))
    if (want < 1) continue
    ns.scp(SHARE, host, "home")
    if (ns.exec(SHARE, host, want)) threads += want
  }
  return threads
}

export async function main(ns) {
  ns.disableLog("ALL")
  while (true) {
    const player = ns.getPlayer()
    const cloud = new Set(ns.cloud.getServerNames())
    const rooted = rootedHosts(ns).filter(h => !cloud.has(h))
    const target = bestXpTarget(rooted.map(host => ({
      host, exp: ns.formulas.hacking.hackExp(ns.getServer(host), player), weakenMs: ns.getWeakenTime(host),
    })))
    let started = 0, threads = 0
    const cloudHosts = [...cloud].map(host => ({ host, max: ns.getServerMaxRam(host) }))
    const reserve = stackReserve(ns)
    const shareHosts = shareCloudHosts(cloudHosts, shareServers(ns.read(SHARE_POLICY)), reserve)
    const shareStarted = keepSharing(ns, cloud, shareHosts)
    // Rooted hosts need no margin.
    const fillable = fillableCloud(cloudHosts, 3, reserve).filter(host => !shareHosts.includes(host))
    if (target) for (const host of ["home", ...fillable, ...rooted]) {
      // MCP schedules on home too, so the filler takes at most half of it.
      const want = fillerThreads(ns.getServerMaxRam(host), ns.getServerUsedRam(host), host === "home" ? 0.5 : cloud.has(host) ? 0.05 : 0)
      if (want < 1) continue
      if (host !== "home") ns.scp(WORKER, host, "home")
      if (ns.exec(WORKER, host, want, target)) { started++; threads += want }
    }
    ns.write(STATUS, JSON.stringify({ ts: Date.now(), target, started, threads, shareHosts, shareStarted }), "w")
    await ns.sleep(POLL_MS)
  }
}
