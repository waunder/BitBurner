/**
 * Waits on a host being lifted, then starts a scout once the host has moved past the
 * row it left, so the chain carries on from the far side of the empty row. Stays
 * resident, because a lifted host can arrive with no links and gain them later.
 *
 * Start: dnet_lift.js. Args: <starting depth>.
 * @param {NS} ns
 */
import { RIDER_STATUS, labSolved, riderShouldScout } from "dnet_scout_logic.js"

const SCOUT = "dnet_scout.js"
const LAB_STATUS = "dnet_lab_status.json"
const POLL_MS = 15_000
const RETRY_MS = 120_000

export async function main(ns) {
  ns.disableLog("ALL")
  const host = ns.getHostname()
  const start = Number(ns.args[0])
  let tried = ""
  let triedAt = 0
  let lastDepth = start
  const report = (state, extra = {}) => {
    ns.write(RIDER_STATUS, JSON.stringify({ ts: Date.now(), state, host, start, depth: lastDepth, ...extra }), "w")
    ns.scp(RIDER_STATUS, "home")
  }
  const solved = () => {
    ns.scp(LAB_STATUS, host, "home")
    try { return labSolved(JSON.parse(ns.read(LAB_STATUS) || "null"), ns.getResetInfo().lastAugReset) } catch { return false }
  }
  report("waiting")
  for (;;) {
    await ns.sleep(POLL_MS)
    // Past the solve, its scouts would only keep dnet_root.js from sending chains out from the gateway.
    if (solved()) return report("finished")
    const depth = ns.dnet.getDepth(host)
    const neighbours = ns.dnet.probe()
    if (depth !== lastDepth) {
      lastDepth = depth
      report("moved", { neighbours })
    }
    if (riderShouldScout(start, depth, neighbours, tried, triedAt, Date.now(), RETRY_MS)) {
      tried = [...neighbours].sort().join()
      triedAt = Date.now()
      ns.kill("dnet_promote.js", host) // Left by the last scout; the next one needs the RAM.
      report("scouting", { neighbours, pid: ns.exec(SCOUT, host, { preventDuplicates: true }) })
    }
  }
}
