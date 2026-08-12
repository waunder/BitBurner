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
 * Args: --once (single pass, no loop), --brute N (allow numeric enumeration
 * up to N candidates), --quiet (suppress per-neighbour lines).
 *
 * Reads:  dnet_creds.txt (local copy of known passwords), dnet_status.json
 *         (merged into, not overwritten — see mergeStatus in dnet_lib.js)
 * Writes: dnet_creds.txt, dnet_cred_<host>.txt shards (shipped to home),
 *         dnet_status.json (shipped to home)
 *
 * RAM estimate ~4.6GB: 1.6 base + probe 0.2 + getServerDetails 0.1 +
 * authenticate 0.4 + connectToSession 0.05 + scp 0.6 + exec 1.3 +
 * getHostname 0.05 + ls 0.2. nextMutation, read, write, toast, and
 * getDarknetInstability are 0GB, so the status heartbeat adds nothing.
 * The game's RAM readout is the authority; imports can pull in more than this.
 *
 * @param {NS} ns
 */
import { CODE, CREDS_FILE, acquireSession, describe, mergeStatus, readCreds, recordCred, shipCred, shipStatus } from "dnet_lib.js"

const MUTATION_FLOOR_MS = 5000

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
  const lifetime = { cracked: 0, sessions: 0, failed: 0, deployed: 0 }

  do {
    pass++
    const host = ns.getHostname()
    const neighbours = ns.dnet.probe()
    const summary = { pass, host, seen: neighbours.length, sessions: 0, cracked: 0, deployed: 0, failed: 0 }

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
    }

    ns.print(`PASS ${JSON.stringify(summary)}`)

    lifetime.cracked += summary.cracked
    lifetime.sessions += summary.sessions
    lifetime.failed += summary.failed
    lifetime.deployed += summary.deployed
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
      thisPass: { sessions: summary.sessions, cracked: summary.cracked, deployed: summary.deployed, failed: summary.failed },
      sinceProcessStart: { ...lifetime },
      localKnownCreds,
      instability,
    })
    shipStatus(ns)
  } catch (err) {
    ns.print(`WARN writeDeployerStatus: ${err}`)
  }
}

/** Copy this script plus the credential store onto a target we hold a session on. */
function spread(ns, self, target) {
  const files = [self, "dnet_lib.js"]
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
