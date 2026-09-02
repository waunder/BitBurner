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

function startActivity(ns, decision) {
  if (decision.action === "gym") {
    const gymStat = { strength: "str", defense: "def", dexterity: "dex", agility: "agi" }[decision.stat]
    return ns.singularity.gymWorkout(decision.gym, gymStat, false)
  }
  if (decision.action === "algorithms") return ns.singularity.universityCourse(decision.university, decision.course, false)
  if (decision.action === "faction") return ns.singularity.workForFaction(decision.faction, decision.workType, false)
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
  while (true) {
    const now = Date.now()
    const config = configFor(ns)
    const player = ns.getPlayer()
    const gateState = nextGate(ns, Number(player.skills?.hacking) || 0)
    const augmentation = readJson(ns, "augmentation_readiness.json", null)
    const decision = choosePlayerActivity({ player, nextGate: gateState.gate, augmentation, config })
    const key = actionKey(decision)
    const blockedByCapability = prior.apiUnavailable === true
    const switchDecision = blockedByCapability
      ? { switch: false, reason: "blocked: Singularity player-action API unavailable (requires Source-File 4)" }
      : shouldSwitch({ now, previous: prior, desired: decision, cooldownMs: Number(config.cooldownMs) || DEFAULT_CONFIG.cooldownMs })
    let started = null
    let error = null
    if (switchDecision.switch) {
      try { started = startActivity(ns, decision) } catch (exception) { error = String(exception?.message || exception) }
    }
    const apiUnavailable = /requires Source-File 4/i.test(error || "") || prior.apiUnavailable === true
    const state = {
      ts: now, ok: !error, config, currentWork: (() => { try { return ns.singularity.getCurrentWork() } catch { return null } })(),
      gate: gateState.gate, gateScanOk: gateState.ok, augmentation,
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
