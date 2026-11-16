/**
 * Pure decision logic for bladeburner.js (no ns calls, unit-tested).
 *
 * The controller gathers a snapshot (rank, stamina, every action's success range,
 * time, count and rank gain, city chaos) and asks chooseAction() what to do next.
 * Score = success chance x rank gain / seconds. The chance used is the low end of
 * the estimate while the range is still wide, so an unproven action is never chosen
 * on optimism; Field Analysis narrows the range when the best candidate is held back
 * only by that uncertainty.
 */

export const DEFAULT_CONFIG = {
  enabled: true,
  allowDaedalus: false, // Operation Daedalus ends the BitNode; never set true without Ken
  ownPlayer: true, // player_activity_controller stands down while this is true and the status is fresh
  minChance: { Contracts: 0.8, Operations: 0.8 },
  blackOpMinChance: 0.9,
  narrowSpread: 0.05, // a range narrower than this counts as known; use its midpoint
  analysisSpread: 0.1, // do Field Analysis when the best candidate's range is wider than this
  staminaRestBelow: 0.55, // rest when stamina falls below this share of max (game penalises below 0.5)
  staminaResumeAbove: 0.95,
  chaosMax: 50, // Diplomacy above this in the current city
  restAction: "Hyperbolic Regeneration Chamber",
  skipActions: ["Raid", "Stealth Retirement Operation", "Incite Violence", "Recruitment"],
  skillWeights: {
    "Blade's Intuition": 3, "Digital Observer": 2, Tracer: 2, Overclock: 2, Cloak: 1.5, "Short-Circuit": 1.5,
    Reaper: 1, "Evasive System": 1, "Cyber's Edge": 0.8, Hyperdrive: 0.5, "Hands of Midas": 0.3, Datamancer: 0.3,
  },
  skillMaxLevel: { Overclock: 90 },
}

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)

/** Chance to plan with: midpoint once the estimate is narrow, the low end before that. */
export function plannedChance([lo, hi] = [0, 0], narrowSpread = DEFAULT_CONFIG.narrowSpread) {
  lo = num(lo); hi = num(hi, lo)
  return hi - lo <= narrowSpread ? (lo + hi) / 2 : lo
}

export function scoreAction(action, config = DEFAULT_CONFIG) {
  const seconds = Math.max(0.001, num(action.timeMs) / 1000)
  return (plannedChance(action.chance, config.narrowSpread) * num(action.repGain)) / seconds
}

const key = (a) => (a ? `${a.type}/${a.name}` : "none")
export { key as actionKey }

/**
 * @param {object} s snapshot: { rank, stamina:[cur,max], cityChaos, nextBlackOp:{name,rank}|null, actions:[...], resting:boolean }
 * @returns {{type:string,name:string,reason:string,resting:boolean}}
 */
