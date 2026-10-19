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
export function selectedTargets(status) {
  const listed=Array.isArray(status.targets)?status.targets:[]
  return listed.length
    ?listed.map(t=>typeof t==='string'?{target:t,phase:status.phase??'unknown'}:{...t,target:t?.target,phase:t?.phase??t?.plan??'?'}).filter(t=>typeof t.target==='string'&&t.target)
    :(typeof status.target==='string'&&status.target?[{target:status.target,phase:status.phase??status.plan??'?'}]:[])
}
// Combine manager intent with every observed action target; never hide orphan
// jobs or count reserved/unrooted RAM as schedulable worker capacity.
export function buildTargetReport(status, fleet) {
  const rows=new Map()
  for(const entry of selectedTargets(status)) rows.set(entry.target,{...entry,planned:entry.counts??null,listed:true,weaken:0,grow:0,hack:0})
  const pool={max:0,actions:0,other:0,free:0,hosts:0},home={max:0,used:0}
  let outsideActions=0
  for(const host of fleet) {
    const actionRam=host.actions.reduce((sum,a)=>sum+a.ram,0)
    if(host.eligible) {
      pool.max+=host.max;pool.actions+=actionRam;pool.other+=Math.max(0,host.used-actionRam)
      pool.free+=Math.max(0,host.max-host.used);pool.hosts++
    } else outsideActions+=actionRam
    if(host.host==='home'){home.max=host.max;home.used=host.used}
    for(const a of host.actions) {
      if(!rows.has(a.target))rows.set(a.target,{target:a.target,phase:'unlisted',planned:null,listed:false,weaken:0,grow:0,hack:0})
      rows.get(a.target)[a.action]+=a.threads
    }
  }
  const totals={weaken:0,grow:0,hack:0}
  for(const row of rows.values())for(const action of Object.keys(totals))totals[action]+=row[action]
  return {rows:[...rows.values()],pool,home,outsideActions,totals,totalThreads:totals.weaken+totals.grow+totals.hack}
}
export function updateIncomeWindow(history, now, total, windowMs=60_000) {
  if(!Number.isFinite(total))return {history:[],rate:null,elapsed:0,gained:0}
  let points=history.filter(p=>Number.isFinite(p.ts)&&Number.isFinite(p.total))
  const last=points.at(-1)
  if(last&&(now<last.ts||total<last.total))points=[]
  if(points.at(-1)?.ts===now)points.pop()
  points.push({ts:now,total})
  while(points.length>2&&points[1].ts<=now-windowMs)points.shift()
  const elapsed=(now-points[0].ts)/1000,gained=total-points[0].total
  return {history:points,elapsed,gained,rate:elapsed>0?gained/elapsed:null}
}
function collectFleet(ns) {
  const cloud=new Set(ns.cloud.getServerNames())
  return allServers(ns).map(host=>({host,max:Math.max(0,ns.getServerMaxRam(host)),used:Math.max(0,ns.getServerUsedRam(host)),
    eligible:host!=='home'&&ns.getServerMaxRam(host)>2.5&&(cloud.has(host)||ns.hasRootAccess(host)),
    actions:ns.ps(host).filter(p=>/^\/?scripts\/(weaken|grow|hack)\.js$/.test(p.filename)&&typeof p.args[0]==='string').map(p=>({
      action:p.filename.replace(/^\//,'').replace('scripts/','').replace('.js',''),target:p.args[0],threads:p.threads,ram:p.threads*ns.getScriptRam(p.filename,host)}))}))
}
function statusAge(now,ts) {return Number.isFinite(ts)?`${Math.max(0,Math.floor((now-ts)/1000))}s old${now-ts>30000?' STALE':''}`:'MISSING'}
export async function main(ns) {
  ns.disableLog('ALL')
  const request=String(ns.args[0]??'').toLowerCase()
  let previous=ns.ps('home').find(p=>p.pid!==ns.pid&&p.filename.replace(/^\//,'')==='get_target_stats.js')
  if(pageCommand(request)) {
    let status={};try{status=JSON.parse(ns.read('mcp_status.json')||'{}')}catch{}
    const pageCount=Math.max(1,Math.ceil(buildTargetReport(status,collectFleet(ns)).rows.length/PAGE_SIZE))
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
  let incomeHistory=[],fitted=false
  while(true) {
    let status={};try{status=JSON.parse(ns.read('mcp_status.json')||'{}')}catch{}
    const now=Date.now(),report=buildTargetReport(status,collectFleet(ns))
    const income=updateIncomeWindow(incomeHistory,now,ns.getMoneySources().sinceInstall.hacking)
    incomeHistory=income.history
    const ordered=report.rows.sort((a,b)=>ns.getServerMaxMoney(b.target)-ns.getServerMaxMoney(a.target))
    const pageCount=Math.max(1,Math.ceil(ordered.length/PAGE_SIZE))
    const page=Math.min(readPage(ns),pageCount-1)
    if(page!==readPage(ns))await ns.write(PAGE_FILE,String(page),'w')
    const pageTargets=ordered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE)
    const nameWidth=Math.max(6,...pageTargets.map(({target})=>target.length)),moneyWidth=15,securityWidth=11,actionWidth=12
    const lines=[`MCP TARGETS (${ordered.length})  ${status.config?.OBJECTIVE||'?'}  | manager ${statusAge(now,status.ts)} / ${status.workerMode||'unknown'}`]
    const pool=report.pool
    lines.push(`WORKER RAM ${ram(pool.max)} (${pool.hosts} hosts) | ACTION ${ram(pool.actions)} | OTHER ${ram(pool.other)} | FREE ${ram(pool.free)}`)
    lines.push(`HOME ${ram(report.home.max)} reserved; ${ram(report.home.used)} used${report.outsideActions?` | ACTION OUTSIDE POOL ${ram(report.outsideActions)}`:''}`)
    lines.push(income.rate===null?'HACK INCOME collecting first sample...':`HACK INCOME $${money(income.rate)}/s | +$${money(income.gained)} over ${income.elapsed.toFixed(0)}s observed (up to ~60s)`)
    const lastHarvest=(status.recentEvents||[]).filter(e=>e.kind==='cloud_batch_complete'&&e.phase==='harvest').at(-1)
    lines.push(`LIVE = threads running now; BATCH = planned W/G/H at manager snapshot${lastHarvest?` | last harvest ended ${Math.max(0,Math.floor((now-lastHarvest.t)/1000))}s ago`:''}`)
    lines.push(`PAGE ${page+1}/${pageCount} | ${ordered.length?page*PAGE_SIZE+1:0}-${Math.min((page+1)*PAGE_SIZE,ordered.length)} OF ${ordered.length} | gts next / prev / <page>`)
    lines.push(`${'TARGET'.padEnd(nameWidth)} | ${'MONEY C/MAX'.padStart(moneyWidth)} | ${'FULL'.padStart(5)} | ${'SEC N/M'.padStart(securityWidth)} | ${'LIVE W/G/H'.padStart(actionWidth)} | ${'BATCH W/G/H'.padStart(actionWidth)} | BATCH / LIVE STATE`)
    for(const row of pageTargets) {
      const {target,phase}=row,available=ns.getServerMoneyAvailable(target),max=ns.getServerMaxMoney(target)
      const targetThreads=row.weaken+row.grow+row.hack
      const moneyCell=`${money(available)}/${money(max)}`
      const securityCell=`${ns.getServerSecurityLevel(target).toFixed(1)}/${ns.getServerMinSecurityLevel(target).toFixed(1)}`
      const actionCell=`${row.weaken}/${row.grow}/${row.hack}`
      const batchCell=row.planned?`${row.planned.weaken}/${row.planned.grow}/${row.planned.hack}`:'--'
      const live=targetThreads?'running':'no live jobs'
      lines.push(`${target.padEnd(nameWidth)} | ${moneyCell.padStart(moneyWidth)} | ${(max?available/max*100:0).toFixed(0).padStart(4)}% | ${securityCell.padStart(securityWidth)} | ${actionCell.padStart(actionWidth)} | ${batchCell.padStart(actionWidth)} | ${phase} / ${live}`)
    }
    if(!ordered.length)lines.push('No selected targets or live action jobs')
    lines.push(`TOTAL LIVE ${report.totalThreads} threads | W/G/H ${report.totals.weaken}/${report.totals.grow}/${report.totals.hack} | 5s process snapshots; short jobs can finish between refreshes`)
    if(!fitted) {
      const styles=ns.ui.getStyles(),[screenW,screenH]=ns.ui.windowSize()
      const font=Number(styles.tailFontSize)||14,lineHeight=font*(Number(styles.lineHeight)||1.2)
      const width=Math.min(screenW-24,Math.ceil(Math.max(...lines.map(line=>line.length))*font*.62)+48)
      const height=Math.min(screenH-48,Math.ceil((lines.length+2)*lineHeight)+56)
      ns.ui.resizeTail(width,height)
      ns.ui.moveTail(Math.max(0,Math.min(position.x??40,screenW-width-12)),Math.max(0,Math.min(position.y??80,screenH-height-24)))
      fitted=true
    }
    ns.clearLog();for(const [i,line] of lines.entries())ns.print(`${i<7||i===lines.length-1?WHITE:GREEN}${line}${RESET}`)
    ns.ui.renderTail();await saveTailPosition(ns,'get_target_stats.js');await ns.sleep(5000)
  }
}
