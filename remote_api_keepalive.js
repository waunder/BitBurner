/**
 * Remote API keep-alive — monitor daemon health from the game tail window
 *
 * The actual daemon supervision happens at the system level via
 * tools/remote_api_monitor.sh (which auto-restarts if it crashes). This
 * script just provides visibility into daemon state from inside the game
 * by periodically checking if the daemon's log file is being updated.
 *
 * Usage (background, continuous):
 *   run remote_api_keepalive.js
 *
 * Will log connection state changes to the tail window whenever daemon state
 * transitions between connected/disconnected. During normal operation, no
 * output means everything's fine (logs only on changes).
 *
 * @param {NS} ns
 */

export async function main(ns) {
  const CHECK_INTERVAL_MS = 60000 // 1 minute

  ns.tprint(`remote_api_keepalive: monitoring daemon connection (check every ${CHECK_INTERVAL_MS}ms)`)

  let lastState = "unknown"
  let consecutiveFailures = 0

  while (true) {
    try {
      // Read the daemon's event log to check if it's alive (it writes to this)
      const eventsRaw = ns.read("/tools/bb_remote_events.log")

      if (eventsRaw && eventsRaw.trim().length > 0) {
        // Log exists and has content. Check if it's been updated recently.
        const lines = eventsRaw.trim().split("\n")
        const lastLine = lines[lines.length - 1]

        // Look for timestamps in the log
        const timestampMatch = lastLine.match(/\[([^\]]+)\]/)
        if (timestampMatch) {
          const lastEventTime = new Date(timestampMatch[1])
          const nowTime = new Date()
          const ageMs = nowTime - lastEventTime

          // If the log was updated in the last 5 minutes, daemon is alive
          if (ageMs < 300000) {
            if (lastState !== "connected") {
              ns.print(`[keepalive] daemon: CONNECTED (last event ${Math.round(ageMs / 1000)}s ago)`)
              lastState = "connected"
              consecutiveFailures = 0
            }
          } else {
            if (lastState !== "stale") {
              ns.print(`[keepalive] daemon: STALE (last event ${Math.round(ageMs / 1000)}s ago)`)
              lastState = "stale"
              consecutiveFailures++
            }
          }
        }
      } else {
        if (lastState !== "offline") {
          ns.print(`[keepalive] daemon: OFFLINE or log unreadable`)
          lastState = "offline"
          consecutiveFailures++
        }
      }
    } catch (e) {
      if (lastState !== "error") {
        ns.print(`[keepalive] error reading daemon status: ${String(e)}`)
        lastState = "error"
        consecutiveFailures++
      }
    }

    await ns.sleep(CHECK_INTERVAL_MS)
  }
}
