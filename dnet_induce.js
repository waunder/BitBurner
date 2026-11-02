/**
 * Charges a neighbour's migration until it moves. Charge per call is
 * threads x 0.01 x (charisma + 500) / (200 x difficulty + 1000), 6s a call, and the
 * host moves at 100%, to a random free slot in rows difficulty-2 to difficulty+4.
 * The call also pays charisma exp. A move ends the direct link, which ends this script.
 *
 * Start: dnet_lift.js. Args: <host>.
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL")
  const host = String(ns.args[0])
  let calls = 0
  for (;;) {
    const result = await ns.dnet.induceServerMigration(host)
    if (!result.success) return ns.print(`${host}: stopped after ${calls} calls, code ${result.code}`)
    calls++
  }
}
