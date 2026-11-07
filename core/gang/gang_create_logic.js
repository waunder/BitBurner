// Pure decision for gang_create.js; no ns calls so it can be tested and costs no RAM.

export const GANG_KARMA = -54_000
export const DEFAULT_GANG_FACTION = "The Black Hand"

/**
 * What gang_create.js should do this poll.
 * Karma gate: bitburner-src `src/Gang/data/Constants.ts` GangKarmaRequirement -54000,
 * waived in BitNode 2 (`Player.canAccessGang`).
 */
export function gangCreateStep({ inGang, controllerRunning, karma, bitNode, factions = [], faction = DEFAULT_GANG_FACTION }) {
  if (inGang) {
    return controllerRunning
      ? { action: "done", reason: "gang exists and gang-controller.js is running" }
      : { action: "start-controller", reason: "gang exists; starting gang-controller.js" }
  }
  if (Number(bitNode) !== 2) {
    const k = Number(karma)
    if (!Number.isFinite(k)) return { action: "wait", reason: "karma unavailable" }
    if (k > GANG_KARMA) return { action: "wait", reason: `karma ${k.toFixed(0)} -> ${GANG_KARMA}` }
  }
  if (!factions.includes(faction)) return { action: "wait", reason: `not a member of ${faction}` }
  return { action: "create", reason: `creating gang with ${faction}` }
}
