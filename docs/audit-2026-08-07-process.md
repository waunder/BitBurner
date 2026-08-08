# Process audit: the diagnose→fix→restart loop

Independent review (Opus), 2026-08-07. Companion to `audit-2026-08-07-code.md`.
Question asked: *"contemplate our rinse and repeat iterations, and suggest
anything that would improve our log functions, test our assertions, automate
our loop."*

---

## The actual root cause of the 3–5 round trips

The log recorded **state samples**, not **decisions**. Every bug found was a
decision bug — why did the budget get spent, why did the plan flip, why was
this target abandoned — and the channel being read recorded only the *outcome*
of those decisions, never their *inputs*. So every diagnosis required inferring
backward from effect to cause, which is exactly the step that's guessable, and
exactly where the session got burned twice.

Concrete proof from the code audit: the weaken-budget over-allocation bug was
found only because `maxWeaken` happened to decrement by exactly `needWeaken`
each tick. That was an **accident of two unrelated fields lining up**. The value
that would have made it a one-liner — `weakenBudget.remaining` before and after
each tick — was never written anywhere. Same story with tick throttling: 70s /
250s / 379s ticks were found by hand-computing timestamp deltas. The script
assumed 10s and never noticed.

A compounding factor: **each restart destroyed the evidence from the previous
iteration.** `rateSamples`, `moneyPctSamples`, `lastSwitchTime`, `totalHacked`
are all in-memory. The restart-to-test cycle is also a wipe-the-black-box cycle.
That alone explains a lot of the round trips — evidence wasn't accumulating
across iterations, it was re-rolling from zero each time.

And the direct cause of the `lowMoneySeconds` miss: **three separate
hand-written field lists.** One builds the `ns.print` string, one builds the
`status` object, one builds a third string from `status`. Any new field must be
added to all three or it becomes invisible to whichever channel is actually
being read. Not a discipline problem — a structural one, and a 5-line fix:
build `status` first, then `const line = formatStatus(status)`, then
`ns.print(line)` and `ns.write(log, line)`. One field list, impossible to
desync.

---

## 1. Log functions

### Split the channel in two, by *job*

**`mcp_events.jsonl` — one line per state transition, never per tick.** The
session's 1353 lines would compress to roughly 40 events, every one
interesting. Kinds: `startup`, `target_adopt`, `target_drop`, `plan_flip`,
`bucket_change`, `invariant_violation`, `stall`.

The rule that makes this work, and it's the whole recommendation:

> **An event must record the value of every variable that appeared in the
> predicate that fired it — not the state afterward.**

So `target_drop` isn't `{target, reason:"drained"}`. It's:

```json
{"t":...,"seq":412,"kind":"target_drop","target":"joesguns","reason":"drained",
 "avgMoneyPct":0.006,"samples":[0.004,0.005,...],"sampleCount":9,"heldMs":94000,
 "rateSamples":[0,0,44,0,32],"lastAvgRate":15.2,"rateDropped":true,"moneyDegraded":false}
```

Now there is no inference step. The log *contains its own falsification*. If a
theory says "it dropped because money degraded," the record says
`moneyDegraded:false, rateDropped:true` and kills the theory instantly instead
of three round trips later. **Highest-value change on this list.**

**`mcp_status.json` — current snapshot, overwritten** — but embed a ring buffer
of the last ~50 events inline. One file read gives both "now" and "how we got
here." Cross-referencing two files by hand should not survive.

**Delete the per-tick `mcp_status_log.txt`,** or decimate to one heartbeat line
per minute purely to answer "was it running at all." 98.8% of it was
byte-identical to its neighbour, it lives inside the save game, and it was
growing ~800KB/day of permanent save bloat.

### Three fields that would each have saved a round trip

- **`dtMs`** — actual elapsed since last tick. Would have exposed the throttling
  *and* invalidated every `rate` number in one shot.
- **`runId` + `scriptVersion`** — stamp every startup event with a run UUID and
  either a bumped `const VERSION` or `ns.read("mcp.js").length`. The log
  interleaves at least four code revisions with no marker; identifying which
  revision produced which lines required reading the *shape of the trailing
  fields* (`lowMoneyFor=` vs `avgMoneyPct=`). That is archaeology, and it's a
  3-line fix. Critically for the sync workflow: with a version stamp, the agent
  can tell whether the log it's reading reflects the code on disk. That was
  genuinely undeterminable during the audit.
- **`incomePerSec` from `ns.getScriptIncome()`** — already available, unused.
  Income is currently computed as a proxy (server money decrease), which
  reports `totalHacked: 0` while claiming `plan=work`. `getScriptIncome()` /
  `getScriptExpGain()` give ground truth for free. Use them for the headline
  metric; keep the proxy only for per-target attribution.

