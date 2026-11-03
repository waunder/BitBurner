/** @param {NS} ns
 * One-shot: writes rep_survey.json with every augmentation that raises faction or company
 * reputation gain, plus the player's factions, favor, rep and pending invitations. */
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
    if (st.faction_rep === 1 && st.company_rep === 1) continue;
    augs.push({ name, factionRep: st.faction_rep, companyRep: st.company_rep, price: s.getAugmentationPrice(name),
      rep: s.getAugmentationRepReq(name), prereq: s.getAugmentationPrereq(name), owned: owned.has(name), factions });
  }
  augs.sort((a, b) => b.factionRep - a.factionRep);
  const joined = p.factions.map((f) => ({ name: f, rep: s.getFactionRep(f), favor: s.getFactionFavor(f), favorGain: s.getFactionFavorGain(f) }));
  ns.write("rep_survey.json", JSON.stringify({ ts: Date.now(), factionRepMult: p.mults.faction_rep, companyRepMult: p.mults.company_rep,
    hacking: p.skills.hacking, money: p.money, favorToDonate: ns.getFavorToDonate(), joined, invites: s.checkFactionInvitations(), augs }), "w");
}
