/** Low-frequency, read-only Coding Contract discovery. */

const POLL_MS = 10 * 60 * 1000
const STATUS = "cct_watch_status.json"

function writeStatus(ns, extra = {}) {
  ns.write(STATUS, JSON.stringify({ ts: Date.now(), host: ns.getHostname(), pollMs: POLL_MS, mode: "read-only", ...extra }, null, 2), "w")
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  while (true) {
    try {
      const auditRam = ns.getScriptRam("cct_audit.js", "home")
      const worker = ns.cloud.getServerNames()
        .filter((host) => ns.hasRootAccess(host) && ns.getServerMaxRam(host) >= auditRam)
        .sort((a, b) => ns.getServerMaxRam(b) - ns.getServerMaxRam(a))[0]
      if (!worker) throw new Error("no cloud worker can host cct_audit.js")
      // The finite scan owns this worker for seconds, not ten minutes. MCP
      // refills its released RAM on the next normal tick.
      ns.killall(worker)
      const copied = await ns.scp("cct_audit.js", worker, "home")
      const auditPid = copied ? ns.exec("cct_audit.js", worker, 1, "--quiet") : 0
      if (auditPid === 0) throw new Error(`could not start audit on ${worker}`)
      while (ns.isRunning(auditPid, worker)) await ns.sleep(100)
      const pulled = await ns.scp("cct_inventory.json", "home", worker)
      const inventory = pulled ? JSON.parse(ns.read("cct_inventory.json")) : null
      writeStatus(ns, { ok: Boolean(inventory), worker, contracts: inventory?.contracts?.length || 0, inventoryTs: inventory?.ts })
    } catch (error) {
      writeStatus(ns, { ok: false, error: String(error) })
    }
    await ns.sleep(POLL_MS)
  }
}
