/**
 * Brings up the whole mcp suite from a clean slate in one command: just
 * `run startup.js`. Know every piece is either freshly running or you've
 * been told exactly which one failed and why.
 *
 * Closes every open tail window, THEN kills every other script on the host,
 * in that order — order matters. ns.kill/ns.killall never close a script's
 * tail window; the window is orphaned, frozen on whatever it last rendered.
 * closeTail needs a live PID from ns.ps to target, and killall erases that
 * PID the instant it runs — so closing has to happen first, while the
 * evidence still exists, not after. Found the hard way: two startup.js runs
 * each left a fresh ghost behind for mcp_hud.js and get_stats.js despite
 * both scripts' own self-supersede logic already calling closeTail — their
 * logic runs from the *new* instance checking ns.ps for a prior copy, and by
 * the time that check ran, this script's own killall (which used to run
 * first) had already erased the prior copy from ns.ps.
 *
 * killall's "clean and fresh" is every OTHER script on the host, including
 * anything unrelated to the mcp suite — the explicit ask. safetyGuard
 * defaults to true, which the game documents as "skips the script that
 * calls this function" and the actual implementation confirms (checked
 * against the game's bundle, not assumed: it compares the target PID
 * against e.workerScript.pid and excludes a match) — so this cannot kill
 * itself mid-run before it's relaunched everything.
 *
 * Fire-and-forget after that — launches everything via ns.run and exits
 * rather than staying resident, so its own RAM footprint doesn't compete
 * with what it just started.
 *
 * Still checks ns.scriptRunning before each launch even though killall
 * already cleared the host — cheap, and it's the belt-and-suspenders
 * against any edge case (killall failing to report success, a future call
 * site that skips the kill step) rather than the primary duplicate
 * prevention it was before killall got folded in.
 *
 * mcp_supervisor.js is listed first deliberately: once it's up, restarts and
 * file dumps are remote-triggerable, so everything after it in this list is
 * (in principle) also recoverable without a repeat of this script.
 *
 * Cost: 4.3GB while running — 1.6GB baseline + ns.ps (0.2GB) + ns.killall
 * (0.5GB) + ns.scriptRunning (1.0GB) + ns.run (1.0GB), all five read from
 * the game's own cost table. Momentary only: this needs that much free on
 * top of whatever it's about to launch, but only for the instant it takes
 * to fire everything off, then it's gone.
 *
 * @param {NS} ns
 */
const SCRIPTS = ["mcp_supervisor.js", "hacking/crawler.js", "mcp.js", "mcp_hud.js", "get_stats.js"]

export async function main(ns) {
  ns.disableLog("ALL")
  const host = ns.getHostname()

  // Close every open tail window BEFORE killing anything, not after. Once
  // killall runs, the killed processes vanish from ns.ps — the exact
  // evidence closeTail needs a PID from. This bit twice: two startup.js runs
  // each left a fresh ghost window behind for mcp_hud.js and get_stats.js
  // despite both scripts' own self-supersede logic already calling
  // closeTail, because killall had already erased the PID those scripts
  // would have looked for by the time they got to check. Their self-kill
  // logic still matters for the "run the same script again directly"
  // case — this is the startup.js-specific case that logic can't reach.
  if (ns.ui && typeof ns.ui.closeTail === "function") {
    for (const proc of ns.ps(host)) {
      if (proc.pid !== ns.pid) ns.ui.closeTail(proc.pid)
    }
  }

  ns.killall(host)
  ns.tprint(`startup: killed everything else on ${host}`)

  let started = 0
  let skipped = 0
  let failed = 0

  for (const file of SCRIPTS) {
    // scriptRunning(script, host) checks for any instance regardless of the
    // arguments it was launched with, so a live mcp.js target=n00dles still
    // correctly reads as "running" here.
    if (ns.scriptRunning(file, host)) {
      ns.tprint(`startup: ${file} already running, skipping`)
      skipped += 1
      continue
    }
    const pid = ns.run(file, 1)
    if (pid === 0) {
      ns.tprint(`startup: FAILED to start ${file} (not enough RAM on ${host}?)`)
      failed += 1
    } else {
      ns.tprint(`startup: started ${file} (pid ${pid})`)
      started += 1
    }
  }

  ns.tprint(`startup: done — ${started} started, ${skipped} already running, ${failed} failed`)
}
