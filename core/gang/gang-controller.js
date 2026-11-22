import { memberPower, territoryTrialCohort, territoryTrialFrom } from "./gang_logic.js";
import { canBuildTerritoryPower, moneyModePriority, moneyPerSecond, planMoneyTasks, planReputationTasks, planTerritoryPower,
  shouldAscendMember, shouldEngageTerritoryClashes, wantedCleanupPolicy, cheapGearQualifies,
  reputationCleanupMode, withEquipment, planReputationGear, gearCounts, ascensionCooldownElapsed,
  GANG_ROOTKITS, autoGangObjective, recruitHoldsAscension, equipmentCategory } from "./gang_logic.js";
import { flagsFor, grantFilter, kindOf } from "./valuation_logic.js";

/**
 * Gang v2: formula-driven money or faction-reputation, wanted, and territory control.
 *
 * It deliberately starts with equipment purchasing disabled.  The prior
 * controller spent through a fixed cash reserve; v2 records a per-item
 * payback estimate first, so capital can only be enabled after observation.
 *
 * Requires Formulas.exe for exact task projections.
 */
const C = {
  trainStat: 75,
  ascendAt: 1.25,  // ascension resets exp and costs the member's respect; smaller gains are not worth it
  ascendCooldownMs: 90_000,  // minimum time between ascensions (each deducts respect and wipes gear)
  maxGearPurchasesPerLoop: 24,
  wantedReductionFraction: 0.001,
  severeWantedEnter: 0.05,
  severeWantedExit: 0.10,
  severeWantedReductionFraction: 0.04,
  // Enter cleanup while the penalty is still materially harmful; the prior
  // 0.99 gate allowed wanted to climb above 50k before recovery engaged.
  cleanupEnterAttainablePenalty: 0.998,
  cleanupExitAttainablePenalty: 0.999,
  wantedUpdateCycles: 10,
  territoryMinWin: 0.90,
  territoryWeightedWin: 0.90,
  // A hacking gang still needs combat stats to win territory clashes. Train a
  // bounded low-opportunity-cost cohort once recruitment is complete, rather
  // than leaving every member at 1 combat forever.
  territoryCombatStat: 300,
  territoryTraineeShare: 0.35,
  territoryPowerShare: 0.35,
  // Keep capital policy separate so the primary HUD can show it even while
  // this optional controller is stopped. A source-level master gate still
  // prevents accidental spending during this run.
  policyFile: "gang_capital_policy.json",
  objectiveOverrideFile: "gang_objective_override.txt",
  equipmentMasterEnabled: true,
  equipmentCashFraction: 0.01,
  equipmentMaxPaybackSeconds: 30 * 60,
  // Useful gear under this share of cash is bought without a money payback (cheapGearQualifies).
  equipmentCheapFraction: 0.0001,
  cashRateWindowMs: 60_000,
  statusFile: "gang_status.json",
};

function isOwned(member, item) {
  return member.upgrades.includes(item) || member.augmentations.includes(item);
}

