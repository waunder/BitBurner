/** Finish this BitNode and enter the next. Kept OUTSIDE every manifest: tools/finish_node.py pushes it only for the
 *  moment of use and removes it afterwards (docs/finish-procedure.md). Never run it by hand.
 *
 *  run finish_node.js <next> <callback or none> <nodeResetAt the driver saw> [worldDaemon|bladeburner]
 *
 *  It refuses (and says why in finish_node.json) unless the run is the one the driver checked, nothing is grafting,
 *  the callback exists, and the path is ready: worldDaemon (default) needs The Red Pill and hacking at the World
 *  Daemon, and roots it; bladeburner needs every black operation won (Operation Daedalus last), which the game's
 *  destroyW0r1dD43m0n accepts without rooting (Bitburner 3.0.1). Every game call is named
 *  one by one: a computed call escapes the RAM count and the game kills the script between rooting and finishing.
 *  Success is never reported here (the script dies with the BitNode); the driver reads it from the save.
 *  @param {NS} ns */
export async function main(ns) {
  const [next, callback = "none", expectedReset = 0, path = "worldDaemon"] = ns.args
  const wd = "w0r1d_d43m0n"
  const out = { ts: Date.now(), args: ns.args }
  const put = (more) => { Object.assign(out, more); ns.write("finish_node.json", JSON.stringify(out), "w") }
  put({ step: "started" })
  const reset = ns.getResetInfo()
  const hacking = ns.getHackingLevel()
  const required = ns.getServerRequiredHackingLevel(wd)
  const pill = ns.singularity.getOwnedAugmentations(false).includes("The Red Pill")
  const work = ns.singularity.getCurrentWork()
  put({ node: reset.currentNode, lastNodeReset: reset.lastNodeReset, hacking, required, pill, work: work?.type ?? null })
  const n = Number(next)
  if (!Number.isInteger(n) || n < 1 || n > 14) return put({ step: "refused", why: `no such BitNode: ${next}` })
  if (Number(expectedReset) !== reset.lastNodeReset) return put({ step: "refused", why: "not the run the driver checked" })
  if (path !== "worldDaemon" && path !== "bladeburner") return put({ step: "refused", why: `no such path: ${path}` })
  if (path === "worldDaemon") {
    if (!pill) return put({ step: "refused", why: "The Red Pill is not installed" })
    if (hacking < required) return put({ step: "refused", why: `hacking ${hacking} is below ${required}` })
  } else {
    let nextOp
    try { nextOp = ns.bladeburner.inBladeburner() ? ns.bladeburner.getNextBlackOp() : undefined }
    catch (error) { return put({ step: "refused", why: `no Bladeburner access: ${String(error).slice(0, 200)}` }) }
    put({ nextBlackOp: nextOp ?? null })
    if (nextOp === undefined) return put({ step: "refused", why: "not in the Bladeburner division" })
    if (nextOp !== null) return put({ step: "refused", why: `black operations left, next ${nextOp.name}` })
  }
  if (work?.type === "GRAFTING") return put({ step: "refused", why: "a graft is running" })
  if (callback !== "none" && !ns.fileExists(callback, "home")) return put({ step: "refused", why: `no callback ${callback}` })
  if (path === "worldDaemon") {
    try {
      ns.brutessh(wd); ns.ftpcrack(wd); ns.relaysmtp(wd); ns.httpworm(wd); ns.sqlinject(wd)
      ns.nuke(wd)
    } catch (error) { return put({ step: "root failed", why: String(error).slice(0, 300) }) }
  }
  put({ step: "calling destroy", path, rooted: ns.hasRootAccess(wd) })
  try {
    if (callback === "none") ns.singularity.destroyW0r1dD43m0n(n)
    else ns.singularity.destroyW0r1dD43m0n(n, callback)
  } catch (error) { return put({ step: "destroy threw", why: String(error).slice(0, 300) }) }
  put({ step: "destroy returned", why: "the game did not finish the BitNode" })
}
