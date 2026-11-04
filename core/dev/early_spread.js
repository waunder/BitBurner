/** @param {NS} ns
 * Fresh-node bootstrap, one-shot: roots every server the owned port openers
 * allow (rooting needs ports only, not hacking level) and fills each rooted
 * server's free RAM with scripts/weakenGrowHack.js against one target.
 * For the hours before home can hold mcp.js; kill the loops when MCP returns.
 * Start: run early_spread.js [target=joesguns]
 */
export async function main(ns) {
  const target = ns.args[0] ?? "joesguns"
  const LOOP = "scripts/weakenGrowHack.js"
  const openers = [["BruteSSH.exe", ns.brutessh], ["FTPCrack.exe", ns.ftpcrack], ["relaySMTP.exe", ns.relaysmtp],
    ["HTTPWorm.exe", ns.httpworm], ["SQLInject.exe", ns.sqlinject]].filter(([file]) => ns.fileExists(file, "home"))
  const seen = new Set(["home"])
  const queue = ["home"]
  let rooted = 0, threads = 0
  while (queue.length) {
    for (const next of ns.scan(queue.shift())) {
      if (seen.has(next) || next === "darkweb" || next.startsWith("pserv")) continue
      seen.add(next)
      queue.push(next)
      if (!ns.hasRootAccess(next) && ns.getServerNumPortsRequired(next) <= openers.length) {
        for (const [, open] of openers) open(next)
        ns.nuke(next)
        rooted++
      }
      const free = ns.getServerMaxRam(next) - ns.getServerUsedRam(next)
      if (!ns.hasRootAccess(next) || free < 2) continue
      ns.scp(LOOP, next, "home")
      const t = Math.floor(free / ns.getScriptRam(LOOP, "home"))
      if (t > 0 && ns.exec(LOOP, next, t, target)) threads += t
    }
  }
  ns.tprint(`early_spread: rooted ${rooted} new, started ${threads} threads on ${target}, ${seen.size - 1} servers seen`)
}
