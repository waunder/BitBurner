/** Grafting decisions. Pure: no ns calls (see docs/grafting-plan.md, steps G2 to G4).
 *
 * Grafting buys an augmentation with cash and player time instead of faction rep. Each finished
 * graft adds one entropy stack (every multiplier x0.98), so a graft must be worth more than that
 * permanent loss, and worth more per hour than the player's best alternative. Value uses the same
 * `augValue` and weights as the install advisor so grafts and faction augmentations share one scale.
 *
 * Names here avoid Netscript function names on purpose (static RAM is charged by name).
 */

import { augValue } from "./install_advisor_logic.js"

export const HOUR_MS = 3600000
export const ENTROPY_BASE = 0.98
export const CURE_NAME = "violet Congruity Implant"
export const FOCUS_HELPER_NAME = "Neuroreceptor Management Implant"
export const UNFOCUSED_SPEED = 0.8

export const DEFAULT_GRAFT_CONFIG = {
  enabled: true,
  dry: true,
  allow: [],
  block: [],
  maxPriceFractionOfCash: 0.25,
  reserveInstallPlan: true,
  maxEntropy: 6,
  minNetValue: 0.05,
  maxGraftHours: 2.5,
  maxKarmaDelayHours: 0.25,
  allowDuringKarma: false,
  focus: false,
  cooldownMs: 600000,
  factionStepRatio: 1.9,
}

/** Graft price from the game's getAugmentationBasePrice value (BN10 x5 already included): 0.6 x that. */
export function graftPrice(basePriceFromGame) {
  return 0.6 * Number(basePriceFromGame)
}

/** Graft price from the raw (un-multiplied) base cost: 3 x raw. Equal to graftPrice in BN10 (x5 base). */
export function graftPriceFromRawBase(raw) {
  return 3 * Number(raw)
}

/** Intelligence bonus divisor, 1 + int^0.8 / 600 (already inside the game's getAugmentationGraftTime). */
export function intelligenceBonus(intelligence) {
  const level = Math.max(0, Number(intelligence) || 0)
  return 1 + Math.pow(level, 0.8) / 600
}

/** Graft time in ms from an augmentation's multiplier object, before focus: ((3.6e6 log2(sum) + 1.8e6) / 2) / bonus. */
export function graftTimeMs(mults, intelligence) {
  let sum = 0
  for (const value of Object.values(mults || {})) {
    const mult = Number(value)
    if (Number.isFinite(mult) && mult !== 1) sum += mult
  }
  const base = (HOUR_MS * Math.log2(Math.max(sum, 1)) + 1800000) / 2
  return base / intelligenceBonus(intelligence)
}

/** Speed factor of the work: 1 when focused or when Neuroreceptor Management is owned, else 0.8. */
export function focusFactor(focused, hasNeuroreceptorManager) {
  return focused || hasNeuroreceptorManager ? 1 : UNFOCUSED_SPEED
}

/** Multiplier on every stat after this many entropy stacks. */
export function entropyFactor(stacks) {
  return Math.pow(ENTROPY_BASE, Math.max(0, Number(stacks) || 0))
}

/** Value lost to one more entropy stack: sum of weights x -ln(0.98). Zero once the cure is owned. */
export function entropyValue(weights, cured = false) {
  if (cured) return 0
  let total = 0
  for (const weight of Object.values(weights || {})) {
    const part = Number(weight)
    if (Number.isFinite(part)) total += part
  }
  return total * -Math.log(ENTROPY_BASE)
}

/** Weighted value of the augmentation minus one entropy stack. */
export function netValue(stats, weights, cured = false) {
  return augValue(stats, weights) - entropyValue(weights, cured)
}

/**
 * Catalog rows for every graftable name. Prices are the game's graft prices, times are the game's
 * graft times in ms (intelligence included), stats are multiplier objects, prereqs are name lists.
 */
