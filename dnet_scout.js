/**
 * Single-process deep darknet scout. It cracks the deepest neighbour it can,
 * copies itself there, starts that copy and exits, so one process exists at a
 * time and nothing stays resident. When a labyrinth is a neighbour it reports
 * the route and starts dnet_lab.js if charisma qualifies.
 *
 * Start: dnet_root.js launches it on darkweb when the last status is stale.
 * Args: --path <json route from darkweb>, --seen <json hosts already tried>,
 * --hops <remaining hops>. A dead end hops back along the path, so the chain
 * walks the tree depth-first.
 * @param {NS} ns
 */
import { CODE, CREDS_FILE, acquireSession, freeBlockedRam, readCreds, recordCred, shipCred } from "dnet_lib.js"
import { SCOUT_STATUS, rankHops, shouldAnchor } from "dnet_scout_logic.js"

const LAB_WORKER = "dnet_lab.js"
const ANCHOR = "dnet_anchor.js"
const ANCHOR_RAM = 14.2 // Fixed so the scout saves getScriptRam's 0.1GB: darkweb has little to spare.
const ANCHOR_WAIT_MS = 60_000
const FILES = [ANCHOR, "dnet_scout.js", "dnet_scout_logic.js", "dnet_lib.js", LAB_WORKER, "dnet_lab_logic.js", "dnet_loot.js"]
const SESSION_BUDGET_MS = 180_000
const BRUTE_LIMIT = 2000
const MAX_HOPS = 60
const MAX_TRIES = 4

function neighbourDetails(ns) {
  const out = []
  for (const host of ns.dnet.probe()) {
    try { out.push({ host, ...ns.dnet.getServerDetails(host) }) } catch { /* moved between calls */ }
  }
  return out
}

export async function main(ns) {
  ns.disableLog("ALL")
  const flags = ns.flags([["path", "[]"], ["seen", "[]"], ["hops", MAX_HOPS]])
  const host = ns.getHostname()
  const path = [...JSON.parse(flags.path), host]
  const seen = [...new Set([...JSON.parse(flags.seen), host])]
  const depth = ns.dnet.getServerDetails(host).depth
  const report = (state, extra = {}) => {
    ns.write(SCOUT_STATUS, JSON.stringify({ ts: Date.now(), state, host, depth, path, seen: seen.length, ...extra }), "w")
    ns.scp(SCOUT_STATUS, "home")
  }
  // Returns the new pid, or 0 with the failing stage in lastHop. exec needs a direct
  // link, which can move while a crack runs; scp needs only the session.
  let lastHop = {}
  const hopTo = async (target, nextPath) => {
    const files = ns.read(CREDS_FILE) ? [...FILES, CREDS_FILE] : FILES
    if (!(await ns.scp(files, target))) { lastHop = { stage: "scp" }; return 0 }
    const pid = ns.exec("dnet_scout.js", target, { preventDuplicates: true }, "--path", JSON.stringify(nextPath), "--seen", JSON.stringify(seen), "--hops", flags.hops - 1)
    if (!pid) lastHop = { stage: "exec", connected: ns.dnet.probe().includes(target) && ns.dnet.getServerDetails(target).isConnectedToCurrentServer }
    return pid
  }
  // Why a hop failed: too small, or full, tells us which fix is worth building.
  const fit = target => ({ maxRam: ns.getServerMaxRam(target), usedRam: ns.getServerUsedRam(target), blockedRam: ns.dnet.getBlockedRam(target) })
  // getStasisLinkedServers is free, unlike isRunning, so it doubles as the done signal.
  const runAnchor = async (target, linked, ...args) => {
    if (!ns.exec(ANCHOR, target, 1, ...args)) return false
    const deadline = Date.now() + ANCHOR_WAIT_MS
    while (ns.dnet.getStasisLinkedServers().includes(target) !== linked && Date.now() < deadline) await ns.sleep(1000)
    return ns.dnet.getStasisLinkedServers().includes(target) === linked
  }
  // Moves the one stasis link down to a deeper host, so the next chain starts there.
  const moveAnchor = async (target, targetDepth, creds) => {
    const free = ns.getServerMaxRam(target) - ns.getServerUsedRam(target)
    const [old] = ns.dnet.getStasisLinkedServers()
    const oldDepth = old ? ns.dnet.getServerDetails(old).depth : undefined
    if (!shouldAnchor(oldDepth, targetDepth, free, ANCHOR_RAM)) return false
    if (old && (!ns.dnet.connectToSession(old, creds[old]?.password ?? "").success || !(await runAnchor(old, false, "--unlink")))) return false
    return runAnchor(target, true)
  }

  const neighbours = neighbourDetails(ns)
  report("scouting", { neighbours: neighbours.length })
  const lab = neighbours.find(n => n.host.endsWith("l4byr1nth"))
  // dnet_lab.js reports charisma itself, so the scout stays small enough to hop.
  if (lab) return report("lab-found", { lab: lab.host, pid: ns.exec(LAB_WORKER, host, { preventDuplicates: true }, lab.host) })
  if (flags.hops <= 0) return report("hop-limit")

  const creds = readCreds(ns)
  const failures = []
  // Links move during a crack, so each try re-reads the neighbours.
  const tried = new Set(seen)
  // No variable named "attempt": the game's RAM check bills it as codingcontract.attempt, 10GB.
  for (let tryCount = 0; tryCount < MAX_TRIES; tryCount++) {
    const next = rankHops(neighbourDetails(ns), tried)[0]
    if (!next) break
    tried.add(next.host)
    report("cracking", { target: next.host, targetDepth: next.depth, model: next.modelId })
    const session = await acquireSession(ns, next.host, creds[next.host], { bruteForceLimit: BRUTE_LIMIT, timeBudgetMs: SESSION_BUDGET_MS })
    if (!session.ok) {
      failures.push({ host: next.host, depth: next.depth, model: next.modelId, why: session.why, code: session.code })
      if (session.code === CODE.NotEnoughCharisma) return report("charisma", { failures })
      continue
    }
    if (typeof session.password === "string" && creds[next.host]?.password !== session.password) {
      shipCred(ns, recordCred(ns, next.host, session.password, next.modelId))
    }
    // Links move, so try the hop first and clear blocked RAM only if it failed.
    if (await ns.scp(FILES, next.host) && await moveAnchor(next.host, next.depth, creds)) report("anchored", { target: next.host, targetDepth: next.depth })
    let pid = await hopTo(next.host, path)
    if (!pid && next.blockedRam > 0) {
      await freeBlockedRam(ns, next.host, 25, false)
      pid = await hopTo(next.host, path)
    }
    if (pid) return report("hopped", { next: next.host, nextDepth: next.depth, failures })
    failures.push({ host: next.host, depth: next.depth, why: "hop refused", ...lastHop, ...fit(next.host) })
  }
  const back = path.at(-2)
  if (back) {
    const session = await acquireSession(ns, back, creds[back], { timeBudgetMs: SESSION_BUDGET_MS })
    if (session.ok && await hopTo(back, path.slice(0, -2))) return report("backtracked", { next: back, failures })
    failures.push({ host: back, stage: "backtrack", why: session.ok ? "hop refused" : session.why, code: session.code, ...(session.ok ? { ...lastHop, ...fit(back) } : {}) })
  }
  report("dead-end", { neighbours: neighbours.length, failures })
}
