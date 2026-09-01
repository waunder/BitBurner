/**
 * Read-only coding-contract inventory. It never calls attempt(), so it is
 * safe to run before any solver has earned trust.
 *
 * @param {NS} ns
 */
const OUTPUT = "cct_inventory.json"

export function contractFingerprint(type, data) {
  const text = `${type}\n${JSON.stringify(data)}`
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`
}

function scanAll(ns) {
  const seen = new Set(["home"])
  const queue = ["home"]
  while (queue.length) {
    const host = queue.shift()
    for (const next of ns.scan(host)) {
      if (!seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }
  return [...seen]
}

export async function main(ns, quiet = false) {
  ns.disableLog("ALL")
  const contracts = []
  const inaccessible = []

  for (const host of scanAll(ns)) {
    if (!ns.hasRootAccess(host)) {
      inaccessible.push(host)
      continue
    }
    for (const file of ns.ls(host, ".cct")) {
      try {
        const type = ns.codingcontract.getContractType(file, host)
        const data = ns.codingcontract.getData(file, host)
        contracts.push({
          host,
          file,
          type,
          data,
          fingerprint: contractFingerprint(type, data),
          description: ns.codingcontract.getDescription(file, host),
          triesRemaining: ns.codingcontract.getNumTriesRemaining(file, host),
        })
      } catch (error) {
        contracts.push({ host, file, error: String(error) })
      }
    }
  }

  const byType = {}
  for (const c of contracts) {
    const key = c.type ?? "unreadable"
    byType[key] = (byType[key] ?? 0) + 1
  }
  const report = {
    ts: Date.now(),
    mode: "read-only",
    contracts,
    byType,
    hostsScanned: scanAll(ns).length,
    inaccessibleHosts: inaccessible,
  }
  ns.write(OUTPUT, JSON.stringify(report, null, 2), "w")
  if (!quiet && !ns.args.some((arg) => String(arg) === "--quiet")) {
    ns.tprint(`cct_audit: ${contracts.length} contract(s), ${Object.keys(byType).length} type(s); no submissions made.`)
  }
}
