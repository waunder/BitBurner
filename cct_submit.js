/** Submit exactly one explicit Coding Contract, guarded by its audit snapshot. */
import { solveContract } from "cct_logic.js"

const INVENTORY = "cct_inventory.json"
const OUTPUT = "cct_submit_status.json"

// Keep this small helper local so the finite submit task does not import the
// audit's network-scan API footprint when home RAM is tight.
function contractFingerprint(type, data) {
  const text = `${type}\n${JSON.stringify(data)}`
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`
}

function writeStatus(ns, status) {
  ns.write(OUTPUT, JSON.stringify({ ts: Date.now(), ...status }, null, 2), "w")
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  const [host, file, minTriesArg = 10] = ns.args.map(String)
  const minTries = Number(minTriesArg)
  if (!host || !file || !Number.isInteger(minTries) || minTries < 1) {
    writeStatus(ns, { ok: false, submitted: false, reason: "usage: cct_submit.js <host> <file> [min-tries>=1]" })
    return
  }
  let inventory
  try { inventory = JSON.parse(ns.read(INVENTORY)) } catch (error) {
    writeStatus(ns, { ok: false, submitted: false, host, file, minTries, reason: `inventory unreadable: ${error}` })
    return
  }
  const audited = (inventory.contracts || []).find((item) => item.host === host && item.file === file)
  if (!audited?.type || !audited.fingerprint) {
    writeStatus(ns, { ok: false, submitted: false, host, file, minTries, reason: "target missing from a fingerprinted audit" })
    return
  }
  let type, data, triesRemaining
  try {
    type = ns.codingcontract.getContractType(file, host)
    data = ns.codingcontract.getData(file, host)
    triesRemaining = ns.codingcontract.getNumTriesRemaining(file, host)
  } catch (error) {
    writeStatus(ns, { ok: false, submitted: false, host, file, minTries, reason: `live read failed: ${error}` })
    return
  }
  const fingerprint = contractFingerprint(type, data)
  if (type !== audited.type || fingerprint !== audited.fingerprint) {
    writeStatus(ns, { ok: false, submitted: false, host, file, minTries, type, fingerprint, auditedType: audited.type, auditedFingerprint: audited.fingerprint, reason: "live contract differs from audit; rerun audit and review" })
    return
  }
  if (triesRemaining < minTries) {
    writeStatus(ns, { ok: false, submitted: false, host, file, minTries, triesRemaining, type, fingerprint, reason: "tries below guard" })
    return
  }
  const solved = solveContract(type, data)
  if (!solved.supported) {
    writeStatus(ns, { ok: false, submitted: false, host, file, minTries, triesRemaining, type, fingerprint, reason: "unsupported contract type" })
    return
  }
  const reward = ns.codingcontract.attempt(solved.answer, file, host, { returnReward: true })
  writeStatus(ns, { ok: reward !== false, submitted: true, host, file, minTries, triesRemainingBefore: triesRemaining, type, fingerprint, answer: solved.answer, reward: reward === false ? null : reward, reason: reward === false ? "answer rejected" : "answer accepted" })
  ns.tprint(`cct_submit: ${host}/${file}: ${reward === false ? "rejected" : `accepted (${reward})`}`)
}
