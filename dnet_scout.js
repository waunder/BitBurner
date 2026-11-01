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
import { SCOUT_STATUS, rankHops } from "dnet_scout_logic.js"

const LAB_WORKER = "dnet_lab.js"
const FILES = ["dnet_scout.js", "dnet_scout_logic.js", "dnet_lib.js", LAB_WORKER, "dnet_lab_logic.js", "dnet_loot.js"]
const SESSION_BUDGET_MS = 60_000
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

async function workLab(ns, lab) {
  const host = ns.getHostname()
  const required = ns.dnet.getServerRequiredCharismaLevel(lab)
  const charisma = ns.getPlayer().skills.charisma
  const ram = ns.getScriptRam(LAB_WORKER, host)
  const threads = ram > 0 ? Math.floor((ns.getServerMaxRam(host) - ns.getServerUsedRam(host)) / ram) : 0
  const pid = charisma >= required && threads > 0 ? ns.exec(LAB_WORKER, host, { threads, preventDuplicates: true }, lab) : 0
  return { lab, required, charisma, threads, pid }
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
  const hopTo = async (target, nextPath) => {
    const files = ns.fileExists(CREDS_FILE) ? [...FILES, CREDS_FILE] : FILES
    if (!(await ns.scp(files, target))) return 0
    return ns.exec("dnet_scout.js", target, { preventDuplicates: true }, "--path", JSON.stringify(nextPath), "--seen", JSON.stringify(seen), "--hops", flags.hops - 1)
  }

  const neighbours = neighbourDetails(ns)
  report("scouting", { neighbours: neighbours.length })
  const lab = neighbours.find(n => n.host.endsWith("l4byr1nth"))
  if (lab) return report("lab-found", await workLab(ns, lab.host))
  if (flags.hops <= 0) return report("hop-limit")

  const creds = readCreds(ns)
  const failures = []
  for (const next of rankHops(neighbours, seen).slice(0, MAX_TRIES)) {
    const session = await acquireSession(ns, next.host, creds[next.host], { bruteForceLimit: BRUTE_LIMIT, timeBudgetMs: SESSION_BUDGET_MS })
    if (!session.ok) {
      failures.push({ host: next.host, depth: next.depth, model: next.modelId, why: session.why, code: session.code })
      if (session.code === CODE.NotEnoughCharisma) return report("charisma", { failures })
      continue
    }
    if (typeof session.password === "string" && creds[next.host]?.password !== session.password) {
      shipCred(ns, recordCred(ns, next.host, session.password, next.modelId))
    }
    if (next.blockedRam > 0) await freeBlockedRam(ns, next.host, 25, false)
    if (await hopTo(next.host, path)) return report("hopped", { next: next.host, nextDepth: next.depth, failures })
    failures.push({ host: next.host, depth: next.depth, why: "scout did not fit" })
  }
  const back = path.at(-2)
  if (back) {
    const session = await acquireSession(ns, back, creds[back], { timeBudgetMs: SESSION_BUDGET_MS })
    if (session.ok && await hopTo(back, path.slice(0, -2))) return report("backtracked", { next: back, failures })
  }
  report("dead-end", { neighbours: neighbours.length, failures })
}
