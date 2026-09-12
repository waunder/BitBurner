import fs from 'node:fs';
import * as logic from '/Users/Shared/BitBurner/mcp_logic.js';
const text=fs.readFileSync('/Users/Shared/BitBurner/mcp.js','utf8');
const start=text.indexOf('function allocateThreads('), end=text.indexOf('\n}',start)+2;
const allocate = new Function('hostNeedsRedeploy','countRunningByScript','missingActionLaunchPlan','getRunningActions','describeRunningActions','getHostFreeRam','copyActionScripts',text.slice(start,end)+';return allocateThreads')(
logic.hostNeedsRedeploy,logic.countRunningByScript,logic.missingActionLaunchPlan,
ns=>ns.procs.map(proc=>({proc,normalized:`/scripts/${proc.script}.js`})),
(ns,r)=>r.map(({proc})=>({...proc,target:'target',elapsedS:1000})),
ns=>175-ns.getServerUsedRam(),()=>{}
);
const calls=[];
const ns={procs:[{pid:1,script:'grow',threads:100}],getServerMaxRam:()=>175,getServerUsedRam(){return this.procs.reduce((n,p)=>n+p.threads*1.75,0)},getScriptRam:()=>1.75,kill(pid){this.procs=this.procs.filter(p=>p.pid!==pid);calls.push(['kill',pid]);return true},exec(file,host,threads){const free=175-this.getServerUsedRam();const ok=free>=threads*1.75;calls.push(['exec',file,threads,free,ok]);if(ok)this.procs.push({pid:Math.random(),script:file.split('/').pop().split('.')[0],threads});return ok?2:0}};
const result=allocate(ns,'cloud','target',{type:'weaken'},{hack:0,grow:90,weaken:10},{absolute:0,relative:0},{grow:32,weaken:40,hack:10});
console.log(JSON.stringify({case:'full grow to grow/weaken',calls,result},null,2));
console.log('redeploy in middle of second grow call:',logic.hostNeedsRedeploy({target:'target',plan:{type:'work'},running:[{script:'grow',target:'target',threads:100,elapsedS:50}],desired:{grow:90,weaken:10,hack:0},tolerance:{absolute:0,relative:0},actionDurationsS:{grow:32,weaken:40,hack:10}}));
const constants={hackSecIncrease:.002,growSecIncrease:.004,weakenSecDecrease:.05,weakenPerHackRatio:4,weakenPerGrowRatio:1.25};
const weights=logic.computeWorkWeights({objective:'money',hackPercentPerThread:.002723981297786129,growLogPerThread:.0018944701332868222,moneyPct:1,targetMoneyGoal:.95,safety:.5,...constants});
const allocation=logic.computeDesiredAllocation({hosts:[{host:'cloud',reclaimableRam:4096}],plan:{type:'work',weights:weights.weights},weakenBudget:0,ramInfo:{hackRam:1.7,growRam:1.75,weakenRam:1.75,minRam:1.7},securityConstants:constants});
const row=allocation.allocations[0]; const q=row.hack*.002723981297786129;
console.log(JSON.stringify({weights,allocation,q,linear:q,logLoss:-Math.log(1-q),underestimateFactor:-Math.log(1-q)/q,maintenanceNeeded:logic.weakenThreadsToOffset(row.hack,row.grow,constants),growthLogPerCycle:row.grow*.0018944701332868222},null,2));
