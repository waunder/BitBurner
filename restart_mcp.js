/** @param {NS} ns */
export async function main(ns) {
  const restartDarknet = ns.args.some((arg) => String(arg) === "--darknet")
  const startScorecard = ns.args.some((arg) => String(arg) === "--dnet-scorecard")
  const mcpArgs = ns.args.filter((arg) => !["--darknet", "--dnet-scorecard"].includes(String(arg)))

  if (ns.scriptKill("mcp.js", "home")) {
    // A killed script can still finish its in-flight tick, including writing
    // mcp_status.json and mcp_target_state.json. Starting the replacement on
    // a fixed timer races those writes — the new instance can load target
    // state that the old one is about to overwrite. Wait for it to be gone.
    const deadline = Date.now() + 10000
    while (ns.scriptRunning("mcp.js", "home") && Date.now() < deadline) {
      await ns.sleep(100)
    }
    if (ns.scriptRunning("mcp.js", "home")) {
      ns.tprint("restart_mcp: mcp.js still running after 10s; aborting rather than starting a second instance")
      return
    }
    ns.tprint("restart_mcp: killed existing mcp.js instance(s)")
  }

  // Start Dark Net cleanup while MCP's large worker allocation is still
  // absent.  Crucially, wait for it to launch the replacement root before
  // starting MCP: previously this merely *started* cleanup and immediately
  // relaunched MCP, which could consume home RAM before dnet_killswarm's
  // final `ns.run("dnet_root.js")`.
  if (restartDarknet) {
    const dnetPid = ns.run("dnet_killswarm.js", 1, "--restart")
    if (dnetPid === 0) ns.tprint("restart_mcp: failed to start dnet_killswarm.js --restart")
    else {
      ns.tprint(`restart_mcp: waiting for Dark Net cleanup/restart (pid ${dnetPid}) before MCP relaunch`)
      const deadline = Date.now() + 2 * 60 * 1000
      while (ns.isRunning(dnetPid) && Date.now() < deadline) await ns.sleep(100)
      if (ns.isRunning(dnetPid)) {
        ns.tprint("restart_mcp: Dark Net cleanup exceeded 120s; restarting MCP without waiting further")
      } else {
        ns.tprint("restart_mcp: Dark Net cleanup/restart completed")
      }
    }
  }

  const pid = ns.run("mcp.js", 1, ...mcpArgs)
  if (pid === 0) {
    ns.tprint("restart_mcp: failed to start mcp.js (not enough RAM on home?)")
    return
  }
  ns.tprint(`restart_mcp: started mcp.js (pid ${pid})${mcpArgs.length ? " args=" + JSON.stringify(mcpArgs) : ""}`)

  if (startScorecard) {
    const scorePid = ns.run("dnet_scorecard.js", 1)
    if (scorePid === 0) ns.tprint("restart_mcp: failed to start dnet_scorecard.js")
    else ns.tprint(`restart_mcp: started dnet_scorecard.js (pid ${scorePid})`)
  }
}
