/**
 * IPvGO Bootstrap - pulls latest code from GitHub, then runs ipvgo_player.js
 *
 * Usage: run ipvgo_bootstrap.js "The Black Hand" 9
 *
 * This is the most reliable way to ensure you have the latest code changes.
 * It pulls from GitHub rather than relying on daemon sync, which can cache stale code.
 *
 * @param {NS} ns
 */

export async function main(ns) {
  const opponent = ns.args[0] || "The Black Hand"
  const size = ns.args[1] || 9

  ns.tprint(`ipvgo_bootstrap: pulling latest code from GitHub...`)

  // Pull ipvgo_player.js and ipvgo_logic.js from GitHub
  const filesToSync = ["ipvgo_player.js", "ipvgo_logic.js"]
  const githubRaw = "https://raw.githubusercontent.com/waunder/BitBurner/main"

  for (const file of filesToSync) {
    try {
      const url = `${githubRaw}/${file}`
      ns.tprint(`  Pulling ${file}...`)
      const result = await ns.wget(url, `/tmp/${file}`)
      if (result === "") {
        ns.tprint(`    ✓ Downloaded (${file})`)
      }
    } catch (e) {
      ns.tprint(`  WARNING: Failed to pull ${file}: ${e}`)
    }
  }

  ns.tprint(`ipvgo_bootstrap: pulling complete. Starting ipvgo_player...`)
  await ns.sleep(500)

  // Kill any existing instance and start fresh
  ns.killall("home")
  await ns.sleep(100)

  // Launch with the pulled code
  ns.run("ipvgo_player.js", 1, opponent, size)
  ns.tprint(`ipvgo_bootstrap: launched ipvgo_player.js with latest code`)
}
