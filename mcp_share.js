/** Owned share worker. One Netscript process represents all its threads. */
export async function main(ns) {
  ns.disableLog("ALL")
  const owner = Number(ns.args[0])
  const source = String(ns.args[1] || "")
  if (!Number.isInteger(owner) || owner <= 0 || !source) return
  // share already awaits a ten-second game delay; no tight polling loop.
  while (ns.isRunning(owner)) await ns.share()
}
