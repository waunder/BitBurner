/**
 * Sleeve task controller. Once a minute it picks one task per sleeve with
 * sleeve_logic.js and changes a sleeve only when its task differs. It never
 * touches the player's own work, buys sleeves, or installs augmentations.
 *
 * RAM: six ns.sleeve functions at 4GB each (getSleeve, getTask, setToShockRecovery,
 * setToSynchronize, setToCommitCrime, setToFactionWork). Sleeves are counted by probing
 * getSleeve until it throws, instead of paying 4GB for getNumSleeves.
 *
 * @param {NS} ns
 */
import { DEFAULT_SLEEVE_CONFIG, chooseSleeveTasks, sameTask, sleeveApiUnavailable } from "./sleeve_logic.js"

const STATUS = "sleeve_status.json"
const POLL_MS = 60_000
const UNAVAILABLE_POLL_MS = 5 * 60_000
const MAX_SLEEVES = 8

function readJson(ns, file, fallback = null) {
  try { const text = ns.read(file); return text ? JSON.parse(text) : fallback } catch { return fallback }
}

function closePrior(ns) {
  for (const proc of ns.ps("home")) {
    if (proc.pid === ns.pid || proc.filename.replace(/^\//, "") !== "sleeve_controller.js") continue
    ns.ui.closeTail(proc.pid)
    ns.kill(proc.pid)
  }
}

/** Reads every sleeve. Throws the API's own error when the Sleeve API is unavailable. */
function readSleeves(ns) {
  const sleeves = []
  for (let index = 0; index < MAX_SLEEVES; index++) {
    let info
    try { info = ns.sleeve.getSleeve(index) } catch (error) {
      if (/Invalid sleeve number/i.test(String(error?.message || error))) break
      throw error
    }
    sleeves.push({ index, shock: info.shock, sync: info.sync, memory: info.memory, skills: info.skills, mults: info.mults, task: ns.sleeve.getTask(index) })
  }
  return sleeves
}

function apply(ns, index, task) {
  if (task.action === "recovery") return ns.sleeve.setToShockRecovery(index)
  if (task.action === "synchronize") return ns.sleeve.setToSynchronize(index)
  if (task.action === "crime") return ns.sleeve.setToCommitCrime(index, task.crime)
  if (task.action === "faction") {
    // A faction that does not offer a work type makes the game return false, so walk the preference list.
    let lastError = null
    for (const type of task.workTypes) {
      try { if (ns.sleeve.setToFactionWork(index, task.faction, type)) return true } catch (error) { lastError = error }
    }
    if (lastError) throw lastError
    return false
  }
  return false
}

function describe(task) {
  if (!task) return "idle"
  return [task.type, task.crimeType || task.factionName, task.factionWorkType].filter(Boolean).join(":")
}

export async function main(ns) {
  ns.disableLog("ALL")
  closePrior(ns)
  let announced = ""
  while (true) {
    const now = Date.now()
    let state
    let wait = POLL_MS
    try {
      const sleeves = readSleeves(ns)
      let karma = null
      try { karma = Number(ns.heart.break()) } catch { /* Karma unknown: the logic treats it as not needed. */ }
      const playerConfig = readJson(ns, "player_activity_config.json", {}) || {}
      const override = readJson(ns, "sleeve_config.json", {}) || {}
      const config = { ...(playerConfig.crimeKarmaTarget === undefined ? {} : { crimeKarmaTarget: playerConfig.crimeKarmaTarget }), ...override }
      const activity = readJson(ns, "player_activity_status.json", null)
      const readiness = readJson(ns, "augmentation_readiness.json", null)
      const decisions = chooseSleeveTasks({ sleeves, karma, config, activity, readiness, money: Number(readiness?.money) || 0, now })
      const rows = []
      for (const sleeve of sleeves) {
        const decision = decisions[sleeve.index]
        let changed = false
        let error = null
        if (!sameTask(sleeve.task, decision.task) && decision.task.action !== "hold") {
          try {
            changed = apply(ns, sleeve.index, decision.task) === true
            if (!changed) error = "game refused the task"
          } catch (exception) { error = String(exception?.message || exception) }
        }
        rows.push({
          index: sleeve.index, shock: sleeve.shock, sync: sleeve.sync, memory: sleeve.memory,
          current: describe(sleeve.task), desired: decision.task, reason: decision.reason, changed, error,
        })
      }
      state = {
        ts: now, ok: !rows.some((row) => row.error), available: true, karma, karmaTarget: { ...DEFAULT_SLEEVE_CONFIG, ...config }.crimeKarmaTarget,
        playerFaction: activity?.decision?.action === "faction" ? activity.decision.faction : null,
        readinessAgeMs: Number.isFinite(Number(readiness?.ts)) ? now - Number(readiness.ts) : null,
        sleeves: rows,
      }
      announced = ""
    } catch (error) {
      const message = String(error?.message || error)
      const unavailable = sleeveApiUnavailable(error)
      state = { ts: now, ok: false, available: !unavailable, error: message, sleeves: [] }
      if (unavailable) wait = UNAVAILABLE_POLL_MS
      if (announced !== message) { ns.print(unavailable ? "Sleeve API unavailable (needs BitNode 10 or Source-File 10); idling." : `Sleeve controller error: ${message}`); announced = message }
    }
    ns.write(STATUS, JSON.stringify(state, null, 2), "w")
    await ns.sleep(wait)
  }
}
