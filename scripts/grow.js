/** @param {NS} ns */
export async function main(ns) {
  do {
    await ns.grow(ns.args[0])
  } while (ns.args[1] !== "once")
}
