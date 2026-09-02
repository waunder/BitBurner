import test from "node:test"
import assert from "node:assert/strict"
import { evaluateAutomationHealth } from "./automation_review_logic.js"

test("healthy current MCP and stopped Darknet are quiet", () => {
  const result = evaluateAutomationHealth({ now: 100_000, mcp: { ts: 90_000, invariantViolations: {} }, dnetRootRunning: false, managerRegistry: {} })
  assert.deepEqual(result.alerts, [])
})

test("reports stale MCP, invariants, stale running Darknet, and cap breach", () => {
  const result = evaluateAutomationHealth({
    now: 200_000,
    mcp: { ts: 100_000, invariantViolations: { ramOvercommit: 2 } },
    dnetRoot: { ts: 100_000 },
    dnetRootRunning: true,
    managerRegistry: { a: 199_000, b: 198_000, c: 197_000 },
    managerErrors: [{ host: "darkweb", lastError: "phish failed" }],
  })
  assert.deepEqual(result.alerts.map((a) => a.key).sort(), ["dnet-manager-cap", "dnet-manager-error-darkweb", "dnet-root-stale", "mcp-invariant-ramOvercommit", "mcp-status-stale"])
  assert.equal(result.activeManagers, 3)
})
