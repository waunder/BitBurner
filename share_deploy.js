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
 * Deliberately does NOT touch mcp.js or its allocation logic. mcp.js reads
 * each host's *current* free RAM fresh every tick (getHostFreeRam) and
 * excludes "home" from its own worker pool entirely — so:
 *  - Default mode (`run share_deploy.js`) only claims home's free RAM
 *    (minus a reserve for the management scripts already running there).
 *    Zero effect on the money farm.
 *  - `run share_deploy.js network` also claims free RAM on every rooted
 *    worker host. mcp.js will simply see less free RAM next tick and
 *    deploy fewer weaken/grow/hack threads there on its own — a real
 *    trade of hacking income for rep-gain rate, not a bug to fix later.
 *
 * Args: [mode] [reserveHomeGb] [maxThreads]
 *   mode: "home" (default) or "network"
 *   reserveHomeGb: GB left free on home for other scripts (default 16)
 *   maxThreads: cap on total share threads launched (default unlimited)
 *
 * `run share_deploy.js stop` kills every running scripts/share.js instance
 * (home + network) — the reverse of either mode above.
 */

const SHARE_SCRIPT = "/scripts/share.js"

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
  const mode = String(ns.args[0] ?? "home")

  if (mode === "stop") {
    let killed = 0
    for (const host of scanNetwork(ns)) {
      if (ns.scriptKill(SHARE_SCRIPT, host)) killed++
    }
    ns.tprint(`share_deploy: stopped share.js on ${killed} host(s).`)
    return
  }

  const reserveHomeGb = Number(ns.args[1] ?? 16)
  const maxThreads = ns.args[2] != null ? Number(ns.args[2]) : Infinity
  const shareRam = ns.getScriptRam(SHARE_SCRIPT)

  let launched = 0
  let hostsUsed = 0

  function launchOn(host, reserveGb) {
    if (launched >= maxThreads) return
    const free = Math.max(0, ns.getServerMaxRam(host) - ns.getServerUsedRam(host) - reserveGb)
    const threads = Math.min(Math.floor(free / shareRam), maxThreads - launched)
    if (threads <= 0) return
    if (host !== "home") ns.scp(SHARE_SCRIPT, host)
    const pid = ns.exec(SHARE_SCRIPT, host, threads)
    if (pid !== 0) {
      launched += threads
      hostsUsed++
      ns.tprint(`share_deploy: ${threads} thread(s) on ${host}`)
    }
  }

  launchOn("home", reserveHomeGb)

  if (mode === "network") {
    for (const host of scanNetwork(ns)) {
      if (host === "home") continue
      if (!ns.hasRootAccess(host)) continue
      launchOn(host, 0)
    }
  }

  ns.tprint(
    `share_deploy: launched ${launched} share thread(s) across ${hostsUsed} host(s). ` +
      `Current share power: ${ns.getSharePower().toFixed(4)} ` +
      `(only affects rep gain while actively doing faction work). ` +
      `Run "share_deploy.js stop" to undo.`
  )
}
