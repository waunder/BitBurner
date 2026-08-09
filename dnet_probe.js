/**
 * First-contact script for the darknet (ns.dnet) API — deliberately narrow.
 * Reports what's visible and attempts exactly one known-safe authenticate
 * call (darkweb, empty password, confirmed via in-game inspection to be
 * ZeroLogon), then stops. Does not scp, exec, memoryReallocation,
 * phishingAttack, setStasisLink, or induceServerMigration — none of that is
 * understood well enough yet to spend a limited resource or risk anything
 * on. This exists to get real, verified behavior to build a proper
 * functions/tactics/strategy set on top of, not to be the automation itself.
 *
 * RAM: ~2.3GB (1.6GB baseline + probe 0.2GB + authenticate 0.4GB +
 * getServerDetails 0.1GB, all four read from the game's own cost table).
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const nearby = ns.dnet.probe()
  ns.tprint(`dnet_probe: ${nearby.length} darknet server(s) visible from ${ns.getHostname()}: ${nearby.join(", ")}`)

  for (const hostname of nearby) {
    const details = ns.dnet.getServerDetails(hostname)
    ns.tprint(
      `dnet_probe: ${hostname} model=${details.modelId} online=${details.isOnline} ` +
        `connected=${details.isConnectedToCurrentServer} session=${details.hasSession}`
    )
  }

  if (nearby.includes("darkweb")) {
    const result = await ns.dnet.authenticate("darkweb", "")
    ns.tprint(`dnet_probe: authenticate("darkweb", "") -> success=${result.success}`)
  } else {
    ns.tprint(`dnet_probe: darkweb not in probe() results from this host — run from a server actually connected to it`)
  }
}
