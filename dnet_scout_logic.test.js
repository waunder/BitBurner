import { test } from "node:test"
import assert from "node:assert/strict"
import { promoteThreads, rankHops, shouldStartScout, scoutStart, shouldAnchor, freshRoute, routeHops } from "./dnet_scout_logic.js"

test("prefers deeper, then easier, unvisited hosts", () => {
  const hops = rankHops([
    { host: "shallow", depth: 1, difficulty: 0 }, { host: "hard", depth: 3, difficulty: 9 },
    { host: "easy", depth: 3, difficulty: 2 }, { host: "seen", depth: 9 }, { host: "down", depth: 9, isOnline: false },
    { host: "th3_l4byr1nth", depth: 7 },
  ], ["seen"])
  assert.deepEqual(hops.map(h => h.host), ["easy", "hard", "shallow"])
})
test("keeps a single chain until its status goes stale", () => {
  assert.equal(shouldStartScout(null, 1000), true)
  assert.equal(shouldStartScout({ ts: 1000 }, 2000, 5000), false)
  assert.equal(shouldStartScout({ ts: 1000 }, 7000, 5000), true)
})
test("restarts sooner after a chain has finished", () => {
  assert.equal(shouldStartScout({ ts: 1000, state: "dead-end" }, 2000, 5000, 500), true)
  assert.equal(shouldStartScout({ ts: 1000, state: "hopped" }, 2000, 5000, 500), false)
})

test("rankHops skips probed hosts that are not directly connected", () => {
  const hops = rankHops([
    { host: "far", depth: 5, isConnectedToCurrentServer: false },
    { host: "near", depth: 2, isConnectedToCurrentServer: true },
  ], [])
  assert.deepEqual(hops.map(n => n.host), ["near"])
})

test("the anchor moves only to a deeper host with room for the worker", () => {
  assert.equal(shouldAnchor(2, 3, 15, 14), true)
  assert.equal(shouldAnchor(undefined, 0, 15, 14), true)
  assert.equal(shouldAnchor(3, 3, 15, 14), false)
  assert.equal(shouldAnchor(2, 3, 8, 14), false)
})

test("chains start at a stasis anchor whose password is known", () => {
  assert.equal(scoutStart(["deep"], { deep: { password: "x" } }, "darkweb"), "deep")
  assert.equal(scoutStart(["deep"], {}, "darkweb"), "darkweb")
  assert.equal(scoutStart([], {}, "darkweb"), "darkweb")
})

test("a dead end at the anchor sends the next chain through the gateway", () => {
  const creds = { deep: { password: "x" } }
  assert.equal(scoutStart(["deep"], creds, "darkweb", { state: "dead-end", host: "deep" }), "darkweb")
  assert.equal(scoutStart(["deep"], creds, "darkweb", { state: "dead-end", host: "darkweb" }), "deep")
})

test("routeHops only moves forward along a fresh route", () => {
  const route = ["darkweb", "a", "b", "c"]
  const hops = [{ host: "a" }, { host: "b" }, { host: "x", depth: 9 }, { host: "c", isConnectedToCurrentServer: false }]
  assert.deepEqual(routeHops(hops, route, "a", new Set()).map(n => n.host), ["b"])
  assert.deepEqual(routeHops(hops, route, "x", new Set(["b"])).map(n => n.host), ["a"])
  assert.deepEqual(routeHops([{ host: "darkweb" }], route, "x", new Set()), [])
  assert.deepEqual(routeHops(hops, [], "a", new Set()), [])
})

test("freshRoute ignores a stale or malformed route", () => {
  assert.deepEqual(freshRoute({ ts: 100, path: ["a"] }, 200, 1000), ["a"])
  assert.deepEqual(freshRoute({ ts: 100, path: ["a"] }, 2000, 1000), [])
  assert.deepEqual(freshRoute(null, 200), [])
})

test("shouldAnchor allows a same-depth move beside a lab", () => {
  assert.equal(shouldAnchor(6, 6, 20, 14.2), false)
  assert.equal(shouldAnchor(6, 6, 20, 14.2, true), true)
  assert.equal(shouldAnchor(6, 6, 10, 14.2, true), false)
})

test("promoteThreads fits whole threads in free RAM", () => {
  assert.equal(promoteThreads(32, 2, 3.6), 8)
  assert.equal(promoteThreads(16, 14, 3.6), 0)
  assert.equal(promoteThreads(16, 17, 3.6), 0)
})
