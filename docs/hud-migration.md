# HUD Migration: Old → Consolidated

**Timeline:** Immediate (2026-09-02)

This guide covers migrating from separate HUDs to the new unified dashboard.

---

## What's Changing

### Being Replaced
- **mcp_money.js** → Consolidated HUD (MCP section)
- **dnet_scorecard.js** → Consolidated HUD (Darknet section)
- **ops_hud.js** → Consolidated HUD (Augmentation section)

### Staying (for now)
- **mcp_xp.js** → Progression tracking (can be merged later)

---

## Migration Steps

### Step 1: Launch Consolidated HUD

```javascript
run hud_consolidated.js
```

This creates a new panel with all metrics in one place.

### Step 2: Verify Data

Let it run for 1-2 cycles (10 seconds). Check that all sections show data:
- MCP: Shows $/min, target, worker count ✓
- Darknet: Shows manager count or "PAUSED" ✓
- Augmentation: Shows XP rate, time to next purchase ✓
- System: Shows API & MCP status ✓

### Step 3: Kill Old HUDs

Once consolidated HUD is working:

```javascript
ns.kill("mcp_money.js", "home")
ns.kill("dnet_scorecard.js", "home")
ns.kill("ops_hud.js", "home")
```

Or from terminal:
```
kill mcp_money.js
kill dnet_scorecard.js
kill ops_hud.js
```

### Step 4: Update startup.js

In `startup.js`, replace:
```javascript
ns.run("mcp_money.js", 1)
ns.run("dnet_scorecard.js", 1)
ns.run("ops_hud.js", 1)
```

With:
```javascript
ns.run("hud_consolidated.js", 1)
```

This launches the unified HUD on every startup.

---

## Configuration

### Default Layout
Bottom-right, 320×240 pixels. Good for 1440+ width screens.

### Adjust for Your Screen
```javascript
run hud_consolidated.js x=500 y=300 w=300 h=200
```

Common positions:
- **Top-right:** `x=1100 y=50`
- **Top-left:** `x=20 y=50`
- **Bottom-left:** `x=20 y=600`
- **Center:** `x=600 y=400`

---

## Feature Comparison

| Feature | Old | New | Notes |
|---------|-----|-----|-------|
| MCP money rate | ✓ | ✓ | Same data source |
| Darknet status | ✓ | ✓ | More compact |
| XP rate | ✓ | ✓ | Shows in Aug section |
| Time to next aug | ✓ | ✓ | Shows in Aug section |
| Click to expand | ✗ | ✓ | **New feature** |
| Color coding | ✗ | ✓ | **New: Red/Yellow/Green** |
| Active/pending | ✗ | ✓ | **New: Shows what's running** |
| Single window | ✗ | ✓ | **New: Consolidated** |
| Resizable | ✗ | ✓ | **New: x/y/w/h args** |

---

## Troubleshooting Migration

### Old HUDs still showing
- Check they're actually killed: `ps | grep mcp_money`
- Kill manually if needed: `kill mcp_money.js`

### New HUD shows blank sections
- Wait 10 seconds for first data poll
- Check that MCP/Darknet are generating status files
- Run MCP: `run mcp.js` to generate mcp_status.json

### Want to keep old HUD for comparison
- That's fine! Run both for a session to compare
- Consolidated HUD will supersede eventually, but no rush
- Just don't run both on every startup (wastes resources)

---

## Old HUD Archive

Original scripts remain in the repo for reference:
- `mcp_money.js` — Original MCP HUD
- `dnet_scorecard.js` — Original darknet HUD
- `ops_hud.js` — Original augmentation HUD

These can be deleted once consolidated HUD is stable.

---

## Benefits of Consolidation

1. **Single window** — No window hunting
2. **Compact by default** — All metrics fit on one screen
3. **Drill-down** — Click to expand what you care about
4. **Color feedback** — Visual status at a glance
5. **Less RAM** — One HUD instead of three
6. **Easier maintenance** — One script to update instead of three

---

## Next Steps

1. Run `hud_consolidated.js` now
2. Verify all sections populate with data
3. Update `startup.js` when comfortable
4. Kill old HUDs
5. Done! 

The unified HUD will be your main dashboard going forward.
