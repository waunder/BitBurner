/**
 * Lean transient Dark Net crawler. Unlike the 15GB home controller, this
 * process carries only discovery, authentication, remote RAM preparation,
 * propagation, credential durability, and a final handoff to dnet_manager.
 * It performs one pass and exits, releasing its RAM to the local farm.
 *
 * @param {NS} ns
 */
import {
  CREDS_FILE,
  acquireSession,
  freeBlockedRam,
  readCreds,
  recordCred,
  shipCred,
  shipShard,
  writeDeployerShard,
} from "dnet_lib.js"

const SELF = "dnet_crawl.js"
const MANAGER = "dnet_manager.js"
const FILES = [SELF, MANAGER, "dnet_lib.js", "dnet_loot.js", "dnet_loot_realloc.js", "dnet_phish.js"]

export async function main(ns) {
  ns.disableLog("ALL")
  const flags = ns.flags([
    ["brute", 0],
    ["quiet", false],
  ])
  const host = ns.getHostname()
  const creds = readCreds(ns)
  const neighbours = ns.dnet.probe()
  const summary = { seen: neighbours.length, sessions: 0, cracked: 0, prepared: 0, deployed: 0, failed: 0 }

  for (const target of neighbours) {
    const known = creds[target]
    const result = await acquireSession(ns, target, known, { bruteForceLimit: flags.brute })
    if (!result.ok) {
      summary.failed++
      if (!flags.quiet) ns.print(`FAIL ${target} why=${result.why} code=${result.code}`)
      continue
    }
    summary.sessions++

    const details = ns.dnet.getServerDetails(target)
    if (typeof result.password === "string" && known?.password !== result.password) {
      summary.cracked++
      creds[target] = { host: target, password: result.password, model: details.modelId, at: Date.now() }
      const shard = recordCred(ns, target, result.password, details.modelId)
      shipCred(ns, shard)
    }

    if (details.blockedRam > 0) {
      const prep = await freeBlockedRam(ns, target, 25)
      if (prep.after < prep.before) summary.prepared++
      if (prep.after > 0) {
        if (!flags.quiet) ns.print(`PREP-WAIT ${target} before=${prep.before} after=${prep.after} why=${prep.why}`)
        continue
      }
    }

    const files = [...FILES]
    if (ns.fileExists(CREDS_FILE)) files.push(CREDS_FILE)
    try {
      if (!ns.scp(files, target)) continue
      const pid = ns.exec(SELF, target, { preventDuplicates: true })
      if (pid !== 0) summary.deployed++
    } catch (err) {
      if (!flags.quiet) ns.print(`SPREAD-FAIL ${target}: ${err}`)
    }
  }

  const crawlRam = ns.getScriptRam(SELF, host)
  const managerRam = ns.getScriptRam(MANAGER, host)
  const phishRam = ns.getScriptRam("dnet_phish.js", host)
  const maxRam = ns.getServerMaxRam(host)
  const blockedRam = ns.dnet.getBlockedRam(host)
  const farmCapacityThreads = phishRam > 0 ? Math.max(0, Math.floor((maxRam - blockedRam - managerRam) / phishRam)) : 0
  const shard = writeDeployerShard(ns, host, {
    host,
    pass: 1,
    scopeNote: "lean transient crawl; manager periodically refreshes this host",
    visibleFromHost: summary.seen,
    thisPass: summary,
    sinceProcessStart: summary,
    localKnownCreds: Object.keys(creds).length,
    instability: ns.dnet.getDarknetInstability(),
    role: "transient-crawler",
    ramCosts: { crawlRam, managerRam, phishRam, maxRam, blockedRam },
    farmCapacityThreads,
  })
  shipShard(ns, shard)

  const managerPid = ns.run(MANAGER, { preventDuplicates: true })
  if (managerPid === 0) ns.print(`HANDOFF-SKIP ${host}: ${MANAGER} already running or did not fit`)
}

export function autocomplete() {
  return ["--brute", "--quiet"]
}
