/**
 * bladeburner.js — persistent Bladeburner controller (BN6).
 *
 * Each pass: snapshot rank, stamina, city chaos and every contract/operation's
 * success range, time, count and rank gain; ask bladeburner_logic.chooseAction();
 * switch only at an action boundary (Bladeburner actions repeat by themselves).
 * Spends skill points greedily, moves to the most populous calm city, and never
 * starts Operation Daedalus (ends the BitNode) unless allowDaedalus is set.
 *
 * Config:  bladeburner_config.json (optional; merged over DEFAULT_CONFIG)
 * Status:  bladeburner_status.json (player_activity_controller stands down while
 *          ownsPlayer is true and ts is fresh)
 * Events:  bladeburner_events.txt (switches, black ops, skills; trimmed)
 * @param {NS} ns
 */
import { DEFAULT_CONFIG, chooseAction, shouldSwitch, planSkillBuys, actionKey } from "./bladeburner_logic.js"

const CONFIG = "bladeburner_config.json"
const STATUS = "bladeburner_status.json"
const EVENTS = "bladeburner_events.txt"
const POLL_MS = 500
const STATUS_MS = 5000
const CITIES = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ishima"]
const ANALYSIS_PATIENCE = 10 // Field Analysis completions without narrowing before an action is blocked from analysis

function readJson(ns, file, fallback) { try { const t = ns.read(file); return t ? JSON.parse(t) : fallback } catch { return fallback } }
function configFor(ns) {
  const c = readJson(ns, CONFIG, {}) || {}
  return { ...DEFAULT_CONFIG, ...c, minChance: { ...DEFAULT_CONFIG.minChance, ...(c.minChance || {}) }, skillWeights: { ...DEFAULT_CONFIG.skillWeights, ...(c.skillWeights || {}) } }
}
function event(ns, text) {
  const line = `${new Date().toISOString()} ${text}`
  const old = (ns.read(EVENTS) || "").split("\n").filter(Boolean).slice(-400)
  ns.write(EVENTS, [...old, line].join("\n") + "\n", "w")
}

function snapshot(ns, bb) {
  const actions = []
  const add = (type, names) => {
    for (const name of names) actions.push({
      type, name,
      chance: bb.getActionEstimatedSuccessChance(type, name),
      timeMs: bb.getActionTime(type, name),
      count: bb.getActionCountRemaining(type, name),
      repGain: bb.getActionRepGain(type, name),
    })
  }
  add("Contracts", bb.getContractNames())
  add("Operations", bb.getOperationNames())
  const nextBlackOp = bb.getNextBlackOp()
  if (nextBlackOp) add("Black Operations", [nextBlackOp.name])
  const city = bb.getCity()
  return { rank: bb.getRank(), stamina: bb.getStamina(), city, cityChaos: bb.getCityChaos(city), nextBlackOp, actions }
}

function bestCity(bb, chaosMax) {
  const rows = CITIES.map((c) => ({ c, pop: bb.getCityEstimatedPopulation(c), chaos: bb.getCityChaos(c) }))
  return rows.filter((r) => r.chaos <= chaosMax).sort((a, b) => b.pop - a.pop)[0] || null
}

