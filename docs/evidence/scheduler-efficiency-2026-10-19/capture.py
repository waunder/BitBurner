import asyncio,json,sys,time,statistics
from pathlib import Path
sys.path.insert(0,'/Users/Shared/BitBurner/tools')
import bb_remote
phase=sys.argv[1];duration=float(sys.argv[2]);output=Path('/tmp/bb-cadence-'+phase+'.json')
async def main():
 prior=json.loads(output.read_text()) if len(sys.argv)>3 and sys.argv[3]=='resume' else {}
 rows=prior.get('samples',[]);events={(e['runId'],e['seq']):e for e in prior.get('events',[])};begin=time.monotonic();last_log=-30;identity=rows[0]['runId'] if rows else None
 while True:
  response=await bb_remote._ctl_call(12527,{'cmd':'get','file':'mcp_status.json'})
  if not response.get('ok'):raise RuntimeError(response)
  s=json.loads(response['result'])
  if s.get('config',{}).get('OBJECTIVE')!='money':raise RuntimeError('Objective changed; stop assessment without overriding player choice')
  if s.get('workerMode')!='finite':raise RuntimeError('Worker mode changed: '+str(s.get('workerMode')))
  if time.time()*1000-s['ts']>30000:raise RuntimeError('Telemetry stale')
  if identity is None:identity=s['runId']
  if s['runId']!=identity:raise RuntimeError('Manager restarted; matched comparison invalid')
  if phase=='baseline2' and s.get('pollPolicy')!='fixed':
   await asyncio.sleep(1);continue
  row={k:s.get(k) for k in ['ts','runId','totalHacked','completedBatches','rate','ramUtilization','invariantViolations','workerLaunchFailures','waiting','pollPolicy','nextPollMs','reservedRestorationRam']}
  row['hackingLevel']=s['player']['skills']['hacking'];row['capacityGb']=sum(w['maxRam'] for w in s['workers'])
  row['targetStates']=[{k:t.get(k) for k in ['target','phase','moneyPct','currentSecurity','startedAt','counts','durations']} for t in s.get('targets',[]) if isinstance(t,dict)]
  if not rows or rows[-1]['ts']!=row['ts']:rows.append(row)
  for event in s.get('recentEvents',[]):events[(event['runId'],event['seq'])]=event
  output.write_text(json.dumps({'phase':phase,'samples':rows,'events':list(events.values())},indent=2)+'\n')
  elapsed=time.monotonic()-begin
  if elapsed-last_log>=30 or elapsed>=duration:
   a=rows[0];dt=(row['ts']-a['ts'])/1000
   print(json.dumps({'phase':phase,'elapsed':round(elapsed,1),'samples':len(rows),'measuredSeconds':dt,'incomePerSecond':(row['totalHacked']-a['totalHacked'])/dt if dt else None,'completed':row['completedBatches']-a['completedBatches'],'hacking':row['hackingLevel'],'capacityGb':row['capacityGb']}),flush=True);last_log=elapsed
  if elapsed>=duration:break
  await asyncio.sleep(min(2,duration-elapsed))
asyncio.run(main())
