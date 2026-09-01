/** Low-frequency Coding Contract discovery and one-at-a-time guarded queue. */
import { solveContract } from "cct_logic.js"
import { selectContractWork } from "maintenance_logic.js"

const POLL_MS = 10 * 60 * 1000
const STATUS = "cct_watch_status.json"
const QUEUE_STATUS = "cct_queue_status.json"
const MIN_TRIES = 10

function writeStatus(ns, extra = {}) {
  ns.write(STATUS, JSON.stringify({ ts: Date.now(), host: ns.getHostname(), pollMs: POLL_MS, mode: "read-only", ...extra }, null, 2), "w")
}

function readJson(ns, file, fallback) {
  try {
    const raw = ns.read(file)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

function writeQueue(ns, extra) {
  ns.write(QUEUE_STATUS, JSON.stringify({ ts: Date.now(), minTries: MIN_TRIES, ...extra }, null, 2), "w")
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
      if (!inventory) throw new Error("audit did not produce inventory")
      // Solver support is deliberately resolved before selecting a queue item:
      // unknown types stop the queue without spending an attempt or silently
      // skipping an opportunity that needs a reviewed solver.
      const enriched = { ...inventory, contracts: inventory.contracts.map((contract) => ({
        ...contract, supported: solveContract(contract.type, contract.data).supported,
      })) }
      const selection = selectContractWork(enriched, readJson(ns, "cct_reward_ledger.json", { entries: [] }), MIN_TRIES)
      if (selection.action !== "submit") {
        writeQueue(ns, { ...selection, worker, inventoryTs: inventory.ts })
        writeStatus(ns, { ok: true, worker, contracts: inventory.contracts.length, inventoryTs: inventory.ts, queue: selection.action })
      } else {
        const target = selection.contract
        const copiedSubmit = await ns.scp(["cct_submit.js", "cct_logic.js", "cct_inventory.json"], worker, "home")
        const submitPid = copiedSubmit ? ns.exec("cct_submit.js", worker, 1, target.host, target.file, MIN_TRIES) : 0
        if (submitPid === 0) throw new Error(`could not start guarded submission on ${worker}`)
        while (ns.isRunning(submitPid, worker)) await ns.sleep(100)
        const resultPulled = await ns.scp(["cct_submit_status.json", "cct_reward_ledger.json"], "home", worker)
        const result = resultPulled ? readJson(ns, "cct_submit_status.json", null) : null
        if (!result?.ok) writeQueue(ns, { action: "paused", reason: result?.reason || "submission result unavailable", worker, contract: target, result })
        else writeQueue(ns, { action: "accepted", reason: result.reason, worker, contract: target, result: { type: result.type, reward: result.reward } })
        writeStatus(ns, { ok: Boolean(result?.ok), worker, contracts: inventory.contracts.length, inventoryTs: inventory.ts, queue: result?.ok ? "accepted" : "paused" })
      }
    } catch (error) {
      writeStatus(ns, { ok: false, error: String(error) })
    }
    await ns.sleep(POLL_MS)
  }
}
