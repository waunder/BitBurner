/** Pure selection rules for the low-frequency maintenance steward. */

export function selectContractWork(inventory, ledger, minTries = 10) {
  const accepted = new Set((ledger?.entries || [])
    .filter((entry) => entry?.ok)
    .map((entry) => `${entry.host}|${entry.file}|${entry.fingerprint}`))
  const contracts = [...(inventory?.contracts || [])]
    .filter((contract) => contract?.host && contract?.file && contract?.type && contract?.fingerprint)
    .filter((contract) => !accepted.has(`${contract.host}|${contract.file}|${contract.fingerprint}`))
    .sort((a, b) => a.host.localeCompare(b.host) || a.file.localeCompare(b.file))
  if (!contracts.length) return { action: "idle", reason: "no unclaimed audited contracts" }
  const first = contracts[0]
  if (!first.supported) return { action: "paused", reason: `unsupported contract type: ${first.type}`, contract: first }
  if (Number(first.triesRemaining) < minTries) {
    return { action: "paused", reason: `tries below guard (${first.triesRemaining}/${minTries}): ${first.host}/${first.file}`, contract: first }
  }
  return { action: "submit", reason: "supported contract meets attempt guard", contract: first }
}

export function shouldRequestMcpRecovery({ now, mcp, previous, cooldownMs = 15 * 60 * 1000 }) {
  const stale = !Number.isFinite(mcp?.ts) || now - mcp.ts > 90_000
  if (!stale) return false
  if (!previous?.mcpStaleSince) return false
  if (now - previous.mcpStaleSince < 60_000) return false
  return !Number.isFinite(previous?.lastRecoveryAt) || now - previous.lastRecoveryAt >= cooldownMs
}
