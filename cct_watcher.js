/** Low-frequency, read-only Coding Contract discovery on a cloud worker. */
import { main as audit } from "cct_audit.js"

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
      await audit(ns, true)
      const inventory = JSON.parse(ns.read("cct_inventory.json"))
      writeStatus(ns, { ok: true, contracts: inventory.contracts?.length || 0, inventoryTs: inventory.ts })
      await ns.scp(["cct_inventory.json", STATUS], "home")
    } catch (error) {
      writeStatus(ns, { ok: false, error: String(error) })
      await ns.scp(STATUS, "home")
    }
    await ns.sleep(POLL_MS)
  }
}
