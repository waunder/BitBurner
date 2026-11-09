/** Pure gang task allocation logic. Kept separate so the planner can be tested
 * without a live Netscript runtime.
 */

/**
 * Assign reputation tasks while meeting a wanted-reduction target whenever
 * possible. With at most twelve members, exhaustive search is small (4096
 * allocations) and guarantees the highest respect rate among feasible plans.
 *
 * Each plan has { member, choice, respect, trained }. `respect` and `choice`
 * are formula projections with task, respect, wanted, and money fields.
 *
 * @param {Array<object>} plans
 * @param {number} wantedLevel
 * @param {number} [wantedReductionFraction=0.001]
 * @param {number} [cyclesPerUpdate=10] Normal gang processing batches ten 200ms cycles.
 */
export function planReputationTasks(plans, wantedLevel, wantedReductionFraction = 0.001, cyclesPerUpdate = 10) {
  const prepared = plans.map((plan) => ({
    ...plan,
    base: plan.trained && plan.respect ? plan.respect : plan.choice,
    cleaner: plan.trained && plan.clean?.wanted < 0 ? plan.clean : null,
  }));
  const candidates = prepared.filter((plan) => plan.cleaner);
  const fixedRespect = prepared.filter((plan) => !plan.cleaner)
    .reduce((sum, plan) => sum + (plan.base?.respect || 0), 0);
  const fixedWanted = prepared.filter((plan) => !plan.cleaner)
    .reduce((sum, plan) => sum + (plan.base?.wanted || 0), 0);
  const fixedJustice = prepared.filter((plan) => !plan.cleaner && plan.base?.wanted < 0).length;
  const cycles = Math.max(1, cyclesPerUpdate);
  // The configured reduction fraction is per gang batch, while exposed rates
  // are averaged over each 200ms cycle. Keep the target in the same units.
  const targetWanted = -Math.max(0, wantedLevel * wantedReductionFraction / cycles);
  let best = null;
  let bestFallback = null;
  const allocations = 2 ** candidates.length;

  for (let mask = 0; mask < allocations; mask++) {
    let respect = fixedRespect;
    let rawWanted = fixedWanted;
    let cleaners = 0;
    let justice = fixedJustice;
    for (let i = 0; i < candidates.length; i++) {
      const plan = candidates[i];
      const useCleaner = (mask & (1 << i)) !== 0;
      const task = useCleaner ? plan.cleaner : plan.base;
      respect += task?.respect || 0;
      rawWanted += task?.wanted || 0;
      if (task?.wanted < 0) justice++;
      if (useCleaner) cleaners++;
    }
    // Gang.processGains accumulates ten 200ms task-gain cycles, applies the
    // cleaner multiplier once to the batch, then exposes wantedGainRate per
    // cycle. Mirror that order so this projection matches getGangInformation.
    const wanted = ((wantedLevel + rawWanted * cycles) * (1 - justice * 0.001) - wantedLevel) / cycles;
    const candidate = { mask, respect, wanted, cleaners };
    if (!bestFallback || wanted < bestFallback.wanted
      || (wanted === bestFallback.wanted && respect > bestFallback.respect)) bestFallback = candidate;
    if (wanted <= targetWanted && (!best || respect > best.respect
      || (respect === best.respect && wanted > best.wanted))) best = candidate;
  }

  const selected = best || bestFallback;
  const assignments = prepared.map((plan) => ({ ...plan, choice: plan.base, role: "respect" }));
  for (let i = 0; i < candidates.length; i++) {
    if ((selected.mask & (1 << i)) === 0) continue;
    const candidate = candidates[i];
    const index = assignments.findIndex((plan) => plan.member.name === candidate.member.name);
    assignments[index] = { ...assignments[index], choice: candidate.cleaner, role: "wanted-recovery" };
  }

  return {
    assignments,
    targetWantedRate: targetWanted,
    projectedRespectRate: selected.respect,
    projectedWantedRate: selected.wanted,
    cleanerCount: selected.cleaners,
    targetMet: Boolean(best),
  };
}

