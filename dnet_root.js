/**
 * Stable home-side gateway for the transient Dark Net architecture. Its
 * unique filename cannot be overwritten by surviving legacy dnet_deploy.js
 * processes. It keeps darkweb authenticated, removes any legacy controller
 * that reappears there, and delegates the gateway to dnet_crawl/manager.
 *
 * @param {NS} ns
 */
import {
  CREDS_FILE,
  acquireSession,
  freeBlockedRam,
  readCreds,
  shipShard,
  writeDeployerShard,
} from "dnet_lib.js"

const CRAWLER = "dnet_crawl.js"
const MANAGER = "dnet_manager.js"
const REALLOC = "dnet_realloc.js"
const LEGACY = "dnet_deploy.js"
const FILES = [CRAWLER, MANAGER, REALLOC, "dnet_lib.js", "dnet_loot.js", "dnet_loot_realloc.js", "dnet_phish.js"]
const RETRY_MS = 5000

export async function main(ns) {
  ns.disableLog("ALL")
  const creds = readCreds(ns)
  let pass = 0
  const lifetime = { seen: 0, sessions: 0, legacyKilled: 0, prepared: 0, delegated: 0, failed: 0 }

  while (true) {
    pass++
    const started = Date.now()
    const summary = { seen: 0, sessions: 0, legacyKilled: 0, prepared: 0, delegated: 0, failed: 0 }

    for (const target of ns.dnet.probe()) {
      summary.seen++
      const session = await acquireSession(ns, target, creds[target])
      if (!session.ok) {
        summary.failed++
        continue
      }
      summary.sessions++

      let delegated = false
      for (const proc of ns.ps(target)) {
        const name = proc.filename.startsWith("/") ? proc.filename.slice(1) : proc.filename
        if (name === LEGACY && ns.kill(proc.pid)) summary.legacyKilled++
        if (name === CRAWLER || name === MANAGER) delegated = true
      }

      let details
      try {
        details = ns.dnet.getServerDetails(target)
      } catch {
        summary.failed++
        continue
      }
      if (details.blockedRam > 0) {
        const prep = await freeBlockedRam(ns, target, 25)
        if (prep.after < prep.before) summary.prepared++
        if (prep.after > 0) continue
      }

      if (!delegated) {
        const files = [...FILES]
        if (ns.fileExists(CREDS_FILE)) files.push(CREDS_FILE)
        try {
          if (await ns.scp(files, target)) {
            const pid = ns.exec(CRAWLER, target, { preventDuplicates: true })
            if (pid !== 0) summary.delegated++
            else summary.failed++
          } else summary.failed++
        } catch {
          summary.failed++
        }
      }
    }

    for (const key of Object.keys(lifetime)) lifetime[key] += summary[key] ?? 0
    const shard = writeDeployerShard(ns, "home", {
      host: "home",
      pass,
      role: "transient-root",
      scopeNote: "home gateway; quarantines legacy deployers and delegates darkweb",
      visibleFromHost: summary.seen,
      thisPass: summary,
      sinceProcessStart: { ...lifetime },
      localKnownCreds: Object.keys(creds).length,
      instability: ns.dnet.getDarknetInstability(),
    })
    await shipShard(ns, shard)

    const elapsed = Date.now() - started
    // Poll instead of waiting only for the next mutation. A surviving legacy
    // crawler can repopulate darkweb between our kill and exec without a new
    // mutation; the stable gateway must keep quarantining that race until the
    // unique transient crawler wins the slot.
    if (elapsed < RETRY_MS) await ns.sleep(RETRY_MS - elapsed)
  }
}
