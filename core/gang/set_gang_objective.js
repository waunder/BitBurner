/** Switch the gang controller between faction-reputation and money goals.
 * Usage: run set_gang_objective.js [reputation|money|cash]
 * No argument reports the current override. Takes effect on the controller's
 * next update; no restart is needed. This does not start the controller.
 * @param {NS} ns
 */
const FILE = "gang_objective_override.txt"

export async function main(ns) {
  ns.disableLog("ALL")
  const objective = String(ns.args[0] || "").trim().toLowerCase()
  const current = String(ns.read(FILE) || "money").trim().toLowerCase()

  if (!objective) {
    const normalized = ["reputation", "cash"].includes(current) ? current : "money"
    ns.tprint(`Gang objective: ${normalized} (default is money)`)
    ns.tprint(`Controller: ${ns.isRunning("gang-controller.js", "home") ? "running" : "stopped"}`)
    return
  }
  if (!["reputation", "money", "cash"].includes(objective)) {
    ns.tprint("Usage: run set_gang_objective.js [reputation|money|cash]")
    return
  }

  ns.write(FILE, objective, "w")
  const saved = String(ns.read(FILE) || "").trim()
  if (saved !== objective) {
    ns.tprint(`Could not verify ${FILE}; objective was not confirmed.`)
    return
  }
  ns.tprint(`Gang objective set to ${objective}; the controller will apply it on its next update.`)
  if (!ns.isRunning("gang-controller.js", "home")) ns.tprint("gang-controller.js is stopped; this setting will apply when you start it.")
}
