/** Pure choices for xp_filler.js. No ns calls, no side effects. */
export const WORKER_RAM = 1.75

/** Threads that fit while keeping a small margin on the host. */
export function fillerThreads(maxRam, usedRam, reserveFraction = 0.05) {
  return Math.max(0, Math.floor((maxRam * (1 - reserveFraction) - usedRam) / WORKER_RAM))
}

/** The largest cloud servers stay clear so MCP cohorts always fit whole. */
export function fillableCloud(hosts, keepClear = 3) {
  return [...hosts].sort((a, b) => b.max - a.max || a.host.localeCompare(b.host)).slice(keepClear).map(h => h.host)
}

/** Best XP per thread-second; ties go to the shorter weaken. */
export function bestXpTarget(candidates) {
  return [...candidates].filter(c => c.weakenMs > 0 && c.exp > 0)
    .sort((a, b) => b.exp / b.weakenMs - a.exp / a.weakenMs || a.weakenMs - b.weakenMs)[0]?.host ?? null
}
