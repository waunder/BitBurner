/** @param {NS} ns
 * One-shot: restarts dnet_root.js with its current args and stops riders on linked
 * hosts, which dnet_lift.js restarts from new source. Then restores work focus, which
 * leaving the work page to reach the terminal gives up. */
export async function main(ns) {
  const root = ns.ps("home").find(proc => proc.filename.replace(/^\//, "") === "dnet_root.js")
  const args = root?.args ?? []
  if (root) ns.kill(root.pid)
  for (const host of ns.dnet.getStasisLinkedServers()) {
    for (const proc of ns.ps(host)) if (proc.filename.replace(/^\//, "") === "dnet_rider.js") ns.kill(proc.pid)
  }
  await ns.sleep(200)
  const pid = ns.run("dnet_root.js", 1, ...args)
  ns.tprint(`dnet_root.js restarted, pid ${pid}, args ${JSON.stringify(args)}`)
  ns.singularity.setFocus(true)
}
