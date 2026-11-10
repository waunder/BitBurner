/**
 * Central valuation for every purchase (docs/allocator-design.md). Pure: no ns calls.
 *
 * Unit: batch value (v), the install advisor's weighted log-multiplier gain (augValue). Late in a
 * cycle a dollar spent elsewhere is a dollar missing from the next augmentation batch, which is
 * cash-limited (each aug costs 1.9x the one before). So a purchase of d costs B(C) - B(C - d) in v,
 * where C is the cash projected at the expected install and B is the value of the batch
 * planPurchases would buy with it. Spending that comes out of the leftover the batch cannot use
 * costs nothing.
 *
 * R1 (shadow): allocator.js computes verdicts and logs them beside what the spenders did; no spender
 * reads them yet. `flagFor` and `grantFor` are here, tested, for R2.
 */
import { planPurchases } from "./aug_install_logic.js"

/** Purchase kinds, the keys of valuation_flags.json. */
export const KINDS = ["tor", "programs", "home_ram", "home_cores", "cloud_ram", "sleeve_augs", "sleeve_memory",
  "covenant_sleeve", "gang_gear", "gang_augs", "neuroflux", "donations"]
export const MODES = ["own", "shadow", "valued", "sweep", "never"]
/** Kinds an install wipes: buying them from sweep cash would buy something the install destroys. */
export const WIPED = ["cloud_ram", "sleeve_augs"]
/** Kinds aug_install.js plans as part of the batch; not judged mid-cycle. */
export const BATCH_KINDS = ["neuroflux", "donations"]
/** Augmentations that finish the run but carry no multipliers, so augValue scores them 0. */
export const GATE_AUGS = ["The Red Pill"]
export const GATE_VALUE = 1000
export const PRICE_STEP = 1.9

export const DEFAULTS = {
  earlyCycleHours: 1.5,
  gangMinCycleHours: 4,
  capHours: 12,
  incomeHaircut: 0.25, // projected income counted at 75%: forecasts run optimistic
  costMargin: 0.1, // a purchase is valued as costing 10% more, so small forecast errors do not flip verdicts
  necessityFraction: 0.02,
  necessityFloor: 1e9,
  homeRamFloor: 128,
  homeDemandFloor: 0.5,
  cloudDemandFloor: 0.5,
  ttlSec: 300,
}

/** Settings: DEFAULTS, then capital_policy.json's shared keys, then its `valuation` block. */
export function settings(policy = {}) {
  const shared = {}
  for (const key of ["earlyCycleHours", "homeRamFloor", "homeDemandFloor"]) {
    if (policy[key] !== undefined && policy[key] !== null && Number.isFinite(Number(policy[key]))) shared[key] = Number(policy[key])
  }
  const late = policy.lateCloudDemandFloor ?? policy.cloudDemandFloor
  if (late !== undefined && late !== null && Number.isFinite(Number(late))) shared.cloudDemandFloor = Number(late)
  const own = policy.valuation && typeof policy.valuation === "object" ? policy.valuation : {}
  return { ...DEFAULTS, ...shared, ...own }
}

/**
 * Mode for one purchase kind from valuation_flags.json text. A missing or unreadable file, a missing
 * key, an unknown value, a stamp from another run (or none), and `sweep` on a kind an install wipes
 * all mean `own`: the script's own rule, today's behaviour.
 * @param {string|null} text file contents
 * @param {string} kind
 * @param {number|null} run getResetInfo().lastNodeReset; null skips the run check
 */
export function flagFor(text, kind, run = null) {
  return flagsFor(text, run)[kind] ?? "own"
}

/** Every kind's mode, by the same rules as flagFor. */
export function flagsFor(text, run = null) {
  const out = Object.fromEntries(KINDS.map((kind) => [kind, "own"]))
  let data = null
  try { data = JSON.parse(text || "null") } catch { return out }
  if (!data || typeof data !== "object" || !data.kinds || typeof data.kinds !== "object") return out
  if (run !== null && Number(data.run) !== Number(run)) return out
  for (const kind of KINDS) {
    const mode = data.kinds[kind]
    if (!MODES.includes(mode)) continue
    if (mode === "sweep" && WIPED.includes(kind)) continue
    out[kind] = mode
  }
  return out
}

