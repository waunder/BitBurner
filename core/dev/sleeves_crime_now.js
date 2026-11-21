/** @param {NS} ns
 * One-shot: put every sleeve on a crime while home is too small for
 * sleeve_controller.js (30GB). Fresh BitNode day one, with crime_now.js for the player.
 * Start: run sleeves_crime_now.js [crime=Shoplift] [sleeves=8]
 * No getNumSleeves (4GB): tries indexes 0..sleeves-1 and stops at the first that fails.
 */
export async function main(ns) {
  const crime = String(ns.args[0] ?? "Shoplift")
  const count = Number(ns.args[1] ?? 8)
  const done = []
  for (let i = 0; i < count; i++) {
    try {
      if (!ns.sleeve.setToCommitCrime(i, crime)) break
      done.push(i)
    } catch { break }
  }
  ns.tprint(`sleeves_crime_now: ${crime} on sleeves [${done.join(",")}]`)
}
