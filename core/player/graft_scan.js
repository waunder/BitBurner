/** @param {NS} ns
 * Grafting catalog, part 1 of 2 (docs/grafting-plan.md step G3). Read-only: never grafts.
 * Reads the graftable list, graft price and graft time (intelligence included) for every name,
 * writes graft_scan_raw.json, then starts graft_scan_meta.js for stats and prereqs. Split in two
 * because one script with both API families is about 27GB.
 * Start: run graft_scan.js
 */
export async function main(ns) {
  ns.disableLog("ALL")
  let list = []
  try {
    list = ns.grafting.getGraftableAugmentations()
  } catch (error) {
    ns.write("graft_scan_raw.json", JSON.stringify({ ts: Date.now(), ok: false, error: String(error) }), "w")
    ns.tprint(`graft_scan: grafting API unavailable: ${error}`)
    return
  }
  const price = {}
  const timeMs = {}
  for (const name of list) {
    try { price[name] = ns.grafting.getAugmentationGraftPrice(name) } catch { /* skipped by buildCatalog */ }
    try { timeMs[name] = ns.grafting.getAugmentationGraftTime(name) } catch { /* skipped by buildCatalog */ }
  }
  ns.write("graft_scan_raw.json", JSON.stringify({ ts: Date.now(), ok: true, list, price, timeMs }), "w")
  const pid = ns.run("graft_scan_meta.js")
  ns.tprint(`graft_scan: ${list.length} graftable; wrote graft_scan_raw.json; meta pid ${pid || "not started (RAM)"}`)
}
