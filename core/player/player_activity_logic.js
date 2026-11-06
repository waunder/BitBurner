/** Pure, testable policy for the one player-controlled activity. */

const PHYSICAL_SKILLS = ["strength", "defense", "dexterity", "agility"]

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

/**
 * Pick the next player activity from explicit, observable gates only.
 *
 * `physicalTarget` is deliberately a configuration value, rather than a
 * guessed augmentation property: the game does not expose faction-invitation
 * requirements through Singularity. The supplied default is the known 30 in
 * each combat stat Slum Snakes gate. Set it to 0 to leave physical training
 * entirely out of automatic control.
 */
/** Best crime by money rate when cash is short, otherwise by karma rate. The game reports karma lost as positive. */
export function pickCrime(rows, cashShort) {
  let best = null
  for (const { crime, chance, time, karma, money } of rows) {
    if (!(time > 0)) continue
    const candidate = {
      action: "crime", crime, chance,
      expectedKarmaPerSecond: Math.abs(karma) * chance / (time / 1000),
      expectedMoneyPerSecond: money * chance / (time / 1000),
    }
    const key = cashShort ? "expectedMoneyPerSecond" : "expectedKarmaPerSecond"
    if (candidate[key] > 0 && Number.isFinite(candidate[key]) && (!best || candidate[key] > best[key])) best = candidate
  }
  return best
}

// bitburner-src dev, src/Faction/FactionInfo.tsx, TheCovenant inviteReqs:
// [haveAugmentations(20), haveMoney(75e9), haveSkill("hacking", 850), haveCombatSkills(850)]
// haveAugmentations counts installed augmentations only (src/Faction/FactionJoinCondition.ts).
export const COVENANT = { faction: "The Covenant", augs: 20, money: 75e9, hacking: 850, combat: 850 }

// bitburner-src dev, src/PersonObjects/formulas/skill.ts: level = floor(mult * (32 * ln(exp + 534.6) - 200)).
// The effective mult (augmentations x BitNode) is inferred from the current level and exp.
export function expForLevel(level, exp, target) {
  const base = 32 * Math.log(number(exp) + 534.6) - 200
  const mult = base > 0 ? number(level) / base : 0
  if (!(mult > 0)) return null
  return Math.exp((target / mult + 200) / 32) - 534.6
}

/** Gym hours to lift every combat stat to the Covenant gate, or null when exp is not reported. */
export function covenantGymHours(player, expPerSecond) {
  let seconds = 0
  for (const skill of PHYSICAL_SKILLS) {
    const level = number(player.skills?.[skill])
    if (level >= COVENANT.combat) continue
    if (!Number.isFinite(Number(player.exp?.[skill]))) return null
    const need = expForLevel(level, player.exp[skill], COVENANT.combat)
    if (need === null) return null
    seconds += Math.max(0, need - number(player.exp[skill])) / expPerSecond
  }
  return seconds / 3600
}

/**
 * Train toward The Covenant's stat gates once its augmentation and money gates are close.
 * Off unless `covenantTarget` is true, and BN10 only: the faction's sleeve shop works nowhere else.
 */
function covenantTraining({ player, augmentation, config, bitNode }) {
  if (config.covenantTarget !== true || Number(bitNode) !== 10) return null
  if ((player.factions || []).includes(COVENANT.faction)) return null
  const owned = number(augmentation?.installedCount) + number(augmentation?.queuedCount)
  const fraction = Math.min(1, Math.max(0, number(config.covenantCloseFraction ?? 0.5)))
  if (owned < COVENANT.augs || number(player.money) < COVENANT.money * fraction) return null
  // Combat exp per level grows exponentially; at low multipliers 850 is out of reach and gym time is wasted.
  const hours = covenantGymHours(player, Math.max(1, number(config.covenantGymExpPerSec ?? 20)))
  if (hours !== null && hours > number(config.covenantMaxTrainHours ?? 48)) return null
  const weakest = PHYSICAL_SKILLS
    .map((skill) => ({ skill, level: number(player.skills?.[skill]) }))
    .filter((item) => item.level < COVENANT.combat)
    .sort((a, b) => a.level - b.level || PHYSICAL_SKILLS.indexOf(a.skill) - PHYSICAL_SKILLS.indexOf(b.skill))[0]
  if (weakest) {
    return {
      action: "gym", gym: config.gym || "Powerhouse Gym", city: config.gymCity || "Sector-12", stat: weakest.skill,
      target: COVENANT.combat, current: weakest.level,
      reason: `${weakest.skill} ${weakest.level}/${COVENANT.combat}: The Covenant invite needs all combat stats ${COVENANT.combat}`,
      confidence: "HIGH",
    }
  }
  const hacking = number(player.skills?.hacking)
  if (hacking < COVENANT.hacking) {
    return {
      action: "algorithms", university: config.university || "Rothman University", city: config.universityCity || "Sector-12", course: "Algorithms",
      required: COVENANT.hacking, host: COVENANT.faction,
      reason: `H${hacking} → H${COVENANT.hacking} for The Covenant invite`, confidence: "HIGH",
    }
  }
  return null
}

