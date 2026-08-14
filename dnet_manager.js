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

async function waitPid(ns, pid) {
  while (pid && ns.isRunning(pid)) await ns.sleep(POLL_MS)
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
  let needsLoot = true
  let failures = 0
  let nextCrawl = Date.now() + RECRAWL_MS
  await writeStatus(ns, "starting", failures, nextCrawl)

  while (true) {
    try {
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
        const crawlPid = ns.run(CRAWLER, { preventDuplicates: true }, "--quiet")
        if (crawlPid !== 0) await waitPid(ns, crawlPid)
        else await ns.sleep(POLL_MS)
        nextCrawl = Date.now() + RECRAWL_MS
        continue
      }

      const threads = projectedThreads(ns, PHISH)
      if (threads < 1) {
        await ns.sleep(POLL_MS)
        continue
      }
      await writeStatus(ns, "phishing", failures, nextCrawl)
      const phishPid = ns.run(PHISH, { threads, preventDuplicates: true }, "--until", nextCrawl)
      if (phishPid === 0) throw new Error(`${PHISH} did not start with ${threads} thread(s)`)
      await waitPid(ns, phishPid)
    } catch (err) {
      failures++
      ns.print(`MANAGER-RECOVER failure=${failures} error=${err}`)
      await writeStatus(ns, "retrying", failures, nextCrawl, String(err))
      await ns.sleep(RETRY_MS)
    }
  }
}
