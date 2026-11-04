/**
 * Runs dnet_loot.js on every darknet server this player has a known
 * password for, one at a time from home. Ties together dnet_lib.js's
 * acquireSession (0.05GB connectToSession on a known password works at
 * any distance and costs zero instability, per docs/darknet-tactics.md
 * §2) with dnet_loot.js's own per-host safe actions.
 *
 * Deliberately sequential, not parallel: dnet_loot.js's RAM cost varies
 * with which flags it needs, and checking free RAM against a live number
 * per host (rather than assuming a fixed budget for N simultaneous
 * copies) is simpler and safer when nothing here is time-critical.
 *
 * Skips a host if its free RAM can't fit dnet_loot.js -- reported, not an
 * error. Waits for each copy to finish (isRunning poll, capped) before
 * moving on, since dnet_loot.js's own shard write needs to have happened
 * before dnet_loot_merge.js is worth running.
 *
 * Bug fixed 2026-08-12: originally checked
 * `ns.dnet.getServerDetails(host).maxRam`, a field that does not exist on
 * `DarknetServerDetails` (checked NetscriptDefinitions.d.ts directly --
 * the interface has no maxRam/usedRam/freeRam field at all, only
 * `blockedRam`, which is a different concept: RAM the server owner has
 * blocked, reclaimable via memoryReallocation, not the host's exec
 * capacity). Every "too little RAM" skip this reported was actually
 * `undefined < lootRam`, always true -- it skipped every host
 * unconditionally, regardless of real capacity. The correct check is the
 * same one `mcp.js`/`dnet_deploy.js` use for any host, darknet or not:
 * `ns.getServerMaxRam(host) - ns.getServerUsedRam(host)`.
 *
 * Args: --limit N (stop after N hosts, default: all), --wait-ms N
 * (per-host completion timeout, default 15000).
 *
 * Reads:  dnet_creds.txt
 * Writes: nothing directly -- each spawned dnet_loot.js writes its own
 *         shard (see that file)
 *
 * RAM estimate ~3.2GB: 1.6 base + scp 0.6 + exec 1.3 + getServerMaxRam 0.05
 * + getServerUsedRam 0.05. getScriptRam is 0GB.
 *
 * @param {NS} ns
 */
import { readCreds, acquireSession } from "dnet_lib.js"

const FILES_TO_COPY = ["dnet_loot.js", "dnet_lib.js"]

export async function main(ns) {
  ns.disableLog("ALL")
  const flags = ns.flags([
    ["limit", 0],
    ["wait-ms", 15000],
  ])

  const creds = readCreds(ns)
  const hosts = Object.keys(creds).sort()
  const limited = flags.limit > 0 ? hosts.slice(0, flags.limit) : hosts

  ns.tprint(`dnet_loot_all: looting ${limited.length} known host(s)...`)

  const lootRam = ns.getScriptRam("dnet_loot.js", "home")
  let looted = 0
  let skippedRam = 0
  let skippedSession = 0
  let skippedCopy = 0

  for (const host of limited) {
    if (host === "home") continue

    const session = await acquireSession(ns, host, creds[host])
    if (!session.ok) {
      ns.print(`SKIP ${host}: no session (${session.why})`)
      skippedSession++
      continue
    }

    const freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host)
    if (freeRam < lootRam) {
      ns.print(`SKIP ${host}: free RAM ${freeRam} < ${lootRam} needed`)
      skippedRam++
      continue
    }

    if (!ns.scp(FILES_TO_COPY, host)) {
      ns.print(`SKIP ${host}: scp failed`)
      skippedCopy++
      continue
    }

    const pid = ns.exec("dnet_loot.js", host, 1)
    if (pid === 0) {
      ns.print(`SKIP ${host}: exec failed (pid 0)`)
      continue
    }

    const deadline = Date.now() + flags["wait-ms"]
    while (ns.isRunning(pid, host) && Date.now() < deadline) {
      await ns.sleep(200)
    }
    looted++
  }

  ns.tprint(
    `dnet_loot_all: done -- ${looted} looted, ${skippedSession} no session, ` +
      `${skippedRam} too little RAM, ${skippedCopy} scp failed. ` +
      `Run dnet_loot_merge.js on home to total the results.`
  )
}

export function autocomplete() {
  return ["--limit", "--wait-ms"]
}
