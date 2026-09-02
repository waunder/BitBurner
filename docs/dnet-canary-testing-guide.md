# Darknet Canary Testing Guide

**Updated**: 2026-09-02  
**Status**: Ready for Phase 1 testing

---

## Overview

This guide orchestrates Phase 1 of the **Darknet Canary Protocol** — a controlled 1-manager test designed to identify the freeze cause without risking full darknet restart.

**Key insight from testing prep:** The `dnet_scorecard.js` HUD reads/parses hundreds of credential shards every 30 seconds and could be the freeze culprit. This protocol **disables it entirely** and logs detailed measurements.

---

## Prerequisites

Before running ANY test:

1. **MCP running stable** — at least 30 minutes clean, no errors
2. **Remote API daemon connected** — game shows "Connected" in Options → Remote API
3. **Recovery plan ready** — you know how to use `dnet_killswarm.js` if needed
4. **No other new code** — baseline is important for diagnosis

---

## Quick Start: Run Phase 1

**Option A: Automated wrapper (recommended)**

```bash
# From terminal, in BitBurner repo directory:
bash tools/dnet_canary_test.sh

# This will:
# 1. Kill scorecard (eliminates interference)
# 2. Run 3x 5-minute single-manager tests
# 3. Monitor CPU, game responsiveness, manager count
# 4. Log all results to docs/darknet-canary-log.md
# 5. Stop immediately on freeze detection
```

**Option B: Manual in-game test**

```javascript
// In Bitburner terminal:
run dnet_canary_phase1.js

// This runs a single 5-minute test with MAX_ACTIVE_MANAGERS=1
// Results written to dnet_canary_phase1_completed.txt
```

---

## Detailed Walkthrough: Automated Test

### Step 1: Check Prerequisites

```bash
# Terminal:
bash tools/dnet_canary_test.sh --phase 1 --runs 1
```

The script will:
- ✅ Verify Remote API daemon is running
- ✅ Verify game is connected to daemon
- ✅ Kill scorecard to eliminate interference
- ❌ Exit with error if anything is wrong

Fix any errors before proceeding.

### Step 2: Run Full Phase 1 (3 Runs, 30-Min Waits)

```bash
bash tools/dnet_canary_test.sh --phase 1 --runs 3
```

This will:

**Run 1:**
- Launch dnet_root.js with MAX_ACTIVE_MANAGERS=1
- Monitor for 5 minutes
- Log: CPU peak, manager count, any incidents
- Kill darknet
- Wait 30 minutes

**Run 2 & 3:**
- Repeat same test
- If any freeze detected, stop immediately
- Document incident and stop

**Expected output:**
```
[13:42:30] ✅ Remote API daemon responsive
[13:42:31] ✅ Game connected to Remote API
[13:42:32] ✅ Scorecard terminated
[13:42:33] 
[13:42:33] Starting Phase 1 Canary Protocol (3 runs)
[13:42:33] Duration per run: 300 seconds
[13:42:33] Interval between runs: 30 minutes
...
[13:48:50] ✅ Test completed: CPU peak 45%, 1 managers
[13:48:51] Cleaning up darknet processes...
[13:48:52] 
[13:48:52] Waiting 30 minutes before next run...
[14:18:52] Starting run 2...
...
```

### Step 3: Interpret Results

**Test logs** saved to: `docs/darknet-canary-log.md`

**Success Criteria** (all 3 runs):
- ✅ No freeze (game responsive throughout)
- ✅ CPU <100% (no sustained spike)
- ✅ Manager count 0-1 (expected for test)
- ✅ No Remote API disconnections
- ✅ Timestamps consistent

**If any freeze occurs:**
- ⚠️ Stops immediately at that run
- 📋 Logs timestamp, CPU peak, manager count
- 📍 Marks as "FREEZE DETECTED"
- Next step: **Do NOT attempt run 2 or higher manager counts**

---

## What the Files Do

