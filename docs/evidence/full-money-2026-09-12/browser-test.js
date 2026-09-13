import {hostNeedsRedeploy,countRunningByScript,missingActionLaunchPlan,computeDesiredAllocation} from './mcp_logic.js'
const ACTION_SCRIPTS=['/scripts/weaken.js','/scripts/grow.js','/scripts/hack.js']
function getHostFreeRam(ns,host) {return ns.getServerMaxRam(host)-ns.getServerUsedRam(host)}
function getRunningActions(ns, host) {
  const running = []
  for (const proc of ns.ps(host)) {
    const normalized = proc.filename.startsWith("/") ? proc.filename : "/" + proc.filename
    if (ACTION_SCRIPTS.includes(normalized)) {
      running.push({ proc, normalized })
    }
  }
  return running
}
function describeRunningActions(ns, running, host) {
  return running.map(({ proc, normalized }) => {
    let elapsedS = 0
    const runningScript = ns.getRunningScript(proc.pid, host)
    if (runningScript) elapsedS = runningScript.onlineRunningTime
    return {
      script: normalized.replace("/scripts/", "").replace(".js", ""),
      target: proc.args[0],
      threads: proc.threads,
      elapsedS,
      finite: proc.args[1] === "once",
    }
  })
}
function allocateThreads(ns, host, target, plan, desired, tolerance, actionDurationsS) {
  /** @type {{script: string, threads: number}[]} */
  const actions = []
  const allocation = {
    host,
    maxRam: ns.getServerMaxRam(host),
    usedRam: 0,
    freeRam: 0,
    actions,
    launchFailures: [],
    desired: {...desired},
  }

  const running = getRunningActions(ns, host)
  const describedRunning = describeRunningActions(ns, running, host)
  const needsRedeploy = hostNeedsRedeploy({
    target,
    plan,
    running: describedRunning,
    desired,
    tolerance,
    actionDurationsS,
  })
  const missingLaunches = missingActionLaunchPlan(describedRunning, desired, getHostFreeRam(ns, host), {
    weaken: ns.getScriptRam("/scripts/weaken.js"),
    grow: ns.getScriptRam("/scripts/grow.js"),
    hack: ns.getScriptRam("/scripts/hack.js"),
  })
  if (!needsRedeploy) {
    // A still-young action must not block launching an entirely missing
    // complementary action. Keep the in-flight process intact, but use the
    // otherwise idle RAM for the newly desired script now.
    if (missingLaunches.length > 0) {
      if (host !== "home") copyActionScripts(ns, host)
      for (const { proc, normalized } of running) {
        const script = normalized.replace("/scripts/", "").replace(".js", "")
        allocation.actions.push({ script, threads: proc.threads })
      }
      for (const { script, threads } of missingLaunches) {
        if (ns.exec(`/scripts/${script}.js`, host, threads, target, "once") !== 0) {
          allocation.actions.push({ script, threads })
        } else {
          allocation.launchFailures.push({host, script, threads, target, freeRam: getHostFreeRam(ns, host)})
        }
      }
      allocation.usedRam = ns.getServerUsedRam(host)
      allocation.freeRam = getHostFreeRam(ns, host)
      return allocation
    }
    allocation.usedRam = ns.getServerUsedRam(host)
    allocation.freeRam = getHostFreeRam(ns, host)
    for (const { proc, normalized } of running) {
      const script = normalized.replace("/scripts/", "").replace(".js", "")
      allocation.actions.push({ script, threads: proc.threads })
    }
    return allocation
  }

  // The scripts already live on every worker host except home (R7: home is
  // now a worker too, but it's where mcp.js itself runs, so scripts/ is
  // already there — scp-ing home to itself is pure overhead). Matches the
  // same guard share_deploy.js uses for the same reason.
  if (host !== "home") copyActionScripts(ns, host)

  const have = countRunningByScript(describedRunning)
  const runningByScript = {}
  for (const { proc, normalized } of running) {
    const script = normalized.replace("/scripts/", "").replace(".js", "")
    runningByScript[script] = proc
  }
  // Free every changed job before launching any replacement. Otherwise a
  // full grow host can reject weaken before grow releases its old RAM.
  const changed = new Set(["weaken", "grow", "hack"].filter(script =>
    (desired[script] || 0) !== have[script] || (runningByScript[script] && runningByScript[script].args[0] !== target)))
  for (const script of changed) {
    if (runningByScript[script]) ns.kill(runningByScript[script].pid, host)
  }
  for (const script of ["weaken", "grow", "hack"]) {
    const want = desired[script] || 0
    if (!changed.has(script)) {
      if (want > 0) allocation.actions.push({ script, threads: want })
      continue
    }
    if (want > 0) {
      if (ns.exec(`/scripts/${script}.js`, host, want, target, "once") !== 0) {
        allocation.actions.push({ script, threads: want })
      } else {
        allocation.launchFailures.push({host, script, threads: want, target, freeRam: getHostFreeRam(ns, host)})
      }
    }
  }

  // Read RAM back *after* exec so maxRam/usedRam/freeRam describe one
  // consistent moment and actually reconcile with the actions listed.
  allocation.usedRam = ns.getServerUsedRam(host)
  allocation.freeRam = getHostFreeRam(ns, host)
  return allocation
}
function copyActionScripts(ns, host) {
  ns.scp(ACTION_SCRIPTS, host)
}
export async function main(ns) {
  ns.disableLog('ALL')
  const evidence={started:Date.now(),samples:[],checks:[],complete:false}
  const save=async()=>{await ns.write('full_money_browser_test.json',JSON.stringify(evidence),'w')}
  const check=(name,ok,inputs)=>{evidence.checks.push({name,ok,inputs}); if(!ok)throw new Error(name)}
  ns.nuke('n00dles'); ns.killall('n00dles'); await ns.scp(ACTION_SCRIPTS,'n00dles')
  const pid=ns.exec('/scripts/grow.js','n00dles',2,'n00dles','once')
  check('full RAM grow started',pid>0,{pid,ram:ns.getServerUsedRam('n00dles')})
  const running=describeRunningActions(ns,getRunningActions(ns,'n00dles'),'n00dles')
  check('remote process age available',Number.isFinite(running[0].elapsedS),running)
  let allocation=allocateThreads(ns,'n00dles','n00dles',{type:'weaken'},{hack:0,grow:0,weaken:2},{absolute:0,relative:0},{hack:1,grow:1,weaken:1})
  check('finite grow survives changed allocation',ns.isRunning(pid,'n00dles'),allocation)
  await save()
  while(ns.isRunning(pid,'n00dles')){await ns.sleep(1000);await save()}
  allocation=allocateThreads(ns,'n00dles','n00dles',{type:'weaken'},{hack:0,grow:0,weaken:1},{absolute:0,relative:0},{hack:1,grow:1,weaken:1})
  check('weaken replaces completed grow on full host',allocation.actions.some(a=>a.script==='weaken'&&a.threads===1),allocation)
  const wp=ns.ps('n00dles')[0].pid
  check('replacement is finite',ns.ps('n00dles')[0].args[1]==='once',ns.ps('n00dles'))
  for(let cycle=0;cycle<2;cycle++) {
    const before={money:ns.getServerMoneyAvailable('n00dles'),security:ns.getServerSecurityLevel('n00dles')}
    allocation=allocateThreads(ns,'n00dles','n00dles',{type:'work'},{hack:1,grow:0,weaken:1},{absolute:0,relative:0},{hack:1,grow:1,weaken:1})
    const hp=ns.ps('n00dles').find(p=>p.filename.endsWith('hack.js')).pid
    while(ns.isRunning(hp,'n00dles')){await ns.sleep(1000);await save()}
    evidence.samples.push({cycle,before,after:{money:ns.getServerMoneyAvailable('n00dles'),security:ns.getServerSecurityLevel('n00dles')},remaining:ns.ps('n00dles')})
    check('hack exits after one call '+cycle,!ns.ps('n00dles').some(p=>p.filename.endsWith('hack.js')),evidence.samples.at(-1))
  }
  while(ns.ps('n00dles').length){await ns.sleep(1000);await save()}
  check('worker RAM released after completion',ns.getServerUsedRam('n00dles')===0,{ram:ns.getServerUsedRam('n00dles')})
  evidence.complete=true;evidence.ended=Date.now();await save();ns.tprint('Full money lifecycle integration test passed')
}
