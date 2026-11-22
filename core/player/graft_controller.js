import { planGraft, graftInputs, decisionKey, liveGraftStep, graftEnded, DEFAULT_GRAFT_CONFIG, GRAFT_CITY } from "./graft_logic.js"
import { trimLog } from "./metrics_logic.js"

const STATUS = "graft_status.json"
const LOG = "graft_log.txt"
const POLL_MS = 60000
const LOG_KEEP = 400

function readJson(ns, path) {
  try { const text = ns.read(path); return text ? JSON.parse(text) : null } catch { return null }
}

function appendLog(ns, line) {
  ns.write(LOG, JSON.stringify(line) + "\n", "a")
  const trimmed = trimLog(ns.read(LOG), LOG_KEEP, 50)
  if (trimmed !== null) ns.write(LOG, trimmed, "w")
}

/** @param {NS} ns
 * Graft controller (docs/grafting-plan.md steps G5 and G7). Reads graft_catalog.json,
 * augmentation_readiness.json, sleeve_status.json, player_activity_status.json, run_target.json and
 * graft_config.json; applies planGraft every 60s; writes graft_status.json and appends to
 * graft_log.txt when the decision changes. Dry by default: never travels or grafts.
 * Live (graft_config.json dry:false AND a non-empty allow list): travels to New Tokyo and starts the
 * pick with ns.grafting; graft_status.json ownsPlayer:true holds player_activity_controller and
 * aug_install while the player's work is GRAFTING. Logs start and finish events.
 * Start: run graft_controller.js (bn10 profile startup list)
 */
export async function main(ns) {
  ns.disableLog("ALL")
  let lastKey = null
  for (;;) {
    const now = Date.now()
    const config = { ...DEFAULT_GRAFT_CONFIG, ...(readJson(ns, "graft_config.json") || {}) }
    const previous = readJson(ns, STATUS)
    const readiness = readJson(ns, "augmentation_readiness.json")
    if (readiness?.rules?.priceStep > 0) config.factionStepRatio = readiness.rules.priceStep
    // To stop grafting late in a run, set disabledInRun to that run's nodeResetAt (readiness has it). It lapses
    // by itself at the next BitNode; `enabled: false` carried into BN12 run 2.
    if (config.disabledInRun && config.disabledInRun === readiness?.nodeResetAt) config.enabled = false
    const player = ns.getPlayer()
    const work = ns.singularity.getCurrentWork()
    const workType = work?.type ?? null
    const files = {
      catalog: readJson(ns, "graft_catalog.json"),
      readiness,
      sleeve: readJson(ns, "sleeve_status.json"),
      activity: readJson(ns, "player_activity_status.json"),
      target: readJson(ns, "run_target.json"),
      config,
      previous,
    }
    const input = graftInputs(files, { cash: player.money, entropy: player.entropy, now })
    if (work) input.working = { type: workType }
    const plan = planGraft(input)
    const key = decisionKey(plan)
    const counts = {}
    for (const row of plan.rejected || []) counts[row.reason] = (counts[row.reason] || 0) + 1

    let grafting = workType === "GRAFTING" ? (previous?.grafting ?? { name: work.augmentation ?? null, startedAt: null }) : null
    let lastStartedAt = previous?.lastStartedAt ?? null
    let lastFinishedAt = previous?.lastFinishedAt ?? null
    if (graftEnded(previous, workType)) {
      lastFinishedAt = now
      // readiness may lag a poll; the next finished-line reader can recheck.
      const owned = (files.readiness?.owned || []).includes(previous.grafting.name)
      appendLog(ns, { ts: now, event: "finished", name: previous.grafting.name, owned,
        hours: previous.grafting.startedAt ? (now - previous.grafting.startedAt) / 3600000 : null,
        predictedHours: previous.grafting.hours ?? null, entropy: player.entropy, workAfter: workType })
    }

    const step = liveGraftStep({ config, plan, workType, city: player.city, previous, now })
    let note = step.mode === "live" ? step.reason : null
    if (step.act === "start") {
      // Claim the player first so player_activity_controller holds before the work changes.
      ns.write(STATUS, JSON.stringify({ ...(previous || {}), ts: now, ok: true, mode: "live", ownsPlayer: true }), "w")
      const travelled = step.needTrip ? ns.singularity.travelToCity(GRAFT_CITY) : true
      const started = travelled && ns.grafting.graftAugmentation(step.name, step.focus)
      lastStartedAt = now
      note = started ? `started ${step.name}` : (travelled ? `start refused for ${step.name}` : "travel failed")
      if (started) grafting = { name: step.name, startedAt: now, hours: plan.pick.hours, price: plan.pick.price, cashBefore: player.money }
      appendLog(ns, { ts: now, event: started ? "start" : "start-failed", name: step.name, needTrip: step.needTrip,
        focus: step.focus, price: plan.pick.price, hours: plan.pick.hours, rateV: plan.pick.rateV,
        cash: player.money, entropy: player.entropy, note })
    }

    const status = {
      ts: now,
      ok: true,
      mode: step.mode,
      note,
      ownsPlayer: Boolean(grafting),
      grafting,
      entropy: player.entropy,
      cash: player.money,
      catalogRows: input.catalog.length,
      catalogAgeMin: files.catalog?.ts ? Math.round((now - files.catalog.ts) / 60000) : null,
      installPlanCost: input.installPlanCost,
      alternativeRate: input.alternativeRate,
      decision: plan.pick ? { ...plan.pick, reasons: plan.reasons, others: (plan.candidates || []).slice(1, 4).map(c => c.name) } : null,
      blocked: plan.pick ? null : plan.blocked,
      rejectedCounts: counts,
      lastStartedAt,
      lastFinishedAt,
    }
    ns.write(STATUS, JSON.stringify(status), "w")
    if (key !== lastKey) {
      appendLog(ns, { ts: now, event: "decision", mode: status.mode, key, pick: status.decision?.name ?? null,
        price: status.decision?.price ?? null, hours: status.decision?.hours ?? null, rateV: status.decision?.rateV ?? null,
        blocked: status.blocked, cash: player.money, installPlanCost: input.installPlanCost, entropy: player.entropy })
      lastKey = key
    }
    await ns.sleep(POLL_MS)
  }
}
