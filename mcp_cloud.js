/** Finite multi-target batches, owned and observed by the existing MCP. */
export const CLOUD_CONTROL = 'mcp_cloud_control.json'
const SCRIPTS = {hack:'scripts/hack.js',grow:'scripts/grow.js',weaken:'scripts/weaken.js'}

export function planCloudBatch(ns, target, fraction = 0.5) {
  const server = ns.getServer(target), player = ns.getPlayer(), f = ns.formulas.hacking
  const weakenPower = ns.weakenAnalyze(1, 1)
  const excess = Math.max(0, server.hackDifficulty - server.minDifficulty)
  let phase, hack = 0, grow = 0, weaken = 0
  if (excess > 0.001) {
    phase = 'prepare-security'; weaken = Math.ceil(excess / weakenPower)
  } else {
    if (server.moneyAvailable < server.moneyMax * 0.999999) phase = 'prepare-money'
    else {
      phase = 'harvest'
      const percent = f.hackPercent(server, player)
      if (!(percent > 0) || percent > 0.9) return null
      hack = Math.max(1, Math.floor(fraction / percent))
      // Worst case all hack calls succeed. Grow completes after hack.
      server.moneyAvailable *= 1 - Math.min(0.9, hack * percent)
    }
    grow = Math.ceil(f.growThreads(server, player, server.moneyMax, 1))
    weaken = Math.ceil((hack * 0.002 + grow * 0.004) / weakenPower)
  }
  const counts = {hack, grow, weaken}
  if (!Object.values(counts).every(x => Number.isFinite(x) && x >= 0)) return null
  const durations = {hack:ns.getHackTime(target)/1000,grow:ns.getGrowTime(target)/1000,weaken:ns.getWeakenTime(target)/1000}
  const ram = Object.entries(counts).reduce((n,[a,t])=>n+t*ns.getScriptRam(SCRIPTS[a],'home'),0)
  const floor = {...server,hackDifficulty:server.minDifficulty,moneyAvailable:server.moneyMax}
  const percent = f.hackPercent(floor,player), chance = f.hackChance(floor,player)
  const floorCycle = f.weakenTime(floor,player)/1000 + 10
  return {target,phase,counts,ram,durations,security:ns.getServerSecurityLevel(target),moneyPct:ns.getServerMoneyAvailable(target)/server.moneyMax,
    projectedMoneyPerSecond:server.moneyMax*Math.max(fraction,percent)*chance/floorCycle,
    rank:server.moneyMax*fraction*chance/floorCycle/Math.max(ram,1)}
}

export function placeCloudBatch(counts, hosts, ram) {
  const free = hosts.map(h=>({...h})), placements=[]
  // Reserve the slow restoration work before accepting any hack.
  for (const action of ['weaken','grow','hack']) {
    let left = counts[action]
    for (const h of free) {
      const threads = Math.min(left,Math.floor((h.freeRam+1e-9)/ram[action]))
      if (threads>0) {placements.push({host:h.host,action,threads});h.freeRam-=threads*ram[action];left-=threads}
      if (!left) break
    }
    if (left>0) return null
  }
  return placements
}

export function fitCloudPreparation(plan, availableRam, ram, weakenPower) {
  if(plan.phase!=='prepare-money' && plan.phase!=='prepare-security')return plan
  const counts={...plan.counts}
  if(plan.phase==='prepare-security') counts.weaken=Math.min(counts.weaken,Math.floor(availableRam/ram.weaken))
  else {
    counts.grow=Math.min(counts.grow,Math.max(0,Math.floor((availableRam-ram.weaken)/(ram.grow+ram.weaken*.004/weakenPower))))
    counts.weaken=Math.ceil(counts.grow*.004/weakenPower)
  }
  const needed=Object.entries(counts).reduce((n,[a,t])=>n+t*ram[a],0)
  return {...plan,counts,ram:needed,partialPreparation:true}
}

