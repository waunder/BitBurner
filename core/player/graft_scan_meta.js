import { buildCatalog, rankCatalog } from "./graft_logic.js"

/** @param {NS} ns
 * Grafting catalog, part 2 of 2 (docs/grafting-plan.md step G3). Read-only.
 * Reads graft_scan_raw.json (from graft_scan.js), adds getAugmentationStats and
 * getAugmentationPrereq per name, and writes graft_catalog.json: rows {name, graftPrice, hours,
 * mults, prereqs} plus a top-5 ranking by net value per hour with run_target.json weights.
 * Start: run graft_scan_meta.js (graft_scan.js starts it)
 */
export async function main(ns) {
  ns.disableLog("ALL")
  let raw
  try { raw = JSON.parse(ns.read("graft_scan_raw.json")) } catch { raw = null }
  if (!raw?.ok) {
    ns.tprint("graft_scan_meta: no usable graft_scan_raw.json; run graft_scan.js first")
    return
  }
  const stats = {}
  const prereqs = {}
  for (const name of raw.list) {
    try { stats[name] = ns.singularity.getAugmentationStats(name) } catch (error) { stats[name] = { error: String(error) } }
    try { prereqs[name] = ns.singularity.getAugmentationPrereq(name) } catch { prereqs[name] = [] }
  }
  const rows = buildCatalog(raw.list, stats, prereqs, raw.price, raw.timeMs)
  let weights = {}
  try { weights = JSON.parse(ns.read("run_target.json")).augWeights || {} } catch { /* empty weights rank by hours only */ }
  const top = rankCatalog(rows, weights).slice(0, 5)
  const topCombat = rankCatalog(rows, weights, { noPrereqs: true, combat: true }).slice(0, 5)
  ns.write("graft_catalog.json", JSON.stringify({
    ts: Date.now(), resetAt: ns.getResetInfo().lastAugReset, graftable: raw.list.length, count: rows.length,
    top, topCombat, rows,
  }), "w")
  ns.tprint(`graft_scan_meta: ${rows.length} of ${raw.list.length} rows; best combat ${topCombat[0]?.name ?? "none"}; wrote graft_catalog.json`)
}
