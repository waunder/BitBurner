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
  // A hacking gang still needs combat stats to win territory clashes. Train a
  // bounded low-opportunity-cost cohort once recruitment is complete, rather
  // than leaving every member at 1 combat forever.
  territoryCombatStat: 300,
  territoryTraineeShare: 0.35,
  // Keep capital policy separate so the primary HUD can show it even while
  // this optional controller is stopped. A source-level master gate still
  // prevents accidental spending during this run.
  policyFile: "gang_capital_policy.json",
  equipmentMasterEnabled: false,
  equipmentCashFraction: 0.01,
  equipmentMaxPaybackSeconds: 30 * 60,
  cashRateWindowMs: 60_000,
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

function combatFloor(member) {
  return Math.min(member.str, member.def, member.dex, member.agi);
}

function withEquipment(member, stats) {
  const boosted = { ...member };
  for (const stat of ["hack", "str", "def", "dex", "agi", "cha"]) {
    boosted[stat] = (boosted[stat] || 0) + (stats[stat] || 0);
  }
  return boosted;
}

function readCapitalPolicy(ns) {
  const safe = { phase: "augmentation", objective: "Accumulate cash for the final augmentation purchase review",
    allowEquipmentPurchases: false, augmentationCashTarget: null };
  try {
    const raw = JSON.parse(ns.read(C.policyFile));
    const phases = new Set(["progression", "earning-capacity", "augmentation"]);
    return {
      phase: phases.has(raw.phase) ? raw.phase : safe.phase,
      objective: typeof raw.objective === "string" && raw.objective ? raw.objective : safe.objective,
      allowEquipmentPurchases: raw.allowEquipmentPurchases === true,
      augmentationCashTarget: Number.isFinite(raw.augmentationCashTarget) && raw.augmentationCashTarget >= 0
        ? raw.augmentationCashTarget : null,
    };
  } catch {
    return safe;
  }
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  if (!ns.gang.inGang()) return ns.tprint("gang v2: no gang");
  if (!ns.fileExists("Formulas.exe", "home")) return ns.tprint("gang v2: Formulas.exe required");

  let cleanupMode = false;
  let mode = "cash";
  let cashWindow = { at: Date.now(), money: ns.getServerMoneyAvailable("home") };
  let observedCashRate = null;
  while (true) {
    while (ns.gang.canRecruitMember()) ns.gang.recruitMember(`operator-${Date.now()}`);

    const gang = ns.gang.getGangInformation();
    const members = ns.gang.getMemberNames().map((name) => ns.gang.getMemberInformation(name));
    const tasks = ns.gang.getTaskNames().map((name) => ns.gang.getTaskStats(name));
    const training = tasks.find((t) => t.name === (gang.isHacking ? "Train Hacking" : "Train Combat"));
    const combatTraining = tasks.find((t) => t.name === "Train Combat");
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

    // Territory is multiplicative gang capacity. Hacking gangs commonly have
    // enormous hack values but no combat at all, which makes every clash a
    // guaranteed loss. Once the final recruit is in, train only the least
    // valuable cohort until it has a usable combat floor; cash production
    // remains with the rest of the gang.
    const needsTerritoryCombat = mode === "cash"
      && gang.territory < 0.99
      && members.length >= 12
      && combatTraining
      && plans.some((p) => combatFloor(p.member) < C.territoryCombatStat);
    if (needsTerritoryCombat) {
      const trainees = plans.filter((p) => p.trained && combatFloor(p.member) < C.territoryCombatStat)
        .sort((a, b) => (a.choice?.money || 0) - (b.choice?.money || 0));
      const count = Math.min(trainees.length, Math.max(1, Math.ceil(plans.length * C.territoryTraineeShare)));
      for (const plan of trainees.slice(0, count)) {
        plan.choice = { task: combatTraining.name, money: 0, respect: 0, wanted: 0 };
      }
      mode = "territory-training";
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
    const equipment = ns.gang.getEquipmentNames().map((item) => ({ item, cost: ns.gang.getEquipmentCost(item), stats: ns.gang.getEquipmentStats(item) }))
      .filter((x) => Number.isFinite(x.cost)).sort((a, b) => a.cost - b.cost);
    const nextItem = equipment.find((x) => members.some((m) => !isOwned(m, x.item))) || null;
    const cash = ns.getServerMoneyAvailable("home");
    const capitalPolicy = readCapitalPolicy(ns);
    const cashElapsed = Date.now() - cashWindow.at;
    if (cashElapsed >= C.cashRateWindowMs) {
      observedCashRate = (cash - cashWindow.money) / (cashElapsed / 1000);
      cashWindow = { at: Date.now(), money: cash };
    }
    const candidates = equipment.flatMap((item) => members.filter((member) => !isOwned(member, item.item)).map((member) => {
      const task = plans.find((p) => p.member.name === member.name)?.choice?.task;
      const taskInfo = tasks.find((t) => t.name === task);
      const before = taskInfo ? projected(ns, gang, member, taskInfo).money : 0;
      const after = taskInfo ? projected(ns, gang, withEquipment(member, item.stats), taskInfo).money : 0;
      const gain = Math.max(0, after - before);
      return { item: item.item, cost: item.cost, member: member.name, gain,
        paybackSeconds: gain ? item.cost / gain : Infinity,
        phaseDelaySeconds: observedCashRate > 0 ? item.cost / observedCashRate : null };
    }));
    const bestEquipment = candidates.sort((a, b) => a.paybackSeconds - b.paybackSeconds)[0] || null;
    const cashBudget = cash * C.equipmentCashFraction;
    const phaseAllowsEquipment = capitalPolicy.phase === "earning-capacity";
    const augmentationTarget = capitalPolicy.augmentationCashTarget;
    const reservePreserved = augmentationTarget === null || cash - bestEquipment?.cost >= augmentationTarget;
    const roiQualified = bestEquipment
      && bestEquipment.paybackSeconds <= C.equipmentMaxPaybackSeconds
      && bestEquipment.cost <= cashBudget
      && reservePreserved;
    const purchaseAllowed = Boolean(C.equipmentMasterEnabled && capitalPolicy.allowEquipmentPurchases
      && phaseAllowsEquipment && roiQualified);
    const blockedReason = !C.equipmentMasterEnabled ? "source master gate disabled"
      : !capitalPolicy.allowEquipmentPurchases ? "policy purchase flag disabled"
        : !phaseAllowsEquipment ? `${capitalPolicy.phase} phase does not buy equipment`
          : !bestEquipment ? "no unowned equipment candidate"
            : !roiQualified ? "candidate fails payback, cash-slice, or reserve limit" : null;
    const bought = purchaseAllowed && ns.gang.purchaseEquipment(bestEquipment.member, bestEquipment.item) ? bestEquipment : null;
    const status = { ts: Date.now(), mode, members: members.length, gang, projectedMoneyRate: gross, projectedWantedRate: wanted,
      cleanupMode, territory: { fight, weightedChance, rivals: clashes.length, lowestCombat: Math.min(...members.map(combatFloor)) },
      capital: { phase: capitalPolicy.phase, objective: capitalPolicy.objective, cash, observedCashRate,
        augmentationCashTarget: augmentationTarget, policyAllowsPurchases: capitalPolicy.allowEquipmentPurchases,
        sourceMasterEnabled: C.equipmentMasterEnabled, purchaseAllowed, blockedReason,
        candidate: bestEquipment, cashBudget },
      equipment: { enabled: C.equipmentMasterEnabled && capitalPolicy.allowEquipmentPurchases, allowed: purchaseAllowed, nextItem, bestEquipment, bought,
        cashBudget, maxPaybackSeconds: C.equipmentMaxPaybackSeconds } };
    ns.write(C.statusFile, JSON.stringify(status), "w");
    await ns.gang.nextUpdate();
  }
}
