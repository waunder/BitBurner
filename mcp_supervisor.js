/**
 * Restarts mcp.js on request from outside the game.
 *
 * Bitburner does not hot-reload: a running script keeps executing the version
 * it started with, so every code change needs a kill + relaunch. That was the
 * one step still requiring a human hand in the loop — the file sync pushes new
 * code into the game automatically, but nothing acted on it.
 *
 * Protocol: write a *changed* token into mcp_restart.txt. The sync extension
 * pushes the file into the game, this script notices the token differs from
 * the last one it saw, and runs restart_mcp.js.
 *
 * Token comparison rather than a delete-the-flag handshake specifically to
 * keep RAM down: ns.read costs 0GB and returns "" for a missing file, so this
 * needs neither fileExists (0.1GB) nor rm (1GB). Total cost is ns.run plus
 * the 1.6GB script baseline — worth caring about at 20GB of network capacity,
 * irrelevant once home is upgraded.
 *
 * Optional: anything after the first line of mcp_restart.txt is passed to
 * mcp.js as arguments, so `target=n00dles` can be requested remotely too.
 *
 * @param {NS} ns
 */
const FLAG_FILE = "mcp_restart.txt"
const POLL_MS = 2000

export async function main(ns) {
  ns.disableLog("ALL")
  // Seed with whatever is already on disk so a supervisor restart doesn't
  // immediately re-trigger on a stale token.
  let lastToken = ns.read(FLAG_FILE)
  ns.tprint(`mcp_supervisor: watching ${FLAG_FILE} (token="${lastToken.split("\n")[0].trim() || "<none>"}")`)

  while (true) {
    const contents = ns.read(FLAG_FILE)
    if (contents && contents !== lastToken) {
      lastToken = contents
      const lines = contents.split("\n").map((l) => l.trim()).filter(Boolean)
      const args = lines.slice(1)
      ns.tprint(`mcp_supervisor: restart requested (token=${lines[0]})${args.length ? " args=" + args.join(" ") : ""}`)
      const pid = ns.run("restart_mcp.js", 1, ...args)
      if (pid === 0) {
        ns.tprint("mcp_supervisor: could not start restart_mcp.js (not enough RAM on home?)")
      }
    }
    await ns.sleep(POLL_MS)
  }
}
