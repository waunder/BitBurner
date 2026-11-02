import { test } from "node:test"
import assert from "node:assert/strict"
import { rankHops, shouldStartScout, scoutStart, shouldAnchor } from "./dnet_scout_logic.js"

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
