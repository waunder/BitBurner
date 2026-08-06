/** @param {NS} ns */
export async function main(ns) {
  const script = "mcp.js"
  const host = ns.args[0] || "home"
  const tailLines = ns.args[1] || 20

  if (ns.ui && typeof ns.ui.openTail === "function") {
    ns.ui.openTail(script, host)
  }

  ns.clearLog()
  ns.print(`mcp_status: tailing ${script} on ${host}`)

  while (true) {
    const logs = ns.getScriptLogs(script, host)
    ns.clearLog()
    if (!logs || logs.length === 0) {
      ns.print(`mcp_status: no logs for ${script} on ${host}`)
    } else {
      const tail = logs.slice(-tailLines)
      for (const line of tail) {
        ns.print(line)
      }
    }
    await ns.sleep(1000)
  }
}