export function choosePlayerActivity({ player = {}, nextGate = null, augmentation = null, crimeCandidate = null, config = {}, bitNode = null } = {}) {
  const override = String(config.override || "auto").toLowerCase()
  if (config.enabled === false || override === "manual") {
    return { action: "hold", reason: "manual override is active", confidence: "HIGH" }
  }

  if (override === "algorithms") {
    return { action: "algorithms", university: config.university || "Rothman University", city: config.universityCity || "Sector-12", course: "Algorithms", reason: "explicit Algorithms override", confidence: "HIGH" }
  }
  if (override === "crime") {
    return crimeCandidate
      ? { ...crimeCandidate, reason: "explicit crime override", confidence: "HIGH" }
      : { action: "hold", reason: "crime override selected, but crime API is unavailable", confidence: "LOW" }
  }

  const target = Math.max(0, number(config.physicalTarget ?? 30))
  if (override === "physical" || (override === "auto" && target > 0)) {
    const weakest = PHYSICAL_SKILLS
      .map((skill) => ({ skill, level: number(player.skills?.[skill]) }))
      .filter((item) => item.level < target)
      .sort((a, b) => a.level - b.level || PHYSICAL_SKILLS.indexOf(a.skill) - PHYSICAL_SKILLS.indexOf(b.skill))[0]
    if (weakest) {
      return {
        action: "gym", gym: config.gym || "Powerhouse Gym", city: config.gymCity || "Sector-12", stat: weakest.skill,
        target, current: weakest.level,
        reason: `${weakest.skill} ${weakest.level}/${target}: physical baseline for Slum Snakes`,
        confidence: "HIGH",
      }
    }
  }

  // Darknet labs gate on charisma, and logins speed up with it. Worth more than
  // Algorithms now xp_filler.js supplies hacking XP. Off when charismaTarget is 0.
  const charismaTarget = Math.max(0, number(config.charismaTarget))
  const charisma = number(player.skills?.charisma)
  // A fresh install has no cash for travel or tuition, and a refused course leaves the player idle.
  const trainingCash = number(config.minTrainingCash ?? 1e7)
  if (override === "auto" && number(player.money) < trainingCash && crimeCandidate) {
    return { ...crimeCandidate, reason: `crime for cash ${number(player.money).toFixed(0)}/${trainingCash} before training`, confidence: "HIGH" }
  }
  if (override === "auto") {
    const covenant = covenantTraining({ player, augmentation, config, bitNode })
    if (covenant) return covenant
  }
  // Corporate factions invite on company rep alone, and sell the charisma augmentations the later labs need.
  const corp = config.companyTarget
  if (override === "auto" && corp?.company && !(player.factions || []).includes(corp.company)) {
    return { action: "company", company: corp.company, field: corp.field || "Business", reason: `company rep at ${corp.company} until its faction invites`, confidence: "HIGH" }
  }
  // Ken's named picks take faction work ahead of everything else, charisma augmentations included.
  const priorityAug = override === "auto" ? repTarget(player, augmentation, config, new Set(config.priorityAugs || [])) : null
  if (priorityAug) {
    return {
      action: "faction", faction: priorityAug.faction, workType: config.factionWorkType || "hacking",
      augmentation: priorityAug.name, repGap: number(priorityAug.repGap), price: number(priorityAug.price),
      reason: `${priorityAug.faction} needs +${Math.ceil(number(priorityAug.repGap))} rep for ${priorityAug.name} (priority)`,
      confidence: "HIGH",
    }
  }
  // Level scales with the multiplier but only the log of exp, so charisma augmentations beat Leadership.
  // Later labs need more than charismaTarget, so this does not stop at it.
  const charismaAug = override === "auto" ? repTarget(player, augmentation, config, new Set(config.charismaAugs || [])) : null
  if (charismaAug) {
    return {
      action: "faction", faction: charismaAug.faction, workType: config.factionWorkType || "hacking",
      augmentation: charismaAug.name, repGap: number(charismaAug.repGap), price: number(charismaAug.price),
      reason: `${charismaAug.faction} needs +${Math.ceil(number(charismaAug.repGap))} rep for ${charismaAug.name}`,
      confidence: "HIGH",
    }
  }
  if (override === "auto" && charisma < charismaTarget) {
    return {
      action: "leadership", university: config.charismaUniversity || "ZB Institute of Technology",
      city: config.charismaCity || "Volhaven", course: "Leadership", target: charismaTarget, current: charisma,
      reason: `charisma ${charisma}/${charismaTarget} for darknet labs`, confidence: "HIGH",
    }
  }

  // xp_filler.js supplies hacking XP, so with an install pending rep is the scarce input.
  const hacking = number(player.skills?.hacking)
  if (nextGate && number(nextGate.required) > hacking && !(config.repBeforeGates && override === "auto" && hasRepTarget(player, augmentation, config))) {
    return {
      action: "algorithms", university: config.university || "Rothman University", city: config.universityCity || "Sector-12", course: "Algorithms",
      required: number(nextGate.required), host: nextGate.host,
      reason: `H${hacking} → H${number(nextGate.required)} for ${nextGate.host}`,
      confidence: "HIGH",
    }
  }

  const candidate = repTarget(player, augmentation, config)
  if (candidate) {
    return {
      action: "faction", faction: candidate.faction, workType: config.factionWorkType || "hacking",
      augmentation: candidate.name, repGap: number(candidate.repGap), price: number(candidate.price),
      reason: `${candidate.faction} needs +${Math.ceil(number(candidate.repGap))} rep for ${candidate.name}`
        + (candidate.cashReady ? " (cash ready)" : " (rep ahead of cash within configured range)"),
      confidence: candidate.cashReady ? "HIGH" : "MEDIUM",
    }
  }

  const karmaTarget = Number(config.crimeKarmaTarget)
  if (Number.isFinite(karmaTarget) && number(player.karma) > karmaTarget && crimeCandidate) {
    return { ...crimeCandidate, reason: `crime for karma ${number(player.karma).toFixed(0)} → ${karmaTarget}`, confidence: "HIGH" }
  }

  return { action: "hold", reason: "no actionable Hack gate, reachable faction reputation target, or karma requirement", confidence: "LOW" }
}