export function buildCatalog(list, statsByName, prereqsByName, priceByName, timeByName) {
  const rows = []
  for (const name of list || []) {
    const mults = statsByName?.[name]
    const price = Number(priceByName?.[name])
    const timeMs = Number(timeByName?.[name])
    if (!mults || mults.error || !Number.isFinite(price) || !Number.isFinite(timeMs)) continue
    rows.push({
      name,
      graftPrice: price,
      hours: timeMs / HOUR_MS,
      mults,
      prereqs: Array.isArray(prereqsByName?.[name]) ? [...prereqsByName[name]] : [],
    })
  }
  return rows
}

/** Faction offers as a map name -> {price, repReady}; accepts an array of {name, price, repReady} too. */
function offerMap(factionOffers) {
  if (Array.isArray(factionOffers)) {
    const map = {}
    for (const offer of factionOffers) if (offer?.name) map[offer.name] = offer
    return map
  }
  return factionOffers || {}
}

const GATE_ORDER = [
  "disabled", "already grafting", "entropy cap", "prereqs missing", "price cap",
  "install-plan reserve", "karma phase", "cheaper via faction", "net value", "max graft hours",
  "rate below alternative", "cooldown", "install imminent",
]

/**
 * Choose the next graft. Returns {pick, reasons, candidates} or {pick: null, blocked, rejected}.
 * `blocked` lists the distinct gate names hit (gate order); `rejected` has one row per refused name.
 * Queued augmentations count toward prereqs but never change a graft price (grafts ignore the ladder).
 */
export function planGraft(input) {
  const {
    catalog = [], owned = [], queued = [], cash = 0, entropy = 0, cured = false, weights = {},
    karma = null, karmaTarget = null, playerKarmaShare = 0, alternativeRate = null,
    installPlanCost = 0, installSoonHours = null, factionOffers = null, batchSize = 0,
    lastFinishedAt = null, now = Date.now(), working = null,
  } = input || {}
  const config = { ...DEFAULT_GRAFT_CONFIG, ...(input?.config || {}) }
  const rejected = []
  const finish = () => {
    const seen = new Set(rejected.map(item => item.reason))
    const blocked = GATE_ORDER.filter(gate => seen.has(gate))
    return { pick: null, blocked, rejected }
  }

  if (!config.enabled) { rejected.push({ name: null, reason: "disabled" }); return finish() }
  if (working?.type === "GRAFTING") { rejected.push({ name: null, reason: "already grafting" }); return finish() }
  if (!cured && Number(entropy) >= config.maxEntropy) {
    rejected.push({ name: null, reason: "entropy cap", detail: `${entropy} >= ${config.maxEntropy}` })
    return finish()
  }

  const have = new Set([...owned, ...queued])
  const hasFocusHelper = have.has(FOCUS_HELPER_NAME)
  const speed = focusFactor(Boolean(config.focus), hasFocusHelper)
  const offers = offerMap(factionOffers)
  const allow = new Set(config.allow || [])
  const block = new Set(config.block || [])
  const candidates = []

  for (const row of catalog) {
    if (have.has(row.name)) continue
    const refuse = (reason, detail) => { rejected.push({ name: row.name, reason, detail }) }
    if (block.has(row.name) || (allow.size > 0 && !allow.has(row.name))) continue // user filter, not a gate
    const missing = (row.prereqs || []).filter(prereq => !have.has(prereq))
    if (missing.length > 0) { refuse("prereqs missing", missing.join(", ")); continue }

    const price = Number(row.graftPrice)
    const hours = Number(row.hours) / speed
    if (price > cash * config.maxPriceFractionOfCash) { refuse("price cap"); continue }
    if (config.reserveInstallPlan && Number(installPlanCost) > 0 && cash - price < installPlanCost) {
      refuse("install-plan reserve"); continue
    }
    if (karmaTarget !== null && karma !== null && Number(karma) > Number(karmaTarget)) {
      const delay = hours * Number(playerKarmaShare)
      if (!(config.allowDuringKarma && delay <= config.maxKarmaDelayHours)) {
        refuse("karma phase", `delay ${delay.toFixed(2)}h`); continue
      }
    }
    const offer = offers[row.name]
    if (offer && offer.repReady && Number(offer.price) * Math.pow(config.factionStepRatio, batchSize) < price) {
      refuse("cheaper via faction"); continue
    }
    const netV = netValue(row.mults, weights, cured)
    if (!(netV > config.minNetValue)) { refuse("net value", netV.toFixed(3)); continue }
    if (hours > config.maxGraftHours) { refuse("max graft hours"); continue }
    const rateV = netV / hours
    const altRate = Number(alternativeRate)
    if (alternativeRate !== null && alternativeRate !== undefined && Number.isFinite(altRate) && !(rateV > altRate)) {
      refuse("rate below alternative", `${rateV.toFixed(3)} <= ${altRate.toFixed(3)}`); continue
    }
    if (lastFinishedAt !== null && lastFinishedAt !== undefined && now - Number(lastFinishedAt) < config.cooldownMs) {
      refuse("cooldown"); continue
    }
    if (installSoonHours !== null && installSoonHours !== undefined && Number(installSoonHours) < hours) {
      refuse("install imminent"); continue
    }
    candidates.push({
      name: row.name, price, hours, netV, rateV, alternativeRate: alternativeRate ?? null,
      prereqs: row.prereqs || [],
    })
  }

  if (candidates.length === 0) return finish()
  candidates.sort((a, b) => b.rateV - a.rateV)
  const best = candidates[0]
  const reasons = [
    `net value ${best.netV.toFixed(3)} over ${best.hours.toFixed(2)}h = ${best.rateV.toFixed(3)} v/h`,
    alternativeRate === null || alternativeRate === undefined ? "no alternative rate" : `beats alternative ${Number(alternativeRate).toFixed(3)} v/h`,
  ]
  return { pick: best, reasons, candidates, rejected }
}

