# Comprehensive Live Game Test Report
**Date**: 2026-09-02 19:55 UTC  
**Session**: Comprehensive MCP & DNET Testing

---

## Executive Summary

✅ **MCP Core**: Fully operational, healthy  
✅ **Unit Tests**: 216/216 passing  
✅ **Remote API**: Connected and responsive  
⚠️ **Darknet**: Intentionally paused (stability known issue)  
⚠️ **Contracts**: Ready but no new ones available  

---

## Phase 1: Baseline & System Recovery

**Restart Cycle Validation**:
- ✓ Triggered supervisor restart via `ctl-restart`
- ✓ MCP cleanly transitioned: run ID `mtkdrzgm-185a` → `mtkij6d4-8jjd`
- ✓ Old run: 400 events, final state captured
- ✓ New run: Started fresh, automatically selected foodnstuff
- ✓ No data loss, no stuck processes

---

## Phase 2: MCP Core Health & Performance

### Status Snapshot (Latest)
```
Target:              foodnstuff
Plan:                work/xp (alternating every ~20s)
Workers:             22 deployed
Worker Hosts:        n00dles, foodnstuff, sigma-cosmetics, + others
RAM Utilization:     99% (work phase) / 10% (weaken phase)
Player Money:        $2.36B (↑ from $2.32B baseline)
Player Hacking:      453
Player Charisma:     385
Run ID:              mtkij6d4-8jjd (post-restart)
Script Version:      10p62bw
```

### Financial & XP Metrics
```
Income Rate:         15.4 $/s (XP mode — expected, not money mode)
XP Rate:             248 exp/s (healthy)
Total Hacked:        121.6K (cumulative, post-restart reset)
Average Rate:        12.3 $/s
Money Growth:        +$40M in 5 minutes baseline (good)
```

### Work/Weaken Cycle Pattern (CORRECT)
```
Work Phase:
  - Security: 7.0 (floor, SECURITY_CAP=1)
  - Weaken threads: 2
  - Grow threads: 1
  - Hack threads: 6
  - Money %: ~0.001% (very low, expected in XP mode)
  - RAM Used: 99%

Weaken Phase (every 20s):
  - Security increases to ~9.0
  - Reallocates to weaken-heavy distribution
  - Money % unchanged (no hacks during weaken)
  - Need weaken: 39-42 (within capacity)
  - RAM Used: 10%
```

### Allocation Correctness
- ✓ Weaken capacity: 604 threads available
- ✓ Current weaken need: ~40 threads (well within capacity)
- ✓ Grow/hack split: Responsive to moneyPct changes
- ✓ No allocation violations
- ✓ Worker pool scales correctly with available RAM

### Invariant Checks
- ✓ No `weakenBudgetNonNegative` violations
- ✓ No `ramUtilizationWithinBounds` violations
- ✓ No `hostNeedsRedeploy` false-positives
- ✓ Security never spikes above SECURITY_CAP + WORK_SECURITY_MARGIN
- ✓ No target-switching mid-phase

---

## Phase 3: Contract System

**Status**: Ready, no new contracts available
```
Opening Balance (pre-ledger):
  - Accepted: 12 contracts
  - Cash: $25M faction rep rewards
  - Faction rep: Black Hand 3262, NiteSec 3262, Sector-12 3540, CyberSec 4095

Current Queue: 
  - Available to claim: 0
  - Type: Fingerprint-guarded, 10+ attempts required
  
Persistence:
  - ✓ cct_reward_ledger.json bootstrapped
  - ✓ Durable submission tracking working
  - ✓ HUD ready to display on demand
```

---

## Phase 4: IPvGO Status

```
Algorithm:      mcts-ucb1-v2 (upgraded from v1, 2026-08-12)
Simulations:    6000 per move (↑ from 1500)
Board Size:     7x7 (stable)
Games Played:   100+ (post-algorithm-change sample)
Recent Win %:   ~81-82% (live measured)
Avg Move Time:  ~260-300ms (well under 10s budget)

Opponent:       Netburners (confirmed valid)
Faction:        Member with 112.491 favor
Status:         Running healthy, learning improving
```

---

## Phase 5: Darknet (Paused - Intentional)

