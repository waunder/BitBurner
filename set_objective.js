/**
 * Self-serve lever for mcp.js's OBJECTIVE (money/xp), so switching doesn't
 * need a Claude session in the loop. Writes mcp_objective_override.txt —
 * deliberately NOT mcp_config.json, which is the git-tracked,
 * disk-authoritative source pushed one-way disk->game; an in-game edit
 * straight to it would silently revert on the next disk resync. This file
 * is only ever written from here and read by mcp.js, so it survives that.
 *
 * Usage: run set_objective.js money|xp|clear
 * "clear" removes the override — mcp.js falls back to mcp_config.json's
 * OBJECTIVE (currently "money"). Takes effect on mcp.js's next config
 * check (every tick, ~10s) — no restart needed.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const arg = (ns.args[0] ?? "").toString().trim().toLowerCase()
  const valid = ["money", "xp", "clear"]
  if (!valid.includes(arg)) {
    ns.tprint(`set_objective: usage: run set_objective.js money|xp|clear`)
    return
  }

  const file = "mcp_objective_override.txt"
  if (arg === "clear") {
    ns.write(file, "", "w")
    ns.tprint(`set_objective: override cleared — mcp.js will use mcp_config.json's OBJECTIVE again`)
    return
  }

  ns.write(file, arg, "w")
  ns.tprint(`set_objective: override set to "${arg}" — mcp.js picks it up within ~10s, no restart needed`)
}
