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
 * Safe by construction: touches only already-known hosts (dnet_creds.txt)
 * plus darkweb, costs no karma (only openCache does that), and loses no
 * progress -- every cracked credential is already
 * persisted to dnet_creds.txt/shards independent of what's currently
 * running. Not run in a loop; run once by hand when a restart is wanted.
 *
 * ns.ps/ns.kill are not gated behind a darknet session. Cleanup therefore
 * probes the process table directly and catches invalid/offline hosts; it
 * must not turn a 586-host cleanup into a serial re-authentication campaign.
 *
 * Args: --quiet (suppress per-host SKIP lines), --restart (launch a fresh
 * dnet_deploy.js after cleanup finishes). The latter makes a full Dark Net
 * hot-reload remotely triggerable through restart_mcp.js --darknet.
 *
 * Reads:  dnet_creds.txt
 * Writes: nothing
 *
 * RAM estimate ~3.3GB: 1.6 base + ps 0.2 + kill(pid) 0.5 + run 1.0.
 * read is 0GB.
 *
 * @param {NS} ns
 */
import { readCreds } from "dnet_lib.js"

const TARGET_SCRIPTS = new Set([
  "dnet_deploy.js",
  "dnet_loot.js",
  "dnet_loot_realloc.js",
  "dnet_realloc.js",
  "dnet_phish.js",
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
  const hosts = new Set(Object.keys(creds))
  // Always include darkweb even though it has no persisted credential --
  // dnet_deploy.js never records one for it (see darknet-functions.md's
  // reconciliation note on why: darkweb reports hasSession without ever
  // needing a fresh crack, so the "newly cracked" branch that would call
  // recordCred never fires for it specifically). It's still the first hop
  // every fresh run has to get through.
  hosts.add("darkweb")

  let hostsInspected = 0
  let hostsUnavailable = 0
  let killed = 0
  const killedByHost = {}

  for (const host of hosts) {
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
    `dnet_killswarm: inspected ${hostsInspected}/${hosts.size} known host(s) (${hostsUnavailable} unavailable), ` +
      `killed ${killed} Dark Net process(es). ` +
      `Per-host: ${JSON.stringify(killedByHost)}. ` +
      (flags.restart ? `Restart requested.` : `Now run: run dnet_deploy.js from home.`)
  )

  if (flags.restart) {
    const pid = ns.run("dnet_deploy.js", 1)
    if (pid === 0) ns.tprint("dnet_killswarm: cleanup complete, but fresh dnet_deploy.js failed to start")
    else ns.tprint(`dnet_killswarm: cleanup complete; started fresh dnet_deploy.js pid=${pid}`)
  }
}

export function autocomplete() {
  return ["--quiet", "--restart"]
}