### Noise to cut

`hackRam`/`growRam`/`weakenRam` every tick (constants). The full `workers` array
in anything append-only (4KB of mostly-static data — keep it in the overwritten
snapshot only).

---

## 2. Testing assertions

### Tier A: in-game invariants — do this first

A tiny `assert(cond, name, data)` that on violation emits an
`invariant_violation` event, increments a counter, and fires
`ns.toast(msg, "error", 5000)` — rate-limited to once per name per run. `toast`
is a UI popup; unlike a log line it is *impossible to miss*, which is the
property you want for "the code's beliefs are wrong."

Design principle: **assert on the code's own intentions, not on game state.**
Game state is allowed to surprise you; your own bookkeeping is not.

| Invariant | Catches |
|---|---|
| `weakenBudget.remaining >= 0` and `Σ weakenDeployed <= need` | budget over-allocation, immediately |
| `Σ(threads × scriptRam) <= host.maxRam` after exec | the inconsistent-RAM class |
| `dtMs ∈ [0.5, 2] × LOOP_SLEEP_MS` | throttling / bogus rate math |
| `planFlips <= 2 per 10 ticks` (rolling) | oscillation, as an *alarm* rather than something noticed by eyeballing |
| security at end of weaken phase < security at start | "weaken isn't converging" |
| `moneyPct` non-decreasing across a grow-only window | "is grow even working?" — the exact question the log couldn't answer |
| `ramUtilization >= 0.5` | the idle-network finding (it was 0.07) |

That last one deserves emphasis: a single number, `deployed action RAM / total
worker RAM`, per tick. During weaken phases it was **7%**. Had that been in the
status file, the finding takes ten seconds instead of an audit.

### Also: a bounded verbose mode

`debug=1` (or a config field) raises logging to full per-tick dumps for the next
30 ticks, then auto-reverts. The generic solution to the `lowMoneySeconds`
problem: instead of "add a field, redeploy, wait, discover you added it to the
wrong channel," flip a flag and get *everything* for a bounded window.
Auto-revert so it can't be forgotten and bloat the save.

### Tier B: pure-function extraction — yes, but narrowly

Worth it, with a strict rule: **extract functions that take numbers and return
numbers, never `ns`.**

The math is currently entangled with I/O.
`getTargetWeakenThreads(ns, target, hysteresis)` does three `ns` reads *and* the
arithmetic, so the arithmetic is untestable. Split:

- `weakenThreadsFor(currentSec, minSec, cap, hysteresis) → number` + thin `ns` wrapper
- `maintenanceWeakenThreads(hack, grow, hackTime, growTime, weakenTime) → number`
  — exactly the kind of thing that should never be debugged by restarting a game
- `getWorkWeightBucket(moneyPct)` — already pure, just move it
- `planHostThreads(freeRam, ramInfo, weights, budget) → {weaken, grow, hack}`

Then `node --test mcp_math.test.js`. Built into Node, no runner to install, no
build step. And go property-style, not example-style:

```js
// for random freeRam / weights / ramInfo:
assert(w*wRam + g*gRam + h*hRam <= freeRam)      // RAM conservation
assert(w >= maintenanceWeakenThreads(h, g, ...)) // never under-weaken
```

RAM conservation is a ten-line property test covering an entire bug class
permanently.

**RAM-cost caveat:** Bitburner's static RAM analyzer charges only for `ns` API
surface actually referenced, so a math module containing no `ns` calls should
import at zero additional cost. Confirm empirically with `ns.getScriptRam`
before and after the split rather than assuming — but if it holds, the split is
free.

### Bitburner affordances possibly unused

- **`ns.getScriptLogs(script, host)`** — a *separate script* can read `mcp.js`'s
  `ns.print` stream programmatically. `mcp_status.js` already does this for
  display; the same call gives a watchdog analytic access.
- **Ports (`ns.getPortHandle`, `peek`, `tryWritePort`)** — a real in-memory ring
  buffer with configurable size. High-frequency telemetry a watchdog consumes
  without touching the filesystem or bloating the save game. The right channel
  for per-tick detail you want available but not persisted.
- **`ns.getResetInfo()`** — augmentation/bitnode reset timing, useful for
  anchoring "since when" in cumulative metrics.
- **`RunningScript.onlineMoneyMade` / `onlineRunningTime`** via
  `ns.getRunningScript` — per-script income attribution.

---

## 3. Automating the loop

The human click on pull is fixed. So the objective function is: **maximize
information per click.** Every click should return one complete,
causally-ordered, self-contained artifact.

