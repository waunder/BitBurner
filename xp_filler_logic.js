/** Pure choices for xp_filler.js. No ns calls, no side effects. */
export const WORKER_RAM = 1.75

/** RAM MCP keeps on a host, so new cohorts always have room. */
export function fillerThreads(maxRam, usedRam, reserveFraction = 0.3, minReserve = 2048) {
  const reserve = Math.max(maxRam * reserveFraction, minReserve)
  return Math.max(0, Math.floor((maxRam - usedRam - reserve) / WORKER_RAM))
}

/** Best XP per thread-second; ties go to the shorter weaken. */
export function bestXpTarget(candidates) {
  return [...candidates].filter(c => c.weakenMs > 0 && c.exp > 0)
    .sort((a, b) => b.exp / b.weakenMs - a.exp / a.weakenMs || a.weakenMs - b.weakenMs)[0]?.host ?? null
}
