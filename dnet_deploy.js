/**
 * Roaming darknet deployer: probe neighbours, get a session on each, copy
 * itself across, and keep going as the network mutates underneath it.
 *
 * CONFIRMED LIVE 2026-08-12: a fresh `--once` run from home cracked 12+
 * servers across all four solved password models with zero failures (see
 * docs/darknet-functions.md). Read docs/darknet-tactics.md before starting
 * this on anything but darkweb — it authenticates automatically, and while
 * authentication itself carries no instability penalty, this script is the
 * thing that will find you enough servers to make backdoor budget matter.
 *
 * Fixed 2026-08-14: --once now propagates to child copies. Each process still
 * gets one pass and may spread the bounded worker onward, but no child silently
 * turns a requested experiment into an indefinitely-looping resident crawl.
 *
 * What it does that the tutorial's example script does not:
 *  - Reuses stored passwords via connectToSession (0.05GB, instant) before
 *    ever spending an authenticate call.
 *  - Treats RequestTimeOut as unknown rather than as a wrong password.
 *  - Persists every cracked password to a per-host shard file and ships it to
 *    home, so a mass script death loses progress but not knowledge.
 *  - Notices a neighbour that restarted (stored password stops working) and
 *    re-cracks it instead of looping on a stale credential.
 *  - Waits on ns.dnet.nextMutation() (0GB) instead of polling a fixed sleep.
 *  - Writes a "deployer" heartbeat every pass (this instance's own view
 *    only — see writeDeployerStatus below for why it isn't a network-wide
 *    total) to a per-host shard and ships that shard to home; a home-only
 *    script (dnet_status_merge.js) folds shards into dnet_status.json's
 *    "deployer" section for docs/status-dashboard.html's darknet
 *    scoreboard. Fixed 2026-08-12 from an unsharded version that clobbered
 *    dnet_status.json's other sections — see writeDeployerStatus's doc
 *    comment.
 *
 * Added 2026-08-12 (Phase 3, Ken-approved): scp+exec's dnet_loot.js onto
 * every neighbour it just confirmed a live session on, right next to the
 * existing self-spread call. This replaces relying on a later, separate
 * dnet_loot_all.js batch pass — that standalone tool was tried live first
 * and came back 0/55 looted (48 "no session": most previously-cracked
 * servers are offline again by the time you circle back; 7 "RAM too
 * small": actually a bug in that script, see below). The one moment you
 * *know* a server is online is the instant acquireSession just succeeded on
 * it, so loot right there instead of trusting it'll still be up later.
 * dnet_loot_all.js/dnet_loot_merge.js are kept as manual/one-off tools, not
 * replaced.
 *
 * Two RAM-fit bugs found live 2026-08-12 while wiring this up:
 *
 * 1. dnet_loot_all.js's RAM-fit check reads
 *    `ns.dnet.getServerDetails(host).maxRam`, but `DarknetServerDetails` has
 *    no `maxRam` field (checked against NetscriptDefinitions.d.ts — maxRam
 *    lives on the general `Server` object from `ns.getServer`/
 *    `ns.getServerMaxRam`, not on darknet details). That read is always
 *    `undefined`, `?? 0` makes it always `0`, so the check always fails for
 *    any host that reaches it — the "7 too little RAM" from the live
 *    dnet_loot_all.js run may not reflect those hosts' real RAM at all.
 *    NOT fixed in dnet_loot_all.js itself (out of scope for this change,
 *    flagged instead — that tool is kept as-is per the Phase 3 ask).
 * 2. lootDeploy()'s own first version compared dnet_loot.js's RAM need
 *    against `ns.getServerMaxRam(target)` alone — total RAM, not free RAM.
 *    Live test against darkweb: dnet_loot.js's files landed there fine (scp
 *    succeeded) but exec silently returned pid 0 and nothing ever ran,
 *    because darkweb's 16GB is mostly consumed by the already-running
 *    (old-code, still looping) dnet_deploy.js swarm occupant already
 *    sitting there. Fixed to check `getServerMaxRam(target) -
 *    getServerUsedRam(target)`, the same free-RAM pattern mcp.js already
 *    uses elsewhere.
 *
 * Args: --once (single pass, no loop), --brute N (allow numeric enumeration
 * up to N candidates), --quiet (suppress per-neighbour lines).
 *
 * Reads:  dnet_creds.txt (local copy of known passwords)
 * Writes: dnet_creds.txt, dnet_cred_<host>.txt shards (shipped to home),
 *         dnet_deployer_<host>.json shard (shipped to home, see
 *         writeDeployerStatus)
 *
 * RAM estimate ~4.9GB after the 2026-08-14 preparation/phishing work: the
 * earlier ~4.8GB call set (1.6 base + probe 0.2 + getServerDetails 0.1 +
 * authenticate 0.4 + connectToSession 0.05 + scp 0.6 + exec 1.3 +
 * getHostname 0.05 + ls 0.2 + getScriptRam 0.1 + getServerMaxRam 0.05 +
 * getServerUsedRam 0.05) plus ps 0.2. nextMutation, read, write,
 * toast, getBlockedRam, and getDarknetInstability are
 * 0GB, so the status heartbeat adds nothing — true both before and after
 * the 2026-08-12 sharding fix, since writeDeployerShard/shipShard use the
 * exact same 0GB write and already-paid-for scp that mergeStatus/shipStatus
 * did; the fix changes correctness, not RAM cost. The game's RAM readout is
 * the authority; imports can pull in more than this. chooseLootMode (added
 * Phase 3b, below) is a pure function and costs nothing extra; the second
 * ns.getScriptRam call it feeds doesn't add RAM either, since the function
 * itself is already paid for once regardless of call count.
 *
 * Phase 3b (2026-08-12): lootDeploy() no longer just skips a host whose
 * free RAM can't fit dnet_loot.js (5.55GB) -- it now falls back to
 * dnet_loot_realloc.js, a ~3.35GB RAM-only lean variant (see that file and
 * docs/darknet-functions.md), before giving up. spread() carries both loot
 * scripts onward so every instance can make the same choice. See
 * docs/claude-todo.md's 2026-08-12 entry for the $362M/100%-skip-rate
 * findings that motivated this and what a live check still needs to
 * confirm.
 *
 * @param {NS} ns
 */
