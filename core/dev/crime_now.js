/** @param {NS} ns
 * One-shot: start a crime for the player while home is too small for
 * player_activity_controller.js. Start: run crime_now.js [crime=Shoplift]
 */
export async function main(ns) {
  const crime = String(ns.args[0] ?? "Shoplift")
  const ok = ns.singularity.commitCrime(crime, false)
  ns.tprint(`crime_now: ${crime} ${ok ? "started" : "FAILED"}`)
}
