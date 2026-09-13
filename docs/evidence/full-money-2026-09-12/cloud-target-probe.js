export async function main(ns) {
 const seen=new Set(['home']), queue=['home']; for(let i=0;i<queue.length;i++) for(const h of ns.scan(queue[i])) if(!seen.has(h)){seen.add(h);queue.push(h)}
 const player=ns.getPlayer(), rows=[];
 for(const h of queue){const s=ns.getServer(h);if(!s.hasAdminRights||s.purchasedByPlayer||!(s.moneyMax>0)||s.requiredHackingSkill>player.skills.hacking)continue;
 const actual={money:s.moneyAvailable/securityDummy(),security:s.hackDifficulty};s.hackDifficulty=s.minDifficulty;s.moneyAvailable=s.moneyMax;
 const f=ns.formulas.hacking,p=f.hackPercent(s,player),chance=f.hackChance(s,player),hack=f.hackTime(s,player)/1000,grow=f.growTime(s,player)/1000,weaken=f.weakenTime(s,player)/1000;
 if(!(p>0))continue;const ht=Math.max(1,Math.floor(.1/p)),fraction=Math.min(.99,ht*p);s.moneyAvailable=s.moneyMax*(1-fraction);const gt=Math.ceil(f.growThreads(s,player,s.moneyMax,1)),wt=Math.ceil((ht*.002+gt*.004)/ns.weakenAnalyze(1,1));
 const ramSeconds=ht*1.7*hack+gt*1.75*grow+wt*1.75*weaken, cycle=Math.max(weaken,grow,hack)+10;
 rows.push({host:h,maxMoney:s.moneyMax,moneyPct:actual.money/s.moneyMax,security:actual.security,minSecurity:s.minDifficulty,chance,hackSeconds:hack,growSeconds:grow,weakenSeconds:weaken,hackThreads:ht,growThreads:gt,weakenThreads:wt,batchRam:ht*1.7+(gt+wt)*1.75,averageRam:ramSeconds/cycle,conservativeDollarsPerSecond:s.moneyMax*fraction*chance/cycle});
 }
 rows.sort((a,b)=>b.conservativeDollarsPerSecond-a.conservativeDollarsPerSecond);await ns.write('cloud_multi_probe.json',JSON.stringify({ts:Date.now(),hacking:player.skills.hacking,rows},null,2),'w');ns.tprint('Cloud target assessment saved');
 function securityDummy(){return 1}
}
