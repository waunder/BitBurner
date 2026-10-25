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
