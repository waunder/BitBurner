/**
 * One-shot, read-only diagnostic: dumps every currently-hackable server's
 * economics to skim_probe.json, to test the "skim the top off each server
 * and move on" hypothesis against mcp.js's steady balance-point harvest.
 *
 * Read-only — no hack/grow/weaken calls, unlike econ_probe.js. The crux
 * question this exists to answer: do never-touched servers sit near their
 * security floor (a skim needs no weaken pass first) or do they start
 * elevated (skim pays the same weaken cost harvest does)? Nothing in
 * docs/hacking-mechanics.md settles this — it's explicitly marked
 * unverified there. `secAboveFloor` in the output answers it directly for
 * every server actually on the network right now, not just one.
 *
 * Not part of the running suite — run once, read mcp_status.json-adjacent
 * skim_probe.json, done.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const queue = ["home"]
  const visited = new Set(queue)
  for (let i = 0; i < queue.length; i++) {
    for (const neighbor of ns.scan(queue[i])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }
  const servers = Array.from(visited)

  const rows = []
  for (const server of servers) {
    if (!ns.hasRootAccess(server)) continue
    if (ns.getHackingLevel() < ns.getServerRequiredHackingLevel(server)) continue
    const maxMoney = ns.getServerMaxMoney(server)
    if (maxMoney <= 0) continue

    const money = ns.getServerMoneyAvailable(server)
    const security = ns.getServerSecurityLevel(server)
    const minSecurity = ns.getServerMinSecurityLevel(server)
    rows.push({
      server,
      maxMoney,
      money,
      moneyPct: maxMoney > 0 ? money / maxMoney : 0,
      security,
      minSecurity,
      secAboveFloor: security - minSecurity,
      requiredHackingLevel: ns.getServerRequiredHackingLevel(server),
      hackTime: ns.getHackTime(server) / 1000,
      growTime: ns.getGrowTime(server) / 1000,
      weakenTime: ns.getWeakenTime(server) / 1000,
      hackChance: ns.hackAnalyzeChance(server),
      hackFracPerThread: ns.hackAnalyze(server),
      growLogPerThread: Math.LN2 / ns.growthAnalyze(server, 2),
    })
  }

  rows.sort((a, b) => b.maxMoney - a.maxMoney)

  const out = {
    ts: Date.now(),
    hackingLevel: ns.getHackingLevel(),
    servers: rows,
  }
  ns.write("skim_probe.json", JSON.stringify(out), "w")
  ns.tprint(`skim_probe: wrote ${rows.length} hackable servers to skim_probe.json`)
  for (const r of rows.slice(0, 10)) {
    ns.tprint(
      `  ${r.server}: maxMoney=${r.maxMoney.toFixed(0)} moneyPct=${(r.moneyPct * 100).toFixed(1)}% sec=${r.security.toFixed(2)} floor=${r.minSecurity.toFixed(2)} (+${r.secAboveFloor.toFixed(2)}) hackTime=${r.hackTime.toFixed(1)}s`
    )
  }
}
