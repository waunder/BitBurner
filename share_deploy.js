/**
 * Launches scripts/share.js threads to boost faction/company reputation
 * faction reputation gain rate (ns.share() — 2.4GB/thread, diminishing
 * returns per thread,
 * see NetscriptDefinitions.d.ts).
 *
 * IMPORTANT CAVEAT: share power only does anything while you are actively
 * doing faction work (in the UI, or via workForFaction). Current company
 * work formulas do not apply share power.
 * This repo has no scripted faction-work automation — running this with
 * nobody doing rep-earning work is a no-op that just burns RAM.
 *
 * Default balanced mode deliberately replaces home's current MCP action
 * workers, claims a bounded 256GB share budget, and lets MCP refill every
 * remaining byte on its next tick. This captures most of share()'s
 * logarithmic benefit without surrendering all 1024GB of home to it.
 *
 * Args: [mode] [shareHomeGb] [reserveHomeGb] [maxThreads]
 *   mode: "balanced" (default; "home" alias), "spare", or "network"
 *   shareHomeGb: bounded home share budget in balanced mode (default 256)
 *   reserveHomeGb: GB protected for controllers (default 32)
 *   maxThreads: cap on total share threads launched (default unlimited)
 *
 * `run share_deploy.js stop` kills every running scripts/share.js instance
 * (home + network) — the reverse of either mode above.
 */

const SHARE_SCRIPT = "/scripts/share.js"
const ACTION_SCRIPTS = new Set(["scripts/weaken.js", "scripts/grow.js", "scripts/hack.js"])
export const DEFAULT_SHARE_HOME_GB = 256

export function targetShareThreads(targetGb, shareRam, maxThreads = Infinity) {
  if (!(targetGb > 0) || !(shareRam > 0) || !(maxThreads > 0)) return 0
  return Math.max(0, Math.min(Math.floor(targetGb / shareRam), Math.floor(maxThreads)))
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

/** @param {NS} ns */
export async function main(ns) {
  const mode = String(ns.args[0] ?? "balanced")
  const validModes = new Set(["balanced", "home", "spare", "network", "stop"])
  if (!validModes.has(mode)) {
    ns.tprint(`share_deploy: unknown mode ${JSON.stringify(mode)}; use balanced, spare, network, or stop.`)
    return
  }

  if (mode === "stop") {
    let killed = 0
    for (const host of scanNetwork(ns)) {
      if (ns.scriptKill(SHARE_SCRIPT, host)) killed++
    }
    ns.tprint(`share_deploy: stopped share.js on ${killed} host(s); MCP will reclaim the RAM on its next tick.`)
    return
  }

  const shareHomeGb = Number(ns.args[1] ?? DEFAULT_SHARE_HOME_GB)
  const reserveHomeGb = Number(ns.args[2] ?? 32)
  const maxThreads = ns.args[3] != null ? Number(ns.args[3]) : Infinity
  const shareRam = ns.getScriptRam(SHARE_SCRIPT)

  // Make every start mode idempotent: replace the prior allocation instead
  // of silently stacking another set of share loops on top of it.
  for (const host of scanNetwork(ns)) ns.scriptKill(SHARE_SCRIPT, host)

  let launched = 0
  let hostsUsed = 0

  async function launchOn(host, reserveGb, hostCap = Infinity) {
    if (launched >= maxThreads) return
    const free = Math.max(0, ns.getServerMaxRam(host) - ns.getServerUsedRam(host) - reserveGb)
    const threads = Math.min(Math.floor(free / shareRam), maxThreads - launched, hostCap)
    if (threads <= 0) return
    if (host !== "home" && !(await ns.scp(SHARE_SCRIPT, host))) return
    const pid = ns.exec(SHARE_SCRIPT, host, threads)
    if (pid !== 0) {
      launched += threads
      hostsUsed++
      ns.tprint(`share_deploy: ${threads} thread(s) on ${host}`)
    }
  }

  if (mode === "balanced" || mode === "home") {
    let killed = 0
    for (const proc of ns.ps("home")) {
      const filename = proc.filename.startsWith("/") ? proc.filename.slice(1) : proc.filename
      if (ACTION_SCRIPTS.has(filename) && ns.kill(proc.pid)) killed++
    }
    const cap = targetShareThreads(shareHomeGb, shareRam, maxThreads)
    await launchOn("home", reserveHomeGb, cap)
    ns.tprint(`share_deploy: balanced home allocation reclaimed ${killed} MCP action process(es); target=${shareHomeGb}GB.`)
  } else {
    await launchOn("home", reserveHomeGb)
  }

  if (mode === "network") {
    for (const host of scanNetwork(ns)) {
      if (host === "home") continue
      if (!ns.hasRootAccess(host)) continue
      await launchOn(host, 0)
    }
  }

  ns.tprint(
    `share_deploy: launched ${launched} share thread(s) across ${hostsUsed} host(s). ` +
      `Current share power: ${ns.getSharePower().toFixed(4)} ` +
      `(only affects rep gain while actively doing faction work). ` +
      `Run "share_deploy.js stop" to undo.`
  )
}
