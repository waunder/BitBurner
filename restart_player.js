/** @param {NS} ns
 * One-shot: restarts player_activity_controller.js from new source, then restores work
 * focus, which leaving the work page to reach the terminal gives up. */
export async function main(ns) {
  ns.scriptKill("player_activity_controller.js", "home")
  await ns.sleep(200)
  const pid = ns.run("player_activity_controller.js")
  ns.tprint(`player_activity_controller.js restarted, pid ${pid}`)
  ns.singularity.setFocus(true)
}