/** Hours to the expected install, or null when no batch is expected (advisor "build", "unknown",
 * error). The later of the gang's minimum cycle and the advisor's "wait for X", capped at capHours. */
export function expectedInstallHours({ advice = null, cycleHours = 0, gang = false, s = DEFAULTS }) {
  const verdict = advice?.verdict
  if (verdict !== "wait" && verdict !== "install") return null
  const minLeft = gang ? Math.max(0, s.gangMinCycleHours - cycleHours) : 0
  const next = verdict === "wait" && Number(advice?.next?.hours) > 0 ? Number(advice.next.hours) : 0
  return Math.max(0, Math.min(Math.max(minLeft, next), s.capHours - cycleHours))
}

export function projectedCash({ cash = 0, cashPerHour = 0, hours = 0, s = DEFAULTS }) {
  return Math.max(0, cash) + Math.max(0, Number(cashPerHour) || 0) * Math.max(0, hours || 0) * (1 - s.incomeHaircut)
}

function offerValue(offer) {
  return GATE_AUGS.includes(offer.name) ? GATE_VALUE : Math.max(0, Number(offer.value) || 0)
}

/** Offers as they should stand at the install: the gang faction's rep grows at the gang's measured rate. */
export function forecastOffers(offers = [], { gangFaction = null, gangRepPerHour = 0, hours = 0 } = {}) {
  const gain = Math.max(0, Number(gangRepPerHour) || 0) * Math.max(0, hours || 0)
  if (!gangFaction || !(gain > 0)) return offers
  return offers.map((o) => (o.faction === gangFaction ? { ...o, rep: Number(o.rep) + gain } : o))
}

/** Value of the batch planPurchases buys with `money`: { value, plan, cost, left }. */
export function batchValue(offers, owned, money, priority = []) {
  const { plan, left } = planPurchases(offers, owned, Math.max(0, money), PRICE_STEP, priority)
  return { value: plan.reduce((sum, o) => sum + offerValue(o), 0), plan, cost: Math.max(0, money) - left, left }
}

/** v the batch loses if `amount` is spent now. */
export function costInV(offers, owned, money, amount, priority = []) {
  if (!(amount > 0)) return 0
  return batchValue(offers, owned, money, priority).value - batchValue(offers, owned, money - amount, priority).value
}

/**
 * The batch context for this pass. `reserve` is what the projected batch costs; `freeCash` is cash
 * the batch cannot use (its leftover at the install), so spending up to it costs nothing.
 */
export function batchContext({ cash = 0, cashPerHour = 0, hoursSinceInstall = 0, readiness = null, gangRepPerHour = 0, s = DEFAULTS }) {
  const phase = hoursSinceInstall < s.earlyCycleHours ? "early" : "late"
  const offersIn = Array.isArray(readiness?.offers) ? readiness.offers : null
  const hours = expectedInstallHours({ advice: readiness?.advice, cycleHours: hoursSinceInstall, gang: Boolean(readiness?.gangFaction), s })
  const base = { phase, cash, cashPerHour, hours, projected: null, batch: null, reserve: 0, freeCash: cash, marginal: null, offers: [], owned: [], priority: [] }
  if (phase === "early") return { ...base, reason: "early phase: no batch reserve" }
  if (!offersIn) return { ...base, reason: "no offers in augmentation_readiness.json: no batch reserve" }
  if (hours === null) return { ...base, reason: `advisor ${readiness?.advice?.verdict ?? "missing"}: no batch expected` }
  const owned = Array.isArray(readiness.owned) ? readiness.owned : []
  const priority = Array.isArray(readiness.priority) ? readiness.priority : []
  const offers = forecastOffers(offersIn, { gangFaction: readiness.gangFaction, gangRepPerHour, hours })
  const projected = projectedCash({ cash, cashPerHour, hours, s })
  const batch = batchValue(offers, owned, projected, priority)
  if (!(batch.value > 0)) return { ...base, hours, projected, batch: summary(batch), reason: "projected batch has no value: no reserve" }
  // The next aug the batch cannot afford: what the free cash is short of.
  const next = planPurchases(offers, owned, Number.MAX_SAFE_INTEGER, PRICE_STEP, priority).plan[batch.plan.length] || null
  const marginal = next ? { name: next.name, steppedPrice: next.price * PRICE_STEP ** batch.plan.length, value: offerValue(next) } : null
  const freeCash = Math.max(0, Math.min(cash, batch.left))
  return { ...base, hours, projected, batch: summary(batch), reserve: batch.cost, freeCash, marginal, offers, owned, priority,
    reason: `batch of ${batch.plan.length} at projected cash` }
}

