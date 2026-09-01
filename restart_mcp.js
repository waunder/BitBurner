/** @param {NS} ns */
const DNET_RESTART_STATUS_FILE = "dnet_restart_status.json"

export async function main(ns) {
  const restartDarknet = ns.args.some((arg) => String(arg) === "--darknet")
  const startScorecard = ns.args.some((arg) => String(arg) === "--dnet-scorecard")
  const startCctAudit = ns.args.some((arg) => String(arg) === "--cct-audit")
  const startCctDryRun = ns.args.some((arg) => String(arg) === "--cct-dry-run")
  const startCctHud = ns.args.some((arg) => String(arg) === "--cct-hud")
  const startCctWatcher = ns.args.some((arg) => String(arg) === "--cct-watch")
  const startOpsHud = ns.args.some((arg) => String(arg) === "--ops-hud")
  const cctSubmitArg = ns.args.find((arg) => String(arg).startsWith("--cct-submit="))
  const cctMinTriesArg = ns.args.find((arg) => String(arg).startsWith("--cct-min-tries="))
  const buyWorkerArg = ns.args.find((arg) => String(arg).startsWith("--buy-worker="))
  const mcpArgs = ns.args.filter((arg) => !["--darknet", "--dnet-scorecard", "--cct-audit", "--cct-dry-run", "--cct-hud", "--cct-watch", "--ops-hud"].includes(String(arg)) && !String(arg).startsWith("--buy-worker=") && !String(arg).startsWith("--cct-submit=") && !String(arg).startsWith("--cct-min-tries="))

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

  // Independent, quiet status consumer. Start it before MCP consumes home
  // RAM; it does not control Darknet or alter any gameplay action.
  // A guarded CCT submission needs 23.6GB on this 64GB home. Pause the
  // non-controller reviewer for its short finite run, then restore it below.
  // This avoids degrading the active manager or Darknet merely to submit one
  // explicitly requested contract.
  if (cctSubmitArg) ns.scriptKill("automation_review.js", "home")
  if (!cctSubmitArg && !ns.isRunning("automation_review.js", "home")) {
    const reviewerPid = ns.run("automation_review.js", 1)
    if (reviewerPid === 0) ns.tprint("restart_mcp: failed to start automation reviewer")
  }

  // The audit's read-only Coding Contract API footprint is too large to fit
  // after MCP consumes home RAM. Run this finite task first, while its result
  // is still available on disk for the Remote API to retrieve.
  if (startCctAudit) {
    const auditPid = ns.run("cct_audit.js", 1)
    if (auditPid === 0) ns.tprint("restart_mcp: failed to start cct_audit.js")
    else {
      while (ns.isRunning(auditPid)) await ns.sleep(100)
      ns.tprint("restart_mcp: read-only cct_audit.js completed")
    }
  }

  if (startCctDryRun) {
    const dryRunPid = ns.run("cct_dry_run.js", 1)
    if (dryRunPid === 0) ns.tprint("restart_mcp: failed to start cct_dry_run.js")
    else while (ns.isRunning(dryRunPid)) await ns.sleep(100)
  }

  // One explicit pair only; cct_submit verifies the audited snapshot before
  // it can call attempt(). Format avoids spaces: --cct-submit=host|file.
  if (cctSubmitArg) {
    const target = String(cctSubmitArg).slice("--cct-submit=".length).split("|")
    const minTries = cctMinTriesArg ? String(cctMinTriesArg).slice("--cct-min-tries=".length) : "10"
    if (target.length !== 2 || !target[0] || !target[1]) ns.tprint("restart_mcp: cct submit requires --cct-submit=host|file")
    else {
      // `cct_submit.js` costs 23.6GB, while home intentionally reserves
      // RAM for MCP/Darknet. Borrow one dedicated cloud worker briefly:
      // MCP has already been stopped above, and it will refill the worker
      // after this finite single-contract task completes.
      const submitRam = ns.getScriptRam("cct_submit.js", "home")
      const worker = ns.cloud.getServerNames()
        .filter((host) => ns.hasRootAccess(host) && ns.getServerMaxRam(host) >= submitRam)
        .sort((a, b) => ns.getServerMaxRam(b) - ns.getServerMaxRam(a))[0]
      let submitPid = 0
      if (worker) {
        ns.killall(worker)
        const copied = await ns.scp(["cct_submit.js", "cct_logic.js", "cct_inventory.json"], worker, "home")
        if (!copied) ns.tprint(`restart_mcp: failed to copy CCT submit files to ${worker}`)
        else {
          submitPid = ns.exec("cct_submit.js", worker, 1, target[0], target[1], minTries)
          if (submitPid !== 0) {
            while (ns.isRunning(submitPid, worker)) await ns.sleep(100)
            await ns.scp(["cct_submit_status.json", "cct_reward_ledger.json"], "home", worker)
          }
        }
      }
      else submitPid = ns.run("cct_submit.js", 1, target[0], target[1], minTries)
      if (submitPid === 0) {
        ns.write("cct_submit_status.json", JSON.stringify({
          ts: Date.now(), ok: false, submitted: false, host: target[0], file: target[1], minTries,
          homeMaxRam: ns.getServerMaxRam("home"),
          homeUsedRam: ns.getServerUsedRam("home"),
          submitRam: ns.getScriptRam("cct_submit.js", "home"),
          sourcePresent: ns.fileExists("cct_submit.js", "home"),
          reason: "restart_mcp could not start cct_submit.js (insufficient home RAM or missing source)",
        }, null, 2), "w")
        ns.tprint("restart_mcp: failed to start cct_submit.js")
      }
      else while (ns.isRunning(submitPid)) await ns.sleep(100)
    }
    if (!ns.isRunning("automation_review.js", "home")) {
      const reviewerPid = ns.run("automation_review.js", 1)
      if (reviewerPid === 0) ns.tprint("restart_mcp: failed to restore automation reviewer")
    }
  }

  if (buyWorkerArg) {
    const ram = String(buyWorkerArg).slice("--buy-worker=".length)
    const purchasePid = ns.run("purchase_worker_server.js", 1, ram)
    if (purchasePid === 0) ns.tprint("restart_mcp: failed to start purchase_worker_server.js")
    else while (ns.isRunning(purchasePid)) await ns.sleep(100)
  }

  // Discovery stays a tiny controller on home; its finite scan runs on a
  // cloud worker every ten minutes and releases that worker immediately.
  if (startCctWatcher) {
    if (!ns.isRunning("cct_watcher.js", "home")) {
      const watcherPid = ns.run("cct_watcher.js", 1)
      if (watcherPid === 0) ns.tprint("restart_mcp: failed to start cct watcher")
    }
  }

  const pid = ns.run("mcp.js", 1, ...mcpArgs)
  if (pid === 0) {
    ns.tprint("restart_mcp: failed to start mcp.js (not enough RAM on home?)")
    return
  }
  ns.tprint(`restart_mcp: started mcp.js (pid ${pid})${mcpArgs.length ? " args=" + JSON.stringify(mcpArgs) : ""}`)

  if (startCctHud && !ns.isRunning("cct_hud.js", "home")) {
    const hudPid = ns.run("cct_hud.js", 1)
    if (hudPid === 0) ns.tprint("restart_mcp: failed to start cct_hud.js")
  }

  // The consolidated panel is a read-only consumer of the durable MCP,
  // contract, Darknet, cloud, and reviewer records.  Start it after MCP so
  // a failed optional HUD can never delay the controller.
  if (startOpsHud && !ns.isRunning("ops_hud.js", "home")) {
    const opsPid = ns.run("ops_hud.js", 1)
    if (opsPid === 0) ns.tprint("restart_mcp: failed to start ops_hud.js")
  }

  if (startScorecard) {
    const scorePid = ns.run("dnet_scorecard.js", 1)
    if (scorePid === 0) ns.tprint("restart_mcp: failed to start dnet_scorecard.js")
    else ns.tprint(`restart_mcp: started dnet_scorecard.js (pid ${scorePid})`)
  }

}