import {
  CODE,
  CREDS_FILE,
  acquireSession,
  chooseLootMode,
  describe,
  readCreds,
  recordCred,
  shipCred,
  shipShard,
  writeDeployerShard,
} from "dnet_lib.js"

const MUTATION_FLOOR_MS = 5000
const LOOT_SCRIPT = "dnet_loot.js"
const LOOT_REALLOC_SCRIPT = "dnet_loot_realloc.js"
const REALLOC_SCRIPT = "dnet_realloc.js"
const PHISH_SCRIPT = "dnet_phish.js"
const PHISH_CACHE_PREFIX = "dnet_phish_cache_"
const LEAN_CRAWLER = "dnet_crawl.js"
const MANAGER_SCRIPT = "dnet_manager.js"

export async function main(ns) {
  ns.disableLog("ALL")
  const flags = ns.flags([
    ["once", false],
    ["brute", 0],
    ["quiet", false],
  ])

  const self = ns.getScriptName()
  let creds = readCreds(ns)
  let pass = 0
  // Per-process memory of neighbours already prepared and looted. A process
  // restart intentionally clears this, causing one fresh preparation pass;
  // ordinary mutation ticks do not relaunch a no-op loot script forever.
  const preparedTargets = new Set()
  const handledCacheMarkers = new Set()
  const lastBlockedRam = new Map()
  // Lifetime-of-this-process counters, for the "deployer" status heartbeat.
  // These are this instance's own view only -- see writeDeployerStatus's
  // doc comment for why they are not a network-wide total.
  const lifetime = {
    cracked: 0,
    sessions: 0,
    failed: 0,
    deployed: 0,
    looted: 0,
    lootMode: { full: 0, realloc: 0 },
    lootSkipped: { ram: 0, scp: 0, exec: 0 },
    ramFreedObserved: 0,
    prepareStarted: 0,
    prepareThreadsStarted: 0,
    prepareWaiting: 0,
    prepareSkipped: { ram: 0, scp: 0, exec: 0 },
    phishStarted: 0,
    phishThreadsStarted: 0,
    phishSkipped: { ram: 0, scp: 0, exec: 0 },
  }

  do {
    pass++
    const host = ns.getHostname()
    const neighbours = ns.dnet.probe()
    const summary = {
      pass,
      host,
      seen: neighbours.length,
      sessions: 0,
      cracked: 0,
      deployed: 0,
      failed: 0,
      looted: 0,
      lootMode: { full: 0, realloc: 0 },
      lootSkipped: { ram: 0, scp: 0, exec: 0 },
      lootLastSkip: null,
      ramFreedObserved: 0,
      prepareStarted: 0,
      prepareThreadsStarted: 0,
      prepareWaiting: 0,
      prepareSkipped: { ram: 0, scp: 0, exec: 0 },
      prepareLastSkip: null,
      phishStarted: 0,
      phishThreadsStarted: 0,
      phishSkipped: { ram: 0, scp: 0, exec: 0 },
      phishLastSkip: null,
    }

    for (const target of neighbours) {
      const details = ns.dnet.getServerDetails(target)
      if (!flags.quiet) ns.print(describe(details, target))
      const priorBlocked = lastBlockedRam.get(target)
      if (typeof priorBlocked === "number" && details.blockedRam < priorBlocked) {
        summary.ramFreedObserved += priorBlocked - details.blockedRam
      }
      lastBlockedRam.set(target, details.blockedRam)

      const known = creds[target]
      const result = await acquireSession(ns, target, known, { bruteForceLimit: flags.brute })

      if (!result.ok) {
        summary.failed++
        ns.print(
          `FAIL ${target} model=${details.modelId} why=${result.why} code=${result.code} ` +
            `tried=${result.tried} timeouts=${result.timeouts} exhaustive=${result.exhaustive}`
        )
        // A stored password that no longer authenticates means the server
        // restarted with a new one; drop it so the next pass re-cracks.
        if (known && result.code === CODE.AuthFailure) delete creds[target]
        continue
      }

      summary.sessions++
      const credentialChanged = typeof result.password === "string" && known?.password !== result.password
      if (credentialChanged) {
        preparedTargets.delete(target)
        summary.cracked++
        creds[target] = { host: target, password: result.password, model: details.modelId, at: Date.now() }
        const shard = recordCred(ns, target, result.password, details.modelId)
        shipCred(ns, shard)
        ns.toast(`dnet: cracked ${target} (${details.modelId})`, "success", 5000)
        ns.print(`CRACK ${target} model=${details.modelId} why=${result.why} tried=${result.tried}`)
      }

      // Once a target has the lean crawler or resident manager, that pair
      // owns preparation, loot, phishing, and mutation recrawls locally.
      // The 15GB home controller must not compete with it for target RAM.
      try {
        const delegated = ns.ps(target).some((p) => {
          const name = p.filename.startsWith("/") ? p.filename.slice(1) : p.filename
          return name === LEAN_CRAWLER || name === MANAGER_SCRIPT
        })
        if (delegated) continue
      } catch {}

      if (!preparedTargets.has(target)) {
        const prep = prepareTarget(ns, target, details.blockedRam)
        if (!prep.ready) {
          if (prep.waiting) summary.prepareWaiting++
          else if (prep.ok) {
            summary.prepareStarted++
            summary.prepareThreadsStarted += prep.threads
          } else {
            summary.prepareSkipped[prep.why] = (summary.prepareSkipped[prep.why] ?? 0) + 1
            summary.prepareLastSkip = { target, ...prep }
            const detail = prep.why === "ram" ? ` freeRam=${prep.freeRam} reallocRam=${prep.reallocRam}` : ""
            ns.print(`PREP-SKIP ${target} why=${prep.why}${detail}`)
          }
          continue
        }
      }

      if (spread(ns, self, target, flags.once)) {
        summary.deployed++
        preparedTargets.add(target)
        continue
      }

      if (!preparedTargets.has(target)) {
        // Loot at the same fresh-session handoff. Once it starts successfully,
        // avoid relaunching the one-shot script every mutation; the next pass
        // can fill the released RAM with the persistent phishing worker.
        const loot = lootDeploy(ns, target)
        if (loot.ok) {
          preparedTargets.add(target)
          summary.looted++
          summary.lootMode[loot.mode] = (summary.lootMode[loot.mode] ?? 0) + 1
          continue
        }
        // Always printed, not gated on --quiet -- a silent scp/exec failure
        // here was genuinely ambiguous to diagnose live on 2026-08-12 (no
        // tail window open, so `ok:false` gave no way to tell "RAM too
        // small" from "scp failed" from "exec failed" apart after the fact).
        summary.lootSkipped[loot.why] = (summary.lootSkipped[loot.why] ?? 0) + 1
        summary.lootLastSkip = { target, ...loot }
        // Phase 3b: on a "ram" skip, log the exact numbers the decision was
        // made from -- freeRam vs both scripts' costs -- per this repo's own
        // diagnosis-discipline rule (CLAUDE.md: "an event should record
        // every variable that appeared in the predicate that fired it").
        // Neither variant fit means this is genuinely a hard skip, not a
        const detail =
          loot.why === "ram" ? ` freeRam=${loot.freeRam} fullRam=${loot.fullRam} reallocRam=${loot.reallocRam}` : ""
        ns.print(`LOOT-SKIP ${target} why=${loot.why}${detail}`)
        continue
      }

      // A phishing success can generate a cache on this volatile host. The
      // lean worker records a marker and exits; consume each marker once,
      // then refill the released RAM with phishing on the following pass.
      const marker = nextUnhandledCacheMarker(ns, target, handledCacheMarkers)
      if (marker) {
        const caches = ns.ls(target, ".cache")
        if (caches.length === 0) {
          handledCacheMarkers.add(`${target}\n${marker}`)
        } else {
          const loot = lootDeploy(ns, target)
          if (loot.ok) {
            summary.looted++
            summary.lootMode[loot.mode] = (summary.lootMode[loot.mode] ?? 0) + 1
          } else {
            summary.lootSkipped[loot.why] = (summary.lootSkipped[loot.why] ?? 0) + 1
            summary.lootLastSkip = { target, marker, caches: caches.length, ...loot }
            ns.print(`CACHE-LOOT-SKIP ${target} marker=${marker} caches=${caches.length} why=${loot.why}`)
          }
          continue
        }
      }

      const phish = phishDeploy(ns, target)
      if (phish.ok) {
        if (!phish.existing) {
          summary.phishStarted++
          summary.phishThreadsStarted += phish.threads
        }
      } else {
        summary.phishSkipped[phish.why] = (summary.phishSkipped[phish.why] ?? 0) + 1
        summary.phishLastSkip = { target, ...phish }
        const detail = phish.why === "ram" ? ` freeRam=${phish.freeRam} phishRam=${phish.phishRam}` : ""
        ns.print(`PHISH-SKIP ${target} why=${phish.why}${detail}`)
      }
    }

    ns.print(`PASS ${JSON.stringify(summary)}`)

    lifetime.cracked += summary.cracked
    lifetime.sessions += summary.sessions
    lifetime.failed += summary.failed
    lifetime.deployed += summary.deployed
    lifetime.looted += summary.looted
    lifetime.ramFreedObserved += summary.ramFreedObserved
    lifetime.prepareStarted += summary.prepareStarted
    lifetime.prepareThreadsStarted += summary.prepareThreadsStarted
    lifetime.prepareWaiting += summary.prepareWaiting
    lifetime.phishStarted += summary.phishStarted
    lifetime.phishThreadsStarted += summary.phishThreadsStarted
    for (const k of Object.keys(lifetime.lootMode)) lifetime.lootMode[k] += summary.lootMode[k] ?? 0
    for (const k of Object.keys(lifetime.lootSkipped)) lifetime.lootSkipped[k] += summary.lootSkipped[k] ?? 0
    for (const k of Object.keys(lifetime.prepareSkipped)) lifetime.prepareSkipped[k] += summary.prepareSkipped[k] ?? 0
    for (const k of Object.keys(lifetime.phishSkipped)) lifetime.phishSkipped[k] += summary.phishSkipped[k] ?? 0
    writeDeployerStatus(ns, { pass, host, summary, lifetime, localKnownCreds: Object.keys(creds).length })

    if (flags.once) break
    await waitForMutation(ns)
  } while (true)
}