function summary(batch) {
  return { value: batch.value, count: batch.plan.length, cost: batch.cost, left: batch.left, names: batch.plan.map((o) => o.name) }
}

/**
 * Verdict on one purchase. req: { kind, cost, cashReturn?, homeRam?, homeDemand? }.
 * Returns { verdict: grant | refuse | sweep | n/a, class, costV, gainV, reason }.
 *  - necessity (TOR, programs, home RAM below the floor or in demand) up to necessityMax: grant;
 *  - home RAM nothing would use: refuse in any phase (the 2026-11-10 14:53 step);
 *  - early phase: grant (rebuild; no batch reserve);
 *  - late: grant if it comes out of free cash, or returns more before the install than the batch
 *    loses; otherwise refuse a wiped kind and send a lasting one to the install sweep.
 */
export function valuePurchase(req, ctx, s = DEFAULTS) {
  const kind = req.kind
  const cost = Math.max(0, Number(req.cost) || 0)
  const out = (verdict, cls, reason, costV = 0, gainV = 0) => ({ verdict, class: cls, costV, gainV, reason })
  if (BATCH_KINDS.includes(kind)) return out("n/a", "batch", "planned with the batch by aug_install.js")
  const necessityMax = Math.max(s.necessityFloor, s.necessityFraction * Math.max(0, ctx.cash))
  let cls = WIPED.includes(kind) ? "wiped" : "lasting"
  if (kind === "tor" || kind === "programs") cls = "necessity"
  if (kind === "home_ram") {
    const needed = Number(req.homeRam) < s.homeRamFloor || Number(req.homeDemand) >= s.homeDemandFloor
    if (!needed) return out("refuse", "zero-value", `home RAM nothing would use: demand ${pct(req.homeDemand)} under ${pct(s.homeDemandFloor)}`)
    cls = "necessity"
  }
  if (cls === "necessity" && cost <= necessityMax) return out("grant", cls, `necessity within ${fmt(necessityMax)}`)
  if (ctx.phase === "early") return out("grant", cls, "early phase: rebuild, no batch reserve")
  if (!ctx.batch || !(ctx.batch.value > 0)) return out("grant", cls, ctx.reason || "no batch reserve")
  const charged = cost * (1 + s.costMargin)
  if (charged <= ctx.freeCash) return out("grant", cls, `out of free cash ${fmt(ctx.freeCash)}: costs the batch nothing`)
  const costV = costInV(ctx.offers, ctx.owned, ctx.projected, charged, ctx.priority)
  const back = Math.max(0, Number(req.cashReturn) || 0)
  const gainV = back > 0 ? batchValue(ctx.offers, ctx.owned, ctx.projected - charged + back, ctx.priority).value
    - batchValue(ctx.offers, ctx.owned, ctx.projected - charged, ctx.priority).value : 0
  if (costV <= 0) return out("grant", cls, "costs the batch nothing at projected cash", costV, gainV)
  if (gainV >= costV) return out("grant", cls, `returns ${fmt(back)} before the install, worth more than it costs`, costV, gainV)
  if (cls === "lasting") return out("sweep", cls, `lasting: would cost the batch ${costV.toFixed(3)} v; buy from install-sweep cash`, costV, gainV)
  return out("refuse", cls, `${cls === "wiped" ? "wiped at install" : cls}: costs the batch ${costV.toFixed(3)} v, returns ${gainV.toFixed(3)} v`, costV, gainV)
}

/** Cash a cloud purchase returns before the install: MCP income x hours x the RAM's share, only while
 * MCP fills at least the demand floor of what it has (otherwise extra RAM earns nothing; cycle 7). */