/** True while a fresh graft status says the grafter owns the player (aug_install must not prestige). */
export function installBlocked(graftStatus, now, freshMs = 120000) {
  if (!graftStatus || !graftStatus.ownsPlayer) return false
  const stamp = Number(graftStatus.ts)
  return Number.isFinite(stamp) && Number(now) - stamp <= freshMs
}

/**
 * planGraft input from the game's status files (step G5, the dry controller reads files only).
 * files: {catalog, readiness, sleeve, activity, target, config, previous}; any may be null.
 * live: {cash, entropy, now}. The alternative rate is the advisor's best faction-work value per
 * hour (advice.next.rate), else the cycle average; an "install" verdict means install now (0h).
 */
export function graftInputs(files, live) {
  const { catalog, readiness, sleeve, activity, target, config, previous } = files || {}
  const owned = Array.isArray(readiness?.owned) ? readiness.owned : []
  const queued = Array.isArray(readiness?.queued) ? readiness.queued : []
  const factionOffers = {}
  for (const offer of readiness?.offers || []) {
    if (!offer?.name) continue
    const repReady = Number(offer.rep) >= Number(offer.repRequired)
    const known = factionOffers[offer.name]
    if (!known || (repReady && (!known.repReady || Number(offer.price) < Number(known.price)))) {
      factionOffers[offer.name] = { price: Number(offer.price), repReady }
    }
  }
  const advice = readiness?.advice || {}
  const nextRate = Number(advice.next?.rate)
  const average = Number(advice.average)
  const alternativeRate = Number.isFinite(nextRate) ? nextRate : (Number.isFinite(average) ? average : null)
  const installSoonHours = advice.verdict === "install" ? 0 : null
  const planNames = readiness?.installPlan?.names
  const lastFinishedAt = previous?.lastFinishedAt ?? null
  return {
    catalog: Array.isArray(catalog?.rows) ? catalog.rows : [],
    owned, queued,
    cash: Number(live?.cash) || 0,
    entropy: Number(live?.entropy) || 0,
    cured: owned.includes(CURE_NAME) || queued.includes(CURE_NAME),
    weights: target?.augWeights || {},
    karma: sleeve?.karma ?? null,
    karmaTarget: sleeve?.karmaTarget ?? activity?.config?.crimeKarmaTarget ?? null,
    playerKarmaShare: 1,
    alternativeRate,
    installPlanCost: Number(readiness?.installPlan?.cost) || 0,
    installSoonHours,
    factionOffers,
    batchSize: Array.isArray(planNames) ? planNames.length : 0,
    lastFinishedAt,
    now: Number(live?.now) || Date.now(),
    working: activity?.currentWork || null,
    config: config || {},
  }
}