/**
 * Persist a liveness heartbeat for the dashboard: write it to a uniquely-
 * named local shard (dnet_deployer_<host>.json) and ship that shard to
 * home, the same shard-then-ship pattern credentials (recordCred/shipCred)
 * and loot (dnet_loot.js) already use.
 *
 * Fixed 2026-08-12: this used to call mergeStatus(ns, "deployer", ...)
 * locally (safe by itself) and then shipStatus(ns), which did a raw
 * `ns.scp(dnet_status.json, "home")` -- a whole-file copy, not a merge.
 * Every roaming instance's own local dnet_status.json only ever has a
 * "deployer" key (only home ever runs dnet_creds_merge.js/
 * dnet_loot_merge.js), so whichever instance's scp landed on home last
 * silently erased the "credsMerge"/"loot" sections other scripts had
 * written there -- `ns.write`/`ns.read` have no remote-host form, so there
 * was never a way to merge into home's copy remotely, and `scp` was always
 * a raw copy. Sharding fixes it the same way it already fixed credentials
 * and loot: a unique filename per host means concurrent scp's to home can
 * never collide with each other, so nothing gets clobbered. Folding shards
 * into dnet_status.json's "deployer" section now happens on home only, via
 * dnet_status_merge.js (run by hand, like dnet_creds_merge.js/
 * dnet_loot_merge.js already are) -- deliberately NOT done inline here, so
 * that dnet_deploy.js's RAM footprint (paid on every host it runs on,
 * including RAM-constrained ones) never grows for a home-only concern. Full
 * mechanism and design decisions: docs/darknet-functions.md's 2026-08-12
 * "status-file clobbering" section and writeDeployerShard's own doc comment
 * in dnet_lib.js.
 *
 * Deliberately scoped to what THIS instance actually knows, and labelled as
 * such -- it is not a network-wide total. Many independent copies of this
 * script run on different hosts at once (see spread() below); each only
 * sees its own probe() neighbours and only the credentials it inherited at
 * spawn time plus whatever it personally cracked since. `localKnownCreds`
 * and `lifetime.*` can both undercount the true network state. The one
 * trustworthy global number in this file is dnet_creds_merge.js's
 * "credsMerge.totalCracked", which reads every shard on home -- not
 * anything in this section. getDarknetInstability() is the exception: it is
 * genuinely a global reading regardless of which host calls it.
 */
