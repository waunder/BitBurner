/**
 * Pure, deliberately conservative player-time guidance.
 *
 * A normal-server hacking gate is the only player progression requirement we
 * can read reliably from the live network without guessing at faction or
 * augmentation plans.  Charisma is a secondary observation: when the
 * Darknet heartbeat is live, its phishing workers are already producing it
 * passively, so manual Charisma training is not automatically a better use
 * of the player's time.  Physical/crime/faction training is never suggested
 * without an explicit, observable requirement.
 */

export function chooseProgressionGuidance({ hacking = 0, charisma = 0, gate = null, gateScanOk = false, darknetLive = false, augmentation = null } = {}) {
  const h = Number(hacking) || 0
  const c = Number(charisma) || 0
  if (gate && Number(gate.required) > h) {
    const gap = Math.max(0, Number(gate.required) - h)
    return {
      focus: "Hacking",
      confidence: "HIGH",
      next: `H${gate.required} ${gate.host}`,
      gate: `need +${gap} H: ${gate.host} (H${gate.required})`,
      best: `Rothman Algorithms until H${gate.required}`,
      basis: "nearest discovered normal-server gate",
    }
  }

  // A purchased batch is an observable, reset-relevant fact.  Do not claim
  // that installing is mandatory, but make the threshold visible once the
  // player is no longer blocked by an immediately reachable Hack gate.
  if (Number(augmentation?.queued) >= 3) {
    return {
      focus: "Augmentation batch ready",
      confidence: "HIGH",
      next: `${augmentation.queued} purchased augmentations`,
      gate: "no higher discovered H gate",
      best: `Install-ready: ${augmentation.queued} augmentations queued`,
      basis: "live owned/purchased augmentation state",
    }
  }

  // Faction work is only recommended when the game API identifies a specific
  // prerequisite-ready augmentation, its faction, and its missing reputation.
  // This avoids the old vague 'active objective' advice.
  const candidate = augmentation?.candidate
  if (candidate && Number(candidate.repGap) > 0 && candidate.cashReady) {
    return {
      focus: "Faction reputation",
      confidence: "HIGH",
      next: `${candidate.name} (${candidate.faction})`,
      gate: `need +${Math.ceil(candidate.repGap)} rep: ${candidate.faction}`,
      best: `Faction work: ${candidate.faction} for ${candidate.name}`,
      basis: "live faction reputation and augmentation requirement",
    }
  }

  if (!gateScanOk) {
    return {
      focus: "Hold current work",
      confidence: "LOW",
      next: "gate scan unavailable",
      gate: "normal-server scan unavailable",
      best: "Keep current work; retry scan",
      basis: "no safe progression comparison",
    }
  }

  if (darknetLive) {
    return {
      focus: "No manual XP detour",
      confidence: "MEDIUM",
      next: `Charisma C${c} passive`,
      gate: "no higher discovered H gate",
      best: "Keep current work; DNET grows Charisma",
      basis: "live Darknet heartbeat; no physical/faction gate observed",
    }
  }

  return {
    focus: "Choose a named goal",
    confidence: "LOW",
    next: "no known XP gate",
    gate: "no higher discovered H gate",
    best: "No evidence for gym, crime, or faction work",
    basis: "normal-server scan complete; no alternate requirement observed",
  }
}
