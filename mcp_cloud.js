/** Finite multi-target batches, owned and observed by the existing MCP. */
export const CLOUD_CONTROL = 'mcp_cloud_control.json'
export const CLOUD_VERSION = 'finite-preparation-chunks-v7'
const SCRIPTS = {hack:'scripts/hack.js',grow:'scripts/grow.js',weaken:'scripts/weaken.js'}

export function planCloudBatch(ns, target, { protectedFloor = 0.25, recoveryTarget = 0.95 } = {}) {
  const server = ns.getServer(target), player = ns.getPlayer(), f = ns.formulas.hacking
  const startingMoney = server.moneyAvailable
  const weakenPower = ns.weakenAnalyze(1, 1)
  const excess = Math.max(0, server.hackDifficulty - server.minDifficulty)
  let phase, hack = 0, grow = 0, weaken = 0, plannedPercent = 0
  if (excess > 1.5) {
    phase = 'prepare-security'; weaken = Math.ceil(excess / weakenPower)
  } else {
    if (server.moneyAvailable < server.moneyMax * recoveryTarget) phase = 'prepare-money'
    else {
      phase = 'harvest'
      const percent = f.hackPercent(server, player)
      plannedPercent = percent
      if (!(percent > 0) || percent >= 1 || !(protectedFloor > 0 && protectedFloor < recoveryTarget)) return null
      // Bound the all-success case and retain a buffer above the 90% floor.
      const maxThreads = Math.floor(Math.log((server.moneyMax * protectedFloor) / server.moneyAvailable) / Math.log1p(-percent))
      hack = Math.max(0, Math.min(maxThreads, Math.floor(0.75 / percent)))
      if (!hack) return null
      server.moneyAvailable *= Math.pow(1 - percent, hack)
      server.hackDifficulty += hack * 0.002
    }
    grow = Math.ceil(f.growThreads(server, player, server.moneyMax * recoveryTarget, 1))
    weaken = Math.ceil((hack * 0.002 + grow * 0.004) / weakenPower)
  }
  const counts = {hack, grow, weaken}
  if (!Object.values(counts).every(x => Number.isFinite(x) && x >= 0)) return null
  const durations = {hack:ns.getHackTime(target)/1000,grow:ns.getGrowTime(target)/1000,weaken:ns.getWeakenTime(target)/1000}
  const ram = Object.entries(counts).reduce((n,[a,t])=>n+t*ns.getScriptRam(SCRIPTS[a],'home'),0)
  const floor = {...server,hackDifficulty:server.minDifficulty,moneyAvailable:server.moneyMax}
  const percent = f.hackPercent(floor,player), chance = f.hackChance(floor,player)
  const floorCycle = f.weakenTime(floor,player)/1000 + 10
  const expectedWithdrawal = phase === 'harvest' ? startingMoney * (1 - Math.pow(1 - plannedPercent, hack)) * chance : 0
  const ramSeconds = Object.entries(counts).reduce((n,[a,t])=>n+t*ns.getScriptRam(SCRIPTS[a],'home')*durations[a],0)
  // Score preparatory targets against the harvest they unlock, charging the
  // whole security/money preparation cost instead of assigning them rank 0.
  const ready={...ns.getServer(target),hackDifficulty:server.minDifficulty,moneyAvailable:server.moneyMax*recoveryTarget}
  const readyPercent=f.hackPercent(ready,player)
  const readyHack=readyPercent>0&&readyPercent<1
    ? Math.max(0,Math.min(Math.floor(Math.log(protectedFloor/recoveryTarget)/Math.log1p(-readyPercent)),Math.floor(.75/readyPercent))) : 0
  let futureWithdrawal=0,futureRamSeconds=0
  if(readyHack>0) {
    const afterHack={...ready,moneyAvailable:ready.moneyAvailable*Math.pow(1-readyPercent,readyHack),hackDifficulty:ready.hackDifficulty+readyHack*.002}
    const futureGrow=Math.ceil(f.growThreads(afterHack,player,server.moneyMax*recoveryTarget,1))
    const futureWeaken=Math.ceil((readyHack*.002+futureGrow*.004)/weakenPower)
    futureWithdrawal=ready.moneyAvailable*(1-Math.pow(1-readyPercent,readyHack))*f.hackChance(ready,player)
    futureRamSeconds=readyHack*ns.getScriptRam(SCRIPTS.hack,'home')*durations.hack+
      futureGrow*ns.getScriptRam(SCRIPTS.grow,'home')*durations.grow+
      futureWeaken*ns.getScriptRam(SCRIPTS.weaken,'home')*durations.weaken
  }
  let preparationRamSeconds=ramSeconds
  if(phase==='prepare-security' && server.moneyAvailable<server.moneyMax*recoveryTarget) {
    const prepared={...server,hackDifficulty:server.minDifficulty}
    const nextGrow=Math.ceil(f.growThreads(prepared,player,server.moneyMax*recoveryTarget,1))
    const nextWeaken=Math.ceil(nextGrow*.004/weakenPower)
    preparationRamSeconds+=nextGrow*ns.getScriptRam(SCRIPTS.grow,'home')*durations.grow+
      nextWeaken*ns.getScriptRam(SCRIPTS.weaken,'home')*durations.weaken
  }
  const rank=phase==='harvest'
    ? expectedWithdrawal/Math.max(ramSeconds,1)
    : futureWithdrawal/Math.max(preparationRamSeconds+futureRamSeconds,1)
  return {target,phase,counts,ram,durations,security:ns.getServerSecurityLevel(target),moneyPct:ns.getServerMoneyAvailable(target)/server.moneyMax,
    protectedFloor,recoveryTarget,projectedMoneyPerSecond:expectedWithdrawal/floorCycle,
    expectedWithdrawal,ramSeconds,futureWithdrawal,preparationRamSeconds,rank}
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

function limitHostsToRam(hosts, budget) {
  let remaining=Math.max(0,budget)
  return hosts.map(h=>{const freeRam=Math.min(h.freeRam,remaining);remaining-=freeRam;return {...h,freeRam}}).filter(h=>h.freeRam>0)
}

export function fitCloudPreparation(plan, availableRam, ram, weakenPower, hosts = null, minimumRam = 0) {
  if(plan.phase!=='prepare-money' && plan.phase!=='prepare-security')return plan
  const tryFit=counts=>{
    const needed=Object.entries(counts).reduce((n,[a,t])=>n+t*ram[a],0)
    if(needed+1e-9<minimumRam)return null
    if(needed>availableRam+1e-9)return null
    const placements=hosts?placeCloudBatch(counts,hosts,ram):null
    if(hosts&&!placements)return null
    return {...plan,counts,ram:needed,partialPreparation:true,...(placements?{placements}:{})}
  }
  if(plan.phase==='prepare-security') {
    const max=Math.min(plan.counts.weaken,Math.floor(availableRam/ram.weaken))
    for(let weaken=max;weaken>0;weaken--) {
      const fitted=tryFit({hack:0,grow:0,weaken})
      if(fitted)return fitted
    }
    return {...plan,counts:{hack:0,grow:0,weaken:0},ram:0,partialPreparation:true}
  }
  const max=Math.min(plan.counts.grow,Math.max(0,Math.floor((availableRam-ram.weaken)/(ram.grow+ram.weaken*.004/weakenPower))))
  for(let grow=max;grow>0;grow--) {
    const weaken=Math.ceil(grow*.004/weakenPower)
    const fitted=tryFit({hack:0,grow,weaken})
    if(fitted)return fitted
  }
  return {...plan,counts:{hack:0,grow:0,weaken:0},ram:0,partialPreparation:true}
}

export function fitCloudHarvest(ns, plan, hosts, ram) {
  if(plan.phase!=='harvest')return null
  const source=ns.getServer(plan.target), player=ns.getPlayer(), f=ns.formulas.hacking
  const percent=f.hackPercent(source,player), weakenPower=ns.weakenAnalyze(1,1)
  for(let hack=plan.counts.hack-1;hack>=1;hack--) {
    const afterHack={...source,moneyAvailable:source.moneyAvailable*Math.pow(1-percent,hack),hackDifficulty:source.hackDifficulty+hack*.002}
    if(afterHack.moneyAvailable<source.moneyMax*plan.protectedFloor)continue
    const grow=Math.ceil(f.growThreads(afterHack,player,source.moneyMax*plan.recoveryTarget,1))
    const weaken=Math.ceil((hack*.002+grow*.004)/weakenPower)
    const counts={hack,grow,weaken},needed=Object.entries(counts).reduce((n,[a,t])=>n+t*ram[a],0)
    if(needed>hosts.reduce((n,h)=>n+h.freeRam,0)+1e-9)continue
    const placements=placeCloudBatch(counts,hosts,ram)
    if(!placements)continue
    const durations={hack:ns.getHackTime(plan.target)/1000,grow:ns.getGrowTime(plan.target)/1000,weaken:ns.getWeakenTime(plan.target)/1000}
    const expectedWithdrawal=source.moneyAvailable*(1-Math.pow(1-percent,hack))*f.hackChance(source,player)
    const ramSeconds=Object.entries(counts).reduce((n,[a,t])=>n+t*ram[a]*durations[a],0)
    return {...plan,counts,ram:needed,durations,expectedWithdrawal,ramSeconds,rank:expectedWithdrawal/Math.max(ramSeconds,1),partialHarvest:true,placements}
  }
  return null
}

/** Poll only near a cohort's final completion; other modes keep their cadence. */
export function cloudWakeDelay(status, now, nominalMs, enabled) {
  if(!enabled || status.workerMode!=='finite') return nominalMs
  const deadlines=(status.targets||[]).filter(b=>b.phase==='harvest' && Number.isFinite(b.startedAt))
    .map(b=>b.startedAt+Math.max(...Object.entries(b.counts||{}).filter(([,n])=>n>0).map(([a])=>b.durations?.[a]*1000))+100)
    .filter(Number.isFinite)
  if(!deadlines.length)return nominalMs
  return Math.max(200,Math.min(nominalMs,Math.min(...deadlines)-now))
}

/** Hold finished harvest slots until its final restoration job completes. */
export function cloudAdmissionHosts(ns, workers, batches, ram, reserveHarvestRam) {
  const held=new Map()
  if(reserveHarvestRam)for(const batch of batches.values()) {
    if(batch.phase!=='harvest')continue
    for(const job of batch.jobs)if(!ns.isRunning(job.pid,job.host)) {
      held.set(job.host,(held.get(job.host)||0)+job.threads*ram[job.action])
    }
  }
  return workers.map(host=>({host,reservedRam:held.get(host)||0,
    freeRam:Math.max(0,ns.getServerMaxRam(host)-ns.getServerUsedRam(host)-(held.get(host)||0))}))
    .sort((a,b)=>b.freeRam-a.freeRam)
}

/** Reuse a prior manager's exact finite cohort evidence across a restart. */
export function adoptCloudCohorts(ns, workers) {
  let previous
  try {previous=JSON.parse(ns.read('mcp_cloud_status.json'))} catch {return []}
  const hosts=new Set(workers),adopted=[]
  if(!Array.isArray(previous?.targets))return adopted
  for(const batch of previous.targets) {
    if(!batch || typeof batch!=='object' || typeof batch.target!=='string' || typeof batch.id!=='string' || !Array.isArray(batch.jobs) || !batch.counts || !batch.durations || !Number.isFinite(batch.startedAt))continue
    if(!batch.jobs.every(j=>j && typeof j.host==='string' && Number.isInteger(j.pid) && j.pid>0 && Number.isInteger(j.threads) && j.threads>0 && j.action in SCRIPTS))continue
    const live=batch.jobs.filter(j=>hosts.has(j.host)&&ns.isRunning(j.pid,j.host))
    if(!live.length)continue
    const valid=live.every(j=>ns.ps(j.host).some(p=>p.pid===j.pid && p.filename.replace(/^\//,'')===SCRIPTS[j.action] && p.threads===j.threads &&
      p.args[0]===batch.target && p.args[1]==='once' && p.args[2]===batch.id))
    if(valid)adopted.push(batch)
  }
  return adopted
}

/** Startup must retire legacy loops without interrupting finite restoration. */
export function retireLegacyActionWorkers(ns, hosts) {
  let killedHosts=0
  for(const host of new Set(hosts)) {
    let killed=false
    for(const process of ns.ps(host)) {
      if(Object.values(SCRIPTS).includes(process.filename.replace(/^\//,'')) && process.args[1]!=='once') {
        killed=ns.kill(process.pid,host)||killed
      }
    }
    if(killed)killedHosts++
  }
  return killedHosts
}

export async function cloudTick(ns, state, {servers,workers,runId,objective,emit,reserveHarvestRam=false}) {
  let control
  try {control=JSON.parse(ns.read(CLOUD_CONTROL)||'{}')} catch {control={}}
  const enabled=control.enabled===true && objective!=='xp' && (control.expiresAt==null || (Number.isFinite(control.expiresAt) && Date.now()<control.expiresAt))
  state.batches ||= new Map(); state.seq ||= 0; state.completed ||= 0
  if (!enabled) {
    const orphanTargets=new Set(workers.flatMap(host=>ns.ps(host)
      .filter(p=>Object.values(SCRIPTS).includes(p.filename.replace(/^\//,'')) && p.args[1]==='once')
      .map(p=>String(p.args[0]))))
    if(!state.active && orphanTargets.size) return {ts:Date.now(),runId,workerMode:'finite-draining',plan:'multi',phase:'draining',target:[...orphanTargets][0],targets:[...orphanTargets],workers:[],cloudControl:control,completedBatches:state.completed,waiting:[]}
    if (state.active) {
      // Stop admitting work, but let finite restoration jobs settle before
      // relinquishing target ownership to the continuous scheduler.
      for(const [target,batch] of state.batches) {
        // Security-only preparation has no hack/grow restoration debt. Do
        // not idle the whole XP pool behind a tiny, long-running weaken.
        if(objective==='xp' && batch.phase==='prepare-security') {
          for(const job of batch.jobs) if(ns.isRunning(job.pid,job.host)) ns.kill(job.pid)
          if(!batch.jobs.some(j=>ns.isRunning(j.pid,j.host))) {
            emit('cloud_batch_cancel',{target,phase:batch.phase,counts:batch.counts,
              reason:'XP selected; security-only preparation has no restoration debt'})
            state.batches.delete(target)
            continue
          }
        }
        if(batch.jobs.some(j=>ns.isRunning(j.pid,j.host)))continue
        emit('cloud_batch_complete',{target,phase:batch.phase,counts:batch.counts,draining:true,
          moneyPct:ns.getServerMoneyAvailable(target)/ns.getServerMaxMoney(target),security:ns.getServerSecurityLevel(target)})
        state.completed++;state.batches.delete(target)
      }
      if(state.batches.size) return {ts:Date.now(),runId,workerMode:'finite-draining',plan:'multi',phase:'draining',target:[...state.batches.keys()][0],targets:[...state.batches.keys()],workers:[],cloudControl:control,completedBatches:state.completed,waiting:[]}
      emit('cloud_stop',{reason:'Control disabled, expired or XP selected; active finite batches settled',control,objective,completed:state.completed})
      state.active=false
    }
    return null
  }
  if(!ns.fileExists('Formulas.exe','home')) throw Error('Cloud batches require Formulas.exe')
  // Keep targets individually recoverable, but admit the whole money-server
  // pool. The former 91% minimum made any target whose one-thread hack
  // exceeded the 3–4% gap between recovery and floor impossible to schedule.
  // Hack batches remain capped at 75% withdrawal in planCloudBatch.
  const protectedFloor=Math.max(0.05,Math.min(0.95,Number(control.protectedFloor)||0.25))
  const recoveryTarget=Math.max(protectedFloor+0.01,Math.min(1,Number(control.recoveryTarget)||0.95))
  const preparationRamFraction=Math.max(0.05,Math.min(0.85,Number(control.preparationRamFraction)||0.65))
  // A quarter of the preparation allowance funds a useful chunk instead of
  // locking a target behind a one-thread call. Small complete plans still fit.
  // Explicit zero restores legacy admission for a reversible comparison.
  const minimumPreparationFraction=Number.isFinite(control.minimumPreparationFraction)
    ? Math.max(0,Math.min(1,control.minimumPreparationFraction)) : 0.25
  // Bound scheduler/pid overhead relative to the actual worker fleet instead
  // of the old fixed 32-target ceiling, which capped this 43-host network near
  // one third RAM utilization with small safe cohorts.
  const fleetLimit=Math.min(192,Math.max(64,workers.length*2))
  const limit=Math.min(fleetLimit,Math.max(1,Math.floor(Number(control.maxTargets)||128)))
  if(!state.active) {
    // Retire old looping allocations, but preserve finite cohorts that may be
    // completing restoration across an MCP restart.
    for(const host of workers) for(const p of ns.ps(host))
      if(Object.values(SCRIPTS).includes(p.filename.replace(/^\//,'')) && p.args[1] !== 'once') ns.kill(p.pid,host)
    const staleLoops=workers.flatMap(host=>ns.ps(host).filter(p=>Object.values(SCRIPTS).includes(p.filename.replace(/^\//,'')) && p.args[1] !== 'once').map(p=>({host,pid:p.pid})))
    if(staleLoops.length) throw Error(`Could not retire looping action workers: ${JSON.stringify(staleLoops)}`)
    if(reserveHarvestRam)for(const batch of adoptCloudCohorts(ns,workers)) {
      state.batches.set(batch.target,batch)
      emit('cloud_batch_adopt',{target:batch.target,id:batch.id,phase:batch.phase,reason:'Validated prior cohort; preserve restoration slots across manager restart'})
    }
    state.sourceFingerprint=CLOUD_VERSION
    state.active=true;state.startedAt=Date.now();state.baseMoney=ns.getMoneySources().sinceInstall.hacking;state.lastMoney=state.baseMoney;state.lastAt=Date.now()
    emit('cloud_start',{control,protectedFloor,recoveryTarget,limit,objective,workers,policyVersion:CLOUD_VERSION})
  }
  for(const [target,batch] of state.batches) {
    if(batch.jobs.some(j=>ns.isRunning(j.pid,j.host)))continue
    const inputs={target,phase:batch.phase,counts:batch.counts,startedAt:batch.startedAt,elapsedSeconds:(Date.now()-batch.startedAt)/1000,
      moneyPct:ns.getServerMoneyAvailable(target)/ns.getServerMaxMoney(target),security:ns.getServerSecurityLevel(target),minSecurity:ns.getServerMinSecurityLevel(target)}
    emit('cloud_batch_complete',inputs);state.completed++;state.batches.delete(target)
  }
  const ram=Object.fromEntries(Object.entries(SCRIPTS).map(([a,file])=>[a,ns.getScriptRam(file,'home')]))
  const failures=[],waiting=[]
  const managedPids=new Set([...state.batches.values()].flatMap(b=>b.jobs.map(j=>j.pid)))
  const orphanFiniteRam=workers.flatMap(host=>ns.ps(host)
    .filter(p=>Object.values(SCRIPTS).includes(p.filename.replace(/^\//,''))&&p.args[1]==='once'&&!managedPids.has(p.pid))
    .map(p=>p.threads*ns.getScriptRam(p.filename,host))).reduce((a,b)=>a+b,0)
  const activePreparationRam=[...state.batches.values()].filter(b=>b.phase!=='harvest').reduce((n,b)=>n+b.ram,0)+orphanFiniteRam
  const fleetRam=workers.reduce((n,h)=>n+ns.getServerMaxRam(h),0)
  const minimumPreparationRam=fleetRam*preparationRamFraction*minimumPreparationFraction
  let preparationRamRemaining=Math.max(0,fleetRam*preparationRamFraction-activePreparationRam)
  const finiteTargets=new Set(workers.flatMap(host=>ns.ps(host)
    .filter(p=>Object.values(SCRIPTS).includes(p.filename.replace(/^\//,'')) && p.args[1]==='once')
    .map(p=>String(p.args[0]))))
  const candidates=servers.filter(h=>h!=='home' && !ns.getServer(h).purchasedByPlayer && ns.hasRootAccess(h) && ns.getServerMaxMoney(h)>0 && ns.getServerRequiredHackingLevel(h)<=ns.getHackingLevel() && !state.batches.has(h) && !finiteTargets.has(h))
    .map(h=>planCloudBatch(ns,h,{protectedFloor,recoveryTarget})).filter(Boolean).sort((a,b)=>b.rank-a.rank)
  for(let plan of candidates) {
    if(state.batches.size>=limit)break
    const hosts=cloudAdmissionHosts(ns,workers,state.batches,ram,reserveHarvestRam)
    let placementHosts=hosts
    const minimumRam=plan.phase.startsWith('prepare-')?Math.min(plan.ram,minimumPreparationRam):0
    if(plan.phase.startsWith('prepare-')) {
      if(preparationRamRemaining<1){waiting.push({target:plan.target,phase:plan.phase,reason:'preparation RAM share is in use'});continue}
      placementHosts=limitHostsToRam(hosts,preparationRamRemaining)
    }
    let placements=placeCloudBatch(plan.counts,placementHosts,ram)
    if(!placements && plan.phase==='harvest') {
      const fitted=fitCloudHarvest(ns,plan,hosts,ram)
      if(fitted) {plan=fitted;placements=fitted.placements}
    }
    if(!placements && plan.phase.startsWith('prepare-')) {
      const prepHosts=limitHostsToRam(hosts,preparationRamRemaining)
      const prepCapacity=prepHosts.reduce((n,h)=>n+h.freeRam,0)
      if(prepCapacity+1e-9<minimumRam) {
        waiting.push({target:plan.target,phase:plan.phase,reason:'waiting for useful preparation chunk',availableRam:prepCapacity,minimumRam,neededRam:plan.ram})
        continue
      }
      plan=fitCloudPreparation(plan,prepCapacity,ram,ns.weakenAnalyze(1,1),prepHosts,minimumRam)
      placements=plan.placements||null
    }
    if(!placements){waiting.push({target:plan.target,phase:plan.phase,neededRam:plan.ram,minimumRam});continue}
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
    if(plan.phase.startsWith('prepare-'))preparationRamRemaining=Math.max(0,preparationRamRemaining-plan.ram)
    emit('cloud_batch_start',{id,target:plan.target,phase:plan.phase,counts:plan.counts,ram:plan.ram,partialPreparation:plan.partialPreparation||false,partialHarvest:plan.partialHarvest||false,durations:plan.durations,security:plan.security,moneyPct:plan.moneyPct,jobs})
  }
  const now=Date.now(),money=ns.getMoneySources().sinceInstall.hacking,rate=(money-state.lastMoney)/Math.max(.001,(now-state.lastAt)/1000)
  state.lastMoney=money;state.lastAt=now
  const allocations=workers.map(host=>({host,maxRam:ns.getServerMaxRam(host),usedRam:ns.getServerUsedRam(host),freeRam:Math.max(0,ns.getServerMaxRam(host)-ns.getServerUsedRam(host)),
    actions:ns.ps(host).filter(p=>Object.values(SCRIPTS).includes(p.filename.replace(/^\//,''))).map(p=>({script:p.filename.replace(/^\//,'').replace('scripts/','').replace('.js',''),threads:p.threads,target:p.args[0]}))}))
  const cloudNames=ns.cloud.getServerNames(),cloudRamLimit=ns.cloud.getRamLimit()
  const cloudCapacity={serverCount:cloudNames.length,serverLimit:ns.cloud.getServerLimit(),ramLimitPerServer:cloudRamLimit,
    currentRam:cloudNames.reduce((n,h)=>n+ns.getServerMaxRam(h),0),nextMaxServerCost:ns.cloud.getServerCost(cloudRamLimit)}
  const primaryTarget=[...state.batches.keys()][0]||null,primary=primaryTarget?state.batches.get(primaryTarget):null
  return {ts:now,runId,cloudSourceFingerprint:state.sourceFingerprint,workerMode:'finite',plan:'multi',phase:primary?.phase||(waiting.length?'capacity-wait':'idle'),weightBucket:'cloud-batches',target:primaryTarget,
    targets:[...state.batches.values()].map(b=>({...b,moneyPct:ns.getServerMoneyAvailable(b.target)/ns.getServerMaxMoney(b.target),currentSecurity:ns.getServerSecurityLevel(b.target)})),
    workers:allocations,cloudWorkers:allocations.filter(h=>ns.getServer(h.host).purchasedByPlayer),rate,avgRate:(money-state.baseMoney)/Math.max(1,(now-state.startedAt)/1000),incomePerSec:rate,totalHacked:money-state.baseMoney,
    currentSecurity:primary?ns.getServerSecurityLevel(primaryTarget):0,moneyPct:primary?ns.getServerMoneyAvailable(primaryTarget)/ns.getServerMaxMoney(primaryTarget):0,expPerSec:0,ramUtilization:allocations.reduce((n,h)=>n+h.usedRam,0)/Math.max(1,allocations.reduce((n,h)=>n+h.maxRam,0)),
    reservedRestorationRam:cloudAdmissionHosts(ns,workers,state.batches,ram,reserveHarvestRam).reduce((n,h)=>n+h.reservedRam,0),workerLaunchFailures:failures,cloudCapacity,cloudControl:{...control,effectiveProtectedFloor:protectedFloor,effectiveRecoveryTarget:recoveryTarget,effectivePreparationRamFraction:preparationRamFraction,effectivePreparationRamRemaining:preparationRamRemaining,effectiveMinimumPreparationFraction:minimumPreparationFraction,effectiveMinimumPreparationRam:minimumPreparationRam,effectiveMaxTargets:limit},completedBatches:state.completed,waiting}
}
