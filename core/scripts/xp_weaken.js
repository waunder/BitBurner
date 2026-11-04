/** One idle-RAM weaken for hacking XP. Named apart from weaken.js so MCP ignores it. */
/** @param {NS} ns */
export async function main(ns) {
  await ns.weaken(ns.args[0])
}