export function chooseAction(s, config = DEFAULT_CONFIG) {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const [stamina, maxStamina] = s.stamina || [0, 1]
  const share = maxStamina > 0 ? stamina / maxStamina : 0
  let resting = Boolean(s.resting)
  if (share < cfg.staminaRestBelow) resting = true
  else if (share >= cfg.staminaResumeAbove) resting = false
  if (resting) return { type: "General", name: cfg.restAction, reason: `stamina ${(share * 100).toFixed(0)}% (rest until ${cfg.staminaResumeAbove * 100}%)`, resting: true }

  if (num(s.cityChaos) > cfg.chaosMax) return { type: "General", name: "Diplomacy", reason: `city chaos ${num(s.cityChaos).toFixed(0)} > ${cfg.chaosMax}`, resting }

  const actions = s.actions || []
  const bo = s.nextBlackOp
  // Operation Daedalus ends the BitNode: Ken's call, never automatic (allowDaedalus stays false).
  if (bo && bo.name === "Operation Daedalus" && !cfg.allowDaedalus) {
    // fall through to rank work; the controller reports daedalusReady for the stop-and-notify step
  } else if (bo && num(s.rank) >= num(bo.rank)) {
    const boa = actions.find((a) => a.type === "Black Operations" && a.name === bo.name)
    if (boa && num(boa.chance?.[0]) >= cfg.blackOpMinChance) {
      return { type: "Black Operations", name: bo.name, reason: `black op ready: rank ${num(s.rank).toFixed(0)} >= ${bo.rank}, chance ${num(boa.chance[0]).toFixed(2)}`, resting }
    }
  }

  const candidates = actions.filter((a) => (a.type === "Contracts" || a.type === "Operations") && num(a.count) >= 1 && !cfg.skipActions.includes(a.name))
  const eligible = candidates.filter((a) => num(a.chance?.[0]) >= num(cfg.minChance[a.type], 0.8))
  const best = eligible.sort((a, b) => scoreAction(b, cfg) - scoreAction(a, cfg))[0] || null

  // Would a candidate beat the best if its range were narrowed to its midpoint? Then analyse.
  const optimistic = candidates
    .map((a) => ({ a, mid: (num(a.chance?.[0]) + num(a.chance?.[1], a.chance?.[0])) / 2 }))
    .filter(({ a }) => !(s.analysisBlocked || []).includes(a.name))
    .filter(({ a }) => num(a.chance?.[1]) >= num(cfg.minChance[a.type], 0.8) && num(a.chance?.[1]) - num(a.chance?.[0]) > cfg.analysisSpread)
    .map(({ a, mid }) => ({ a, score: (mid * num(a.repGain)) / Math.max(0.001, num(a.timeMs) / 1000) }))
    .sort((x, y) => y.score - x.score)[0]
  if (optimistic && (!best || optimistic.score > scoreAction(best, cfg) * 1.2)) {
    return { type: "General", name: "Field Analysis", reason: `narrow estimate: ${optimistic.a.name} range ${num(optimistic.a.chance[0]).toFixed(2)}-${num(optimistic.a.chance[1]).toFixed(2)}`, resting }
  }
  if (best) return { type: best.type, name: best.name, reason: `best rank/s ${scoreAction(best, cfg).toFixed(3)} at chance ${plannedChance(best.chance, cfg.narrowSpread).toFixed(2)}`, resting }
  return { type: "General", name: "Training", reason: "no contract or operation clears the success bar", resting }
}

/** Switch only at an action boundary, or when the current action is not ours / is a general filler. */
export function shouldSwitch({ current, desired, elapsedMs, boundary }) {
  if (!desired) return false
  if (!current || current.type === "Idle" || !current.name) return true
  if (key(current) === key(desired)) return false
  if (boundary) return true
  if (current.type === "General") return true // fillers lose little when interrupted
  return num(elapsedMs) < 1000
}

/** Greedy skill buys: highest weight per point first, within available points. */
export function planSkillBuys(skills = {}, points = 0, config = DEFAULT_CONFIG) {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const state = Object.fromEntries(Object.entries(skills).map(([k, v]) => [k, { level: num(v?.level), cost: num(v?.cost, Infinity) }]))
  const buys = []
  let left = num(points)
  for (let guard = 0; guard < 200; guard++) {
    // Best value per point overall; if it is not affordable yet, save for it rather than buy a cheap low-value skill.
    const pick = Object.entries(state)
      .filter(([name, v]) => num(cfg.skillWeights[name]) > 0 && Number.isFinite(v.cost) && v.level < num(cfg.skillMaxLevel[name], Infinity))
      .sort(([a, va], [b, vb]) => cfg.skillWeights[b] / vb.cost - cfg.skillWeights[a] / va.cost)[0]
    if (!pick || pick[1].cost > left) break
    const [name, v] = pick
    buys.push(name)
    left -= v.cost
    v.level += 1
    v.cost = Infinity // cost of the next level is unknown until re-read; one buy per skill per pass
  }
  return buys
}
