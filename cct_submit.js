/** Submit exactly one explicit Coding Contract, guarded by its audit snapshot. */
import { solveContract } from "cct_logic.js"

const INVENTORY = "cct_inventory.json"
const OUTPUT = "cct_submit_status.json"
const LEDGER = "cct_reward_ledger.json"
const LEDGER_LIMIT = 100

// The first twelve accepted contracts predate this file. Keep their verified
// aggregate as an explicit opening balance rather than inventing individual
// rewards (the CSEC result was interrupted and is deliberately not included).
const OPENING_BALANCE = {
  accepted: 12,
  cash: 25000000,
  factionRep: {
    "The Black Hand": 3262,
    NiteSec: 3262,
    "Sector-12": 3540.778,
    CyberSec: 4095.333,
  },
  note: "Verified aggregate before durable per-submission ledger; CSEC outcome unconfirmed.",
}

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

function readLedger(ns) {
  try {
    const parsed = JSON.parse(ns.read(LEDGER))
    if (parsed && Array.isArray(parsed.entries)) return parsed
  } catch { /* first submission creates the ledger */ }
  return { version: 1, openingBalance: OPENING_BALANCE, entries: [] }
}

function appendLedger(ns, entry) {
  const ledger = readLedger(ns)
  ledger.entries.push(entry)
  // Bounded append-only history: retained entries never change, and only the
  // oldest detailed entries roll off after the visible hundred.
  if (ledger.entries.length > LEDGER_LIMIT) ledger.entries = ledger.entries.slice(-LEDGER_LIMIT)
  ledger.updatedAt = Date.now()
  ns.write(LEDGER, JSON.stringify(ledger, null, 2), "w")
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
  const outcome = { ts: Date.now(), ok: reward !== false, submitted: true, host, file, minTries, triesRemainingBefore: triesRemaining, type, fingerprint, reward: reward === false ? null : reward, reason: reward === false ? "answer rejected" : "answer accepted", solver: "claude" }
  appendLedger(ns, outcome)
  writeStatus(ns, { ...outcome, answer: solved.answer })
  ns.tprint(`cct_submit: ${host}/${file}: ${reward === false ? "rejected" : `accepted (${reward})`}`)
}
