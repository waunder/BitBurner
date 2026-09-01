/**
 * Quiet home-side automation reviewer.
 *
 * Reads the existing MCP/Darknet durable status files and emits only new or
 * changed actionable findings.  It never tails worker output, scans Darknet
 * shards, changes targets, or starts/stops any process.
 *
 * Writes: automation_review.json (current assessment),
 *         automation_review.txt (bounded transition history).
 * Start:  run automation_review.js
 *
 * @param {NS} ns
 */
import { evaluateAutomationHealth } from "automation_review_logic.js"

const POLL_MS = 30_000
const STATUS_FILE = "automation_review.json"
const EVENT_FILE = "automation_review.txt"
const EVENT_KEEP = 200

function readJson(ns, file, fallback = null) {
  try {
    const raw = ns.read(file)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function dnetRootRunning(ns) {
  return ns.ps("home").some((p) => p.filename.replace(/^\//, "") === "dnet_root.js")
}

function managerErrors(ns) {
  const out = []
  for (const file of ns.ls("home", "dnet_manager_active_")) {
    const record = readJson(ns, file)
    if (record?.lastError) out.push(record)
  }
  return out
}

function trimEvents(ns) {
  const lines = String(ns.read(EVENT_FILE) || "").split("\n").filter(Boolean)
  if (lines.length > EVENT_KEEP) ns.write(EVENT_FILE, lines.slice(-EVENT_KEEP).join("\n") + "\n", "w")
}

function alertSignature(alerts) {
  return alerts.map((a) => `${a.key}:${a.message}`).sort().join("|")
}

export async function main(ns) {
  ns.disableLog("ALL")
  trimEvents(ns)
  let priorSignature = null
  while (true) {
    const now = Date.now()
    const result = evaluateAutomationHealth({
      now,
      mcp: readJson(ns, "mcp_status.json"),
      dnetRoot: readJson(ns, "dnet_deployer_home.json"),
      managerRegistry: readJson(ns, "dnet_manager_registry.json", {}),
      managerErrors: managerErrors(ns),
      dnetRootRunning: dnetRootRunning(ns),
    })
    const signature = alertSignature(result.alerts)
    const report = { ts: now, ok: result.alerts.length === 0, activeManagers: result.activeManagers, alerts: result.alerts }
    ns.write(STATUS_FILE, JSON.stringify(report, null, 2), "w")
    if (signature !== priorSignature) {
      ns.write(EVENT_FILE, JSON.stringify(report) + "\n", "a")
      // One toast per changed condition is visible without filling a console.
      if (result.alerts.length) ns.toast(`automation: ${result.alerts[0].message}`, result.alerts[0].severity, 8000)
      priorSignature = signature
    }
    await ns.sleep(POLL_MS)
  }
}
