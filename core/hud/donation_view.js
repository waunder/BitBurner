// Donation rows for mcp_money.js; pure so it can be tested without ns.
// Donations reach getMoneySources() only as "other" (bitburner-src
// src/Faction/formulas/donation.ts: Player.loseMoney(amt, "other")), so this
// section reads the planner and aug_install.js's own record instead.

const FRESH_MS = 5 * 60 * 1000

/**
 * @param {object|null} readiness augmentation_readiness.json
 * @param {object|null} last aug_install_status.json, written by each aug_install.js run
 * @param {(n:number)=>string} money formatter
 * @param {(ts:number)=>string} ago formatter
 * @returns {Array<[string,string]>} [left, right] rows
 */
export function donationRows(readiness, last, now, money, ago) {
  const rows = [["donations", ""]]
  if (readiness?.ok && Number.isFinite(readiness.ts) && now - readiness.ts <= FRESH_MS) {
    const donating = readiness.donating || []
    rows.push(["open (favor 150+)", `${donating.length} factions`])
    const planned = readiness.installPlan?.donations || []
    rows.push(["at next install", planned.length ? money(planned.reduce((s, [, a]) => s + Number(a), 0)) : "none planned"])
    for (const [faction, amount] of planned) rows.push([`  ${faction}`, money(amount)])
    const next = Object.entries(readiness.favor || {})
      .filter(([f]) => !donating.includes(f) && f !== readiness.gangFaction)
      .map(([f, v]) => ({ f, total: Number(v.favor) + Number(v.gain) }))
      .sort((a, b) => b.total - a.total)[0]
    if (next) rows.push([`next: ${next.f}`, `fav ${next.total.toFixed(0)}`])
  } else {
    rows.push(["planner", "stale"])
  }
  if (last && Number.isFinite(last.ts)) {
    const flux = Number(last.fluxDonated) || 0
    const gifts = (last.donations || []).reduce((s, [, a]) => s + Number(a), 0)
    rows.push(["last aug_install", ago(last.ts)])
    rows.push(["  donated", money(gifts + flux)])
    if (flux) rows.push([`  for ${last.neuroflux || 0} NeuroFlux`, money(flux)])
    for (const [faction, amount] of last.donations || []) rows.push([`  ${faction}`, money(amount)])
  } else {
    rows.push(["last aug_install", "no record"])
  }
  return rows
}
