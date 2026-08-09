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
 * RAM estimate ~4.95GB: 1.6 base + openCache 2 + memoryReallocation 1 +
 * getServerDetails 0.1 + ls 0.2 + getHostname 0.05. getBlockedRam is 0GB.
 * The game's RAM readout is the authority.
 *
 * @param {NS} ns
 */
import { CODE } from "dnet_lib.js"

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

  const report = { host, model: details.modelId, difficulty: details.difficulty }

  if (!flags["no-ram"]) report.ram = await freeBlockedRam(ns, host, flags["max-realloc"])
  if (!flags["no-cache"]) report.caches = openCaches(ns, host)

  ns.tprint(`dnet_loot: ${JSON.stringify(report)}`)
}

/**
 * Reclaim blocked RAM, checking getBlockedRam (0GB) before and after each 1GB
 * call so we never pay for a reallocation that had nothing to reclaim, and so
 * a call that frees nothing terminates the loop instead of spinning.
 */
async function freeBlockedRam(ns, host, maxCalls) {
  const before = ns.dnet.getBlockedRam()
  if (before <= 0) return { before, after: before, calls: 0, why: "nothing blocked" }

  let calls = 0
  let why = "hit call cap"
  while (calls < maxCalls) {
    const remaining = ns.dnet.getBlockedRam()
    if (remaining <= 0) {
      why = "fully reclaimed"
      break
    }

    const res = await ns.dnet.memoryReallocation()
    calls++

    if (!res.success) {
      why = res.code === CODE.NoBlockRAM ? "fully reclaimed" : `stopped on code ${res.code}: ${res.message}`
      break
    }

    if (ns.dnet.getBlockedRam() >= remaining) {
      why = "call freed nothing; stopping rather than spinning"
      break
    }
  }

  const after = ns.dnet.getBlockedRam()
  ns.print(`REALLOC ${host} before=${before} after=${after} calls=${calls} why=${why}`)
  return { before, after, calls, why }
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
