/** Pure spending decisions for capital_manager.js. No ns calls, no side effects. */
export const PROGRAMS = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "DarkscapeNavigator.exe", "HTTPWorm.exe", "SQLInject.exe", "Formulas.exe"]

/**
 * Choose the next purchase, or null to wait. Affordable programs and home RAM come
 * first because they unlock rooted hosts and managers; cloud RAM takes the rest. Home RAM
 * needs demand (homeDemand >= homeDemandFloor) as cloud RAM does (ramUtilization).
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

/** Most a single purchase may cost at this point in the cycle (install to install). Late in a cycle
 * cash belongs to the next augmentation batch, which is cash-limited (each aug costs 1.9x the one
 * before): a purchase an install wipes (sleeve augmentations, cloud RAM) gets nothing, and one that
 * lasts (home RAM, sleeve memory, sleeves) at most lateSpendFraction (default 1%) of cash. In the
 * first earlyCycleHours (default 1.5) there is no extra limit: cash is small and rebuild speed counts.
 * Every spender uses this so none can take the batch's cash (2026-11-10: $4.74t of idle home RAM).
 * Returns { phase, limit }. */
export function lateCycleLimit({ policy = {}, hoursSinceInstall = 0, cash = 0, lostAtInstall = false } = {}) {
  const cutoff = Number(policy.earlyCycleHours ?? 1.5)
  if (hoursSinceInstall < cutoff) return { phase: "early", limit: Infinity }
  if (lostAtInstall) return { phase: "late", limit: 0 }
  return { phase: "late", limit: Math.max(0, cash) * Number(policy.lateSpendFraction ?? 0.01) }
}

export function chooseCapitalAction({ spendable, hasTor, torCost = 200e3, programs = [], homeRam, homeRamTarget, homeRamCost,
  cloud = [], cloudLimit = 0, cloudQuotes = [], upgradeQuotes = [], cloudFraction = 0.5, incomePerSec = 0, saveWindowSec = 300, homeRamFloor = 128, ramUtilization = 1, cloudDemandFloor = 0.5,
  homeDemand = 1, homeDemandFloor = 0.5, homeSpendLimit = Infinity, mcpBlocked = false }) {
  if (!hasTor) return spendable >= torCost ? { kind: "tor", cost: torCost } : { kind: "save", reason: "TOR", cost: torCost }
  const missing = programs.find(p => !p.owned && Number.isFinite(p.cost) && p.cost > 0)
  if (missing && missing.cost <= spendable) return { kind: "program", name: missing.name, cost: missing.cost }
  // Home RAM is bought only when something would use it: below the floor the managers cannot run;
  // above it, the scripts that need home (managers, MCP, stacks, waiting managers; not xp_filler's
  // leftovers) must fill homeDemandFloor of it. BN10 run 2, 2026-11-10 14:53: with only a size target,
  // $4.74t doubled home to 131TB while 0.23% of it was in use, taking that cash from the aug batch.
  // mcpBlocked: mcp.js is down and does not fit in free home RAM. That outranks everything like the
  // floor does (BN10 run 3, 2026-11-11: at node start "hours since install" was already past 1.5h, so
  // the 1% late cap held home at 128GB and MCP stayed down about 3h).
  const urgent = homeRam < homeRamFloor || mcpBlocked
  const homeNeeded = urgent || homeDemand >= homeDemandFloor
  // Late in a cycle home RAM is also held to lateCycleLimit, except when urgent.
  const withinLimit = urgent || homeRamCost <= homeSpendLimit
  const wantsHome = homeRam < homeRamTarget && Number.isFinite(homeRamCost) && homeNeeded && withinLimit
  if (wantsHome && homeRamCost <= spendable) return { kind: "home", cost: homeRamCost }
  // Below this floor (or with MCP unable to start) nothing outranks home RAM.
  if (wantsHome && urgent) return { kind: "save", reason: mcpBlocked ? "home RAM for MCP" : "home RAM floor", cost: homeRamCost }
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
