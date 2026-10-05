/**
 * Persistent controller for the player's one active action.
 *
 * Configuration is intentionally visible and reversible in
 * player_activity_config.json. `override: "manual"` stops all action changes
 * immediately; `enabled: false` does the same. This never buys or installs
 * augmentations, trades, shares RAM, or touches Darknet.
 *
 * @param {NS} ns
 */
import { actionKey, choosePlayerActivity, shouldSwitch } from "./player_activity_logic.js"

const CONFIG = "player_activity_config.json"
const STATUS = "player_activity_status.json"
const POLL_MS = 60_000
const GATE_REFRESH_MS = 10 * 60 * 1000
const DEFAULT_CONFIG = {
  enabled: true,
  override: "auto",
  physicalTarget: 30,
  gym: "Powerhouse Gym",
  university: "Rothman University",
  factionWorkType: "hacking",
  cooldownMs: 10 * 60 * 1000,
  repInvestmentMaxPriceMultiple: 250,
  crimeKarmaTarget: -54_000,
}

let gateCache = { ts: 0, gates: [], ok: false }

function readJson(ns, file, fallback = null) {
  try { const text = ns.read(file); return text ? JSON.parse(text) : fallback } catch { return fallback }
}
function write(ns, value) { ns.write(STATUS, JSON.stringify(value, null, 2), "w") }
function configFor(ns) { return { ...DEFAULT_CONFIG, ...(readJson(ns, CONFIG, {}) || {}) } }

function nextGate(ns, hacking) {
  const now = Date.now()
  if (now - gateCache.ts >= GATE_REFRESH_MS) {
    try {
      const seen = new Set(["home"])
      const queue = ["home"]
      const gates = []
      for (let index = 0; index < queue.length; index++) {
        const host = queue[index]
        for (const neighbor of ns.scan(host)) if (!seen.has(neighbor)) { seen.add(neighbor); queue.push(neighbor) }
        if (host !== "home") gates.push({ host, required: Number(ns.getServerRequiredHackingLevel(host)) || 0 })
      }
      gateCache = { ts: now, gates: gates.sort((a, b) => a.required - b.required || a.host.localeCompare(b.host)), ok: true }
    } catch {
      if (!gateCache.ts) gateCache = { ts: now, gates: [], ok: false }
    }
  }
  return { gate: gateCache.gates.find((gate) => gate.required > hacking) || null, ok: gateCache.ok }
}

const CRIMES = ["Shoplift", "Rob Store", "Mug", "Larceny", "Deal Drugs", "Bond Forgery", "Traffick Arms", "Homicide", "Grand Theft Auto", "Kidnap", "Assassination", "Heist"]

function playerControlCapability(ns) {
  try {
    const reset = ns.getResetInfo()
    const sf4Level = Number(reset.ownedSF?.get(4)) || 0
    return { available: Number(reset.currentNode) === 4 || sf4Level > 0, currentNode: reset.currentNode, sf4Level }
  } catch (error) {
    return { available: false, currentNode: null, sf4Level: 0, error: String(error?.message || error) }
  }
}

function bestKarmaCrime(ns) {
  let best = null
  for (const crime of CRIMES) {
    try {
      const stats = ns.singularity.getCrimeStats(crime)
      const chance = ns.singularity.getCrimeChance(crime)
      const karmaPerSecond = stats.time > 0 ? -stats.karma * chance / (stats.time / 1000) : 0
      if (stats.karma < 0 && Number.isFinite(karmaPerSecond) && (!best || karmaPerSecond > best.expectedKarmaPerSecond)) {
        best = { action: "crime", crime, chance, expectedKarmaPerSecond: karmaPerSecond }
      }
    } catch { /* A missing crime API is reported by the outer capability state. */ }
  }
  return best
}

function startActivity(ns, decision) {
  if (decision.action === "gym") {
    const gymStat = { strength: "str", defense: "def", dexterity: "dex", agility: "agi" }[decision.stat]
    return ns.singularity.gymWorkout(decision.gym, gymStat, false)
  }
  if (decision.action === "algorithms") return ns.singularity.universityCourse(decision.university, decision.course, false)
  if (decision.action === "faction") return ns.singularity.workForFaction(decision.faction, decision.workType, false)
  if (decision.action === "crime") return ns.singularity.commitCrime(decision.crime, false)
  return false
}