### (a) Read tunables from `mcp_config.json` every tick — do this first

Biggest available win, and it falls out of existing constraints. autoSync
already pushes local saves into the game automatically; only *pull* needs the
click. The push direction is already automated and unexploited.

Move `SECURITY_CAP`, `DEGRADED_MONEY_PCT`, `MONEY_PCT_SAMPLE_COUNT`,
`WORK_SECURITY_MARGIN`, `RATE_DROP_FACTOR`, the weight table, `LOOP_SLEEP_MS`,
`debug` into `mcp_config.json`, re-read at the top of every tick (with
corrupt-JSON try/catch and fallback to defaults).

Consequences:
- Retuning becomes a file save. No restart, **no wiped in-memory history** —
  kills the evidence-destruction problem directly.
- **The agent can retune without human action.** Writing `mcp_config.json` goes
  live within 10 seconds. Genuine automation across a boundary assumed manual.
- Log a `config_change` event with a diff, so the event stream records what was
  tuned and when — currently unrecoverable.

A large fraction of the session's round trips were "change a constant, restart,
wait." Those collapse to zero round trips.

### (b) One file to read: `mcp_report.json`

Snapshot + last ~50 events + invariant violation counts + a computed
rolling-window digest. The digest is ~15 numbers, not prose — don't have
`mcp.js` write English, have it write the numbers a diagnosis is *made of*:

```
ticks, wallClockMs, medianTickMs, maxTickMs,
planFlips, targetSwitches, redeploysPerTick,
ramUtilization, weakenDeployedVsNeeded,
moneyPctSlope, incomePerSec (getScriptIncome),
timeInPlan{work,weaken}, timeInBucket{...},
invariantViolations{name: count}
```

Read in five seconds, human or agent, and know whether the run was healthy.
`ramUtilization: 0.07` and `planFlips: 12/20` would have made two of the top
four code findings self-evident on the first click.

### (c) `mcp_doctor.js` — a read-only watchdog

Not a second orchestrator. A separate long-lived process doing its **own
independent measurement** of the network (total/used RAM, per-host running
scripts and their `args[0]`, target security/money) and cross-checking against
what `mcp.js` *claims* in its status file.

Two things it does that `mcp.js` structurally cannot do about itself:

1. **Catches belief-vs-reality divergence.** `mcp.js` reports its beliefs; it
   cannot notice they're wrong. The inconsistent-RAM finding is the perfect
   example — it wrote `usedRam: 3.5, freeRam: 16, maxRam: 16` for the same host
   with no way to see the contradiction. A doctor measuring from outside flags
   it instantly.
2. **Survives restarts.** The real argument. It accumulates the cross-restart
   timeline — "target X adopted and abandoned 6 times in 40 minutes," "security
   on foodnstuff oscillated between 5.9 and 7.0 for an hour" — patterns *only
   visible across* iterations that were each wiping their own memory.

Keep it strictly read-only, writing `mcp_doctor.json`. Its independence is the
entire value; the moment it can act, it becomes another thing to debug.

### (d) Later: `probe=` experiment mode

For "I want to know whether X is true": an arg/config field that runs a
bounded, heavily-instrumented experiment and writes a result.
`probe=weaken_convergence` pins a target, records security + thread counts every
tick for N ticks, emits a summary, exits. Converts "restart and squint" into
"run the experiment, read the answer." Lower priority than (a)–(c), but the
natural end state for the math-heavy questions.

### What not to build

Prose self-diagnosis inside `mcp.js` (it'll confidently narrate its own wrong
beliefs — the exact failure mode being escaped). Any in-game LLM integration. A
test harness with a runner or build step — `node --test` on pure functions gets
90% of the value at zero infrastructure.

---

## If you only do four things

1. **One field list** — build `status` first, derive both the print line and the
   log line from it. Kills the `lowMoneySeconds` class of miss permanently.
   *(5 lines)*
2. **Event log with predicate inputs** — transitions only, each recording the
   values that fired it. Turns diagnosis from inference into lookup. *(highest
   value here)*
3. **`mcp_config.json` re-read per tick** — turns a multi-minute manual round
   trip into a file save, stops wiping state on every experiment, and lets the
   agent retune without human action.
4. **`runId` + `scriptVersion` + `dtMs` on everything** — three fields, and it
   would have been immediately obvious which code produced which lines and that
   7% of ticks were 7–38× longer than the code assumed.

Notably, the four highest-leverage items are all *bookkeeping*, not
intelligence. The loop was slow because the evidence was thin and kept getting
deleted, not because the reasoning over it was hard.
