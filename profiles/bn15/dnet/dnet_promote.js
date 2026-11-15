/**
 * Lean darknet charisma worker. promoteStock pays charisma_exp x threads x 10 x
 * (200 + charisma) / 200 on every call, with no chance of failure, about four times
 * phishing per thread at charisma 234. The extra stock volatility is not used.
 *
 * Start: dnet_scout.js leaves one on each host it passes. A mutation may kill it.
 * RAM: 3.6GB per thread. Runs only on a darknet server.
 * @param {NS} ns
 */
const SYMBOL = "ECP"

export async function main(ns) {
  ns.disableLog("ALL")
  // A fresh BitNode has no stock market until WSE access is bought, so the symbol is
  // invalid; exit quietly instead of raising a runtime-error modal.
  try {
    while (true) await ns.dnet.promoteStock(SYMBOL)
  } catch (e) {
    if (!String(e).includes("Invalid stock symbol")) throw e
  }
}
