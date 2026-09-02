/** One-shot purchased worker-server provisioner; MCP deploys work itself. */
const STATUS_FILE = "purchased_worker_status.json"

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  const ram = Number(ns.args[0] ?? 32)
  const validRam = Number.isInteger(ram) && ram >= 2 && (ram & (ram - 1)) === 0
  const money = ns.getServerMoneyAvailable("home")
  const cost = validRam ? ns.cloud.getServerCost(ram) : null
  const existing = ns.cloud.getServerNames()
  let result = { ts: Date.now(), ram, money, cost, existing: existing.length, purchased: null, reason: null }
  if (!validRam) result.reason = "RAM must be a power of two of at least 2GB"
  else if (existing.length >= ns.cloud.getServerLimit()) result.reason = "purchased-server limit reached"
  else if (!(Number.isFinite(cost) && money >= cost)) result.reason = "insufficient funds"
  else {
    const hostname = ns.cloud.purchaseServer(`mcp-worker-${existing.length}`, ram)
    if (hostname) result.purchased = hostname
    else result.reason = "purchase API returned no hostname"
  }
  ns.write(STATUS_FILE, JSON.stringify(result, null, 2), "w")
  ns.tprint(`purchase_worker_server: ${result.purchased ? `bought ${result.purchased} (${ram}GB)` : `no purchase (${result.reason})`}`)
}
