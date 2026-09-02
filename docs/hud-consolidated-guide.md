# Consolidated Interactive HUD

**New unified dashboard** replacing mcp_money.js, dnet_scorecard.js, ops_hud.js.

Single compact panel showing MCP, Darknet, Augmentation, and System status. Click sections to expand/collapse for details.

---

## Quick Start

```javascript
// In Bitburner terminal:
run hud_consolidated.js
```

This launches the HUD at default position (bottom-right, 320×240).

---

## Features

### Compact View (Default)
Shows 1 line per system with key metrics:
```
MCP ✓  2.8m/min  target: foo
Darknet ⏸  PAUSED
Aug +850 XP/min → next in 2h 14m
System  API ✓  MCP ✓
```

### Expanded View
Click/toggle a section to see full details:
```
MCP ✓  2.8m/min  target: foo
────────────────────────────────────
  MCP Status: RUNNING
  Target: foodnstuff
  $/min: 2.84m
  Total: 5.2b
  Workers: 8
  Freshness: now
```

### Color Coding
- 🟢 **Green**: Healthy/running
- 🟡 **Yellow**: Warning (canary, stale)
- 🔴 **Red**: Critical/down
- ⚠️ **Gray**: Paused/idle

---

## Toggling Sections

**From terminal** (quick toggle):
```javascript
run hud_toggle.js mcp       // Expand/collapse MCP
run hud_toggle.js darknet
run hud_toggle.js aug
run hud_toggle.js system
run hud_toggle.js none      // Collapse all
```

**Create aliases** for quick access:
```javascript
alias hud-mcp="run hud_toggle.js mcp"
alias hud-dnet="run hud_toggle.js darknet"
alias hud-aug="run hud_toggle.js aug"
alias hud-sys="run hud_toggle.js system"
```

Then just type: `hud-mcp` to toggle MCP expanded view.

---

## What Each Section Shows

### MCP
**Compact:** $/min, target, status  
**Expanded:** 
- Status (RUNNING/STOPPED)
- Current target server
- Money per minute
- Total hacked since start
- Worker count
- Data freshness

### Darknet
**Compact:** State (PAUSED/CANARY/ACTIVE), manager count  
**Expanded:**
- Darknet state
- Manager count & details
- Registry entry count

### Augmentation
**Compact:** XP rate, time to next purchase  
**Expanded:**
- Current charisma
- XP per minute
- Time to next augmentation

### System
**Compact:** Remote API & MCP status  
**Expanded:**
- API connection health
- MCP data freshness
- Overall system health

---

## Customization

### Position & Size
```javascript
run hud_consolidated.js x=100 y=200 w=400 h=300
```

- `x`, `y`: Window position in pixels
- `w`, `h`: Window width/height in pixels

### Default Position
Bottom-right corner (900, 600) with 320×240 size.

---

## What It Replaces

| Old Script | Replaced By | Status |
|-----------|-----------|--------|
| `mcp_money.js` | `hud_consolidated.js` | **Kill** |
| `dnet_scorecard.js` | `hud_consolidated.js` | **Kill** |
| `ops_hud.js` | `hud_consolidated.js` | **Keep for now** (XP data) |
| `mcp_xp.js` | `hud_consolidated.js` | **Keep for now** (progression tracking) |

**Deprecation plan:**
1. Run `hud_consolidated.js` alongside existing HUDs for 1-2 sessions
2. Kill old HUDs once consolidated HUD data looks good
3. Archive old scripts for reference

---

## State Persistence

HUD state (which section is expanded) is saved to `hud_consolidated_state.json`.

This persists across script restarts so your expanded section stays expanded.

---

## Troubleshooting

### HUD shows "--" for all metrics
- MCP status file missing (mcp_status.json)
- Run MCP to generate it: `run mcp.js`

### Some metrics missing
- Data files not yet generated (first run of MCP/Darknet)
- Wait 1-2 cycles for telemetry to populate

### HUD position wrong
- Specify position: `run hud_consolidated.js x=100 y=100`
- Default is bottom-right; adjust to suit your screen

### Toggle doesn't work
- Make sure `hud_consolidated.js` is running
- Check for errors in terminal

---

## Design Philosophy

**Compact by default** → All sections fit on screen at once, no scrolling  
**Drill-down model** → Click section to expand, see the details you need  
**Active/pending focus** → Shows what's running now, warns about what needs attention  
**Single pane of glass** → All critical info in one place, no window hunting

---

## Future Enhancements

- Keyboard shortcuts (M/D/A/S to toggle sections)
- Mouse click detection (when Bitburner API supports it)
- Drag-to-reposition
- Custom metric selection
- Dark/light theme toggle