export async function main(ns) {
  ns.disableLog("ALL")
  for (const p of ns.ps("home")) if (p.filename === ns.getScriptName() && p.pid !== ns.pid) ns.kill(p.pid)
  const bb = ns.bladeburner
  if (!bb.inBladeburner()) { ns.write(STATUS, JSON.stringify({ ts: Date.now(), ok: false, ownsPlayer: false, reason: "not in Bladeburner" }), "w"); return }

  let resting = false
  let prevElapsed = 0
  let prevKey = null
  let lastStatus = 0
  const rankSamples = []
  const analysis = { target: null, spread: null, stale: 0, blocked: [] }
  let lastDecision = null
  let lastError = null
  event(ns, "controller start")

  while (true) {
    const cfg = configFor(ns)
    try {
      // Skills first: points spent now help this pass's odds.
      let points = bb.getSkillPoints()
      if (points > 0) {
        const skills = Object.fromEntries(bb.getSkillNames().map((s) => [s, { level: bb.getSkillLevel(s), cost: bb.getSkillUpgradeCost(s) }]))
        for (const s of planSkillBuys(skills, points, cfg)) if (bb.upgradeSkill(s)) event(ns, `skill ${s} -> ${bb.getSkillLevel(s)}`)
      }

      const snap = snapshot(ns, bb)
      // Rank 25 opens the Bladeburners faction (its augmentations boost Bladeburner work).
      if (snap.rank >= 25 && !ns.getPlayer().factions.includes("Bladeburners")) {
        if (bb.joinBladeburnerFaction()) event(ns, `joined Bladeburners faction at rank ${snap.rank.toFixed(1)}`)
      }
      const current = bb.getCurrentAction()
      const curKey = current ? actionKey(current) : "none"
      const elapsed = current ? bb.getActionCurrentTime() : 0
      const boundary = curKey !== prevKey || elapsed + 200 < prevElapsed
      // Field Analysis bookkeeping: did the last completion narrow its target's range?
      if (boundary && prevKey === "General/Field Analysis" && analysis.target) {
        const t = snap.actions.find((a) => a.name === analysis.target)
        const spread = t ? t.chance[1] - t.chance[0] : 0
        if (analysis.spread !== null && spread > analysis.spread - 0.005) analysis.stale++
        else analysis.stale = 0
        analysis.spread = spread
        if (analysis.stale >= ANALYSIS_PATIENCE && !analysis.blocked.includes(analysis.target)) {
          analysis.blocked.push(analysis.target)
          event(ns, `analysis blocked for ${analysis.target}: range stuck at ${spread.toFixed(3)}`)
        }
      }
      prevElapsed = elapsed
      prevKey = curKey

      const decision = cfg.enabled ? chooseAction({ ...snap, resting, analysisBlocked: analysis.blocked }, cfg) : null
      if (decision) {
        resting = decision.resting
        if (decision.name === "Field Analysis") {
          const m = /^narrow estimate: (.+) range/.exec(decision.reason)
          const target = m ? m[1] : null
          if (target !== analysis.target) { analysis.target = target; analysis.spread = null; analysis.stale = 0 }
        }
        if (shouldSwitch({ current, desired: decision, elapsedMs: elapsed, boundary })) {
          const move = bestCity(bb, cfg.chaosMax)
          if (move && move.c !== snap.city && move.pop > 1.25 * bb.getCityEstimatedPopulation(snap.city)) {
            if (bb.switchCity(move.c)) event(ns, `city ${snap.city} -> ${move.c} (pop ${(move.pop / 1e6).toFixed(0)}m)`)
          }
          if (bb.startAction(decision.type, decision.name)) {
            if (actionKey(decision) !== actionKey(lastDecision)) event(ns, `start ${decision.type}/${decision.name}: ${decision.reason}`)
            prevKey = actionKey(decision)
            prevElapsed = 0
          } else event(ns, `startAction refused ${decision.type}/${decision.name}`)
        }
        lastDecision = decision
      }

      const now = Date.now()
      rankSamples.push([now, snap.rank])
      while (rankSamples.length && now - rankSamples[0][0] > 3600_000) rankSamples.shift()
      if (now - lastStatus >= STATUS_MS) {
        lastStatus = now
        const [t0, r0] = rankSamples[0]
        const hours = (now - t0) / 3600_000
        const cur = bb.getCurrentAction()
        let currentChance = null
        if (cur && cur.type !== "General" && cur.type !== "Idle") currentChance = bb.getActionEstimatedSuccessChance(cur.type, cur.name)
        ns.write(STATUS, JSON.stringify({
          ts: now, ok: true, ownsPlayer: Boolean(cfg.enabled && cfg.ownPlayer),
          rank: snap.rank, rankPerHour: hours > 0.05 ? (snap.rank - r0) / hours : null, rankWindowHours: hours,
          stamina: snap.stamina, city: snap.city, cityChaos: snap.cityChaos, skillPoints: bb.getSkillPoints(),
          current: cur, currentChance, decision: lastDecision, resting,
          nextBlackOp: snap.nextBlackOp, daedalusReady: snap.nextBlackOp?.name === "Operation Daedalus" && snap.rank >= snap.nextBlackOp.rank,
          analysisBlocked: analysis.blocked, lastError,
        }, null, 1), "w")
      }
      lastError = null
    } catch (e) {
      lastError = String(e?.message || e).slice(0, 300)
      event(ns, `error: ${lastError}`)
      await ns.sleep(5000)
    }
    await ns.sleep(POLL_MS)
  }
}