function writeDeployerStatus(ns, { pass, host, summary, lifetime, localKnownCreds }) {
  try {
    const instability = ns.dnet.getDarknetInstability()
    const maxRam = ns.getServerMaxRam(host)
    const usedRam = ns.getServerUsedRam(host)
    const processes = ns.ps(host).map((p) => ({ filename: p.filename, pid: p.pid, threads: p.threads, args: p.args }))
    const shard = writeDeployerShard(ns, host, {
      host,
      pass,
      scopeNote: "this-instance-only view, not a network-wide total -- see dnet_lib.js writeDeployerShard doc",
      visibleFromHost: summary.seen,
      thisPass: {
        sessions: summary.sessions,
        cracked: summary.cracked,
        deployed: summary.deployed,
        failed: summary.failed,
        looted: summary.looted,
        lootMode: { ...summary.lootMode },
        lootSkipped: { ...summary.lootSkipped },
        lootLastSkip: summary.lootLastSkip,
        ramFreedObserved: summary.ramFreedObserved,
        prepareStarted: summary.prepareStarted,
        prepareThreadsStarted: summary.prepareThreadsStarted,
        prepareWaiting: summary.prepareWaiting,
        prepareSkipped: { ...summary.prepareSkipped },
        prepareLastSkip: summary.prepareLastSkip,
        phishStarted: summary.phishStarted,
        phishThreadsStarted: summary.phishThreadsStarted,
        phishSkipped: { ...summary.phishSkipped },
        phishLastSkip: summary.phishLastSkip,
      },
      sinceProcessStart: { ...lifetime },
      localKnownCreds,
      instability,
      controllerRam: {
        scriptRam: ns.getScriptRam(ns.getScriptName(), host),
        maxRam,
        usedRam,
        freeRam: maxRam - usedRam,
        blockedRam: ns.dnet.getBlockedRam(host),
        processes,
      },
    })
    shipShard(ns, shard)
  } catch (err) {
    ns.print(`WARN writeDeployerStatus: ${err}`)
  }
}

