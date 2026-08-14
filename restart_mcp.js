/** @param {NS} ns */
export async function main(ns) {
  const restartDarknet = ns.args.some((arg) => String(arg) === "--darknet")
  const mcpArgs = ns.args.filter((arg) => String(arg) !== "--darknet")

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

  const pid = ns.run("mcp.js", 1, ...mcpArgs)
  if (pid === 0) {
    ns.tprint("restart_mcp: failed to start mcp.js (not enough RAM on home?)")
    return
  }
  ns.tprint(`restart_mcp: started mcp.js (pid ${pid})${mcpArgs.length ? " args=" + JSON.stringify(mcpArgs) : ""}`)

  if (restartDarknet) {
    const dnetPid = ns.run("dnet_killswarm.js", 1, "--restart")
    if (dnetPid === 0) ns.tprint("restart_mcp: failed to start dnet_killswarm.js --restart")
    else ns.tprint(`restart_mcp: Dark Net cleanup/restart delegated to dnet_killswarm.js (pid ${dnetPid})`)
  }
}
