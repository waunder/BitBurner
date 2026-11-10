/** Pure spending decisions for capital_manager.js. No ns calls, no side effects. */
export const PROGRAMS = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "DarkscapeNavigator.exe", "HTTPWorm.exe", "SQLInject.exe", "Formulas.exe"]

/**
 * Choose the next purchase, or null to wait. Affordable programs and home RAM come
 * first because they unlock rooted hosts and managers; cloud RAM takes the rest.
 * Input costs of null mean unavailable; `spendable` is cash above the reserve.
 */
/** Cloud demand floor for this point in the cycle (install to install). An install deletes cloud
 * servers, so late in a cycle spare cloud RAM earns nothing that lasts: MCP's income stops growing
 * with RAM well before then (BN10 run 2 cycle 7: flat from about 1.3h while RAM tripled), and the
 * extra only feeds xp_filler's hacking exp, which the install wipes. Early in a cycle that exp speeds
 * the hacking rebuild. So: policy.cloudDemandFloor (default 0.5) for the first earlyCycleHours, then
 * lateCloudDemandFloor. Without lateCloudDemandFloor in the policy the old single floor applies.
 * Returns { floor, phase }. */
export function cloudDemandFloorFor(policy = {}, hoursSinceInstall = 0) {
  const early = Number(policy.cloudDemandFloor ?? 0.5)
  const late = policy.lateCloudDemandFloor
  if (late === undefined || late === null || !Number.isFinite(Number(late))) return { floor: early, phase: "fixed" }
  const cutoff = Number(policy.earlyCycleHours ?? 1.5)
  return hoursSinceInstall < cutoff ? { floor: early, phase: "early" } : { floor: Number(late), phase: "late" }
}

export function chooseCapitalAction({ spendable, hasTor, torCost = 200e3, programs = [], homeRam, homeRamTarget, homeRamCost,
  cloud = [], cloudLimit = 0, cloudQuotes = [], upgradeQuotes = [], cloudFraction = 0.5, incomePerSec = 0, saveWindowSec = 300, homeRamFloor = 128, ramUtilization = 1, cloudDemandFloor = 0.5 }) {
  if (!hasTor) return spendable >= torCost ? { kind: "tor", cost: torCost } : { kind: "save", reason: "TOR", cost: torCost }
  const missing = programs.find(p => !p.owned && Number.isFinite(p.cost) && p.cost > 0)
  if (missing && missing.cost <= spendable) return { kind: "program", name: missing.name, cost: missing.cost }
  const wantsHome = homeRam < homeRamTarget && Number.isFinite(homeRamCost)
  if (wantsHome && homeRamCost <= spendable) return { kind: "home", cost: homeRamCost }
  // Below this floor the managers themselves cannot run, so nothing outranks it.
  if (wantsHome && homeRam < homeRamFloor) return { kind: "save", reason: "home RAM floor", cost: homeRamCost }
  // Hold cloud buying when income can reach the next priority soon, but never
  // wait on a distant $250m program: the cloud RAM is what earns it.
  const next = Math.min(missing?.cost ?? Infinity, wantsHome ? homeRamCost : Infinity)
  if (Number.isFinite(next) && next - spendable <= incomePerSec * saveWindowSec) return { kind: "save", reason: "next priority", cost: next }
  // MCP is not filling what it has, so more cloud RAM would earn nothing.
  if (ramUtilization < cloudDemandFloor) return null
  const budget = spendable * cloudFraction
  if (cloud.length < cloudLimit) {
    const best = cloudQuotes.filter(q => q.cost <= budget).sort((a, b) => b.ram - a.ram)[0]
    return best ? { kind: "cloud", ram: best.ram, cost: best.cost } : null
  }
  const upgrades = upgradeQuotes.filter(q => q.cost > 0 && q.cost <= budget).sort((a, b) => a.fromRam - b.fromRam || a.cost - b.cost)
  return upgrades[0] ? { kind: "upgrade", ...upgrades[0] } : null
}

/** Next script from a priority list that fits in free home RAM. */
export function nextScriptToStart(scripts, freeRam) {
  return scripts.find(s => !s.running && s.ram > 0 && s.ram <= freeRam)?.name ?? null
}
