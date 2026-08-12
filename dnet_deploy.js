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
 * Known bug, not yet fixed (found live 2026-08-12, see darknet-functions.md
 * "Bug found live" note): spread() execs child copies with no args, so
 * --once does not propagate — a single `--once` invocation on home still
 * cascades into an indefinitely-looping crawl one hop out. Low-risk (no
 * backdoor/instability cost) and arguably does what Phase 2 of
 * darknet-strategy.md wants anyway, but worth knowing before assuming a
 * `--once` run is actually bounded.
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
 *  - Writes a "deployer" heartbeat to dnet_status.json every pass (this
 *    instance's own view only — see writeDeployerStatus below for why it
 *    isn't a network-wide total) and ships it to home, for
 *    docs/status-dashboard.html's darknet scoreboard.
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
 * Reads:  dnet_creds.txt (local copy of known passwords), dnet_status.json
 *         (merged into, not overwritten — see mergeStatus in dnet_lib.js)
 * Writes: dnet_creds.txt, dnet_cred_<host>.txt shards (shipped to home),
 *         dnet_status.json (shipped to home)
 *
 * RAM estimate ~4.8GB: 1.6 base + probe 0.2 + getServerDetails 0.1 +
 * authenticate 0.4 + connectToSession 0.05 + scp 0.6 + exec 1.3 +
 * getHostname 0.05 + ls 0.2 + getScriptRam 0.1 + getServerMaxRam 0.05 +
 * getServerUsedRam 0.05 (the last three added for lootDeploy's free-RAM
 * check). nextMutation, read, write, toast, and getDarknetInstability are
 * 0GB, so the status heartbeat adds nothing. The game's RAM readout is the
 * authority; imports can pull in more than this.
 *
 * @param {NS} ns
 */
import { CODE, CREDS_FILE, acquireSession, describe, mergeStatus, readCreds, recordCred, shipCred, shipStatus } from "dnet_lib.js"

const MUTATION_FLOOR_MS = 5000
const LOOT_SCRIPT = "dnet_loot.js"

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
  // Lifetime-of-this-process counters, for the "deployer" status heartbeat.
  // These are this instance's own view only -- see writeDeployerStatus's
  // doc comment for why they are not a network-wide total.
  const lifetime = { cracked: 0, sessions: 0, failed: 0, deployed: 0, looted: 0, lootSkipped: { ram: 0, scp: 0, exec: 0 } }

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
      lootSkipped: { ram: 0, scp: 0, exec: 0 },
    }

    for (const target of neighbours) {
      const details = ns.dnet.getServerDetails(target)
      if (!flags.quiet) ns.print(describe(details, target))

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
      if (typeof result.password === "string" && known?.password !== result.password) {
        summary.cracked++
        creds[target] = { host: target, password: result.password, model: details.modelId, at: Date.now() }
        const shard = recordCred(ns, target, result.password, details.modelId)
        shipCred(ns, shard)
        ns.toast(`dnet: cracked ${target} (${details.modelId})`, "success", 5000)
        ns.print(`CRACK ${target} model=${details.modelId} why=${result.why} tried=${result.tried}`)
      }

      if (spread(ns, self, target)) summary.deployed++

      // Loot right now, while we know for certain target is online -- see
      // the file-level doc comment for why a later, separate pass doesn't
      // work (most previously-cracked servers are offline again by the
      // time you come back).
      const loot = lootDeploy(ns, target)
      if (loot.ok) {
        summary.looted++
      } else {
        // Always printed, not gated on --quiet -- a silent scp/exec failure
        // here was genuinely ambiguous to diagnose live on 2026-08-12 (no
        // tail window open, so `ok:false` gave no way to tell "RAM too
        // small" from "scp failed" from "exec failed" apart after the fact).
        summary.lootSkipped[loot.why] = (summary.lootSkipped[loot.why] ?? 0) + 1
        ns.print(`LOOT-SKIP ${target} why=${loot.why}`)
      }
    }

    ns.print(`PASS ${JSON.stringify(summary)}`)

    lifetime.cracked += summary.cracked
    lifetime.sessions += summary.sessions
    lifetime.failed += summary.failed
    lifetime.deployed += summary.deployed
    lifetime.looted += summary.looted
    for (const k of Object.keys(lifetime.lootSkipped)) lifetime.lootSkipped[k] += summary.lootSkipped[k] ?? 0
    writeDeployerStatus(ns, { pass, host, summary, lifetime, localKnownCreds: Object.keys(creds).length })

    if (flags.once) break
    await waitForMutation(ns)
  } while (true)
}

