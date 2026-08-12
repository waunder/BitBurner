/**
 * One-off diagnostic: dump maxRam/usedRam/free/blockedRam and dnet_loot.js's
 * own RAM cost for a given host (default darkweb), to gut-check the
 * post-cleanup RAM picture -- specifically whether persistent "ram" skips
 * are from script-used RAM (freed by killing the occupant, see
 * dnet_killswarm.js) or from *blocked* RAM (owner-imposed, not freed by
 * killing anything -- only ns.dnet.memoryReallocation frees it, and that's
 * one of dnet_loot.js's own two actions, a chicken-and-egg wrinkle worth
 * seeing plainly rather than guessing at).
 *
 * Args: [host] (default "darkweb")
 *
 * Reads/writes: nothing
 *
 * RAM estimate ~2.0GB: 1.6 base + getServerMaxRam 0.05 + getServerUsedRam
 * 0.05 + getScriptRam 0.1 + getBlockedRam 0 (free).
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const host = ns.args[0] || "darkweb"
  const maxRam = ns.getServerMaxRam(host)
  const usedRam = ns.getServerUsedRam(host)
  const blockedRam = ns.dnet.getBlockedRam(host)
  const lootRam = ns.getScriptRam("dnet_loot.js", ns.getHostname())
  const freeRam = maxRam - usedRam

  ns.tprint(
    `dnet_ramcheck ${host}: maxRam=${maxRam} usedRam=${usedRam} freeRam=${freeRam} ` +
      `blockedRam=${blockedRam} dnet_loot.js needs=${lootRam} fits=${freeRam >= lootRam}`
  )
}
