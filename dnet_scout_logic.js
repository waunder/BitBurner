/** Pure route choices for dnet_scout.js. No ns calls, no side effects. */
export const SCOUT_STATUS = "dnet_scout_status.json"
export const SCOUT_STALE_MS = 5 * 60 * 1000
export const SCOUT_RETRY_MS = 60 * 1000
export const ROUTE_FILE = "dnet_route.json"
export const ROUTE_STALE_MS = 10 * 60 * 1000
export const LIFT_STATUS = "dnet_lift_status.json"
export const RIDER_STATUS = "dnet_rider_status.json"
const WALL_EVERY = 8 // Rows 8, 16 and 24 never hold a host.
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
  const here = Math.max(route.indexOf(host), 0) // Off the route, its start is no way forward.
  return neighbours.filter(n => route.indexOf(n.host) > here && !tried.has(n.host) && n.isOnline !== false && n.isConnectedToCurrentServer !== false && !n.host.endsWith("l4byr1nth"))
    .sort((a, b) => route.indexOf(b.host) - route.indexOf(a.host))
}

/** Threads of the charisma worker that fit in a host's free RAM. */
export function promoteThreads(maxRam, usedRam, ram) {
  return ram > 0 ? Math.max(0, Math.floor((maxRam - usedRam) / ram)) : 0
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

/** What a link on target needs: { drop } names the shallowest link to give up at the limit, or null when no link is due. */
export function anchorPlan(links, limit, target, targetDepth, freeRam, anchorRam, besideLab = false) {
  if (links.some(link => link.host === target)) return null
  const byDepth = [...links].sort((a, b) => (a.depth ?? -1) - (b.depth ?? -1))
  const full = links.length >= limit
  const beat = full ? byDepth[0]?.depth : byDepth.at(-1)?.depth
  if (!shouldAnchor(beat, targetDepth, freeRam, anchorRam, besideLab)) return null
  return { drop: full ? byDepth[0]?.host ?? null : null }
}

/** Linked hosts, deepest first, so chains and the walker use the furthest one. */
export function deepestFirst(hosts, depthOf) {
  return [...hosts].sort((a, b) => (depthOf(b) ?? -1) - (depthOf(a) ?? -1))
}

/** True once this install's lab is solved, so reach no longer matters. */
export function labSolved(status, lastAugReset) {
  return status?.state === "solved" && status.ts > lastAugReset
}

/** Where to start the next chain: the anchor when it is reachable, else darkweb. */
export function scoutStart(anchors, creds, gateway, lastStatus = null) {
  // A linked host can lose every neighbour, so a dead end there sends one chain round by the gateway.
  const host = anchors.find(name => name !== gateway && typeof creds[name]?.password === "string"
    && !(lastStatus?.state === "dead-end" && lastStatus.host === name))
  return host ?? gateway
}

/** Least difficulty that can pass the next wall from this depth: a migration lands at most difficulty + 4. */
export function liftFloor(depth) {
  const wall = (Math.floor((depth ?? 0) / WALL_EVERY) + 1) * WALL_EVERY
  return wall + 1 - 4
}

/** Neighbours worth lifting: movable, enterable, roomy and able to pass the wall, hardest first because they land deepest, then the most RAM. */
export function liftTargets(neighbours, minRam, depth = 0) {
  const floor = liftFloor(depth)
  return neighbours.filter(n => n.hasCred && !n.linked && !n.isStationary && n.isOnline !== false && n.isConnectedToCurrentServer !== false
    && !n.host.endsWith("l4byr1nth") && (n.difficulty ?? 0) >= floor && n.maxRam - (n.blockedRam ?? 0) >= minRam)
    .sort((a, b) => (b.difficulty ?? 0) - (a.difficulty ?? 0) || b.maxRam - a.maxRam || a.host.localeCompare(b.host))
}

/** A rider scouts once its host is deeper than it started and has links it has not just tried. */
export function riderShouldScout(start, depth, neighbours, tried, triedAt, now, retryMs) {
  if (!(depth > start) || !neighbours.length) return false
  return [...neighbours].sort().join() !== tried || now - triedAt >= retryMs
}