/**
 * Persist a liveness heartbeat for the dashboard, one "deployer" section per
 * write (see mergeStatus in dnet_lib.js for why this doesn't stomp
 * dnet_creds_merge.js's "credsMerge" section in the same file).
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
    mergeStatus(ns, "deployer", {
      host,
      pass,
      scopeNote: "this-instance-only view, not a network-wide total -- see dnet_lib.js mergeStatus doc",
      visibleFromHost: summary.seen,
      thisPass: {
        sessions: summary.sessions,
        cracked: summary.cracked,
        deployed: summary.deployed,
        failed: summary.failed,
        looted: summary.looted,
        lootSkipped: { ...summary.lootSkipped },
      },
      sinceProcessStart: { ...lifetime },
      localKnownCreds,
      instability,
    })
    shipStatus(ns)
  } catch (err) {
    ns.print(`WARN writeDeployerStatus: ${err}`)
  }
}

/**
 * Copy this script, its dependencies, and the credential store onto a
 * target we hold a session on. Carries LOOT_SCRIPT along too -- lootDeploy
 * below needs a local copy of dnet_loot.js to hand onward to whatever this
 * copy loots next, and the only way every instance on the net ends up with
 * one is if every spread also ships it, the same way dnet_lib.js already
 * has to ride along for `self` to even run.
 */
function spread(ns, self, target) {
  const files = [self, "dnet_lib.js", LOOT_SCRIPT]
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
    const pid = ns.exec(self, target, { preventDuplicates: true })
    if (pid === 0) return false
    ns.print(`SPREAD ${target} pid=${pid}`)
    return true
  } catch (err) {
    ns.print(`WARN exec on ${target} threw: ${err}`)
    return false
  }
}

/**
 * scp + exec dnet_loot.js onto a target we just confirmed a live session on.
 * Cheapest check first: getScriptRam (0.1GB) + getServerMaxRam (0.05GB) +
 * getServerUsedRam (0.05GB) are all far cheaper than an scp+exec attempt
 * that would just fail, and skip cleanly (reported, not an error) when the
 * server can't currently fit the ~4.95GB dnet_loot.js needs.
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
 * Runs unconditionally every pass a session succeeds, same as spread() --
 * not gated on "newly cracked this pass". Re-running dnet_loot.js on an
 * already-looted host is safe (openCache/memoryReallocation both report
 * nothing left to do rather than erroring or double-spending karma) and
 * matches how spread() already re-execs every pass with preventDuplicates
 * doing the actual dedup work. `preventDuplicates` here mainly protects
 * against exec-ing a second copy while a prior one is still mid-run.
 *
 * @returns {{ok: boolean, why?: "ram"|"scp"|"exec", pid?: number}}
 */
function lootDeploy(ns, target) {
  const lootRam = ns.getScriptRam(LOOT_SCRIPT, ns.getHostname())
  const freeRam = ns.getServerMaxRam(target) - ns.getServerUsedRam(target)
  if (!(freeRam >= lootRam)) {
    return { ok: false, why: "ram" }
  }

  try {
    if (!ns.scp([LOOT_SCRIPT, "dnet_lib.js"], target)) {
      ns.print(`WARN loot scp to ${target} returned false`)
      return { ok: false, why: "scp" }
    }
  } catch (err) {
    ns.print(`WARN loot scp to ${target} threw: ${err}`)
    return { ok: false, why: "scp" }
  }

  try {
    const pid = ns.exec(LOOT_SCRIPT, target, { preventDuplicates: true })
    if (pid === 0) return { ok: false, why: "exec" }
    ns.print(`LOOT ${target} pid=${pid}`)
    return { ok: true, pid }
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