/**
 * Copy this script, its dependencies, and the credential store onto a
 * target we hold a session on. Carries both loot scripts along too --
 * lootDeploy below needs local copies of dnet_loot.js and (Phase 3b)
 * dnet_loot_realloc.js to hand onward to whatever this copy loots next, and
 * the only way every instance on the net ends up with both is if every
 * spread also ships them, the same way dnet_lib.js already has to ride
 * along for `self` to even run.
 */
function spread(ns, self, target, once = false) {
  const files = [LEAN_CRAWLER, MANAGER_SCRIPT, "dnet_lib.js", LOOT_SCRIPT, LOOT_REALLOC_SCRIPT, PHISH_SCRIPT]
  if (ns.fileExists(CREDS_FILE)) files.push(CREDS_FILE)
  try {
    if (!ns.scp(files, target)) {
      ns.print(`WARN scp to ${target} returned false`)
      return false
    }
  } catch (err) {
    ns.print(`WARN scp to ${target} threw: ${err}`)
    return false
  }

  try {
    const pid = ns.exec(LEAN_CRAWLER, target, { preventDuplicates: true })
    if (pid === 0) return false
    ns.print(`SPREAD ${target} pid=${pid}`)
    return true
  } catch (err) {
    ns.print(`WARN exec on ${target} threw: ${err}`)
    return false
  }
}

