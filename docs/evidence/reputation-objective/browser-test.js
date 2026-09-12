import { reconcileReputation } from './mcp_reputation.js'

export async function main(ns) {
  ns.disableLog('ALL')
  const events = [], samples = []
  const runId = `browser-reputation-${Date.now()}`
  const options = {objective:'reputation', hosts:['foodnstuff'], reserveHomeGb:32, runId,
    emit:(kind,inputs)=>events.push({ts:Date.now(),source:'browser-reputation-test',runId,kind,...inputs})}
  ns.nuke('foodnstuff')
  await ns.write('reputation_config.json',JSON.stringify({enabled:true,ramGb:12}),'w')
  const baselinePower = ns.getSharePower()
  const baselineRam = ns.getServerUsedRam('foodnstuff')
  let state = {}
  for(let i=0;i<5;i++) {
    state = await reconcileReputation(ns,state,options)
    samples.push({ts:Date.now(),state,power:ns.getSharePower(),ram:ns.getServerUsedRam('foodnstuff'),processes:ns.ps('foodnstuff')})
    await ns.write('reputation_browser_test.json',JSON.stringify({runId,baselinePower,baselineRam,events,samples,complete:false}),'w')
    await ns.sleep(11_000)
  }
  state = await reconcileReputation(ns,state,{...options,objective:'money'})
  await ns.sleep(11_000)
  const stopped = {state,power:ns.getSharePower(),ram:ns.getServerUsedRam('foodnstuff'),processes:ns.ps('foodnstuff')}
  await ns.write('reputation_browser_test.json',JSON.stringify({runId,baselinePower,baselineRam,events,samples,stopped,complete:true}),'w')
  ns.tprint(`Reputation integration test complete: stopped power=${stopped.power}; RAM=${stopped.ram}`)
}
