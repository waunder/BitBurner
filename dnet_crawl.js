/**
 * Lean transient Dark Net crawler. Unlike the 15GB home controller, this
 * process carries only discovery, authentication, remote RAM preparation,
 * propagation, credential durability, and a final handoff to dnet_manager.
 * It performs one pass and exits, releasing its RAM to the local farm.
 *
 * @param {NS} ns
 */
const CREDS_FILE = "dnet_creds.txt"
const CRED_PREFIX = "dnet_cred_"
const DEPLOYER_PREFIX = "dnet_deployer_"
const SELF = "dnet_crawl.js"
const MANAGER = "dnet_manager.js"
const REALLOC = "dnet_realloc.js"
const FILES = [SELF, MANAGER, REALLOC, "dnet_lib.js", "dnet_loot.js", "dnet_loot_realloc.js", "dnet_phish.js"]

// Concurrency cap (2026-08-30) — constants/logic duplicated from
// dnet_lib.js rather than imported, same reason this whole file avoids that
// import already (the header comment's "avoiding the all-purpose library's
// 10GB static-analysis charge"): see dnet_lib.js's own MAX_ACTIVE_MANAGERS
// comment for the incident this fixes. Keep this logic identical to
// dnet_lib.js's canSpawnManager/writeManagerActiveShard — dnet_lib.test.js
// covers the shared behavior those are copied from, AND asserts these
// duplicated values below stay in sync with dnet_lib.js's real exports
// (found the hard way: this value drifted to a stale 15 the same day
// dnet_lib.js's own MAX_ACTIVE_MANAGERS was retuned to 8, in the very next
// edit — the guard test exists so that never ships unnoticed again).
// Exported (not just local) purely so dnet_lib.test.js can import and
// directly compare these against dnet_lib.js's real values instead of
// regex/eval-parsing this file's source — see that test's own comment.
// Bitburner's RAM accounting is driven by which ns-touching functions get
// called, not by which plain constants a leaf script happens to export, and
// nothing else in-game imports this file, so this costs nothing live.
export const MAX_ACTIVE_MANAGERS = 8
export const MANAGER_REGISTRY_FILE = "dnet_manager_registry.json"
export const MANAGER_SHARD_PREFIX = "dnet_manager_active_"
export const MANAGER_STALE_MS = 5 * 60 * 1000

function safeHost(host) {
  let safe = ""
  for (const ch of String(host)) safe += /[A-Za-z0-9_-]/.test(ch) ? ch : "x" + ch.codePointAt(0).toString(16)
  return safe.slice(0, 80)
}

function canSpawnManager(ns) {
  let registry = {}
  try {
    const raw = ns.read(MANAGER_REGISTRY_FILE)
    if (raw) registry = JSON.parse(raw)
  } catch { /* missing/corrupt local registry snapshot — treat as empty */ }
  const now = Date.now()
  let active = 0
  for (const ts of Object.values(registry)) {
    if (typeof ts === "number" && now - ts < MANAGER_STALE_MS) active++
  }
  return active < MAX_ACTIVE_MANAGERS
}

function writeManagerActiveShard(ns, host) {
  const shard = `${MANAGER_SHARD_PREFIX}${safeHost(host)}.json`
  ns.write(shard, JSON.stringify({ ts: Date.now(), host }), "w")
  return shard
}

function readCreds(ns) {
  const creds = {}
  for (const line of String(ns.read(CREDS_FILE) || "").split("\n")) {
    try {
      const rec = JSON.parse(line)
      if (typeof rec?.host === "string" && typeof rec?.password === "string") creds[rec.host] = rec
    } catch { /* tolerate a killed writer's partial line */ }
  }
  return creds
}

