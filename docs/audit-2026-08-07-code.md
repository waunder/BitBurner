# Code audit: `mcp.js` orchestrator

Independent review (Opus), 2026-08-07. Companion to
`audit-2026-08-07-process.md`.

**Status: all findings below were implemented in commit `7129c10`.** Retained
for the reasoning and the failure scenarios, which the commit message only
summarizes.

---

## Summary

The code is unusually well-commented and the structural decisions
(redeploy-only-when-needed, persisted skip/drain state, orphan cleanup, `ps()`
path normalization) are sound and hard-won. But three interlocking bugs in the
RAM/thread accounting explain essentially all of the pathological runtime
behavior in the log: hacking level 312, farming
`n00dles`/`foodnstuff`/`joesguns` for ~$4/s, player money flat at $28.07M for
the last ~45 minutes. **98.8% of all log lines (1337/1353) report
`maxWeaken=0`** — not noise, a systematic accounting error that collapses
target selection to near-uselessness. Several tuning constants are in direct
logical conflict with each other.

---

## Findings

### 1. `maxWeaken` measures *free* RAM, but weaken capacity is *reclaimable* RAM (confirmed, highest impact)

`getTotalWeakenCapacity()` sums `getHostFreeRam()` across workers, called at the
top of the loop *after* the previous tick committed every byte to grow/hack. So
in any steady work phase it returns 0.

`chooseTarget` applies `if (requiredWeaken > maxWeaken) continue`, which with
`maxWeaken=0` degenerates to **"only consider servers already at or below the
security goal"** — precisely the servers nobody has been hacking, i.e. the
worthless ones. This is why the bot cannot graduate past starter servers no
matter how high the hacking level climbs.

Conceptual error: on a target switch you *kill everything anyway*, so weaken
capacity available to a new target is total worker RAM, not currently-free RAM.

**Worse failure mode this enables (plausible, not observed):** if the current
target is dropped while the network is saturated and no zero-weaken candidate
exists, the `!currentTarget` branch prints "no hackable target found" and sleeps
60s **without killing any action scripts**. Orphaned threads keep the network
saturated → `maxWeaken` stays 0 → no candidate admissible, forever. Permanent
stall, zero income, no self-recovery; the persisted `drained` map means a
restart won't necessarily break it either.

**Fix:** compute `maxWeaken` from reclaimable RAM. Sweep action scripts before
sleeping in the no-target branch.

### 2. Shared weaken budget isn't charged for already-running threads (confirmed)

The `!hostNeedsRedeploy` early return does not decrement
`weakenBudget.remaining` for weaken threads already running on that host. The
full budget is re-spent on a fresh host every tick.

Visible in the log at 01:26:07:

```
01:26:07 foodnstuff plan=weaken needWeaken=20 maxWeaken=277
01:26:17 foodnstuff plan=weaken needWeaken=20 maxWeaken=257
01:26:27 foodnstuff plan=weaken needWeaken=20 maxWeaken=237
01:26:37 foodnstuff plan=work   needWeaken=0  maxWeaken=217
```

`maxWeaken` drops by exactly 20 per tick while `needWeaken` stays 20 — 60
threads deployed for a 20-thread need.

Second half is worse: during a weaken phase *every* host gets
`killActionScripts()` but only `need` threads total get redeployed. At 01:27:07
that's 20 threads out of 277 capacity — **93% of the network idle**, every few
ticks.

**Fix:** (a) charge the budget for no-redeploy hosts; (b) fill leftover RAM with
grow rather than idling. (b) likely dominates every other throughput fix here.

### 3. The maintenance-weaken formula is wrong by a known factor (confirmed)

`weakenTime = 4×hackTime` and `growTime = 3.2×hackTime`, so per unit *time*:

- weaken per hack thread = `0.002/0.05 × (weakenTime/hackTime)` = `h × 0.16`;
  code used `h × 0.04` → **4x under-provisioned**
- weaken per grow thread = `0.004/0.05 × (weakenTime/growTime)` = `g × 0.10`;
  code used `g × 0.08` → **1.25x under-provisioned**

**On the `empty` tier (grow 1 / hack 0):** the implementer worried this
overcorrected and strained the formula. It's backwards — `empty` is the *least*
strained case. Per action thread it needs `0.10` weaken and the code allocated
`0.08` (1.25x deficit); the `goal` tier (grow .25 / hack .75) needs `0.145` and
allocated `0.05` (**2.9x deficit**). Going grow-heavy *relieves* the formula.
The 0.1 tier boundary is defensible (hacking a 10%-full server yields ~10% of
the take). 100/0 vs 90/10 isn't worth arguing. The real gap is that `low`
covers 0.10–0.85 with one fixed 70/30 split — much coarser than anything at the
bottom end.

