/** @param {NS} ns
 * One-shot: writes hacking_survey.json with the player's hacking state and every
 * augmentation that raises hacking or hacking exp, with price, rep and faction. */
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
    if (st.hacking === 1 && st.hacking_exp === 1) continue;
    augs.push({ name, hacking: st.hacking, hackingExp: st.hacking_exp, price: s.getAugmentationPrice(name),
      rep: s.getAugmentationRepReq(name), owned: owned.has(name), factions });
  }
  augs.sort((a, b) => b.hacking - a.hacking);
  ns.write("hacking_survey.json", JSON.stringify({ ts: Date.now(), level: p.skills.hacking, exp: p.exp.hacking,
    mult: p.mults.hacking, expMult: p.mults.hacking_exp, bn: ns.getBitNodeMultipliers().HackingLevelMultiplier,
    combat: [p.skills.strength, p.skills.defense, p.skills.dexterity, p.skills.agility], karma: p.karma,
    factions: p.factions, invites: s.checkFactionInvitations(), augs }), "w");
}
