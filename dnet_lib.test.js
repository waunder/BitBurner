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
import {
  MAX_ACTIVE_MANAGERS as CRAWL_MAX_ACTIVE_MANAGERS,
  MANAGER_STALE_MS as CRAWL_MANAGER_STALE_MS,
  MANAGER_SHARD_PREFIX as CRAWL_MANAGER_SHARD_PREFIX,
  MAX_SPREAD_PER_PASS as CRAWL_MAX_SPREAD_PER_PASS,
} from "./dnet_crawl.js"
import {
  MANAGER_SHARD_PREFIX as MANAGER_JS_SHARD_PREFIX,
  MAX_PHISH_THREADS,
} from "./dnet_manager.js"
import {
  chooseLootMode,
  freeBlockedRam,
  acquireSession,
  shardName,
  pickFreshestShard,
  lootEventShardName,
  aggregateLootRecords,
  SHARD_PREFIX,
  SHARD_SUFFIX,
  DEPLOYER_SHARD_PREFIX,
  DEPLOYER_SHARD_SUFFIX,
  candidatesFor,
  MODEL,
  mergeManagerRegistry,
  canSpawnManager,
  jitteredRecrawlMs,
  MAX_ACTIVE_MANAGERS,
  MAX_SPREAD_PER_PASS,
  MANAGER_STALE_MS,
  MANAGER_SHARD_PREFIX,
} from "./dnet_lib.js"

