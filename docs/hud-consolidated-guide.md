# Consolidated Interactive HUD

**New unified dashboard** replacing mcp_money.js, dnet_scorecard.js, ops_hud.js.

Single compact panel showing MCP, Darknet, Contracts, IPvGO, Augmentation, and
System status (Contracts added 2026-09-02, IPvGO added 2026-09-05 — this doc
went stale for a while and is corrected as of the IPvGO addition).

**Toggle sections via `hud_toggle.js`, not by clicking.** The panel's own
doc comment mentions a background click detector
(`hud_click_monitor.js`) that would let you click a section header to
expand/collapse it — that file doesn't exist anywhere in this repo (never
built, not in `sync_manifest.json`), so `ns.run("hud_click_monitor.js", 1)`
in `hud_consolidated.js` always silently fails its own try/catch. Section
toggling only actually works via the terminal command below.

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
Contracts  42 accepted 95% success
IPvGO ✓  9x9 The Black Hand 67% (3g)
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

**From terminal** (this is the only way — see the click-detector note
above):
```javascript
run hud_toggle.js mcp       // Expand/collapse MCP
run hud_toggle.js darknet
run hud_toggle.js cct
run hud_toggle.js ipvgo
run hud_toggle.js aug
run hud_toggle.js system
run hud_toggle.js none      // Collapse all
```

Short forms also work (`run hud_toggle.js g` toggles IPvGO, etc. — see
`hud_toggle.js`'s own header comment for the full short-name list).

**Create aliases** for quick access:
```javascript
alias hud-mcp="run hud_toggle.js mcp"
alias hud-dnet="run hud_toggle.js darknet"
alias hud-cct="run hud_toggle.js cct"
alias hud-go="run hud_toggle.js ipvgo"
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

### Contracts
**Compact:** Total accepted, success rate  
**Expanded:**
- Total contracts (accepted/failed breakdown)
- Success rate (overall and Claude-solver-specific, when tracked)
- Cumulative cash from rewards
- Top faction reputation reward seen

### IPvGO
**Compact:** Running/stopped, board size, target faction (⚠ if not a
member — see below), rolling win rate  
**Expanded:**
- Algorithm generation tag (bumps whenever the search itself changes —
  see `docs/ipvgo-strategy.md`)
- Target faction/board size, and whether you're currently a member (the
  win-streak favor payout needs membership; territory-based stat bonuses
  don't)
- Lifetime record, rolling win rate, current streak
- Last game's result and average move time
- Favor/reputation and stat-multiplier bonus from `ns.go.analysis.getStats()`

Uses a much longer staleness window (45 minutes) than every other
section — `ipvgo_player.js` only writes its status file at the start/end
of each game, not every move, so a single game can easily run past the
5-minute window every other section uses without that being a real
problem.

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
Top-left corner (0, 0), resolution-agnostic, with 360×280 size — corrected
2026-09-05; this doc previously (and incorrectly) said bottom-right
(900, 600) with 320×240, which doesn't match `hud_consolidated.js`'s own
`DEFAULT_X`/`DEFAULT_Y`/`DEFAULT_W`/`DEFAULT_H` constants.

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
