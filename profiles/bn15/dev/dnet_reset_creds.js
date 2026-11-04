/** Reset corrupted dnet_creds.txt and restart darknet with brute-force discovery
 *
 * Usage: run dnet_reset_creds.js
 *
 * This clears the corrupted credential file and kills dnet_root.js,
 * forcing crawlers to rediscover credentials via brute-force.
 */

export async function main(ns) {
  ns.tprint("🔄 Darknet Credential Reset")
  ns.tprint("")

  // Truncate corrupted creds file
  ns.tprint("Clearing corrupted dnet_creds.txt...")
  ns.write("dnet_creds.txt", "", "w")
  ns.tprint("✓ File cleared")

  // Kill dnet processes
  ns.tprint("Killing dnet_root.js...")
  ns.killall("home")
  await ns.sleep(1000)

  // Restart dnet_root with fresh start
  ns.tprint("Restarting dnet_root.js (crawlers will brute-force)...")
  const pid = ns.run("dnet_root.js", 1)

  if (pid) {
    ns.tprint(`✓ dnet_root.js started (PID: ${pid})`)
    ns.tprint("")
    ns.tprint("Crawlers will now:")
    ns.tprint("  1. Probe the network")
    ns.tprint("  2. Brute-force authentication on found targets")
    ns.tprint("  3. Store valid credentials in dnet_creds.txt")
    ns.tprint("  4. Spawn managers to loot servers")
    ns.tprint("")
    ns.tprint("Monitor progress with: hd (toggle HUD Darknet section)")
  } else {
    ns.tprint("❌ Failed to start dnet_root.js")
  }
}
