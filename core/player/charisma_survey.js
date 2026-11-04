/** @param {NS} ns
 * One-shot: writes charisma_survey.json with the player's charisma state and every
 * augmentation that raises charisma or charisma exp, with price, rep and faction. */
export async function main(ns) {
  const p = ns.getPlayer();
  const s = ns.singularity;
  const owned = new Set(s.getOwnedAugmentations(true));
  const offers = {};
  for (const f of Object.values(ns.enums.FactionName)) {
    for (const a of s.getAugmentationsFromFaction(f)) (offers[a] ??= []).push(f);
  }
  const augs = [];
  for (const [name, factions] of Object.entries(offers)) {
    const st = s.getAugmentationStats(name);
    if (st.charisma === 1 && st.charisma_exp === 1) continue;
    augs.push({ name, charisma: st.charisma, charismaExp: st.charisma_exp, price: s.getAugmentationPrice(name),
      rep: s.getAugmentationRepReq(name), owned: owned.has(name), factions });
  }
  augs.sort((a, b) => b.charisma * b.charismaExp - a.charisma * a.charismaExp);
  ns.write("charisma_survey.json", JSON.stringify({ ts: Date.now(), level: p.skills.charisma, exp: p.exp.charisma,
    mult: p.mults.charisma, expMult: p.mults.charisma_exp, hacking: p.skills.hacking, intelligence: p.skills.intelligence,
    bn: ns.getBitNodeMultipliers().CharismaLevelMultiplier, factions: p.factions, augs }), "w");
}