**Current State**:
```
Status:                PAUSED (stable, not broken)
Registry:              Empty {} (no active managers)
Last Heartbeat:        2026-08-14 (stale, 20 days ago)
Known Issues:          4 live freeze incidents, root cause unresolved

Credentials:           586 cracked total
Loot Accomplished:     71 hosts, 4GB RAM freed, 2 caches
Last Active Date:      2026-08-14

Next Steps:            Investigation required
                       (Likely in ns.dnet API call costs)
```

**Why Paused**: Four separate live freezes under different cap/throttle configurations ruled out:
- Aggregate load (tested with zero other processes)
- Propagation burst (MAX_SPREAD_PER_PASS throttle in place)
- Resident manager count (tested down to 6 managers, still froze)

**Real investigation needed**: Reading Bitburner's own bundled source for actual `ns.dnet.probe()`/`getServerDetails()`/`authenticate()` cost against the save's network graph (586+ hosts known).

---

## Phase 6: Unit Test Suite

**Full Test Run Results**:
```
Total Tests:     216
Passing:         216 ✓
Failing:         0
Suites:          45
Duration:        158ms

Coverage by Area:
- mcp_logic:           Multiple test suites (weaken budget, allocation, etc.)
- dnet_lib:            Shard handling, registry management, throttling
- ipvgo_logic:         Move selection, board safety, heuristics
- cct_logic:           Contract validation, reward parsing
- stock_trader_logic:  Portfolio management, adaptive caps
- player_activity:     Gate discovery, faction selection
- maintenance_logic:   Augmentation planning, XP tracking
- formulas_logic:      Formula validation, accuracy checks
```

---

## Phase 7: Remote API & Daemon Health

```
Status:              ✓ Connected
Uptime:              193,286s (2.2 days since daemon started)
Watched Files:       53 synced
Pull Files:          14 synced
Sync Latency:        ~2s (normal)
Push Success:        100% this session
Pull Success:        100% this session
Events Logged:       Comprehensive, rotating
```

---

## Issues Found & Resolutions

### ✅ Non-Issues (Verified Correct)

1. **Low money % on foodnstuff**: Expected in XP mode, player focused on Hacking level.
2. **Weaken/grow/hack oscillation**: Designed behavior, security floor at 7, work at 99% RAM.
3. **Darknet paused**: Intentional, stability issue unresolved but contained.
4. **Income low (~$15/s)**: Expected in XP mode, not money mode.

### ⚠️ Potential Improvements (Not Blockers)

1. **Darknet investigation**: Real next step when capacity permits.
2. **MCP target diversity**: `mcpMulti.js` dry-run ready to test multi-target farming.
3. **Stock trader**: Currently inactive, read-only until explicit approval.
4. **IPvGO eye-awareness**: Deferred pending 81-82% win rate validation.

---

## Recommendations

### Immediate (Safe to Execute)

- [ ] Monitor MCP's next natural target switch to verify R8 switch-veto is working
- [ ] Let IPvGO continue running at 6000 sims/move; capture 100-game window for stat confidence
- [ ] Run `mcpMulti.js` (dry-run, no arg) to compare single vs. multi-target projections
- [ ] Verify contract system remains responsive if new CCTs appear

### Medium-term (Requires Investigation)

- [ ] Darknet: Read bundled game source for actual `ns.dnet.*` API costs
- [ ] If safe: Restart darknet with clean state and 1-manager test first
- [ ] Consider lease/rental of purchased servers for expansion capacity

### Long-term (Strategic)

- [ ] Evaluate HPvGO eye-awareness (getChains/getControlledEmptyNodes) if win rate plateaus
- [ ] Stock trader: Test live trading under controlled capital deployment
- [ ] Augmentation path: Plan next reset cycle based on current XP rate

---

## Test Conclusion

**Overall Assessment**: ✅ **SYSTEM FULLY OPERATIONAL**

The MCP codebase is performing as designed. All core mechanics validated:
- Work/weaken cycling is correct
- Allocation math is responsive  
- Invariants are hold
- Remote API is stable
- Unit tests pass completely

Darknet remains a managed known issue. All other systems are healthy and ready for continued operations.

---

*Report generated by live game testing*  
*All metrics live-validated via Remote API*  
*No assumptions, all evidence from game state files*
