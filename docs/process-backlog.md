# Process backlog

Live backlog, superseding the recommendations in
`audit-2026-08-07-process.md`. That audit stays as written — it is the
historical record, and its diagnosis was right. This file re-scores its
recommendations against the loop as it exists now.

Reassessed 2026-08-08, after the loop changed substantially.

---

## What changed under the audit's feet

The audit's section 3 opens: *"The human click on pull is fixed. So the
objective function is: maximize information per click."* Every packaging
recommendation in it descends from that constraint.

**The constraint is gone.** Since it was written:

- **Bitburner runs under Electron with `--remote-debugging-port=9222`.** Its
  DOM — Overview, every open tail window — is readable from outside over CDP.
  No click, no download, no sync pattern.
- **`mcp_supervisor.js` watches `mcp_restart.txt`.** Restarts are triggerable
  from outside the game. No keystroke.
- **`mcp_hud.js` publishes a one-word verdict** as the first token of the first
  line — a deliberately machine-readable handle.
- **A CDP watcher wakes Claude on state transitions.** The game can now
  interrupt the agent, rather than the agent polling the conversation.
- **Node is installed on this machine.** An earlier backlog note said
  otherwise; that was wrong, and it was the only thing blocking `node --test`.

So: the audit's *diagnosis* holds completely — the loop was slow because the
evidence was thin and kept getting deleted. Its *packaging* recommendations
were solving a click-cost problem that no longer exists.

---

## Still gold

### 1. `mcp_config.json`, re-read every tick

Still first, but **for a different reason than the audit gave.** It argued the
big win was letting the agent retune without human action. The supervisor
already delivers that.

The remaining value is the one that survives: **a restart still wipes
`rateSamples`, `moneyPctSamples`, `totalHacked` and `lastSwitchTime`.**
Automating the restart made the evidence-destruction cycle *faster*, not
smaller. Config hot-reload is the only path to changing a tunable without
throwing away the history that would tell you whether the change worked.

Move `SECURITY_CAP`, `WORK_SECURITY_MARGIN`, `DEGRADED_MONEY_PCT`,
`MONEY_PCT_SAMPLE_COUNT`, `RATE_DROP_FACTOR`, `OPPORTUNITY_SWITCH_FACTOR`,
`LOOP_SLEEP_MS`, the weight table, and `debug` into it. Try/catch with fallback
to the current constants. Emit a `config_change` event with a diff.

### 2. Event log with predicate inputs

Unchanged in value, and now easier to exploit: an events file can be read over
CDP without a click, and the watcher can be pointed at specific event kinds so
a `target_drop` wakes the agent with its full causal record already attached.

The rule stands verbatim, and it is the whole recommendation:

> An event must record the value of every variable that appeared in the
> predicate that fired it — not the state afterward.

`switchEval` (2026-08-08) is the first instance of this rule in the codebase
and validates it: the opportunity-switch predicate now records both scores,
the ratio, the factor, both timers, and `blockedBy`. The remaining transitions
— `target_adopt`, `target_drop`, `plan_flip`, `bucket_change`, `stall` — still
record outcomes without inputs.

### 3. `runId` + `scriptVersion`

**Promoted.** The audit rated this a nice three-line fix. It is now close to
essential, because the failure mode it prevents happens constantly in the new
loop: code is edited here, auto-pushed by the sync watcher, and restarted by a
token write — all without anyone looking at the game. "Is the running code the
code on disk?" is a question the agent now asks on nearly every iteration and
**cannot currently answer.**

`ns.read("mcp.js").length` as a cheap version stamp, plus a run UUID, both in
the status file. The HUD can then show a mismatch, and the watcher can wake on
it.

### 4. One field list

Still not done, and still live — demonstrated again today. `switchEval` was
added to the status object and to the HUD, but *not* to the `ns.print` line or
`mcp_status_log.txt`, because those are still hand-maintained parallel lists.
Exactly the `lowMoneySeconds` failure, repeated by the same structure.

Build `status`, derive `formatStatus(status)`, print and log that.

### 5. Invariant assertions — with a better output channel

