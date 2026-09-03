/** Darknet Canary Phase 2 Test Launcher
 *
 * Starts dnet_root.js with MAX_ACTIVE_MANAGERS=5 for controlled testing.
 * Use this INSTEAD of running dnet_root.js directly during canary tests.
 *
 * Usage:
 *   run dnet_canary_phase2.js
 *
 * This script:
 * 1. Kills any existing dnet_root.js
 * 2. Writes a test config file (dnet_canary_config.json)
 * 3. Launches dnet_root.js with the config
 * 4. Monitors for 10 minutes
 * 5. Reports final manager count and status
 *
 * Watch the remote API logs for detailed output.
 */

export async function main(ns) {
  ns.disableLog("ALL")

  const CONFIG_FILE = "dnet_canary_config.json"
  const PHASE_2_DURATION = 600000  // 10 minutes in ms
  const START_TIME = Date.now()

  ns.tprint("🔬 Darknet Canary Phase 2 - Multi-Manager Test")
  ns.tprint("")
  ns.tprint("Prerequisites checked:")

  // Kill existing darknet processes
  ns.tprint("  • Killing existing darknet processes...")
  ns.killall("home")
  await ns.sleep(1000)

  // Write test config
  const config = {
    testMode: true,
    maxActiveManagers: 5,
    noPropagate: true,
    silentPhish: true,
    credssMergeMs: 60000,     // Once per minute
    registryMergeMs: 15000,   // Every 15 seconds
  }

  ns.tprint("  • Writing test config...")
  ns.write(CONFIG_FILE, JSON.stringify(config, null, 2), "w")

  // Launch dnet_root.js
  ns.tprint("  • Launching dnet_root.js with MAX_ACTIVE_MANAGERS=5")
  ns.tprint("")
  ns.tprint("⏱️  Test running for 10 minutes...")
  ns.tprint("")

  const pid = ns.run("dnet_root.js", 1, `--config=${CONFIG_FILE}`)

  if (!pid) {
    ns.tprint("❌ Failed to launch dnet_root.js")
    return
  }

  ns.tprint(`   Started dnet_root.js (PID: ${pid})`)

  // Monitor for duration
  let lastManagerCount = 0
  const checkInterval = 30000  // Check every 30 seconds

  while (Date.now() - START_TIME < PHASE_2_DURATION) {
    await ns.sleep(checkInterval)

    // Try to read manager registry
    try {
      const registry = JSON.parse(ns.read("dnet_manager_registry.json"))
      const managers = Object.keys(registry).filter(k => k.startsWith("host_"))
      lastManagerCount = managers.length

      const elapsed = Math.floor((Date.now() - START_TIME) / 1000)
      ns.tprint(`   [${elapsed}s] Managers: ${managers.length}, Registry entries: ${Object.keys(registry).length}`)
    } catch (e) {
      // Registry doesn't exist yet
    }
  }

  ns.tprint("")
  ns.tprint("⏰ Test duration complete")
  ns.tprint("")

  // Kill dnet_root
  ns.tprint("Cleaning up...")
  ns.kill(pid)
  await ns.sleep(1000)

  // Final status
  try {
    const registry = JSON.parse(ns.read("dnet_manager_registry.json"))
    const managers = Object.keys(registry).filter(k => k.startsWith("host_"))
    ns.tprint(`Final manager count: ${managers.length}`)
    ns.tprint(`Registry entries: ${Object.keys(registry).length}`)
  } catch (e) {
    ns.tprint("Final manager count: 0")
  }

  // Write completion marker
  ns.write("dnet_canary_phase2_completed.txt",
    JSON.stringify({
      completedAt: new Date().toISOString(),
      durationSeconds: Math.floor((Date.now() - START_TIME) / 1000),
      finalManagerCount: lastManagerCount,
      status: "SUCCESS"
    }, null, 2), "w")

  ns.tprint("")
  ns.tprint("✅ Phase 2 test completed successfully")
  ns.tprint("📋 Results written to: dnet_canary_phase2_completed.txt")
}