export async function cloudTick(ns, state, {servers,workers,runId,objective,emit}) {
  let control
  try {control=JSON.parse(ns.read(CLOUD_CONTROL)||'{}')} catch {control={}}
  const enabled=control.enabled===true && objective!=='xp' && Number.isFinite(control.expiresAt) && Date.now()<control.expiresAt
  state.batches ||= new Map(); state.seq ||= 0; state.completed ||= 0
  if (!enabled) {
    if (state.active) {
      for(const batch of state.batches.values()) for(const job of batch.jobs) if(ns.isRunning(job.pid,job.host)) ns.kill(job.pid,job.host)
      emit('cloud_stop',{reason:'Control disabled, expired or XP selected',control,objective,completed:state.completed})
      state.batches.clear();state.active=false
    }
    return null
  }
  if(!ns.fileExists('Formulas.exe','home')) throw Error('Cloud batches require Formulas.exe')
  const fraction=Math.min(0.75,Math.max(0.1,Number(control.harvestFraction)||0.5))
  const limit=Math.min(32,Math.max(1,Math.floor(Number(control.maxTargets)||16)))
  if(!state.active) {
    // Single ownership transition: retire the old single-target allocation.
    for(const host of workers) for(const p of ns.ps(host)) if(Object.values(SCRIPTS).includes(p.filename.replace(/^\//,''))) ns.kill(p.pid,host)
    let fingerprint=5381;for(const c of ns.read('mcp_cloud.js'))fingerprint=((fingerprint*33)^c.charCodeAt(0))>>>0
    state.sourceFingerprint=fingerprint.toString(36)
    state.active=true;state.startedAt=Date.now();state.baseMoney=ns.getMoneySources().sinceInstall.hacking;state.lastMoney=state.baseMoney;state.lastAt=Date.now()
    emit('cloud_start',{control,fraction,limit,objective,workers})
  }
  for(const [target,batch] of state.batches) {
    if(batch.jobs.some(j=>ns.isRunning(j.pid,j.host)))continue
    const inputs={target,phase:batch.phase,counts:batch.counts,startedAt:batch.startedAt,elapsedSeconds:(Date.now()-batch.startedAt)/1000,
      moneyPct:ns.getServerMoneyAvailable(target)/ns.getServerMaxMoney(target),security:ns.getServerSecurityLevel(target),minSecurity:ns.getServerMinSecurityLevel(target)}
    emit('cloud_batch_complete',inputs);state.completed++;state.batches.delete(target)
  }
  const ram=Object.fromEntries(Object.entries(SCRIPTS).map(([a,file])=>[a,ns.getScriptRam(file,'home')]))
  const failures=[],waiting=[]
  const candidates=servers.filter(h=>h!=='home' && !ns.getServer(h).purchasedByPlayer && ns.hasRootAccess(h) && ns.getServerMaxMoney(h)>0 && ns.getServerRequiredHackingLevel(h)<=ns.getHackingLevel() && !state.batches.has(h))
    .map(h=>planCloudBatch(ns,h,fraction)).filter(Boolean).sort((a,b)=>(b.phase==='harvest')-(a.phase==='harvest') || b.rank-a.rank)
  for(let plan of candidates) {
    if(state.batches.size>=limit)break
    const hosts=workers.map(host=>({host,freeRam:Math.max(0,ns.getServerMaxRam(host)-ns.getServerUsedRam(host))})).sort((a,b)=>b.freeRam-a.freeRam)
    let placements=placeCloudBatch(plan.counts,hosts,ram)
    if(!placements && plan.phase.startsWith('prepare-')) {
      plan=fitCloudPreparation(plan,hosts.reduce((n,h)=>n+h.freeRam,0),ram,ns.weakenAnalyze(1,1))
      if(plan.counts.grow+plan.counts.weaken>0)placements=placeCloudBatch(plan.counts,hosts,ram)
    }
    if(!placements){waiting.push({target:plan.target,phase:plan.phase,neededRam:plan.ram});continue}
    const id=`${runId}:cloud:${++state.seq}`,jobs=[]
    let failed=false
    for(const host of new Set(placements.map(p=>p.host))) if(host!=='home' && !(await ns.scp(Object.values(SCRIPTS),host,'home'))) {failures.push({id,target:plan.target,host,reason:'scp failed'});failed=true;break}
    if(!failed)for(const [index,p] of placements.entries()) {
      const pid=ns.exec(SCRIPTS[p.action],p.host,p.threads,plan.target,'once',id,index)
      if(!pid){failures.push({...p,id,target:plan.target,freeRam:ns.getServerMaxRam(p.host)-ns.getServerUsedRam(p.host)});failed=true;break}
      jobs.push({...p,pid})
    }
    if(failed) {for(const j of jobs)ns.kill(j.pid,j.host);emit('cloud_launch_failed',{id,plan,failures});break}
    const batch={...plan,id,jobs,startedAt:Date.now()};state.batches.set(plan.target,batch)
    emit('cloud_batch_start',{id,target:plan.target,phase:plan.phase,counts:plan.counts,ram:plan.ram,partialPreparation:plan.partialPreparation||false,durations:plan.durations,security:plan.security,moneyPct:plan.moneyPct,jobs})
  }
  const now=Date.now(),money=ns.getMoneySources().sinceInstall.hacking,rate=(money-state.lastMoney)/Math.max(.001,(now-state.lastAt)/1000)
  state.lastMoney=money;state.lastAt=now
  const allocations=workers.map(host=>({host,maxRam:ns.getServerMaxRam(host),usedRam:ns.getServerUsedRam(host),freeRam:Math.max(0,ns.getServerMaxRam(host)-ns.getServerUsedRam(host)),
    actions:ns.ps(host).filter(p=>Object.values(SCRIPTS).includes(p.filename.replace(/^\//,''))).map(p=>({script:p.filename.replace(/^\//,'').replace('scripts/','').replace('.js',''),threads:p.threads,target:p.args[0]}))}))
  return {ts:now,runId,cloudSourceFingerprint:state.sourceFingerprint,workerMode:'finite',plan:'multi',weightBucket:'cloud-batches',target:[...state.batches.keys()][0]||null,
    targets:[...state.batches.values()].map(b=>({...b,moneyPct:ns.getServerMoneyAvailable(b.target)/ns.getServerMaxMoney(b.target),currentSecurity:ns.getServerSecurityLevel(b.target)})),
    workers:allocations,cloudWorkers:allocations.filter(h=>ns.getServer(h.host).purchasedByPlayer),rate,avgRate:(money-state.baseMoney)/Math.max(1,(now-state.startedAt)/1000),incomePerSec:rate,totalHacked:money-state.baseMoney,
    currentSecurity:0,moneyPct:0,expPerSec:0,ramUtilization:allocations.reduce((n,h)=>n+h.usedRam,0)/Math.max(1,allocations.reduce((n,h)=>n+h.maxRam,0)),
    workerLaunchFailures:failures,cloudControl:{...control,effectiveFraction:fraction,effectiveMaxTargets:limit},completedBatches:state.completed,waiting}
}
