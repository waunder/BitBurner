/** Optional focused gang diagnostics; the default summary is in hud_consolidated.js. */
const POLL_MS = 5000;
const GREEN = "\u001b[1;32m";
const WHITE = "\u001b[1;37m";
const RESET = "\u001b[0m";
function money(n) {
  const value = Number(n) || 0;
  const abs = Math.abs(value);
  for (const [scale, unit] of [[1e12, "t"], [1e9, "b"], [1e6, "m"], [1e3, "k"]]) {
    if (abs >= scale) return `${value < 0 ? "-" : ""}${(abs / scale).toFixed(2)}${unit}`;
  }
  return `${value.toFixed(0)}`;
}
/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.openTail();
  ns.ui.setTailTitle("gang_detail");
  while (true) {
    let status = {}, policy = {};
    try { status = JSON.parse(ns.read("gang_status.json")); } catch {}
    try { policy = JSON.parse(ns.read("gang_capital_policy.json")); } catch {}
    const source = ns.getMoneySources().sinceInstall;
    const running = ns.isRunning("gang-controller.js", "home");
    const phase = policy.phase || "unknown";
    const candidate = status.capital?.candidate;
    const lines = [
      `GANG ${status.mode || "--"}  members ${status.members ?? "--"}`,
      `CAPITAL PHASE ${phase.toUpperCase()}  ${running ? "controller running" : "controller stopped"}`,
      `objective ${policy.objective || "not specified"}`,
      `earned ${money(source.gang || 0)}  gear ${money(source.gang_expenses || 0)}  net ${money((source.gang || 0) + (source.gang_expenses || 0))}`,
      `territory ${((status.gang?.territory || 0) * 100).toFixed(2)}%  warfare ${status.gang?.territoryWarfareEngaged ? "ON" : "off"}`,
      candidate ? `ROI ${candidate.item} ${money(candidate.cost)} → +${money(candidate.gain)}/s; payback ${Number.isFinite(candidate.paybackSeconds) ? `${candidate.paybackSeconds.toFixed(0)}s` : "none"}` : "ROI candidate --",
      `purchase ${status.capital?.purchaseAllowed ? "allowed by current gates" : status.capital?.blockedReason || "disabled"}`,
    ];
    ns.clearLog();
    for (const [index, line] of lines.entries()) ns.print(`${index < 2 ? WHITE : GREEN}${line}${RESET}`);
    await ns.sleep(POLL_MS);
  }
}