export function cloudReturn({ addedRam = 0, totalRam = 0, utilization = 0, mcpRatePerSec = 0, hours = 0, s = DEFAULTS }) {
  if (!(utilization >= s.cloudDemandFloor) || !(totalRam > 0) || !(hours > 0)) return 0
  return Math.max(0, mcpRatePerSec) * 3600 * hours * (Math.max(0, addedRam) / totalRam)
}

/** Cash gang gear returns before the install, from its payback time (money mode). */
export function paybackReturn({ cost = 0, paybackSeconds = null, hours = 0 }) {
  return Number(paybackSeconds) > 0 && hours > 0 ? cost * (hours * 3600) / Number(paybackSeconds) : 0
}

/** Lasting requests the install sweep would buy with `leftover`: by value, then cheapest. */
export function sweepPlan(requests = [], leftover = 0) {
  const ranked = [...requests].filter((r) => !WIPED.includes(r.kind))
    .sort((a, b) => (Number(b.valueV) || 0) - (Number(a.valueV) || 0) || a.cost - b.cost)
  const plan = []
  let left = Math.max(0, leftover)
  for (const r of ranked) {
    if (r.cost <= left) { plan.push(r); left -= r.cost }
  }
  return { plan, left }
}

/** Grant check for a spender (R2). Stale or missing grants, or no grant for the kind, mean own rules. */
export function grantFor(grants, kind, cost, now, lastAugReset = null) {
  if (!grants || typeof grants !== "object") return { ok: false, fallback: true, reason: "fallback: no grants" }
  const age = now - Number(grants.ts)
  const ttl = (Number(grants.ttlSec) || DEFAULTS.ttlSec) * 1000
  if (!(age >= 0) || age > ttl) return { ok: false, fallback: true, reason: `fallback: grants ${Math.round(age / 60000)}m old` }
  if (lastAugReset !== null && Number(grants.ts) < Number(lastAugReset)) return { ok: false, fallback: true, reason: "fallback: grants from the previous cycle" }
  const grant = grants.grants?.[kind]
  if (!grant) return { ok: false, fallback: true, reason: `fallback: no grant for ${kind}` }
  return cost <= Number(grant.max) ? { ok: true, fallback: false, reason: grant.reason }
    : { ok: false, fallback: false, reason: `over grant ${fmt(grant.max)}: ${grant.reason}` }
}

/** Purchase kind of a spender's record. */
export function kindOf(source, record = {}, gangCategory = null) {
  if (source === "capital") return { tor: "tor", program: "programs", home: "home_ram", cloud: "cloud_ram", upgrade: "cloud_ram" }[record.kind] ?? null
  if (source === "sleeve") return { aug: "sleeve_augs", memory: "sleeve_memory", sleeve: "covenant_sleeve" }[record.kind] ?? null
  if (source === "gang") return gangCategory === "augmentation" ? "gang_augs" : "gang_gear"
  return null
}

export function fmt(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)
  const a = Math.abs(n)
  for (const [div, suf] of [[1e15, "q"], [1e12, "t"], [1e9, "b"], [1e6, "m"], [1e3, "k"]]) if (a >= div) return `$${(n / div).toFixed(2)}${suf}`
  return `$${n.toFixed(0)}`
}

function pct(v) {
  return Number.isFinite(Number(v)) ? `${(Number(v) * 100).toFixed(1)}%` : "unknown"
}

// ---------------------------------------------------------------- allocator.js helpers (shadow)

/**
 * Purchases the spenders recorded since `seen` ({ capital, sleeve, gang } timestamps). capital and
 * sleeve keep a purchases list; the gang controller reports the items bought on its latest update,
 * stamped with its status ts. Returns { records, seen }.
 */
export function newPurchases({ capital = null, sleeve = null, gang = null } = {}, seen = {}) {
  const records = []
  const next = { ...seen }
  for (const [source, status] of [["capital", capital], ["sleeve", sleeve]]) {
    const list = Array.isArray(status?.purchases) ? status.purchases : []
    for (const p of list) {
      const ok = p?.ok ?? p?.outcome?.ok
      if (!ok || !(Number(p.ts) > (Number(seen[source]) || 0))) continue
      records.push({ source, ts: Number(p.ts), item: p.name ?? p.host ?? p.kind, cost: Number(p.cost) || 0, raw: p })
      next[source] = Math.max(Number(next[source]) || 0, Number(p.ts))
    }
  }
  const items = Array.isArray(gang?.equipment?.boughtItems) ? gang.equipment.boughtItems : []
  if (Number(gang?.ts) > (Number(seen.gang) || 0)) {
    for (const b of items) records.push({ source: "gang", ts: Number(gang.ts), item: b.item, cost: Number(b.cost) || 0, raw: b })
    next.gang = Number(gang.ts)
  }
  return { records: records.sort((a, b) => a.ts - b.ts), seen: next }
}

