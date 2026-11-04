/** One timed job of a stacked batch. Hack income goes to the runner's port. */
/** @param {NS} ns */
export async function main(ns) {
  const [action, target, additionalMsec, port] = ns.args
  if (action === "hack") ns.writePort(port, await ns.hack(target, { additionalMsec }))
  else if (action === "grow") await ns.grow(target, { additionalMsec })
  else await ns.weaken(target, { additionalMsec })
}
