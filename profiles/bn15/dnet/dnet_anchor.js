/**
 * Applies or removes the stasis link on the host it runs on, then exits. A linked
 * server cannot move or go offline, and can be reached by exec from anywhere, so
 * dnet_root.js starts scout chains there instead of at darkweb.
 *
 * Start: dnet_scout.js, on a deeper host than the shallowest anchor. Args: --unlink.
 * Link limit starts at 1 and labyrinth rewards raise it. Needs about 14GB.
 * @param {NS} ns
 */
export const ANCHOR_STATUS = "dnet_anchor_status.json"

export async function main(ns) {
  ns.disableLog("ALL")
  const link = ns.args[0] !== "--unlink"
  const result = await ns.dnet.setStasisLink(link)
  ns.write(ANCHOR_STATUS, JSON.stringify({ ts: Date.now(), host: ns.getHostname(), link, success: result.success, code: result.code, message: result.message }), "w")
  ns.scp(ANCHOR_STATUS, "home")
}
