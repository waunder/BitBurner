import { test } from "node:test"
import assert from "node:assert/strict"
import { anchorPlan, deepestFirst, labSolved, promoteThreads, rankHops, shouldStartScout, scoutStart, shouldAnchor, freshRoute, routeHops, liftFloor, liftTargets, riderShouldScout } from "./dnet_scout_logic.js"

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

test("anchorPlan adds a link below the limit and keeps the old one", () => {
  assert.deepEqual(anchorPlan([{ host: "a", depth: 0 }], 2, "b", 3, 15, 14), { drop: null })
  assert.equal(anchorPlan([{ host: "a", depth: 5 }], 2, "b", 3, 15, 14), null)
})

test("anchorPlan gives up the shallowest link at the limit", () => {
  const links = [{ host: "deep", depth: 7 }, { host: "near", depth: 2 }]
  assert.deepEqual(anchorPlan(links, 2, "b", 3, 15, 14), { drop: "near" })
  assert.equal(anchorPlan(links, 2, "b", 2, 15, 14), null)
  assert.deepEqual(anchorPlan(links, 2, "b", 1, 15, 14, true), { drop: "near" })
})

test("anchorPlan ignores a linked host and a full one", () => {
  assert.equal(anchorPlan([{ host: "b", depth: 1 }], 2, "b", 3, 15, 14), null)
  assert.equal(anchorPlan([], 2, "b", 3, 8, 14), null)
  assert.deepEqual(anchorPlan([], 1, "b", 0, 15, 14), { drop: null })
})

test("deepestFirst orders by depth", () => {
  const depth = { a: 1, b: 6 }
  assert.deepEqual(deepestFirst(["a", "b"], h => depth[h]), ["b", "a"])
})

test("lifts the hardest roomy neighbour it can enter", () => {
  const base = { hasCred: true, difficulty: 8, maxRam: 32 }
  const hosts = liftTargets([
    { ...base, host: "small", maxRam: 16 }, { ...base, host: "blocked", maxRam: 32, blockedRam: 30 },
    { ...base, host: "locked", hasCred: false }, { ...base, host: "linked", linked: true },
    { ...base, host: "fixed", isStationary: true }, { ...base, host: "shallow", difficulty: 4 },
    { ...base, host: "easy", difficulty: 6 }, { ...base, host: "hard", difficulty: 9, maxRam: 22 },
    { ...base, host: "big", difficulty: 9 }, { ...base, host: "th3_l4byr1nth" },
  ], 20)
  assert.deepEqual(hosts.map(h => h.host), ["big", "hard", "easy"])
})

test("past the first wall, only a host that can clear the next wall is worth lifting", () => {
  assert.deepEqual([0, 7, 9, 15, 17, 23].map(liftFloor), [5, 5, 13, 13, 21, 21])
  const base = { hasCred: true, maxRam: 32 }
  const hosts = [{ ...base, host: "short", difficulty: 12 }, { ...base, host: "tall", difficulty: 13 }]
  assert.deepEqual(liftTargets(hosts, 20, 15).map(h => h.host), ["tall"])
  assert.deepEqual(liftTargets(hosts, 20, 7).map(h => h.host), ["tall", "short"])
})

test("rider scouts only past its start, with new links or after the retry wait", () => {
  assert.equal(riderShouldScout(7, 7, ["a"], "", 0, 1000, 100), false)
  assert.equal(riderShouldScout(7, 5, ["a"], "", 0, 1000, 100), false)
  assert.equal(riderShouldScout(7, 10, [], "", 0, 1000, 100), false)
  assert.equal(riderShouldScout(7, 10, ["a"], "", 0, 1000, 100), true)
  assert.equal(riderShouldScout(7, 10, ["a"], "a", 950, 1000, 100), false)
  assert.equal(riderShouldScout(7, 10, ["a"], "a", 800, 1000, 100), true)
})

test("labSolved counts only a solve since the last install", () => {
  assert.equal(labSolved({ state: "solved", ts: 20 }, 10), true)
  assert.equal(labSolved({ state: "solved", ts: 5 }, 10), false)
  assert.equal(labSolved({ state: "walking", ts: 20 }, 10), false)
  assert.equal(labSolved(null, 10), false)
})
