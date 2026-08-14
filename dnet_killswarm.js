/**
 * One-off cleanup: kill every Dark Net crawler, loot, reallocation, and
 * phishing process
 * currently running anywhere on the darknet, so a fresh dnet_deploy.js run
 * from home can spread the loot fix (2026-08-12, see
 * docs/darknet-functions.md's Phase 3 section) past hosts an old-code copy
 * is still squatting on. Bitburner does not hot-reload, and exec's
 * preventDuplicates blocks a fresh copy from replacing an old one in
 * place -- the only way new code reaches an already-occupied host is to
 * kill the occupant first.
 *
 * Safe by construction: touches only hosts with a recent deployer heartbeat
 * plus home/darkweb, costs no karma (only openCache does that), and loses no
 * progress -- every cracked credential is already
 * persisted to dnet_creds.txt/shards independent of what's currently
 * running. Not run in a loop; run once by hand when a restart is wanted.
 *
 * Live correction 2026-08-14: remote ps/kill without a Dark Net session did
 * not remove the old process. Cleanup now acquires a session first, but only
 * for fresh heartbeat hosts rather than serially visiting the 586-host
 * historical credential ledger.
 *
 * Args: --quiet (suppress per-host SKIP lines), --restart (launch a fresh
 * dnet_deploy.js after cleanup finishes). The latter makes a full Dark Net
 * hot-reload remotely triggerable through restart_mcp.js --darknet.
 *
 * Reads:  dnet_creds.txt, dnet_deployer_*.json
 * Writes: nothing
 *
 * RAM estimate: confirm in game; ps/kill/run/ls plus acquireSession's
 * details/connect/authenticate calls. read is 0GB.
 *
 * @param {NS} ns
 */
import { acquireSession, readCreds } from "dnet_lib.js"

const ACTIVE_MS = 10 * 60 * 1000
const STATUS_FILE = "dnet_killswarm_status.json"

const TARGET_SCRIPTS = new Set([
  "dnet_deploy.js",
  "dnet_loot.js",
  "dnet_loot_realloc.js",
  "dnet_realloc.js",
  "dnet_phish.js",
  "dnet_crawl.js",
  "dnet_manager.js",
  "dnet_root.js",
])

export async function main(ns) {
  ns.disableLog("ALL")
  const flags = ns.flags([
    ["quiet", false],
    ["restart", false],
  ])

  // A remotely retriggered cleanup supersedes an earlier slow/old-code copy.
  for (const proc of ns.ps("home")) {
    const name = proc.filename.startsWith("/") ? proc.filename.slice(1) : proc.filename
    if (name === "dnet_killswarm.js" && proc.pid !== ns.pid) ns.kill(proc.pid)
  }

  const creds = readCreds(ns)
  const hosts = new Set(["home"])
  const now = Date.now()
  for (const file of ns.ls("home", "dnet_deployer_")) {
    if (!file.endsWith(".json")) continue
    try {
      const rec = JSON.parse(ns.read(file))
      if (typeof rec.host === "string" && now - (rec.ts ?? 0) <= ACTIVE_MS) hosts.add(rec.host)
    } catch {}
  }
  // Always include darkweb even though it has no persisted credential --
  // dnet_deploy.js never records one for it (see darknet-functions.md's
  // reconciliation note on why: darkweb reports hasSession without ever
  // needing a fresh crack, so the "newly cracked" branch that would call
  // recordCred never fires for it specifically). It's still the first hop
  // every fresh run has to get through.
  hosts.add("darkweb")
  ns.write(STATUS_FILE, JSON.stringify({ ts: Date.now(), phase: "started", hostsTargeted: hosts.size }), "w")

  let hostsInspected = 0
  let hostsUnavailable = 0
  let killed = 0
  const killedByHost = {}

  for (const host of hosts) {
    if (host !== "home") {
      const session = await acquireSession(ns, host, creds[host])
      if (!session.ok) {
        hostsUnavailable++
        if (!flags.quiet) ns.print(`SKIP ${host}: no session (${session.why})`)
        continue
      }
    }
    let procs
    try {
      procs = ns.ps(host)
      hostsInspected++
    } catch (err) {
      hostsUnavailable++
      if (!flags.quiet) ns.print(`SKIP ${host}: process table unavailable (${err})`)
      continue
    }

    for (const p of procs) {
      const name = p.filename.startsWith("/") ? p.filename.slice(1) : p.filename
      if (!TARGET_SCRIPTS.has(name)) continue
      try {
        const ok = ns.kill(p.pid)
        if (ok) {
          killed++
          killedByHost[host] = (killedByHost[host] ?? 0) + 1
          ns.print(`KILLED ${host} pid=${p.pid} ${p.filename}`)
        } else {
          ns.print(`WARN kill ${host} pid=${p.pid} returned false`)
        }
      } catch (err) {
        ns.print(`WARN kill ${host} pid=${p.pid} threw: ${err}`)
      }
    }
  }

  ns.tprint(
    `dnet_killswarm: inspected ${hostsInspected}/${hosts.size} active host(s) (${hostsUnavailable} unavailable), ` +
      `killed ${killed} Dark Net process(es). ` +
      `Per-host: ${JSON.stringify(killedByHost)}. ` +
      (flags.restart ? `Restart requested.` : `Now run: run dnet_deploy.js from home.`)
  )
  ns.write(
    STATUS_FILE,
    JSON.stringify({
      ts: Date.now(),
      phase: "complete",
      hostsTargeted: hosts.size,
      hostsInspected,
      hostsUnavailable,
      killed,
      killedByHost,
    }),
    "w"
  )

  if (flags.restart) {
    const pid = ns.run("dnet_root.js", 1)
    if (pid === 0) ns.tprint("dnet_killswarm: cleanup complete, but fresh dnet_root.js failed to start")
    else ns.tprint(`dnet_killswarm: cleanup complete; started fresh dnet_root.js pid=${pid}`)
  }
}

export function autocomplete() {
  return ["--quiet", "--restart"]
}
