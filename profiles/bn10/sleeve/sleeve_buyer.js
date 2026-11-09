/**
 * Buys Covenant sleeves, sleeve augmentations and sleeve memory, with cash above the
 * `capital_policy.json` reserve. BitNode 10 only. Augmentations need no Covenant membership
 * (each sleeve's shock must be 0); sleeves and memory do, and start once the player joins.
 * Installs wipe sleeve augmentations, so startup.js runs this after each one (bn10 profile).
 * Records cost, modelled payoff and outcome of every purchase in `sleeve_buyer_status.json`.
 * Uses six ns.sleeve calls (24GB): getSleeveCost, getSleeve, purchaseSleeve, upgradeMemory,
 * getSleevePurchasableAugs, purchaseSleeveAug.
 * Start: run sleeve_buyer.js
 * @param {NS} ns
 */
import { boughtFromCost, chooseNextPurchase, chooseSleeveAug, chooseSleevePurchase, eligibility, smoothIncome } from "sleeve_buyer_logic.js"

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
  const bitNode = ns.getResetInfo().currentNode
  if (Number(bitNode) !== 10) { const why = eligibility({ bitNode }); write({ ok: false, idle: why }); ns.print(why); return }

  let last = null, income = 0
  while (true) {
    const policy = readJson(ns, POLICY, {})
    const now = Date.now(), cash = ns.getServerMoneyAvailable("home")
    // last.cash is taken after any purchase, so spending never reads as negative income.
    if (last) income = smoothIncome({ previous: income, cash, lastCash: last.cash, seconds: (now - last.at) / 1000 })
    const spendable = cash - (Number(policy.reserve) || 0)
    const list = sleeves(ns)
    const covenantBlock = eligibility({ bitNode, factions: ns.getPlayer().factions })
    let covenant = null, sleeveCost = null
    if (!covenantBlock) {
      sleeveCost = ns.sleeve.getSleeveCost()
      covenant = chooseSleevePurchase({
        spendable, sleeveCost, boughtCount: boughtFromCost(sleeveCost), sleeves: list, income,
        sleeveShare: Number(policy.sleeveShare) || 0.25,
      })
    }
    // An aug purchase zeroes the sleeve's exp; hold them while sleeves do karma crime (see chooseSleeveAug).
    let karma = null
    try { karma = Number(ns.heart.break()) } catch { /* unknown: treated as not needed */ }
    const karmaTarget = Number(readJson(ns, "player_activity_config.json", {})?.crimeKarmaTarget ?? -54000)
    const karmaNeeded = Number.isFinite(karma) && karma > karmaTarget
    const augs = list.map((s) => ({ ...s, augs: s.shock === 0 && (!karmaNeeded || s.exp < 1000) ? ns.sleeve.getSleevePurchasableAugs(s.index) : [] }))
    const pick = chooseNextPurchase({ covenant, aug: chooseSleeveAug({ sleeves: augs, spendable, augShare: Number(policy.sleeveAugShare) || 0.05, karmaNeeded }) })
    let outcome = null
    if (pick.kind !== "save") {
      const result = pick.kind === "sleeve" ? ns.sleeve.purchaseSleeve()
        : pick.kind === "aug" ? ns.sleeve.purchaseSleeveAug(pick.sleeve, pick.name)
          : ns.sleeve.upgradeMemory(pick.sleeve, pick.points)
      const after = ns.getServerMoneyAvailable("home")
      // purchaseSleeveAug returns a boolean; the Covenant calls return { success, message }.
      outcome = { ok: result === true || Boolean(result?.success), message: result?.message ?? null, cashBefore: cash, cashAfter: after }
      purchases.push({ ts: now, ...pick, outcome })
      purchases.splice(0, Math.max(0, purchases.length - 50))
    }
    last = { at: now, cash: ns.getServerMoneyAvailable("home") }
    write({ ok: true, income, sleeveCost, covenant: covenantBlock ?? "member", reserve: Number(policy.reserve) || 0, action: pick, outcome })
    await ns.sleep(outcome?.ok ? 200 : POLL_MS)
  }
}
