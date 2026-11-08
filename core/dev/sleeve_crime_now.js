/** @param {NS} ns
 * Fresh-BN10 bootstrap, one-shot: puts every sleeve on a crime while home is too small for
 * sleeve_controller.js (26GB). Entering BN10 caps sleeve shock at 25, so sleeves earn money and
 * karma at once instead of idling in recovery. sleeve_controller.js takes over when it fits.
 * Start: run sleeve_crime_now.js [crime=Shoplift]
 */
export async function main(ns) {
  const crime = String(ns.args[0] ?? "Shoplift")
  let set = 0
  // getSleeve would add 4GB; setToCommitCrime throws past the last index, which ends the loop.
  for (let i = 0; i < 8; i++) {
    try { if (ns.sleeve.setToCommitCrime(i, crime)) set++ } catch { break }
  }
  ns.tprint(`sleeve_crime_now: ${set} sleeves on ${crime}`)
}