/**
 * Start a temporary multi-thread reallocator on this crawler host, targeting
 * the directly-connected authenticated neighbour. Running at the source is
 * essential: deeper servers can spawn with every byte of their own RAM
 * blocked, so a target-local worker could never start. Returning ready:false makes the
 * crawler wait for a later mutation pass, when it re-reads blockedRam and
 * either launches another capped pass or proceeds once the block is gone.
 */
function prepareTarget(ns, target, blockedRam) {
  if (!(blockedRam > 0)) return { ready: true, ok: true }

  try {
    const source = ns.getHostname()
    const running = ns.ps(source).some(
      (p) =>
        (p.filename === REALLOC_SCRIPT || p.filename === `/${REALLOC_SCRIPT}`) &&
        String(p.args?.[0]) === target
    )
    if (running) return { ready: false, ok: true, waiting: true }
  } catch (err) {
    ns.print(`WARN prep ps ${target} threw: ${err}`)
  }

  const source = ns.getHostname()
  const reallocRam = ns.getScriptRam(REALLOC_SCRIPT, source)
  const freeRam = ns.getServerMaxRam(source) - ns.getServerUsedRam(source)
  const threads = reallocRam > 0 ? Math.floor(freeRam / reallocRam) : 0
  if (threads < 1) return { ready: false, ok: false, why: "ram", freeRam, reallocRam }

  try {
    const pid = ns.exec(REALLOC_SCRIPT, source, { threads, preventDuplicates: true }, target)
    if (pid === 0) return { ready: false, ok: false, why: "exec" }
    ns.print(
      `PREP ${target} pid=${pid} threads=${threads} blockedRam=${blockedRam} ` +
        `source=${source} freeRam=${freeRam} reallocRam=${reallocRam}`
    )
    return { ready: false, ok: true, waiting: false, pid, threads }
  } catch (err) {
    ns.print(`WARN prep exec on ${target} threw: ${err}`)
    return { ready: false, ok: false, why: "exec" }
  }
}

