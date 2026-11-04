/** @param {NS} ns
 * Undo early_spread.js: kills scripts/weakenGrowHack.js on every server but
 * home, so MCP gets the rooted servers back. Run it, then run startup.js.
 * Start: run early_stop.js
 */
export async function main(ns) {
  const LOOP = "scripts/weakenGrowHack.js"
  const seen = new Set(["home"])
  const queue = ["home"]
  let hosts = 0
  while (queue.length) {
    for (const next of ns.scan(queue.shift())) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push(next)
      if (ns.scriptKill(LOOP, next)) hosts++
    }
  }
  ns.tprint(`early_stop: killed ${LOOP} on ${hosts} servers, ${seen.size - 1} servers seen`)
}
