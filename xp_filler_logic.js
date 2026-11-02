/** Pure choices for xp_filler.js. No ns calls, no side effects. */
export const WORKER_RAM = 1.75

/** Threads that fit while keeping a small margin on the host. */
export function fillerThreads(maxRam, usedRam, reserveFraction = 0.05) {
  return Math.max(0, Math.floor((maxRam * (1 - reserveFraction) - usedRam) / WORKER_RAM))
}

/** The largest cloud servers stay clear so MCP cohorts fit whole, plus enough more to hold reserveRam. */
export function fillableCloud(hosts, keepClear = 3, reserveRam = 0) {
  const sorted = [...hosts].sort((a, b) => b.max - a.max || a.host.localeCompare(b.host))
  let skip = keepClear, held = 0
  while (skip < sorted.length && held < reserveRam) held += sorted[skip++].max
  return sorted.slice(skip).map(h => h.host)
}

/** Best XP per thread-second; ties go to the shorter weaken. */
export function bestXpTarget(candidates) {
  return [...candidates].filter(c => c.weakenMs > 0 && c.exp > 0)
    .sort((a, b) => b.exp / b.weakenMs - a.exp / a.weakenMs || a.weakenMs - b.weakenMs)[0]?.host ?? null
}
