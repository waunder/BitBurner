/**
 * Brings up the whole mcp suite from a clean slate in one command: just
 * `run startup.js`. Know every piece is either freshly running or you've
 * been told exactly which one failed and why.
 *
 * Starts with ns.killall — every OTHER script on the host, including
 * anything unrelated to the mcp suite, since "clean and fresh" was the
 * explicit ask. safetyGuard defaults to true, which the game documents as
 * "skips the script that calls this function" and the actual implementation
 * confirms (checked against the game's bundle, not assumed: it compares the
 * target PID against e.workerScript.pid and excludes a match) — so this
 * cannot kill itself mid-run before it's relaunched everything.
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
 * Cost: 4.1GB while running — 1.6GB baseline + ns.killall (0.5GB) +
 * ns.scriptRunning (1.0GB) + ns.run (1.0GB), all four read from the game's
 * own cost table. Momentary only: this needs that much free on top of
 * whatever it's about to launch, but only for the instant it takes to fire
 * everything off, then it's gone.
 *
 * @param {NS} ns
 */
const SCRIPTS = ["mcp_supervisor.js", "hacking/crawler.js", "mcp.js", "mcp_hud.js", "get_stats.js"]

export async function main(ns) {
  ns.disableLog("ALL")
  const host = ns.getHostname()

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
