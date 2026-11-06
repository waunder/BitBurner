/** Install timing advice. Pure: no ns calls. Shadow mode: it advises, nothing acts on it.
 *
 * An install is the patch-leaving decision of optimal foraging (the marginal
 * value theorem). A cycle runs from one install to the next and its rebuild
 * time is already inside the elapsed hours. Keep earning rep while the next
 * augmentation adds value faster than this cycle has averaged so far; install
 * once it does not. Value is weighted log multiplier gain, so stacking is
 * additive and the weights (run_target.json `augWeights`) say what the current
 * run target needs. Level is mult x (32 ln(exp + 534.6) - 200), so level
 * multipliers dominate exp multipliers; the defaults reflect that.
 */

export const DEFAULT_WEIGHTS = {
  hacking: 1, strength: 0.25, defense: 0.25, dexterity: 0.25, agility: 0.25,
  hacking_exp: 0.1, strength_exp: 0.025, defense_exp: 0.025, dexterity_exp: 0.025, agility_exp: 0.025,
  faction_rep: 0.5,
}

export function augValue(stats, weights = DEFAULT_WEIGHTS) {
  let value = 0
  for (const [key, weight] of Object.entries(weights)) {
    const mult = Number(stats?.[key])
    if (Number.isFinite(mult) && mult > 0) value += Number(weight) * Math.log(mult)
  }
  return value
}

/** Rep per hour the player can earn: the fastest faction rep rise between two readiness samples. */
export function bestRepRate(previous, current, hours) {
  if (!(hours > 0) || !previous || !current) return null
  let best = 0
  for (const [faction, rep] of Object.entries(current)) {
    const before = Number(previous[faction])
    if (Number.isFinite(before)) best = Math.max(best, (Number(rep) - before) / hours)
  }
  return best > 0 ? best : null
}

/**
 * @param {{batch:{name:string,value:number}[], candidates:{name:string,repGap:number,value:number}[],
 *          cycleHours:number, repPerHour:number|null}} input
 */
export function installAdvice({ batch = [], candidates = [], cycleHours, repPerHour }) {
  const batchValue = batch.reduce((sum, item) => sum + Math.max(0, item.value), 0)
  const average = cycleHours > 0 ? batchValue / cycleHours : 0
  const scored = repPerHour > 0
    ? candidates
      .filter((item) => item.value > 0 && item.repGap > 0)
      .map((item) => ({ ...item, hours: item.repGap / repPerHour }))
      .map((item) => ({ ...item, rate: item.value / item.hours }))
      .sort((a, b) => b.rate - a.rate)
    : []
  const next = scored[0] || null
  const base = { batchValue, average, cycleHours, repPerHour, next }
  if (!(repPerHour > 0)) return { ...base, verdict: "unknown", reason: "rep rate not sampled yet" }
  if (batchValue <= 0) {
    return { ...base, verdict: "build", reason: next ? `nothing to install yet; best next ${next.name} in ${hours(next.hours)}` : "nothing to install; no valued augmentation in joined factions (value lies in factions not yet joined)" }
  }
  if (next && next.rate > average) {
    return { ...base, verdict: "wait", reason: `wait ${hours(next.hours)} for ${next.name}: ${per(next.rate)} beats the cycle's ${per(average)}` }
  }
  return {
    ...base, verdict: "install",
    reason: next ? `install now: best next ${next.name} adds ${per(next.rate)}, under the cycle's ${per(average)}` : "install now: nothing left worth waiting for",
  }
}

/**
 * Multiplier factor a skill needs to reach `target` within one cycle of `cycleHours`,
 * starting from zero exp at `expPerHour`. The current mult is inferred from level and exp.
 */
export function multFactorNeeded({ level, exp, target, expPerHour, cycleHours = 24 }) {
  const base = 32 * Math.log(Number(exp) + 534.6) - 200
  const now = base > 0 ? Number(level) / base : 0
  const reach = 32 * Math.log(Number(expPerHour) * cycleHours + 534.6) - 200
  if (!(now > 0) || !(reach > 0)) return null
  return Math.max(1, target / reach / now)
}

function hours(h) {
  return h < 1 ? `${Math.max(1, Math.round(h * 60))}m` : `${h.toFixed(1)}h`
}

// A weighted log gain reads as an effective multiplier gain: exp(v) - 1.
function per(rate) {
  return `+${((Math.exp(rate) - 1) * 100).toFixed(1)}%/h`
}
