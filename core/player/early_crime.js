import { earlyGoal, FRESH_SLEEVE_SKILLS, pickEarlyCrime } from "./early_crime_logic.js"

/**
 * Early-crime chooser for a fresh BitNode (logic and numbers in early_crime_logic.js).
 * Picks crimes for the player and every sleeve until player_activity_controller.js and
 * sleeve_controller.js run, hands each side over as its controller starts, and exits when both run.
 * Start: startup.js launches it right after capital_bootstrap.js. Kept small (~11GB): no
 * getCrimeChance, getSleeve or getNumSleeves.
 * Args: --money-until-gb N (default 128), --poll-ms N (default 30000)
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL")
  const flags = ns.flags([["money-until-gb", 128], ["poll-ms", 30000]])
  const STATUS = "early_crime_status.json"
  let player = null
  let sleeves = null
  let sleeveCount = null
  // startup.js starts the controllers a few seconds after this; on a big home (after an install)
  // they are running by then and this exits without touching anything.
  await ns.sleep(10_000)
  while (true) {
    const playerOwned = ns.isRunning("player_activity_controller.js", "home")
    const sleevesOwned = ns.isRunning("sleeve_controller.js", "home")
    const status = { ts: Date.now(), playerOwned, sleevesOwned }
    if (playerOwned && sleevesOwned) {
      ns.write(STATUS, JSON.stringify({ ...status, action: "exit", reason: "both controllers running" }), "w")
      return
    }
    const goal = earlyGoal(ns.getServerMaxRam("home"), flags["money-until-gb"])
    status.goal = goal
    if (!playerOwned) {
      const p = ns.getPlayer()
      const pick = pickEarlyCrime({ skills: p.skills, goal, successMult: p.mults?.crime_success ?? 1, current: player })
      if (pick && pick.crime !== player) {
        if (ns.singularity.commitCrime(pick.crime, false)) player = pick.crime
      }
      status.player = { crime: player, chance: pick?.chance ?? null }
    }
    if (!sleevesOwned) {
      const pick = pickEarlyCrime({ skills: FRESH_SLEEVE_SKILLS, goal, current: sleeves })
      if (pick && pick.crime !== sleeves) {
        let set = 0
        for (let i = 0; sleeveCount === null || i < sleeveCount; i++) {
          try { if (!ns.sleeve.setToCommitCrime(i, pick.crime)) break } catch { break }
          set++
        }
        if (sleeveCount === null) sleeveCount = set
        if (set > 0) sleeves = pick.crime
      }
      status.sleeves = { crime: sleeves, count: sleeveCount }
    }
    ns.write(STATUS, JSON.stringify(status), "w")
    await ns.sleep(flags["poll-ms"])
  }
}
