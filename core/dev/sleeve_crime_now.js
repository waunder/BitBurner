/** @param {NS} ns
 * Fresh-BN10 bootstrap, one-shot: sets sleeve work while home is too small for
 * sleeve_controller.js (26GB). Entering BN10 caps sleeve shock at 25, so sleeves earn money and
 * karma at once instead of idling in recovery. sleeve_controller.js takes over when it fits.
 * Start: run sleeve_crime_now.js [crime=Shoplift] [indices, e.g. 0,1; default all]
 *        run sleeve_crime_now.js gym:str|def|dex|agi [indices]   (Powerhouse Gym, Sector-12)
 * Training a few sleeves at a time keeps the rest earning.
 */
export async function main(ns) {
  const task = String(ns.args[0] ?? "Shoplift")
  const only = ns.args[1] === undefined ? null : new Set(String(ns.args[1]).split(",").map(Number))
  const gymStat = task.startsWith("gym:") ? task.slice(4) : null
  const done = []
  // getSleeve would add 4GB; the setters throw past the last index, which ends the loop.
  for (let i = 0; i < 8; i++) {
    if (only && !only.has(i)) continue
    try {
      const ok = gymStat
        ? ns.sleeve.setToGymWorkout(i, "Powerhouse Gym", gymStat)
        : ns.sleeve.setToCommitCrime(i, task)
      if (ok) done.push(i)
    } catch { break }
  }
  ns.tprint(`sleeve_crime_now: sleeves [${done.join(",")}] on ${task}`)
}