function candidates(details) {
  const hint = typeof details.passwordHint === "string" ? details.passwordHint : ""
  const data = typeof details.data === "string" ? details.data : ""
  switch (details.modelId) {
    case "ZeroLogon": return [""]
    case "FreshInstall_1.0": return ["admin", "password", "0000", "12345"]
    case "DeskMemo_3.1": return [hint.trim().split(/\s+/).pop()].filter(Boolean)
    case "CloudBlare(tm)": return [data.replace(/\D/g, "")].filter(Boolean)
    case "Laika4": return ["fido", "spot", "rover", "max"]
    case "AccountsManager_4.2": {
      const upper = Math.ceil((10 * ((details.difficulty ?? 0) + 3)) / 3)
      return Array.from({ length: upper }, (_, i) => String(i))
    }
    case "Pr0verFl0": return Number.isInteger(details.passwordLength) ? ["A".repeat(2 * details.passwordLength)] : []
    case "PHP 5.4": return uniquePermutations(data)
    default: return []
  }
}

function uniquePermutations(text) {
  text = String(text)
  if (!text || text.length > 3) return text ? [text] : []
  const out = []
  const visit = (prefix, rest) => {
    if (!rest) return void out.push(prefix)
    const used = new Set()
    for (let i = 0; i < rest.length; i++) {
      if (used.has(rest[i])) continue
      used.add(rest[i])
      visit(prefix + rest[i], rest.slice(0, i) + rest.slice(i + 1))
    }
  }
  visit("", text)
  return out
}

async function acquireSession(ns, host, known, bruteForceLimit) {
  let details
  try { details = ns.dnet.getServerDetails(host) } catch (err) {
    return { ok: false, why: "invalid host", error: String(err), tried: 0 }
  }
  if (!details.isOnline) return { ok: false, why: "offline", tried: 0 }
  if (details.hasSession) return { ok: true, password: known?.password, details, tried: 0 }
  if (known && typeof known.password === "string") {
    const reused = ns.dnet.connectToSession(host, known.password)
    if (reused.success) return { ok: true, password: known.password, details, tried: 0 }
  }
  if (!details.isConnectedToCurrentServer) return { ok: false, why: "not directly connected", tried: 0 }
  const guesses = candidates(details)
  if (bruteForceLimit > 0 && guesses.length > bruteForceLimit) guesses.length = bruteForceLimit
  let tried = 0
  for (const password of guesses) {
    const result = await ns.dnet.authenticate(host, password)
    tried++
    if (result.success) return { ok: true, password, details, tried }
    if (result.code === 408) {
      const retry = await ns.dnet.authenticate(host, password)
      tried++
      if (retry.success) return { ok: true, password, details, tried }
    }
  }
  return { ok: false, why: guesses.length ? "candidates rejected" : `no shallow solver for ${details.modelId}`, tried }
}

function recordCred(ns, host, password, model) {
  const rec = JSON.stringify({ host, password, model: model ?? "", at: Date.now() })
  ns.write(CREDS_FILE, rec + "\n", "a")
  const shard = `${CRED_PREFIX}${safeHost(host)}.txt`
  ns.write(shard, rec + "\n", "w")
  return shard
}

function writeHeartbeat(ns, host, patch) {
  const shard = `${DEPLOYER_PREFIX}${safeHost(host)}.json`
  ns.write(shard, JSON.stringify({ ts: Date.now(), ...patch }, null, 2), "w")
  return shard
}

