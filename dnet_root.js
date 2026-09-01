/**
 * Stable home-side gateway for the transient Dark Net architecture. Its
 * unique filename cannot be overwritten by surviving legacy dnet_deploy.js
 * processes. It keeps darkweb authenticated, removes any legacy controller
 * that reappears there, merges returned credential shards, and repeatedly
 * delegates the gateway to dnet_crawl/manager.
 *
 * @param {NS} ns
 */
import {
  CREDS_FILE,
  MANAGER_REGISTRY_FILE,
  MANAGER_SHARD_PREFIX,
  MANAGER_STALE_MS,
  REGISTRY_MERGE_MS,
  acquireSession,
  freeBlockedRam,
  mergeManagerRegistry,
  readCreds,
  shipShard,
  writeDeployerShard,
} from "dnet_lib.js"

const CRAWLER = "dnet_crawl.js"
const MANAGER = "dnet_manager.js"
const REALLOC = "dnet_realloc.js"
const LEGACY = "dnet_deploy.js"
const FILES = [CRAWLER, MANAGER, REALLOC, "dnet_lib.js", "dnet_loot.js", "dnet_loot_realloc.js", "dnet_phish.js"]
// Gateway work is intentionally separate from shard maintenance: checking
// darkweb may stay responsive without rereading hundreds of historic shards.
const RETRY_MS = 5000
const CREDENTIAL_MERGE_MS = 60 * 1000

// Home-side half of the concurrency cap (2026-08-30) — see dnet_lib.js's own
// comment on MAX_ACTIVE_MANAGERS for why this exists. Piggybacks on this
// file's existing poll loop rather than a new one; same scan-then-merge
// shape as mergeCredentialShards below, just for manager heartbeats instead
// of credentials.
function mergeManagerRegistryShards(ns) {
  let registry = {}
  try {
    const raw = ns.read(MANAGER_REGISTRY_FILE)
    if (raw) registry = JSON.parse(raw)
  } catch { /* corrupt/missing registry — rebuild from shards below */ }

  const shardRecords = []
  for (const file of ns.ls("home", MANAGER_SHARD_PREFIX)) {
    if (!file.endsWith(".json")) continue
    try {
      const rec = JSON.parse(ns.read(file) || "")
      if (rec && typeof rec.host === "string" && typeof rec.ts === "number") shardRecords.push(rec)
    } catch { /* tolerate a killed writer's partial shard */ }
  }

  const merged = mergeManagerRegistry(registry, shardRecords, Date.now(), MANAGER_STALE_MS)
  ns.write(MANAGER_REGISTRY_FILE, JSON.stringify(merged), "w")
}

// `ns.ps(target)` is not reliable enough as the sole remote-manager signal:
// a live DNET manager can be absent from that view even while its shipped
// heartbeat is fresh, causing root to relaunch a crawler every gateway poll.
// The home registry is precisely the durable signal for this decision.
function hasFreshManager(ns, host) {
  try {
    const registry = JSON.parse(ns.read(MANAGER_REGISTRY_FILE) || "{}")
    const ts = registry?.[host]
    return typeof ts === "number" && Date.now() - ts < MANAGER_STALE_MS
  } catch {
    return false
  }
}

function mergeCredentialShards(ns, creds) {
  let changed = false
  for (const file of ns.ls("home", "dnet_cred_")) {
    if (!file.endsWith(".txt")) continue
    for (const line of String(ns.read(file) || "").split("\n")) {
      try {
        const rec = JSON.parse(line)
        if (typeof rec?.host !== "string" || typeof rec?.password !== "string") continue
        const prior = creds[rec.host]
        if (!prior || (rec.at ?? 0) > (prior.at ?? 0)) {
          creds[rec.host] = rec
          changed = true
        }
      } catch { /* tolerate partial shards from killed writers */ }
    }
  }
  if (changed) {
    const text = Object.values(creds).map((rec) => JSON.stringify(rec)).join("\n") + "\n"
    ns.write(CREDS_FILE, text, "w")
  }
  return changed
}

export async function main(ns) {
  ns.disableLog("ALL")
  const creds = readCreds(ns)
  let pass = 0
  let lastCredentialMergeAt = -Infinity
  let lastRegistryMergeAt = -Infinity
  const lifetime = { seen: 0, sessions: 0, legacyKilled: 0, prepared: 0, delegated: 0, failed: 0 }
  let lastFailure = null

  while (true) {
    pass++
    const started = Date.now()
    if (started - lastCredentialMergeAt >= CREDENTIAL_MERGE_MS) {
      mergeCredentialShards(ns, creds)
      lastCredentialMergeAt = started
    }
    if (started - lastRegistryMergeAt >= REGISTRY_MERGE_MS) {
      mergeManagerRegistryShards(ns)
      lastRegistryMergeAt = started
    }
    const summary = { seen: 0, sessions: 0, legacyKilled: 0, prepared: 0, delegated: 0, failed: 0 }

    for (const target of ns.dnet.probe()) {
      summary.seen++
      const session = await acquireSession(ns, target, creds[target])
      if (!session.ok) {
        summary.failed++
        lastFailure = { at: Date.now(), target, stage: "session", why: session.why, code: session.code }
        continue
      }
      summary.sessions++

      let delegated = hasFreshManager(ns, target)
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
        lastFailure = { at: Date.now(), target, stage: "details" }
        continue
      }
      if (details.blockedRam > 0) {
        const prep = await freeBlockedRam(ns, target, 25)
        if (prep.after < prep.before) summary.prepared++
        if (prep.after > 0) {
          lastFailure = { at: Date.now(), target, stage: "prepare", prep }
          continue
        }
      }

      if (!delegated) {
        const files = [...FILES]
        if (ns.fileExists(CREDS_FILE)) files.push(CREDS_FILE)
        if (ns.fileExists(MANAGER_REGISTRY_FILE)) files.push(MANAGER_REGISTRY_FILE)
        try {
          if (await ns.scp(files, target)) {
            const pid = ns.exec(CRAWLER, target, { preventDuplicates: true })
            if (pid !== 0) summary.delegated++
            else {
              summary.failed++
              lastFailure = {
                at: Date.now(), target, stage: "exec", crawlRam: ns.getScriptRam(CRAWLER, target),
                maxRam: ns.getServerMaxRam(target), usedRam: ns.getServerUsedRam(target), processes: ns.ps(target),
              }
            }
          } else {
            summary.failed++
            lastFailure = { at: Date.now(), target, stage: "scp", files }
          }
        } catch (err) {
          summary.failed++
          lastFailure = { at: Date.now(), target, stage: "exception", error: String(err) }
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
      maintenance: {
        credentialMergeEveryMs: CREDENTIAL_MERGE_MS,
        registryMergeEveryMs: REGISTRY_MERGE_MS,
        lastCredentialMergeAt,
        lastRegistryMergeAt,
      },
      lastFailure,
      crawlRam: ns.getScriptRam(CRAWLER, "home"),
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
