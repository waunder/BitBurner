/** Durable control for MCP's multi-target mode; no purchases or resets. */
export async function main(ns) {
  const mode=String(ns.args[0]||'status')
  if(mode==='status'){ns.tprint(ns.read('mcp_cloud_control.json')||'Cloud mode disabled');return}
  if(!['on','off'].includes(mode)){ns.tprint('Usage: run set_cloud_mode.js [on|off|status] [minutes=120]');return}
  const minutes=Number(ns.args[1]??120)
  if(mode==='on' && (!Number.isFinite(minutes)||minutes<1||minutes>1440)) {ns.tprint('Minutes must be 1–1440');return}
  const control={enabled:mode==='on',harvestFraction:.5,maxTargets:32,expiresAt:mode==='on'?Date.now()+minutes*60000:Date.now(),setBy:'Ken via in-game command',ts:Date.now(),reason:`set_cloud_mode.js ${mode}`}
  await ns.write('mcp_cloud_control.json',JSON.stringify(control,null,2),'w');ns.tprint(`Cloud mode ${mode}; MCP applies within approximately ten seconds`)
}
