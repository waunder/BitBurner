/** Toggle expanded section in consolidated HUD
 *
 * Usage (from terminal):
 *   run hud_toggle.js mcp        # Expand/collapse MCP section
 *   run hud_toggle.js darknet
 *   run hud_toggle.js aug
 *   run hud_toggle.js system
 *   run hud_toggle.js none       # Collapse all
 *
 * Or create shortcuts:
 *   alias hud-mcp="run hud_toggle.js mcp"
 *   alias hud-dnet="run hud_toggle.js darknet"
 */

export async function main(ns) {
  const section = String(ns.args[0] || "none").toLowerCase()

  const valid = ["mcp", "darknet", "aug", "system", "none"]
  if (!valid.includes(section)) {
    ns.tprint(`Invalid section: ${section}`)
    ns.tprint(`Valid: ${valid.join(", ")}`)
    return
  }

  try {
    const state = JSON.parse(ns.read("hud_consolidated_state.json"))
    state.expanded = state.expanded === section ? null : section
    ns.write("hud_consolidated_state.json", JSON.stringify(state, null, 2), "w")
    ns.tprint(`HUD: ${section === "none" ? "all collapsed" : section + " expanded"}`)
  } catch (e) {
    ns.tprint("HUD state not found. Start hud_consolidated.js first.")
  }
}
