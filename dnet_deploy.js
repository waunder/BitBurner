/**
 * Roaming darknet deployer: probe neighbours, get a session on each, copy
 * itself across, and keep going as the network mutates underneath it.
 *
 * NOT YET RUN IN BITBURNER. Read docs/darknet-tactics.md before starting this
 * on anything but darkweb — it authenticates automatically, and while
 * authentication itself carries no instability penalty, this script is the
 * thing that will find you enough servers to make backdoor budget matter.
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
 *
 * Args: --once (single pass, no loop), --brute N (allow numeric enumeration
 * up to N candidates), --quiet (suppress per-neighbour lines).
 *
 * Reads:  dnet_creds.txt (local copy of known passwords)
 * Writes: dnet_creds.txt, dnet_cred_<host>.txt shards (shipped to home)
 *
 * RAM estimate ~4.6GB: 1.6 base + probe 0.2 + getServerDetails 0.1 +
 * authenticate 0.4 + connectToSession 0.05 + scp 0.6 + exec 1.3 +
 * getHostname 0.05 + ls 0.2. nextMutation, read, write and toast are 0GB.
 * The game's RAM readout is the authority; imports can pull in more than this.
 *
 * @param {NS} ns
 */
import { CODE, CREDS_FILE, acquireSession, describe, readCreds, recordCred, shipCred } from "dnet_lib.js"

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
    if (flags.once) break
    await waitForMutation(ns)
  } while (true)
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
