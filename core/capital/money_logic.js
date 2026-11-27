/** Pure accounting for money.js. No ns calls, no side effects. */
export const KEEP_MS = 620000
export const WINDOWS_MS = [60000, 600000]
export const PRICE_STEP = 1.9

const LABELS = {
  codingcontract: "contracts", other: "tor+programs", hacknet_expenses: "hacknet buy", gang_expenses: "gang buy",
  augmentations: "augmentations", sleeves: "sleeves", servers: "cloud+home", class: "classes",
}

export function money(value) {
  const n = Number(value) || 0, abs = Math.abs(n), sign = n < 0 ? "-" : ""
  // Past the game's own suffixes (q, Q) print an exponent: "301165908381t" was the all-augs cost
  // in BN11 run 2 (number review row 25, 2026-11-26).
  if (abs >= 1e21) return sign + abs.toExponential(2).replace("+", "")
  for (const [scale, suffix] of [[1e18, "Q"], [1e15, "q"], [1e12, "t"], [1e9, "b"], [1e6, "m"], [1e3, "k"]]) {
    if (abs >= scale) return sign + (abs / scale).toFixed(abs / scale >= 100 ? 0 : abs / scale >= 10 ? 1 : 2) + suffix
  }
  return sign + abs.toFixed(0)
}

export function duration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "--"
  if (seconds < 90) return `${Math.ceil(seconds)}s`
  if (seconds < 5400) return `${Math.round(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}

/** A stack restart zeroes its counter; keep a running total so that is not read as lost income. */
export function nextStackTotal(previous, stolen, hacking) {
  if (!previous) return { raw: stolen, total: stolen <= hacking ? stolen : 0 }
  return { raw: stolen, total: previous.total + (stolen >= previous.raw ? stolen - previous.raw : stolen) }
}

export function addSample(samples, sample) {
  samples.push(sample)
  while (samples.length > 1 && sample.t - samples[0].t > KEEP_MS) samples.shift()
}

/** $/s over a window; null until at least half of it has been observed. */
export function windowRate(samples, ms, value) {
  const last = samples.at(-1), first = samples.find((s) => s.t >= last.t - ms)
  const seconds = (last.t - first.t) / 1000
  return seconds * 2000 < ms ? null : (value(last) - value(first)) / seconds
}

/**
 * Splits hacking into the stacked targets and the rest, then every other game category.
 * `restLabel` names the rest when the caller knows who earns it (money.js passes "MCP" while
 * MCP's status is fresh: mcp_cloud reports no hacking of its own, only the game total).
 */
export function streams(samples, restLabel = "other hacking") {
  const last = samples.at(-1)
  const stacked = (s) => Object.values(s.stacks).reduce((sum, value) => sum + value, 0)
  const rest = (s) => Math.max(0, (s.sources.hacking || 0) - stacked(s))
  const rows = []
  const add = (key, label, value) => rows.push({ key, label, total: value(last), rates: WINDOWS_MS.map((ms) => windowRate(samples, ms, value)) })
  for (const target of Object.keys(last.stacks)) if (last.stacks[target] > 0) add(`stack:${target}`, target, (s) => s.stacks[target] || 0)
  if (last.sources.hacking) add("rest", stacked(last) > 0 ? restLabel : "hacking", rest)
  for (const key of Object.keys(last.sources)) {
    if (key === "total" || key === "hacking" || !last.sources[key]) continue
    add(key, LABELS[key] || key, (s) => s.sources[key] || 0)
  }
  rows.sort((a, b) => b.total - a.total)
  return { income: rows.filter((r) => r.total > 0), spending: rows.filter((r) => r.total < 0).reverse() }
}

/** Each purchase raises later prices, so the total assumes dearest first. */
export function orderedCost(prices, step = PRICE_STEP) {
  return [...prices].sort((a, b) => b - a).reduce((sum, price, i) => sum + price * step ** i, 0)
}

/**
 * Augmentation candidates from augmentation_readiness.json: every faction's offers (not owned or queued),
 * as { name, faction, price, repGap }. 2026-11-16: the panel used player_activity's workCandidates, which
 * leave out factions with no work (Bladeburners, the gang's faction) and showed 3 rep-ready augs of 26.
 */
export function readinessCandidates(readiness) {
  const skip = new Set([...(readiness?.owned || []), ...(readiness?.queued || [])])
  return (readiness?.offers || []).filter((o) => !skip.has(o.name))
    .map((o) => ({ name: o.name, faction: o.faction, price: Number(o.price) || 0, repGap: (Number(o.repRequired) || 0) - (Number(o.rep) || 0) }))
}

/** What the current faction offers would cost, and whether cash or rep is what limits them. */
export function augOutlook(cash, candidates, netRate, step = PRICE_STEP) {
  const best = new Map()
  for (const item of candidates || []) {
    const seen = best.get(item.name)
    if (!seen || item.repGap < seen.repGap) best.set(item.name, item)
  }
  const offers = [...best.values()]
  const ready = offers.filter((item) => item.repGap <= 0)
  const waiting = offers.filter((item) => item.repGap > 0).sort((a, b) => a.repGap - b.repGap)
  const readyCost = orderedCost(ready.map((item) => item.price), step)
  const allCost = orderedCost(offers.map((item) => item.price), step)
  const shortfall = (cost) => Math.max(0, cost - cash)
  return {
    ready: ready.length, readyCost, all: offers.length, allCost, next: waiting[0] || null, spare: cash - readyCost,
    limit: shortfall(readyCost) > 0 ? "cash" : waiting.length ? "rep" : "nothing",
    readyWait: netRate > 0 ? shortfall(readyCost) / netRate : null,
    allWait: netRate > 0 ? shortfall(allCost) / netRate : null,
  }
}

/** Income per TB of RAM held, the fair way to compare two ways of using the fleet. */
export function ramYield(rate, ramGb) {
  return rate === null || !(ramGb > 0) ? null : rate / (ramGb / 1024)
}