function nextUnhandledCacheMarker(ns, target, handled) {
  let files
  try {
    files = ns.ls(target, PHISH_CACHE_PREFIX)
  } catch (err) {
    ns.print(`WARN cache-marker ls ${target} threw: ${err}`)
    return null
  }
  return files.find((file) => !handled.has(`${target}\n${file}`)) ?? null
}

/**
 * Fill a prepared neighbour's remaining RAM with the lean phishing worker.
 * Existing copies are left alone: a mutation may kill them, at which point
 * the next crawler pass sees no process and restores the worker. The worker
 * has no durable state, so this is exactly the restart model it is built for.
 *
 * @returns {{ok: boolean, existing?: boolean, pid?: number, threads?: number,
 *   why?: "ram"|"scp"|"exec", freeRam?: number, phishRam?: number}}
 */
function phishDeploy(ns, target) {
  try {
    const processes = ns.ps(target)
    const existing = processes.find((p) => p.filename === PHISH_SCRIPT || p.filename === `/${PHISH_SCRIPT}`)
    if (existing) return { ok: true, existing: true, pid: existing.pid, threads: existing.threads }
    const transientLoot = processes.some(
      (p) =>
        p.filename === LOOT_SCRIPT ||
        p.filename === `/${LOOT_SCRIPT}` ||
        p.filename === LOOT_REALLOC_SCRIPT ||
        p.filename === `/${LOOT_REALLOC_SCRIPT}`
    )
    if (transientLoot) return { ok: true, existing: true, waiting: true }
  } catch (err) {
    ns.print(`WARN phish ps ${target} threw: ${err}`)
  }

  const self = ns.getHostname()
  const phishRam = ns.getScriptRam(PHISH_SCRIPT, self)
  const freeRam = ns.getServerMaxRam(target) - ns.getServerUsedRam(target)
  const threads = phishRam > 0 ? Math.floor(freeRam / phishRam) : 0
  if (threads < 1) return { ok: false, why: "ram", freeRam, phishRam }

  try {
    if (!ns.scp(PHISH_SCRIPT, target)) return { ok: false, why: "scp" }
  } catch (err) {
    ns.print(`WARN phish scp to ${target} threw: ${err}`)
    return { ok: false, why: "scp" }
  }

  try {
    const pid = ns.exec(PHISH_SCRIPT, target, { threads, preventDuplicates: true })
    if (pid === 0) return { ok: false, why: "exec" }
    ns.print(`PHISH ${target} pid=${pid} threads=${threads} freeRam=${freeRam} phishRam=${phishRam}`)
    return { ok: true, existing: false, pid, threads }
  } catch (err) {
    ns.print(`WARN phish exec on ${target} threw: ${err}`)
    return { ok: false, why: "exec" }
  }
}

