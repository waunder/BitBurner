/** @param {NS} ns
 * Fresh-node bootstrap, one-shot: sets the player's work while home is too small for
 * player_activity_controller.js. Unfocused, so the game screen stays usable.
 * Start: run player_now.js gym str|def|dex|agi   (Powerhouse Gym, Sector-12)
 *        run player_now.js crime Homicide
 */
export async function main(ns) {
  const [mode, arg] = ns.args.map(String)
  let ok = false
  if (mode === "gym") ok = ns.singularity.gymWorkout("Powerhouse Gym", arg, false)
  else if (mode === "crime") ok = ns.singularity.commitCrime(arg, false) > 0
  ns.tprint(`player_now: ${mode} ${arg} -> ${ok ? "ok" : "refused"}`)
}
