/** Toggle HUD sections - supports short names
 *
 * Usage:
 *   hm   # Toggle MCP
 *   hd   # Toggle Darknet
 *   hc   # Toggle Contracts
 *   ha   # Toggle Augmentation
 *   hs   # Toggle System
 *   hn   # Collapse all
 *
 * Or run directly:
 *   run hud_toggle.js m
 *   run hud_toggle.js d
 *   run hud_toggle.js c
 *   run hud_toggle.js a
 *   run hud_toggle.js s
 *   run hud_toggle.js n
 */

export async function main(ns) {
  const arg = String(ns.args[0] || "").toLowerCase().trim()

  // Map short names to full section names
  const shortMap = {
    m: "mcp",
    d: "darknet",
    c: "cct",
    a: "aug",
    s: "system",
    n: "none",
  }

  const section = shortMap[arg] || arg
  const valid = ["mcp", "darknet", "cct", "aug", "system", "none"]

  if (!valid.includes(section)) {
    ns.tprint(`Invalid section: ${arg}`)
    ns.tprint(`Valid: m(cp), d(arknet), c(ct), a(ug), s(ystem), n(one-collapse)`)
    return
  }

  try {
    const state = JSON.parse(ns.read("hud_consolidated_state.json"))
    state.expanded = state.expanded === section ? null : section
    ns.write("hud_consolidated_state.json", JSON.stringify(state, null, 2), "w")

    const label = {
      mcp: "MCP",
      darknet: "Darknet",
      cct: "Contracts",
      aug: "Augmentation",
      system: "System",
      none: "all",
    }[section]

    ns.tprint(`${label} ${state.expanded === section ? "expanded" : "collapsed"}`)
  } catch (e) {
    ns.tprint("HUD not running. Start with: hud")
  }
}