/** Maximize gang money while meeting the same per-batch wanted target. */
export function planMoneyTasks(plans, wantedLevel, wantedReductionFraction = 0.001, cyclesPerUpdate = 10) {
  const prepared = plans.map((plan) => ({
    ...plan,
    base: plan.choice,
    cleaner: plan.trained && plan.clean?.wanted < 0 ? plan.clean : null,
  }));
  const candidates = prepared.filter((plan) => plan.cleaner);
  const fixedMoney = prepared.filter((plan) => !plan.cleaner)
    .reduce((sum, plan) => sum + (plan.base?.money || 0), 0);
  const fixedWanted = prepared.filter((plan) => !plan.cleaner)
    .reduce((sum, plan) => sum + (plan.base?.wanted || 0), 0);
  const fixedJustice = prepared.filter((plan) => !plan.cleaner && plan.base?.wanted < 0).length;
  const cycles = Math.max(1, cyclesPerUpdate);
  const targetWanted = -Math.max(0, wantedLevel * wantedReductionFraction / cycles);
  let best = null;
  let bestFallback = null;

  for (let mask = 0; mask < 2 ** candidates.length; mask++) {
    let money = fixedMoney;
    let rawWanted = fixedWanted;
    let cleaners = 0;
    let justice = fixedJustice;
    for (let i = 0; i < candidates.length; i++) {
      const plan = candidates[i];
      const task = (mask & (1 << i)) !== 0 ? plan.cleaner : plan.base;
      money += task?.money || 0;
      rawWanted += task?.wanted || 0;
      if (task?.wanted < 0) justice++;
      if ((mask & (1 << i)) !== 0) cleaners++;
    }
    const wanted = ((wantedLevel + rawWanted * cycles) * (1 - justice * 0.001) - wantedLevel) / cycles;
    const candidate = { mask, money, wanted, cleaners };
    if (!bestFallback || wanted < bestFallback.wanted
      || (wanted === bestFallback.wanted && money > bestFallback.money)) bestFallback = candidate;
    if (wanted <= targetWanted && (!best || money > best.money
      || (money === best.money && wanted > best.wanted))) best = candidate;
  }

  const selected = best || bestFallback;
  const assignments = prepared.map((plan) => ({ ...plan, choice: plan.base, role: plan.trained ? "money" : "training" }));
  for (let i = 0; i < candidates.length; i++) {
    if ((selected.mask & (1 << i)) === 0) continue;
    const candidate = candidates[i];
    const index = assignments.findIndex((plan) => plan.member.name === candidate.member.name);
    assignments[index] = { ...assignments[index], choice: candidate.cleaner, role: "wanted-recovery" };
  }
  return { assignments, targetWantedRate: targetWanted, projectedMoneyRate: selected.money,
    projectedWantedRate: selected.wanted, cleanerCount: selected.cleaners, targetMet: Boolean(best) };
}

/** Select money-mode priority before applying recruitment growth. */
export function moneyModePriority(cleanupMode, hasCleaner, recruitGrowth) {
  if (cleanupMode && hasCleaner) return "wanted-recovery";
  if (recruitGrowth) return "respect";
  return "cash";
}

/** Hysteretic faster-cleanup band based on the gang wanted multiplier. */
export function wantedCleanupPolicy(wantedPenalty, severeMode, cleanupMode, respect,
  severeEnter = 0.05, severeExit = 0.10, normalFraction = 0.001,
  severeFraction = 0.04, cleanupEnterRatio = 0.99, cleanupExitRatio = 0.995) {
  const attainablePenalty = respect > 0 ? respect / (respect + 1) : 0;
  const nextCleanup = cleanupMode
    ? wantedPenalty < attainablePenalty * cleanupExitRatio
    : wantedPenalty < attainablePenalty * cleanupEnterRatio;
  const nextSevere = severeMode ? wantedPenalty < severeExit : wantedPenalty < severeEnter;
  return { cleanupMode: nextCleanup, severeMode: nextSevere,
    reductionFraction: nextSevere ? severeFraction : normalFraction,
    attainablePenalty };
}

