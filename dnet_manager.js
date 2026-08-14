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
  await waitPid(ns, pid)
}

export async function main(ns) {
  ns.disableLog("ALL")
  // The transient crawler starts us immediately before it exits; yield long
  // enough for its RAM to be released before launching the one-shot loot.
  await ns.sleep(POLL_MS)
  await loot(ns)
  let nextCrawl = Date.now() + RECRAWL_MS

  while (true) {
    const cachePresent = ns.ls(ns.getHostname(), ".cache").length > 0
    if (cachePresent) await loot(ns)

    if (Date.now() >= nextCrawl) {
      const crawlPid = ns.run(CRAWLER, { preventDuplicates: true }, "--quiet")
      await waitPid(ns, crawlPid)
      nextCrawl = Date.now() + RECRAWL_MS
      continue
    }

    const threads = projectedThreads(ns, PHISH)
    if (threads < 1) {
      await ns.sleep(POLL_MS)
      continue
    }
    const phishPid = ns.run(PHISH, { threads, preventDuplicates: true }, "--until", nextCrawl)
    await waitPid(ns, phishPid)
  }
}
