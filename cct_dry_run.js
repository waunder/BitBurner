/** Compute, but never submit, answers for the current contract inventory. */
import { solveContract } from "cct_logic.js"

const INVENTORY = "cct_inventory.json"
const OUTPUT = "cct_dry_run.json"

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  let inventory
  try { inventory = JSON.parse(ns.read(INVENTORY)) } catch (error) {
    ns.write(OUTPUT, JSON.stringify({ ts: Date.now(), ok: false, error: `inventory unreadable: ${error}` }, null, 2), "w")
    return
  }
  const results = (inventory.contracts || []).map((contract) => {
    if (!contract.type) return { host: contract.host, file: contract.file, supported: false, error: contract.error || "missing type" }
    try {
      const solved = solveContract(contract.type, contract.data)
      return { host: contract.host, file: contract.file, type: contract.type, triesRemaining: contract.triesRemaining, ...solved }
    } catch (error) {
      return { host: contract.host, file: contract.file, type: contract.type, triesRemaining: contract.triesRemaining, supported: false, error: String(error) }
    }
  })
  const supported = results.filter((x) => x.supported).length
  ns.write(OUTPUT, JSON.stringify({ ts: Date.now(), mode: "dry-run", total: results.length, supported, results }, null, 2), "w")
  ns.tprint(`cct_dry_run: computed ${supported}/${results.length}; no submissions made.`)
}