**On `WORK_SECURITY_HYSTERESIS = 0.1`:** it's *fractional*, so against a goal of
6 it permits 0.6 security drift = 12 weaken threads. Observed swing is
`needWeaken=20` ≈ 1.0 security — the amplitude of one grow cycle's injection
landing at once. The hysteresis is sized *below* the system's inherent
oscillation, which is why it damps nothing. Log shows six consecutive
single-tick `work→weaken→work→weaken` flips. Make the margin absolute and size
it to one cycle's injection — or better, stop treating weaken as a *mode*: trim
the weaken/action ratio instead of tearing down all grow/hack.

### 4. Drain detection and the recovery tier are in direct conflict — livelock (confirmed)

`DEGRADED_MONEY_PCT = 0.2` marks a target drained below 20%; the `empty`
recovery tier engages below 10%. So **a target in recovery is guaranteed to be
classified as drained within 90 seconds**, long before grow can lift it from
~0% to 20%. Observed: `joesguns` was climbing (avgMoneyPct 0.000 → 0.006 across
01:19–01:26) — grow was working, just slowly.

The abandonment is self-sealing: a drained target gets **zero grow threads**
after being dropped, so it cannot recover during its 15-minute penalty. After
15 minutes it returns at the same 0% money, gets adopted, gets marked drained
90 seconds later, forever. With enough targets cycling, you reach finding #1's
stall.

**On the constants:** `MONEY_PCT_SAMPLE_COUNT = 9` (90s) is the weak one —
should be expressed in *grow cycles*, not ticks, since a single `growTime` on
some servers exceeds 90s, so the detector can fire before one grow completes.
Better still, detect on the **derivative**: "moneyPct is not increasing while in
grow-only mode" is the actual condition, and it's immune to the
absolute-threshold conflict. `DEGRADED_SKIP_MS = 900000` is fine in isolation
but pointless while abandoned targets can't regrow.

### 5. `rate` assumes a 10s tick; real ticks are frequently 70–380s (confirmed)

`interval = LOOP_SLEEP_MS / 1000` is hardcoded. Measured deltas over the last
400 log lines: `10s ×361`, plus `70s ×16`, `130s ×3`, `250s ×3`, `379s ×1`
(browser tab throttling). On a 70s tick, `rate` is overstated ~7x.

Matters because `rateDropped` compares the newest sample to the trailing
average with `RATE_DROP_FACTOR = 0.75`, and a single spurious sample triggers a
**15-minute** drain penalty. The raw signal already alternates between 0 and
100K/s tick-to-tick, so `rateDropped` is close to a coin flip even without
throttling.

**Fix:** measure real elapsed time via `Date.now()` deltas; require N
consecutive low samples.

### 6. The weaken-stuck timer is disarmed by the hysteresis mismatch

Direct answer to the implementer's question about removing `canWeakenTarget`:
**that scenario is safe.** If a target genuinely gets no weaken RAM, nothing
runs against it, so security is *constant*; `currentSecurity >
weakenStuckSecurity - 0.05` holds every tick, the baseline never resets, and
eviction fires reliably at 60s. Removing `canWeakenTarget` did not create that
failure mode.

The real hole is different. `weakenStuckStart` is evaluated using
`getTargetWeakenThreads(...)` with **hysteresis 0**, but the plan uses
hysteresis, and the `else` branch **zeroes the timer** whenever `needWeaken`
momentarily hits 0. Given the confirmed single-tick oscillation, `needWeaken`
hits 0 every two or three ticks — the timer resets before it can reach 60s.
**The stuck detector is effectively disabled in exactly the thrashing regime it
was built to catch.**

**Fix:** track "time since security last made real progress" rather than "time
since needWeaken became nonzero."

### 7. `mcp_status.json` per-host numbers are captured at three different moments (confirmed)

From the live snapshot: `{"host":"n00dles","maxRam":4,"usedRam":3.5,"freeRam":4}`
and `{"host":"harakiri-sushi","maxRam":16,"usedRam":3.5,"freeRam":16,
"actions":[weaken:1, grow:8]}` (15.75GB of actions). `usedRam` is read *before*
`killActionScripts`, `freeRam` *after* the kill, `actions` describe the
*post-exec* state. `maxRam - usedRam ≠ freeRam` in every entry.

Related telemetry lies: `homeFreeRam` is always 0 because `getHostFreeRam`
hardcodes `return 0` for home. `totalHacked` reads 0 while reporting
`plan=work`, because `hacked` measures *server money decrease*, not player
income — with `hack:0` in the empty tier there is genuinely no income, but the
metric can't distinguish that from "money isn't dropping." Consider tracking
player-money deltas for the headline number.

### 8. `targetOverride` bypasses all validation (robustness)

Only `ns.serverExists` is checked. A pinned server with no root access, above
your hacking level, or with `maxMoney === 0` sails through: `plan.moneyPct`
becomes `0/0 = NaN`, every comparison in `getWorkWeightBucket` is false, so it
falls through to `"empty"` and grows a server that can never hold money,
forever.

### 9. `restart_mcp.js`: fixed-sleep race, and untracked in git

