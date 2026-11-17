import { planGraft, graftInputs, decisionKey, DEFAULT_GRAFT_CONFIG } from "./graft_logic.js"
import { trimLog } from "./metrics_logic.js"

const STATUS = "graft_status.json"
const LOG = "graft_log.txt"
const POLL_MS = 60000
const LOG_KEEP = 400

function readJson(ns, path) {
  try { const text = ns.read(path); return text ? JSON.parse(text) : null } catch { return null }
}

/** @param {NS} ns
 * Graft controller, DRY mode only (docs/grafting-plan.md step G5). Reads graft_catalog.json,
 * augmentation_readiness.json, sleeve_status.json, player_activity_status.json, run_target.json and
 * graft_config.json; applies planGraft every 60s; writes graft_status.json and appends a line to
 * graft_log.txt when the decision changes. Never travels, grafts or touches player work.
 * Live grafting (graft_config.json dry:false) is step G7 and is not built: the script refuses it.
 * Start: run graft_controller.js (bn10 profile, not in startup)
 */
export async function main(ns) {
  ns.disableLog("ALL")
  let lastKey = null
  for (;;) {
    const now = Date.now()
    const config = { ...DEFAULT_GRAFT_CONFIG, ...(readJson(ns, "graft_config.json") || {}) }
    const previous = readJson(ns, STATUS)
    const player = ns.getPlayer()
    const files = {
      catalog: readJson(ns, "graft_catalog.json"),
      readiness: readJson(ns, "augmentation_readiness.json"),
      sleeve: readJson(ns, "sleeve_status.json"),
      activity: readJson(ns, "player_activity_status.json"),
      target: readJson(ns, "run_target.json"),
      config,
      previous,
    }
    const input = graftInputs(files, { cash: player.money, entropy: player.entropy, now })
    const plan = planGraft(input)
    const key = decisionKey(plan)
    const counts = {}
    for (const row of plan.rejected || []) counts[row.reason] = (counts[row.reason] || 0) + 1
    const status = {
      ts: now,
      ok: true,
      mode: config.dry === false ? "refused-live" : "dry",
      note: config.dry === false ? "live grafting is step G7 and not built; staying dry" : null,
      ownsPlayer: false,
      entropy: player.entropy,
      cash: player.money,
      catalogRows: input.catalog.length,
      catalogAgeMin: files.catalog?.ts ? Math.round((now - files.catalog.ts) / 60000) : null,
      installPlanCost: input.installPlanCost,
      alternativeRate: input.alternativeRate,
      decision: plan.pick ? { ...plan.pick, reasons: plan.reasons, others: (plan.candidates || []).slice(1, 4).map(c => c.name) } : null,
      blocked: plan.pick ? null : plan.blocked,
      rejectedCounts: counts,
      lastFinishedAt: previous?.lastFinishedAt ?? null,
    }
    ns.write(STATUS, JSON.stringify(status), "w")
    if (key !== lastKey) {
      const line = { ts: now, event: "decision", mode: status.mode, key, pick: status.decision?.name ?? null,
        price: status.decision?.price ?? null, hours: status.decision?.hours ?? null, rateV: status.decision?.rateV ?? null,
        blocked: status.blocked, cash: player.money, installPlanCost: input.installPlanCost, entropy: player.entropy }
      ns.write(LOG, JSON.stringify(line) + "\n", "a")
      const trimmed = trimLog(ns.read(LOG), LOG_KEEP, 50)
      if (trimmed !== null) ns.write(LOG, trimmed, "w")
      lastKey = key
    }
    await ns.sleep(POLL_MS)
  }
}
