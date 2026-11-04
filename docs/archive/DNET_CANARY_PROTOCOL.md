# Darknet Canary Testing Protocol

**Last Updated**: 2026-09-02  
**Status**: PRE-MERGE STAGING (not yet activated)

---

## Known Issue Summary

**Four live freeze incidents** (2026-08-30):
1. First attempt: Cap 15, registry 30 entries, no sluggishness reported at peak
2. Second attempt: Cap 8, registry 36 entries, froze faster than first
3. Third attempt: Propagation throttle active, froze at lower count than either prior
4. Fourth attempt: Isolated test (darknet only), froze within ~90s with 6 managers

**Root Cause Status**: UNRESOLVED
- Not aggregate load (fourth test ruled it out)
- Not propagation burst (throttle in place)
- Not resident manager count (froze well under all caps tested)
- **Likely cause**: `ns.dnet.probe()`/`getServerDetails()`/`authenticate()` cost against this save's 586+ known hosts
- **Real next step**: Read game's bundled source code, not retry-and-tune

**Current State**: Darknet paused (intentional), manager registry at 0, no active processes

---

## Why Caution is Warranted

1. **Game renderer freeze** — Not a script crash (recoverable), but game UI/input completely frozen
2. **Unpredictable threshold** — Froze at 6 managers (lowest tested), 8 managers, 36 managers; no clear cap
3. **Limits effectiveness** — Root cause unknown means we can't guarantee it won't recur
4. **Infrastructure ready** — dnet_root.js, throttling, registry all in place, but unproven

---

## Testing Plan (When Darknet Investigation Begins)

### Prerequisites
Before running ANY darknet process:
1. **Read Bitburner game source** for actual `ns.dnet.*` API costs
   - Search for `ns.dnet.probe`, `getServerDetails`, `authenticate`
   - Measure call cost against known network size (586+ hosts)
   - Document findings in `docs/darknet-investigation.md`

2. **Verify MCP & other systems stable**
   - MCP running normally, at least 30 minutes clean
   - No other new code deployed
   - Remote API responsive

3. **Have recovery plan ready**
   - Know how to kill all processes (Ken has `dnet_killswarm.js` script)
   - Have game's built-in "reload and kill all" ready (last resort)
   - Document timeline: when started, when froze, how recovered

### Canary Test Protocol

**Phase 1: Single Manager Canary (Most Conservative)**

```
1. Start only dnet_root.js (no deployer, no loot, no propagation)
2. Set MAX_ACTIVE_MANAGERS = 1 (hardcoded for test, not config)
3. Run for 5 minutes, monitor:
   - CPU usage via OS-level tools (ps, not just game UI)
   - Remote API connection stability
   - Game responsiveness (can still click, move mouse)
4. Kill after 5 minutes, check registry (should be 0 or 1)
5. Wait 30 minutes, repeat step 1-4 three times

Success Criteria:
- No freeze
- No renderer pegging
- Registry heartbeats normal
- Remote API stays connected

If freeze occurs:
- Note exact time, manager count, any patterns
- Kill via OS (dnet_killswarm.js)
- Document incident in timeline
- STOP — do not attempt 2-manager test
```

**Phase 2: Two-Manager Canary (If Phase 1 succeeds)**

```
1. Set MAX_ACTIVE_MANAGERS = 2
2. Spawn 2 managers (one deployer, one probe-only)
3. Run for 10 minutes, monitor same metrics
4. Repeat protocol from Phase 1

Success Criteria: Same as Phase 1
```

**Phase 3: Full Fleet (If Phase 1 & 2 succeed)**

```
Only after two successful canary phases should full darknet restart
be attempted. Even then, with monitoring.
```

---

## Caution Flags

### 🚨 STOP CONDITIONS (Do Not Proceed)

- Any renderer freeze at any manager count
- CPU spike to >120% on any single thread
- Remote API disconnection
- Any crash or invariant violation
- Unclear patterns (e.g., freeze sometimes, not others)

If any occur: **Kill darknet immediately, document, investigate more before retry**

### ⚠️ YELLOW FLAGS (Proceed With Caution)

- High CPU usage (80-100%) but no freeze
- Latency spike (game response slow but not frozen)
- Registry entries accumulating faster than expected
- Authentication timeouts on darknet calls

If any occur: **Log, observe, but continue test if no freeze**

### ✅ GREEN FLAGS (Safe to Continue)

- Steady CPU <60%
- Normal game responsiveness
- Registry stable
- No connection drops
- Heartbeats consistent

---

## Documentation During Test

For each canary run, record:
```
Test: [Phase, Date, Time]
Duration: [X minutes]
Manager Count: [actual vs requested]
CPU Peak: [OS-level measurement]
Registry Final: [total entries at end]
Incidents: [any issues, with timestamps]
Outcome: [SUCCESS / FAILURE / UNCLEAR]
Notes: [any patterns, odd behavior, anything notable]
```

Keep in `docs/darknet-canary-log.md`

---

## What Changes Based on Results

### If Canary Succeeds Fully
- Darknet is genuinely safe to run
- Deploy dnet_root.js, dnet_deploy.js rewrite, full coordination layer
- Monitor ongoing but no special precautions needed
- Investigate root cause becomes optional (curiosity-driven)

### If Canary Fails at 1-Manager
- Problem is not manager count or propagation
- Likely `ns.dnet.*` API cost itself
- Do NOT attempt higher manager counts
- **Action**: Read game source for actual costs, redesign around constraint
- Consider: Darknet might be fundamentally incompatible with this save's network size

### If Canary Fails at 2-Manager But Not 1
- Problem is somewhere between 1 and 2 concurrent calls
- Likely race condition or timing issue
- **Action**: Investigate dnet_root.js coordination, add delays, test again

---

## Decision Checklist (Before Merge from Tier 3)

- [ ] Game source read and documented (dnet API costs)
- [ ] MCP stable for 30+ minutes
- [ ] Recovery plan reviewed and ready
- [ ] Caution flags understood by Ken
- [ ] Documentation template prepared
- [ ] First canary test approved (explicit go-ahead needed)

**Do not merge Tier 3 commits until Ken explicitly approves canary test**

---

## Timeline Expectation

1. **Read game source**: 1-2 hours
2. **Phase 1 canary** (3x): 30 minutes runtime + 90 minutes wait = 2 hours
3. **Phase 2 canary** (if Phase 1 succeeds): 1 hour
4. **Phase 3** (if both succeed): Full darknet restart, 30+ minutes monitoring
5. **Analysis & decision**: 30 minutes

**Total**: 4-6 hours of testing for full validation

This is deliberate caution, not roadblock — just realistic about stakes.

---

