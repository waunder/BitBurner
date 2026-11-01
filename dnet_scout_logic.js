/** Pure route choices for dnet_scout.js. No ns calls, no side effects. */
export const SCOUT_STATUS = "dnet_scout_status.json"
export const SCOUT_STALE_MS = 5 * 60 * 1000
export const SCOUT_RETRY_MS = 60 * 1000
const FINISHED = new Set(["dead-end", "hop-limit", "launch-failed"])

/** Unvisited online neighbours, deepest first, then easiest to crack. */
export function rankHops(neighbours, visited) {
  const seen = new Set(visited)
  return neighbours.filter(n => n.isOnline !== false && !seen.has(n.host) && !n.host.endsWith("l4byr1nth"))
    .sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0) || (a.difficulty ?? 0) - (b.difficulty ?? 0) || a.host.localeCompare(b.host))
}

/** A single chain: start another only when the last one has gone quiet. */
export function shouldStartScout(status, now, staleMs = SCOUT_STALE_MS, retryMs = SCOUT_RETRY_MS) {
  const wait = FINISHED.has(status?.state) ? retryMs : staleMs
  return !(Number.isFinite(status?.ts) && now - status.ts < wait)
}
