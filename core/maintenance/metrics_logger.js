/**
 * Resident metrics time series for measured (not two-snapshot) rates.
 *
 * Every 5 minutes, on the wall-clock boundary, appends one JSON line: money
 * and sinceInstall income, skills/exp/karma/city, share power, current work
 * and the controller's reason, faction rep/favor/installs/verdict from
 * augmentation_readiness.json, MCP rate, gang respect/wanted/penalty/ascension
 * from gang_status.json, and RAM over home plus cloud.
 * Stale source files are listed in `stale`, never copied.
 *
 * Writes: metrics_log.txt (bounded to the last KEEP lines, about 5 days).
 * Reads:  augmentation_readiness.json, player_activity_status.json, mcp_status.json, gang_status.json.
 * Start:  run metrics_logger.js (opens no tail window; replaces a prior copy)
 * Local:  tools/metrics.py pull | summary | cycles | rates
 *
 * @param {NS} ns
 */
import { buildSample, trimLog, msToNextTick } from "metrics_logic.js"

const INTERVAL_MS = 5 * 60_000
const LOG = "metrics_log.txt"
const KEEP = 1500
const SLACK = 100

function readJson(ns, file) {
  try {
    const raw = ns.read(file)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function ramTotals(ns) {
  let max = 0, used = 0
  for (const host of ["home", ...ns.cloud.getServerNames()]) {
    max += ns.getServerMaxRam(host)
    used += ns.getServerUsedRam(host)
  }
  return { max, used }
}

function sample(ns) {
  const player = ns.getPlayer()
  return buildSample({
    now: Date.now(),
    resetAt: ns.getResetInfo().lastAugReset,
    money: player.money,
    sources: ns.getMoneySources().sinceInstall,
    player,
    sharePower: ns.getSharePower(),
    readiness: readJson(ns, "augmentation_readiness.json"),
    activity: readJson(ns, "player_activity_status.json"),
    mcp: readJson(ns, "mcp_status.json"),
    gang: readJson(ns, "gang_status.json"),
    ram: ramTotals(ns),
    homeRam: ns.getServerMaxRam("home"),
  })
}

export async function main(ns) {
  ns.disableLog("ALL")
  for (const proc of ns.ps("home")) {
    if (proc.pid !== ns.pid && proc.filename.replace(/^\//, "") === "metrics_logger.js") ns.kill(proc.pid)
  }
  while (true) {
    await ns.sleep(msToNextTick(Date.now(), INTERVAL_MS))
    try {
      ns.write(LOG, JSON.stringify(sample(ns)) + "\n", "a")
      const trimmed = trimLog(ns.read(LOG), KEEP, SLACK)
      if (trimmed !== null) ns.write(LOG, trimmed, "w")
    } catch (e) {
      ns.print(`metrics_logger: sample failed: ${e}`)
    }
  }
}
