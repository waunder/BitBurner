import test from "node:test"
import assert from "node:assert/strict"
import { selectContractWork, shouldRequestMcpRecovery } from "./maintenance_logic.js"

const contract = (overrides = {}) => ({ host: "a", file: "x.cct", type: "Known", fingerprint: "f", triesRemaining: 10, supported: true, ...overrides })

test("selects one supported, sufficiently safe contract", () => {
  assert.equal(selectContractWork({ contracts: [contract()] }, { entries: [] }).action, "submit")
})
test("pauses before an unsupported contract", () => {
  const result = selectContractWork({ contracts: [contract({ supported: false, type: "New Type" })] }, { entries: [] })
  assert.equal(result.action, "paused")
  assert.match(result.reason, /unsupported/)
})
test("holds a low-try contract while advancing a later eligible contract", () => {
  const held = contract({ host: "a", file: "held.cct", triesRemaining: 3 })
  const eligible = contract({ host: "b", file: "safe.cct", triesRemaining: 10 })
  const result = selectContractWork({ contracts: [held, eligible] }, { entries: [] }, 5)
  assert.equal(result.action, "submit")
  assert.equal(result.contract.file, "safe.cct")
})
test("claims known safe work before pausing on a later unsupported contract", () => {
  const unsupported = contract({ host: "a", supported: false, type: "New Type" })
  const eligible = contract({ host: "b", file: "safe.cct" })
  const result = selectContractWork({ contracts: [unsupported, eligible] }, { entries: [] }, 5)
  assert.equal(result.action, "submit")
  assert.equal(result.contract.file, "safe.cct")
})
test("does not retry accepted fingerprints", () => {
  const result = selectContractWork({ contracts: [contract()] }, { entries: [{ ok: true, host: "a", file: "x.cct", fingerprint: "f" }] })
  assert.equal(result.action, "idle")
})
test("requires a persistent stale period and honors cooldown", () => {
  const now = 1_000_000
  assert.equal(shouldRequestMcpRecovery({ now, mcp: { ts: now - 100_000 }, previous: {} }), false)
  assert.equal(shouldRequestMcpRecovery({ now, mcp: { ts: now - 100_000 }, previous: { mcpStaleSince: now - 70_000 } }), true)
  assert.equal(shouldRequestMcpRecovery({ now, mcp: { ts: now - 100_000 }, previous: { mcpStaleSince: now - 70_000, lastRecoveryAt: now - 10_000 } }), false)
})
