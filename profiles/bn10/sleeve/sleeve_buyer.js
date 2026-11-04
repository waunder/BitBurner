/**
 * Buys Covenant sleeves, then sleeve memory, with cash above the `capital_policy.json` reserve.
 * BitNode 10 only, and only as a member of The Covenant; otherwise it records why and exits.
 * Records cost, modelled payoff and outcome of every purchase in `sleeve_buyer_status.json`.
 * Uses four ns.sleeve calls (16GB): getSleeveCost, getSleeve, purchaseSleeve, upgradeMemory.
 * Start: run sleeve_buyer.js
 * @param {NS} ns
 */
import { boughtFromCost, chooseSleevePurchase, eligibility, smoothIncome } from "sleeve_buyer_logic.js"

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
    try { list.push({ index, memory: ns.sleeve.getSleeve(index).memory }) } catch { break }
  }
  return list
}

export async function main(ns) {
  ns.disableLog("ALL")
  const prior = readJson(ns, STATUS, {})
  const purchases = Array.isArray(prior.purchases) ? prior.purchases : []
  const write = (extra) => ns.write(STATUS, JSON.stringify({ ts: Date.now(), purchases, ...extra }, null, 2), "w")
  const player = ns.getPlayer()
  const blocked = eligibility({ bitNode: ns.getResetInfo().currentNode, factions: player.factions })
  if (blocked) { write({ ok: false, idle: blocked }); ns.print(blocked); return }

  let last = null, income = 0
  while (true) {
    const policy = readJson(ns, POLICY, {})
    const now = Date.now(), cash = ns.getServerMoneyAvailable("home")
    // last.cash is taken after any purchase, so spending never reads as negative income.
    if (last) income = smoothIncome({ previous: income, cash, lastCash: last.cash, seconds: (now - last.at) / 1000 })
    const sleeveCost = ns.sleeve.getSleeveCost()
    const share = Number(policy.sleeveShare) || 0.25
    const pick = chooseSleevePurchase({
      spendable: cash - (Number(policy.reserve) || 0), sleeveCost, boughtCount: boughtFromCost(sleeveCost),
      sleeves: sleeves(ns), income, sleeveShare: share,
    })
    let outcome = null
    if (pick.kind !== "save") {
      const result = pick.kind === "sleeve" ? ns.sleeve.purchaseSleeve() : ns.sleeve.upgradeMemory(pick.sleeve, pick.points)
      const after = ns.getServerMoneyAvailable("home")
      // The game returns { success, message } for these; treat anything else as a refusal.
      outcome = { ok: Boolean(result?.success), message: result?.message ?? null, cashBefore: cash, cashAfter: after }
      purchases.push({ ts: now, ...pick, outcome })
      purchases.splice(0, Math.max(0, purchases.length - 50))
    }
    last = { at: now, cash: ns.getServerMoneyAvailable("home") }
    write({ ok: true, income, sleeveCost, reserve: Number(policy.reserve) || 0, action: pick, outcome })
    await ns.sleep(outcome?.ok ? 200 : POLL_MS)
  }
}
