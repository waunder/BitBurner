/** @param {NS} ns */
export async function main(ns) {
  const script = ns.args[0] || "mcp.js"
  const host = ns.args[1] || "home"

  if (ns.ui && typeof ns.ui.openTail === "function") {
    ns.ui.openTail(script, host)
  }

  ns.clearLog()
  ns.print(`tailing ${script} on ${host}`)

  while (true) {
    const logs = ns.getScriptLogs(script, host)
    ns.clearLog()
    if (!logs || logs.length === 0) {
      ns.print(`no logs for ${script} on ${host}`)
    } else {
      const tail = logs.slice(-20)
      for (const line of tail) {
        ns.print(line)
      }
    }
    await ns.sleep(1000)
  }
}
