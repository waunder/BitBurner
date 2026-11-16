/** @param {NS} ns
 * One-shot: restarts player_activity_controller.js from new source, then restores work
 * focus, which leaving the work page to reach the terminal gives up. */
export async function main(ns) {
  ns.scriptKill("player_activity_controller.js", "home")
  await ns.sleep(200)
  const pid = ns.run("player_activity_controller.js")
  ns.tprint(`player_activity_controller.js restarted, pid ${pid}`)
  // Bladeburner actions are not "work", so setFocus throws while bladeburner.js owns the player.
  try { if (ns.singularity.getCurrentWork()) ns.singularity.setFocus(true) } catch (e) { ns.tprint(`setFocus skipped: ${e}`) }
}