describe("bounded shallow-model solvers", () => {
  test("PHP 5.4 tries every unique permutation through length three", () => {
    const res = candidatesFor({ modelId: MODEL.SortedEchoVuln, data: "112" })
    assert.equal(res.exhaustive, true)
    assert.deepEqual(res.candidates.map((c) => c.password).sort(), ["112", "121", "211"])
  })

  test("AccountsManager_4.2 covers its exact difficulty-four range", () => {
    const res = candidatesFor({ modelId: MODEL.GuessNumber, difficulty: 4 })
    assert.equal(res.exhaustive, true)
    assert.equal(res.candidates.length, 24)
    assert.equal(res.candidates.at(-1).password, "23")
  })

  test("Pr0verFl0 emits the exact overflow payload", () => {
    const res = candidatesFor({ modelId: MODEL.BufferOverflow, passwordLength: 4 })
    assert.equal(res.exhaustive, true)
    assert.equal(res.candidates[0].password, "AAAAAAAA")
  })
})

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

  test("forwards the authenticated neighbour target to every dnet call", async () => {
    const seen = []
    let blocked = 1
    const ns = {
      print: () => {},
      dnet: {
        getBlockedRam: (host) => {
          seen.push(["get", host])
          return blocked
        },
        memoryReallocation: async (host) => {
          seen.push(["realloc", host])
          blocked = 0
          return { success: true, code: 200, message: "ok" }
        },
      },
    }
    const res = await freeBlockedRam(ns, "direct-neighbour", 25)
    assert.equal(res.after, 0)
    assert.ok(seen.length >= 3)
    assert.ok(seen.every(([, host]) => host === "direct-neighbour"))
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

  test("can suppress the routine completion line for a caller with durable telemetry", async () => {
    const printed = []
    const ns = makeNs({ blocked: 1 })
    ns.print = (line) => printed.push(line)
    await freeBlockedRam(ns, "host1", 25, false)
    assert.deepEqual(printed, [])
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

describe("shardName — generalized prefix/suffix (2026-08-12, deployer sharding fix)", () => {
  test("defaults match the original credential-shard naming", () => {
    assert.equal(shardName("meg4c0rp"), `${SHARD_PREFIX}meg4c0rp${SHARD_SUFFIX}`)
  })

  test("an explicit prefix/suffix produces the deployer shard family", () => {
    assert.equal(
      shardName("meg4c0rp", DEPLOYER_SHARD_PREFIX, DEPLOYER_SHARD_SUFFIX),
      "dnet_deployer_meg4c0rp.json"
    )
  })

  test("escapes unsafe characters identically regardless of family", () => {
    // Darknet hostnames can contain :, %, @, emoji -- both shard families
    // must escape the same way since they share this one function now.
    const host = "we:ird@host%1🙂"
    const creds = shardName(host)
    const deployer = shardName(host, DEPLOYER_SHARD_PREFIX, DEPLOYER_SHARD_SUFFIX)
    assert.ok(!/[:@%🙂]/.test(creds))
    assert.ok(!/[:@%🙂]/.test(deployer))
    assert.equal(creds.slice(SHARD_PREFIX.length, -SHARD_SUFFIX.length), deployer.slice(DEPLOYER_SHARD_PREFIX.length, -DEPLOYER_SHARD_SUFFIX.length))
  })
})

describe("lootEventShardName — durable event shards", () => {
  test("keeps hostile hostnames filename-safe and preserves the event timestamp", () => {
    const file = lootEventShardName("we:ird@host%🙂", 123456789)
    assert.match(file, /^dnet_loot_[A-Za-z0-9_-]+_123456789\.json$/)
    assert.ok(!/[:@%🙂]/.test(file))
  })

  test("long hostnames cannot truncate the timestamp that makes an event unique", () => {
    const file = lootEventShardName("x".repeat(200), 987654321)
    assert.ok(file.endsWith("_987654321.json"))
  })
})

describe("aggregateLootRecords — cumulative/idempotent loot telemetry", () => {
  const records = [
    { host: "a", model: "old", difficulty: 1, mode: "realloc-only", at: 10, ram: { before: 4, after: 1 } },
    { host: "a", model: "new", difficulty: 2, mode: "full", at: 20, ram: { before: 2, after: 1 }, caches: { karma: -3, opened: 1, found: 1 } },
    { host: "b", model: "b", difficulty: 0, mode: "full", at: 15, caches: { karma: -1, opened: 1, found: 2 } },
  ]

  test("sums every immutable event while retaining the newest host metadata", () => {
    const result = aggregateLootRecords(records)
    assert.equal(result.totalRamFreed, 4)
    assert.equal(result.totalKarma, -4)
    assert.equal(result.totalCachesOpened, 2)
    assert.equal(result.totalCachesFound, 3)
    assert.deepEqual(result.perHost.a, {
      model: "new", difficulty: 2, mode: "full", ramFreed: 4, karma: -3,
      opened: 1, found: 1, events: 2, at: 20,
    })
  })

  test("is idempotent when the same shard set is merged again", () => {
    assert.deepEqual(aggregateLootRecords(records), aggregateLootRecords(records))
  })
})

describe("pickFreshestShard — deployer heartbeat assembly policy (dnet_status_merge.js)", () => {
  test("picks the shard with the largest ts", () => {
    const shards = [
      { file: "dnet_deployer_a.json", rec: { host: "a", ts: 100 } },
      { file: "dnet_deployer_b.json", rec: { host: "b", ts: 300 } },
      { file: "dnet_deployer_c.json", rec: { host: "c", ts: 200 } },
    ]
    assert.equal(pickFreshestShard(shards).rec.host, "b")
  })

  test("a single shard is trivially freshest", () => {
    const shards = [{ file: "dnet_deployer_a.json", rec: { host: "a", ts: 42 } }]
    assert.equal(pickFreshestShard(shards).rec.host, "a")
  })

  test("empty input returns null rather than throwing", () => {
    assert.equal(pickFreshestShard([]), null)
  })

  test("ties break to the first input in order (documented, not load-bearing)", () => {
    const shards = [
      { file: "dnet_deployer_a.json", rec: { host: "a", ts: 100 } },
      { file: "dnet_deployer_b.json", rec: { host: "b", ts: 100 } },
    ]
    assert.equal(pickFreshestShard(shards).rec.host, "a")
  })
})

describe("mergeManagerRegistry — concurrency-cap registry assembly (2026-08-30 incident fix)", () => {
  const STALE_MS = 5 * 60 * 1000

  test("folds fresh shards into an empty registry", () => {
    const now = 1_000_000
    const merged = mergeManagerRegistry({}, [{ host: "a", ts: now }, { host: "b", ts: now }], now, STALE_MS)
    assert.deepEqual(merged, { a: now, b: now })
  })

  test("drops entries older than staleMs", () => {
    const now = 1_000_000
    const existing = { a: now - STALE_MS - 1, b: now - 1000 }
    const merged = mergeManagerRegistry(existing, [], now, STALE_MS)
    assert.deepEqual(merged, { b: now - 1000 })
  })

  test("a fresh shard for a host already in the registry updates it, never duplicates", () => {
    const now = 1_000_000
    const existing = { a: now - 1000 }
    const merged = mergeManagerRegistry(existing, [{ host: "a", ts: now }], now, STALE_MS)
    assert.deepEqual(merged, { a: now })
  })

  test("an older shard for an already-fresher host doesn't move it backwards", () => {
    const now = 1_000_000
    const existing = { a: now }
    const merged = mergeManagerRegistry(existing, [{ host: "a", ts: now - 1000 }], now, STALE_MS)
    assert.deepEqual(merged, { a: now })
  })

  test("malformed shard records are tolerated, not thrown", () => {
    const now = 1_000_000
    const merged = mergeManagerRegistry({}, [null, {}, { host: "a" }, { host: "b", ts: now }], now, STALE_MS)
    assert.deepEqual(merged, { b: now })
  })
})

describe("canSpawnManager — the actual cap decision (dnet_crawl.js's enforcement point)", () => {
  const STALE_MS = 5 * 60 * 1000

  test("allows a spawn when under the cap", () => {
    const now = 1_000_000
    const registry = { a: now, b: now }
    assert.equal(canSpawnManager(registry, now, STALE_MS, 3), true)
  })

  test("denies a spawn once at the cap", () => {
    const now = 1_000_000
    const registry = { a: now, b: now, c: now }
    assert.equal(canSpawnManager(registry, now, STALE_MS, 3), false)
  })

  test("denies a spawn over the cap", () => {
    const now = 1_000_000
    const registry = { a: now, b: now, c: now, d: now }
    assert.equal(canSpawnManager(registry, now, STALE_MS, 3), false)
  })

  test("stale entries don't count against the cap", () => {
    const now = 1_000_000
    const registry = { a: now - STALE_MS - 1, b: now - STALE_MS - 1, c: now - STALE_MS - 1 }
    assert.equal(canSpawnManager(registry, now, STALE_MS, 3), true)
  })

  test("an empty registry always allows a spawn", () => {
    const now = 1_000_000
    assert.equal(canSpawnManager({}, now, STALE_MS, 15), true)
  })

  test("defaults to MAX_ACTIVE_MANAGERS when no cap is passed", () => {
    const now = 1_000_000
    assert.equal(canSpawnManager({}, now, STALE_MS), true)
  })
})

describe("dnet_crawl.js/dnet_manager.js's duplicated cap constants stay in sync with dnet_lib.js", () => {
  // dnet_crawl.js and dnet_manager.js duplicate a handful of dnet_lib.js's
  // constants rather than importing them (both files avoid dnet_lib.js's
  // static-analysis RAM charge on purpose — see either file's own header
  // comment). That duplication drifted for real, the same day it was
  // introduced: dnet_crawl.js's local MAX_ACTIVE_MANAGERS was still 15 after
  // dnet_lib.js's own was retuned to 8 in the very next edit. Both files now
  // export their copies specifically so this test can import and compare
  // them directly — exporting a plain leaf-script constant is inert for
  // Bitburner's RAM accounting (nothing in-game imports these files), so
  // this costs nothing live and needs no eval/regex parsing here.
  test("dnet_crawl.js's MAX_ACTIVE_MANAGERS matches dnet_lib.js's", () => {
    assert.equal(CRAWL_MAX_ACTIVE_MANAGERS, MAX_ACTIVE_MANAGERS)
  })

  test("dnet_crawl.js's MANAGER_STALE_MS matches dnet_lib.js's", () => {
    assert.equal(CRAWL_MANAGER_STALE_MS, MANAGER_STALE_MS)
  })

  test("dnet_crawl.js's MANAGER_SHARD_PREFIX matches dnet_lib.js's", () => {
    assert.equal(CRAWL_MANAGER_SHARD_PREFIX, MANAGER_SHARD_PREFIX)
  })

  test("dnet_manager.js's MANAGER_SHARD_PREFIX matches dnet_lib.js's", () => {
    assert.equal(MANAGER_JS_SHARD_PREFIX, MANAGER_SHARD_PREFIX)
  })

  test("dnet_crawl.js's MAX_SPREAD_PER_PASS matches dnet_lib.js's", () => {
    assert.equal(CRAWL_MAX_SPREAD_PER_PASS, MAX_SPREAD_PER_PASS)
  })

  test("post-incident diagnostic profile cannot silently restore fan-out", () => {
    assert.equal(MAX_ACTIVE_MANAGERS, 1)
    assert.equal(MAX_SPREAD_PER_PASS, 0)
    assert.equal(MAX_PHISH_THREADS, 1)
  })
})

describe("jitteredRecrawlMs — desynchronizing recrawl timing (2026-08-30, propagation-burst incident)", () => {
  test("stays within +/- jitterFraction of the base", () => {
    for (const rand of [0, 0.25, 0.5, 0.75, 0.999999]) {
      const value = jitteredRecrawlMs(90000, 0.15, () => rand)
      assert.ok(value >= 90000 * 0.85 - 1e-9 && value <= 90000 * 1.15 + 1e-9, `rand=${rand} -> ${value}`)
    }
  })

  test("rand()=0 gives the minimum of the range", () => {
    assert.equal(jitteredRecrawlMs(90000, 0.15, () => 0), 90000 * 0.85)
  })

  test("rand()=0.5 gives back the base exactly", () => {
    assert.equal(jitteredRecrawlMs(90000, 0.15, () => 0.5), 90000)
  })

  test("zero jitterFraction always returns the base, regardless of rand()", () => {
    assert.equal(jitteredRecrawlMs(90000, 0, () => 0.9), 90000)
  })

  test("defaults to Math.random when no rand is injected (smoke test, real range)", () => {
    const value = jitteredRecrawlMs(90000, 0.15)
    assert.ok(value >= 90000 * 0.85 && value <= 90000 * 1.15)
  })
})
