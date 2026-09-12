/** A single bounded share allocation; leftover RAM remains available to MCP. */
export const SHARE_FILE = "mcp_share.js"
export const REPUTATION_CONFIG = "reputation_config.json"
export const MAX_SHARE_RAM_GB = 256
const RETRY_MS = 60_000
const ACTIONS = new Set(["scripts/hack.js", "scripts/grow.js", "scripts/weaken.js"])

export function readReputationConfig(ns) {
  try {
    const x = JSON.parse(ns.read(REPUTATION_CONFIG) || "{}")
    if (typeof x.enabled !== "boolean" || !Number.isFinite(x.ramGb) || x.ramGb <= 0 || x.ramGb > MAX_SHARE_RAM_GB) {
      return { enabled: false, ramGb: 0, error: "Invalid reputation configuration" }
    }
    return x
  } catch { return { enabled: false, ramGb: 0, error: "Unreadable reputation configuration" } }
}

export function chooseShareHost(hosts, scriptRam, budget) {
  if (!(scriptRam > 0) || !(budget > 0)) return null
  return hosts.map(x => ({ ...x, threads: Math.floor(Math.min(x.availableRam, budget, MAX_SHARE_RAM_GB) / scriptRam) }))
    .filter(x => x.threads > 0)
    .sort((a, b) => b.threads - a.threads || a.host.localeCompare(b.host))[0] || null
}

export async function reconcileReputation(ns, prior, { objective, hosts, reserveHomeGb, runId, emit }) {
  const now = Date.now()
  const config = readReputationConfig(ns)
  const desired = objective === "reputation" && config.enabled
  const state = { ...prior, ts: now, requested: objective === "reputation", config,
    factionWork: "unverified: sharing only benefits active faction work; choose it in the game",
    power: ns.getSharePower(), maxRamGb: MAX_SHARE_RAM_GB }
  // Only this module's uniquely named workers are owned, never legacy share.js.
  const owned = hosts.flatMap(host => ns.ps(host).filter(p => p.filename.replace(/^\//, "") === SHARE_FILE).map(p => ({ ...p, host })))
  const signature = `${runId}:${config.ramGb}`
  const scriptRam = ns.getScriptRam(SHARE_FILE, "home")
  for (const p of owned) {
    if (!desired || Number(p.args[0]) !== ns.pid || p.args[1] !== signature || owned.length > 1 || !(scriptRam > 0) || p.threads * scriptRam > Math.min(config.ramGb, MAX_SHARE_RAM_GB)) {
      if (!ns.kill(p.pid)) throw new Error(`Could not retire reputation worker ${p.pid}`)
      emit("reputation_stop", { actionId: `${runId}:share-stop:${p.pid}`, host: p.host, pid: p.pid, objective, config })
    }
  }
  if (!desired) return { ...state, state: state.requested ? "blocked" : "off", pid: null, threads: 0, ramGb: 0,
    retryAt: 0, reason: config.error || (state.requested ? "Historical share stability restriction; sharing disabled" : "Objective is not reputation") }
  const live = owned.find(p => Number(p.args[0]) === ns.pid && p.args[1] === signature && ns.isRunning(p.pid))
  if (live) return { ...state, state: "sharing", host: live.host, pid: live.pid, threads: live.threads,
    ramGb: live.threads * ns.getScriptRam(SHARE_FILE, "home"), reason: state.factionWork }
  if (now < (prior.retryAt || 0)) return { ...state, state: "waiting", pid: null, threads: 0, ramGb: 0 }
  const candidates = hosts.map(host => {
    const reclaim = ns.ps(host).filter(p => ACTIONS.has(p.filename.replace(/^\//, "")))
      .reduce((n, p) => n + p.threads * ns.getScriptRam(p.filename, host), 0)
    return { host, availableRam: Math.max(0, ns.getServerMaxRam(host) - ns.getServerUsedRam(host) + reclaim - (host === "home" ? reserveHomeGb : 0)) }
  })
  const choice = chooseShareHost(candidates, scriptRam, config.ramGb)
  const actionId = `${runId}:share-start:${now}`
  if (!choice) {
    emit("reputation_wait", { actionId, reason: "No capacity or missing worker source", scriptRam, config, candidates })
    return { ...state, state: "waiting", reason: "No capacity or missing worker source", retryAt: now + RETRY_MS, threads: 0, ramGb: 0 }
  }
  if (choice.host !== "home" && !(await ns.scp(SHARE_FILE, choice.host, "home"))) throw new Error(`Share source copy failed: ${choice.host}`)
  // Free only this host's MCP action allocation; MCP replans the remainder.
  for (const p of ns.ps(choice.host)) if (ACTIONS.has(p.filename.replace(/^\//, "")) && !ns.kill(p.pid)) throw new Error(`Could not release worker ${p.pid}`)
  const pid = ns.exec(SHARE_FILE, choice.host, choice.threads, ns.pid, signature)
  emit("reputation_start", { actionId, host: choice.host, threads: choice.threads, ramGb: choice.threads * scriptRam, pid, config, candidates })
  if (!pid) throw new Error(`Share launch failed: ${choice.host}`)
  return { ...state, state: "sharing", host: choice.host, pid, threads: choice.threads, ramGb: choice.threads * scriptRam,
    retryAt: now + RETRY_MS, startedAt: now, reviewAt: now + 30 * 60_000, reason: state.factionWork,
    roi: { baselinePower: state.power, marginalReputation: null, confidence: "unmeasured", opportunityCost: "Reserved RAM cannot earn hacking money or XP", stopRule: "Stop on objective change, disabled policy or owner exit; review after 30 minutes" } }
}
