/**
 * Brings up the whole mcp suite from a clean slate in one command: `killall`,
 * then `run startup.js`, and know every piece is either freshly running or
 * you've been told exactly which one failed and why.
 *
 * Fire-and-forget — launches everything via ns.run and exits immediately
 * rather than staying resident, so its own RAM footprint doesn't compete
 * with what it just started.
 *
 * Skips anything already running rather than launching a second copy, which
 * makes this safe to re-run at any time, not only right after a killall.
 * mcp_hud.js, get_stats.js and mcp_supervisor.js already self-supersede on
 * their own if launched twice, but checking first avoids even briefly
 * running a redundant copy that immediately kills itself. It matters more
 * for hacking/crawler.js and mcp.js, which have no such logic and would
 * otherwise run as competing duplicates.
 *
 * mcp_supervisor.js is listed first deliberately: once it's up, restarts and
 * file dumps are remote-triggerable, so everything after it in this list is
 * (in principle) also recoverable without a repeat of this script.
 *
 * Cost: 3.6GB while running — 1.6GB baseline + ns.scriptRunning (1.0GB) +
 * ns.run (1.0GB), both read from the game's own cost table. Momentary only:
 * this needs that much free on top of whatever it's about to launch, but
 * only for the instant it takes to fire everything off, then it's gone.
 *
 * @param {NS} ns
 */
const SCRIPTS = ["mcp_supervisor.js", "hacking/crawler.js", "mcp.js", "mcp_hud.js", "get_stats.js"]

export async function main(ns) {
  ns.disableLog("ALL")
  const host = ns.getHostname()

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
