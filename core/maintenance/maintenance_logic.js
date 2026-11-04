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
  // A held low-attempt contract must not deadlock every later, independently
  // safe contract. Keep it visible in the eventual paused result, but claim
  // the first fingerprinted, supported item that meets the active guard.
  const eligible = contracts.find((contract) => contract.supported && Number(contract.triesRemaining) >= minTries)
  if (eligible) return { action: "submit", reason: "supported contract meets attempt guard", contract: eligible }

  const unsupported = contracts.find((contract) => !contract.supported)
  if (unsupported) return { action: "paused", reason: `unsupported contract type: ${unsupported.type}`, contract: unsupported }
  const held = contracts[0]
  return { action: "paused", reason: `tries below guard (${held.triesRemaining}/${minTries}): ${held.host}/${held.file}`, contract: held }
}

export function shouldRequestMcpRecovery({ now, mcp, previous, cooldownMs = 15 * 60 * 1000 }) {
  const stale = !Number.isFinite(mcp?.ts) || now - mcp.ts > 90_000
  if (!stale) return false
  if (!previous?.mcpStaleSince) return false
  if (now - previous.mcpStaleSince < 60_000) return false
  return !Number.isFinite(previous?.lastRecoveryAt) || now - previous.lastRecoveryAt >= cooldownMs
}
