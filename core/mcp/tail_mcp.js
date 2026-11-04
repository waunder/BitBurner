/** @param {NS} ns */
const WHITE = "\u001b[1;37m"
const GREEN = "\u001b[1;32m"
const RESET = "\u001b[0m"
export async function main(ns) {
  const script = ns.args[0] || "mcp.js"
  const host = ns.args[1] || "home"

  if (ns.ui && typeof ns.ui.openTail === "function") {
    ns.ui.openTail(script, host)
  }

  ns.clearLog()
  ns.print(WHITE + `MCP LOG: tailing ${script} on ${host}` + RESET)

  while (true) {
    const logs = ns.getScriptLogs(script, host)
    ns.clearLog()
    if (!logs || logs.length === 0) {
      ns.print(WHITE + `MCP LOG: no logs for ${script} on ${host}` + RESET)
    } else {
      const tail = logs.slice(-20)
      for (const line of tail) {
        ns.print(GREEN + line + RESET)
      }
    }
    await ns.sleep(1000)
  }
}