/**
 * Reputation-mode cleanup band on the absolute wanted penalty. The attainable-penalty band above
 * (0.998/0.999) suits a large gang; for a young one each respect batch adds more wanted than nine
 * cleaners remove, so that band kept every member on cleanup >95% of the time (2026-11-08).
 * Enter cleanup below `enter`, leave it at `exit` or above, both scaled by the attainable penalty
 * respect/(respect+1): wanted level cannot go below 1, so a new gang (respect 1, penalty 0.5) sat
 * in cleanup with no way out and earned no respect for hours (BN10 run 2, 2026-11-09).
 */
export function reputationCleanupMode(wantedPenalty, cleanupMode, enter = 0.90, exit = 0.95,
  attainablePenalty = 1) {
  const scale = attainablePenalty > 0 ? attainablePenalty : 1;
  return cleanupMode ? wantedPenalty < exit * scale : wantedPenalty < enter * scale;
}

/** Keep clash exposure behind both per-rival and territory-weighted odds gates. */
export function shouldEngageTerritoryClashes(territory, chances, minWin = 0.58, weightedMin = 0.65) {
  const eligible = chances.filter((item) => (item.territory || 0) > 0);
  if (eligible.some((item) => !Number.isFinite(item.chance))) {
    return { engage: false, weightedChance: 0 };
  }
  const weight = eligible.reduce((sum, item) => sum + Math.max(0, item.territory || 0), 0);
  const weightedChance = weight
    ? eligible.reduce((sum, item) => sum + item.chance * Math.max(0, item.territory || 0), 0) / weight
    : 0;
  return { engage: territory < 0.99 && eligible.length > 0
    && eligible.every((item) => item.chance >= minWin)
    && weightedChance >= weightedMin, weightedChance };
}

/** Avoid ascensions that undermine cleanup, power building, or the wanted floor. */
export function shouldAscendMember({ objective, cleanupMode, severeMode, territoryPowerMode,
  multiplier, threshold = 1.25, respect, respectToDeduct, wantedLevel,
  cleanupEnterRatio = 0.99 }) {
  if (objective === "reputation" || cleanupMode || severeMode || territoryPowerMode
    || !Number.isFinite(multiplier) || multiplier < threshold) return false;
  const projectedRespect = Math.max(1, respect - Math.max(0, respectToDeduct || 0));
  const projectedPenalty = projectedRespect / (projectedRespect + Math.max(0, wantedLevel || 0));
  const usefulPenaltyFloor = (respect / (respect + 1)) * cleanupEnterRatio;
  return projectedPenalty >= usefulPenaltyFloor;
}

/** Assign only the lowest-value cash cohort to build territory power. */
export function planTerritoryPower(plans, taskName, share = 0.35) {
  const builders = plans.filter((plan) => plan.trained)
    .sort((a, b) => (a.choice?.money || 0) - (b.choice?.money || 0));
  const count = Math.min(builders.length, Math.max(1, Math.ceil(plans.length * share)));
  const names = new Set(builders.slice(0, count).map((plan) => plan.member.name));
  return plans.map((plan) => names.has(plan.member.name)
    ? { ...plan, choice: { task: taskName, money: 0, respect: 0, wanted: 0 }, role: "territory-power" }
    : plan);
}

/** Gate power building to idle money mode and after residual clash chance decays. */
export function canBuildTerritoryPower({ objective, cleanupMode, territory, rosterFull, hasRivals,
  taskAvailable, combatReady, clashSafe, currentlyEngaged, oddsPass }) {
  const riskAllowed = currentlyEngaged ? oddsPass : clashSafe;
  return objective === "money" && !cleanupMode && territory < 0.99 && rosterFull && hasRivals
    && taskAvailable && combatReady && riskAllowed;
}

/**
 * Gear worth buying on cash alone: it costs at most `fraction` of cash and raises a stat the
 * gang's tasks use (hacking gang: hack and cha; combat gang: str, def, dex, agi; bitburner-src
 * src/Gang/data/tasks.ts weights). Money payback cannot value respect or faction rep.
 */
export function cheapGearQualifies({ cost, stats = {}, cash, isHacking, fraction = 0.0001 }) {
  const used = isHacking ? ["hack", "cha"] : ["str", "def", "dex", "agi"];
  const helps = used.some((stat) => Number(stats[stat]) > 1);
  return helps && Number.isFinite(Number(cost)) && Number(cost) > 0 && Number(cost) <= Number(cash) * fraction;
}
