/**
 * Buys Covenant sleeves, sleeve augmentations and sleeve memory, with cash above the
 * `capital_policy.json` reserve. Augmentations work in any BitNode with sleeves and need no Covenant membership
 * (each sleeve's shock must be 0); sleeves and memory do, and start once the player joins.
 * Installs wipe sleeve augmentations, so startup.js runs this after each one (bn10 profile).
 * Records cost, modelled payoff and outcome of every purchase in `sleeve_buyer_status.json`.
 * Uses six ns.sleeve calls (24GB): getSleeveCost, getSleeve, purchaseSleeve, upgradeMemory,
 * getSleevePurchasableAugs, purchaseSleeveAug.
 * Start: run sleeve_buyer.js
 * @param {NS} ns
 */
import { BN6_SLEEVE_AUGS, boughtFromCost, chooseNextPurchase, chooseSleeveAugBatch, chooseSleevePurchase, eligibility, smoothIncome } from "sleeve_buyer_logic.js"
import { lateCycleLimit } from "capital_logic.js"

const STATUS = "sleeve_buyer_status.json"
const POLICY = "capital_policy.json"
const POLL_MS = 30_000

function readJson(ns, file, fallback) {
  try { return JSON.parse(ns.read(file)) ?? fallback } catch { return fallback }
}

function sleeves(ns) {
  const list = []
  // getSleeve throws past the last index, which saves a getNumSleeves call (4GB).
  for (let index = 0; index < 8; index++) {
    try {
      const sleeve = ns.sleeve.getSleeve(index)
      const e = sleeve.exp || {}
      list.push({ index, memory: sleeve.memory, shock: sleeve.shock, exp: (e.strength || 0) + (e.defense || 0) + (e.dexterity || 0) + (e.agility || 0) })
    } catch { break }
  }
  return list
}

export async function main(ns) {
  ns.disableLog("ALL")
  for (const process of ns.ps("home")) {
    if (process.filename === ns.getScriptName() && process.pid !== ns.pid) ns.kill(process.pid)
  }
  const prior = readJson(ns, STATUS, {})
  const purchases = Array.isArray(prior.purchases) ? prior.purchases : []
  const write = (extra) => ns.write(STATUS, JSON.stringify({ ts: Date.now(), purchases, ...extra }, null, 2), "w")
  // Augmentations work wherever sleeves exist (SF10); only Covenant sleeves and memory need BN10,
  // and eligibility() gates those below.
  const bitNode = ns.getResetInfo().currentNode

  let last = null, income = 0
  while (true) {
    const policy = readJson(ns, POLICY, {})
    const now = Date.now(), cash = ns.getServerMoneyAvailable("home")
    // last.cash is taken after any purchase, so spending never reads as negative income.
    if (last) income = smoothIncome({ previous: income, cash, lastCash: last.cash, seconds: (now - last.at) / 1000 })
    const spendable = cash - (Number(policy.reserve) || 0)
    // Late in a cycle the aug batch gets the cash: no sleeve augs (an install wipes them), and
    // memory or sleeves (permanent) at most lateSpendFraction of cash per purchase (lateCycleLimit).
    const hoursSinceInstall = (now - ns.getResetInfo().lastAugReset) / 3.6e6
    const lasting = lateCycleLimit({ policy, hoursSinceInstall, cash })
    const wiped = lateCycleLimit({ policy, hoursSinceInstall, cash, lostAtInstall: true })
    const cyclePhase = lasting.phase
    const list = sleeves(ns)
    const covenantBlock = eligibility({ bitNode, factions: ns.getPlayer().factions })
    let covenant = null, sleeveCost = null
    if (!covenantBlock) {
      sleeveCost = ns.sleeve.getSleeveCost()
      covenant = chooseSleevePurchase({
        spendable: Math.min(spendable, lasting.limit), sleeveCost, boughtCount: boughtFromCost(sleeveCost), sleeves: list, income,
        sleeveShare: Number(policy.sleeveShare) || 0.25,
      })
    }
    // Augmentations go in per-sleeve batches (one exp reset each; see chooseSleeveAugBatch). While karma
    // crime is still needed only fresh sleeves buy. Late in a cycle wiped.limit is 0, so nothing buys.
    let karma = null
    try { karma = Number(ns.heart.break()) } catch { /* unknown: treated as not needed */ }
    const karmaTarget = Number(readJson(ns, "player_activity_config.json", {})?.crimeKarmaTarget ?? -54000)
    const freshOnly = Number.isFinite(karma) && karma > karmaTarget
    const wanted = Array.isArray(policy.sleeveAugWanted) ? policy.sleeveAugWanted : Number(bitNode) === 6 ? BN6_SLEEVE_AUGS : null
    // Priority: each sleeve's best Bladeburner contract odds (bladeburner.js measures them), so the
    // sleeves nearest contract work get augmented first.
    const bbSleeves = readJson(ns, "bladeburner_status.json", null)?.sleeveContracts?.sleeves || []
    const priorityOf = (i) => Math.max(0, ...Object.values(bbSleeves.find((r) => r.index === i)?.contracts || {}).map((c) => Number(c.chance?.[0] ?? c.chance) || 0))
    const augLimit = Math.min(spendable, wiped.limit)
    const augs = list.map((s) => ({ ...s, priority: priorityOf(s.index),
      augs: augLimit > 0 && s.shock === 0 && (!freshOnly || s.exp < 1000) ? ns.sleeve.getSleevePurchasableAugs(s.index) : [] }))
    const pick = chooseNextPurchase({ covenant, aug: chooseSleeveAugBatch({ sleeves: augs, spendable: augLimit, wanted, freshOnly,
      batchShare: Number(policy.sleeveAugBatchShare) || 0.5 }) })
    let outcome = null
    if (pick.kind !== "save") {
      const result = pick.kind === "sleeve" ? ns.sleeve.purchaseSleeve()
        : pick.kind === "aug" ? pick.names.map((name) => ns.sleeve.purchaseSleeveAug(pick.sleeve, name)).every((ok) => ok === true)
          : ns.sleeve.upgradeMemory(pick.sleeve, pick.points)
      const after = ns.getServerMoneyAvailable("home")
      // purchaseSleeveAug returns a boolean; the Covenant calls return { success, message }.
      outcome = { ok: result === true || Boolean(result?.success), message: result?.message ?? null, cashBefore: cash, cashAfter: after }
      purchases.push({ ts: now, ...pick, outcome })
      purchases.splice(0, Math.max(0, purchases.length - 50))
    }
    last = { at: now, cash: ns.getServerMoneyAvailable("home") }
    write({ ok: true, income, sleeveCost, covenant: covenantBlock ?? "member", reserve: Number(policy.reserve) || 0,
      cyclePhase, limits: { lasting: lasting.limit, wiped: wiped.limit }, action: pick, outcome })
    await ns.sleep(outcome?.ok ? 200 : POLL_MS)
  }
}
