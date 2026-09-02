/** Pure health rules for automation_review.js. */
export function evaluateAutomationHealth({ now, mcp, dnetRoot, managerRegistry, managerErrors = [], dnetRootRunning, limits = {} }) {
  const alerts = []
  const mcpStaleMs = limits.mcpStaleMs ?? 45_000
  const dnetRootStaleMs = limits.dnetRootStaleMs ?? 20_000
  const maxManagers = limits.maxManagers ?? 2

  if (!mcp || !Number.isFinite(mcp.ts)) {
    alerts.push({ key: "mcp-status-missing", severity: "warning", message: "MCP status is missing or invalid" })
  } else if (now - mcp.ts > mcpStaleMs) {
    alerts.push({ key: "mcp-status-stale", severity: "warning", message: `MCP status is stale (${Math.floor((now - mcp.ts) / 1000)}s)` })
  }

  const violations = mcp?.invariantViolations ?? {}
  for (const [name, count] of Object.entries(violations)) {
    if (Number(count) > 0) alerts.push({ key: `mcp-invariant-${name}`, severity: "error", message: `MCP invariant ${name} violated (${count})` })
  }

  if (dnetRootRunning) {
    if (!dnetRoot || !Number.isFinite(dnetRoot.ts)) {
      alerts.push({ key: "dnet-root-status-missing", severity: "warning", message: "Darknet root is running without a heartbeat" })
    } else if (now - dnetRoot.ts > dnetRootStaleMs) {
      alerts.push({ key: "dnet-root-stale", severity: "warning", message: `Darknet root heartbeat is stale (${Math.floor((now - dnetRoot.ts) / 1000)}s)` })
    }
  }

  const activeManagers = Object.values(managerRegistry ?? {}).filter((ts) => Number.isFinite(ts) && now - ts < 120_000).length
  if (activeManagers > maxManagers) {
    alerts.push({ key: "dnet-manager-cap", severity: "error", message: `Darknet manager cap exceeded (${activeManagers}/${maxManagers})` })
  }
  for (const manager of managerErrors) {
    if (manager?.host && manager?.lastError) {
      alerts.push({ key: `dnet-manager-error-${manager.host}`, severity: "warning", message: `Darknet manager ${manager.host} retrying: ${manager.lastError}` })
    }
  }
  return { alerts, activeManagers }
}
