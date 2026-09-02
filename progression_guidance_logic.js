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

export function chooseProgressionGuidance({ hacking = 0, charisma = 0, gate = null, gateScanOk = false, darknetLive = false } = {}) {
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
