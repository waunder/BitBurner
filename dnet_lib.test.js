/**
 * Tests for dnet_lib.js's pure/near-pure helpers.
 * Run with: node --test dnet_lib.test.js
 *
 * Added 2026-08-12 alongside the Phase 3b loot-RAM-fit fix
 * (dnet_deploy.js's lootDeploy() falling back to dnet_loot_realloc.js
 * instead of a flat skip when dnet_loot.js's 5.55GB doesn't fit). This
 * repo's own diagnosis discipline (CLAUDE.md) is to write tests for any
 * pure logic pulled out for a live decision, per the mcp_logic.js/
 * ipvgo_logic.js precedent -- chooseLootMode is exactly that kind of
 * function, and freeBlockedRam is worth covering too since it's now shared
 * by two scripts (dnet_loot.js and dnet_loot_realloc.js) that must not
 * drift apart on its stop conditions.
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { chooseLootMode, freeBlockedRam, acquireSession } from "./dnet_lib.js"

describe("chooseLootMode — Phase 3b RAM-fit fallback policy", () => {
  test("picks full when free RAM covers the full script", () => {
    assert.equal(chooseLootMode(6, 5.55, 3.35), "full")
  })

  test("picks full at the exact boundary (>=, not >)", () => {
    assert.equal(chooseLootMode(5.55, 5.55, 3.35), "full")
  })

  test("falls back to realloc when full doesn't fit but realloc does", () => {
    assert.equal(chooseLootMode(4, 5.55, 3.35), "realloc")
  })

  test("falls back to realloc at its exact boundary", () => {
    assert.equal(chooseLootMode(3.35, 5.55, 3.35), "realloc")
  })

  test("returns null when neither fits -- the darkweb-at-handoff case (freeRam=1.6)", () => {
    // The exact numbers from the 2026-08-12 checkpoint: darkweb had 1.6GB
    // free, dnet_loot.js needed ~5.55GB. This asserts the regression stays
    // caught even after the realloc fallback exists -- 1.6GB is below even
    // the leaner script's ~3.35GB floor.
    assert.equal(chooseLootMode(1.6, 5.55, 3.35), null)
  })

  test("returns null when free RAM is zero or negative", () => {
    assert.equal(chooseLootMode(0, 5.55, 3.35), null)
    assert.equal(chooseLootMode(-2, 5.55, 3.35), null)
  })
})

describe("freeBlockedRam — shared reallocation loop (mock ns)", () => {
  // Minimal mock: getBlockedRam reads a mutable counter, memoryReallocation
  // decrements it by a fixed amount per call (or follows a scripted
  // sequence), print/toast are no-ops.
  function makeNs({ blocked, decrementPerCall = 1, failAfter = Infinity, failCode = 454 }) {
    let remaining = blocked
    let calls = 0
    return {
      print: () => {},
      dnet: {
        getBlockedRam: () => remaining,
        memoryReallocation: async () => {
          calls++
          if (calls > failAfter) {
            return { success: false, code: failCode, message: failCode === 454 ? "NoBlockRAM" : "some other failure" }
          }
          remaining = Math.max(0, remaining - decrementPerCall)
          return { success: true, code: 200, message: "ok" }
        },
      },
    }
  }

  test("nothing blocked: zero calls, reported plainly", async () => {
    const ns = makeNs({ blocked: 0 })
    const res = await freeBlockedRam(ns, "host1", 25)
    assert.deepEqual(res, { before: 0, after: 0, calls: 0, why: "nothing blocked" })
  })

  test("fully reclaims across several calls, then stops on NoBlockRAM (454)", async () => {
    const ns = makeNs({ blocked: 3, decrementPerCall: 1, failAfter: 3, failCode: 454 })
    const res = await freeBlockedRam(ns, "host1", 25)
    assert.equal(res.before, 3)
    assert.equal(res.after, 0)
    assert.equal(res.calls, 3)
    assert.equal(res.why, "fully reclaimed")
  })

  test("stops on a non-NoBlockRAM failure code instead of retrying forever", async () => {
    const ns = makeNs({ blocked: 5, decrementPerCall: 1, failAfter: 0, failCode: 451 })
    const res = await freeBlockedRam(ns, "host1", 25)
    assert.equal(res.calls, 1)
    assert.match(res.why, /stopped on code 451/)
  })

  test("stops rather than spinning when a successful call frees nothing", async () => {
    const ns = makeNs({ blocked: 5, decrementPerCall: 0 }) // always "succeeds" but never reduces
    const res = await freeBlockedRam(ns, "host1", 25)
    assert.equal(res.calls, 1)
    assert.equal(res.why, "call freed nothing; stopping rather than spinning")
  })

  test("hits the call cap without ever reaching zero", async () => {
    const ns = makeNs({ blocked: 100, decrementPerCall: 1 })
    const res = await freeBlockedRam(ns, "host1", 5)
    assert.equal(res.calls, 5)
    assert.equal(res.after, 95)
    assert.equal(res.why, "hit call cap")
  })
})

describe("acquireSession — invalid host resilience (mock ns)", () => {
  // Regression test for a live crash 2026-08-12: dnet_killswarm.js hit an
  // uncaught RUNTIME ERROR ("dnet.getServerDetails: Invalid host: '6969'")
  // because getServerDetails throws, not returns an error, on a host string
  // that isn't a real darknet server -- and every caller's host list comes
  // from dnet_creds.txt, which a single corrupted line can poison. This
  // must degrade to a normal {ok: false} result, not take the whole script
  // down.
  test("a throwing getServerDetails degrades to ok:false rather than propagating", async () => {
    const ns = {
      dnet: {
        getServerDetails: () => {
          throw new Error("dnet.getServerDetails: Invalid host: '6969'")
        },
      },
    }
    const res = await acquireSession(ns, "6969", null)
    assert.equal(res.ok, false)
    assert.equal(res.why, "invalid host")
    assert.equal(res.code, 404)
  })

  test("a valid, online host with an existing session still works normally", async () => {
    const ns = {
      dnet: {
        getServerDetails: () => ({ isOnline: true, hasSession: true }),
      },
    }
    const res = await acquireSession(ns, "real-host", { password: "abc" })
    assert.equal(res.ok, true)
    assert.equal(res.why, "already had a session")
  })
})
