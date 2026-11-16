/** bb_probe.js — read-only Bladeburner snapshot for design and checks.
 * Writes bb_probe.json. Starts no action, buys nothing.
 * @param {NS} ns */
export async function main(ns) {
  const bb = ns.bladeburner;
  const out = { ts: Date.now(), ok: true, errors: [] };
  const safe = (label, fn) => { try { return fn(); } catch (e) { out.errors.push(`${label}: ${e}`); return null; } };

  out.inBladeburner = safe("inBladeburner", () => bb.inBladeburner());
  if (!out.inBladeburner) { out.ok = false; ns.write("bb_probe.json", JSON.stringify(out, null, 1), "w"); return; }

  out.rank = safe("rank", () => bb.getRank());
  out.stamina = safe("stamina", () => bb.getStamina());
  out.city = safe("city", () => bb.getCity());
  out.skillPoints = safe("sp", () => bb.getSkillPoints());
  out.bonusTimeMs = safe("bonus", () => bb.getBonusTime());
  out.currentAction = safe("cur", () => bb.getCurrentAction());
  out.nextBlackOp = safe("nextBO", () => bb.getNextBlackOp());
  out.player = safe("player", () => { const p = ns.getPlayer(); return { hp: p.hp, skills: p.skills, money: p.money, city: p.city }; });
  out.work = safe("work", () => ns.singularity.getCurrentWork());

  out.cities = {};
  for (const c of ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"]) {
    out.cities[c] = safe(`city ${c}`, () => ({
      chaos: bb.getCityChaos(c), pop: bb.getCityEstimatedPopulation(c), communities: bb.getCityCommunities(c),
    }));
  }

  const types = [
    ["General", safe("gen", () => bb.getGeneralActionNames()) || []],
    ["Contracts", safe("con", () => bb.getContractNames()) || []],
    ["Operations", safe("ops", () => bb.getOperationNames()) || []],
    ["Black Operations", safe("bo", () => bb.getBlackOpNames()) || []],
  ];
  out.actions = [];
  for (const [type, names] of types) {
    for (const name of names) {
      const a = { type, name };
      a.chance = safe(`chance ${name}`, () => bb.getActionEstimatedSuccessChance(type, name));
      a.timeMs = safe(`time ${name}`, () => bb.getActionTime(type, name));
      a.count = safe(`count ${name}`, () => bb.getActionCountRemaining(type, name));
      if (type === "Contracts" || type === "Operations") {
        a.level = safe(`lvl ${name}`, () => bb.getActionCurrentLevel(type, name));
        a.maxLevel = safe(`max ${name}`, () => bb.getActionMaxLevel(type, name));
      }
      if (type !== "General") a.repGain = safe(`rep ${name}`, () => bb.getActionRepGain(type, name));
      if (type === "Black Operations") a.rankReq = safe(`borank ${name}`, () => bb.getBlackOpRank(name));
      out.actions.push(a);
    }
  }

  out.skills = {};
  for (const s of safe("skills", () => bb.getSkillNames()) || []) {
    out.skills[s] = safe(`skill ${s}`, () => ({ level: bb.getSkillLevel(s), cost: bb.getSkillUpgradeCost(s) }));
  }
  ns.write("bb_probe.json", JSON.stringify(out, null, 1), "w");
  ns.tprint(`bb_probe: rank ${out.rank}, ${out.actions.length} actions, ${out.errors.length} errors`);
}