/** The valuation request for a record or pending action. env: { homeRam, homeDemand, utilization,
 * totalCloudRam, mcpRate, hours, gangCategory(name), gangPayback(name) } */
export function requestFor(source, record, env = {}, s = DEFAULTS) {
  const raw = record.raw ?? record
  const kind = kindOf(source, raw, source === "gang" ? env.gangCategory?.(record.item) : null)
  const cost = Number(record.cost ?? raw.cost) || 0
  const req = { kind, cost, homeRam: env.homeRam, homeDemand: env.homeDemand, cashReturn: 0 }
  if (kind === "cloud_ram") {
    const added = raw.kind === "upgrade" ? Number(raw.toRam) - Number(raw.fromRam) : Number(raw.ram)
    req.cashReturn = cloudReturn({ addedRam: added, totalRam: env.totalCloudRam, utilization: env.utilization, mcpRatePerSec: env.mcpRate, hours: env.hours, s })
  }
  if (source === "gang") req.cashReturn = paybackReturn({ cost, paybackSeconds: env.gangPayback?.(record.item), hours: env.hours })
  return req
}

/** Most each kind may spend this pass (R2 reads these; R1 only publishes them). */
export function grantsFor(ctx, env = {}, s = DEFAULTS) {
  const necessityMax = Math.max(s.necessityFloor, s.necessityFraction * Math.max(0, ctx.cash))
  const free = ctx.phase === "early" || !ctx.batch || !(ctx.batch.value > 0) ? ctx.cash : ctx.freeCash / (1 + s.costMargin)
  const why = ctx.phase === "early" ? "early phase" : ctx.batch?.value > 0 ? "free cash after the projected batch" : ctx.reason
  const out = {}
  for (const kind of KINDS) {
    if (BATCH_KINDS.includes(kind)) continue
    out[kind] = { max: Math.max(0, free), reason: why }
  }
  for (const kind of ["tor", "programs"]) out[kind] = { max: Math.max(free, Math.min(ctx.cash, necessityMax)), reason: `necessity (up to ${fmt(necessityMax)}) or ${why}` }
  const homeNeeded = Number(env.homeRam) < s.homeRamFloor || Number(env.homeDemand) >= s.homeDemandFloor
  out.home_ram = homeNeeded
    ? { max: Math.max(free, Math.min(ctx.cash, necessityMax)), reason: `home RAM in demand: necessity or ${why}` }
    : { max: 0, reason: `home RAM nothing would use (demand ${pct(env.homeDemand)})` }
  return out
}

/** Money counters (getMoneySources().sinceInstall) each kind lands in. */
export const COUNTER_OF = { tor: "other", programs: "other", home_ram: "servers", cloud_ram: "servers", sleeve_augs: "sleeves",
  sleeve_memory: "sleeves", covenant_sleeve: "sleeves", gang_gear: "gang_expenses", gang_augs: "gang_expenses" }

/** Spending per counter between two samples that no record explains (a missed record or a manual buy).
 * A counter that went backwards (an install reset it) counts from zero. */
export function unattributed(before = {}, after = {}, records = [], min = 1e6) {
  const recorded = {}
  for (const r of records) {
    const counter = COUNTER_OF[r.kind]
    if (counter) recorded[counter] = (recorded[counter] || 0) + r.cost
  }
  const out = {}
  for (const counter of ["servers", "sleeves", "gang_expenses", "other"]) {
    const a = -(Number(before[counter]) || 0), b = -(Number(after[counter]) || 0)
    const spent = b >= a ? b - a : b
    const extra = spent - (recorded[counter] || 0)
    if (extra >= min) out[counter] = extra
  }
  return out
}
