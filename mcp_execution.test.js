import fs from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {hostNeedsRedeploy,countRunningByScript,missingActionLaunchPlan} from './mcp_logic.js'
const source=fs.readFileSync(new URL('./mcp.js',import.meta.url),'utf8')
function extract(name) {const start=source.indexOf(`function ${name}(`);return source.slice(start,source.indexOf('\n}',start)+2)}
const allocate=new Function('hostNeedsRedeploy','countRunningByScript','missingActionLaunchPlan',`
const ACTION_SCRIPTS=['/scripts/weaken.js','/scripts/grow.js','/scripts/hack.js'];
function getHostFreeRam(ns,host){return ns.getServerMaxRam(host)-ns.getServerUsedRam(host)}
${['getRunningActions','describeRunningActions','copyActionScripts','allocateThreads'].map(extract).join('\n')}
return allocateThreads;
`)(hostNeedsRedeploy,countRunningByScript,missingActionLaunchPlan)
function fixture(args=['target']) {
 const ns={procs:[{pid:1,filename:'/scripts/grow.js',threads:100,args}],calls:[],ps(host){assert.equal(host,'cloud');return this.procs},getRunningScript(pid,host){assert.equal(host,'cloud');return {onlineRunningTime:1000}},getServerMaxRam:()=>175,getServerUsedRam(){return this.procs.reduce((n,p)=>n+p.threads*1.75,0)},getScriptRam:()=>1.75,scp(){return true},kill(pid,host){assert.equal(host,'cloud');this.calls.push(['kill',pid]);this.procs=this.procs.filter(p=>p.pid!==pid);return true},exec(file,host,threads,...args){this.calls.push(['exec',file,threads]);if(this.fail || this.getServerUsedRam()+threads*1.75>175)return 0;const pid=this.calls.length+1;this.procs.push({pid,filename:file,threads,args});return pid}}
 return ns
}
const run=(ns,desired,target='target')=>allocate(ns,'cloud',target,{type:'weaken'},desired,{absolute:0,relative:0},{grow:32,weaken:40,hack:10})
test('full grow host releases RAM before new weaken launch',()=>{
 const ns=fixture();const r=run(ns,{grow:90,weaken:10,hack:0})
 assert.deepEqual(r.actions,[{script:'weaken',threads:10},{script:'grow',threads:90}]);assert.deepEqual(r.launchFailures,[])
 assert.equal(ns.procs[0].args[1],undefined)
})
test('normal MCP workers launch continuously',()=>{
 const ns=fixture();run(ns,{grow:90,weaken:10,hack:0})
 assert.ok(ns.procs.every(p=>p.args.length===1))
})
test('finite calls are preserved despite a complete allocation change',()=>{
 const ns=fixture(['target','once']);run(ns,{grow:0,weaken:100,hack:0});assert.deepEqual(ns.calls,[])
})
test('wrong target is replaced even when quantities match',()=>{
 const ns=fixture(['old','once']);run(ns,{grow:100,weaken:0,hack:0});assert.equal(ns.procs[0].args[0],'target')
})
test('failed launch is exposed for the invariant and event stream',()=>{
 const ns=fixture();ns.fail=true;const r=run(ns,{grow:0,weaken:100,hack:0})
 assert.deepEqual(r.actions,[]);assert.equal(r.launchFailures.length,1);assert.equal(r.launchFailures[0].freeRam,175)
})

test('unknown remote age does not cancel a legacy action',()=>{
 const ns=fixture();ns.getRunningScript=()=>null;run(ns,{grow:0,weaken:100,hack:0});assert.deepEqual(ns.calls,[])
})

// Execute the real planning wrapper against a readable target fixture.
import {computeWorkWeights,SECURITY_EPSILON} from './mcp_logic.js'
const planFor=new Function('computeWorkWeights','SECURITY_EPSILON','OBJECTIVE',`
const SECURITY_CAP=1,WORK_SECURITY_MARGIN=1.5,WEAKEN_SEC_DECREASE=.05,TARGET_MONEY_GOAL=.95,HACK_BALANCE_SAFETY=.5,HACK_WITHDRAWAL_FRACTION=.25,XP_WEIGHT_HACK=.95,XP_WEIGHT_GROW=.05;
const SECURITY_CONSTANTS={hackSecIncrease:.002,growSecIncrease:.004,weakenSecDecrease:.05,weakenPerHackRatio:4,weakenPerGrowRatio:1.25};
${extract('getTargetWeakenThreads')}
${extract('buildPlan')}
return buildPlan;
`)
const targetNs=(moneyPct=1,security=7)=>({getServerSecurityLevel:()=>security,getServerMinSecurityLevel:()=>7,getServerMoneyAvailable:()=>600e6*moneyPct,getServerMaxMoney:()=>600e6,hackAnalyze:()=>.002,growthAnalyze:()=>100})
test('actual planner uses bounded harvesting at full money and minimum security',()=>{
 const p=planFor(computeWorkWeights,SECURITY_EPSILON,'reputation')(targetNs(),'phantasy',false)
 assert.equal(p.type,'work');assert.equal(p.harvestOnly,true);assert.equal(p.hackBudget,125)
})
test('actual planner stabilizes excess security before harvesting',()=>{
 const p=planFor(computeWorkWeights,SECURITY_EPSILON,'money')(targetNs(1,9),'phantasy',false)
 assert.equal(p.type,'weaken');assert.equal(p.moneyPct,1)
})
test('actual planner restores growth after a harvest',()=>{
 const p=planFor(computeWorkWeights,SECURITY_EPSILON,'money')(targetNs(.9),'phantasy',true)
 assert.ok(p.weights.grow>0);assert.equal(p.harvestOnly,false);assert.equal(p.hackBudget,125)
})
test('XP objective retains its own work weights at full money',()=>{
 const p=planFor(computeWorkWeights,SECURITY_EPSILON,'xp')(targetNs(),'phantasy',true)
 assert.deepEqual(p.weights,{hack:.95,grow:.05});assert.equal(p.hackBudget,undefined)
})