/** Short key for "did the decision change": the pick's name, or the sorted blocked gates. */
export function decisionKey(plan) {
  if (plan?.pick) return `pick:${plan.pick.name}`
  return `blocked:${(plan?.blocked || []).join(",")}`
}

const COMBAT_KEYS = ["strength", "defense", "dexterity", "agility"]

/** True when the multipliers raise any combat stat. */
export function isCombatAug(mults) {
  return COMBAT_KEYS.some(key => Number(mults?.[key]) > 1)
}

/**
 * Catalog rows ranked by net value per graft hour (entropy included), best first.
 * Options: `noPrereqs` keeps rows with no prerequisites, `combat` keeps rows that raise a combat stat.
 */
export function rankCatalog(rows, weights, { cured = false, noPrereqs = false, combat = false } = {}) {
  const ranked = []
  for (const row of rows || []) {
    if (noPrereqs && row.prereqs?.length) continue
    if (combat && !isCombatAug(row.mults)) continue
    const net = netValue(row.mults, weights, cured)
    const hours = Number(row.hours) > 0 ? Number(row.hours) : Infinity
    ranked.push({ name: row.name, net, perHour: net / hours, graftPrice: row.graftPrice, hours: row.hours })
  }
  ranked.sort((a, b) => b.perHour - a.perHour)
  return ranked
}

export const GRAFT_CITY = "New Tokyo"

/**
 * One live-controller step (G7). Pure. Live acts only with config.dry === false AND a non-empty allow
 * list (the first grafts are supervised by name). While the player's work is GRAFTING the controller
 * holds the player. lastStartedAt guards against retrying a start that failed within cooldownMs.
 * Returns {mode, act: "none"|"hold"|"start", ownsPlayer, reason, name?, needTrip?, focus?}.
 */
export function liveGraftStep({ config, plan, workType, city, previous, now }) {
  const cfg = { ...DEFAULT_GRAFT_CONFIG, ...(config || {}) }
  if (cfg.dry !== false) return { mode: "dry", act: "none", ownsPlayer: false, reason: "dry" }
  if (workType === "GRAFTING") return { mode: "live", act: "hold", ownsPlayer: true, reason: "grafting" }
  // autoPick (Ken 2026-11-18 12:30, live on the agent's judgement): an empty allow list lets the planner's
  // capped pick run. Without autoPick, live still needs grafts named in `allow`.
  if ((!Array.isArray(cfg.allow) || cfg.allow.length === 0) && cfg.autoPick !== true) {
    return { mode: "live", act: "none", ownsPlayer: false, reason: "live needs an allow list or autoPick" }
  }
  if (!plan?.pick) return { mode: "live", act: "none", ownsPlayer: false, reason: "no pick" }
  const started = Number(previous?.lastStartedAt)
  if (Number.isFinite(started) && Number(now) - started < cfg.cooldownMs) {
    return { mode: "live", act: "none", ownsPlayer: false, reason: "start cooldown" }
  }
  return {
    mode: "live", act: "start", ownsPlayer: true, reason: "start", name: plan.pick.name,
    needTrip: city !== GRAFT_CITY, focus: Boolean(cfg.focus),
  }
}

/** True when the previous status recorded a graft in progress and the player is no longer grafting. */
export function graftEnded(previous, workType) {
  return Boolean(previous?.grafting?.name) && workType !== "GRAFTING"
}
