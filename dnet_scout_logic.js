/** Pure route choices for dnet_scout.js. No ns calls, no side effects. */
export const SCOUT_STATUS = "dnet_scout_status.json"
export const SCOUT_STALE_MS = 5 * 60 * 1000
export const SCOUT_RETRY_MS = 60 * 1000
export const ROUTE_FILE = "dnet_route.json"
export const ROUTE_STALE_MS = 10 * 60 * 1000
const FINISHED = new Set(["dead-end", "hop-limit", "launch-failed"])

/** Unvisited online neighbours one hop away, deepest first, then easiest to crack. */
export function rankHops(neighbours, visited) {
  const seen = new Set(visited)
  return neighbours.filter(n => n.isOnline !== false && n.isConnectedToCurrentServer !== false && !seen.has(n.host) && !n.host.endsWith("l4byr1nth"))
    .sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0) || (a.difficulty ?? 0) - (b.difficulty ?? 0) || a.host.localeCompare(b.host))
}

/** The hosts of a fresh route written by tools/dnet_map.py, or none. */
export function freshRoute(route, now, staleMs = ROUTE_STALE_MS) {
  return Array.isArray(route?.path) && Number.isFinite(route.ts) && now - route.ts < staleMs ? route.path : []
}

/** Neighbours further along the route than this host, furthest first; only forwards, so a route cannot loop. */
export function routeHops(neighbours, route, host, tried) {
  const here = route.indexOf(host)
  return neighbours.filter(n => route.indexOf(n.host) > here && !tried.has(n.host) && n.isOnline !== false && n.isConnectedToCurrentServer !== false && !n.host.endsWith("l4byr1nth"))
    .sort((a, b) => route.indexOf(b.host) - route.indexOf(a.host))
}

/** A single chain: start another only when the last one has gone quiet. */
export function shouldStartScout(status, now, staleMs = SCOUT_STALE_MS, retryMs = SCOUT_RETRY_MS) {
  const wait = FINISHED.has(status?.state) ? retryMs : staleMs
  return !(Number.isFinite(status?.ts) && now - status.ts < wait)
}

/** Move the single stasis link only to a strictly deeper host, or beside a lab, that can hold the worker. */
export function shouldAnchor(anchorDepth, targetDepth, freeRam, anchorRam, besideLab = false) {
  return Number.isFinite(targetDepth) && (besideLab || targetDepth > (anchorDepth ?? -1)) && freeRam >= anchorRam
}

/** Where to start the next chain: the anchor when it is reachable, else darkweb. */
export function scoutStart(anchors, creds, gateway, lastStatus = null) {
  // A linked host can lose every neighbour, so a dead end there sends one chain round by the gateway.
  const host = anchors.find(name => name !== gateway && typeof creds[name]?.password === "string"
    && !(lastStatus?.state === "dead-end" && lastStatus.host === name))
  return host ?? gateway
}
