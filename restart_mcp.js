/** @param {NS} ns */
const DNET_RESTART_STATUS_FILE = "dnet_restart_status.json"

export async function main(ns) {
  const restartDarknet = ns.args.some((arg) => String(arg) === "--darknet")
  const startScorecard = ns.args.some((arg) => String(arg) === "--dnet-scorecard")
  const startCctAudit = ns.args.some((arg) => String(arg) === "--cct-audit")
  const mcpArgs = ns.args.filter((arg) => !["--darknet", "--dnet-scorecard", "--cct-audit"].includes(String(arg)))

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
    // Do not ask cleanup to launch the root itself: at that point cleanup is
    // still occupying its own RAM, which made the root launch fail even
    // though enough RAM became free a moment later. This parent has waited
    // for cleanup to exit, so it is the reliable launcher.
    const dnetPid = ns.run("dnet_killswarm.js", 1, "--quiet")
    if (dnetPid === 0) ns.tprint("restart_mcp: failed to start dnet_killswarm.js")
    else {
      ns.tprint(`restart_mcp: waiting for Dark Net cleanup (pid ${dnetPid}) before root/MCP relaunch`)
      const deadline = Date.now() + 2 * 60 * 1000
      while (ns.isRunning(dnetPid) && Date.now() < deadline) await ns.sleep(100)
      if (ns.isRunning(dnetPid)) {
        ns.tprint("restart_mcp: Dark Net cleanup exceeded 120s; restarting MCP without waiting further")
        ns.write(DNET_RESTART_STATUS_FILE, JSON.stringify({
          ts: Date.now(), phase: "cleanup-timeout", cleanupPid: dnetPid,
        }), "w")
      } else {
        const before = {
          ts: Date.now(), phase: "launching-root",
          rootRam: ns.getScriptRam("dnet_root.js", "home"),
          maxRam: ns.getServerMaxRam("home"),
          usedRam: ns.getServerUsedRam("home"),
        }
        const rootPid = ns.run("dnet_root.js", 1)
        ns.write(DNET_RESTART_STATUS_FILE, JSON.stringify({
          ...before, rootPid, usedRamAfter: ns.getServerUsedRam("home"),
        }), "w")
        if (rootPid === 0) ns.tprint(`restart_mcp: Dark Net cleanup completed, but dnet_root.js failed to start (${JSON.stringify(before)})`)
        else ns.tprint(`restart_mcp: Dark Net cleanup completed; started dnet_root.js (pid ${rootPid})`)
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

  if (startCctAudit) {
    const auditPid = ns.run("cct_audit.js", 1)
    if (auditPid === 0) ns.tprint("restart_mcp: failed to start cct_audit.js")
    else ns.tprint(`restart_mcp: started read-only cct_audit.js (pid ${auditPid})`)
  }
}
