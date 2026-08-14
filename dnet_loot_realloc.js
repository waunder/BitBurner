/**
 * Lean darknet loot variant: RAM-freeing only (memoryReallocation), no
 * cache opening. Added 2026-08-12 because dnet_loot.js's full RAM cost
 * (5.55GB, see its own header comment) doesn't fit hosts whose free RAM
 * sits in the roughly 3.35-5.55GB band -- dnet_deploy.js's lootDeploy() now
 * tries the full script first and falls back to this one when the full
 * script doesn't fit, instead of a flat skip. See docs/darknet-functions.md
 * "Phase 3b" for the numbers behind the fallback and docs/darknet-tactics.md
 * for why RAM-freeing (not cache-opening) was chosen as the cheaper
 * fallback capability.
 *
 * Shares freeBlockedRam with dnet_loot.js (both import it from
 * dnet_lib.js) so the two scripts can't drift out of sync on the actual
 * reallocation loop.
 *
 * NOT YET RUN IN BITBURNER.
 *
 * Args: --max-realloc N (cap reallocation calls, default 25).
 *
 * RAM estimate ~3.35GB: 1.6 base + getServerDetails 0.1 + memoryReallocation
 * 1 + scp 0.6 + getHostname 0.05 = 3.35. getBlockedRam and write are 0GB.
 * The game's own readout is the authority, not this arithmetic -- see
 * dnet_loot.js's header for how far off a hand estimate turned out to be
 * for the full script (missed one reachable ns call), so confirm this
 * number live too before trusting it for the next RAM-fit decision.
 *
 * A meaningful result becomes an immutable timestamped event shard, using
 * the same cumulative ledger as dnet_loot.js and distinguished by
 * `mode: "realloc-only"`.
 *
 * @param {NS} ns
 */
import { freeBlockedRam, lootEventShardName } from "dnet_lib.js"

export async function main(ns) {
  ns.disableLog("ALL")
  const flags = ns.flags([["max-realloc", 25]])

  const host = ns.getHostname()
  const details = ns.dnet.getServerDetails()
  if (!details.isOnline) {
    ns.tprint(`dnet_loot_realloc: ${host} reports offline; nothing to do`)
    return
  }

  const report = { host, model: details.modelId, difficulty: details.difficulty, mode: "realloc-only" }
  report.ram = await freeBlockedRam(ns, host, flags["max-realloc"])

  ns.tprint(`dnet_loot_realloc: ${JSON.stringify(report)}`)

  const ramFreed = Math.max(0, (report.ram?.before ?? 0) - (report.ram?.after ?? 0))
  if (ramFreed <= 0) return

  const at = Date.now()
  const shard = lootEventShardName(host, at)
  ns.write(shard, JSON.stringify({ ...report, at }), "w")
  if (host !== "home") {
    try {
      ns.scp(shard, "home")
    } catch (err) {
      ns.print(`WARN shipping ${shard} to home: ${err}`)
    }
  }
}

export function autocomplete() {
  return ["--max-realloc"]
}
