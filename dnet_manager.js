/**
 * Lightweight resident Dark Net node manager. It owns the local lifecycle:
 * one-shot loot, maximum-fit phishing, immediate cache opening, and a brief
 * transient recrawl every 90 seconds. The phisher exits at the recrawl
 * deadline, so no kill API is needed and all of its RAM is available to the
 * crawler before launch.
 *
 * @param {NS} ns
 */
const CRAWLER = "dnet_crawl.js"
const LOOT = "dnet_loot.js"
const PHISH = "dnet_phish.js"
const RECRAWL_MS = 90000
const POLL_MS = 1000
const RETRY_MS = 5000
const STATUS_FILE = "dnet_manager_status.json"
const HEARTBEAT_MS = 15 * 1000

// A manager must not turn every spare GB into an independent 200ms API loop.
// Keep the initial post-incident experiment to exactly one worker; a future
// controlled policy can raise this only with measured headroom.
export const MAX_PHISH_THREADS = 1

// Concurrency-cap heartbeat (2026-08-30) — dnet_crawl.js reserves this
// host's slot once, right before spawning this process; this file's job is
// only to keep that slot from going stale (MANAGER_STALE_MS, 5min in
// dnet_lib.js) for as long as it's genuinely still running. Constants/naming
// duplicated rather than imported from dnet_lib.js, same lean-script reason
// as dnet_crawl.js (see that file's own comment) — see dnet_lib.js's
// MAX_ACTIVE_MANAGERS comment for the incident this fixes.
// Exported so dnet_lib.test.js can compare it directly against dnet_lib.js's
// real value — see dnet_crawl.js's matching constant for why exporting a
// plain leaf-script constant like this is inert for Bitburner's RAM
// accounting.
export const MANAGER_SHARD_PREFIX = "dnet_manager_active_"

// Recrawl jitter (2026-08-30) — see dnet_lib.js's jitteredRecrawlMs for the
// full incident reasoning: a flat RECRAWL_MS keeps managers spawned close
// together (exactly what one propagation wave produces) permanently
// synchronized, so their recrawls can re-converge into a wide simultaneous
// burst even with MAX_SPREAD_PER_PASS throttling each individual one.
// Logic duplicated rather than imported, same lean-script reason as the
// heartbeat constant above.
const JITTER_FRACTION = 0.15
function jitteredRecrawlMs(baseMs) {
  const spread = baseMs * JITTER_FRACTION
  return baseMs - spread + Math.random() * spread * 2
}

function safeHost(host) {
  let safe = ""
  for (const ch of String(host)) safe += /[A-Za-z0-9_-]/.test(ch) ? ch : "x" + ch.codePointAt(0).toString(16)
  return safe.slice(0, 80)
}

async function refreshManagerActiveShard(ns, generation, failures = 0, lastError = null) {
  const host = ns.getHostname()
  const shard = `${MANAGER_SHARD_PREFIX}${safeHost(host)}.json`
  ns.write(shard, JSON.stringify({ ts: Date.now(), host, generation, failures, lastError }), "w")
  await ns.scp(shard, "home")
}

async function waitPid(ns, pid, heartbeat = null) {
  let nextHeartbeat = Date.now() + HEARTBEAT_MS
  while (pid && ns.isRunning(pid)) {
    if (heartbeat && Date.now() >= nextHeartbeat) {
      await heartbeat()
      nextHeartbeat = Date.now() + HEARTBEAT_MS
    }
    await ns.sleep(POLL_MS)
  }
}

export function threadsForFreeRam(freeRam, scriptRam) {
  return scriptRam > 0 ? Math.max(0, Math.floor(freeRam / scriptRam)) : 0
}

function projectedThreads(ns, script) {
  const host = ns.getHostname()
  const ram = ns.getScriptRam(script, host)
  const freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host)
  return threadsForFreeRam(freeRam, ram)
}

async function loot(ns) {
  const pid = ns.run(LOOT, { preventDuplicates: true })
  if (pid === 0) throw new Error(`${LOOT} did not start`)
  await waitPid(ns, pid)
}

async function writeStatus(ns, state, failures, nextCrawl, lastError = null) {
  await ns.write(
    STATUS_FILE,
    JSON.stringify({ ts: Date.now(), host: ns.getHostname(), state, failures, nextCrawl, lastError }),
    "w"
  )
}

export async function main(ns) {
  ns.disableLog("ALL")
  const flags = ns.flags([["generation", ""]])
  let needsLoot = true
  let failures = 0
  let nextCrawl = Date.now() + jitteredRecrawlMs(RECRAWL_MS)
  await writeStatus(ns, "starting", failures, nextCrawl)

  while (true) {
    try {
      await refreshManagerActiveShard(ns, flags.generation)
      if (needsLoot) {
        await writeStatus(ns, "looting", failures, nextCrawl)
        await loot(ns)
        needsLoot = false
      }
      const cachePresent = ns.ls(ns.getHostname(), ".cache").length > 0
      if (cachePresent) {
        await writeStatus(ns, "opening-cache", failures, nextCrawl)
        await loot(ns)
      }

      if (Date.now() >= nextCrawl) {
        await writeStatus(ns, "crawling", failures, nextCrawl)
        // Recrawls refresh local access only. They must never turn a stable
        // manager into a new propagation source.
        const crawlPid = ns.run(CRAWLER, { preventDuplicates: true }, "--quiet", "--no-spread")
        if (crawlPid !== 0) await waitPid(ns, crawlPid)
        else await ns.sleep(POLL_MS)
        nextCrawl = Date.now() + jitteredRecrawlMs(RECRAWL_MS)
        continue
      }

      const threads = Math.min(MAX_PHISH_THREADS, projectedThreads(ns, PHISH))
      if (threads < 1) {
        await ns.sleep(POLL_MS)
        continue
      }
      await writeStatus(ns, "phishing", failures, nextCrawl)
      const phishPid = ns.run(PHISH, { threads, preventDuplicates: true }, "--until", nextCrawl)
      if (phishPid === 0) throw new Error(`${PHISH} did not start with ${threads} thread(s)`)
      await waitPid(ns, phishPid, () => refreshManagerActiveShard(ns, flags.generation))
    } catch (err) {
      failures++
      // `dnet_manager_status.json` retains the error for the home-side
      // reviewer.  Printing every retry used a remote tail as a log sink and
      // could itself become noisy during an outage.
      await writeStatus(ns, "retrying", failures, nextCrawl, String(err))
      await refreshManagerActiveShard(ns, flags.generation, failures, String(err))
      await ns.sleep(RETRY_MS)
    }
  }
}