function alreadyDoing(work, decision) {
  if (!work || !decision) return false
  if (decision.action === "gym") {
    const gymStat = { strength: "str", defense: "def", dexterity: "dex", agility: "agi" }[decision.stat]
    return work.type === "CLASS" && work.classType === gymStat
  }
  if (decision.action === "faction") return work.type === "FACTION" && work.factionName === decision.faction && work.factionWorkType === decision.workType
  if (decision.action === "algorithms") return work.type === "CLASS" && work.classType === decision.course
  if (decision.action === "crime") return work.type === "CRIME" && work.crimeType === decision.crime
  return false
}

function closePrior(ns) {
  for (const proc of ns.ps("home")) {
    if (proc.pid === ns.pid || proc.filename.replace(/^\//, "") !== "player_activity_controller.js") continue
    ns.kill(proc.pid)
  }
}

export async function main(ns) {
  ns.disableLog("ALL")
  closePrior(ns)
  let prior = readJson(ns, STATUS, {}) || {}
  let lastAugmentationRefresh = 0
  while (true) {
    const now = Date.now()
    const config = configFor(ns)
    const player = ns.getPlayer()
    const gateState = nextGate(ns, Number(player.skills?.hacking) || 0)
    let augmentation = readJson(ns, "augmentation_readiness.json", null)
    if (!augmentation?.ok || now - Number(augmentation.ts || 0) > 5 * 60 * 1000) {
      if (now - lastAugmentationRefresh >= 30 * 1000) {
        lastAugmentationRefresh = now
        const pid = ns.run("augmentation_readiness.js", 1, "--once")
        if (pid) await ns.sleep(1000)
        augmentation = readJson(ns, "augmentation_readiness.json", augmentation)
      }
    }
    const capability = playerControlCapability(ns)
    let currentWork = null
    if (capability.available) {
      try { currentWork = ns.singularity.getCurrentWork() } catch { capability.available = false }
    }
    const karmaTarget = Number(config.crimeKarmaTarget)
    const crimeNeeded = Number.isFinite(karmaTarget) && Number(player.karma) > karmaTarget
    const crimeCandidate = capability.available && (crimeNeeded || String(config.override).toLowerCase() === "crime")
      ? bestKarmaCrime(ns) : null
    const decision = choosePlayerActivity({ player, nextGate: gateState.gate, augmentation, crimeCandidate, config })
    const key = actionKey(decision)
    const alreadySelected = alreadyDoing(currentWork, decision)
    const switchDecision = !capability.available
      ? { switch: false, reason: `blocked: player-action API unavailable (SF4 level ${capability.sf4Level}, BitNode ${capability.currentNode ?? "unknown"})` }
      : alreadySelected ? { switch: false, reason: "already performing selected activity" }
        : shouldSwitch({ now, previous: prior, desired: decision, cooldownMs: Number(config.cooldownMs) || DEFAULT_CONFIG.cooldownMs })
    let started = null
    let error = null
    if (switchDecision.switch) {
      try {
        started = startActivity(ns, decision)
        if (!started) error = "game rejected the requested activity; check faction, city, and work requirements"
      } catch (exception) { error = String(exception?.message || exception) }
    }
    const apiUnavailable = !capability.available || /requires Source-File 4/i.test(error || "")
    const capitalPolicy = readJson(ns, "gang_capital_policy.json", {}) || {}
    const state = {
      ts: now, ok: !error, config, currentWork,
      capability: { ...capability, available: !apiUnavailable }, capitalPhase: capitalPolicy.phase || "unknown",
      gate: gateState.gate, gateScanOk: gateState.ok, augmentation, crimeCandidate,
      decision, actionKey: key, switched: switchDecision.switch && Boolean(started),
      switchReason: switchDecision.reason, started, error,
      lastSwitchAt: switchDecision.switch && started ? now : prior.lastSwitchAt || null,
      apiUnavailable,
    }
    write(ns, state)
    prior = state
    await ns.sleep(POLL_MS)
  }
}
