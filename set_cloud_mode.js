/** Durable control for MCP's multi-target mode; no purchases or resets. */
export async function main(ns) {
  const mode=String(ns.args[0]||'status')
  if(mode==='status'){ns.tprint(ns.read('mcp_cloud_control.json')||'Cloud mode disabled');return}
  if(!['on','off'].includes(mode)){ns.tprint('Usage: run set_cloud_mode.js [on|off] [minutes] [prep fraction] (on is persistent unless minutes is supplied)');return}
  const prepFraction=ns.args[2]===undefined?.85:Number(ns.args[2])
  if(!Number.isFinite(prepFraction)||prepFraction<.05||prepFraction>.85){ns.tprint('Preparation RAM fraction must be between 0.05 and 0.85');return}
  const control={enabled:mode==='on',protectedFloor:.25,recoveryTarget:.95,preparationRamFraction:prepFraction,maxTargets:128,
    setBy:'MCP operator',ts:Date.now(),reason:`set_cloud_mode.js ${mode}`}
  if(mode==='on' && ns.args[1]!==undefined) {
    const minutes=Number(ns.args[1])
    if(!Number.isFinite(minutes)||minutes<1||minutes>1440) {ns.tprint('Minutes must be 1–1440');return}
    control.expiresAt=Date.now()+minutes*60000
  }
  await ns.write('mcp_cloud_control.json',JSON.stringify(control,null,2),'w');ns.tprint(`Finite cloud mode ${mode}${control.expiresAt?` for ${ns.args[1]} minutes`:' (persistent)'}; MCP applies within approximately ten seconds`)
}