/** Unfocused work pays 80% rep. Retried hourly, so anyone can leave the work page for a while. */
export function shouldFocus({ config = {}, action, selected, focused, now, lastFocusAt = 0, retryMs = 60 * 60 * 1000 } = {}) {
  return config.focusWork === true && selected === true && focused === false
    && (action === "company" || action === "faction") && now - lastFocusAt >= retryMs
}

export function actionKey(decision) {
  if (!decision || decision.action === "hold") return "hold"
  if (decision.action === "gym") return `gym:${decision.gym}:${decision.stat}:${decision.target}`
  if (decision.action === "algorithms") return `algorithms:${decision.university}:${decision.course}`
  if (decision.action === "leadership") return `leadership:${decision.university}:${decision.course}`
  if (decision.action === "faction") return `faction:${decision.faction}:${decision.workType}`
  if (decision.action === "crime") return `crime:${decision.crime}`
  if (decision.action === "company") return `company:${decision.company}`
  return String(decision.action)
}

export function shouldSwitch({ now, previous = {}, desired, cooldownMs = 10 * 60 * 1000 } = {}) {
  if (!desired || desired.action === "hold") return { switch: false, reason: desired?.reason || "hold" }
  const key = actionKey(desired)
  // A prior failed launch must not permanently masquerade as an active
  // activity merely because it recorded the desired key. A finite timestamp
  // is our durable proof that the Singularity call actually accepted it.
  if (previous.actionKey === key && Number.isFinite(previous.lastSwitchAt)) return { switch: false, reason: "already selected" }
  if (Number.isFinite(previous.lastSwitchAt) && now - previous.lastSwitchAt < cooldownMs) {
    return { switch: false, reason: `cooldown ${Math.ceil((cooldownMs - (now - previous.lastSwitchAt)) / 1000)}s` }
  }
  return { switch: true, reason: "new evidence-backed activity" }
}

function repTarget(player, augmentation, config, only = null) {
  const targets = augmentation?.ok
    ? (augmentation.workCandidates || [augmentation.workCandidate || augmentation.candidate].filter(Boolean))
    : []
  const repPriceLimit = number(player.money) * Math.max(1, number(config.repInvestmentMaxPriceMultiple ?? 250))
  // An augmentation another faction already sells us needs no more rep anywhere.
  const repReady = new Set(targets.filter((item) => number(item.repGap) <= 0).map((item) => item.name))
  return targets
    .filter((item) => (!only || only.has(item.name)) && !repReady.has(item.name) && item.canWorkForRep !== false && number(item.repGap) > 0 && item.faction
      && (item.cashReady || number(item.price) <= repPriceLimit))
    // Valued candidates (augmentation_readiness.js, install_advisor_logic.js weights) rank by value per rep,
    // since rep time is the cost; a zero-value one is not worth the time. Named lists (`only`) and
    // unvalued data keep the old order: with cash in hand the smallest gap, otherwise the cheapest.
    .filter((item) => only || !Number.isFinite(item.value) || item.value > 0)
    .sort((a, b) => Number(b.cashReady) - Number(a.cashReady)
      || (!only && Number.isFinite(a.value) && Number.isFinite(b.value)
        ? b.value / number(b.repGap) - a.value / number(a.repGap) : 0)
      || (a.cashReady
        ? number(a.repGap) - number(b.repGap) || number(a.price) - number(b.price)
        : number(a.price) - number(b.price) || number(a.repGap) - number(b.repGap)))[0]
}

function hasRepTarget(player, augmentation, config) {
  return Boolean(repTarget(player, augmentation, config))
}