function projected(ns, gang, member, task) {
  return {
    task: task.name,
    money: moneyPerSecond(ns.formulas.gang.moneyGain(gang, member, task)),
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

function readCapitalPolicy(ns) {
  const safe = { phase: "augmentation", objective: "Accumulate cash for the final augmentation purchase review",
    allowEquipmentPurchases: false, augmentationCashTarget: null, territoryEnabled: false,
    reputationCleanupEnter: 0.90, reputationCleanupExit: 0.95, rootkitCashFraction: 0.01, gangAugCashFraction: 0.05 };
  const penalty = (value, fallback) => Number.isFinite(value) && value > 0 && value < 1 ? value : fallback;
  try {
    const raw = JSON.parse(ns.read(C.policyFile));
    const phases = new Set(["progression", "earning-capacity", "augmentation"]);
    const enter = penalty(raw.reputationCleanupEnter, safe.reputationCleanupEnter);
    const fraction = (value, fallback) => Number.isFinite(value) && value > 0 && value <= 1 ? value : fallback;
    return {
      rootkitCashFraction: fraction(raw.rootkitCashFraction, safe.rootkitCashFraction),
      gangAugCashFraction: fraction(raw.gangAugCashFraction, safe.gangAugCashFraction),
      reputationCleanupEnter: enter,
      reputationCleanupExit: Math.max(enter, penalty(raw.reputationCleanupExit, safe.reputationCleanupExit)),
      phase: phases.has(raw.phase) ? raw.phase : safe.phase,
      objective: typeof raw.objective === "string" && raw.objective ? raw.objective : safe.objective,
      allowEquipmentPurchases: raw.allowEquipmentPurchases === true,
      territoryEnabled: raw.territoryEnabled === true,
      // Clash odds bars (2026-11-20, Ken: 0.90 sat at 0.89 for an hour). Policy keys override C, 0.5-1 only.
      territoryMinWin: Number.isFinite(raw.territoryMinWin) && raw.territoryMinWin >= 0.5 && raw.territoryMinWin <= 1 ? raw.territoryMinWin : C.territoryMinWin,
      territoryWeightedWin: Number.isFinite(raw.territoryWeightedWin) && raw.territoryWeightedWin >= 0.5 && raw.territoryWeightedWin <= 1 ? raw.territoryWeightedWin : C.territoryWeightedWin,
      // Share of members on Territory Warfare in territory-power mode (2026-11-21, Ken: all earn). 0 keeps
      // everyone on money and still fights clashes while the odds bars pass: clash deaths only take
      // members on Territory Warfare, so with none assigned a lost clash costs territory, not members.
      territoryPowerShare: Number.isFinite(raw.territoryPowerShare) && raw.territoryPowerShare >= 0 && raw.territoryPowerShare <= 1 ? raw.territoryPowerShare : C.territoryPowerShare,
      augmentationCashTarget: Number.isFinite(raw.augmentationCashTarget) && raw.augmentationCashTarget >= 0
        ? raw.augmentationCashTarget : null,
      reserveInstallPlan: raw.reserveInstallPlan === true,
      recruitHoldHours: Number.isFinite(raw.recruitHoldHours) && raw.recruitHoldHours > 0 ? raw.recruitHoldHours : 0,
      territoryTrial: territoryTrialFrom(raw.territoryTrial, Date.now()),
    };
  } catch {
    return safe;
  }
}

/** The objective file holds reputation, money, cash or auto (set_gang_objective.js). "auto" resolves
 * each loop from augmentation_readiness.json (autoGangObjective). Returns { setting, objective, reason }. */
function readGangObjective(ns) {
  const value = String(ns.read(C.objectiveOverrideFile) || "money").trim().toLowerCase()
  if (value === "auto") {
    let readiness = null
    try { readiness = JSON.parse(ns.read("augmentation_readiness.json") || "null") } catch {}
    return { setting: "auto", ...autoGangObjective(readiness, Date.now()) }
  }
  const objective = value === "reputation" ? "reputation" : value === "cash" ? "cash" : "money"
  return { setting: objective, objective, reason: "set by hand" }
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  // Re-running this controller is the in-game update/restart path. Retire
  // prior copies before they can keep assigning tasks or writing status.
  for (const process of ns.ps("home")) {
    if (process.filename === "gang-controller.js" && process.pid !== ns.pid) ns.kill(process.pid);
  }
  if (!ns.gang.inGang()) return ns.tprint("gang v2: no gang");
  if (!ns.fileExists("Formulas.exe", "home")) return ns.tprint("gang v2: Formulas.exe required");

  let cleanupMode = false;
  let severeWantedMode = false;
  let mode = "cash";
  let cashWindow = { at: Date.now(), money: ns.getServerMoneyAvailable("home") };
  let observedCashRate = null;
  let factionRepSample = { at: 0, rep: null };
  let observedFactionRepRate = null;
  let factionRep = null;
  let factionRepReadAt = 0;
  let lastAscension = null;
  let ascensionCount = 0; // since this script started (an install restarts it), so roughly per cycle
  // Every purchase, so the allocator sees items bought on updates between its passes (latest 100).
  let purchaseLog = [];
  while (true) {
    while (ns.gang.canRecruitMember()) ns.gang.recruitMember(`operator-${Date.now()}`);

    const gang = ns.gang.getGangInformation();
    const otherGangs = Object.entries(ns.gang.getAllGangInformation()).filter(([name]) => name !== gang.faction);
    const strongestRivalPower = otherGangs.reduce((max, [, info]) => Math.max(max, Number(info.power) || 0), 0);
    const rivals = otherGangs.filter(([, info]) => info.territory > 0);
    const clashes = rivals.map(([name, info]) => ({ territory: info.territory,
      chance: ns.gang.getChanceToWinClash(name) }));
    const capitalPolicy = readCapitalPolicy(ns);
    const clashPolicy = shouldEngageTerritoryClashes(gang.territory, clashes,
      capitalPolicy.territoryMinWin ?? C.territoryMinWin, capitalPolicy.territoryWeightedWin ?? C.territoryWeightedWin);
    const objectiveChoice = readGangObjective(ns);
    const gangObjective = objectiveChoice.objective;
    const territoryEnabled = capitalPolicy.territoryEnabled;
    const powerShare = capitalPolicy.territoryPowerShare ?? C.territoryPowerShare;
    const members = ns.gang.getMemberNames().map((name) => ns.gang.getMemberInformation(name));
    const tasks = ns.gang.getTaskNames().map((name) => ns.gang.getTaskStats(name));
    const training = tasks.find((t) => t.name === (gang.isHacking ? "Train Hacking" : "Train Combat"));
    const combatTraining = tasks.find((t) => t.name === "Train Combat");
    const clean = tasks.find((t) => t.name === (gang.isHacking ? "Ethical Hacking" : "Vigilante Justice"));
    const productive = tasks.filter((t) => t.baseMoney > 0);
    const respectTasks = tasks.filter((t) => t.baseRespect > 0);

    const wantedPolicy = wantedCleanupPolicy(gang.wantedPenalty, severeWantedMode, cleanupMode,
      gang.respect, C.severeWantedEnter, C.severeWantedExit, C.wantedReductionFraction,
      C.severeWantedReductionFraction, C.cleanupEnterAttainablePenalty, C.cleanupExitAttainablePenalty);
    // Reputation mode uses an absolute penalty band (policy file), so a young gang earns respect
    // instead of cleaning a sub-1% penalty; money mode keeps the attainable-penalty band.
    cleanupMode = gangObjective === "reputation"
      ? reputationCleanupMode(gang.wantedPenalty, cleanupMode, capitalPolicy.reputationCleanupEnter, capitalPolicy.reputationCleanupExit,
        wantedPolicy.attainablePenalty)
      : wantedPolicy.cleanupMode;
    severeWantedMode = wantedPolicy.severeMode;

    const plans = members.map((member) => {
      const stat = gang.isHacking ? member.hack : member.str;
      if (stat < C.trainStat) return { member, choice: { task: training?.name || member.task, money: 0, respect: 0, wanted: 0 }, trained: false };
      const projections = productive.map((task) => projected(ns, gang, member, task));
      const respect = respectTasks.map((task) => projected(ns, gang, member, task));
      return { member, choice: bestBy(projections, "money"), respect: bestBy(respect, "respect"),
        clean: clean ? projected(ns, gang, member, clean) : null, trained: true, projections };
    });
    let reputationPlan = null;
    let moneyPlan = null;

    // Before twelve members, respect is capital: devote the best candidates to
    // recruitment only when a recruit remains unavailable.
    const recruitGrowth = members.length < 12 && !ns.gang.canRecruitMember();
    const moneyPriority = moneyModePriority(cleanupMode, Boolean(clean), recruitGrowth);
    if (gangObjective === "reputation") {
      if (cleanupMode && clean) {
        reputationPlan = planReputationTasks(plans, gang.wantedLevel, wantedPolicy.reductionFraction, C.wantedUpdateCycles);
        for (let i = 0; i < plans.length; i++) {
          plans[i].choice = reputationPlan.assignments[i].choice;
          plans[i].role = reputationPlan.assignments[i].role;
        }
        mode = reputationPlan.cleanerCount ? "wanted-recovery" : "reputation";
      } else {
        mode = "reputation";
        for (const plan of plans) {
          plan.choice = plan.trained ? (plan.respect || plan.choice) : plan.choice;
          plan.role = plan.trained ? "respect" : "training";
        }
      }
    } else if (moneyPriority === "wanted-recovery") {
      moneyPlan = planMoneyTasks(plans, gang.wantedLevel, wantedPolicy.reductionFraction, C.wantedUpdateCycles);
      for (let i = 0; i < plans.length; i++) {
        plans[i].choice = moneyPlan.assignments[i].choice;
        plans[i].role = moneyPlan.assignments[i].role;
      }
      mode = moneyPlan.cleanerCount ? "wanted-recovery" : "cash";
    } else if (moneyPriority === "respect") {
      mode = "respect";
      for (const plan of plans.filter((p) => p.trained)) plan.choice = plan.respect || plan.choice;
    } else {
      mode = "cash";
    }

    // Territory is multiplicative gang capacity. Hacking gangs commonly have
    // enormous hack values but no combat at all, which makes every clash a
    // guaranteed loss. Once the final recruit is in, train only the least
    // valuable cohort until it has a usable combat floor; cash production
    // remains with the rest of the gang.
    const needsTerritoryCombat = territoryEnabled
      && gangObjective === "money"
      && mode === "cash"
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
        plan.role = "territory-training";
      }
      if (gangObjective === "money") moneyPlan = null;
      mode = "territory-training";
    } else if (territoryEnabled && gangObjective === "money" && powerShare > 0 && canBuildTerritoryPower({ objective: gangObjective, cleanupMode,
      territory: gang.territory, rosterFull: members.length >= 12, hasRivals: rivals.length > 0,
      taskAvailable: tasks.some((task) => task.name === "Territory Warfare"),
      combatReady: members.every((member) => combatFloor(member) >= C.territoryCombatStat),
      clashSafe: gang.territoryClashChance <= 0, currentlyEngaged: gang.territoryWarfareEngaged,
      oddsPass: clashPolicy.engage })) {
      // Territory Warfare builds power even while clashes are disabled. Keep a
      // bounded low-value cohort on it; the odds gate below alone enables risk.
      plans.splice(0, plans.length, ...planTerritoryPower(plans,
        "Territory Warfare", powerShare));
      moneyPlan = null;
      mode = "territory-power";
    }

    // Measured trial (Ken, 2026-11-19): a fixed cohort of the lowest respect earners builds power
    // on Territory Warfare until the policy's untilMs; clashes stay off unless territoryEnabled.
    const trial = capitalPolicy.territoryTrial;
    const trialCohort = trial && tasks.some((t) => t.name === "Territory Warfare")
      ? territoryTrialCohort(plans, trial.members) : [];
    for (const plan of trialCohort) {
      plan.choice = { task: "Territory Warfare", money: 0, respect: 0, wanted: 0 };
      plan.role = "territory-trial";
    }

    // Ascension reduces stored gang respect, so at most one member ascends per
    // evaluation (the largest gain); the next loop re-reads the game state first.
    // The penalty floor is the reputation band's cleanup entry in reputation mode
    // (the band deliberately runs well below the old 0.998 floor), else the old
    // attainable-penalty floor.
    const penaltyFloor = gangObjective === "reputation"
      ? capitalPolicy.reputationCleanupEnter - 0.02
      : (gang.respect / (gang.respect + 1)) * C.cleanupEnterAttainablePenalty;
    let ascendBest = null;
    const ascRatios = new Map();
    const recruitHold = recruitHoldsAscension({ members: members.length, respect: gang.respect,
      respectForNextRecruit: gang.respectForNextRecruit, respectPerHour: gang.respectGainRate * 18000,
      holdHours: capitalPolicy.recruitHoldHours });
    const cooledDown = !recruitHold && ascensionCooldownElapsed(lastAscension?.ts, Date.now(), C.ascendCooldownMs);
    for (const plan of plans) {
      if (plan.choice?.task && plan.member.task !== plan.choice.task) ns.gang.setMemberTask(plan.member.name, plan.choice.task);
      const asc = ns.gang.getAscensionResult(plan.member.name);
      const mult = asc && (gang.isHacking ? asc.hack : asc.str);
      ascRatios.set(plan.member.name, mult);
      // A trial member keeps its stats so the measured power gain is not reset mid-trial.
      const mayAscend = cooledDown && plan.role !== "territory-trial" && shouldAscendMember({ cleanupMode, severeMode: severeWantedMode,
        territoryPowerMode: mode === "territory-power", multiplier: mult, threshold: C.ascendAt,
        respect: gang.respect, respectToDeduct: asc?.respect, wantedLevel: gang.wantedLevel, penaltyFloor });
      if (mayAscend && (!ascendBest || mult > ascendBest.mult)) ascendBest = { name: plan.member.name, mult, respect: asc.respect };
    }
    if (ascendBest && ns.gang.ascendMember(ascendBest.name)) {
      lastAscension = { ts: Date.now(), ...ascendBest };
      ascensionCount++;
    }

    const weightedChance = clashPolicy.weightedChance;
    const fight = territoryEnabled && clashPolicy.engage
      && (mode === "territory-power" || (powerShare === 0 && mode === "cash"));
    if (fight !== gang.territoryWarfareEngaged) ns.gang.setTerritoryWarfare(fight);

    const gross = plans.reduce((sum, p) => sum + (p.choice?.money || 0), 0);
    const wanted = plans.reduce((sum, p) => sum + (p.choice?.wanted || 0), 0);
    const equipment = ns.gang.getEquipmentNames().map((item) => ({ item, cost: ns.gang.getEquipmentCost(item), stats: ns.gang.getEquipmentStats(item) }))
      .filter((x) => Number.isFinite(x.cost)).sort((a, b) => a.cost - b.cost);
    const nextItem = equipment.find((x) => members.some((m) => !isOwned(m, x.item))) || null;
    const cash = ns.getServerMoneyAvailable("home");
    const statusNow = Date.now();
    if (statusNow - factionRepReadAt >= 5000) {
      factionRepReadAt = statusNow;
      try { factionRep = Number(ns.singularity.getFactionRep(gang.faction)); }
      catch { factionRep = null; }
      if (Number.isFinite(factionRep)) {
        if (factionRepSample.rep !== null && statusNow > factionRepSample.at) {
          observedFactionRepRate = (factionRep - factionRepSample.rep) / ((statusNow - factionRepSample.at) / 1000);
        }
        factionRepSample = { at: statusNow, rep: factionRep };
      }
    }
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
    const cashBudget = cash * C.equipmentCashFraction;
    for (const c of candidates) {
      const item = equipment.find((e) => e.item === c.item);
      c.cheap = cheapGearQualifies({ cost: c.cost, stats: item?.stats, cash, isHacking: gang.isHacking, fraction: C.equipmentCheapFraction });
    }
    // Money payback first; otherwise the cheapest useful item, which carries respect and rep too.
    const paying = candidates.filter((c) => c.paybackSeconds <= C.equipmentMaxPaybackSeconds && c.cost <= cashBudget)
      .sort((a, b) => a.paybackSeconds - b.paybackSeconds);
    const cheap = candidates.filter((c) => c.cheap).sort((a, b) => a.cost - b.cost);
    const bestEquipment = paying[0] || cheap[0] || candidates.sort((a, b) => a.paybackSeconds - b.paybackSeconds)[0] || null;
    const phaseAllowsEquipment = capitalPolicy.phase === "earning-capacity";
    // reserveInstallPlan: gear may spend only cash above the next install batch's cost (augmentation_readiness.json).
    let installPlanCost = null;
    if (capitalPolicy.reserveInstallPlan) {
      try { installPlanCost = JSON.parse(ns.read("augmentation_readiness.json") || "null")?.installPlan?.cost ?? null; } catch {}
    }
    const reserveCandidates = [capitalPolicy.augmentationCashTarget, installPlanCost].filter((v) => Number.isFinite(v) && v >= 0);
    const augmentationTarget = reserveCandidates.length ? Math.max(...reserveCandidates) : null;
    const reservePreserved = augmentationTarget === null || cash - bestEquipment?.cost >= augmentationTarget;
    const roiQualified = bestEquipment
      && ((bestEquipment.paybackSeconds <= C.equipmentMaxPaybackSeconds && bestEquipment.cost <= cashBudget) || bestEquipment.cheap)
      && reservePreserved;
    const purchaseAllowed = Boolean(C.equipmentMasterEnabled && capitalPolicy.allowEquipmentPurchases
      && phaseAllowsEquipment && roiQualified);
    const blockedReason = !C.equipmentMasterEnabled ? "source master gate disabled"
      : !capitalPolicy.allowEquipmentPurchases ? "policy purchase flag disabled"
        : !phaseAllowsEquipment ? `${capitalPolicy.phase} phase does not buy equipment`
          : !bestEquipment ? "no unowned equipment candidate"
            : !roiQualified ? "candidate fails payback, cash-slice, cheap-gear, or reserve limit" : null;
    // R2 (docs/allocator-design.md): gang_gear / gang_augs flagged "valued" in valuation_flags.json obey
    // the allocator's grant (spend_grants.json); otherwise, or with a stale grant, this script's own rules.
    let grantRefused = [];
    const allocatorGate = (items) => {
      const modes = flagsFor(ns.read("valuation_flags.json"), ns.getResetInfo().lastNodeReset);
      if (modes.gang_gear !== "valued" && modes.gang_augs !== "valued") return items;
      let grants = null;
      try { grants = JSON.parse(ns.read("spend_grants.json") || "null"); } catch {}
      const tagged = items.map((i) => ({ ...i, kind: kindOf("gang", i, equipmentCategory(i.item)) }));
      const { allowed, refused } = grantFilter(tagged, modes, grants, Date.now(), ns.getResetInfo().lastAugReset);
      grantRefused = refused.map((r) => ({ item: r.item, member: r.member, cost: r.cost, reason: r.reason }));
      return allowed;
    };
    let bought = null;
    let boughtItems = [];
    let reputationGear = false;
    if (gangObjective === "reputation") {
      // Reputation mode: respect gain per dollar, several purchases per loop (see planReputationGear).
      reputationGear = true;
      const gate = Boolean(C.equipmentMasterEnabled && capitalPolicy.allowEquipmentPurchases && phaseAllowsEquipment);
      if (gate && cash > 0) {
        const maxFraction = Math.max(capitalPolicy.rootkitCashFraction, capitalPolicy.gangAugCashFraction);
        const repCandidates = [];
        for (const item of equipment) {
          if (item.cost > cash * maxFraction) continue;
          for (const member of members) {
            if (isOwned(member, item.item)) continue;
            const plan = plans.find((p) => p.member.name === member.name);
            if (!plan?.trained) continue;
            // Current task's respect, or the member's best respect task while they are on cleanup.
            const taskName = plan.choice?.respect > 0 ? plan.choice.task : plan.respect?.task;
            const taskInfo = tasks.find((t) => t.name === taskName);
            const gain = taskInfo
              ? projected(ns, gang, withEquipment(member, item.stats), taskInfo).respect - projected(ns, gang, member, taskInfo).respect
              : 0;
            repCandidates.push({ item: item.item, cost: item.cost, member: member.name, gain: Math.max(0, gain),
              ascRatio: ascRatios.get(member.name) });
          }
        }
        const picks = planReputationGear(repCandidates, { cash, isHacking: gang.isHacking,
          rootkitFraction: capitalPolicy.rootkitCashFraction, augFraction: capitalPolicy.gangAugCashFraction,
          ascendAt: C.ascendAt, maxPurchases: C.maxGearPurchasesPerLoop, reserve: augmentationTarget ?? 0 });
        for (const pick of allocatorGate(picks)) {
          if (ns.gang.purchaseEquipment(pick.member, pick.item)) boughtItems.push({ item: pick.item, member: pick.member, cost: pick.cost });
        }
        bought = boughtItems[0] || null;
      }
    } else {
      bought = purchaseAllowed && allocatorGate([bestEquipment]).length && ns.gang.purchaseEquipment(bestEquipment.member, bestEquipment.item) ? bestEquipment : null;
      if (bought) boughtItems = [bought];
    }
    if (boughtItems.length) purchaseLog = [...purchaseLog, ...boughtItems.map((b) => ({ ts: statusNow, ok: true, item: b.item, member: b.member, cost: b.cost }))].slice(-100);
    const gear = members.map((m) => ({ member: m.name, ...gearCounts(m) }));
    const gearTotals = { rootkits: gear.reduce((s, g) => s + g.rootkits, 0), augs: gear.reduce((s, g) => s + g.augs, 0),
      rootkitsPossible: members.length * GANG_ROOTKITS.length };
    const status = { ts: statusNow, grantRefused, mode, gangObjective, objectiveChoice, lastAscension, ascensionCount, recruitHold, gear, gearTotals,
      power: { ours: gang.power, strongestRival: strongestRivalPower },
      ascendAt: C.ascendAt, factionRep: Number.isFinite(factionRep) ? factionRep : null,
      observedFactionRepRate, projectedRespectPerCycle: plans.reduce((sum, p) => sum + (p.choice?.respect || 0), 0),
      projectedWantedRate: wanted, reputationPlan: reputationPlan && {
        targetWantedRate: reputationPlan.targetWantedRate, projectedWantedRate: reputationPlan.projectedWantedRate,
        projectedRespectRate: reputationPlan.projectedRespectRate, cleanerCount: reputationPlan.cleanerCount,
        targetMet: reputationPlan.targetMet, cyclesPerUpdate: C.wantedUpdateCycles,
      },
      assignments: plans.map((p) => ({ member: p.member.name, task: p.choice?.task || p.member.task,
        role: p.role || (p.trained ? mode : "training"), respect: p.choice?.respect || 0, wanted: p.choice?.wanted || 0 })),
      members: members.length, gang, projectedMoneyRate: gross,
      projectedWantedRate: reputationPlan?.projectedWantedRate ?? moneyPlan?.projectedWantedRate ?? wanted,
      moneyPlan: moneyPlan && { targetWantedRate: moneyPlan.targetWantedRate,
        projectedMoneyRate: moneyPlan.projectedMoneyRate, projectedWantedRate: moneyPlan.projectedWantedRate,
        cleanerCount: moneyPlan.cleanerCount, targetMet: moneyPlan.targetMet,
        cyclesPerUpdate: C.wantedUpdateCycles },
      cleanupMode, wantedCleanup: { severeMode: severeWantedMode,
        reductionFractionPerUpdate: wantedPolicy.reductionFraction,
        attainablePenalty: wantedPolicy.attainablePenalty,
        reputationBand: gangObjective === "reputation"
          ? { enter: capitalPolicy.reputationCleanupEnter, exit: capitalPolicy.reputationCleanupExit } : null },
      territory: { policyEnabled: territoryEnabled, fight, weightedChance, rivals: clashes.length,
        lowestCombat: Math.min(...members.map(combatFloor)), clashChance: gang.territoryClashChance,
        trial: trial ? { untilMs: trial.untilMs, members: trialCohort.map((p) => p.member.name),
          cohortPower: trialCohort.reduce((sum, p) => sum + memberPower(p.member), 0) } : null },
      capital: { phase: capitalPolicy.phase, objective: capitalPolicy.objective, cash, observedCashRate,
        augmentationCashTarget: augmentationTarget, policyAllowsPurchases: capitalPolicy.allowEquipmentPurchases,
        sourceMasterEnabled: C.equipmentMasterEnabled, purchaseAllowed, blockedReason,
        candidate: bestEquipment, cashBudget },
      equipment: { enabled: C.equipmentMasterEnabled && capitalPolicy.allowEquipmentPurchases, allowed: reputationGear ? boughtItems.length > 0 : purchaseAllowed, nextItem, bestEquipment, bought, boughtItems,
        cashBudget, maxPaybackSeconds: C.equipmentMaxPaybackSeconds }, purchases: purchaseLog };
    ns.write(C.statusFile, JSON.stringify(status), "w");
    await ns.gang.nextUpdate();
  }
}
