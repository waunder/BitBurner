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
  // The watcher must be live before MCP consumes home RAM. Starting it from
  // the steward races its first scheduling slice against MCP and can leave
  // every subsequent queue cycle starved.
  ns.scriptKill("cct_watcher.js", "home")
  const watcherPid = ns.run("cct_watcher.js", 1)
  if (watcherPid === 0) ns.tprint("mcp_launch: failed to start cct watcher")
  // Bring the small observer up before MCP reclaims the worker pool.
  ns.scriptKill("maintenance_steward.js", "home")
  const maintenancePid = ns.run("maintenance_steward.js", 1)
  if (maintenancePid === 0) ns.tprint("mcp_launch: failed to start maintenance steward")
  let augmentationPid = -1
  if (!ns.isRunning("augmentation_readiness.js", "home")) {
    augmentationPid = ns.run("augmentation_readiness.js", 1)
    if (augmentationPid === 0) ns.tprint("mcp_launch: failed to start augmentation readiness")
  }
  ns.write("maintenance_launch_status.json", JSON.stringify({
    ts: Date.now(), watcherPid, maintenancePid, augmentationPid,
    augmentationRunning: ns.isRunning("augmentation_readiness.js", "home"),
  }, null, 2), "w")
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
  // Operations is the primary persistent panel; refresh it with the same
  // generation so it sees newly added maintenance fields without a manual
  // terminal command.
  const refreshOpsHud = true
  if (refreshOpsHud) {
    for (const proc of ns.ps("home")) {
      if (proc.filename.replace(/^\//, "") !== "ops_hud.js") continue
      ns.ui?.closeTail(proc.pid)
      ns.kill(proc.pid)
    }
    if (ns.run("ops_hud.js", 1) === 0) ns.tprint("mcp_launch: failed to start ops_hud.js")
  }
  // The focused XP panel is intentionally separate from Operations: the
  // latter reports broad health, while this remains readable beside the money
  // panel during player-led hacking progression.
  for (const proc of ns.ps("home")) {
    if (proc.filename.replace(/^\//, "") !== "mcp_xp.js") continue
    ns.ui?.closeTail(proc.pid)
    ns.kill(proc.pid)
  }
  if (ns.run("mcp_xp.js", 1) === 0) ns.tprint("mcp_launch: failed to start mcp_xp.js")
  if (request.startScorecard) {
    const scorePid = ns.run("dnet_scorecard.js", 1)
    if (scorePid === 0) ns.tprint("mcp_launch: failed to start dnet_scorecard.js")
    else ns.tprint(`mcp_launch: started dnet_scorecard.js (pid ${scorePid})`)
  }
}
