/**
 * Pure helpers for metrics_logger.js: build one metrics sample from raw
 * readings, and decide when the bounded log needs trimming.
 */

export const STALE_MS = 10 * 60_000
export const SKILLS = ["hacking", "strength", "defense", "dexterity", "agility", "charisma"]
export const EXP = ["hacking", "strength", "defense", "dexterity", "agility"]
export const INCOME = ["hacking", "servers", "augmentations", "darknet", "codingcontract", "total"]

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)
const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, num(obj?.[k])]))

/** Age in seconds of a status file, or null when it has no usable ts. */
function ageS(now, file) {
  const ts = Number(file?.ts)
  return Number.isFinite(ts) && ts > 0 ? Math.round((now - ts) / 1000) : null
}

/** A status file is fresh when it exists and its ts is within STALE_MS. */
export function fresh(now, file, staleMs = STALE_MS) {
  const age = ageS(now, file)
  return age !== null && age * 1000 <= staleMs
}

/** Faction/company name from a getCurrentWork-shaped record. */
export function workSummary(work) {
  if (!work || !work.type) return null
  return {
    type: work.type,
    faction: work.factionName ?? null,
    company: work.companyName ?? null,
    detail: work.factionWorkType ?? work.classType ?? work.crimeType ?? null,
  }
}

/**
 * One sample. Stale or missing sources leave their fields null and are listed
 * in `stale` with their age in seconds (null age = missing), never copied.
 */
export function buildSample({ now, resetAt, money, sources, player, sharePower, readiness, activity, mcp, ram, staleMs = STALE_MS }) {
  const stale = {}
  const readyOk = fresh(now, readiness, staleMs)
  const actOk = fresh(now, activity, staleMs)
  const mcpOk = fresh(now, mcp, staleMs)
  if (!readyOk) stale.readiness = ageS(now, readiness)
  if (!actOk) stale.activity = ageS(now, activity)
  if (!mcpOk) stale.mcp = ageS(now, mcp)
  const favor = readyOk
    ? Object.fromEntries(Object.entries(readiness.favor || {}).map(([f, v]) => [f, num(typeof v === "object" ? v?.favor : v)]))
    : null
  return {
    ts: now,
    resetAt: num(resetAt) ?? (readyOk ? num(readiness.resetAt) : null),
    money: num(money),
    income: pick(sources, INCOME),
    skills: pick(player?.skills, SKILLS),
    exp: pick(player?.exp, EXP),
    karma: num(player?.karma),
    city: player?.city ?? null,
    sharePower: num(sharePower),
    work: actOk ? workSummary(activity.currentWork) : null,
    reason: actOk ? activity.decision?.reason ?? null : null,
    factionRep: readyOk ? pick(readiness.factionRep, Object.keys(readiness.factionRep || {})) : null,
    favor,
    installedCount: readyOk ? num(readiness.installedCount) : null,
    queuedCount: readyOk ? num(readiness.queuedCount) : null,
    verdict: readyOk ? readiness.advice?.verdict ?? null : null,
    mcpRate: mcpOk ? num(mcp.rate) : null,
    mcpAvgRate: mcpOk ? num(mcp.avgRate) : null,
    ramMax: num(ram?.max),
    ramUsed: num(ram?.used),
    stale,
  }
}

/**
 * Trimmed log text keeping the last `keep` lines, or null when the log is
 * within keep + slack lines (no rewrite needed). Slack avoids a rewrite on
 * every append.
 */
export function trimLog(text, keep, slack = 0) {
  const lines = String(text || "").split("\n").filter(Boolean)
  if (lines.length <= keep + slack) return null
  return lines.slice(-keep).join("\n") + "\n"
}

/** Milliseconds until the next multiple of intervalMs on the wall clock. */
export function msToNextTick(now, intervalMs) {
  const rem = now % intervalMs
  return rem === 0 ? intervalMs : intervalMs - rem
}
