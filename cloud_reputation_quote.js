/** Read-only cloud quotes and current sharing context. */
export async function main(ns) {
  const player = ns.getPlayer()
  const status = JSON.parse(ns.read("mcp_status.json") || "{}")
  const result = {
    ts: Date.now(), money: ns.getServerMoneyAvailable("home"),
    homeRam: ns.getServerMaxRam("home"), intelligence: player.skills.intelligence,
    sharePower: ns.getSharePower(), reputation: status.reputation,
    currentShareHostCores: status.reputation?.host ? ns.getServer(status.reputation.host).cpuCores : null,
    cloudServers: ns.cloud.getServerNames(),
    multiple256Gb: [8,16].map(servers => ({servers,totalRamGb:servers*256,
      threads:servers*Math.floor(256/ns.getScriptRam("mcp_share.js","home")),
      totalCost:servers*ns.cloud.getServerCost(256),
      projectedSharePower:ns.formulas.reputation.sharePower(servers*Math.floor(256/ns.getScriptRam("mcp_share.js","home")),1)})),
    uncapped4Tb: {ramGb:4096,threads:Math.floor(4096/ns.getScriptRam("mcp_share.js","home")),
      projectedSharePower:ns.formulas.reputation.sharePower(Math.floor(4096/ns.getScriptRam("mcp_share.js","home")),1)},
    quotes: [128,256,512,1024,4096].map(ramGb => {
      const shareThreads = Math.floor(Math.min(ramGb,256)/ns.getScriptRam("mcp_share.js","home"))
      return {ramGb,cost:ns.cloud.getServerCost(ramGb),shareThreads,
        projectedSharePower:ns.formulas.reputation.sharePower(shareThreads,1)}
    }),
  }
  await ns.write("cloud_reputation_quote.json",JSON.stringify(result,null,2),"w")
  ns.tprint(JSON.stringify(result))
}
