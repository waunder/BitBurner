/**
 * Safe secondary actions on the darknet server this script is running on:
 * open .cache files, and free blocked RAM only when there is blocked RAM to
 * free. Deliberately excludes everything with a limited budget or a blast
 * radius — no setStasisLink, no induceServerMigration, and emphatically no
 * unleashStormSeed.
 *
 * NOT YET RUN IN BITBURNER.
 *
 * Two costs worth knowing before running this, both read out of the game's
 * bundle rather than observed:
 *  - openCache charges karma equal to (server difficulty + 1) per cache. The
 *    returned CacheResult.karmaLoss reports it as a negative number. Cheap on
 *    the shallow servers, not free, and karma is a one-way ratchet.
 *  - memoryReallocation must target an authenticated, directly connected
 *    server (or default to the current one) and returns code 454 / NoBlockRAM
 *    once there is nothing left to reclaim. That code is the stop signal, not
 *    an error.
 *
 * Args: --no-cache (skip cache opening), --no-ram (skip reallocation),
 * --max-realloc N (cap reallocation calls, default 25).
 *
 * RAM estimate ~5.55GB: 1.6 base + openCache 2 + memoryReallocation 1 +
 * getServerDetails 0.1 + ls 0.2 + getHostname 0.05 + scp 0.6 = 5.55.
 * Corrected 2026-08-12: the original ~4.95GB estimate above simply forgot
 * the ns.scp(shard, "home") call a few lines down in main() -- 4.95 + 0.6
 * (scp) = 5.55 exactly, which is also the number a live dnet_ramcheck.js
 * run against this file measured (see docs/darknet-functions.md's Phase 3b
 * section and docs/claude-todo.md's 2026-08-12 entry). Not a mystery once
 * checked, but it was quietly wrong for a while -- the doc comment counted
 * one fewer reachable ns call than the code actually makes. getBlockedRam
 * is 0GB. The game's own RAM readout is still the authority, not this
 * arithmetic.
 *
 * Added 2026-08-12: writes its own report as a per-host shard
 * (dnet_loot_<host>.json, same reasoning as dnet_lib.js's credential
 * shards -- many roaming instances looting concurrently would clobber one
 * shared file) and ships it to home. dnet_loot_merge.js folds these into
 * dnet_status.json's "loot" section, same relationship dnet_creds_merge.js
 * has to credential shards. The report carries `mode: "full"` so a merge
 * can tell a full pass apart from a dnet_loot_realloc.js (RAM-only lean
 * variant, added same day) pass over the same host.
 *
 * @param {NS} ns
 */
import { freeBlockedRam } from "dnet_lib.js"

export async function main(ns) {
  ns.disableLog("ALL")
  const flags = ns.flags([
    ["no-cache", false],
    ["no-ram", false],
    ["max-realloc", 25],
  ])

  const host = ns.getHostname()
  const details = ns.dnet.getServerDetails()
  if (!details.isOnline) {
    ns.tprint(`dnet_loot: ${host} reports offline; nothing to do`)
    return
  }

  const report = { host, model: details.modelId, difficulty: details.difficulty, mode: "full" }

  if (!flags["no-ram"]) report.ram = await freeBlockedRam(ns, host, flags["max-realloc"])
  if (!flags["no-cache"]) report.caches = openCaches(ns, host)

  ns.tprint(`dnet_loot: ${JSON.stringify(report)}`)

  const shard = `dnet_loot_${host}.json`
  ns.write(shard, JSON.stringify({ ...report, at: Date.now() }), "w")
  if (host !== "home") {
    try {
      ns.scp(shard, "home")
    } catch (err) {
      ns.print(`WARN shipping ${shard} to home: ${err}`)
    }
  }
}

/**
 * Open every .cache on this server. Cache files are generated as
 * <prefix>_<3 digits>.cache, with .d.cache marking the richer deep-net
 * variant, so a plain ".cache" substring match catches both.
 */
function openCaches(ns, host) {
  const files = ns.ls(host, ".cache")
  const opened = []
  let karma = 0

  for (const file of files) {
    let res
    try {
      res = ns.dnet.openCache(file)
    } catch (err) {
      ns.print(`WARN openCache ${file} threw: ${err}`)
      continue
    }
    if (!res.success) {
      ns.print(`WARN openCache ${file} failed: ${res.message}`)
      continue
    }
    karma += res.karmaLoss ?? 0
    opened.push({ file, message: res.message, karmaLoss: res.karmaLoss })
    ns.print(`CACHE ${host} ${file} karma=${res.karmaLoss} ${res.message}`)
  }

  return { found: files.length, opened: opened.length, karma, detail: opened }
}

export function autocomplete() {
  return ["--no-cache", "--no-ram", "--max-realloc"]
}
