/** Live stats for MCP's selected targets, including cloud-hosted actions. */
function money(n) {for(const [scale,suffix]of [[1e15,'P'],[1e12,'T'],[1e9,'G'],[1e6,'M'],[1e3,'K']])if(Math.abs(n)>=scale)return(n/scale).toFixed(1)+suffix;return String(Math.trunc(n))}
const WHITE='\u001b[37m', RESET='\u001b[0m'
export async function main(ns) {
  ns.disableLog('ALL')
  for(const p of ns.ps('home'))if(p.pid!==ns.pid && p.filename.replace(/^\//,'')==='get_target_stats.js'){ns.ui.closeTail(p.pid);ns.kill(p.pid,'home')}
  ns.ui.openTail();ns.ui.setTailTitle('MCP target stats')
  while(true) {
    let status={};try{status=JSON.parse(ns.read('mcp_status.json')||'{}')}catch{}
    const selected=status.targets?.map(t=>({target:t.target,phase:t.phase})) || (status.target?[{target:status.target,phase:status.plan}]:[])
    const counts=new Map(selected.map(t=>[t.target,{weaken:0,grow:0,hack:0}]))
    for(const w of status.workers||[])for(const p of ns.ps(w.host)) {
      const action=p.filename.replace(/^\//,'').replace('scripts/','').replace('.js',''),row=counts.get(String(p.args[0]))
      if(row && action in row)row[action]+=p.threads
    }
    const lines=[`MCP TARGETS (${selected.length})  ${status.config?.OBJECTIVE||'?'}${Date.now()-Number(status.ts)>30000?' -- STALE STATUS':''}`]
    for(const {target,phase}of selected.sort((a,b)=>ns.getServerMaxMoney(b.target)-ns.getServerMaxMoney(a.target))) {
      const available=ns.getServerMoneyAvailable(target),max=ns.getServerMaxMoney(target),c=counts.get(target)
      lines.push(`${target.padEnd(17)} ${money(available).padStart(7)}/${money(max).padStart(7)} ${(available/max*100).toFixed(0).padStart(3)}%  sec ${ns.getServerSecurityLevel(target).toFixed(2)}/${ns.getServerMinSecurityLevel(target)}  ${c.weaken}w ${c.grow}g ${c.hack}h  ${phase}`)
    }
    if(!selected.length)lines.push('No selected targets')
    ns.clearLog();for(const line of lines)ns.print(`${WHITE}${line}${RESET}`)
    const style=ns.ui.getStyles();ns.ui.resizeTail(Math.ceil(Math.max(...lines.map(l=>l.length))*style.tailFontSize*.6)+60,Math.ceil((lines.length+1)*style.tailFontSize*style.lineHeight)+50)
    ns.ui.renderTail();await ns.sleep(5000)
  }
}
