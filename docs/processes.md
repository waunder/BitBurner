# Processes

What each script is, what it reads and writes, and how they fit together —
from rooting a server through to restarting the bot without a keystroke.

`CLAUDE.md` covers the environment constraints and working rules; the audit
reports in this directory cover *why* the current design is what it is. This
file is the map.

Keep it current. If a script gains an argument, a file, or a failure mode,
it changes here in the same commit.

## Current working state — 2026-08-18

The tiered governance apparatus described in this section through
2026-08-16 (directive ledger, promotion-state machine, auditor tool, R8
controller/canary apparatus) is retired — it produced a genuine deadlock,
not just overhead. See `AGENTS.md`'s "Working method" section for why and
what replaced it: `docs/agent-working-agreement.md` for the portable
working method, `STATE.md` for current objective/status, and `AGENTS.md`'s
short stop-list for the few things that still need Ken directly.

- The `startup.js` core MCP baseline is established and runs normally.
- The adaptive stock trader is live with Ken's explicit 2026-08-18 capital
  approval. IPvGO, Darknet, and faction sharing remain off; see `AGENTS.md`'s
  stop-list for exactly what re-enabling each needs.
- Formulas R8: the shadow monitor has been live-validated (see
  `docs/evidence/`); the switch-veto integration is implemented and tested
  and is the current active objective — see `STATE.md`.

---

## The map

```mermaid
flowchart TB
    subgraph root["Rooting — grows the worker pool"]
        crawler[crawler.js] -->|per unrooted server| worm[worm.js]
        worm -->|ns.nuke| pool[(rooted hosts)]
    end

    subgraph farm["Farming — earns the money"]
        mcp[mcp.js] -->|scp + exec| actions["scripts/weaken.js<br/>scripts/grow.js<br/>scripts/hack.js"]
        pool -.->|scanned each tick| mcp
        actions -->|act on| target[(target server)]
    end

    subgraph obs["Observation"]
        mcp -->|writes each tick| status[(mcp_status.json)]
        mcp -->|writes on change| logfile[(mcp_status_log.txt)]
        status --> hud[mcp_hud.js]
        pool -.->|scanned| stats[get_stats.js]
        status -.->|after Remote API pull| parser[mcp_status_parser.py]
        player[(player state)] -.->|ns.getMoneySources| moneypanel[mcp_money.js]
        player -.->|ns.stock.*| stockpanel[mcp_stocks.js]
    end

    subgraph life["Lifecycle"]
        boot["startup.js<br/>(killall, then relaunch)"] -->|ns.run, in order| sup[mcp_supervisor.js]
        boot --> crawler
        boot --> mcp
        boot --> hud[mcp_hud.js]
        boot --> stats
        flag[(mcp_restart.txt)] --> sup
        sup --> restart[restart_mcp.js]
        restart -->|kill + relaunch| mcp
        dumpreq[(mcp_dump_request.txt)] --> sup
        sup -->|renders| dumptail[mcp_dump tail window]
    end

    subgraph direct["Direct Remote API connection — both directions live-confirmed by 2026-08-14"]
        daemon["bb_remote.py daemon<br/>(persistent, local control channel,<br/>full resync/pull on every (re)connect)"]
        daemon -->|pushFile, confirmed by getFile readback| flag
        daemon ==>|getFile, routine pull, full pull on (re)connect + 2s incremental, live-confirmed| status
        daemon ==>|getFile, routine pull — same as above| logfile
        daemon ==>|pushFile, routine manifest sync, live-confirmed| mcp
        daemon ==>|pushFile, routine sync| actions
    end

    subgraph out["Outside the game"]
        cdp["CDP watcher<br/>(scratchpad, session-scoped)"] -.->|reads the DOM| hud
        cdp -.->|reads the DOM| dumptail
    end
```

Three things are worth reading off that diagram:

- **Nothing in `mcp.js` roots servers.** The worker pool only grows while
  `crawler.js` is running and you own the port-opener `.exe`s each server
  needs. If the bot looks starved for RAM, check the crawler first.
- **`mcp_status.json` is the single source of truth for observation.** The HUD
  reads it, the parser reads it, and the out-of-game watcher reads the HUD.
  Nothing downstream re-derives the numbers, so nothing downstream can
  disagree with the orchestrator about what is happening.
- **CDP reads the DOM, not the filesystem.** It can see the HUD's curated
  summary and now a full-file dump once rendered, but it can never call
  `ns.read()` directly — that only works from inside a running script. The
  supervisor's dump feature is the bridge: a local file write in, a rendered
  tail window out.
- **`startup.js` is the only other thing that still needs a human.** Once
  `mcp_supervisor.js` is up, restarts and dumps are remote-triggerable — but
  nothing can remote-*launch* a script that isn't running yet, including the
  supervisor itself. `run startup.js` (it kills everything else itself first)
  is the full recovery procedure after anything that wipes running scripts
  (an augmentation install, primarily).
- **Routine script sync no longer depends on the VS Code extension either
  — the daemon now covers everything the extension did.** As of 2026-08-10,
  `tools/bb_remote.py`'s `daemon` mode pushes every watched live-game
  script/config file (`mcp.js`, `hacking/*`, `scripts/*`, `mcp_config.json`,
  `dnet_*.js`, etc. — see `WATCHED_FILES` in the script) directly into the
  game via `pushFile`: a full push of everything on every game connection
  (first connect or any reconnect after a drop, closing the exact
  "doesn't replay on reconnect" gap `CLAUDE.md` documents), plus an
  incremental only-changed-files push every 2s while connected. The
  restart trigger and file dumps work the same way they did before this:
  `mcp_restart.txt` via `pushFile`+`getFile`-readback, dumps via `getFile`
  directly, bypassing `mcp_dump_request.txt`/tail-window/CDP. **Live-confirmed
  2026-08-11:** the real game connected on port 12526 and a full resync
  pushed all 28 watched files with zero failures. See the `tools/bb_remote.py`
  section below for the full design.
  **The other direction (game → disk) is now built too, as of 2026-08-11,
  same session** — the daemon pulls `mcp_status.json`, `mcp_status_log.txt`,
  `mcp_target_state.json`, and `mcp_events.txt` back onto disk the same way
  it pushes: full pull on every (re)connect, incremental pull every 2s
  while connected. **Validated only against `selftest`'s in-process mock
  and a real subprocess daemon on scratch ports (disconnected-state
  behavior) — not yet against the real game actually writing these files
  while the daemon is connected.** A daemon is running live on port 12526
  right now, but it started before this pull code existed, so it doesn't
  have it yet; the next restart of that process (or the next session) picks
  it up. See `docs/claude-todo.md`'s "game → disk direction" item for the
  precise validated/not-validated line and `tools/bb_remote.py`'s section
  below for the design.

---

## Rooting

### `hacking/crawler.js`

Breadth-first walk of the network, forever. For each server that is unrooted,
within your hacking level, and not in `IGNORE`, it runs `worm.js` against it.
Sleeps 2 minutes between sweeps.

- **Start:** `run hacking/crawler.js`
- **Reads/writes:** nothing on disk
- **Stop condition:** none, runs until killed

**Known bug:** `let serv_set = Array(servers)` should be `Array.from(servers)`.
`Array(x)` with a single non-number argument produces `[x]` — a one-element
array containing the seed list — so `serv_set.includes(con)` never matches any
of home's immediate neighbours and they get re-queued on every rediscovery.
Wasteful, not fatal: the `hasRootAccess` check makes the repeat visits no-ops.

### `hacking/worm.js`

Opens as many ports as it has `.exe`s for, then `ns.nuke()`s a single server.

