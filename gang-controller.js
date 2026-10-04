/**
 * Gang v2: formula-driven cash, respect, wanted, and territory control.
 *
 * It deliberately starts with equipment purchasing disabled.  The prior
 * controller spent through a fixed cash reserve; v2 records a per-item
 * payback estimate first, so capital can only be enabled after observation.
 *
 * Requires Formulas.exe for exact task projections.
 */
const C = {
  trainStat: 75,
  ascendAt: 1.25,
  wantedEnter: 0.995,
  wantedExit: 0.999,
  maxCleanerShare: 0.50,
  territoryMinWin: 0.58,
  territoryWeightedWin: 0.65,
  equipmentEnabled: false,
  statusFile: "gang_status.json",
};

function isOwned(member, item) {
  return member.upgrades.includes(item) || member.augmentations.includes(item);
}

function projected(ns, gang, member, task) {
  return {
    task: task.name,
    money: Math.max(0, ns.formulas.gang.moneyGain(gang, member, task)),
    respect: ns.formulas.gang.respectGain(gang, member, task),
    wanted: ns.formulas.gang.wantedLevelGain(gang, member, task),
  };
}

function bestBy(items, key) {
  return items.reduce((best, item) => !best || item[key] > best[key] ? item : best, null);
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  if (!ns.gang.inGang()) return ns.tprint("gang v2: no gang");
  if (!ns.fileExists("Formulas.exe", "home")) return ns.tprint("gang v2: Formulas.exe required");

  let cleanupMode = false;
  let mode = "cash";
  while (true) {
    while (ns.gang.canRecruitMember()) ns.gang.recruitMember(`operator-${Date.now()}`);

    const gang = ns.gang.getGangInformation();
    const members = ns.gang.getMemberNames().map((name) => ns.gang.getMemberInformation(name));
    const tasks = ns.gang.getTaskNames().map((name) => ns.gang.getTaskStats(name));
    const training = tasks.find((t) => t.name === (gang.isHacking ? "Train Hacking" : "Train Combat"));
    const clean = tasks.find((t) => t.name === (gang.isHacking ? "Ethical Hacking" : "Vigilante Justice"));
    const productive = tasks.filter((t) => t.baseMoney > 0);
    const respectTasks = tasks.filter((t) => t.baseRespect > 0 && t.baseWanted >= 0);

    if (gang.wantedPenalty < C.wantedEnter) cleanupMode = true;
    else if (gang.wantedPenalty >= C.wantedExit) cleanupMode = false;

    const plans = members.map((member) => {
      const stat = gang.isHacking ? member.hack : member.str;
      if (stat < C.trainStat) return { member, choice: { task: training?.name || member.task, money: 0, respect: 0, wanted: 0 }, trained: false };
      const projections = productive.map((task) => projected(ns, gang, member, task));
      const respect = respectTasks.map((task) => projected(ns, gang, member, task));
      return { member, choice: bestBy(projections, "money"), respect: bestBy(respect, "respect"), trained: true, projections };
    });

    // Before twelve members, respect is capital: devote the best candidates to
    // recruitment only when a recruit remains unavailable.
    const recruitGrowth = members.length < 12 && !ns.gang.canRecruitMember();
    if (recruitGrowth) {
      mode = "respect";
      for (const plan of plans.filter((p) => p.trained)) plan.choice = plan.respect || plan.choice;
    } else if (cleanupMode && clean) {
      mode = "wanted-recovery";
      const cleaners = plans.filter((p) => p.trained)
        .map((p) => ({ ...p, clean: projected(ns, gang, p.member, clean) }))
        .filter((p) => p.clean.wanted < 0)
        .sort((a, b) => {
          const aCost = Math.max(0, (a.choice?.money || 0) - a.clean.money) / Math.max(1e-12, -a.clean.wanted);
          const bCost = Math.max(0, (b.choice?.money || 0) - b.clean.money) / Math.max(1e-12, -b.clean.wanted);
          return aCost - bCost;
        });
      const count = Math.min(cleaners.length, Math.max(1, Math.ceil(cleaners.length * C.maxCleanerShare)));
      for (const plan of cleaners.slice(0, count)) plan.choice = plan.clean;
    } else {
      mode = "cash";
    }

    for (const plan of plans) {
      if (plan.choice?.task && plan.member.task !== plan.choice.task) ns.gang.setMemberTask(plan.member.name, plan.choice.task);
      const asc = ns.gang.getAscensionResult(plan.member.name);
      const mult = asc && (gang.isHacking ? asc.hack : asc.str);
      if (mult && mult >= C.ascendAt) ns.gang.ascendMember(plan.member.name);
    }

    const rivals = Object.entries(ns.gang.getAllGangInformation()).filter(([name, info]) => name !== gang.faction && info.territory > 0);
    const clashes = rivals.map(([name, info]) => ({ territory: info.territory, chance: ns.gang.getChanceToWinClash(name) }));
    const weight = clashes.reduce((sum, x) => sum + x.territory, 0);
    const weightedChance = weight ? clashes.reduce((sum, x) => sum + x.chance * x.territory, 0) / weight : 0;
    const fight = gang.territory < 0.99 && clashes.some((x) => x.chance >= C.territoryMinWin) && weightedChance >= C.territoryWeightedWin;
    if (fight !== gang.territoryWarfareEngaged) ns.gang.setTerritoryWarfare(fight);

    const gross = plans.reduce((sum, p) => sum + (p.choice?.money || 0), 0);
    const wanted = plans.reduce((sum, p) => sum + (p.choice?.wanted || 0), 0);
    const equipment = ns.gang.getEquipmentNames().map((item) => ({ item, cost: ns.gang.getEquipmentCost(item) }))
      .filter((x) => Number.isFinite(x.cost)).sort((a, b) => a.cost - b.cost);
    const nextItem = equipment.find((x) => members.some((m) => !isOwned(m, x.item))) || null;
    const status = { ts: Date.now(), mode, members: members.length, gang, projectedMoneyRate: gross, projectedWantedRate: wanted,
      cleanupMode, territory: { fight, weightedChance, rivals: clashes.length }, equipment: { enabled: C.equipmentEnabled, nextItem } };
    ns.write(C.statusFile, JSON.stringify(status), "w");
    await ns.gang.nextUpdate();
  }
}
