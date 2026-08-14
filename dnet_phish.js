/**
 * Lean, restart-tolerant Dark Net idle worker. Every thread repeatedly runs
 * phishingAttack(), converting otherwise-unused darknet RAM into charisma,
 * money, and occasional cache files. The network may kill this process at
 * any mutation; there is intentionally no in-memory state worth preserving.
 *
 * The crawler deploys this only after it has authenticated, reclaimed blocked
 * RAM, spread the crawler, and attempted the one-shot loot pass. Aggregate
 * results are already visible through player charisma in mcp_status.json and
 * the game's `darknet` money-source category, so this worker stays at the
 * minimum useful static RAM cost instead of paying for its own telemetry.
 *
 * RAM estimate: 3.6GB/thread (1.6GB base + phishingAttack 2GB).
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL")
  while (true) {
    const result = await ns.dnet.phishingAttack()
    ns.print(`PHISH success=${result.success} code=${result.code} message=${JSON.stringify(result.message)}`)
    if (result.success && /cache file/i.test(String(result.message))) {
      ns.write(`dnet_phish_cache_${Date.now()}.txt`, "cache generated\n", "w")
      return
    }
  }
}