- **Start:** normally by `crawler.js`; manually `run hacking/worm.js <server>`
- **Exits early** if the server needs more ports than it can open
- **`hacking/backdoor.js`** (fixed 2026&#8209;08&#8209;11 — previously
  referenced here but missing from the repo, so this `ns.exec` silently
  returned 0 every time): on success against `CSEC`, `avmnite-02h`,
  `I.I.I.I`, or `run4theh111z` (the four regular-network servers whose
  backdoor unlocks a faction invite — checked against `NetscriptDefinitions.d.ts`
  2026&#8209;08&#8209;11: there's no general benefit to backdooring a
  regular server beyond faction-invite/endgame requirements like this, and
  for **darknet** servers specifically it's actively costly, not just
  neutral — see `docs/darknet-tactics.md`'s §2, backdoors compound
  network-wide authentication instability, budget ~2&ndash;4 total, "do not
  backdoor anything" during exploration), walks the terminal connection
  there from `home` via BFS over `ns.scan` (`ns.singularity.connect` only
  hops to direct neighbours) and calls `ns.singularity.installBackdoor()`,
  then returns the terminal to `home`. **Only fires on a fresh nuke** — if
  any of the four were already rooted before this fix landed, worm.js won't
  re-trigger it (the nuke branch is gated on `!ns.hasRootAccess`).

  **Needs Source-File 4 — confirmed live 2026&#8209;08&#8209;11, before Ken
  had it: every `ns.singularity.*` call throws an uncaught `RUNTIME ERROR`
  modal without SF4**, not just a soft failure. `hasSourceFile4` (checks
  `ns.getResetInfo().ownedSF` — a base-`ns` call, never gated, safe to probe
  with) now guards the whole function and prints one clear `ns.tprint` line
  instead of letting the error modal surface. **Until SF4 exists, the actual
  fix is typing the same steps by hand**: `connect <hop1>`, `connect <hop2>`,
  ... `connect <target>`, `backdoor` — plain terminal commands are never
  Singularity-gated, only the `ns.singularity` API wrapper around them is.
  `hacking/findpath.js <target>` (added alongside this fix, `ns.scan`
  only, never gated either) prints the exact hop sequence to type.
  **Confirmed working this way 2026&#8209;08&#8209;11**: typed the real
  connect-chain + `backdoor` into the live terminal via Claude's
  CDP-driven terminal write for `I.I.I.I` — The Black Hand now shows under
  Ken's joined factions. `CSEC`/`avmnite-02h` (CyberSec/NiteSec) were
  already backdoored from earlier play, before this fix existed;
  `run4theh111z` is still unrooted, so untested end-to-end past the
  root-access check.

After an augmentation install your `.exe`s are gone and hacking level resets,
so the pool shrinks to what needs no ports. Rebuilding it means Create Program
(or buying from the darkweb) before the crawler can make progress again.

---

## Farming

### `mcp.js`

The orchestrator, and where nearly all the complexity lives. Each tick
(`LOOP_SLEEP_MS`, 10s) it scans the network, decides on a target, decides on a
plan, and allocates worker threads across every rooted host.

**2026-08-14: read `docs/hacking-mechanics.md` and `docs/hacking-strategy.md`
before changing anything below.** The mechanics doc has the actual game
formulas (extracted from the real game source, not guessed); the strategy
doc analyzes this file and `mcp_logic.js` against them. Six of its ranked
fixes are now implemented in this codebase: R2 (the stuck-target detector),
R3 (`hostNeedsRedeploy` allocation-quantity diffing), R1 (sizing hack/grow
from the target's actual balance point instead of a fixed RAM-fraction
bucket table), R5 (per-script rather than per-host redeploy), R7 (a
handful of cheap items — `home` joining the worker pool, a clamped
grow-security reserve, `SECURITY_CAP` tidied to 1), and R4 (target
scoring — see "Target scoring" below). See that doc's §5 for which have
been confirmed live and which are shipped but not yet restarted in-game.

- **Start:** `run mcp.js` — optionally `run mcp.js target=<hostname>`
- **Reads:** `mcp_config.json` every tick (see Tunables), plus
  `mcp_objective_override.txt` every tick (see `OBJECTIVE` below —
  `set_objective.js`'s self-serve lever)
- **Writes:** `mcp_status.json` (every tick, overwritten),
  `mcp_status_log.txt` (appended only when target/plan/weightBucket changes),
  `mcp_events.txt` (one line per transition),
  `mcp_target_state.json` (exclusions, so they survive a restart)
- **Deploys:** `/scripts/weaken.js`, `/scripts/grow.js`, `/scripts/hack.js`

**`mcp_logic.js` holds the pure decision logic** — `evaluateMoneyDegradation`
(the eviction predicate at the center of the `moneyDegraded`/XP-mode bug
fixed in `81814d6`), `evaluateOpportunitySwitch` (the switch comparison),
`evaluateStuckTarget` (the stuck-detector decision — see 2026-08-13 below;
fixed a live bug where a target sitting at its security floor, the normal
outcome of a weaken phase, got evicted as "stuck" once security next rose,
because the old inline version never reset its window on reaching the
floor), `computeWorkWeights` (sizes hack/grow from the target's actual
balance point — see "The work-weight calculation" below and
`docs/hacking-strategy.md` R1; replaced the old fixed RAM-fraction bucket
table entirely on 2026-08-14), `computeTargetScore`/`computeTargetEffectiveScore`
(the achievable-rate target score and its ramp-cost discount — see "Target
scoring" below and `docs/hacking-strategy.md` R4, 2026-08-14; replaced the
old one-hack-thread-at-full-money score and the `READINESS_FLOOR`
multiplier), `computeDesiredAllocation`/`hostNeedsRedeploy`
(the two-pass allocation-diff redeploy — R3; `computeDesiredAllocation` also
takes an optional `growSecurityIncreaseForThreads` injected function as of
R7, so its weaken-phase leftover-grow branch can use the game's own clamped
`ns.growthAnalyzeSecurity` without this file ever calling `ns` directly),
`countRunningByScript` (the running-threads-per-script tally shared between
`hostNeedsRedeploy`'s mismatch check and `allocateThreads`'s per-script
redeploy decision — R5), and `computeTickInvariantChecks`
(the invariant predicates). No `ns` calls,
no side effects — `mcp.js` imports it the same way `dnet_deploy.js` imports
`dnet_lib.js`, and does all the `ns` calls and mutation itself, calling into
this module only for "given these inputs, what's the decision."

Test it with `node --test mcp_logic.test.js` — runs in well under a second,
no game round trip, and covers the exact regression scenario that took three
live restarts and 4-5 minutes each over CDP to diagnose the night `81814d6`
was fixed. `node --check mcp.js mcp_logic.js` is the syntax-only sanity check
for both files (imports aren't resolved outside the game, so this doesn't
catch a bad import path — only parse errors). **Any future change to the
logic in `mcp_logic.js` should get a test added/run before being shipped** —
see `docs/claude-todo.md`'s workflow note.

**Argument:** `target=<hostname>` pins the target, bypassing selection. It is
validated against the scanned network — a name that isn't a hackable server is
rejected at startup rather than silently ignored.

**The tick, in order:**

1. Scan the network; identify rooted hosts with RAM (`workers`).
2. Compute `maxWeaken` — the weaken threads the pool *could* run if the RAM
   currently held by our own action scripts were reclaimed. Counting only free
   RAM here was the bug that pinned `maxWeaken` at 0 for 98.8% of ticks.
3. If a target is held: check whether it is **stuck** (security not falling)
   or **degraded** (money sustainably low *and* declining, or rate dropped).
   Either marks it excluded and clears the target. The money-degraded half of
   this is disabled entirely in XP mode — see `OBJECTIVE` below.
4. Evaluate the **opportunity switch** — see below.
5. If no target, pick one: highest achievable-rate score discounted by ramp
   cost — see "Target scoring" below.
6. Build a **plan**: `weaken` if security exceeds the cap, otherwise `work`
   with a hack/grow weighting sized from the target's actual balance point
   (`computeWorkWeights`, R1) and scaled by how full the target is.
7. Allocate threads per host, redeploying only the script(s) on a host whose
   running thread count no longer matches the plan (R5 — see "Redeploy is
   conditional" below).
8. Write status.

**Worker hosts (`getWorkerHosts`) — `home` excluded since 2026-09-01.** MCP
uses rooted remote servers only. `home` is reserved entirely for the manager,
diagnostics, contract tools, and user work; startup also kills any historical
home `weaken`/`grow`/`hack` workers so the change takes effect cleanly after a
restart. `HOME_RAM_RESERVE` remains a compatibility/diagnostic setting but no
longer allocates worker threads on home.

**Target exclusions are preferences, not bans.** If nothing qualifies,
selection reruns ignoring exclusions. Without that fallback the bot livelocked
after an augmentation: it drained its only reachable target, excluded it, and
then sat idle killing scripts every 60 seconds.

**Redeploy is conditional.** Hack, grow and weaken take 60–240 seconds; the
tick is 10. Killing and re-execing every tick meant no action ever completed.
`hostNeedsRedeploy` is what stops that. **2026-08-14 (R5, shipped, not yet
confirmed live):** when a redeploy *does* fire, `allocateThreads` now kills
and re-execs only the script(s) whose desired thread count actually changed
(`weaken`/`grow`/`hack`, in that order — weaken first since it has the
longest cycle and should start earliest), instead of killing and
re-execing all three unconditionally. The old all-three teardown reopened a
full weaken-cycle window (the longest of the three) on every redeploy, during
which hack/grow kept landing and fortifying security with nothing
counteracting it — consistent with the observed security ratchet. The
have-side counting (`countRunningByScript`, `mcp_logic.js`) is now shared
between `hostNeedsRedeploy`'s mismatch check and `allocateThreads`'s
per-script decision, rather than two independent tallies.
The missing-action escape hatch starts the portion of a newly desired action
that fits in *currently free* RAM while preserving an immature, unrelated
action; without it, a long weaken loop can leave the rest of a host idle while
the next weaken plan also needs grow capacity. `killActionScripts`
(kills all three unconditionally) is unchanged and still used for its other
two purposes — sweeping orphaned scripts from a previous `mcp.js` run at
startup, and releasing the whole network when no target is found — both of
which genuinely want a full teardown, not a diff.

#### The work-weight calculation

**2026-08-14 (R1):** `buildPlan` no longer picks a hack/grow split off a
fixed RAM-fraction table keyed by which `moneyPct` tier the target sits in.
It reads the target's actual balance point live (1GB each, no Formulas.exe
needed) — `hackPercentPerThread = ns.hackAnalyze(target)`,
`growLogPerThread = Math.LN2 / ns.growthAnalyze(target, 2)` — and passes
them into `computeWorkWeights` (`mcp_logic.js`) along with
`HACK_BALANCE_SAFETY` and the same `SECURITY_CONSTANTS` bundle
`computeDesiredAllocation` uses. See `docs/hacking-strategy.md` §1/§2.1 for
the full derivation: the real game formulas make the system bistable (money
either pins near max or collapses toward the floor, nothing stable in
between), and the old bucket table's entire non-zero hack range sat 4-8x past
the collapse threshold for every target actually being farmed.

The hack share returned is `balancedHackShare * HACK_BALANCE_SAFETY *
readiness²`, where `readiness = min(1, moneyPct / TARGET_MONEY_GOAL)` — a
continuous ramp instead of discrete tiers, so there is no bucket boundary
left to oscillate across. `plan.weightBucket` is now a 3-value regime tag
(`"xp"` / `"ramp"` / `"harvest"`, the last two only from money mode) kept
purely so a regime change can still be told apart from ordinary weight
drift — it fires a `weight_regime_change` event (the R1 replacement for the
old `bucket_change` event) and is folded into the same-tick redeploy
decision the same way a plain quantity mismatch is, since `hostNeedsRedeploy`
diffs desired-vs-running thread counts (R3) rather than caring about the
bucket identity itself.

`HACK_BALANCE_SAFETY` (default 0.5, see Tunables below) is the fraction of
the balanced share actually deployed — running exactly at balance is a
driftless random walk with no restoring force, so shipping below 1.0 buys a
positive drift that pins money near max at a linear income cost.

#### Target scoring

**2026-08-14 (R4, shipped, not yet confirmed live).** `getTargetScore`
(`mcp.js`) is the "raw potential" of a candidate — an estimate of the $/s it
would actually produce if handed the network's *entire* thread pool and run
at R1's balance point, computed by `computeTargetScore` (`mcp_logic.js`) from
`hackTime`/`hackAnalyze`/`growthAnalyze(target, 2)`/`maxMoney`/
`hackAnalyzeChance` (all 0-1GB, no Formulas.exe) plus a `poolThreads`
estimate. It replaced the old `maxMoney * hackAnalyze * hackAnalyzeChance /
hackTime` score, which never read `serverGrowth` at all and so
systematically favoured low-`requiredHackingSkill`, low-growth targets over
ones with a far higher grow-limited ceiling — see `docs/hacking-strategy.md`
§1.3's misranking table and §2 R4.

`poolThreads` is `maxWeaken` (step 2 of the tick above), reused as-is rather
than a second RAM-basis calculation: it's already computed once per tick, so
passing it through costs nothing even though `getTargetScore` runs once per
*candidate* server in `rankTargets`; and `scripts/grow.js`/`scripts/weaken.js`
cost the identical 1.75GB/thread, so a weaken-RAM-basis thread count is
exactly a grow-RAM-basis one too, not just a convenient stand-in — which is
also why the same value is reused for `growThreadsIfAllGrow` below. One gap
carried over from the doc rather than fixed: the inputs are read at the
candidate's *current* security, not the floor it would be weakened to, which
under-rates a target sitting well above its floor — the doc's optional
arithmetic workaround for this was not implemented.

`getTargetEffectiveScore` discounts that raw potential by an explicit ramp
cost — `computeTargetEffectiveScore`'s `effective = score * horizon /
(horizon + rampSeconds)`, where `rampSeconds` is the modelled wall-clock time
to grow the target up to `TARGET_MONEY_GOAL` if the whole pool ran grow
against it, and `horizon` is the new `SCORE_HORIZON_SECONDS` tunable (default
3600 — the bot runs for hours). This replaced the old `READINESS_FLOOR`/
`max(moneyPct, 0.05)` multiplier, which was dimensionally arbitrary. A
target that would take 20 minutes to ramp is worth less over the next hour
than one already near its goal, but by less and less as the horizon
lengthens — before R4, `MIN_TARGET_COMMIT_MS`'s 600s commit window was
implicitly standing in as that horizon, too short for a target with a longer
but more valuable ramp to ever win.

#### The opportunity switch

Adoption only happens when there is no current target, and both abandonment
paths assume a target eventually runs dry. Once grow keeps pace with hack, a
target can be farmed sustainably forever — it never degrades and never empties
— so without this the bot would farm the smallest server on the network
indefinitely while richer ones sat untouched.

Two regimes, because the fair comparison differs:

| Current target | Compared on | Minimum hold |
| --- | --- | --- |
| producing nothing (`moneyPct < 0.1`) | `getTargetEffectiveScore` (ramp-discounted) | `MIN_TARGET_HOLD_MS` (60s) |
| productive | `getTargetScore` (raw potential) | `MIN_TARGET_COMMIT_MS` (600s) |

It switches when the best alternative beats the current one by more than
`OPPORTUNITY_SWITCH_FACTOR` (1.3×, dropped from 3× on 2026-08-14 alongside
R4's new score and ramp discount — see below) *and* the hold timer has
elapsed.

The predicate is evaluated **every tick** and recorded as `switchEval` in the
status file, even when the hold timer forbids acting on it. That is deliberate:
the two blockers demand different responses. Losing on score means the
factor is what stands between the bot and a richer server. Losing on the hold
timer just means waiting. `blockedBy` names which.

`R8_SWITCH_VETO_ENABLED` defaults to `0`. When set to `1`, the existing
scheduler still chooses the candidate first; R8 can only retain the present
target when the candidate's Formulas minimum-security score is below 80% of
the present target's score.
`formulaSwitchVeto` in status and `r8_switch_veto_eval`/`r8_switch_veto`
events retain the candidate, both scores, ratio, availability, verdict, and
reason. Missing Formulas.exe or invalid formulas data preserves the existing
switch rather than blocking it. A 2026-08-18 bounded live configuration check
confirmed the manager accepts `0 → 1 → 0`; no qualified switch arose during
that window, so the veto outcome itself remains locally tested but not yet
observed live.

**2026-08-14 (R4):** `OPPORTUNITY_SWITCH_FACTOR` dropped from 3 to 1.3 (the
doc's suggested 1.25-1.3 range, safer end) — but *only* together with the
`getTargetScore`/`getTargetEffectiveScore` rewrite above, never before, per
the doc's explicit instruction: a 3× bar was calibrated against a score that
barely varied target-to-target (the old score never read `serverGrowth`), so
it forbade real, large improvements the new score can actually see. The ramp
discount already prices in the cost of switching, so 1.3 only needs to cover
model error, not switching cost too. `MIN_TARGET_COMMIT_MS` is unchanged at
600000 — the doc is explicit this stays as the anti-thrash guard regardless.

#### Tunables — `mcp_config.json`

**Re-read at the top of every tick. No restart needed.** That matters because
a restart wipes `rateSamples`, `moneyPctSamples`, `totalHacked` and
`lastSwitchTime` — automating restarts made the evidence-destruction cycle
faster, not smaller. Editing the config is the only way to change a constant
and still have the history that says whether it helped.

The ones that actually get retuned:

| Key | Default | What it governs |
| --- | --- | --- |
| `SECURITY_CAP` | 1 | Above this, the plan is pure weaken |
| `WORK_SECURITY_MARGIN` | 1.5 | Absolute headroom kept during `work` |
| `TARGET_MONEY_GOAL` | 0.95 | Money fraction `readiness` (see the work-weight calculation above) treats as "full" |
| `DEGRADED_MONEY_PCT` | 0.05 | Drain threshold — **must** stay below the idle-regime cutoff of 0.1, and an invariant enforces it |
| `OPPORTUNITY_SWITCH_FACTOR` | 1.3 | Margin required to abandon a working target |
| `R8_SWITCH_VETO_ENABLED` | 0 | Enables the attested formulas veto only after its named canary/production gate; `0` preserves existing switching exactly |
| `LOOP_SLEEP_MS` | 10000 | Tick length |
| `HACK_BALANCE_SAFETY` | 0.5 | Fraction of the balanced hack share actually deployed — see the work-weight calculation above |
| `HOME_RAM_RESERVE` | 32 | GB kept off-limits on `home` before any of it counts as free for worker threads — see "Worker hosts" below |
| `SCORE_HORIZON_SECONDS` | 3600 | Horizon `getTargetEffectiveScore`'s ramp-cost discount is amortised over — see "Target scoring" above |

**2026-08-14 (R7, shipped, not yet confirmed live):** `SECURITY_CAP` default
dropped 6 → 1 — it was a no-op for every target actually worth farming
(their security floors run 7-28), only binding on low-tier servers, where 1
buys ~13-16% on hack time and steal percentage. Cosmetic at current scale,
tidied while touching config for the same change.

Fourteen more numeric keys are configurable; the file in the repo lists all
twenty-three (twenty-two numeric + the `OBJECTIVE` string enum) with their
defaults. Rules for the numeric ones: only numbers are
accepted, unknown keys are rejected and reported, and **corrupt JSON keeps
the current values** rather than reverting to defaults — a half-saved file
should not silently undo a deliberate tune. Every change emits a
`config_change` event with a diff, and the effective config rides in
`mcp_status.json` so an edit can be confirmed to have taken.

#### `OBJECTIVE` — money vs. XP

`"money"` (default) or `"xp"`, hot-reloadable like everything else. Validated
as a string enum separately from the numeric tunables — an invalid value is
rejected and reported the same way a bad number is, keeping the current
setting rather than falling back to the default mid-run.

**Self-serve lever: `set_objective.js`** (added 2026-08-14). `run
set_objective.js money|xp|clear` from the in-game terminal, no Claude session
needed — or `run set_objective.js` with no argument to print what's actually
in effect right now (read straight from `mcp_status.json`'s `config.OBJECTIVE`/
`objectiveOverrideActive`, not re-derived, so it can't drift out of sync with
what `mcp.js` itself resolved). Writes `mcp_objective_override.txt` — a separate file from
`mcp_config.json` on purpose. `mcp_config.json` is the git-tracked,
disk-authoritative source pushed one-way disk→game (see "File sync" above);
an in-game script writing straight to it would work until the next disk
resync, then silently revert with no signal — a footgun for a lever meant to
be pulled without Claude watching. The override file is never written from
disk, only read by `mcp.js` (every tick, alongside `mcp_config.json`) and
written in-game by `set_objective.js`, so it survives resyncs of everything
else. When set, it **wins over `mcp_config.json`'s `OBJECTIVE`** — surfaced
as `objectiveOverrideActive` in `mcp_status.json` and an `(override)` suffix
on the tail window's `objective=` line, so it's visible either way. `clear`
empties the file, falling back to `mcp_config.json`'s value. Gitignored (like
`mcp_restart.txt`) — it's a generated in-game trigger, not authored content;
included in `PULL_FILES` purely so its current value is visible on disk
without a special dump.

Money mode is the balance-point calculation described above
("The work-weight calculation"). XP mode does **not** reuse it — deliberately.
`hackExp(server, player)`'s own signature takes no money or percent
argument, confirming hacking XP per completed action is independent of how
much was actually stolen. The entire reason money mode ramps hack down to
near-zero on a drained target is that a near-zero steal isn't worth the
security cost — a reason that simply doesn't exist for XP. So XP mode uses
one fixed split regardless of `moneyPct`: `XP_WEIGHT_HACK` (default 0.95) and
`XP_WEIGHT_GROW` (default 0.05), tagged with the `"xp"` regime so switching
`OBJECTIVE` live is still recognized as a regime change (`weight_regime_change`
event) the same way a money-mode ramp/harvest transition is.

XP mode uses a 0.95/0.05 hack/grow split. Hack has the best XP per GB-second;
the small grow share is insurance against reducing a target to exactly $0,
where a hack receives only failure XP. It ranks targets independently of
money using `(3 + 0.3 * baseSecurity) * (0.25 + 0.75 * chance) / hackTime`:
the game's base XP per action, adjusted for a failed hack's quarter-XP award,
per hack-thread second. This branch is reachable only while `OBJECTIVE` is
`"xp"`; money-mode scoring and allocation are unchanged.

**Money-based eviction is disabled in XP mode.** The hack-heavy split above
drains each target's money toward zero by design — the `moneyDegraded` check
described under "The opportunity switch"/step 3 above would then read that as
every target "yield degraded" in turn and evict it, chaining from target to
target indefinitely and defeating XP mode's entire point of sitting still to
grind hack XP. Confirmed live 2026-08-09: three evictions in under a minute.
`moneyDegraded` is now unconditionally `false` when `OBJECTIVE === "xp"`;
`rateDropped` (a real stall, not a money read) still applies in both modes,
and the opportunity switch (comparing against a much-better idle target) is
untouched and remains the only way XP mode gives up a target on its own.

#### Telemetry

Three things stamp or check every tick:

- **`runId` + `scriptVersion`.** mcp hashes its own source (djb2 — a retuned
  constant is exactly the same-size edit a length check would miss) and stamps
  it into every status write and every event. `mcp_hud.js` hashes `mcp.js`
  itself and compares, so **version drift shows up as an `OLD CODE` verdict.**
  This exists because the loop now edits code here, lets the sync watcher push
  it, and restarts by writing a token — nobody looks at the game in between,
  so "is the running code the code on disk?" gets asked constantly and was
  previously unanswerable.
- **`formatStatus(status)`** is the single field list. The tail line and the
  log line both derive from it. Add a field to `status`; that function is the
  only place deciding how it renders. Three parallel hand-maintained lists is
  how `lowMoneySeconds` reached `ns.print` only, and `switchEval` the JSON
  only — the same miss, twelve hours apart.
- **Invariants**, which assert on the code's own intentions and never on game
  state. Game state may surprise us; our own bookkeeping may not. A violation
  toasts once per name per run and increments a counter in the status file,
  which the HUD renders and the out-of-game watcher wakes on.

| Invariant | Catches |
| --- | --- |
| `eventLogWrites` | A write to `mcp_events.txt` failing — this is what caught the file's own invalid-extension bug, see below |
| `weakenBudgetNonNegative` | Budget over-allocation, found originally only by an accident of two fields lining up |
| `tickWithinBounds` | The 70–380s ticks that silently multiplied every rate |
| `poolNotIdle` | The network sitting 93% idle during weaken phases |
| `threadsFitHost` | The inconsistent-RAM class (`usedRam 3.5, freeRam 16, maxRam 16`) |
| `drainBelowEmptyTier` | A config edit that would strand recovering targets |
| `configParses` | A malformed `mcp_config.json` |

### `mcp_events.txt`

Content is JSON-lines (one JSON object per line), but the extension is
`.txt`, not `.jsonl` — Bitburner's `ns.write` only accepts a path ending in
`.txt`/`.json`/`.css` or a script extension; anything else throws `File path
should be a text file or script`. This is the same bug class as the `.log`
lesson elsewhere in this project, and it hit this file specifically for its
entire first day: every write threw, caught by a try/catch and printed only
to `ns.print`, so the file never actually existed in the game — invisible
because the in-memory ring buffer that feeds `recentEvents` in the status
file kept working regardless of whether the write succeeded, so everything
*looked* fine. Found only by checking why a correctly-set download pattern
still wasn't pulling the file down. Now caught structurally: a write failure
here trips the `eventLogWrites` invariant, so a future extension mistake
toasts instead of vanishing silently.

One line per transition — `startup`, `target_adopt`, `target_drop`,
`degraded_held`, `plan_flip`, `weight_regime_change` (renamed from
`bucket_change` on 2026-08-14 when R1 replaced the bucket table — same "did
the hack/grow regime change" purpose, now over `computeWorkWeights`'s
3-value tag), `stall`, `config_change`, `invariant_violation`. Never per
tick.

The rule that makes it worth having:

> An event records the value of every variable that appeared in the predicate
> that fired it — not the state afterward.

So a `target_drop` for `drained` carries the whole sample array, `declining`,
`rateDropped`, `lastAvgRate`, `heldMs` and every threshold involved. A wrong
theory dies on reading. The same event carrying only `{reason: "drained"}`
costs three restart cycles to disambiguate, because the reader has to infer
backwards from effect to cause — which is exactly where this project
repeatedly lost hours.

Trimmed to the last 300 lines at startup, so it stays bounded inside the save
file while still surviving the restarts that wipe every in-memory sample. The
most recent 20 also ride inline in `mcp_status.json`, so one read gives both
"now" and "how we got here".

### `mcpMulti.js` / `mcpMulti_logic.js`

Experimental multi-target farmer, built 2026-08-29 to test the single- vs.
multi-target question from that session's discussion: `mcp.js`'s
`computeDesiredAllocation` (mcp_logic.js) hands the *entire* worker pool's
RAM to one target's plan every tick, and its scoring assumes `poolThreads`
is the whole network's capacity — a policy choice, not a game constraint.
`mcpMulti.js` is a completely separate script so `mcp.js` stays untouched
and keeps farming live while this is tried out.

**Dry-run by default** — same shape as `mcp_stock_trader.js`'s `trade=1`
gate. Default mode computes a full multi-target plan every tick (which
targets, which hosts, projected $/s per target, and a
`singleTargetBaselineScore` — what `mcp.js`'s own approach would project if
it gave the whole pool to just the best target) and writes it to
`mcp_multi_status.json`, but never calls `ns.exec`/`ns.scp`/`ns.kill`. Only
`run mcpMulti.js live=1` deploys real threads.

- **Start:** `run mcpMulti.js` (dry-run) or `run mcpMulti.js live=1` (deploys
  real threads)
- **Reads:** `mcp_multi_config.json` every tick
- **Writes:** `mcp_multi_status.json` (every tick), `mcp_multi_status_log.txt`
  (on change), `mcp_multi_events.txt`, `mcp_multi_target_state.json`
- **Deploys** (`live=1` only): the same `/scripts/weaken.js`, `/scripts/grow.js`,
  `/scripts/hack.js` `mcp.js` uses
- **Mutual exclusion:** `live=1` refuses to start while `mcp.js` is running on
  `home` — the two would fight over the same rooted hosts' RAM (both
  `ns.exec` the same action scripts, both `ns.kill` mismatched threads). Kill
  `mcp.js` first, or stay in dry-run to run it alongside the live bot.

**The scheduler (`mcpMulti_logic.js`, `node --test mcpMulti_logic.test.js`):**
everything about what a good plan looks like *for one target* — work-weight
sizing, target scoring, stuck detection — is imported unchanged from
`mcp_logic.js`; multi-target only changes how many targets run at once and
how hosts split across them. Two new pure functions:

- `computeTargetPoolNeed` — `computeTargetScore`'s own model has a target's
  money-drained fraction saturate as
  `1 - exp(-growTimeRatio * hackThreads * hackPercentPerThread)`; this solves
  that same formula for "how many pool-thread-slots until this target is
  `SATURATION_FRACTION` (default 0.9) saturated," instead of leaving
  unbounded RAM parked on one target indefinitely.
- `partitionHostsAcrossTargets` — greedily assigns whole hosts (largest
  first, so `home` lands on the best target) to the top-ranked candidate
  until its need is met, then the next, up to `MAX_CONCURRENT_TARGETS`
  (default 3). Leftover RAM once every target's need is met goes back to the
  single best target, never left idle. Whole-host granularity — a host isn't
  split across two targets' plans — so each target's own allocation still
  goes through `computeDesiredAllocation` unmodified, just once per assigned
  host subset.

**v1 scope, narrower than `mcp.js` on purpose:** money objective only (no
XP mode — spreading across targets doesn't share XP mode's "sit still and
grind one target" rationale); no R8/Formulas.exe switch veto; no
money-degradation eviction timer (`mcp.js` needs one because it *commits* to
one target and must decide when to stop re-litigating that commitment;
`mcpMulti.js` recomputes the whole partition from live scores every tick, so
a draining target's declining `moneyPct` already lowers its own next-tick
need/rank — nothing is "committed" for a timer to protect). Stuck-target
detection (`evaluateStuckTarget`) is kept: a target whose security never
converges would otherwise permanently occupy an assignment slot for zero
income.

**Known duplication:** `mcp.js` only exports `main`, so the small `ns`-glue
infrastructure it doesn't share (network scan, RAM accounting, event log,
thread exec, ...) is copied into `mcpMulti.js` rather than imported —
consistent with `mcp_logic.js`'s own "copied verbatim, not rewritten"
extraction, and the alternative (a shared module) would require editing
`mcp.js`.

**`projectedScore`/`singleTargetBaselineScore` are ramp-discounted
(2026-08-29), not the raw steady-state rate.** `skim_probe.js`'s live
analysis (see below) found priming an unweakened, ~2%-money target runs
30 minutes to 50+ hours depending on the server — so a raw score for a
still-priming assignment would overstate near-term reality the same way the
pre-R4 single-target score used to. Both fields now use
`getTargetEffectiveScore` (same ramp-cost-discount function `mcp.js`'s own
`candidateScore` uses), so `upliftRatio` is an apples-to-apples comparison.
Deliberately *not* applied to `computeTargetPoolNeed`/
`partitionHostsAcrossTargets`'s capacity math — how much RAM a target can
usefully absorb doesn't depend on whether it's primed yet, and discounting
it would make the partitioner wrongly reluctant to start priming a good
second target early with surplus RAM that would otherwise sit idle.

### `skim_probe.js`

One-shot, read-only diagnostic (2026-08-29) — dumps every currently-hackable
server's money/security/timing to `skim_probe.json`. Built to test a "skim
the top off each server and move on" hypothesis against `mcp.js`'s steady
balance-point harvest. **Finding:** untouched servers sit at ~2% money and
13-62 security points above floor (not full-money/floor-security as a "skim"
strategy would need), and priming one (weaken-to-floor + grow-to-full) with
the whole worker pool takes 30 minutes to 50+ hours depending on the server.
Comparing real per-server numbers against `mcp_logic.js`'s own scoring
formulas: steady harvest beats a best-case one-shot skim by roughly 3x-75x
on every server on the network — no dedicated skim mode was built as a
result. Directly motivated the `projectedScore`/`singleTargetBaselineScore`
ramp-discount fix in `mcpMulti.js` above, once it was clear priming cost is
large enough to matter for multi-target's own numbers too.

- **Start:** `run skim_probe.js`
- **Writes:** `skim_probe.json` (overwritten each run)
- No `ns.hack`/`ns.grow`/`ns.weaken` calls — unlike `econ_probe.js`, purely
  read-only.

### `scripts/weaken.js`, `scripts/grow.js`, `scripts/hack.js`

Three lines each: loop forever calling the one NS function on `ns.args[0]`.
All the intelligence is in how many threads `mcp.js` starts and when it kills
them. Keeping them dumb is what makes thread count the only control surface.

`mcp.js` copies these to each worker itself; it does not use the helpers in
`scripts/`.

---

## Observation

### `mcp_hud.js`

The terse panel — "is it healthy?" at a glance, sized to sit under the game's
own Overview.

- **Start:** `run mcp_hud.js` — optional `x= y= w= h=` in pixels
- **Reads:** `mcp_status.json`. It measures nothing itself, so it cannot
  disagree with the orchestrator.
- **Cost:** ~2.35GB (1.6GB baseline plus `ns.ps` + `ns.kill`)
- Re-running supersedes the previous instance instead of opening a second
  window, so repositioning is just a re-run — and now closes that instance's
  window too, not just its process. `ns.kill` alone doesn't close a script's
  tail window; found by observation after two `startup.js` runs left two
  visibly different "mcp" panels open while `ps` showed only one live
  process — the second was a frozen ghost from the instance the previous run
  had already killed. Fixed with `ns.ui.closeTail(pid)`, which exists
  specifically to close a window belonging to a script other than the
  caller. This only prevents *future* ghosts — a window already orphaned by
  an older, now-dead process has no live PID left for `ns.ps` to find, so it
  can't be closed programmatically and needs one manual click.

```
+--------------------------+
|OK              foodnstuff|   verdict + target
|plan                  work|
|money 93%         sec 5.42|
|rate 112k       avg 98.00k|
|wkn 40/210    w40 g300 h12|   needed/available, then live threads
|ram 97%           19 hosts|
|lvl 341     earned 45.20m|   see below
|next phantasy       1.8/3x|   see below
|ver ok               inv 0|   code drift, invariant violations
|tick 10.1s          age 0s|
|x=950                y=190|   see below
+--------------------------+
```

The first word is a verdict, and every line beneath it carries an input to
that verdict, so it never asks you to trust the summary alone. In priority
order:

| Verdict | Meaning |
| --- | --- |
| `NO DATA` | No readable `mcp_status.json` |
| `STALE` | Status older than 90s — mcp is wedged or dead |
| `OLD CODE` | The running mcp does not match `mcp.js` on disk |
| `INVARIANT` | One of mcp's own assertions has failed |
| `WEAKEN` | Needs more weaken threads than the pool can supply |
| `DRAINED` | Average money share below the drain threshold |
| `SLOW` | Tick longer than 30s |
| `OK` | — |

`OLD CODE` outranks every health signal deliberately: if the running code is
not the code on disk, every judgement below that line is about the wrong
program, and the fix is a restart rather than a diagnosis.

`age` matters nearly as much: without it, a dead `mcp.js` would leave the panel
showing frozen-but-plausible numbers indefinitely.

The `ver`/`inv` row is always rendered, including its reassuring zeros, so the
panel's height never changes — `placeTail` sizes once, and a row appearing
later would clip.

The `next` row renders `switchEval` in three states:

| Shown | Meaning |
| --- | --- |
| `= current` | Nothing outranks the current target. Working as intended. |
| `hold 460s` | A better target exists; the commit timer is still running. |
| `1.8/3x` | A better target exists but isn't winning by enough. |

The `lvl`/`earned` row shows `ns.getMoneySources().sinceInstall.hacking +
.crime` — cumulative, only ever added to by the game itself, so spending
(Hacknet, servers, anything) can never move it. This exists because total
player money couldn't answer "is anything actually earning" once heavy
Hacknet spending became routine — see the out-of-game watcher section below.
"Since install," not "since start," so it survives script and game restarts
and only resets on an actual augmentation install.

The `x=`/`y=` row echoes back whatever position was actually applied — the
args passed in, or the computed default if none were. Bitburner exposes no
getter for a tail window's current position or size anywhere in the `ns.ui`
cost table (checked directly, not assumed), so a manual drag can never be
read back by a script. This is the substitute: dialing in a position is
"adjust the number, see where it lands, read the confirmation," not "drag,
then capture." Every panel in this project that supports `x=`/`y=` carries
this same row for the same reason.

### `mcp_money.js`

A second small panel, independent of the HUD — start/stop/roll-up like any
tail window — answering a different question: not "is the bot healthy" but
"where is money actually coming from and going." Reads
`ns.getMoneySources().sinceInstall` directly (not `mcp_status.json` — this is
whole-player accounting, not specific to the bot's own target, so there's no
orchestrator-disagreement risk to design around).

- **Start:** `run mcp_money.js` — optional `x= y= w= h=`, same as `mcp_hud.js`,
  same echo-row substitute for the missing position getter
- **Cost:** 3.3GB (1.6GB baseline + `ns.getMoneySources` 1.0GB + `ns.ps`
  0.2GB + `ns.kill` 0.5GB)
- Shows every non-zero category, sorted by magnitude, plus a `total` line.
  Expense categories (`hacknet_expenses`, `gang_expenses`) render as negative
  numbers with no special-casing needed — confirmed against the game's own
  code, not assumed: `loseMoney()` calls
  `recordMoneySource(-1 * amount, category)`, so the sign is already correct
  at the source.

```
+------------------------------+
|since last aug                |
|total                    3.06b|
|hacking                  4.20b|
|hacknet_expenses         -890m|
|crime                     320m|
|hacknet                 15.00m|
|x=1050                   y=430|
+------------------------------+
```

### `dnet_scorecard.js`

A compact Dark Net panel in the same visual family as `mcp_money.js`. It
reads the durable home-side crawler and loot shards directly, rather than
depending on manually refreshed `dnet_status.json`, and combines them with
the credential ledger, current player charisma, and the game's since-install
Dark Net money category.

- **Start:** `run dnet_scorecard.js`; optional `x= y= w= h=` use the same
  positioning convention and echo row as the other panels. A remote start is
  available through `restart_mcp.js --dnet-scorecard`.
- **Refresh:** every 2 seconds. A crawler shard is considered fresh for 120
  seconds, making churn visible without declaring a healthy mutation pause
  dead immediately.
- **Shows:** live/stale state; charisma and gain/rate since the panel opened;
  Dark Net money since the last augmentation install; fresh/known crawler
  count; current-pass sessions, failures, preparation, loot, phishing-thread
  starts and RAM-decision skips; unique credentials/models; cumulative RAM
  reclaimed, caches opened/found and karma; global instability; heartbeat age.
- **Verification:** every render writes `dnet_scorecard_status.json` with the
  exact displayed lines and an `ok` flag, making a successful live panel
  distinguishable from a process that merely launched and then crashed.
- **Durability:** cumulative loot is recomputed from immutable event shards,
  and credentials from the newest record per hostname, so the display does
  not inherit the stale merged-scoreboard problem found on 2026-08-14.
- Opt-in, like `mcp_money.js`; it is not added to `startup.js`.

```
+----------------------------------+
|DARK NET                      LIVE|
|charisma                  189  +12|
|charisma / min                26.4|
|darknet $ / install          8.20m|
|crawlers fresh / known      31 / 94|
|credentials / models        592 / 7|
|caches opened / found         2 / 2|
|instability              1.00x / 0%|
+----------------------------------+
```

### `dnet_hud.js`

Low-impact Darknet health panel. Unlike `dnet_scorecard.js`, it never scans
credential, deployer, or loot shards and writes no telemetry of its own. It
reads only `dnet_deployer_home.json` (the root gateway heartbeat) and
`dnet_manager_registry.json` (the compact active-manager registry), then
refreshes every 15 seconds.

- **Start:** `run dnet_hud.js`; optional `x= y= w= h=` position it like the
  other panels. Re-running it replaces the prior panel.
- **Shows:** root heartbeat freshness, active-manager count, known
  credentials, last-pass and lifetime delegation/failure counters,
  instability, and the latest failure stage/host.
- **Interpretation:** `STALE` means the root heartbeat is older than 30
  seconds or unavailable; it does not itself prove the full Darknet is down.
- **Cost profile:** two small `ns.read()` calls and one bounded tail redraw
  per 15-second refresh. It deliberately avoids `ns.ls()` and per-shard JSON
  parsing, which makes it appropriate while investigating renderer freezes.

### `mcp_stocks.js`

Read-only stock market panel — groundwork for trading, not trading itself.
**Never references `buyStock`/`sellStock`/`buyShort`/`sellShort`/
`placeOrder`/`cancelOrder` anywhere in the file, so it cannot move money**
regardless of what runs it or with what args. Answers three questions: do we
have WSE/TIX access, what (if anything) are we holding, and — once 4S Data
is bought — what looks worth buying.

- **Start:** `run mcp_stocks.js` — optional `x= y= w= h=`, same echo-row
  substitute for the missing position getter as every other panel here.
- **Cost:** 11.45GB (1.6GB baseline + `ns.ps` 0.2 + `ns.kill` 0.5,
  self-supersede + `stock.hasWseAccount`/`hasTixApiAccess`/`has4SDataTixApi`
  0.05 each + `stock.getSymbols`/`getPrice`/`getPosition` 2.0 each +
  `stock.getForecast`/`getVolatility` 2.5 each). Not in `startup.js`'s
  `SCRIPTS` list — same as `mcp_money.js`, it's an opt-in panel, not part of
  the always-on suite.
- Without 4S Data **TIX API access specifically** — a separate purchase from
  the UI-only 4S Market Data, `purchase4SMarketDataTixApi` vs
  `purchase4SMarketData` in the game's own function list — `getForecast`/
  `getVolatility` have no real signal, so the panel skips a ~30-row
  undifferentiated symbol dump in favor of one `watchlist locked (buy 4S)`
  line. Buying the TIX API variant needs no script change — the watchlist
  (top 10 symbols by `|forecast - 0.5|`, i.e. strongest directional signal)
  activates on the next poll.
- **First live run (2026-08-09) threw a runtime error**: the original code
  gated the watchlist on `has4SData()` (general 4S UI access), but
  `getForecast`/`getVolatility` actually check `has4SDataTixApi` internally
  (confirmed in source: `if(!r.ai.has4SDataTixApi)throw ...`) — two
  genuinely different flags. Since a runtime error inside `buildLines`
  discards the whole line array via the outer `catch`, the crash also hid
  an already-open position, not just the watchlist. Fixed by gating on
  `has4SDataTixApi()` instead; the error-display path was also widened from
  a single 34-char slice to up to 6 wrapped lines, so a future misdiagnosis
  like this one doesn't require re-deriving the cause from source again.
- **Confirmed against source, not assumed:** the augmentation-install reset
  wipes stock *positions* but not `hasWseAccount`/`hasTixApiAccess` — those
  clear only on a BitNode-prestige reset, a different and much rarer path.
  So this panel can legitimately show live TIX access with 0 positions
  immediately after an install, which is exactly what it showed on
  2026-08-09's install.

```
+----------------------------------+
|wse/tix                   yes/yes|
|4S tix                     locked|
|positions                       0|
|long value                     0 |
|short value                    0 |
|(no positions)                   |
|watchlist          locked (buy 4S)|
|x=1050                      y=640|
+----------------------------------+
```

### `mcp_stock_trader.js`

**Current state: live since 2026-08-18.** The approved instance runs as
`mcp_stock_trader.js trade=1`; its source and required logic module are in
the Remote API daemon's watched set so reconnects preserve that deployment.

Conservative long-only trader implementing a portfolio-wide adaptive 1%–10%
allocation cap and a 10% net-profit exit target. It requires WSE, TIX API, and 4S Market Data TIX
API; without 4S, forecast-based entries are not available and commission plus
spread make guessing a poor starting metric. It is dry-run by default and
cannot place orders unless started with `trade=1`.

- **Optional:** `interval=<ms>` (default 4000); the current output is the
  script log.
- Buys only when `getForecast(symbol) > 0.5`, and keeps the *combined*
  liquidation value of all positions within its cap of total portfolio equity.
  The cap starts at 10%, falls by one percentage point after each realized
  loss, rises by one after each realized gain, and is clamped to 1%–10%.
- Records actual entry cost in `mcp_stock_trader_state.json` (including
  commission) so profit is not recalculated at the current purchase price.
  Legacy positions fall back to average share price plus one commission.
- Takes profit above 10% net; a losing position is sold only after its
  forecast reverses to 0.5 or below, which is the realized-loss path that
  reduces the cap. It never shorts.
- **Incident evidence:** Ken's supplied process list showed a `trade=1`
  instance before restart. That proves the boundary was crossed, not that an
  order executed or the trader caused the game failure.

### `mcp_formulas_shadow.js`

**Current state: live-validated, shadow-only.** Run 5713 (2026-08-16)
confirmed the tracked-checkout version of this script opens its evidence
tail, samples once, and writes a retrievable `ready:true` snapshot — see
`docs/evidence/`. A further, tested-but-unmerged step exists in an isolated
worktree: a conservative switch-veto that uses this same formulas-based
minimum-security score to veto (never choose) a scheduler target switch.
See `STATE.md` for its status and the next step to land it.

Read-only, opt-in formulas shadow monitor. Reads `mcp_status.json` for the
manager's current target, income, pool capacity, and invariant counters; then
calculates a minimum-security target ranking with Formulas.exe. The tracked
version here never changes target selection, worker allocation, or
configuration — the veto variant in `STATE.md` still never *selects* a
target, only vetoes an already-chosen switch, and is off by default.

- **Interface:** `run mcp_formulas_shadow.js [intervalMs] [samples]` (default 120
  seconds; minimum 60 seconds). Set `samples` to a positive count for a
  bounded run; omit it for continuous monitoring.
- **Stop:** `kill mcp_formulas_shadow.js`.
- **Output:** cumulative JSON-lines snapshots in
  `mcp_formulas_shadow.txt`; each poll appends one complete snapshot and also
  prints that exact snapshot to the script log. Until explicit tail opening is
  implemented, there is no automatically visible tail panel. The file preserves the
  evidence from a bounded run, rather than leaving only its final poll. For
  continuous monitoring, stop and clear/archive the file deliberately if its
  size becomes material.
- **Failure mode:** missing/stale manager status or a formulas exception is
  recorded as a failed snapshot and shown in the tail; no production action is
  taken. Requires Formulas.exe.
- **Status:** audit/shadow tooling only; not part of `startup.js` and not
  integrated into `mcp.js`.

### `ipvgo_hud.js`

Terse status panel for `ipvgo_player.js`, same shape as `mcp_hud.js` — reads
`ipvgo_status.json` rather than measuring anything itself. Stacks below
`mcp_stocks.js` at `y=850`.

Built 2026-08-12 after Ken asked for the dashboard artifact to refresh on a
schedule, which turned out to be the wrong tool for the job: the dashboard
is redeployed by Claude from outside the game, but the live IPvGO numbers
only exist locally (pulled by the daemon into `ipvgo_status.json`,
gitignored, never reaches GitHub) — no cloud-scheduled routine can reach
them, and even a local-bridge routine's 1-hour cron minimum doesn't read as
"regular interval" for a game playing several 7x7 games a minute. A panel
reading the same status file in-game has no refresh problem at all — it's
live for as long as it's open.

```
+----------------------------+
|OK                Netburners|   verdict + opponent
|algo             mcts-ucb1-v1|
|win 86%                  n=7|   recentWinRate / recentGamesCount
|record                    6/7|
|streak 5                best 7|
|last              WIN 26-18.5|
|move ms              341/674|
|bonus                    37%|
|vs opp                219-268|   opponent's lifetime record vs. us
|age 12s                     |
|x=1050                   y=850|
+----------------------------+
```

### `get_stats.js`

The wide view: one line per rooted money server and every purchased worker,
with money, security, RAM and what it is currently running. This makes MCP's
cloud-worker activity visible even though purchased servers have no money.
Auto-sizes its tail window to the text using real font metrics from
`ns.ui.getStyles()`, and parks itself beside the sidebar by default.

- **Start:** `run get_stats.js`, or `run get_stats.js <server> [<server>…]`
  to restrict it — `x=`/`y=`/`w=`/`h=` also accepted, mixed in with server
  names in any order. They're filtered out by pattern (`/^[xywh]=[\d.]+$/`)
  before the remaining args are read as hostnames, so a real server named
  e.g. `xylophone` is never mistaken for a stray `x=` — verified before
  shipping, not just assumed safe.
- **Reads:** the live game. This one *does* measure independently.
- Carries the same `x=`/`y=` echo row as `mcp_hud.js`, for the same reason —
  no way to read a window's position back after a manual drag.

### `lsf.js`

`ls` with real glob filters (`*`, `?`), added 2026-08-14 because the
built-in terminal `ls -g/--grep` only does plain substring matching
(confirmed against the game's own source, `Terminal/commands/ls.tsx`:
`parsedPath.includes(filter)`) — `ls *.msg` matches nothing there, since
`*` isn't special to it at all. `lsf.js` translates the pattern to an
anchored regex (`*` → `.*`, `?` → `.`, every other regex-special character
escaped) and filters `ns.ls(host)` client-side.

- **Start:** `run lsf.js <pattern> [host]` — e.g. `run lsf.js *.msg`,
  `run lsf.js *.cct n00dles`. `host` defaults to the server the script runs
  on. `run lsf.js *` lists everything, same as plain `ls`.
- **Output:** with AutoLink.exe, every returned filename is a clickable link
  that connects the terminal to the server holding it; without it, output
  remains plain text.
- **Reads:** the live game (`ns.ls`), nothing on disk.

### `cct_audit.js`

Read-only coding-contract inventory. It breadth-first scans rooted servers,
records each `.cct` file's type, input, description, and remaining attempts
in `cct_inventory.json`, and **never** calls `ns.codingcontract.attempt()`.

- **Start:** `run cct_audit.js` on `home`, or use the remote restart request
  flag `--cct-audit` to run it after MCP relaunch.
- **Output:** `cct_inventory.json`, pulled automatically by the Remote API.
- **Purpose:** establish the actual contract mix and test solver inputs before
  any code is allowed to submit an answer.

### `cct_dry_run.js` and `cct_submit.js`

`cct_dry_run.js` computes answers from the latest audit and never submits.
`cct_submit.js` is the sole live-submit path: it accepts one explicit host and
file, re-reads the type and input, and compares their FNV-1a fingerprint with
the audit snapshot before it can call `ns.codingcontract.attempt()`. It also
requires a minimum remaining-attempt count (10 by default). It never scans,
selects, or batches contracts.

- **Start:** `run cct_dry_run.js`; guarded submission uses
  `run restart_mcp.js --cct-submit=host|file [--cct-min-tries=10]`.
- **Output:** `cct_dry_run.json` and `cct_submit_status.json`, both pulled by
  the Remote API. The latter holds the exact answer, guard inputs, and reward
  or rejection result for the one requested contract.

### `purchase_worker_server.js`

One-shot provisioner for a purchased 2^n-GB worker server. It performs no
manual script copying: MCP discovers the new rooted server and deploys its
workers on the next tick. Writes `purchased_worker_status.json` with the cost
and result; the remote restart path accepts `--buy-worker=<GB>`.

### `mcp_status.js`

Mirrors `mcp.js`'s tail output into its own window, so the orchestrator's
`ns.print` lines stay visible without hunting for its tail.

- **Start:** `run mcp_status.js [host] [lines]` (defaults `home`, 20)
- `tail_mcp.js` is a near-identical earlier version. Prefer `mcp_status.js`.

### `mcp_status_parser.py` / `mcp_status_parser.js`

Local, out-of-game. Pretty-prints `mcp_status.json` including per-host
allocations, once that file has been pulled out of the game.

**As of 2026-08-11, `tools/bb_remote.py`'s `daemon` mode now pulls this file
(and `mcp_status_log.txt`/`mcp_target_state.json`/`mcp_events.txt`)
automatically** — full pull on every game (re)connect plus an incremental
pull every 2s while connected, the same shape as the existing push loop
(`PULL_FILES`/`_pull`/`pull_poll_loop` in the script; `ctl-pull` forces an
immediate pass on demand). **Validated against `selftest`'s mock and a real
subprocess daemon's disconnected-state behavior only — not yet confirmed
against the real game actually writing a fresh `mcp_status.json` while
connected**, since the live daemon on port 12526 predates this code and
wasn't restarted to pick it up (see `CLAUDE.md`/this task's constraints on
not touching a live connection). Until that live confirmation happens,
getting a fresh copy onto disk **also** still works via either of the
older paths:

- the VS Code extension's **Download Files Matching Pattern…**, exactly
  `mcp_*.{json,txt}` (never bulk-download — see `CLAUDE.md` for why that
  overwrites local source and pushes the stale copy back), or
- a CDP read via `mcp_dump_request.txt` (see below) — no download needed.

See `docs/claude-todo.md`'s "game → disk direction" item for the exact
validated/not-validated line.

Largely superseded by reading the game directly over CDP, but it still works
and needs nothing running.

---

## Lifecycle

Bitburner does not hot-reload. A running script keeps executing the version it
started with, so every code change needs a kill and relaunch. These two close
that loop.

### `restart_mcp.js`

Kills `mcp.js` on home, waits for it to actually be gone, relaunches it with
whatever args it was given.

- **Start:** `run restart_mcp.js [target=<hostname>]`

It polls `ns.scriptRunning` against a 10s deadline rather than sleeping a fixed
interval. A killed script can still finish its in-flight tick, including
writing `mcp_status.json` and `mcp_target_state.json` — starting the
replacement on a timer races those writes, and the new instance can load target
state the old one is about to overwrite.

### `mcp_supervisor.js`

Watches two files for requests from outside the game. Both use token
comparison rather than deleting a flag, to keep RAM down: `ns.read` costs
0GB and returns `""` for a missing file, so neither needs `ns.fileExists`
(0.1GB) or `ns.rm` (1GB). Both seed from whatever is already on disk at
startup, so restarting the supervisor doesn't immediately re-trigger on a
stale token.

- **Start:** `run mcp_supervisor.js` — **this one still needs a human, once**
  (and again after any update to this script — Bitburner doesn't hot-reload,
  and the supervisor can't remote-restart itself; it self-supersedes on
  re-run so a second `run` cleanly replaces the first rather than stacking)
- **Cost:** 3.3GB — 1.6GB baseline + `ns.run` (1.0GB) + `ns.ps` (0.2GB) +
  `ns.kill` (0.5GB, for self-supersede). Every `ns.ui.*` call the dump
  feature uses is 0GB (checked against the game's own cost table, not
  assumed), so rendering itself added nothing to that figure.

**`mcp_restart.txt`** — runs `restart_mcp.js` when its contents change. First
line is a token, any further lines are passed to `mcp.js` as arguments (so
`target=n00dles` can be requested remotely).

**`mcp_dump_request.txt`** — renders a file's full contents into a tail
window titled `mcp_dump`, readable over CDP without a download. This exists
because the CDP connection can only read what's already rendered on
screen — the HUD deliberately shows a curated ~10-line summary, not full file
contents, and nothing outside the game can call `ns.read()` directly, since
that only works from inside a running script. Every deep-log finding this
session (the bucket-hysteresis thrashing, the invalid-extension write
failure) needed the actual file, which until this existed meant a manual
download every time.

- **Protocol:** line 1 a token/nonce (forces change-detection even when
  re-requesting the same file), line 2 the filename, optional line 3 a line
  count for non-JSON files
- `.json` files are pretty-printed whole (with a raw fallback if the content
  doesn't parse); everything else is tailed to the last N lines — default
  150, hard-capped at 500 regardless of what's requested, since
  `mcp_status_log.txt` has no size limit of its own and a request shouldn't
  be able to try rendering an unbounded file into the browser tab
- **Resolved, the hard way:** Bitburner's tail window only keeps in the DOM
  whatever fits its actual configured height — it is not a scrollable div
  with everything present underneath. A 100-line request originally rendered
  only ~45 lines over CDP (always the tail end); a 45-line request rendered
  completely. The window's height was being capped at 700px for assumed
  visual tidiness, silently dropping content CDP could read even though
  `ns.print` genuinely wrote all of it. Fixed by sizing the window tall
  enough to fit whatever was requested, uncapped, since nothing about this
  feature is optimizing for how the window looks.
- **Open, milder variant of the same bug (2026-08-09):** dumping
  `mcp_status.json` over CDP showed only the tail (`recentEvents`, the last
  field in the object) — the `config` block, inserted well before it, never
  appeared, even though the doc above says `.json` renders whole. The window
  resize itself isn't capped anymore, so this is likely the *screen's*
  height clipping DOM content the window is sized taller than, not a
  reintroduction of the 700px cap — unconfirmed. Didn't block anything this
  time (OBJECTIVE's new value was independently confirmed via the terminal's
  `config updated` log line and the HUD's `plan` row), so not chased further
  yet. Worth a real fix if a future dump genuinely needs a large JSON file's
  earlier fields and nothing else confirms them.

### `startup.js`

Brings up the whole suite from a clean slate in **one** command:
`run startup.js`. Closes every open tail window, kills everything else on
the host, then launches `mcp_supervisor.js`, `hacking/crawler.js`, `mcp.js`,
`mcp_hud.js`, `get_stats.js` in that order via `ns.run`, then exits rather
than staying resident, so its own footprint doesn't compete with what it
just started.

- **Start:** `run startup.js` — the one command besides the supervisor's own
  bootstrap that still needs a human hand
- **Cost:** 4.3GB while running (momentary) — 1.6GB baseline + `ns.ps`
  (0.2GB) + `ns.killall` (0.5GB) + `ns.scriptRunning` (1.0GB) + `ns.run`
  (1.0GB)
- **Closes tail windows *before* killing, not after — order was a real bug.**
  `ns.kill`/`ns.killall` never close a script's tail window; it's orphaned,
  frozen on whatever it last rendered. `closeTail` needs a live PID from
  `ns.ps` to target, and `killall` erases that PID the instant it runs. Two
  actual `startup.js` runs each left a fresh ghost behind for `mcp_hud.js`
  and `get_stats.js` despite both scripts' own self-supersede logic already
  calling `closeTail` — their check runs from the *new* instance scanning
  `ns.ps` for a prior copy, and by the time it ran, `startup.js`'s own
  `killall` (which used to run first) had already erased that evidence. Now
  closes every window it can see, then kills.
- **Calls `ns.killall(host)`** — every other script on the host, including
  anything unrelated to the mcp suite, since "clean and fresh" was the
  explicit ask. Safe against killing itself: `safetyGuard` defaults to
  `true`, documented as "skips the script that calls this function" and
  confirmed against the actual implementation in the game's bundle (it
  compares the target PID to the caller's and excludes a match), not just
  the doc text.
- Still checks `ns.scriptRunning` before each launch even though `killall`
  already cleared the host — cheap, and belt-and-suspenders against an edge
  case rather than the primary duplicate-prevention it was before `killall`
  got folded in. Checked *without* passing arguments, since the function
  matches "any script with this filename" regardless of what it was started
  with (confirmed against the game's own doc text); a live
  `mcp.js target=n00dles` still correctly reads as running.
- `mcp_supervisor.js` launches first deliberately: once it's up, restarts and
  file dumps are remote-triggerable, so everything after it in the list is in
  principle also recoverable without repeating this script.
- Reports per-script outcome (`started (pid N)` / `already running,
  skipping` / `FAILED — not enough RAM?`) plus a one-line summary count, so a
  partial failure from insufficient home RAM is visible rather than silent.

---

## Outside the game

### The CDP watcher

Not in this repo — it lives in the session scratchpad, because it is
session-scoped by nature.

Bitburner runs under Electron. Launched with `--remote-debugging-port=9222`,
its page is reachable over the Chrome DevTools Protocol, which means the DOM —
including the Overview panel and every open tail window — can be read from
outside. `appSaveFns` is also exposed on the page.

A small Node poller reads that every 60s and prints a line **only when the
health state changes**: a non-`OK` HUD verdict, no money and no XP gain for ten
minutes, or the game becoming unreachable. Attached to a monitor, each printed
line wakes Claude mid-session without anyone typing.

This is why the HUD's verdict word is the first thing on the first line: it is
the machine-readable handle. Anything that lands there becomes something that
can raise an alarm.

**Limits worth stating plainly.** It dies when the session ends — it is not a
daemon. Each event costs a turn, which is why the filter watches transitions
rather than ticks. And it observes; it does not act.

### The status dashboard

`docs/status-dashboard.html` (git-tracked source) is a published Artifact —
the standing "needs your call / in progress / done this session" page built
2026-08-09 after Ken flagged chat as too noisy to actually use. Claude
**redeploys it in place** whenever there's something new for Ken to see or
decide; it is not appended to over chat, and chat goes back to short pings
("dashboard has one thing for you") once it exists.

**Rows are removed only when Ken says he's reviewed them, not on Claude's
own schedule.** Found 2026-08-11: Claude had been auto-pruning "resolved"
rows on its own judgment of what's no longer decision-relevant; Ken wants
that decision to be his. Practical rule: a resolved/flagged/in-progress row
stays on the page until he names it (or says "clear resolved", "clear the
board", etc.) in chat, at which point the next redeploy drops it. Don't
silently age anything out.

**Two separate publishing surfaces exist, and they do not share state —
found the hard way 2026-08-11.** The original was published via claude.ai's
classic Artifact tool at
<https://claude.ai/code/artifact/a48a824c-7762-4b20-9e22-9f1827002e90>, last
redeployed 2026-08-10 13:40 from a session on that surface. **A session
running in Cowork mode cannot reach or update that URL at all** — Cowork has
its own separate artifact system (`mcp__cowork__create_artifact` /
`update_artifact`), which persists to the Cowork sidebar under its own ID,
not a public URL. Editing `docs/status-dashboard.html` alone updates neither
surface by itself; publishing requires calling that surface's own tool.
Ken spent a whole exchange looking at the stale claude.ai-hosted copy while
this session had already rebuilt the file, because nothing had redeployed
to the surface he was actually checking.

**Current state:** a Cowork artifact was created 2026-08-11, id
`bitburner-status-dashboard`, visible in the Cowork sidebar for this
workspace — no external URL. **Whichever surface a session is running on
(Cowork vs. claude.ai chat) is the one it must redeploy to** — check which
one Ken is actually looking at before assuming a file edit was enough.
If future sessions run outside Cowork again, the original claude.ai URL
above may still be the one in front of Ken; don't assume the Cowork
artifact replaced it for him, ask if unsure which he's checking.

### `docs/claude-todo.md`

Claude's own granular, session-spanning working list — distinct from
`docs/kensTodo.md` (Ken's-hand-only actions) and this file (what the code
does). Read first at the start of every session, updated as work happens.
Not part of the script map above; noted here only so it doesn't get missed
alongside the other two standing docs.

### `tools/bb_remote.py` — direct Remote API client (prototype, not yet cut over)

Built 2026-08-09 to replace the VS Code extension's file-sync as the write
path into the game, after two same-day incidents where writes to
`mcp_dump_request.txt`/`mcp_restart.txt` never reached it (dropped sync
session, no replay on reconnect — see the `CLAUDE.md` note this traces to).
Full protocol writeup, citations, and validation status:
`docs/remote-api-migration.md`. Short version: the game dials **out** as a
WebSocket client to an external server (Options → Remote API → hostname
`localhost`, port `12525`, Connect); `tools/bb_remote.py` is a second
implementation of that server, alongside the extension's own. Protocol
self-tests pass against a spec-accurate mock; **not yet round-tripped
against the live game** — that needs one supervised, reversible action from
Ken (see the doc). Not wired into `mcp_supervisor.js` or anything
live-running yet; this is groundwork, not the cutover.

**2026-08-10: found and fixed a confirmed connect-then-drop bug, added
logging.** A first live attempt (port 12526) connected then dropped within
seconds with no clue why — `RemoteApiServer`'s connection lifecycle logged
*nothing* on connect/disconnect. Fixed: every connect, disconnect (with
close code/reason/duration), refused second connection, and sent/received/
dropped message now logs to stdout and appends to
`tools/bb_remote_events.log` (gitignored; `--log-file` to override, empty
string to disable). Full trail: `docs/remote-api-diagnosis-log.md`.

While adding that logging, reproduced the actual bug live: `cmd_serve`
read commands from `sys.stdin.readline()`, and on a non-interactive stdin
(no controlling TTY — exactly how a tool-driven launch invokes it),
`readline()` returns `''` immediately, which the old code treated as
`quit` and tore the just-accepted connection down within about a second —
confirmed with a real client against the pre-fix commit (`ping` failed at
t+1.02s with a clean `1000` close). Fixed: `serve` now only reads
interactive commands when stdin is a real TTY; otherwise it holds the
connection open and logs heartbeats instead. Also added a `watch`
subcommand (`python3 tools/bb_remote.py watch --port 12526 --duration
180`) — binds and logs every connect/disconnect for a bounded duration,
no stdin interaction at all, built specifically for an unattended/
tool-driven live test.

**2026-08-10, later: full round trip confirmed against the live game.** A
detached `watch`-style listener caught a real connection (`bitburner/3.0.1`
user agent, not a mock) and a combined script ran `pushFile` → `getFile` →
compare → `getFileNames` in one continuous session: the pushed content
came back byte-identical (`ROUND TRIP MATCH`) and the pushed filename
showed up in `getFileNames`'s listing. This is the bar this doc previously
called "not yet round-tripped" — it's now met, with no VS Code extension
involved at any point. Full trail: `docs/remote-api-diagnosis-log.md`.

One thing to check before building further on this connection: the
`getFileNames` response in that same round trip included entries like
`.venv/lib/python3.9/site-packages/.../entry_points.txt` and
`.claude/settings...` alongside real game scripts — the game's view of
`home`'s filesystem appears to include more of the local repo tree than
intended. Not investigated yet, just flagged.

#### The trigger-file replacement (built 2026-08-10, same session)

`mcp_restart.txt`/`mcp_dump_request.txt` were the only remote-trigger
channel into the game, and both had already failed once each on
2026-08-09 when the extension's sync silently dropped. `tools/bb_remote.py`
now has two layers that replace that dependency for these two specific
actions:

**One-shot commands** (`restart`, `dump`) — same connect/act/disconnect
pattern as `push`/`get`:

- `python3 tools/bb_remote.py restart [--target <hostname>]` — pushes a
  fresh `mcp_restart.txt` (millisecond-timestamp token, optional
  `target=<hostname>` line) via `pushFile`, then reads it back via
  `getFile` to confirm the write actually landed — synchronous and
  confirmable, unlike a local disk write that just hopes the extension
  eventually syncs it. `mcp_supervisor.js`'s poll loop is **unchanged**:
  it still just watches `mcp_restart.txt` for a content change and runs
  `restart_mcp.js`. Only the delivery path changed.
- `python3 tools/bb_remote.py dump <filename> [--lines N]` — fetches a
  file's content directly via `getFile` and prints it (pretty JSON, or
  raw/tailed text). This **bypasses `mcp_dump_request.txt`, the tail-window
  render, and CDP entirely** — that whole path existed only because CDP
  can't call `ns.read()` directly, and this doesn't go through CDP at all.
  `mcp_supervisor.js`'s dump-request handling is left in place as a
  fallback, not removed.

**Daemon + local control channel** (`daemon`, `ctl-status`, `ctl-restart`,
`ctl-dump`) — the recommended path for routine use, added after a design
review flagged that the one-shot commands above re-do the game handshake
on every single call, which is exactly the fragile step this migration
exists to get away from (both prior failures — the extension's dropped
sync, and `tools/bb_remote.py`'s own now-fixed connect-then-drop bug —
were connection-*stability* problems, not request-shape problems). A
one-shot process also exits immediately after, taking any diagnostic
evidence with it.

- `python3 tools/bb_remote.py daemon [--port 12526] [--control-port
  12527]` — a **persistent** process, started once (e.g. `nohup ... &
  disown`, confirmed via `ps -o ppid` reparenting to `launchd`/PID 1 so it
  survives past the session that started it), that holds the game-facing
  `RemoteApiServer` open for its entire lifetime and also serves a
  loopback-only local control socket. Every connect/disconnect still logs
  to `tools/bb_remote_events.log` for the whole time it runs, so a drop is
  visible in one continuous log instead of a fresh unknown per call.
- `python3 tools/bb_remote.py ctl-status|ctl-restart|ctl-dump
  [--control-port 12527]` — cheap local calls (one JSON line in, one JSON
  line out, over `127.0.0.1:<control-port>`) that ask the already-running
  daemon to act, using its already-open game connection. No game handshake
  on this path at all; if the daemon isn't running, these fail fast with a
  clear "could not reach daemon control port" error instead of a 60s
  timeout.

The daemon **cannot** force the game to reconnect after a drop — the
diagnosis log already established the game does not auto-reconnect
regardless of the "Reconnection delay" field, so a fresh drop still needs
one human Connect click regardless of transport. What it removes is the
need to **restart a process** on Claude's side for that reconnect to be
picked up: the daemon just keeps listening.

#### Routine script sync (added 2026-08-10 — the actual VS Code cutover)

Everything above only replaced the restart trigger and file dumps — routine
edits to `mcp.js`/`hacking/*`/`scripts/*`/etc. still reached the game
**only** via the VS Code extension's own file-sync watcher, confirmed by
directly re-reading `tools/bb_remote.py`'s code and its own docstring
("NOT meant to replace the VS Code extension's role for ongoing *source*
file sync ... that stays on the extension/port 12525 for now"). Ken
reconnecting the extension on port 12525 this same session dropped the
daemon's game-side connection on 12526 outright (`close_code=1005`, exact
timestamp match) — confirming directly, not just by protocol reading, that
**the game holds exactly one outbound Remote API connection regardless of
which port is configured**, so the two-port design (12525 for the
extension, 12526 for the daemon) was never actually coexisting; whichever
one the game's Options panel points at wins, full stop.

Fix: `daemon` now also pushes `WATCHED_FILES` — every file that actually
loads into the game (28 as of this writing: `mcp.js`, `mcp_logic.js`,
`mcp_config.json`, everything under `hacking/` and `scripts/`, the
`dnet_*.js` set, `mcp_hud.js`/`mcp_money.js`/`mcp_stocks.js`/
`mcp_status.js`/`mcp_supervisor.js`, `get_stats.js`, `restart_mcp.js`,
`startup.js`, `tail_mcp.js`, `econ_probe.js`, `purchaseServer-8GB.js` —
deliberately excludes generated game-output files, `mcp_logic.test.js`,
the two `mcp_status_parser.*` local tools, and editor-only files like the
`.d.ts`s):

- **Full resync on every game (re)connection** — `RemoteApiServer` gained
  an `on_connect` hook; `TriggerDaemon` registers one that pushes every
  watched file's current on-disk content, unconditionally, the instant the
  game connects (first connect or any reconnect after a drop). This is the
  actual fix for the flaw this whole migration exists to get away from —
  a drop can no longer leave the game silently running stale code, because
  reconnecting always re-pushes everything rather than only resuming
  incremental watching from that point forward.
- **Incremental push every 2s while connected** (`SYNC_POLL_S`, matches
  `mcp_supervisor.js`'s own poll interval) — only files whose content
  differs from what was last successfully pushed, so an idle daemon
  doesn't spam `pushFile`.
- New CLI: `ctl-push <remote> <local>` / `ctl-get <remote>` (the daemon's
  generic push/get control-channel handlers, already present, now exposed
  as commands — for a one-off file outside `WATCHED_FILES`) and
  `ctl-resync` (force an immediate full pass on demand — the same logic
  the connect hook runs automatically). `daemon --no-sync` disables all of
  this and falls back to exactly the restart/dump-only behavior from
  before this feature, for isolating a regression.

**Port decision: daemon stays on 12526; Options gets pointed there once and
left there — it does not take over 12525.** The alternative (daemon binds
12525, the extension's own long-standing port, so Options never needs to
change at all) was considered and rejected: port 12525 is held by the VS
Code extension's own background listener the whole time VS Code is open
with the extension active (confirmed via `lsof` — a `Code Helper` process
holds it), so taking that port over would require Ken to quit or disable
the extension first — a real manual step, and a less familiar one than a
field he's already changed several times today. Pointing Options at 12526
is exactly as durable: the game's Remote API host/port setting persists
across sessions, so this is genuinely one click, not a recurring one — the
same way it would be for 12525. The daemon can't be dropped back onto by
an unrelated "reconnect the extension" action either, since after this
change there is no reason to ever touch the extension again. See
`docs/kensTodo.md` for the exact click.

**Live status as of 2026-08-10, end of this session:** validated at three
levels short of a live-game round trip — (1) `selftest` (`python3
tools/bb_remote.py selftest`) now covers the new sync logic directly:
full resync pushes all present watched files under their leading-slash
remote name, correctly reports a missing file without raising, incremental
resync is a no-op when nothing changed and pushes only the one file that
did change, all passing against an in-process mock game client; (2) a real
`daemon` subprocess (scratch ports, not the live 12526) answered
`ctl-status`/`ctl-resync`/`ctl-push` correctly while disconnected —
`ctl-status` reported `sync_enabled: true`/`watched_files: 28`, a
disconnected `ctl-resync` reported all 28 as failed-not-crashed (each
`pushFile` correctly raised "Not connected to Bitburner" and was caught
per-file), `ctl-push` failed cleanly the same way; (3) that same run
confirmed **all 28 `WATCHED_FILES` paths resolve against the real repo
tree with zero "missing"** — the list is accurate as of this commit. A
fresh daemon (replacing the earlier restart/dump-only one, same port
12526) is running now, `nohup`'d and reparented to launchd (confirmed via
`ps -o ppid`), waiting for a connection. **Not yet confirmed against the
live game** — no live `pushFile`/`getFile` round trip has run against this
session's code; that needs the Connect click in `docs/kensTodo.md`.

#### Game -> disk pull (built 2026-08-11, closes the other half of the gap)

The routine sync above is disk → game only. `mcp_status.json`,
`mcp_status_log.txt`, `mcp_target_state.json`, and `mcp_events.txt`
(`PULL_FILES` in the script — deliberately the same four files
`WATCHED_FILES`'s own comment excludes, for the opposite reason: they flow
game-to-disk) previously had no automated way back onto local disk —
`get`/`dump`/`ctl-get`/`ctl-dump` already called the live `getFile` RPC the
push round trip proved works, but every one of them only printed or
returned the result, never wrote it anywhere. Fixed by mirroring the push
side's own design exactly, just in the opposite direction:

- **Full pull on every game (re)connection** — the same `on_connect` hook
  that runs a full push resync now also fetches every `PULL_FILES` entry
  via `getFile` and writes it to its matching local path, unconditionally.
  A `getFile` on a file the game hasn't created yet raises the same way a
  deleted file does; caught per-file and reported as `missing`, never
  raised — the exact "skipped-and-reported, not raising" contract the
  push side already has for a file missing on local disk.
- **Incremental pull every 2s (`PULL_POLL_S`) while connected** — only
  files whose fetched content differs from what was last written locally
  get rewritten.
- New CLI: `ctl-pull` forces an immediate full pull pass on demand (the
  pull-side analog of `ctl-resync`). `daemon --no-pull` disables this half
  independently of `--no-sync` — push and pull can be toggled separately.

**Validated so far:** `selftest` extended with direct coverage (full pull
writes correct content to the right local path; a missing remote file is
skipped-and-reported without raising; incremental pull no-ops when the
game side hasn't changed the content; incremental pull picks up and writes
only the one file that did change) — all pass against the in-process mock.
A real `daemon` subprocess (scratch ports 31526/31527, not the live
12526/12527) answered `ctl-status`/`ctl-pull` correctly while disconnected:
`ctl-status` reported `pull_enabled: true`/`pull_files: 4`, and a
disconnected `ctl-pull` reported all four files as `missing` (each
`getFile` correctly raised "Not connected to Bitburner", caught per-file,
no crash) — the pull-side equivalent of the push-side disconnected check
above.

**Not yet validated against the live game** — no live `getFile` call
writing a real `mcp_status.json` (etc.) to disk has run against this code
yet. The daemon that's actually connected to the game right now on port
12526 was started before this pull code existed, so it doesn't have it;
this needs that process restarted with the current code and then the next
natural reconnect (or a fresh Connect click), not a new action from Ken
specifically — see `docs/claude-todo.md` for the exact status and what
still needs watching.

**2026-08-11: found and fixed a silent, hours-long sync outage caused by
this repo's own move.** Moving `~/Documents/BitBurner` → `/Users/Shared/BitBurner`
this session (see `docs/kensTodo.md`) did not disrupt the live WebSocket
connection — the OS keeps a running process's cwd valid across a rename,
confirmed via `lsof -a -p <pid> -d cwd` before and after. What it did break:
`REPO_ROOT = Path(__file__).resolve().parent.parent`, computed **once at
import time** and stored as a frozen absolute path. That value still
pointed at the old, now-nonexistent location, so every watched-file read
(`_read_watched`) started raising `FileNotFoundError` — caught, and logged
once per file via `_missing_warned`'s rate limiting, to a gitignored log
file nobody was tailing. Auto-sync (both directions) was fully broken for
roughly two hours before this was noticed, purely by accident, while
pushing an unrelated `mcp_config.json` change via `ctl-push` (which bypasses
the daemon's cached root entirely, since it's a fresh CLI subprocess with
its own correct cwd — that's the only reason anything got through during
the outage).

**Root-cause fix:** `TriggerDaemon._resolve_repo_root()` now resolves
`Path.cwd()` **fresh on every single read/write**, never cached, when no
explicit `repo_root` override is given (production always uses this path;
tests still pin an explicit fixture directory). `Path.cwd()` reflects a live
rename immediately, confirmed by the new selftest below, so a daemon that's
already running survives its own directory being moved without needing a
restart at all — only new code changes (like this one) still need one.

**Defense in depth, mirroring `docs/audit-2026-08-07-process.md`'s "assert on
the code's own intentions, not on game state" principle** — applied here to
the Python/tooling side for the first time, not just `mcp.js`: `_resync` and
`_pull` now each track a loud alarm (`sync_root_alarm`/`pull_root_alarm`)
that fires specifically when **every single** watched/pull file fails at
once — a qualitatively different signal than one file legitimately missing,
and exactly what a bad `repo_root` looks like. Surfaced in `ctl-status`'s
JSON response, not just a log line, so it's checkable without tailing
anything. This wouldn't have prevented today's incident by itself (the
already-running process still needed the code fix), but it means the *next*
class of "everything silently stopped working" gets noticed in one
`ctl-status` call instead of by accident.

**New selftest coverage** (8 checks, all passing): constructs a real temp
directory, resyncs successfully, `os.rename`s it out from under the
still-running test process (faithfully reproducing the actual incident
in-process, not just in theory), and asserts a dynamic-root daemon survives
untouched while a daemon pinned to the old path reproduces the original bug
and trips the alarm; a separate check covers the pull-side write-failure
alarm the same way. Run with `python3 tools/bb_remote.py selftest`.

**2026-08-11 (later): an oversized pull file was killing the whole
connection, not just failing one `getFile` call.** Found while trying to
push the `ipvgo_player.js` fix described in this file's IPvGO section:
`mcp_status_log.txt` (a `PULL_FILES` entry, gitignored, and this doc's own
"Generated files" section already warned it "must not grow without bound")
crossed 1MB, `websockets.serve`'s default `max_size`. Every reconnect after
that logged `SYNC: full resync done` (sometimes completing all 29 files,
sometimes not, depending on how the concurrent push-resync and pull-full-pass
tasks happened to interleave on the same socket) immediately followed by
`ConnectionClosedError: sent 1009 (message too big)... exceeds limit of
1048576 bytes` the instant the pull loop reached that one file — tearing
down the *entire* connection, not just failing that `getFile`, then looping:
reconnect → partial push → die on pull → reconnect again, forever. This is
the same class of failure `docs/claude-todo.md`'s repo-move incident above
was, just in the opposite place — one bad input killing a shared resource
instead of degrading gracefully.

**Fixed in code:** `RemoteApiServer.start()` now passes a `WS_MAX_SIZE`
(20MB, arbitrary headroom) to `websockets.serve`, so one large file no
longer takes the whole socket down. **Not yet live** — Python doesn't
hot-reload any more than Bitburner does, and the already-running daemon
process (started before this fix existed) needs a restart to pick it up.
That restart could not happen the session this was found in (the sandbox's
own auto-mode classifier blocks process-kill commands) — see
`docs/claude-todo.md`'s matching entry for the exact unblock steps once a
session/person with permission to kill the process is available. The
underlying growth problem (`mcp_status_log.txt` itself growing past 1MB) is
still unaddressed and will recur — this fix only stops one oversized file
from taking the daemon down with it, it doesn't cap the file's growth.

---

## Darknet (`ns.dnet`)

A self-contained set, separate from everything above. It does not touch
`mcp.js` and is **not** auto-started by `startup.js` or `mcp_supervisor.js` —
deliberately, until it has worked by hand at least once.

### Quiet operational review

Routine state belongs in status files, not in the terminal or a script tail.
`mcp.js` therefore writes its full state to `mcp_status.json` and only appends
a readable line when its target/plan changes; it no longer prints one status
line every tick. The normal transient Darknet path runs `dnet_crawl.js
--quiet`, its manager records retry errors in its status record, and the
legacy scorecard refreshes at 30 seconds rather than two.

`automation_review.js` is the home-side consumer. It polls every 30 seconds,
reads only MCP status, the Darknet root heartbeat, compact manager registry,
and at most the active manager-heartbeat shards, and writes `automation_review.json` plus a bounded
`automation_review.txt` transition log. It does not start/stop automation or
scan Darknet shards. It raises a toast only for a new/changed actionable
condition: stale MCP/root, an MCP invariant violation, or more than the
configured two Darknet managers. Both files are Remote-API pull telemetry, so
an external reviewer can inspect them without tailing the game.
`restart_mcp.js` starts it when absent, before relaunching MCP.

**Confirmed live 2026-08-12.** `dnet_probe.js` and a fresh `dnet_deploy.js
--once` run from `home` both ran for real: `probe()` from home returned
exactly `["darkweb"]` as predicted, and the deployer went on to crack 12+
servers across all four solved password models with zero failures, spreading
autonomously across the shallow net (see `docs/darknet-functions.md`'s
2026-08-12 notes for the full reconciliation of why the scripting API sees
far fewer servers than the in-game "Dark Net" UI tab at any given moment —
short version: `probe()` is deliberately adjacency-only, the UI reads the
game's full internal state directly, and there is no `ns.dnet` call that
does what the UI does). Design reasoning lives in `docs/darknet-functions.md`
(API reference, model solvers, RAM costs), `docs/darknet-tactics.md`
(per-decision reasoning) and `docs/darknet-strategy.md` (sequencing).

| File | Runs on | RAM (est.) | What it does |
| --- | --- | --- | --- |
| `dnet_probe.js` | `home` | ~2.3GB | First contact. Probes, reports each neighbour's details, attempts `authenticate("darkweb","")`. Mutates almost nothing. |
| `dnet_lib.js` | — | 0GB alone | Shared module. Model-aware password candidates, credential store, session acquisition, filename-safe credential/deployer/loot-event shards, targeted `freeBlockedRam`, cumulative loot-event aggregation, and `dnet_status.json` merge helpers. Not runnable. |
| `dnet_root.js` | `home` | home-only; exact RAM not yet surfaced | Stable gateway for the transient architecture. Its unique filename cannot be overwritten by surviving legacy crawlers. It authenticates `darkweb`, kills any reappearing `dnet_deploy.js` process there, prepares the gateway, and launches `dnet_crawl.js` only when neither a visible process nor a fresh manager-registry heartbeat owns it. Credential shards are folded at most once per minute and manager shards at most once per 15 seconds, rather than being fully reread at every gateway poll. |
| `dnet_deploy.js` | legacy compatibility only | 15GB, measured live | Former roaming controller. Retained for history/fallback but no longer launched by the restart path. Surviving old in-memory copies can temporarily repopulate nodes, so `dnet_root.js` actively quarantines this filename at the gateway. |
| `dnet_crawl.js` | transient on darknet nodes | 6.7GB measured live | Lean one-pass crawler: authenticate with an inline shallow-net solver (avoiding the all-purpose library's 10GB static-analysis charge), persist new credentials, reclaim a blocked direct neighbour using the source-side API, propagate itself, write a heartbeat, start the local manager, and exit. This keeps discovery and authentication costs out of the permanent farm. Each heartbeat records measured crawler/manager/phisher RAM, resulting phishing-thread capacity, and at most five compact failure reasons—enough to diagnose an access block without per-attempt console output. |
| `dnet_manager.js` | resident on darknet nodes | 3.15GB measured live | Local lifecycle manager. After the transient crawler releases RAM, it runs one `dnet_phish.js` worker. Its 90-second recrawl uses `--no-spread`, so it refreshes local access without becoming a propagation source. The current controlled-expansion restart permits at most two managers total and exactly one terminal child from the root's initial crawl. |
| `dnet_realloc.js` | the crawler adjacent to a blocked neighbour | ~2.6GB/thread | Temporary remote preparation worker. Accepts the authenticated neighbour as argv[0], uses a deliberately inline minimal reallocation loop, and exits. Running on the source side can unlock a deep host even when 100% of the target's RAM is blocked. `memoryReallocation` scales with threads, so the controller uses every source-side thread that fits. Safe to lose and retry after a mutation. It ships no telemetry—the controller observes `blockedRam` between passes. |
| `dnet_phish.js` | a prepared darknet server | ~3.6GB/thread | Lean `phishingAttack()` loop. It deliberately emits no per-attempt script-log lines: a successful call can complete every 200ms, so per-call output was a renderer-pressure source. On a cache-producing success it writes a zero-RAM marker and exits; the controller launches loot to open the cache, then restores phishing on a later pass. |
| `dnet_loot.js` | a darknet server | ~5.55GB | Frees blocked RAM (normally already reclaimed remotely by the new crawler path), opens `.cache` files, and reports karma spent. Meaningful results are immutable timestamped event shards (`dnet_loot_<escaped-host>_<timestamp>.json`); normal and no-op runs emit no terminal or script-log output, while cache/shipping errors remain visible. Launched once per neighbour/process lifetime by `dnet_deploy.js`. |
| `dnet_loot_realloc.js` | a darknet server | ~3.35GB | RAM-only legacy fallback when the full loot worker does not fit. Still supported, but remote-before-spread reallocation in `dnet_deploy.js` is now the primary path because it does not require enough target RAM to launch first. Meaningful results use the same immutable event-shard ledger. |
| `dnet_loot_all.js` | `home` | ~3.0GB | Manual/one-off: loots every host in `dnet_creds.txt`, one at a time, via `connectToSession`. **Superseded as the primary loot path 2026-08-12** — tried live against 103 known hosts, 0 looted (48 offline by the time it circled back, 7 "RAM too small" via a check that reads a field that doesn't exist on `DarknetServerDetails` and always evaluates to 0 — see `docs/darknet-functions.md`, not fixed here, kept only for manual/one-off use). Kept as a tool, not removed. |
| `dnet_loot_merge.js` | `home` | ~1.8GB | Recomputes cumulative, idempotent totals from every immutable `dnet_loot_*_<timestamp>.json` event shard and writes `dnet_status.json`'s `"loot"` section. `--prune` is retained for CLI compatibility but intentionally ignored: the event shards are the durable ledger. |
| `dnet_creds_merge.js` | `home` | ~2.0GB | Folds per-host credential shards into `dnet_creds.txt`. Also writes the "credsMerge" section of `dnet_status.json` — total cracked count and a per-model breakdown off the merged file, the one genuinely network-wide number in that file (stale until re-run after new cracks land, but not a guess). |
| `dnet_status_merge.js` | `home` | ~2.0GB | **New 2026-08-12**, the fix's other half. Folds `dnet_deployer_<host>.json` shards into `dnet_status.json`'s `"deployer"` section — picks the single *freshest* shard by `ts` (not a network-wide sum; see the file's own doc comment for why) and writes it plus `assembledAt`/`shardsSeen`/`sourceShard` bookkeeping. Must be run (and re-run periodically) for the dashboard's `deployer` section to show anything, same manual-refresh cadence Ken already uses for the other two merge scripts. |

### Arguments

- `dnet_deploy.js` — `--once` (single pass, no loop), `--brute N` (allow up to
  N numeric candidates per host; default 0 = off), `--quiet`.
- `dnet_realloc.js` — `--max-realloc N` (default 25).
- `dnet_crawl.js` — `--brute N`, `--quiet`, `--no-spread` (perform local
  discovery/manager handoff without creating children; used for all manager
  recrawls and terminal expansion children).
- `dnet_phish.js` — `--until <epoch-ms>` (manager-owned clean recrawl deadline).
- `dnet_killswarm.js` — `--quiet`, `--restart` (launch a fresh crawler after
  cleanup; remotely reachable through `restart_mcp.js --darknet`). The
  restart wrapper waits up to 120 seconds for cleanup to exit, launches the
  root itself, and only then relaunches MCP. This avoids both MCP and the
  cleanup process consuming home RAM during the root launch.
  Cleanup
  authenticates only hosts with a heartbeat from the last ten minutes, then
  runs remote `ps`/`kill`; this is both effective and bounded, unlike either
  unauthenticated cleanup (live failure) or visiting all 586 historical hosts.
  `dnet_killswarm_status.json` records `started`/`complete`, targets, inspected,
  unavailable, and killed counts. The remote restart path launches cleanup
  after stopping MCP but before restarting it, guaranteeing launch RAM.
- `dnet_loot.js` — `--no-cache`, `--no-ram`, `--max-realloc N` (default 25).
- `dnet_loot_all.js` — `--limit N` (stop after N hosts, default: all),
  `--wait-ms N` (per-host completion timeout, default 15000).
- `dnet_loot_merge.js` — `--prune` (accepted but ignored; event shards are the cumulative ledger), `--quiet`.
- `dnet_creds_merge.js` — `--prune` (delete shards after merging), `--quiet`.
- `dnet_status_merge.js` — `--prune` (delete shards after merging), `--quiet`.

### Files

| File | Written by | Notes |
| --- | --- | --- |
| `dnet_creds.txt` | `dnet_deploy.js`, `dnet_creds_merge.js` | JSON-lines, one record per line: `{host, password, model, at}`. `.txt` not `.jsonl` — `ns.write` rejects `.jsonl`. Carried along on every `scp` so a child agent inherits what its parent knew. |
| `dnet_cred_<host>.txt` | `dnet_deploy.js` | Per-host shard, scp'd to `home`. Sharded so concurrent agents can't clobber one shared file. Hostnames are escaped (`meta:inc` → `metax3ainc`) because darknet hostnames contain `:`, `%`, `@` and emoji. |
| `dnet_loot_<escaped-host>_<timestamp>.json` | `dnet_loot.js`, `dnet_loot_realloc.js` | Immutable event shard, scp'd to `home`, written only when RAM was actually reclaimed or a cache was found/opened. Timestamp remains outside the escaped/truncated hostname so events cannot collapse onto one filename. `{host, model, difficulty, mode, ram?, caches?, at}`. `dnet_loot_merge.js` recomputes cumulative totals from this ledger idempotently. |
| `dnet_deployer_<host>.json` | `dnet_deploy.js` | **New 2026-08-12.** Per-host shard, scp'd to `home`, via `dnet_lib.js`'s `writeDeployerShard`/`shipShard`. Fixes a real bug: `dnet_deploy.js` used to `scp` the *whole* `dnet_status.json` to home every pass, and since every roaming instance's own local copy only ever has a `deployer` key, whichever instance's `scp` landed last silently erased the `credsMerge`/`loot` sections other scripts had written there. Sharded the same way credentials/loot already are, so concurrent `scp`s can never collide. `dnet_status_merge.js` folds these into `dnet_status.json`. |
| `dnet_status.json` | `dnet_status_merge.js` (`deployer` section, folded from `dnet_deployer_<host>.json` shards — **no longer written directly by `dnet_deploy.js`**, see above), `dnet_creds_merge.js` (`credsMerge` section), `dnet_loot_merge.js` (`loot` section) | Read-merge-write at the JSON-object level (`mergeStatus` in `dnet_lib.js`, called only by these three home-only scripts as of 2026-08-12) so the three writers don't stomp each other's section. In `WATCHED_FILES`/`PULL_FILES` (added 2026-08-12, same pattern as `ipvgo_status.json`), so it pushes/pulls automatically for `docs/status-dashboard.html`'s darknet scoreboard. `deployer.*` reflects whichever shard `dnet_status_merge.js` last judged freshest — one roaming instance's own view, not a network total (many independent copies run at once, each seeing only its own `probe()` neighbours) — `deployer.instability` is the one exception, since `getDarknetInstability()` is genuinely global regardless of which host calls it. `credsMerge.totalCracked`/`byModel` and `loot.*` are the trustworthy network-wide figures, but only as fresh as the last `dnet_creds_merge.js`/`dnet_loot_merge.js` run, and `deployer.*` is likewise only as fresh as the last `dnet_status_merge.js` run. |
| `dnet_manager_registry.json` | `dnet_root.js` (folded from `dnet_manager_active_<host>.json` shards, cadence `REGISTRY_MERGE_MS`) | `{host: ts}` of currently-believed-active resident managers. Every root launch creates an ownership generation; only shards tagged with that generation count, so old residents cannot block clean replacement after a restart. A crawler reserves a slot before spawning its manager; the manager refreshes that shard every 15 seconds while phishing. Entries older than two minutes are dropped on the next home-side merge. |
| `dnet_restart_status.json` | `restart_mcp.js --darknet` | One small launch diagnostic: the root script RAM, home RAM before/after, and resulting root PID (or zero on failure). Written only for a Darknet restart attempt, so it makes a failed canary launch diagnosable without tail/terminal log volume. |

All of the above are game output and should be gitignored if they ever land locally.
`dnet_creds.txt` is worth adding to the download pattern once the system is
live, so its contents are readable outside the game.

### Failure modes worth knowing

- **Response code 408 (`RequestTimeOut`) does not mean "wrong password."** The
  game rolls the instability timeout *after* the attempt resolves, so a correct
  password can return 408. `dnet_lib.js` retries 408 with the same password and
  only drops a candidate on 401. Any code that gets this wrong silently skips
  the right answer.
- **Backdoors, not authentications, drive instability.** Free allowance is 2;
  each one past that adds 3% to the global authentication timeout chance,
  capping at 50%. `dnet_deploy.js` never backdoors.
- **`openCache` costs karma** (`difficulty + 1` per cache). `dnet_loot.js`
  reports the total per run.
- **A stored password that starts returning 401** means the server restarted
  with a new one. `dnet_deploy.js` drops the stale credential and re-cracks.
- **`ns.dnet.getServerDetails()` has no `maxRam` field.** `maxRam` lives on
  the general `Server` object (`ns.getServer`/`ns.getServerMaxRam`), not on
  `DarknetServerDetails`. `dnet_loot_all.js`'s RAM-fit check reads the
  nonexistent field and always sees `0`, so it always skips — its "RAM too
  small" counts don't reflect real capacity. Not fixed there (kept as a
  manual tool); `dnet_deploy.js`'s inline loot path uses
  `ns.getServerMaxRam` correctly.
- **The Remote API watch list is explicit.** `dnet_loot_realloc.js` had been
  omitted despite being a live dependency; it and the new `dnet_phish.js`
  are now listed in `tools/bb_remote.py`. The daemon must restart once to
  load that changed Python list, then the game must reconnect.
- **Unbounded resident-manager growth froze the game — confirmed live
  2026-08-30, fixed same day.** `dnet_crawl.js` spread to every reachable,
  crackable neighbor with no limit, and every host it landed on got a
  permanent resident `dnet_manager.js` (`ns.spawn` at the end of its
  `main()`) — each polling at minimum every 1s, forever. Restarted with no
  cap, Bitburner became completely unresponsive; `ps` showed the renderer
  process (the single thread running every Netscript tick *and* the UI)
  pegged at 165-169% CPU. Fixed with a `MAX_ACTIVE_MANAGERS` cap (15)
  enforced in `dnet_crawl.js` right before the `ns.spawn` call, backed by
  the `dnet_manager_registry.json` shard-and-merge registry described
  above. **That cap alone wasn't the fix — it took two live freezes to
  find the real one.** A resident-count cap can only ever bound
  steady-state count; it never touched the actual driver, the propagation
  burst itself, and a tightened version of it (8, 1s merge) froze the game
  *faster* than the original (15, 5s merge) once the network was mostly
  pre-cracked from earlier runs (near-instant re-authentication lets a
  restart unfold the whole reachable fan-out tree quicker than a cold run
  ever could). Actual fix: `MAX_SPREAD_PER_PASS` hard-stops `dnet_crawl.js`'s
  spread loop at 2 neighbors per pass, and `jitteredRecrawlMs` desyncs
  `dnet_manager.js`'s 90s recrawl clocks so they don't re-converge into a
  synchronized burst. **That wasn't the fix either — two more live freezes
  followed, and darknet is off as of this writing.** A third restart under
  this throttle grew gradually (no burst) yet froze anyway at a *lower*
  resident count than either prior attempt; a fourth, cleanly isolated
  restart (darknet alone, nothing else running) froze within ~90 seconds
  with only 6 real resident managers, well under the cap. That rules out
  aggregate load, propagation burst speed, and resident count as the
  primary driver — the actual cause likely lives inside what
  `ns.dnet.probe()`/`getServerDetails()`/`authenticate()` cost against this
  save's darknet graph itself, not in anything `dnet_crawl.js`/
  `dnet_manager.js`-level throttling can reach. See `docs/darknet-strategy.md`'s
  2026-08-30 status banner for the full four-freeze arc.
- **Chaining `run dnet_killswarm.js;run dnet_root.js` on one line can kill
  the process it just started.** `run` doesn't block for the launched
  script to finish, so both start nearly simultaneously; `dnet_killswarm.js`'s
  `TARGET_SCRIPTS` set includes `dnet_root.js` itself and its cleanup scan
  covers `home`, so the kill pass can catch its own sibling launch. Found
  live 2026-08-30 via a terminal alias that did exactly this — `ps` came
  back completely empty right after, and the registry file sat unchanged
  for 15+ minutes despite an active connection (proof the merge loop had
  died, not gone quiet). Always run the two commands separately.
- **A RAM-fit check needs *free* RAM (`maxRam - usedRam`), not just
  `maxRam`.** `dnet_deploy.js`'s inline loot path first checked `maxRam`
  alone and passed a target (`darkweb`) whose *total* RAM was fine but whose
  *free* RAM wasn't — files landed via `scp`, then `exec` silently returned
  pid 0 (Bitburner's normal "not enough RAM" signal) and nothing ran, no
  error. Fixed to check `getServerMaxRam(host) - getServerUsedRam(host)`,
  the same pattern `mcp.js` already uses for the regular network.

---

## IPvGO (`ns.go`)

A self-contained set, same shape as the darknet set above: not touched by
`mcp.js`, not auto-started by `startup.js` or `mcp_supervisor.js`. Full API
reference (with RAM costs, gating, and citations to the in-game
documentation itself), the reward-structure writeup, and the move-priority
design all live in `docs/ipvgo-strategy.md` — this entry is just the map.

| File | Runs on | RAM | What it does |
| --- | --- | --- | --- |
| `ipvgo_player.js` | any host with `ns.go` access (the API is not tied to a specific server) | ~17.6GB arithmetic estimate as of the 2026-08-12 rewrite (down from 34.45GB measured live pre-rewrite) — **not yet measured live**, see its own header comment | The `ns.go` event loop only, as of 2026-08-12: fetches the real board/valid-move grid each turn and asks `ipvgo_logic.js`'s `chooseBestMove()` (flat Monte Carlo — see below) which move to play. Self-supersedes, never discards an in-progress game, starts a fresh one (default `Netburners` 7x7 — still a placeholder, not tuned) once the current one ends. Writes `ipvgo_status.json` on startup and after every game — in `WATCHED_FILES`/`PULL_FILES` both. Fields: `algorithm`, `gamesPlayed`/`wins` (cumulative for the current `algorithm` tag, restart-safe — reads the existing file back on startup, see `ipvgo_player.js`'s `loadPersistedStatus()`), `recentGames`/`recentGamesCount`/`recentWinRate` (rolling last-100-games window, also restart-safe but reset on an `algorithm` tag change so a rewrite doesn't dilute its own number with a predecessor's results), `opponent`, `size`, `lastResult` (now includes `avgMoveMs`/`maxMoveMs`), and — added 2026-08-12 for the dashboard's "rewards" section — `winStreak`, `highestWinStreak`, `favorRep`, `bonusPercent`, `bonusDescription`, `opponentLifetimeWins`, `opponentLifetimeLosses`, all read from `ns.go.analysis.getStats()` (0GB, the game's own all-time per-opponent record — see `ipvgo_player.js`'s `readOpponentStats()`). |
| `ipvgo_logic.js` | local only + pushed to the game as an import target for `ipvgo_player.js` | n/a (pure logic, no `ns` calls) | New 2026-08-12, mirroring the `mcp.js`/`mcp_logic.js` split. A from-scratch local Go rules engine (flood-fill chains/liberties, capture, suicide prevention with the game's own "except when it captures" exception, a simplified single-capture ko rule, area scoring, a diagonal-based simple-eye heuristic) plus a flat Monte Carlo move-selection algorithm built on top of it (`chooseBestMove`/`evaluateMove`/`runPlayout`). Full citations and design rationale — including a documented, profiled performance rewrite (rejection-sampling instead of full-board-scan move selection, after the first draft took multiple *seconds* per move) — are in the file's own header and `docs/ipvgo-strategy.md`'s 2026-08-12 section. |
| `ipvgo_logic.test.js` | local only, `node --test ipvgo_logic.test.js` | n/a | 23 tests against small hand-built boards (using the real `board[x][y]` convention): capture (single- and multi-stone chains), suicide prevention and its capture exception, the simplified ko rule (both a real ko shape and a negative control), simple-eye detection (interior/edge/corner cases), area scoring (including contested space and dead nodes), and — the ones that actually validate the algorithm choice, not just the plumbing — that `evaluateMove`/`chooseBestMove` reliably prefer a real capture over a self-atari move. |

**Running live as of 2026-08-11 (the prior heuristic version); the 2026-08-12
Monte Carlo rewrite above is pushed to the game (`ctl-push`, confirmed via a
round-trip `ctl-get`) but has not yet been started with `run
ipvgo_player.js` in the live terminal** — see `docs/claude-todo.md`'s
2026-08-12 section for the exact one-line next step. The 2026-08-11
heuristic version did run live and collected real data (see
`docs/ipvgo-strategy.md`'s 2026-08-11 (later) section for the
single-network-collapse diagnosis and its fix, and the 2026-08-12 section
for the last heuristic-era sample: 3 wins / 5 games, most recently a 45-1.5
win, before this rewrite). Check current record any time via `cat
ipvgo_status.json` or `python3 tools/bb_remote.py ctl-get
/ipvgo_status.json --control-port 12527`.

**Deliberately never references `ns.go.cheat.*`** — that surface needs
Source-File 14.2 (confirmed live this session Ken doesn't have it, and
doesn't have SF4 yet either), and Bitburner only RAM-gates/needs functions a
script actually references, so simply not writing `ns.go.cheat` anywhere
means there's nothing to guard against at runtime, the same class of fix
`hacking/backdoor.js` had to add *after* hitting an uncaught `RUNTIME ERROR`
for `ns.singularity` without SF4 — done up front here instead.

---

## Reputation (`ns.share`)

**Current state: disabled after the stability/loop incident.** Do not run
`share_deploy.js` or `scripts/share.js` until the worker has an explicit
bounded cooldown, focused tests, a bounded canary, and re-enable approval.
The table describes the existing artifact only.

Added 2026-08-13, Ken-requested ("boost our rate of reputation growth").
Self-contained, not touched by `mcp.js`, not auto-started by anything.

| File | Runs on | RAM | What it does |
| --- | --- | --- | --- |
| `scripts/share.js` | any host, spread by `share_deploy.js` | 2.4GB/thread | Repeatedly calls `ns.share()` and then yields for one second. The explicit yield prevents a large share deployment from monopolising the game event loop. All allocation logic remains in the deployer, same division of labor as the weaken/grow/hack workers. |
| `share_deploy.js` | run once from `home` | ~2.6GB to run itself (exits after launching) | Launches `scripts/share.js` threads idempotently (every start first removes the previous share allocation). Default balanced mode kills only home's MCP action workers, reserves 256GB for 106 share threads at the measured 2.4GB/thread, then exits; MCP sees the occupied RAM and refills the rest of home on its next tick. `home` aliases balanced, `spare` uses only currently free home RAM, and `network` additionally fills currently free rooted ordinary-network RAM. `run share_deploy.js stop` kills all ordinary-network/home share workers, after which MCP automatically reclaims the RAM next tick. Args: `[mode] [shareHomeGb=256] [reserveHomeGb=32] [maxThreads]`. |

**Caveat that matters more than the RAM math:** share power only affects
reputation gain while actively doing faction work (manually in the UI or via
`workForFaction`); the current company-work formula does not apply it.
This repo has no scripted faction-work automation — running this while
nobody is doing faction work burns RAM for nothing. The exact global curve is
`sharePower = 1 + ln(effectiveThreads) / 25`; effective threads include the
calling host's core bonus and aggregate across all hosts. `home` is therefore
usually the most share-efficient RAM, but returns remain logarithmic. Check
`ns.getSharePower()` (printed by `share_deploy.js` on launch) for the live
result.

The original free-RAM mode has run live. The bounded balanced allocation was
added 2026-08-14 and is locally tested; its first in-game run still needs the
terminal command recorded in `docs/kensTodo.md` because Codex cannot execute
terminal commands through the file bridge.

---

## Legacy and unused

Kept because they cost nothing and occasionally get read, but not part of any
current path. Nothing below is called by `mcp.js`.

| File | Status |
| --- | --- |
| `scripts/copyScripts.js`, `scripts/copy_scripts.js` | Byte-identical duplicates. `mcp.js` has its own `copyActionScripts`. |
| `scripts/execute.js` | Manual one-host deploy from before `mcp.js`. Calls `copy_scripts.js`. |
| `scripts/weakenGrowHack.js` | Sequential weaken→grow→hack in one thread. Superseded by separate action scripts. |
| `purchaseServer-8GB.js` | **Broken.** scp/execs `early-hack-template.js`, which is not in this repo. |
| `tail_mcp.js` | Earlier version of `mcp_status.js`. |

---

## Generated files

All gitignored — they are game output, and the log lives inside the save file,
so it must not grow without bound.

| File | Written by | Notes |
| --- | --- | --- |
| `mcp_status.json` | `mcp.js`, every tick | Overwritten. The observation source of truth. Carries the last 20 events inline. |
| `mcp_events.txt` | `mcp.js`, per transition | Appended; trimmed to 300 lines at startup. Survives restarts, which is the point. |
| `mcp_status_log.txt` | `mcp.js`, on state change | Appended. Logging every tick grew this ~800KB/day inside the save, burying the transitions that actually explain behaviour. |
| `mcp_target_state.json` | `mcp.js`, every tick | Exclusions, so a restart doesn't relearn them. |
| `mcp_restart.txt` | outside the game | Restart trigger. |

`mcp_config.json` is **not** generated and **is** committed — it is an input we
author, and it needs to be in the repo to sync into the game.
