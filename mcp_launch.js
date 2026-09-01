/**
 * Tiny post-restart handoff. restart_mcp.js reaches this via ns.spawn(), so
 * its large optional API footprint has already been released before MCP is
 * allocated. This file must stay small: it exists specifically to make a
 * controller restart reliable when home is busy.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const request = JSON.parse(String(ns.args[0] || "{}"))
  const mcpArgs = Array.isArray(request.mcpArgs) ? request.mcpArgs : []
  const pid = ns.run("mcp.js", 1, ...mcpArgs)
  if (pid === 0) {
    const max = ns.getServerMaxRam("home")
    const used = ns.getServerUsedRam("home")
    ns.tprint(`mcp_launch: MCP did not start (free ${(max - used).toFixed(1)}GB; need ${ns.getScriptRam("mcp.js", "home").toFixed(1)}GB)`)
    return
  }
  ns.tprint(`mcp_launch: started mcp.js (pid ${pid})${mcpArgs.length ? " args=" + JSON.stringify(mcpArgs) : ""}`)

  if (request.startCctHud && !ns.isRunning("cct_hud.js", "home")) {
    if (ns.run("cct_hud.js", 1) === 0) ns.tprint("mcp_launch: failed to start cct_hud.js")
  }
  if (request.startOpsHud) {
    for (const proc of ns.ps("home")) {
      if (proc.filename.replace(/^\//, "") !== "ops_hud.js") continue
      ns.ui?.closeTail(proc.pid)
      ns.kill(proc.pid)
    }
    if (ns.run("ops_hud.js", 1) === 0) ns.tprint("mcp_launch: failed to start ops_hud.js")
  }
  if (request.startScorecard) {
    const scorePid = ns.run("dnet_scorecard.js", 1)
    if (scorePid === 0) ns.tprint("mcp_launch: failed to start dnet_scorecard.js")
    else ns.tprint(`mcp_launch: started dnet_scorecard.js (pid ${scorePid})`)
  }
}