| File | Purpose |
|------|---------|
| `tools/dnet_canary_test.sh` | Main test orchestrator (shell wrapper) |
| `dnet_canary_phase1.js` | In-game test launcher (runs dnet_root.js with config) |
| `docs/darknet-canary-log.md` | Test results markdown (auto-generated) |
| `dnet_canary_config.json` | Temp config (written during test, deleted after) |
| `dnet_canary_phase1_completed.txt` | Per-run result marker (JSON) |

---

## Troubleshooting

### "Remote API daemon not responding"
```bash
# Start the daemon:
nohup python3 tools/bb_remote.py daemon --port 12526 --control-port 12527 >> tools/bb_remote_daemon.log 2>&1 &
```

### "Game not connected to Remote API"
In Bitburner:
1. Open Options → Remote API
2. Port should be 12526
3. Click "Connect" button

### Test hangs (seems frozen)
Press Ctrl+C to cancel the wrapper. Check game manually — if the game UI is frozen:
1. Kill Bitburner process from terminal: `pkill -f "Bitburner"`
2. Relaunch Bitburner
3. Results should show freeze timestamp in canary-log.md

---

## Next Steps Based on Results

### ✅ Phase 1 Succeeds (All 3 Runs, No Freeze)

The 1-manager configuration is stable. Scorecard elimination worked.

**Next action:**
1. Document findings in `docs/darknet-investigation.md`
2. Re-enable scorecard (optimize it later)
3. Run Phase 2 canary (2 managers, 10 minutes) if approved
4. Start Phase 3 if both succeed (full darknet)

### ❌ Phase 1 Fails (Freeze at 1 Manager)

Freeze is NOT caused by manager count, propagation, or concurrent load.

**Root cause is likely:** `ns.dnet.probe()`, `getServerDetails()`, `authenticate()` API costs on this save's 586+ host network.

**Next action:**
1. **Read Bitburner's bundled game source** for actual API costs
   - Search: `ns.dnet.probe`, `getServerDetails`, `authenticate`
   - Measure overhead per call against network size
   - Document findings
2. **Do NOT attempt Phase 2 or higher**
3. **Consider:** Darknet might be structurally incompatible with this save's network size
4. **Design around:** Smaller network, cached probe results, or accept limitation

---

## Monitoring During Test

### What to Watch For (🚨 Stop Immediately)

- **Game UI freeze** — Input doesn't respond, can't click
- **CPU spike >120%** — Single-thread renderer overload
- **Remote API disconnects** — Game loses connection
- **Renderer pegging** — Visual artifacts, stuttering

### Yellow Flags (⚠️ Log But Continue)

- CPU 80-100% (high but not maxed)
- Latency spike (response slow but working)
- Registry growing faster than expected
- Auth timeouts on darknet calls

### Green Flags (✅ Continue Confidently)

- CPU steady <60%
- Normal game responsiveness
- Registry stable at 0-1 entry
- No connection drops
- Heartbeats consistent

---

## Interpreting the Scorecard Fix

**Why scorecard is disabled:**

The `dnet_scorecard.js` HUD has quadratic behavior:
- Reads all credential shards every 30 seconds
- Parses 586+ host records across dozens of files
- On a 586-host darknet: **thousands of JSON.parse() calls per poll**
- If concurrent with darknet operations: file contention + CPU spike

**If Phase 1 succeeds:**
- Scorecard was the culprit (not ns.dnet APIs)
- Can re-enable but should optimize (cache, lazy-load, higher cadence)

**If Phase 1 fails:**
- Scorecard is not the issue
- Problem is structural to darknet + this save's network

---

## Timeline

- **Phase 1 (3 runs):** ~2 hours (30m runtime + 90m waits)
- **Analysis:** 15 minutes
- **Decision:** Immediate (freeze or no freeze)

Total: 2-3 hours for Phase 1 diagnosis.

---

## Resources

- Protocol reference: `DNET_CANARY_PROTOCOL.md`
- Darknet strategy: `docs/darknet-strategy.md`
- Investigation findings: `docs/darknet-investigation.md` (to be created)
- Test results: `docs/darknet-canary-log.md` (auto-generated)
