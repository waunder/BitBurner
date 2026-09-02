/** Low-frequency Coding Contract discovery and one-at-a-time guarded queue. */
import { solveContract } from "cct_logic.js"
import { selectContractWork } from "maintenance_logic.js"
import { prepareContractWorker, selectContractWorker } from "cct_worker_pool.js"

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
    let delayMs = POLL_MS
    try {
      const auditRam = ns.getScriptRam("cct_audit.js", "home")
      const auditCandidate = selectContractWorker(ns, auditRam)
      const auditWorker = await prepareContractWorker(ns, auditCandidate, auditRam)
      if (!auditWorker.ok) throw new Error(`no safe worker can host cct_audit.js: ${auditWorker.reason}`)
      // The finite scan owns this worker for seconds, not ten minutes. MCP
      // refills its released RAM on the next normal tick.
      const copied = await ns.scp("cct_audit.js", auditWorker.worker, "home")
      const auditPid = copied ? ns.exec("cct_audit.js", auditWorker.worker, 1, "--quiet") : 0
      if (auditPid === 0) throw new Error(`could not start audit on ${auditWorker.worker}`)
      while (ns.isRunning(auditPid, auditWorker.worker)) await ns.sleep(100)
      const pulled = await ns.scp("cct_inventory.json", "home", auditWorker.worker)
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
        writeQueue(ns, { ...selection, worker: auditWorker.worker, workerSource: auditWorker.source, inventoryTs: inventory.ts })
        writeStatus(ns, { ok: true, worker: auditWorker.worker, workerSource: auditWorker.source, contracts: inventory.contracts.length, inventoryTs: inventory.ts, queue: selection.action })
      } else {
        const target = selection.contract
        const submitRam = ns.getScriptRam("cct_submit.js", "home")
        const submitWorker = await prepareContractWorker(ns, selectContractWorker(ns, submitRam), submitRam)
        if (!submitWorker.ok) throw new Error(`no safe worker can host cct_submit.js: ${submitWorker.reason}`)
        const copiedSubmit = await ns.scp(["cct_submit.js", "cct_logic.js", "cct_inventory.json"], submitWorker.worker, "home")
        const submitPid = copiedSubmit ? ns.exec("cct_submit.js", submitWorker.worker, 1, target.host, target.file, MIN_TRIES) : 0
        if (submitPid === 0) throw new Error(`could not start guarded submission on ${submitWorker.worker}`)
        while (ns.isRunning(submitPid, submitWorker.worker)) await ns.sleep(100)
        const resultPulled = await ns.scp(["cct_submit_status.json", "cct_reward_ledger.json"], "home", submitWorker.worker)
        const result = resultPulled ? readJson(ns, "cct_submit_status.json", null) : null
        if (!result?.ok) writeQueue(ns, { action: "paused", reason: result?.reason || "submission result unavailable", worker: submitWorker.worker, workerSource: submitWorker.source, contract: target, result })
        else {
          writeQueue(ns, { action: "accepted", reason: result.reason, worker: submitWorker.worker, workerSource: submitWorker.source, contract: target, result: { type: result.type, reward: result.reward } })
          // A successful claim changes the inventory immediately. Re-audit
          // without waiting ten minutes so a known queue advances one
          // guarded item at a time; an idle or paused queue still remains
          // deliberately low-frequency.
          delayMs = 250
        }
        writeStatus(ns, { ok: Boolean(result?.ok), worker: submitWorker.worker, workerSource: submitWorker.source, contracts: inventory.contracts.length, inventoryTs: inventory.ts, queue: result?.ok ? "accepted" : "paused" })
      }
    } catch (error) {
      writeStatus(ns, { ok: false, error: String(error) })
    }
    await ns.sleep(delayMs)
  }
}