/**
 * scp + exec a loot script onto a target we just confirmed a live session
 * on. Cheapest checks first: two getScriptRam calls (0.1GB the function,
 * regardless of how many times it's called) + getServerMaxRam (0.05GB) +
 * getServerUsedRam (0.05GB) are all far cheaper than an scp+exec attempt
 * that would just fail.
 *
 * Deliberately uses ns.getServerMaxRam(target), NOT
 * ns.dnet.getServerDetails(target).maxRam -- see the file-level doc comment
 * for why that field doesn't exist and silently reads as 0.
 *
 * Bug found live 2026-08-12, fixed here: the first version of this check
 * compared against getServerMaxRam alone (total RAM), not FREE RAM. Live
 * test against darkweb: dnet_loot.js's files landed there fine (scp
 * succeeded, confirmed via a direct getFile against the darkweb host) but
 * exec silently returned pid 0 and nothing ever ran -- darkweb's 16GB is
 * mostly consumed by the already-running (old-code, pre-this-fix, still
 * looping) dnet_deploy.js swarm occupant, so total maxRam looked fine but
 * free RAM wasn't. Matches the free-RAM pattern mcp.js already uses
 * elsewhere (`getServerMaxRam(host) - getServerUsedRam(host)`), just not
 * applied here the first time.
 *
 * Phase 3b (2026-08-12): a flat "doesn't fit, skip" was too coarse -- the
 * live darkweb checkpoint (docs/claude-todo.md) showed 100% of loot
 * attempts on that instance skipped for exactly this reason. Now tries the
 * full 5.55GB dnet_loot.js first, falls back to the ~3.35GB
 * dnet_loot_realloc.js (RAM-freeing only, no cache-opening) if the full
 * script doesn't fit, and only skips if neither does. chooseLootMode
 * (dnet_lib.js) is the pure policy function, unit-tested in
 * dnet_lib.test.js.
 *
 * The controller launches this once after preparation, and again when a
 * phishing worker reports that it generated a cache. `preventDuplicates`
 * protects the handoff if two mutation wakes overlap.
 *
 * @returns {{ok: boolean, why?: "ram"|"scp"|"exec", pid?: number, mode?: "full"|"realloc",
 *   freeRam?: number, fullRam?: number, reallocRam?: number}}
 */
function lootDeploy(ns, target) {
  const self = ns.getHostname()
  const fullRam = ns.getScriptRam(LOOT_SCRIPT, self)
  const reallocRam = ns.getScriptRam(LOOT_REALLOC_SCRIPT, self)
  const freeRam = ns.getServerMaxRam(target) - ns.getServerUsedRam(target)

  const mode = chooseLootMode(freeRam, fullRam, reallocRam)
  if (!mode) {
    return { ok: false, why: "ram", freeRam, fullRam, reallocRam }
  }
  const script = mode === "full" ? LOOT_SCRIPT : LOOT_REALLOC_SCRIPT

  try {
    if (!ns.scp([script, "dnet_lib.js"], target)) {
      ns.print(`WARN loot scp to ${target} returned false`)
      return { ok: false, why: "scp" }
    }
  } catch (err) {
    ns.print(`WARN loot scp to ${target} threw: ${err}`)
    return { ok: false, why: "scp" }
  }

  try {
    const pid = ns.exec(script, target, { preventDuplicates: true })
    if (pid === 0) return { ok: false, why: "exec" }
    ns.print(`LOOT ${target} pid=${pid} mode=${mode}`)
    return { ok: true, pid, mode }
  } catch (err) {
    ns.print(`WARN loot exec on ${target} threw: ${err}`)
    return { ok: false, why: "exec" }
  }
}

/**
 * Block until the darknet mutates, with a floor so a burst of mutations cannot
 * spin this into a tight loop.
 */
async function waitForMutation(ns) {
  const started = Date.now()
  await ns.dnet.nextMutation()
  const elapsed = Date.now() - started
  if (elapsed < MUTATION_FLOOR_MS) await ns.sleep(MUTATION_FLOOR_MS - elapsed)
}

export function autocomplete() {
  return ["--once", "--brute", "--quiet"]
}