async function prepareTarget(ns, target) {
  const source = ns.getHostname()
  const workerRam = ns.getScriptRam(REALLOC, source)
  const freeRam = ns.getServerMaxRam(source) - ns.getServerUsedRam(source)
  const threads = workerRam > 0 ? Math.floor(freeRam / workerRam) : 0
  if (threads < 1) return { ok: false, before: ns.dnet.getBlockedRam(target), after: ns.dnet.getBlockedRam(target), threads: 0 }
  const before = ns.dnet.getBlockedRam(target)
  const pid = ns.exec(REALLOC, source, { threads, preventDuplicates: true }, target)
  while (pid && ns.isRunning(pid)) await ns.sleep(250)
  const after = ns.dnet.getBlockedRam(target)
  return { ok: after <= 0, before, after, threads }
}

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
    const result = await acquireSession(ns, target, known, flags.brute)
    if (!result.ok) {
      summary.failed++
      if (!flags.quiet) ns.print(`FAIL ${target} why=${result.why} code=${result.code}`)
      continue
    }
    summary.sessions++

    let details
    try {
      details = result.details ?? ns.dnet.getServerDetails(target)
    } catch (err) {
      summary.failed++
      if (!flags.quiet) ns.print(`DETAILS-FAIL ${target}: ${err}`)
      continue
    }
    if (typeof result.password === "string" && known?.password !== result.password) {
      summary.cracked++
      creds[target] = { host: target, password: result.password, model: details.modelId, at: Date.now() }
      const shard = recordCred(ns, target, result.password, details.modelId)
      await ns.scp(shard, "home")
    }

    if (details.blockedRam > 0) {
      const prep = await prepareTarget(ns, target)
      if (prep.after < prep.before) summary.prepared++
      if (prep.after > 0) {
        if (!flags.quiet) ns.print(`PREP-WAIT ${target} before=${prep.before} after=${prep.after} why=${prep.why}`)
        continue
      }
    }

    const files = [...FILES]
    if (ns.fileExists(CREDS_FILE)) files.push(CREDS_FILE)
    if (ns.fileExists(MANAGER_REGISTRY_FILE)) files.push(MANAGER_REGISTRY_FILE)
    try {
      if (!(await ns.scp(files, target))) {
        summary.failed++
        continue
      }
      const pid = ns.exec(SELF, target, { preventDuplicates: true })
      if (pid !== 0) summary.deployed++
      else summary.failed++
    } catch (err) {
      summary.failed++
      if (!flags.quiet) ns.print(`SPREAD-FAIL ${target}: ${err}`)
    }
  }

  const crawlRam = ns.getScriptRam(SELF, host)
  const managerRam = ns.getScriptRam(MANAGER, host)
  const phishRam = ns.getScriptRam("dnet_phish.js", host)
  const maxRam = ns.getServerMaxRam(host)
  const blockedRam = ns.dnet.getBlockedRam(host)
  const farmCapacityThreads = phishRam > 0 ? Math.max(0, Math.floor((maxRam - blockedRam - managerRam) / phishRam)) : 0
  // Concurrency cap (2026-08-30): read locally (pushed in above alongside
  // CREDS_FILE), never a remote read — see dnet_lib.js's MAX_ACTIVE_MANAGERS
  // comment for why this exists. A stale/missing snapshot (this host's very
  // first-ever push, or an out-of-date one from a few hops back) fails open
  // toward allowing the spawn — undercounting is the safe direction here,
  // since the home-side merge in dnet_root.js is the actual source of truth
  // and will catch up on its next 5s pass regardless of what this one host
  // decided.
  const spawnManager = canSpawnManager(ns)
  if (spawnManager) {
    const managerShard = writeManagerActiveShard(ns, host)
    await ns.scp(managerShard, "home")
  }
  const shard = writeHeartbeat(ns, host, {
    host,
    pass: 1,
    scopeNote: "lean transient crawl; manager periodically refreshes this host",
    visibleFromHost: summary.seen,
    thisPass: summary,
    sinceProcessStart: summary,
    localKnownCreds: Object.keys(creds).length,
    instability: ns.dnet.getDarknetInstability(),
    role: spawnManager ? "transient-crawler" : "declined-cap",
    ramCosts: { crawlRam, managerRam, phishRam, maxRam, blockedRam },
    farmCapacityThreads,
  })
  await ns.scp(shard, "home")

  if (!spawnManager) return // over the concurrency cap — release RAM, stay non-resident

  // spawn replaces this process after releasing its RAM, so the manager is
  // never forced to coexist with the transient crawler during handoff.
  ns.spawn(MANAGER, { threads: 1, preventDuplicates: true, spawnDelay: 100 })
}

export function autocomplete() {
  return ["--brute", "--quiet"]
}
