import { capturePriorTailPosition, loadTailPosition, saveTailPosition } from "./tail_geometry.js"
/** Live stats for MCP's selected targets, including cloud-hosted actions. */
function money(n) {for(const [scale,suffix]of [[1e15,'P'],[1e12,'T'],[1e9,'G'],[1e6,'M'],[1e3,'K']])if(Math.abs(n)>=scale)return(n/scale).toFixed(1)+suffix;return String(Math.trunc(n))}
function ram(n) {return n>=1024?`${(n/1024).toFixed(2)}TB`:n>=100?`${Math.round(n)}GB`:`${n.toFixed(1)}GB`}
const WHITE='\u001b[1;37m', GREEN='\u001b[1;32m', RESET='\u001b[0m'
const PAGE_FILE='get_target_stats_page.txt', PAGE_SIZE=12
function allServers(ns) {
  const seen=new Set(['home']),queue=['home']
  while(queue.length)for(const host of ns.scan(queue.shift()))if(!seen.has(host)){seen.add(host);queue.push(host)}
  for(const host of ns.cloud.getServerNames())seen.add(host)
  return [...seen]
}
function readPage(ns) {
  const page=Number.parseInt(ns.read(PAGE_FILE),10)
  return Number.isFinite(page)&&page>=0?page:0
}
export function pageCommand(value) {return /^(next|prev|previous|first|last|[1-9]\d*)$/.test(value)}
export function selectPage(request,current,pageCount) {
  if(request==='next')return Math.min(pageCount-1,current+1)
  if(request==='prev'||request==='previous')return Math.max(0,current-1)
  if(request==='first')return 0
  if(request==='last')return pageCount-1
  const page=Number.parseInt(request,10)
  return Number.isFinite(page)?Math.max(0,Math.min(pageCount-1,page-1)):current
}
function selectedTargets(status) {
  const listed=Array.isArray(status.targets)?status.targets:[]
  return listed.length
    ?listed.map(t=>typeof t==='string'?{target:t,phase:'?'}:{target:t?.target,phase:t?.phase??t?.plan??'?'}).filter(t=>typeof t.target==='string'&&t.target)
    :(typeof status.target==='string'&&status.target?[{target:status.target,phase:status.phase??status.plan??'?'}]:[])
}
export async function main(ns) {
  ns.disableLog('ALL')
  const request=String(ns.args[0]??'').toLowerCase()
  let previous=ns.ps('home').find(p=>p.pid!==ns.pid&&p.filename.replace(/^\//,'')==='get_target_stats.js')
  if(pageCommand(request)) {
    let status={};try{status=JSON.parse(ns.read('mcp_status.json')||'{}')}catch{}
    const pageCount=Math.max(1,Math.ceil(selectedTargets(status).length/PAGE_SIZE))
    const page=selectPage(request,readPage(ns),pageCount)
    await ns.write(PAGE_FILE,String(page),'w')
    ns.tprint(`Target stats page ${page+1}/${pageCount}${previous?'; panel will update shortly':'; run gts to open the panel'}.`)
    return
  }
  if(request==='restart'&&previous) {
    await capturePriorTailPosition(ns, "get_target_stats.js")
    ns.ui.closeTail(previous.pid)
    ns.kill(previous.pid,'home')
    previous=null
  }
  if(previous) {
    ns.tprint('Target stats is already running. Use gts next, gts prev, or gts <page> to navigate.')
    return
  }
  ns.ui.openTail();ns.ui.setTailTitle('MCP target stats')
  const position=loadTailPosition(ns,'get_target_stats.js')
  if(Number.isFinite(position.x)&&Number.isFinite(position.y))ns.ui.moveTail(position.x,position.y)
  while(true) {
    let status={};try{status=JSON.parse(ns.read('mcp_status.json')||'{}')}catch{}
    const selected=selectedTargets(status)
    const counts=new Map(selected.map(t=>[t.target,{weaken:0,grow:0,hack:0}]))
    const fleet=allServers(ns).map(host=>({
      host,
      max:Math.max(0,ns.getServerMaxRam(host)),
      used:Math.max(0,ns.getServerUsedRam(host)),
      actions:ns.ps(host).filter(p=>/^(\/?scripts\/)?(weaken|grow|hack)\.js$/.test(p.filename)),
    }))
    const totalRam=fleet.reduce((sum,h)=>sum+h.max,0)
    const usedRam=fleet.reduce((sum,h)=>sum+h.used,0)
    // Allocated is the RAM assigned to MCP action workers; in-use is all RAM
    // consumed by processes, so the difference exposes other workloads too.
    const allocatedRam=fleet.reduce((sum,h)=>sum+h.actions.reduce((n,a)=>n+a.threads*ns.getScriptRam(a.filename,h.host),0),0)
    const idleRam=Math.max(0,totalRam-usedRam)
    // Walk the network and explicitly include purchased/cloud hosts: status.workers
    // can omit a host during a transition, but its live MCP threads still count.
    for(const {host,actions} of fleet)for(const p of actions) {
      const action=p.filename.replace(/^\//,'').replace('scripts/','').replace('.js',''),row=counts.get(String(p.args[0]))
      if(row && action in row)row[action]+=p.threads
    }
    const threadTotals={weaken:0,grow:0,hack:0}
    for(const c of counts.values())for(const action of Object.keys(threadTotals))threadTotals[action]+=c[action]
    const totalThreads=threadTotals.weaken+threadTotals.grow+threadTotals.hack
    const ordered=selected.sort((a,b)=>ns.getServerMaxMoney(b.target)-ns.getServerMaxMoney(a.target))
    const threadShares=ordered.map(({target})=>totalThreads?Math.round((counts.get(target).weaken+counts.get(target).grow+counts.get(target).hack)/totalThreads*1000)/10:0)
    if(totalThreads && threadShares.length)threadShares[0]=Math.round((threadShares[0]+100-threadShares.reduce((a,b)=>a+b,0))*10)/10
    const pageCount=Math.max(1,Math.ceil(ordered.length/PAGE_SIZE))
    const page=Math.min(readPage(ns),pageCount-1)
    if(page!==readPage(ns))await ns.write(PAGE_FILE,String(page),'w')
    const pageTargets=ordered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE)
    const nameWidth=Math.max(6,...pageTargets.map(({target})=>target.length)),moneyWidth=15,securityWidth=11,actionWidth=11
    const lines=[`MCP TARGETS (${selected.length})  ${status.config?.OBJECTIVE||'?'}${Date.now()-Number(status.ts)>30000?' -- STALE STATUS':''}`]
    lines.push(`RAM  TOTAL ${ram(totalRam)}  ALLOCATED ${ram(allocatedRam)}  IN USE ${ram(usedRam)}  IDLE ${ram(idleRam)}`)
    lines.push(`READY% = target money fullness  |  SHARE% = portion of all action threads (sums to 100%)`)
    lines.push(`PAGE ${page+1}/${pageCount}  TARGETS ${ordered.length?page*PAGE_SIZE+1:0}-${Math.min((page+1)*PAGE_SIZE,ordered.length)} OF ${ordered.length}  |  gts next / gts prev / gts <page>`)
    lines.push(`${'TARGET'.padEnd(nameWidth)} | ${'MONEY C/MAX'.padStart(moneyWidth)} | ${'READY'.padStart(5)} | ${'SEC N/M'.padStart(securityWidth)} | ${'#T'.padStart(5)} | ${'SHARE'.padStart(6)} | ${'W/G/H'.padStart(actionWidth)} | PHASE`)
    for(const {target,phase}of pageTargets) {
      const available=ns.getServerMoneyAvailable(target),max=ns.getServerMaxMoney(target),c=counts.get(target)
      const targetThreads=c.weaken+c.grow+c.hack
      const moneyCell=`${money(available)}/${money(max)}`
      const securityCell=`${ns.getServerSecurityLevel(target).toFixed(1)}/${ns.getServerMinSecurityLevel(target).toFixed(1)}`
      const actionCell=`${c.weaken}/${c.grow}/${c.hack}`
      const share=threadShares[ordered.findIndex(row=>row.target===target)]
      lines.push(`${target.padEnd(nameWidth)} | ${moneyCell.padStart(moneyWidth)} | ${(max?available/max*100:0).toFixed(0).padStart(4)}% | ${securityCell.padStart(securityWidth)} | ${String(targetThreads).padStart(5)} | ${share.toFixed(1).padStart(5)}% | ${actionCell.padStart(actionWidth)} | ${phase}`)
    }
    if(!selected.length)lines.push('No selected targets')
    lines.push(`${'TOTAL'.padEnd(nameWidth)} | ${''.padStart(moneyWidth)} | ${''.padStart(5)} | ${''.padStart(securityWidth)} | ${String(totalThreads).padStart(5)} | ${(totalThreads?threadShares.reduce((a,b)=>a+b,0):0).toFixed(1).padStart(5)}% | ${`${threadTotals.weaken}/${threadTotals.grow}/${threadTotals.hack}`.padStart(actionWidth)} |`)
    ns.clearLog();for(const [i,line] of lines.entries())ns.print(`${i<5||i===lines.length-1?WHITE:GREEN}${line}${RESET}`)
    ns.ui.renderTail();await saveTailPosition(ns,'get_target_stats.js');await ns.sleep(5000)
  }
}
