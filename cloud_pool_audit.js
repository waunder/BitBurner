/** Report every rooted, hack-level-qualified money server and its cloud-plan exclusion. */
export async function main(ns) {
  ns.disableLog("ALL")
  const seen = new Set(["home"]), queue = ["home"]
  for (let i = 0; i < queue.length; i++) {
    for (const host of ns.scan(queue[i])) if (!seen.has(host)) { seen.add(host); queue.push(host) }
  }
  const player = ns.getPlayer()
  let control={};try{control=JSON.parse(ns.read("mcp_cloud_control.json")||"{}")}catch{}
  const floor=Number(control.protectedFloor)||.25,recovery=Number(control.recoveryTarget)||.95
  const rows = []
  for (const host of queue) {
    if (host === "home" || ns.getServer(host).purchasedByPlayer) continue
    const s = ns.getServer(host), max = s.moneyMax || 0, req = s.requiredHackingSkill || 0
    if (max <= 0) continue
    let reason = "eligible"
    if (!ns.hasRootAccess(host)) reason = "unrooted"
    else if (req > player.skills.hacking) reason = "hack-level"
    else {
      if (s.hackDifficulty-s.minDifficulty>1.5 || s.moneyAvailable<max*recovery) reason="eligible-prep"
      else {
        const p = ns.formulas.hacking.hackPercent(s, player)
        if (!(p > 0)) reason = "no-hack-percent"
        else if (p >= 1) reason = `hack-percent>=100% (${(p*100).toFixed(1)}%)`
        else {
          const floorThreads=Math.floor(Math.log(max*floor/s.moneyAvailable)/Math.log1p(-p))
          const capThreads=Math.floor(.75/p)
          if(Math.min(floorThreads,capThreads)<1)reason="floor-allows-zero-hack-threads"
        }
      }
    }
    rows.push({host, max, req, rooted:ns.hasRootAccess(host), reason})
  }
  rows.sort((a,b)=>b.max-a.max)
  const tally = Object.fromEntries(["eligible","unrooted","hack-level","no-hack-percent","floor-allows-zero-hack-threads"].map(k=>[k,0]))
  for (const row of rows) {
    const key = row.reason.startsWith("hack-percent>=") ? "hack-percent>=100%" : row.reason
    tally[key] = (tally[key] || 0) + 1
  }
  ns.tprint(`Cloud pool audit: money servers=${rows.length}; floor=${(floor*100).toFixed(0)}%; recovery=${(recovery*100).toFixed(0)}%; breakdown=${JSON.stringify(tally)}`)
  for (const row of rows) ns.tprint(`${row.host.padEnd(20)} $${ns.format.number(row.max).padStart(10)} req=${String(row.req).padStart(5)} root=${row.rooted?"Y":"N"} ${row.reason}`)
}
