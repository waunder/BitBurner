import { DEFAULT_GANG_FACTION, gangCreateStep } from "./gang_create_logic.js"

/**
 * Create the gang once karma allows, then hand over to gang-controller.js and exit.
 * Usage: run gang_create.js [faction]   (default: run_target.json `gangFaction`, else The Black Hand)
 * Polls every 60s. Started by startup.js in place of gang-controller.js, so it also
 * starts the controller after every startup when a gang already exists.
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL")
  // The run's plan names the gang faction (BN10 run 3, 2026-11-11: the plan said NiteSec while this
  // waited for The Black Hand, whose gate is about hacking 350 against NiteSec's 211).
  let planned = null
  try { planned = JSON.parse(ns.read("run_target.json") || "{}").gangFaction } catch { /* no plan */ }
  const faction = String(ns.args[0] || planned || DEFAULT_GANG_FACTION)
  for (const process of ns.ps("home")) {
    if (process.filename === ns.getScriptName() && process.pid !== ns.pid) ns.kill(process.pid)
  }
  let lastReason = ""
  while (true) {
    let karma = null
    try { karma = Number(ns.heart.break()) } catch { /* reported as unavailable */ }
    const player = ns.getPlayer()
    const step = gangCreateStep({
      inGang: ns.gang.inGang(),
      controllerRunning: ns.isRunning("gang-controller.js", "home"),
      karma, bitNode: ns.getResetInfo().currentNode, factions: player.factions, faction,
    })
    if (step.reason !== lastReason) { ns.print(`gang_create: ${step.reason}`); lastReason = step.reason }
    if (step.action === "done") return
    if (step.action === "create") {
      const ok = ns.gang.createGang(faction)
      ns.tprint(`gang_create: createGang(${faction}) ${ok ? "succeeded" : "refused"} at karma ${karma?.toFixed(0)}`)
      if (ok) continue
    }
    if (step.action === "start-controller") {
      const pid = ns.run("gang-controller.js")
      ns.tprint(`gang_create: gang-controller.js ${pid ? `started pid ${pid}` : "failed to start (RAM?), retrying"}`)
      if (pid) return
    }
    await ns.sleep(60_000)
  }
}
