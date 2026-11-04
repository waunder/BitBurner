/** @param {NS} ns
 * One-shot: restarts capital_manager.js from new source, then restores work focus,
 * which leaving the work page to reach the terminal gives up. */
export async function main(ns) {
  ns.scriptKill("capital_manager.js", "home")
  await ns.sleep(200)
  const pid = ns.run("capital_manager.js")
  ns.tprint(`capital_manager.js restarted, pid ${pid}`)
  ns.singularity.setFocus(true)
}