`ns.scriptKill` + `await ns.sleep(200)` + `ns.run` is a guess. A killed script
can still finish its in-flight tick, including writing `mcp_status.json` and
`mcp_target_state.json` — so the new instance's `loadTargetState()` can race the
old instance's `saveTargetState()`. Poll `ns.isRunning` until actually gone,
with a timeout.

Separately: `?? restart_mcp.js` — **untracked**, not just uncommitted. It'll
vanish on a clean checkout.

### 10. Persistence write volume

`mcp_target_state.json` every tick is a **non-issue** — a handful of hostnames,
and Bitburner's `write` is in-memory. Leave it.

What matters is `mcp_status_log.txt`: appended forever, no rotation, and it
lives **inside the save game**, serialized on every autosave. 151KB after ~4.5
hours ≈ 800KB/day of permanent save bloat. Cap it, rotate it, or log only on
state change — most of the 1353 lines are byte-identical to their neighbour.

Two minor notes: `saveTargetState` is inside the same `try` as the status write,
so a status-write failure silently skips it; and `loadTargetState` uses
`max(SKIP_STUCK_MS, DEGRADED_SKIP_MS)` as the age filter for *both* maps, so
already-expired skip entries get restored (harmless — `chooseTarget` re-checks
— but confusing).

---

## Code quality notes

- **`currentTargetScore` is fully dead** — declared and assigned, never read.
- **`SCORE_WEIGHT` doesn't blend anything.** Live values:
  `candidateScore=5000000.50`, `candidateExpectedIncome=0.50`. Seven orders of
  magnitude apart, so `getTargetScore` is exactly `maxMoney × 0.1` with
  decorative noise. The score isn't "maxMoney-dominated" — the income term is
  numerically nonexistent. Either normalize both terms or delete the income
  term and be honest that it's a maxMoney tiebreak.
- **`HOME_RAM_RESERVE` is unused** — and the real story is that
  `getWorkerHosts` skips `home` entirely and `getHostFreeRam("home")` hardcodes
  0, so home's RAM contributes nothing. The unused constant is a fossil of a
  feature that would meaningfully increase capacity.
- **`chooseTarget`'s default-parameter machinery is dead** — called exactly
  once, always with all five arguments.
- **`chooseTarget` mutates its inputs** (deleting expired map entries) — a
  `choose*` function with side effects. Split the expiry sweep out.
- **`IGNORE_SERVERS = ["darkweb"]` is redundant** — `isHackableTarget` already
  excludes it (no root, no money).
- **`allocation.debug` is leftover debug output**, attached only on the
  redeploy path, so the JSON schema varies per host per tick.
- **`scanNetwork` runs 3x per tick.** Scan once, pass it down.
- **`copyActionScripts` scp's on every redeploy** — the scripts never change.
  Do it once when a host is first adopted.
- **`maxRam <= 2.5` is an unexplained magic number**; it's below
  `weakenRam × 2`, presumably the intent — say so or derive it.
- **`ns.exec` return values are never checked**; a failed exec is still recorded
  in `allocation.actions` as if it succeeded.
- **`get_stats.js` argument conflict:** `get_servers()` treats *all* of
  `ns.args` as server names, while `openTail()` treats `ns.args[1]` as the tail
  host. `run get_stats.js n00dles foodnstuff` opens the tail on `foodnstuff`.
  Also `get_action`/`get_target` each call `ns.ps(host)` separately, and
  `get_target` reports only `actions[0].args[0]`, misleading on the (normal)
  mixed weaken+grow+hack hosts.
- **Nothing in this repo acquires root** (no nuke/port-opening in `mcp.js`), so
  the worker/target pool only grows by manual intervention. That's the standing
  reason the bot is capped at 16 workers and starter targets despite hacking
  level 312.

---

## What's working well — don't touch

- **The `ps()` filename normalization.** That leading-slash mismatch is a
  classic silent Bitburner footgun and the explanatory comment is genuinely
  valuable.
- **`hostNeedsRedeploy` / the don't-redeploy-every-tick gate.** The single most
  important correctness decision in the file — hack/grow/weaken take minutes,
  the loop ticks at 10s, and naive redeployment means nothing ever completes.
- **`SECURITY_EPSILON`** and its comment. Correct diagnosis of a real
  float-accumulation trap.
- **`cleanupOrphanedActionScripts` at startup.** Given the number of restarts,
  this saved the session repeatedly.
- **Persisted skip/drain state.** Right call; the failure is in the *thresholds*
  (finding #4), not the mechanism.
- **Comment discipline generally.** The "why," not the "what."
- **`get_stats.js`'s multi-action + target column.** Now the only trustworthy
  view of per-host allocation, given finding #7.

---

## Suggested order of attack (as given)

#2b (fill leftover weaken-phase RAM with grow) and #1 (weaken capacity from max
RAM) are the two highest-leverage single changes — together they should unstick
target progression. #3 (the 4x / 1.25x time-correction) is a two-line fix with a
large stability payoff. #4 requires an actual decision about what "drained"
means and is worth thinking about rather than patching.
