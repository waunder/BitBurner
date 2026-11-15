/** @param {NS} ns
 * One-shot day-one probe for a new BitNode: reset info, BitNode multipliers (SF5),
 * player stats and sleeve count. Writes bn_probe.json. About 6GB.
 * Start: run bn_probe.js
 */
export async function main(ns) {
  const reset = ns.getResetInfo()
  const mults = ns.getBitNodeMultipliers()
  const p = ns.getPlayer()
  let sleeves = 0
  try { sleeves = ns.sleeve.getNumSleeves() } catch { sleeves = -1 }
  const out = {
    ts: Date.now(), bitnode: reset.currentNode, ownedSF: [...reset.ownedSF.entries()],
    money: p.money, skills: p.skills, karma: ns.heart.break(), city: p.city,
    homeRam: ns.getServerMaxRam("home"), sleeves, mults,
  }
  ns.write("bn_probe.json", JSON.stringify(out, null, 1), "w")
  ns.tprint(`bn_probe: BN${out.bitnode}, ${sleeves} sleeves, home ${out.homeRam}GB; wrote bn_probe.json`)
}
