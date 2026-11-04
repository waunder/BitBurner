/**
 * Temporary remote RAM preparation worker. dnet_deploy.js starts this on the
 * already-running crawler host at the largest thread count that fits and
 * passes a directly-connected authenticated neighbour as argv[0];
 * memoryReallocation scales with threads, so a short-lived worker reclaims
 * blocked RAM much faster without charging every crawler for the 1GB API
 * forever.
 *
 * No telemetry is shipped from here: the parent crawler observes blocked RAM
 * before and after preparation in its normal heartbeat. The worker is safe to
 * lose to a mutation and safe to rerun until getBlockedRam reaches zero.
 *
 * RAM estimate: 2.6GB/thread (1.6GB base + memoryReallocation 1GB).
 * getBlockedRam, read/write, and logging cost 0GB.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL")
  const flags = ns.flags([["max-realloc", 25]])
  const target = String(ns.args[0] ?? ns.getHostname())
  const before = ns.dnet.getBlockedRam(target)
  let after = before
  let calls = 0

  while (after > 0 && calls < flags["max-realloc"]) {
    const prior = after
    const result = await ns.dnet.memoryReallocation(target)
    calls++
    after = ns.dnet.getBlockedRam(target)
    if (!result.success || after >= prior) break
  }

  ns.print(`REALLOC target=${target} before=${before} after=${after} calls=${calls}`)
}

export function autocomplete() {
  return ["--max-realloc"]
}
