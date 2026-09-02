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
export function choosePlayerActivity({ player = {}, nextGate = null, augmentation = null, config = {} } = {}) {
  const override = String(config.override || "auto").toLowerCase()
  if (config.enabled === false || override === "manual") {
    return { action: "hold", reason: "manual override is active", confidence: "HIGH" }
  }

  if (override === "algorithms") {
    return { action: "algorithms", university: config.university || "Rothman University", course: "Algorithms", reason: "explicit Algorithms override", confidence: "HIGH" }
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

  const hacking = number(player.skills?.hacking)
  if (nextGate && number(nextGate.required) > hacking) {
    return {
      action: "algorithms", university: config.university || "Rothman University", course: "Algorithms",
      required: number(nextGate.required), host: nextGate.host,
      reason: `H${hacking} → H${number(nextGate.required)} for ${nextGate.host}`,
      confidence: "HIGH",
    }
  }

  const candidate = augmentation?.ok ? augmentation.candidate : null
  if (candidate && candidate.cashReady && number(candidate.repGap) > 0 && candidate.faction) {
    return {
      action: "faction", faction: candidate.faction, workType: config.factionWorkType || "hacking",
      augmentation: candidate.name, repGap: number(candidate.repGap),
      reason: `${candidate.faction} needs +${Math.ceil(number(candidate.repGap))} rep for ${candidate.name}`,
      confidence: "HIGH",
    }
  }

  return { action: "hold", reason: "no observable training or reputation gate", confidence: "LOW" }
}

export function actionKey(decision) {
  if (!decision || decision.action === "hold") return "hold"
  if (decision.action === "gym") return `gym:${decision.gym}:${decision.stat}:${decision.target}`
  if (decision.action === "algorithms") return `algorithms:${decision.university}:${decision.course}`
  if (decision.action === "faction") return `faction:${decision.faction}:${decision.workType}`
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