Keep the assertion table from the audit. But its `ns.toast` design was chosen
because a popup is impossible for *a human* to miss. There is now a better
channel available in parallel: put `invariantViolations` in the status file,
surface a violation as a HUD verdict word, and the CDP watcher wakes the agent
automatically. Toast for Ken, status field for the machine.

`ramUtilization` from that table is **already delivered** — it is line 6 of the
HUD. The audit noted it would have turned an audit-length finding into a
ten-second glance; that is now true.

### 6. Pure functions + `node --test`

**Unblocked** — node is installed. And more attractive than when written,
because tests run here with no game round trip at all, which is the only part
of the loop that is still genuinely slow.

The narrow rule holds: extract functions that take numbers and return numbers,
never `ns`. `maintenanceWeakenThreads` and `planHostThreads` are the two worth
doing first, and the RAM-conservation property test covers a whole bug class.

### 7. `probe=` experiment mode

**Promoted from "later."** The audit ranked it last because it assumed a human
round trip to start an experiment and another to read the result. Both ends are
now automated: write the config, bump the restart token, read the result over
CDP. This is the natural end state for every math-heavy question, and it is
much closer at hand than the audit assumed.

---

## Demoted or superseded

### `mcp_doctor.js` — superseded, for now

The audit's two arguments for it were belief-vs-reality divergence detection
and surviving restarts. **The out-of-game CDP watcher now does both**, and does
them better: it survives a *game* restart too, and it costs no in-game RAM —
which matters at 20GB of total network capacity.

One capability the watcher lacks: independent measurement of the *network*
(per-host RAM, running scripts, target security). The watcher only sees the
DOM. So a doctor is not worthless — but it is not worth 2–3GB of a 20GB pool
today. Revisit when home RAM is large.

### `mcp_report.json` as "one file to read" — packaging obsolete, content still good

The rationale was minimizing clicks. Gone. But the **digest content** the audit
specified is still exactly right, and should live in the status file:

```
ticks, wallClockMs, medianTickMs, maxTickMs,
planFlips, targetSwitches, redeploysPerTick,
ramUtilization, weakenDeployedVsNeeded,
moneyPctSlope, incomePerSec, timeInPlan{}, timeInBucket{},
invariantViolations{}
```

Don't build a separate report file. Put the digest in `mcp_status.json`, where
the HUD and the watcher already look.

### Decimating `mcp_status_log.txt` — done

Already implemented: it logs only on target/plan/bucket change.

---

## Still open, unchanged in priority

- **`ns.getScriptIncome()` / `getScriptExpGain()`** for ground-truth income
  instead of the money-decrease proxy. Free, unused.
- **Ports (`ns.getPortHandle`) as a telemetry ring buffer** — per-tick detail
  with no save bloat. Attractive, but nothing outside the game can read a port
  directly; it would need the HUD or a reader script to surface it.
- **Bounded verbose mode** (`debug=1` for 30 ticks, auto-revert). Cheaper to
  use once config hot-reload lands.
- **`ns.getResetInfo()`** for anchoring cumulative metrics across augmentation.

---

## Not process, but open and known

- **Objective mismatch after augmentation.** The bot maximizes money when XP is
  the binding constraint — the `empty` bucket sets `hack: 0`, and only
  completed hack/grow/weaken calls grant XP.
- **70–380s tick gaps** and repeated sync disconnect/reconnect cycles. No
  confirmed cause; the Electron background-throttling theory was disproven
  (`gameWindow.js` sets `backgroundThrottling: false`).
- **`crawler.js` `Array(servers)`** should be `Array.from(servers)`.
- **Dangling references** — see the legacy table in `processes.md`.

---

## Order I would take them

1. `runId` + `scriptVersion` — smallest, and it removes a blind spot the new
   remote-edit loop creates on every single iteration.
2. One field list — 5 lines, and it stops the bug class that just recurred.
3. `mcp_config.json` hot-reload — the only fix for evidence destruction.
4. Event log with predicate inputs — the highest-value item, and easiest to
   build well once (3) has made the tunables inspectable.
5. Invariants, routed to both toast and status.

The audit's closing observation is worth keeping in view, because everything
above is still an instance of it: *the four highest-leverage items are all
bookkeeping, not intelligence. The loop was slow because the evidence was thin
and kept getting deleted, not because the reasoning over it was hard.*
