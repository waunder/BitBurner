/**
 * Crosses the empty darknet rows. Row 8 can never hold a host, and links join only
 * adjacent rows, so no chain walks past 7. induceServerMigration moves a neighbour
 * instead, and a move keeps the scripts running on it. This plants dnet_rider.js on
 * the best neighbour, starts dnet_induce.js with the RAM left here, and exits.
 *
 * Start: dnet_root.js, on each stasis-linked host with no dnet_induce.js running.
 * @param {NS} ns
 */
import { CREDS_FILE, readCreds } from "dnet_lib.js"
import { LIFT_STATUS, liftTargets } from "dnet_scout_logic.js"

const INDUCE = "dnet_induce.js"
const INDUCE_RAM = 5.6 // Fixed so this script saves getScriptRam's 0.1GB.
const RIDER = "dnet_rider.js"
const RIDER_ROOM = 13.5 // The rider and one scout, both resident on arrival.
const KIT = [RIDER, "dnet_anchor.js", "dnet_scout.js", "dnet_scout_logic.js", "dnet_lib.js", "dnet_feedback.js", "dnet_lab.js", "dnet_lab_logic.js", "dnet_loot.js", "dnet_promote.js"]

export async function main(ns) {
  ns.disableLog("ALL")
  const here = ns.getHostname()
  const report = (state, extra = {}) => {
    ns.write(LIFT_STATUS, JSON.stringify({ ts: Date.now(), state, host: here, ...extra }), "w")
    ns.scp(LIFT_STATUS, "home")
  }
  await ns.scp(CREDS_FILE, here, "home")
  const creds = readCreds(ns)
  const linked = ns.dnet.getStasisLinkedServers()
  const options = []
  for (const host of ns.dnet.probe()) {
    try { options.push({ host, ...ns.dnet.getServerDetails(host), maxRam: ns.getServerMaxRam(host), linked: linked.includes(host), hasCred: typeof creds[host]?.password === "string" }) } catch { /* moved between calls */ }
  }
  const candidates = liftTargets(options, RIDER_ROOM, ns.dnet.getDepth(here))
  if (!candidates.length) return report("no-target", { neighbours: options.map(n => ({ host: n.host, depth: n.depth, difficulty: n.difficulty, maxRam: n.maxRam, hasCred: n.hasCred })) })

  const refused = []
  for (const target of candidates) {
    if (!ns.dnet.connectToSession(target.host, creds[target.host].password).success) { refused.push({ host: target.host, why: "session" }); continue }
    if (!(await ns.scp(KIT, target.host))) { refused.push({ host: target.host, why: "scp" }); continue }
    await ns.scp(CREDS_FILE, target.host)
    ns.kill("dnet_promote.js", target.host) // Leaves the room a rider and scout need.
    if (!ns.ps(target.host).some(proc => proc.filename.replace(/^\//, "") === RIDER) && !ns.exec(RIDER, target.host, 1, target.depth)) {
      refused.push({ host: target.host, why: "rider", usedRam: ns.getServerUsedRam(target.host), blockedRam: ns.dnet.getBlockedRam(target.host) })
      continue
    }
    // The walker waits for a lab that cannot link here, and threads are what speed the charge.
    ns.kill("dnet_promote.js", here)
    ns.kill("dnet_lab.js", here)
    // This script's own RAM frees on exit, which leaves room for a chain to start here.
    const threads = Math.floor((ns.getServerMaxRam(here) - ns.getServerUsedRam(here)) / INDUCE_RAM)
    const pid = threads > 0 ? ns.exec(INDUCE, here, threads, target.host) : 0
    return report(pid ? "lifting" : "no-room", { target: target.host, depth: target.depth, difficulty: target.difficulty, maxRam: target.maxRam, threads, refused })
  }
  report("refused", { refused })
}
