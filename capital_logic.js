/** Pure spending decisions for capital_manager.js. No ns calls, no side effects. */
export const PROGRAMS = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "DarkscapeNavigator.exe", "HTTPWorm.exe", "SQLInject.exe"]

/**
 * Choose the next purchase, or null to wait. Affordable programs and home RAM come
 * first because they unlock rooted hosts and managers; cloud RAM takes the rest.
 * Input costs of null mean unavailable; `spendable` is cash above the reserve.
 */
export function chooseCapitalAction({ spendable, hasTor, torCost = 200e3, programs = [], homeRam, homeRamTarget, homeRamCost,
  cloud = [], cloudLimit = 0, cloudQuotes = [], upgradeQuotes = [], cloudFraction = 0.5, incomePerSec = 0, saveWindowSec = 300 }) {
  if (!hasTor) return spendable >= torCost ? { kind: "tor", cost: torCost } : { kind: "save", reason: "TOR", cost: torCost }
  const missing = programs.find(p => !p.owned && Number.isFinite(p.cost) && p.cost > 0)
  if (missing && missing.cost <= spendable) return { kind: "program", name: missing.name, cost: missing.cost }
  const wantsHome = homeRam < homeRamTarget && Number.isFinite(homeRamCost)
  if (wantsHome && homeRamCost <= spendable) return { kind: "home", cost: homeRamCost }
  // Hold cloud buying when income can reach the next priority soon, but never
  // wait on a distant $250m program: the cloud RAM is what earns it.
  const next = Math.min(missing?.cost ?? Infinity, wantsHome ? homeRamCost : Infinity)
  if (Number.isFinite(next) && next - spendable <= incomePerSec * saveWindowSec) return { kind: "save", reason: "next priority", cost: next }
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
