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

export function choosePlayerActivity({ player = {}, nextGate = null, augmentation = null, crimeCandidate = null, config = {} } = {}) {
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
        action: "gym", gym: config.gym || "Powerhouse Gym", stat: weakest.skill,
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
  // Corporate factions invite on company rep alone, and sell the charisma augmentations the later labs need.
  const corp = config.companyTarget
  if (override === "auto" && corp?.company && !(player.factions || []).includes(corp.company)) {
    return { action: "company", company: corp.company, field: corp.field || "Business", reason: `company rep at ${corp.company} until its faction invites`, confidence: "HIGH" }
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
  return targets
    .filter((item) => (!only || only.has(item.name)) && item.canWorkForRep !== false && number(item.repGap) > 0 && item.faction
      && (item.cashReady || number(item.price) <= repPriceLimit))
    .sort((a, b) => Number(b.cashReady) - Number(a.cashReady)
      || number(a.price) - number(b.price) || number(a.repGap) - number(b.repGap))[0]
}

function hasRepTarget(player, augmentation, config) {
  return Boolean(repTarget(player, augmentation, config))
}
