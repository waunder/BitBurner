/**
 * Fits in a fresh node's spare RAM: upgrades home until capital_manager.js can
 * run, hands over, and exits. `run` fails harmlessly until the manager fits.
 * Start: startup.js launches it.
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL")
  while (!ns.run("capital_manager.js")) {
    ns.singularity.upgradeHomeRam()
    await ns.sleep(5_000)
  }
}
