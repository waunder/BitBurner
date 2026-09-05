# Claude's working list

## 2026-09-05 (latest): IPvGO browser-freeze root-caused and fixed; cloud-server idea investigated and rejected with reasoning

Ken asked to resume strengthening IPvGO against tougher opponents, assess
every recent defeat for improvement opportunities, and investigate his
suspicion that the recurring "freezes the bb interface" problem was caused
by the program being too large — proposing a cloud server as the fix if so.

**Investigation found a different, fully confirmed mechanism, not "too
large."** `ipvgo_status.json`'s `lastResult` already showed `avgMoveMs`
11,721 / `maxMoveMs` 13,591 (an 11-14 second delay per move) on the current
13x13-vs-The-Black-Hand subnet. Direct code reading confirmed why:
`chooseBestMove()`'s entire MCTS simulation loop (6000 sims, raised
2026-08-12 while tuned for a 7x7 board) ran synchronously with no `await`
inside it, and Bitburner executes Netscript on the browser tab's single JS
thread — so that loop blocks the *entire tab*, not just this script, for
its full duration, every move. The arithmetic checks out almost exactly
against the observed timing (13x13 has ~3.4x 7x7's points, rollout cost
scales roughly with the square of that, times the 4x sim-count raise ≈
48x the original ~250ms/1500-sim baseline ≈ the observed ~11.7s). RAM
(~17.6GB, arithmetic) doesn't scale with board size at all, so this isn't a
"too large" problem in any sense that would call for more hardware.

**Cloud server: investigated, does not apply, said so plainly rather than
building it anyway.** `ns.go.*` only exists inside the live game's own
browser-tab JS VM; there's no remote-execution surface for gameplay, and
this repo's existing Remote API bridge (`tools/bb_remote.py`) is a
file-sync channel with no live low-latency round trip that could compute a
move externally and hand it back mid-turn. Even hypothetically, faster
external hardware wouldn't fix a blocking-thread problem, just shorten the
block. Full reasoning in `docs/ipvgo-strategy.md`'s 2026-09-05 section.

**Fix shipped**: `ipvgo_logic.js`'s MCTS computation is unchanged (same
algorithm, all 35 pre-existing tests pass verbatim) but now exposed as a
resumable handle (`createMctsSearch` — `runIterations`/`runIterationsForMs`/
`getResult()`); `ipvgo_player.js` drives it in ~40ms chunks with `await
ns.sleep(0)` between them instead of one blocking call, and replaced the
fixed `NUM_SIMULATIONS` (the actual root of the tuning drift) with a
wall-clock thinking budget (`TARGET_THINK_MS=10000`) plus a simulation
ceiling (`MAX_SIMULATIONS=20000`) so board-size changes can't silently
break the tuning again. Local profiling (13x13, empty board): ~595
sims/sec, max single chunk 57ms (vs. the old single 11.7s block) — and the
new 10s budget lands at or above the old 6000-sim depth, so this is a
strengthening, not just a fix, on the exact board where recent losses
occurred. `algorithm` tag bumped `mcts-ucb1-v2` → `mcts-ucb1-v3` per this
repo's own standing practice, so the rolling win-rate window starts fresh
rather than blending pre/post-fix games. 4 new tests added
(`createMctsSearch` chunking-equivalence + budget/null-result behavior),
full suite 220/220 (`node --test *.test.js`).

**Defeat analysis**: the three most recent losses (66-95.5, 71-90.5,
64-96.5) are comfortable whole-game losses on the new 13x13 board, not
shutouts — none match the already-fixed 2026-08-11 whole-network-collapse
signature (Black still holds 64-71 points each). Consistent with "search
too shallow for a much bigger board," which the fix above directly
addresses by removing the ceiling that made raising the sim count a bad
trade. Sample size post-transition is still small (opponent lifetime record
against The Black Hand: 0 wins / 1 loss) — not enough games yet to read a
rate, called out as such in the doc rather than asserted.

**Also found and fixed in passing**: `docs/processes.md`'s "IPvGO... remain
off" line was stale (12,700+ lifetime games recorded under the prior
algorithm tag alone, i.e. it's been running live this whole time) — updated
alongside a fuller rewrite of that file's entire IPvGO table, which hadn't
been kept current since the 2026-08-12 rewrite (predated the MCTS upgrade,
the HUD, and ~all of this history).

**Not yet done, needs Ken's hand** (Bitburner doesn't hot-reload — the
resident `ipvgo_player.js` process keeps running the old blocking code
until restarted): `run ipvgo_player.js` in the live terminal once this push
lands, then watch `ipvgo_status.json`'s `avgMoveMs`/`maxMoveMs` to confirm
the freeze is actually gone live, not just in local profiling. See
`docs/kensTodo.md`. RAVE/AMAF (Gelly & Silver 2007, already cited in
`ipvgo_logic.js` for the opening-move prior) is the next well-cited lever
if win rate still lags after enough post-fix games accumulate — deferred
this round, not attempted half-done.

**Mid-session follow-up from Ken**: "the primary IPvGO reward is faction
reputation... the goal is improvement through a series of games, not just
a single game" — correct per `docs/ipvgo-strategy.md`'s own reward-structure
writeup, and it caught a real, timely bug: `ipvgo_player.js` picked its
target faction purely from `ns.args[0]`, defaulting to `"Netburners"`
whenever omitted, so *every* restart with no arg (including the very
restart just requested above) would have silently reset away from whatever
faction/streak was actually in progress (The Black Hand, currently).
Fixed: the target now persists across restarts by reading it back from
`ipvgo_status.json` (`readPersistedFactionChoice`, not scoped to the
`algorithm` tag the way performance counters are, since it's a choice, not
a measurement) — an explicit arg still overrides it. Also added a startup
faction-membership check (`ns.getPlayer().factions`) that warns plainly if
the target isn't a faction Ken has actually joined yet, since the
win-streak-to-favor conversion needs membership even though territory
stat bonuses don't; surfaced as `targetFaction`/`isFactionMember` in the
status file and a new `ipvgo_hud.js` row. Full writeup in
`docs/ipvgo-strategy.md`'s "reputation is the real goal" section.

**Live-confirmed, same day.** First restart attempt failed to connect the
Remote API at all — Ken was on the web version, where this is categorically
blocked (Chrome PNA policy, a pre-existing confirmed-unfixable finding, not
new); switching to Steam connected immediately. That restart also landed on
`Netburners`/7x7 instead of The Black Hand — not a bug in today's fix, but
the *prior* pre-fix run had already overwritten the persisted choice before
the fix could take effect, a live demonstration of exactly the bug being
fixed. Restarting a second time with the faction spelled out explicitly
(`run ipvgo_player.js "The Black Hand" 13`) confirmed everything: `algorithm:
"mcts-ucb1-v3"`, `isFactionMember: true`, and — the actual point of all of
this — `avgMoveMs`/`maxMoveMs` **6100/8351ms**, down from the pre-fix
11,721/13,591ms. Ken, watching the live game: **"No sign of bb interface
freezing. Your diagnosis is solid!"** Root cause, fix, and result all
confirmed live, not just in local profiling.

## Lesson learned — telemetry must be cumulative and visible where it is read

The first version of `mcp_formulas_shadow.js` overwrote
`mcp_formulas_shadow.txt` on every sample and only left the latest snapshot.
Although the script technically wrote a valid `.txt` file, repeated runs could
not be compared reliably, and the tail did not show the exact persisted
record. This consumed substantial investigation time because “the file was
written” was mistaken for “the run produced retrievable evidence.”

For bounded diagnostic runs, write one complete record per sample in append
mode, print that same record to the tail, and document how the resulting file
is retrieved. Verify the evidence channel end-to-end before treating a run as
complete. Continuous monitors need an explicit retention or archive policy.

## 2026-08-30 (latest): darknet froze the game live; root-caused and fixed same day

Ken asked to restart darknet, after I flagged (from `docs/darknet-strategy.md`'s
undated "stability incident" banner) that no actual postmortem existed —
`STATE.md`'s only concrete incident record named IPvGO/faction-share, not
darknet. Restarted cautiously (`dnet_killswarm.js --restart`, after
diagnosing an initial pid-0 launch failure as a transient RAM race, not a
real block — direct `run dnet_root.js` worked fine). Ran with no reported
sluggishness for a while, charisma climbing nicely, then Ken reported
Bitburner "completely unresponsive."

Diagnosed remotely with OS-level tools (no in-game access needed): `ps`
showed the renderer process pegged at 165-169% CPU — the single thread that
runs every Netscript tick *and* the UI — and the Remote API log showed the
connection dropping at the same instant with the familiar "no close frame
received or sent" signature. Read `dnet_crawl.js`/`dnet_manager.js`/
`dnet_root.js`/`dnet_lib.js` in full to find the actual mechanism: no cap
anywhere on how many hosts get a resident manager. `dnet_crawl.js` spreads
to every reachable, crackable neighbor unconditionally, and every host it
lands on ends up with a permanent `dnet_manager.js` (`ns.spawn` at the end
of `main()`) polling at minimum every 1s, forever. With 586+ credentials
already cracked historically, an unbounded restart could accumulate however
many resident managers the network allowed — real, unbounded, ever-growing
per-tick JS work with a single-threaded renderer as the only place to run
it. Ken recovered via Bitburner's built-in "reload and kill all scripts";
`startup.js` relaunched cleanly (darknet was never part of its launch list,
so nothing needed re-suppressing).

**Fixed same day**, entered plan mode given the stakes (live-incident code,
4 files touched). `MAX_ACTIVE_MANAGERS = 15` (conservative starting point,
same instinct as `mcp.js`'s `HACK_BALANCE_SAFETY`), enforced at a single
point — `dnet_crawl.js`, right before its `ns.spawn(MANAGER, ...)` call,
since every host in the swarm becomes resident through that exact line.
Backed by `dnet_manager_registry.json`, a shard-and-merge registry
following this codebase's own existing credential/loot/deployer shard
pattern exactly (`dnet_lib.js`'s `writeDeployerShard`/`shipShard`/
`mergeStatus` were the templates) — `dnet_crawl.js` reserves a slot before
spawning, `dnet_manager.js` refreshes its heartbeat once per loop iteration
so a genuinely-alive manager never goes stale and gets wrongly evicted, and
`dnet_root.js`'s existing 5s home-side loop folds shards into the registry
(piggybacked, no new polling loop). `dnet_crawl.js`/`dnet_manager.js` both
duplicate the tiny amount of needed logic rather than importing `dnet_lib.js`
— same reason those files already avoid that import (the 10GB
static-analysis RAM charge), documented inline at each duplication site.
11 new `node --test` cases (`dnet_lib.test.js`), `node --check` clean on all
four touched files, 177/177 full suite. **First live restart overshot the cap, same day.** Ken restarted; froze
briefly again (though this time reported no sluggishness up to the point he
killed it), and `dnet_manager_registry.json` showed 30 entries against a
cap of 15 — 48 known hosts by the time `dnet_killswarm.js` cleaned up 69
processes. Root cause: a real race, not a logic bug — the registry only
merges on `home` every few seconds, propagation fans out faster than that,
and Bitburner's NS API has no cross-host locking primitive to close the gap
completely. Mitigated (not eliminated, and documented as such in
`dnet_lib.js` now — this is a **soft** cap): registry merge cadence 5s → 1s
(`REGISTRY_MERGE_MS`), cap 15 → 8 (`MAX_ACTIVE_MANAGERS`) for margin against
the observed ~2-3x overshoot. Also caught and fixed a second real bug in
the same pass: `dnet_crawl.js`'s duplicated copy of `MAX_ACTIVE_MANAGERS`
had already drifted stale (still 15) the moment `dnet_lib.js`'s was retuned
to 8 — added 4 new tests that import both files' exported copies directly
and assert they match, so that duplication (needed to avoid `dnet_lib.js`'s
static-analysis RAM charge) can't silently drift again. 15 new test cases
total today (181/181 full suite). Notable: Ken saw no sluggishness at the
30-48-host peak, so 8 is a conservative starting point given the overshoot
margin, not a measured safe ceiling — the real danger threshold is still
unconfirmed. **The tightened cap froze the game again, faster, on the very next
restart.** `dnet_manager_registry.json` showed 36 entries against a cap of
8 (worse overshoot ratio than the first attempt's 30-vs-15) before Ken
killed it — several entries shared the exact same millisecond timestamp.
That data ruled out "cap wasn't tight enough": `MAX_ACTIVE_MANAGERS` only
ever bounds steady-state resident count, never the actual driver. Read the
mechanism again with fresh eyes: the network is now mostly pre-cracked from
the earlier runs, so `acquireSession`'s fast path (`connectToSession` with
an already-known password) is near-instant — a restart can now unfold the
whole reachable fan-out tree *faster* than the original cold run did,
outracing any registry-based coordination no matter how tight the cap or
fast the merge cadence. That's a rate problem, not a ceiling problem; two
live freezes with the wrong mitigation before landing on the right one.

Entered plan mode a third time given the stakes — Ken had already been
through two live freezes, and this fix touches propagation dynamics
directly rather than just counting after the fact. Shipped:
`MAX_SPREAD_PER_PASS` (2, `dnet_lib.js`/`dnet_crawl.js`) hard-stops
`dnet_crawl.js`'s spread loop at 2 successful spreads per pass — stopping
authentication too, not just the `exec`, since `ns.dnet.authenticate` is
itself real, non-trivial work. Nothing permanently missed: a host's next
~90s recrawl (`dnet_manager.js`) re-invokes `dnet_crawl.js` fresh and picks
up where the last pass left off, so coverage becomes gradual instead of a
single burst. `jitteredRecrawlMs` (`dnet_lib.js`, ±15%) desyncs each
manager's recrawl clock so managers spawned close together (exactly what
one propagation wave produces) don't stay permanently synchronized and
re-converge into a wide simultaneous burst later. Both duplicated into
`dnet_crawl.js`/`dnet_manager.js` per the established lean-script pattern,
with the drift-guard tests extended to cover the new constant too. 6 new
`node --test` cases, 187/187 full suite.

Stated plainly in `dnet_lib.js` itself, not just here: node tests can
verify the throttling *logic* (the loop stops at exactly N, the jitter
stays in range) but not the *emergent* behavior of many independently-
scheduled live processes, which is what actually failed twice tonight.
**Third live restart under the throttle: grew gradually, froze anyway.**
13→19 registry entries over ~2 minutes, no burst — the throttle worked as
designed — yet it froze at a *lower* resident count than either of the
first two attempts. First sign the resident-count/propagation-burst theory
was incomplete: something else was contributing.

Ken proposed the right next experiment: isolate darknet completely and see
if it fails on its own. First attempt at this was invalidated by a real
procedural footgun, not a code bug — his terminal alias
`dnet='run dnet_killswarm.js;run dnet_root.js'` chains two `run` calls with
`;`, but `run` doesn't block for completion, so `dnet_killswarm.js`'s own
cleanup scan (which explicitly targets `dnet_root.js`, and covers `home`,
per `TARGET_SCRIPTS`) can race and kill the very process the same line just
launched. Diagnosed from `ps` coming back completely empty right after, and
confirmed by computing the registry file's actual age against wall-clock
time (17+ minutes stale despite an active connection — proof the merge
loop had died, not that it was quietly idle). Ken had independently
suspected "nothing is happening" from charisma/cache/console signals alone
and was right before I had proof.

**Fourth restart, properly sequenced (two separate commands), cleanly
isolated — the real finding.** `mcp.js`, `dnet_scorecard.js`, HUD,
supervisor, `get_stats.js` all confirmed off; hacknet/factions passive
game state only, nothing executing. Froze within ~90 seconds with only 6
real, cleanly-propagated resident managers — well under the cap of 8, no
ghosts, no race. This is conclusive: it rules out aggregate load from other
scripts, propagation burst speed, and resident count as the primary
driver, since a minimal well-behaved deployment with nothing else running
still failed fast. Four live freezes total this session; neither the
resident cap nor the propagation throttle actually fixed the problem, only
ruled out increasingly specific theories about it.

**Darknet stays off.** Recommended stopping rather than a fifth live
attempt — diminishing returns from guess-and-check, real cost to Ken's
evening each time. Whatever's actually happening most likely lives inside
what `ns.dnet.probe()`/`getServerDetails()`/`authenticate()` themselves
cost against this save's darknet graph (586+ historically-known hosts),
not in anything reachable from `dnet_crawl.js`/`dnet_manager.js`-level
throttling. Next real step is reading the game's own bundled source for
what those calls do internally, or much more incremental live testing than
one session has budget for — not another retune-and-restart cycle. Full
incident arc in `docs/darknet-strategy.md`'s 2026-08-30 status banner.

## 2026-08-29: skim-vs-harvest tested and falsified; fixed a real gap it exposed in mcpMulti's own numbers

Ken's follow-up question: given augmentation installs reset everything
periodically anyway, might "skim the easy money off each server, then move
on" beat sitting on one target forever? Built `skim_probe.js` (read-only,
dumps every hackable server's live economics) to test it for real rather
than reason about it in the abstract — see `docs/processes.md`'s new
`skim_probe.js` section for the script itself.

**Result: falsified, by 3x-75x.** Two things killed it: untouched servers
sit at ~2% money / 13-62 security points above floor (no free lunch — same
weaken+grow priming investment either strategy pays), and priming one with
the whole 278-thread pool takes 30min-50hr depending on the server;
`hackAnalyze`'s steal-fraction-per-thread is also small enough that even a
primed target only yields 3-20% of its money in one burst with the current
pool size, so there's no big one-shot grab available either. Ran the actual
$/hour math (priming cost + capped burst, amortized) against
`mcp_logic.js`'s own `computeTargetScore` for every server on the network —
steady harvest won every single comparison. No skim mode built.

**Second-order finding, more important long-term:** this exposed a real gap
in `mcpMulti.js`'s own numbers. Its per-assignment `projectedScore` and
`singleTargetBaselineScore` were both the *raw* steady-state rate
(`getTargetScore`), with no ramp-cost discount — meaning once mcpMulti
actually spreads to a second (necessarily still-priming) target,
`upliftRatio` would have overstated near-term reality the same way the
pre-R4 single-target score used to for a drained target. Fixed same day:
both now use `getTargetEffectiveScore` (the ramp-discounted function
`mcp.js`'s own `candidateScore` already uses), and `singleTargetBaselineScore`
reuses the candidate's already-computed ranking score instead of a redundant
second read. Deliberately did *not* touch `computeTargetPoolNeed`/
`partitionHostsAcrossTargets` — capacity (how much RAM a target can
usefully absorb) and value (what it's worth) are different axes, and
discounting capacity by ramp cost would wrongly make the partitioner
reluctant to start priming a good second target with surplus RAM that would
otherwise sit idle. `docs/processes.md`'s `mcpMulti.js` section has the
full reasoning.

Also explains the `upliftRatio=1.0` degenerate case watched live all
afternoon: 15 of 16 servers on the network are unprimed right now, so there
currently isn't a second target cheap enough to be worth diverting hosts to
— not a bug, just an accurate reflection of the network's current state.

## 2026-08-29 (earlier, same day): mcpMulti.js — dry-run-first multi-target farmer

Built after a conversation about `mcp.js`'s single-target design: whether it
was a game constraint or a policy choice, and if the latter, where on the
single-vs-multi-target spectrum to sit. Conclusion — it's a policy choice
baked into `computeDesiredAllocation`/scoring (`poolThreads` assumes one
target owns the whole network), and the reasoned answer was "stay
single-target until `ramUtilization` during work phases shows sustained
slack, then move to 2-3 concurrent targets, not full breadth."

Ken asked for that built out for real rather than staying theoretical, as a
script separate from `mcp.js` (untouched, keeps farming live) with a way to
experiment safely first. Shipped:

- `mcpMulti_logic.js` + `mcpMulti_logic.test.js` (11 new tests, all passing)
  — the actual "test logic to experiment" deliverable, no game required.
  `computeTargetPoolNeed` derives a saturation-based pool-thread need per
  target from `computeTargetScore`'s own drained-fraction model;
  `partitionHostsAcrossTargets` greedily splits the worker pool across
  ranked targets by that need.
- `mcpMulti.js` — the orchestrator, dry-run by default (mirrors
  `mcp_stock_trader.js`'s `trade=1` gate exactly): computes and logs a full
  multi-target plan plus a `singleTargetBaselineScore` for direct comparison
  against what `mcp.js`'s own approach would project, but calls no
  `ns.exec`/`ns.scp`/`ns.kill` unless started with `live=1`. `live=1` refuses
  to start while `mcp.js` is running on `home` (mutual-exclusion guard —
  they'd fight over the same worker RAM otherwise).
- Own files throughout (`mcp_multi_config.json`, `mcp_multi_status.json`,
  `mcp_multi_status_log.txt`, `mcp_multi_events.txt`,
  `mcp_multi_target_state.json`) so none of this touches `mcp.js`'s state.
  `mcp_multi_config.json` added as the hand-authored exception to
  `.gitignore`, same as `mcp_config.json`.
- `tools/bb_remote.py`'s `WATCHED_FILES`/`PULL_FILES` updated so the daemon
  syncs the new script/config/telemetry files once it's reconnected —
  **the daemon process itself needs restarting (not just a resync) to pick
  these up**, same caveat as `set_objective.js`'s launch below. It's
  currently disconnected already (see the pending Remote API item in
  `docs/kensTodo.md`), so this rides along with that reconnect rather than
  needing a separate one.
- `docs/processes.md` gained a `### mcpMulti.js / mcpMulti_logic.js` section
  under Farming at the same depth as `mcp.js`'s own.

**Not yet verified live** — per `CLAUDE.md`, every behavioural claim here is
unverified until it actually runs in Bitburner. `node --test *.test.js`
(166/166) and `node --check mcpMulti.js mcpMulti_logic.js` are clean, which
is everything checkable from outside the game. What to watch once Ken runs
it (dry-run, no arg needed): does `multiTargetProjectedTotal` actually beat
`singleTargetBaselineScore` by a meaningful margin, or does the network's
current pool size not yet justify spreading past one target — either answer
is useful, that's the point of building this dry-run-first instead of just
flipping `mcp.js` over.

## 2026-08-14: R1 through R7 all confirmed live — R4 delivered a ~60x income jump; set_objective.js and lsf.js shipped

Full arc, in order:

**R1 merged and restarted** (~11:42 PDT) after Ken's go-ahead. Live-watched
~15 minutes: `foodnstuff` ramped 4%→100% moneyPct exactly as the
`readiness²` curve predicts, zero invariant violations. Then a real surprise
— `incomePerSec` sat at exactly 0 with zero hack threads deployed anywhere,
including on the 256GB host. Diagnosed with a new `debugWorkWeights` status
field (kept permanently) rather than guessed: `growPerHack≈117` on this
target (5× worse than the doc's own `silver-helix` example) gives a
balanced hack share of 0.77%, which floors to 0 threads everywhere. **Not a
bug** — the formula's exactly correct, `foodnstuff` is just a genuinely
poor fit for the balance-point strategy. This is now live evidence for R4
(target scoring doesn't know about `growPerHack`), not just the modelled
ranking table. Full writeup: `hacking-strategy.md` §5 item 3.

**R5+R7 merged and restarted** (~13:08 PDT) after a second go-ahead.
Resolved one real merge conflict in `hacking-strategy.md` §5 (both branches
had edited it independently) by hand. Confirmed live: zero
`invariantViolations`, 97.7% RAM utilization, `home` (1024GB — bigger than
this project's own notes assumed) carrying 56/494/1 weaken/grow/hack
threads on its own. Side effect worth remembering: home's extra pool means
R1's tiny hack share on this same poor-fit target now rounds up to a
nonzero thread count somewhere, so `incomePerSec` went from $0 to
~$170-190K/s — real money, but R7 partially masking the R4 gap rather than
R1 actually paying off. Full writeup: `hacking-strategy.md` §5 items 5-6.

**`set_objective.js` shipped and live-tested**, unprompted feature request
mid-session: Ken wants to flip `OBJECTIVE` between money/xp without
spending a Claude session each time. Built a separate override file
(`mcp_objective_override.txt`, gitignored) rather than having the script
write `mcp_config.json` directly — that file is disk-authoritative and
pushed one-way disk→game, so an in-game edit to it would silently revert on
the next resync, a footgun for something meant to work without Claude
watching. `mcp.js` reads the override every tick and it wins over
`mcp_config.json`'s `OBJECTIVE` when set; surfaced in `mcp_status.json`
(`objectiveOverrideActive`) and the tail window. Required one more `mcp.js`
restart (~13:29 PDT) to pick up the reading code, plus a daemon restart
(new `WATCHED_FILES`/`PULL_FILES` entries need the Python process itself
restarted, not just a resync — daemon doesn't hot-reload either). Tested
end-to-end by pushing the override file directly (simulating what the
script does, since Claude has no in-game terminal access to actually run
`run set_objective.js xp`): `config_change` event fired correctly, status
flipped to `xp`, cleared back to `money` afterward since Ken didn't ask to
actually switch modes, just wanted the lever available.

**R4 (target scoring) built in a separate worktree, reviewed, merged, and
restarted live (~13:33 PDT) — this is the one that actually delivered.**
Motivated directly by the R1 finding above: a target can sit at 100% money
with R1 correctly deploying zero hack threads, because the old score had no
way to know why. `node --test *.test.js` 122/122 (up from 110), `node
--check` clean. Shipped, all three together per the doc's own instruction
not to split them: `getTargetScore` rewritten to the achievable-rate
formula, `getTargetEffectiveScore` rewritten to a ramp-cost discount (new
`SCORE_HORIZON_SECONDS` tunable, 3600) replacing the old
dimensionally-arbitrary `READINESS_FLOOR`, and `OPPORTUNITY_SWITCH_FACTOR`
3 → 1.3. Judgment calls: `poolThreads`/`growThreadsIfAllGrow` both reuse
`getTotalWeakenCapacity`'s already-computed `maxWeaken`, justified by
`scripts/grow.js`/`scripts/weaken.js` costing the identical 1.75GB/thread
(checked against both scripts' source); the doc's optional
current-security-vs-floor scaling correction was **not** implemented, base
formula only. **Confirmed live**: the bot immediately dropped `foodnstuff`
for `phantasy` (`growPerHack≈14` vs. `foodnstuff`'s ≈117 — 8× better ratio).
`incomePerSec` went from R5/R7's ~$170-190K/s to **$11-17M/s** once settled
— zero `invariantViolations` throughout. This is the real order-of-magnitude
payoff the whole R1-R4 chain was built for, confirmed rather than modelled.
**R1 through R7 are all shipped, live, and confirmed working now** — only
R6 (XP mode) remains, deliberately parked until `OBJECTIVE` ever leaves
`"money"`.

**`lsf.js` shipped** — a small unrelated request mid-session: real glob
filters (`*`, `?`) for `ls`, since the built-in `-g/--grep` only does plain
substring matching (checked against the game's own source,
`Terminal/commands/ls.tsx`, rather than assumed). `run lsf.js *.msg [host]`.
Confirmed (also from source) that clickable/linkable output like the
built-in `ls`'s is not reachable from any Netscript function — it's
privileged `Terminal.printRaw` + React + internal router code, no `ns`
equivalent exists — so `lsf.js` can't be extended to do that.

**Home-cores question, answered from live data rather than guessed**: `home`
is at 2/8 cores, carrying ~35% of the pool's grow/weaken threads (only
`home` can have cores added at all — every other host is fixed at 1).
Added a `homeCores` status field and worked the actual number from the
live thread split and the balance-point formulas already in
`mcp_logic.js`: maxing to 8 cores is worth roughly **+7-8% income**
(~+$800-900K/s on top of ~$11M/s), not a second multiplier-scale lever like
R1-R4. Also found in passing: `ns.growthAnalyze(target, 2)` (mcp.js's call,
no `cores` arg) defaults to assuming 1 core everywhere, confirmed from the
`NetscriptFunctions.ts` signature — so the model is already mildly
under-provisioning hack relative to what `home`'s real cores can sustain,
independent of whether more get bought. Small effect, not worth chasing
given the size, noted for whoever picks it up later.

Dashboard (`docs/status-dashboard.html`) kept current throughout —
redeployed eight times this session as state actually changed, cleared
per Ken's request once everything in it had been reviewed, "needs your
call" at 0.

## 2026-08-14: R5 + R7 / R4 shipped in isolated worktrees, merge details

**Superseded by the entry above** — both merged (R5/R7 restarted and
confirmed live; R4 merged, restart pending). Left here for the build-time
detail (exact test counts, per-item judgment calls) the summary above
doesn't repeat in full.

Built per `hacking-strategy.md` §2's R5/R7 sections and §5's own instruction
that both have no dependency on R1/R4 and are safe to pick up independently.
Done entirely in a separate worktree with no game connection, same
verification ceiling as R1 was: `node --test *.test.js` (110/110, up from
105 — 5 new tests: 2 for `countRunningByScript`, 3 for
`computeDesiredAllocation`'s new `growSecurityIncreaseForThreads` option) and
`node --check mcp.js mcp_logic.js` both clean. **Not restarted, not watched
live** — that's this worktree's explicit scope boundary, not an oversight.

**R5**: `allocateThreads` now kills/re-execs only the script(s) whose
desired thread count changed, not all three unconditionally — see
`hacking-strategy.md` §5 item 5 for the full breakdown.

**R7**: all four bullets done — `home` joins the worker pool behind a new
`HOME_RAM_RESERVE` (32GB) reserve; the weaken-phase grow-security reserve
uses `ns.growthAnalyzeSecurity` via an injected function into
`computeDesiredAllocation` (a judgment call, since R3 had already moved that
branch into a pure `mcp_logic.js` function by the time this shipped — see
§5 item 6 for the full reasoning); `SECURITY_CAP` 6 → 1;
`tickWithinBounds` untouched (informational only, per the doc).

**Next concrete step, once this merges into the daemon-watched checkout**:
restart via `tools/bb_remote.py ctl-restart`, then watch two things —
`plan_flip` events/hour before vs. after (R5's own measurement plan) and
whether `home` actually starts carrying allocated threads in
`mcp_status.json`'s `workers` array without `mcp.js`/the HUD/the supervisor
themselves ever showing signs of RAM starvation (R7's risk note). Neither
was checked here — this worktree has no live game access at all.

## 2026-08-13 (latest): R3 shipped live; hacking-strategy.md §5 now the maintained "what's left" tracker

R3 confirmed live: restarted, first post-restart tick showed
`needWeaken: 26` with **zero** `weakenBudgetNonNegative` violations — the
budget-conservation guarantee holds under real conditions (878 grow threads
each needing their own security-offset weaken, on top of the 26-thread
primary budget).

Ken asked for a written-up next-steps list. Rather than a separate doc,
turned `hacking-strategy.md`'s own §5 into the maintained status tracker
(dated top-of-file pointer added too) — R2/R3 marked done+confirmed with
what was verified, R1 marked as the next concrete step with its exact
prerequisites (confirm `mults.hacking_grow` live first, add
`computeWorkWeights` to `mcp_logic.js`, wire `ns.hackAnalyze`/
`ns.growthAnalyze` into `buildPlan`, new `HACK_BALANCE_SAFETY` tunable
starting at 0.5). R4/R5/R6/R7 unchanged from the original ranking, marked
not-started with their real dependencies (R4 needs R1 proven first; R5/R7
have none; R6 waits on `OBJECTIVE` going to `"xp"`).

**Not started, no further live changes made this session.**

## 2026-08-13: R2 shipped and live-confirmed; also caught R1's predicted bug happening live, unprompted

Ken said go ahead on R2 (the stuck-target detector fix, see the entry
directly below). Implemented as `evaluateStuckTarget` in `mcp_logic.js`
(5 new tests, 90/90 passing, `node --check` clean), committed, pushed,
restarted live via `ctl-restart`.

**Confirmed working over a ~5-minute live watch, not just deployed:**
`max-hardware` sat at its security floor (5, exactly `minSecurity`) through
a full `weaken→work` cycle and repeated bucket flips with **zero**
spurious "stuck" evictions — the exact scenario that used to fire. The one
`weakenBudgetNonNegative` violation seen is the separate, already-known,
not-yet-shipped R3 bug — not a regression from this change.

**Unprompted bonus confirmation of R1's core diagnosis, live, during the
same watch window**: `max-hardware`'s `moneyPct` swung 0.71 → 0.0057 → 0.19
→ 0.0015 across four `bucket_change` events in under two minutes — the
exact `empty↔low` limit cycle `hacking-strategy.md` §1.1 predicted from the
formulas, not an artifact of this session's changes. It ended in a
legitimate `target_drop reason:"drained"` (avgMoneyPct 0.047, declining) —
correct behavior, since the money genuinely never stabilized. This is real,
live, unsolicited evidence for R1's diagnosis, gathered incidentally while
verifying an unrelated fix.

**Asked Ken whether to proceed to R3 next or hold; no answer yet — do not
start R3 without one.**

## 2026-08-13: hacking-strategy.md — mcp.js is running at ~3% of its own grow-throughput ceiling, root cause found, fixes not yet applied

Ken asked for a close analysis of `mcp.js` against real game mechanics,
since hacking is "the runaway money maker." Two docs now exist:
`docs/hacking-mechanics.md` (formulas from the actual game source) and
`docs/hacking-strategy.md` (the analysis, built with an Opus subagent
briefed on the mechanics doc + full `mcp.js`/`mcp_logic.js`, run in a
worktree so nothing live got touched).

**Verified, not just accepted.** Before trusting the doc's numbers I
independently re-derived the five most load-bearing/surprising claims
straight from the game's own TypeScript source (same source-map
extraction technique) rather than taking the subagent's word: the
`hack()` money-drain formula, the `if (moneyDrained===0) → 25% XP` clause,
the security-fortify thread cap, `growthAnalyze`'s exact correspondence to
the internal growth-log constant, and the "`ns.formulas.*` costs 0 GB"
claim. **All five checked out exactly against source.** Folded the new
facts into `hacking-mechanics.md` itself (dated section) so the knowledge
base actually grew from this, per Ken's original ask, not just the
strategy doc.

**The finding, in one line:** because hack removes a fraction of current
money (multiplicative) while grow multiplies money by a fixed factor per
cycle, log-money drift is *independent of the money level* — there is no
stable in-between money level, only "pins near max" or "collapses toward
zero." `WORK_WEIGHTS_BY_BUCKET`'s entire non-zero hack range (30-75%) is
4-8x past the collapse threshold for every target the bot actually farms.
This is the exact mechanism behind the already-known `empty↔low` bucket
thrashing (350/1373 log lines in one earlier session) — the theory
predicts a bug this project already independently observed and fought
with hysteresis, which is strong corroborating evidence it's right.
Modelled achievable rate on the bot's current target: ~$13M/s. Live
`incomePerSec`: $436K/s. **~30x gap.**

Two more live-reproducing bugs found beyond the `weakenBudgetNonNegative`
one from this morning's mechanics doc: the stuck-target detector evicts
healthy targets (latches at the security floor, which is unbeatable, so
the stall clock runs through every productive minute), and
`hostNeedsRedeploy` never checks allocation *quantity* — only 0 of the
network's threads were running `hack` at the live snapshot taken for this
doc (846 grow, 145 weaken, 0 hack).

**Nothing has been changed in `mcp.js`/`mcp_logic.js`/`mcp_config.json`
yet.** The doc's own ranked order: stuck-detector fix (R2, 4 lines, no
risk) → allocation-diff redeploy (R3, structural prerequisite) →
balance-point hack/grow weights (R1, the actual payload, ships with a
config-tunable safety margin starting conservative) → corrected target
scoring (R4). Multi-target farming and HWGW-style batching were both
evaluated and explicitly rejected — modelled ceilings of +22% and +15-25%
respectively, not worth the complexity/risk against R1's order-of-
magnitude. Full reasoning, code, and risk assessment per item in
`hacking-strategy.md`.

**Decision needed from Ken before anything ships**, since this is live
code farming real money — see the dashboard.

## 2026-08-13: Reputation booster confirmed running, Ken reports +15% — but that figure is his observation, not this repo's telemetry

Follow-up to the entry directly below. Ken reconnected the Remote API a
second time (after the `WATCHED_FILES` gap fix required a daemon restart)
and ran `share_deploy.js`. He reports it's running and showing a 15%
improved rate of reputation growth.

**Important distinction, stated plainly rather than silently accepted:**
that 15% is Ken's own in-game observation (presumably the Factions/company
work UI, which shows a rep-gain bonus derived from share power) — nothing
in this repo currently measures or logs faction/company reputation gain
anywhere. `mcp_status.json` has no reputation field, and `share_deploy.js`
only ever printed `ns.getSharePower()` via `ns.tprint()` on launch, which
per `CLAUDE.md`'s own documented constraint never reaches a file this
session can read. So: **the booster is confirmed running (per Ken), the
15% figure is not independently verified or attributable to a specific
mode** (home-only vs. `network` — don't know which he ran). Recorded on the
dashboard as his reported number, not a measured one.

**Not built, offered but not yet requested:** a small status file (same
shape as `mcp_status.json`) logging `ns.getSharePower()` and, if scripted
faction/company work ever gets automated, the actual rep-per-second — would
make this checkable here instead of eyeballed in-game. Only worth building
if Ken wants it; asked, not assumed.

## 2026-08-13 (later, confirmed): IPvGO fix confirmed live; ns.share() reputation booster built, blocked twice on the Remote API, both resolved

Follow-up to the entry directly below. Ken restarted `ipvgo_player.js`; next
live pull confirmed the fix: `opponent` reads `"Slum Snakes"` (correct
casing) instead of `"slum snakes"`, `lastResult` shows a real varying score
(58&ndash;21.5, not the frozen 24&ndash;23.5) with genuine move timing
(avg 2.9s/move, `maxMoveMs` 3821 — matches real MCTS at 6000
simulations/move on a 9x9 board). **Confirmed fixed, not just restarted.**

Ken also asked for an `ns.share()` reputation-growth booster (see repo's own
diminishing-returns doc comment on `share()`/`getSharePower()` in
`NetscriptDefinitions.d.ts`, cited exactly since the actual in-game curve
isn't extractable from the bundled/minified client source). Built:

- `scripts/share.js` — three-line loop, same shape as `scripts/weaken.js`.
- `share_deploy.js` — launches it. Default mode only claims `home`'s spare
  RAM (`mcp.js` never uses `home` for worker threads, so zero effect on the
  money farm); `network` mode also claims free RAM on rooted worker hosts,
  which `mcp.js` will react to on its own next tick (fewer weaken/grow/hack
  threads there) — a deliberate, not accidental, trade of hacking income for
  rep-gain rate. `stop` mode undoes either. Real caveat surfaced up front:
  share power only affects rep gain while actively doing faction/company
  work — a no-op otherwise, since this repo has no scripted work-for-faction
  automation.
- `node --check` clean on both, `node --test *.test.js` still 85/85 (neither
  file touches anything under test).

**Hit two live-infrastructure snags getting it in front of Ken, both found
and fixed the same session, not left as follow-up:**

1. The Remote API connection dropped at 17:41:33 (`close_code=1006`, no
   close frame) — the same silent-drop failure mode `CLAUDE.md` already
   documents, unrelated to anything this session touched. Ken reconnected.
2. Reconnecting still didn't surface `share_deploy.js` in-game — traced to
   a real gap: `tools/bb_remote.py`'s `WATCHED_FILES` list is a *separate*
   hardcoded push list from what's committed to the repo, and the new files
   were never added to it, so the daemon never pushed them despite being
   connected. Fixed (`WATCHED_FILES` now includes `share_deploy.js` and
   `scripts/share.js`), but picking up a code change to a running daemon
   process requires restarting it, which itself drops the live connection
   the same as any restart — so this needs **one more** manual reconnect
   before `share_deploy.js` actually shows up in the in-game terminal.
   Worth remembering: any future file added to the repo that needs to reach
   the game must be added to `WATCHED_FILES` explicitly — being committed
   and `git`-tracked is not sufficient by itself, a gap that cost a full
   extra round-trip this session.

**Not yet run live:** `share_deploy.js` itself — blocked on the reconnect
above, same as everything else in this paragraph. First real signal once
run: `ns.getSharePower()` printed on launch, and whether `mcp_status.json`'s
`ramUtilization` visibly drops if `network` mode is ever used.

## 2026-08-13: IPvGO stuck in a fake-game loop since sometime after the 22:50 dashboard snapshot — root-caused, not yet fixed live

Routine review session (no code changes queued going in) pulled
`ipvgo_status.json` live and found it wildly out of step with the
dashboard: board `size` reads **9** (dashboard says 7×7), `gamesPlayed`
**11,700+** (dashboard says 96), win rate **~98%**, and `opponent` reads
lowercase `"slum snakes"`. Polled twice more, 2–3 seconds apart:
`gamesPlayed` climbed by exactly 1 each poll, roughly 1 second apart, and
every single one of the last 100 `recentGames` entries has the **identical**
score (black 24, white 23.5, always a win). Real MCTS play at
`NUM_SIMULATIONS=6000` on a 9×9 board cannot possibly finish a game once a
second — that cadence, plus the frozen identical score, means no real games
are being played.

**Root cause, read directly from `ipvgo_player.js` (lines ~407-450, 509-512),
no live test needed:** `GoOpponent` per `NetscriptDefinitions.d.ts` is a
closed enum and `"Slum Snakes"` (title case) is the only valid spelling —
`"slum snakes"` is not a member. The main loop, on detecting a finished game
(`getCurrentPlayer() === "None"`), logs the result, writes status, then
calls `ns.go.resetBoardState(opponent, size)` — if that throws (which it
will for an invalid `GoOpponent` string), the exception is swallowed by the
outer `catch` at line 509 (`ns.tprint` + `sleep(1000)`, no distinct
handling), the board never actually resets, `blackScore`/`whiteScore` stay
frozen at their final values, and the next loop iteration sees the *same*
finished game again — logs it as a new win, tries the same failing reset,
repeats forever. The ~1000ms observed cadence matches the catch block's
`sleep(1000)` almost exactly. So: **something restarted `ipvgo_player.js`
with a lowercase `"slum snakes"` argument** (not this session — `ipvgo_player.js`
hasn't changed on disk since commit `c33c13f`, Aug 12 20:17 — so this was a
live in-game relaunch, not a code change), and every "game" logged since
then is fabricated.

**Damage done, concretely:** `recentGames` (capped at 100) is now 100%
fake entries — `recentWinRate` and the opening-move stats derived from it
are meaningless until 100 real games flush the window. The lifetime
`gamesPlayed`/`wins` counters (persisted, survive restarts) are now
inflated by however many fake iterations ran before this was caught —
tens of thousands by the time anyone looks, since it's accumulating ~1/sec.

**Fix, not yet applied — needs a live restart, which this session can't do
unsupervised:** relaunch `ipvgo_player.js` with the correctly-cased
`"Slum Snakes"` argument (and confirm 9×9 is actually the intended/unlocked
size — nothing on record shows anyone deciding to move off 7×7). Whoever
restarts it should also decide whether to hand-correct the polluted
`gamesPlayed`/`wins` lifetime counters in `ipvgo_status.json` before the
next launch, or accept the inflated lifetime number as a known blemish.
**Separately worth fixing in code** (not done this session — root cause was
enough to explain the symptom, didn't want to touch a live-tunable script
without sign-off): `resetBoardState`'s error shouldn't be indistinguishable
from every other caught exception in that loop — a failed reset is a stuck
game, not a transient hiccup, and deserves its own loud signal (event/
invariant, not just a swallowed `tprint`) instead of retrying silently
once a second forever.

**Not touched this session:** `docs/status-dashboard.html` — it still shows
the last genuine numbers (82%, 7×7, 96 games) and was deliberately left
alone rather than overwritten with the fake 98%/9×9/11,700-games figures.

## 2026-08-12 (latest, confirmed): Darknet status-file clobbering fix — live-verified fixed

Ken ran the full sequence (`dnet_killswarm.js`, `dnet_deploy.js`,
`dnet_status_merge.js`, `dnet_creds_merge.js`, `dnet_loot_merge.js`).
Pulled `dnet_status.json` twice, 8 seconds apart: `deployer`, `credsMerge`
(586 cracked), and `loot` (71 hosts, karma spent, caches opened) were all
present both times, with `deployer.pass` climbing 200→201 in between —
proof the swarm kept heartbeating through the window without erasing
anything. That's the actual regression test for the bug Ken hit
(`credsMerge`/`loot` vanishing within seconds of being merged), not just a
one-off snapshot. **Confirmed fixed.**

## 2026-08-12 (latest): Darknet status-file clobbering fix — deployer heartbeat sharded like credentials/loot, not yet run live

Ken ran `dnet_creds_merge.js` and `dnet_loot_merge.js` on `home` to
populate `dnet_status.json`'s `"credsMerge"`/`"loot"` sections. They ran
clean, but moments later `home`'s `dnet_status.json` only had a
`"deployer"` key again — the merge output was gone. Root-caused by reading
the actual code and `NetscriptDefinitions.d.ts` directly, not guessed:

- `ns.write`/`ns.read` only ever operate on the calling script's *current*
  host — no remote-host parameter exists.
- Every roaming `dnet_deploy.js` instance's `mergeStatus()` call was safe
  (a real read-merge-write) but only against its own **local**
  `dnet_status.json`, which only ever has a `"deployer"` key. It then
  called `shipStatus()`, which did `ns.scp(STATUS_FILE, "home")` — a raw
  whole-file copy, not a merge. Whichever instance's `scp` landed on home
  last silently overwrote home's entire file, erasing `credsMerge`/`loot`.
  With many concurrent instances heartbeating every pass, this window is
  seconds.

**Fix — the same shard-then-merge pattern this repo already uses for
credentials and loot, applied to the deployer heartbeat:**

- `dnet_lib.js`: generalized `shardName()` to take an explicit
  prefix/suffix (default unchanged, so every existing caller is
  unaffected); added `DEPLOYER_SHARD_PREFIX`/`DEPLOYER_SHARD_SUFFIX`
  (`dnet_deployer_`/`.json`), `writeDeployerShard()` (writes the heartbeat
  to a uniquely-named local shard), `shipShard()` (generic scp-to-home
  primitive; `shipCred` is now a thin wrapper over it), and
  `pickFreshestShard()` (pure "which heartbeat wins" policy, unit-tested).
  Removed `shipStatus()` — it was the unsafe raw-whole-file-copy primitive
  this fix eliminates; keeping it around would just invite the same bug
  again later.
- `dnet_deploy.js`: `writeDeployerStatus()` now calls
  `writeDeployerShard()` + `shipShard()` instead of `mergeStatus()` +
  `shipStatus()`. Safe by construction — unique filename per host means
  concurrent `scp`s from different roaming instances can never collide.
  Same RAM cost as before (`ns.write`/`ns.read` are 0GB either way, and
  `scp` was already paid for via `shipCred`), not cheaper, just correct.
- **Deliberately did NOT** add shard-assembly logic (e.g. `ns.ls`) inside
  `dnet_deploy.js` itself — Bitburner's RAM cost is static per script
  (whatever functions the code *references*, not which branch runs), so
  that would raise `dnet_deploy.js`'s RAM footprint on every host it runs
  on, including the RAM-constrained ones the Phase 3b fallback (below) was
  just built to help. Would have been a regression on the exact axis Phase
  3b improved, in the same session.
- New script `dnet_status_merge.js` (home-only, run by hand like
  `dnet_creds_merge.js`/`dnet_loot_merge.js` already are): reads every
  `dnet_deployer_<host>.json` shard, picks the freshest by `ts`
  (`pickFreshestShard`), and folds it into `dnet_status.json`'s
  `"deployer"` section via the now-always-home-only `mergeStatus()`.
  `--prune`/`--quiet` flags, same convention as the other two merge
  scripts.
- **Design decision — freshest shard wins, not a network-wide aggregate.**
  Many roaming instances each report a genuinely partial, overlapping
  view (already labelled as such before this fix); summing their counts
  across shards would double-count overlap with no way to detect it.
  Freshest-wins keeps `"deployer"` showing exactly what it always showed
  before — one instance's live heartbeat — just without the risk of
  vanishing seconds later. Smaller, more conservative change than building
  real aggregation. Full reasoning: `docs/darknet-tactics.md` §8.
  `dnet_creds_merge.js`'s `"credsMerge.totalCracked"` remains the one
  genuinely network-wide number (merges by host key, so overlap collapses
  naturally rather than accumulating).

**Full mechanism write-up:** `docs/darknet-functions.md`'s 2026-08-12
"status-file clobbering fix" section.

**Verification done this session:** `node --check` on every touched file.
`node --test *.test.js`: **85/85 passing** (up from 78) — 7 new tests
(`shardName`'s generalized prefix/suffix + escaping, `pickFreshestShard`'s
selection policy including the empty/tie/single-shard edges).

**What a live check needs to confirm, since nothing here could run in the
game this session:**

1. `dnet_killswarm.js` then a fresh `dnet_deploy.js` restart — Bitburner
   doesn't hot-reload, so every currently-running instance is still
   executing the old unsharded code and will keep clobbering
   `dnet_status.json` until replaced.
2. After the restart, confirm `dnet_deployer_<host>.json` shards actually
   land on home (`ls dnet_deployer_`).
3. Run `dnet_status_merge.js` once, confirm `dnet_status.json`'s
   `"deployer"` section is populated again, then re-run
   `dnet_creds_merge.js`/`dnet_loot_merge.js` and confirm `"credsMerge"`/
   `"loot"` **still have values afterward** — the actual regression test
   for the original bug report.
4. This session worked in an isolated agent worktree (see
   `docs/kensTodo.md` for the sync-gap flag) — the pushed commit needs a
   plain `git pull` into the daemon-watched checkout at
   `/Users/Shared/BitBurner` before any of the above can happen live.

## 2026-08-12: Darknet Phase 3b — quantified the RAM-fit skip, built a lean loot fallback, not yet run live

Picked up the Phase 3 handoff checkpoint (below, "Darknet Phase 3 (loot)").
Two things confirmed real before touching code, per this repo's own
diagnosis discipline:

- Ken's own `mcp_money.js` panel: **$362M in `darknet`-category income
  since the last augmentation install**, via `ns.getMoneySources()`'s own
  category breakdown — the system genuinely pays out, not a hypothesis.
- A `dnet_status.json` pull this session (deployer instance on
  `meg4c0rp`) showed `sinceProcessStart: { cracked: 3, looted: 0,
  lootSkipped: { ram: 8 } }` — **100% of this instance's loot attempts
  skipped for insufficient free RAM**, the same bottleneck the Phase 3
  checkpoint diagnosed for `darkweb`, now confirmed on a second,
  independent host. So the real picture: money is flowing, but from
  whichever fraction of the net happens to have free RAM at the moment,
  while an unmeasured but real fraction of potential loot is silently
  skipped elsewhere.

**Quantified before designing anything**, per this task's own instruction
not to guess: read `dnet_loot.js`'s reachable ns calls against the RAM
table in `docs/darknet-functions.md`. Its own header comment claimed
~4.95GB; the actual reachable-call total is **5.55GB** — the comment had
simply omitted the `ns.scp(shard, "home")` call it ships its own report
with. `4.95 + 0.6 (scp) = 5.55` exactly, matching the live
`dnet_ramcheck.js` reading from the Phase 3 checkpoint. Not waste — every
one of the six calls does real work — so the fix isn't "shrink the
script," it's "have a cheaper script that does less."

**Built:**
- `dnet_loot_realloc.js` — new lean script, RAM-freeing only
  (`memoryReallocation`, gated on `getBlockedRam`), no cache-opening.
  Estimated ~3.35GB (arithmetic, not yet measured live). Chosen over a
  cache-only lean variant for two independent reasons that happen to agree:
  it's cheaper (drops `openCache`'s 2GB vs. `memoryReallocation`'s 1GB, so
  it reaches more RAM-constrained hosts), and it's the more valuable
  capability to keep per `darknet-strategy.md`'s own ranking (RAM recovery
  is durable capacity; cache money is explicitly "the least strategically
  interesting" payout, since `mcp.js` already generates that resource by
  other means). Full reasoning: `docs/darknet-tactics.md` §7.
- `freeBlockedRam` moved from a `dnet_loot.js`-local function into
  `dnet_lib.js` as a shared export, so `dnet_loot.js` and
  `dnet_loot_realloc.js` can't drift apart on the actual reallocation loop.
- `chooseLootMode(freeRam, fullRam, reallocRam)` — new pure function in
  `dnet_lib.js` encoding the fallback policy (full if it fits, else
  realloc-only if *that* fits, else skip). Unit-tested in new
  `dnet_lib.test.js` (11 tests: the policy boundaries, plus a regression
  test using the exact `darkweb`-at-handoff numbers — `freeRam=1.6` still
  correctly returns "skip" even against the new lower `reallocRam=3.35`
  floor — and 5 tests on the relocated `freeBlockedRam`'s stop conditions
  via a hand-built mock `ns`). Full repo suite: **76/76 passing**
  (`node --test *.test.js`), up from 65 at session start.
- `dnet_deploy.js`'s `lootDeploy()` now tries the full script, falls back
  to the lean one, and only reports `why: "ram"` if neither fits — and that
  skip line now prints the exact `freeRam`/`fullRam`/`reallocRam` inputs
  that produced the decision, per `CLAUDE.md`'s "log decisions, not just
  state" rule. `spread()` now carries both loot scripts so every deployed
  instance can make the same choice. `dnet_status.json`'s
  `deployer.thisPass.lootMode`/`sinceProcessStart.lootMode` now break out
  `{full, realloc}` counts. `dnet_loot_merge.js` reads a new `mode` field
  per shard so a merged "loot" section doesn't misread a realloc-only
  pass's `opened: 0` as "no caches found" when it actually means "not
  checked this pass."
- `node --check` clean on every touched file
  (`dnet_lib.js`, `dnet_loot.js`, `dnet_loot_realloc.js`, `dnet_deploy.js`,
  `dnet_loot_merge.js`, `dnet_lib.test.js`). A stray unused `CODE` import
  left behind in `dnet_loot.js` by the `freeBlockedRam` move, and a missed
  `lifetime.lootMode` accumulator in `dnet_deploy.js`'s per-pass tally
  (mirrored the existing `lootSkipped` loop but wasn't there for the new
  field), were both caught and fixed before commit, not left as follow-up.

**Honest limit, stated plainly rather than oversold:** this does not
rescue `darkweb` itself. Its own free RAM was measured at 1.6GB at the
Phase 3 handoff — below even the new 3.35GB lean-script floor, and a script
with zero further calls beyond Bitburner's fixed 1.6GB base is already
close to that ceiling, so no further RAM-diet on the loot side can fix that
specific host. If `darkweb`'s occupant-driven used-RAM is durably stuck
rather than fluctuating (the Phase 3 checkpoint's own still-open question),
the fix has to be upstream of this change (killing the occupant, or natural
churn). What this change *does* do is stop the flat, all-or-nothing skip
for every other host whose free RAM falls between roughly 3.35GB and
5.55GB — previously nothing, now at least a RAM-freeing pass with the
result reported.

**Full detail, RAM-table arithmetic, and the argument for dropping
`openCache` over `memoryReallocation`:** `docs/darknet-functions.md`'s new
"Phase 3b" section and `docs/darknet-tactics.md` §7.

**What a live check still needs to confirm (nothing here could execute
in-game — CLAUDE.md's standing constraint):**

1. Once this lands in the daemon-watched checkout and a fresh
   `dnet_deploy.js` restarts (Bitburner doesn't hot-reload), watch
   `dnet_status.json`'s `deployer.*.lootMode.realloc` for movement off
   zero — the direct signal the fallback is firing on a real host, not
   just passing in the unit tests.
2. Confirm `dnet_loot_realloc.js`'s actual RAM cost via the game's own
   readout (`ns.getScriptRam("dnet_loot_realloc.js", "home")` from a live
   terminal, or a `dnet_ramcheck.js`-style check) — the ~3.35GB estimate
   has the exact same "arithmetic, not measurement" risk that made the full
   script's own comment wrong by 0.6GB.
3. Watch whether `lootSkipped.ram` keeps climbing for `darkweb` specifically
   (expected) while slowing for the broader host population (the actual
   win condition for this change).
4. **Needs Ken's hand, added to `docs/kensTodo.md`**: pushing this commit
   and confirming it's live in the daemon-watched checkout at
   `/Users/Shared/BitBurner` (this session ran directly against that
   checkout, not an isolated worktree — confirmed via `git worktree list`
   before starting — so no separate pull step is expected this time, but
   worth Ken's one-line confirmation given the precedent from the 2026-08-12
   worktree/sync gap logged just below).

## 2026-08-12: `NUM_SIMULATIONS` 1500 → 6000, algorithm tag `v1` → `v2` — loss-margin diagnosis said search depth, not eye-awareness

Picked up from the rolling-window numbers accumulated since the
augmentation-install reset: over the last 100 games at 1500 sims/move, win
rate settled to ~81-82% (down from the 90%/70-game milestone logged above,
consistent with a fresh, smaller post-reset sample rather than a
regression). Pulled `ipvgo_status.json`'s `recentGames` and looked at the
loss margins specifically, not just the win/loss tally, before deciding
what to build: **16 losses total, only 1 is a whole-group collapse**
(blackScore=0, whiteScore=42.5 — the exact shutout signature from the
already-fixed 2026-08-11 eye-safety bug, so a stale one-off, not a new
pattern). **The other 15 are close, competitive losses**, margins 0.5 to
12.5 points on a 49-point board — the shape of a search that's evaluating
positions correctly but not deeply enough, not the shape of a structural
blind spot.

`docs/ipvgo-strategy.md`'s own "Open questions" section (item 7) already
states the criterion for when the expensive `getChains()`/
`getControlledEmptyNodes()` eye-awareness route is worth building: only "if
live results show the bot still losing to whole-group captures despite
Monte Carlo evaluation." 1/16 does not clear that bar. The doc's own
explicit next lever before reaching for a structurally different algorithm
is more simulations — so that's what this entry does, not new eye-shape
code.

- [x] Raised `NUM_SIMULATIONS` 1500 → 6000 (4×) in `ipvgo_player.js`.
  Justified by real headroom, not guesswork: live data at 1500 sims
  measured avg 261ms / max 307ms per move against `mcp.js`'s shared
  10-second tick budget — only ~3% of it used. MCTS's simulation loop is
  the dominant per-move cost, so timing should scale roughly linearly;
  6000 sims should land around 1000-1200ms/move, still comfortable.
  **Not yet confirmed live** — watch `avgMoveMs`/`maxMoveMs` in
  `ipvgo_status.json` once this runs and turn it back down if the real
  number comes in meaningfully above that estimate, same standing
  discipline as every prior `NUM_SIMULATIONS` change.
- [x] Bumped `ALGORITHM` `"mcts-ucb1-v1"` → `"mcts-ucb1-v2"` in the same
  file, for the same reason the `v1` bump itself was made: the 81-82%/
  100-game figure this diagnosis was measured against was produced
  entirely at the 1500-sim budget, so it needs to stay in its own rolling
  window rather than blend with the 6000-sim version's games —
  `loadPersistedStatus` resets `gamesPlayed`/`wins`/`recentGames` fresh the
  moment the tag doesn't match. Third algorithm-tag bump in this file's
  history for this exact reason.
- [x] Updated the reasoning comments above both constants in
  `ipvgo_player.js` in place (this repo's own verbose-comment style, citing
  the actual diagnosis numbers rather than asserting the change).
- [x] Did **not** touch board size (`ns.go.resetBoardState`) — that's the
  separate, explicitly-deferred decision from the "holding at 7x7" note
  above, out of scope here.
- [x] Did **not** build `getChains()`/`getControlledEmptyNodes()`
  eye-awareness — per the 1/16 diagnosis above, that's not the lever this
  data points at right now.
- [x] `node --check ipvgo_player.js` clean; `node --test *.test.js` still
  65/65 (this change only touches two constants and their comments in
  `ipvgo_player.js`, nothing in the tested `ipvgo_logic.js` surface).
- [x] Committed (`c33c13f`) and pushed to `origin/main`. `node --check`
  clean, `node --test *.test.js` 65/65 at that commit.
- [ ] **Not yet on the daemon's watched filesystem — a real gap found this
  session, not yet closed.** This work ran in an isolated agent worktree
  (a separate directory from `/Users/Shared/BitBurner` on disk, same repo
  history). `tools/bb_remote.py`'s daemon watches
  `/Users/Shared/BitBurner`'s files directly, not git refs — confirmed via
  `ctl-get /ipvgo_player.js` after pushing that it's still serving the old
  `NUM_SIMULATIONS = 1500`/`"mcts-ucb1-v1"` content, because that checkout
  hasn't pulled `c33c13f` yet. A worktree-isolated agent has no way to run
  `git` against that shared checkout to fix it (attempted, structurally
  refused) — **logged as a pending item in `docs/kensTodo.md`**: pull
  `origin/main` into `/Users/Shared/BitBurner`, then the daemon's own
  watcher should auto-push the file the normal way.
- [ ] Once that lands, **pushing a file still does not change what a
  currently-running script executes — Bitburner doesn't hot-reload.** The
  live process will still be running the 1500-sim `"mcts-ucb1-v1"`
  version, still accumulating its own record under that tag, until someone
  runs `run ipvgo_player.js` in the live terminal — needs Ken's hand, same
  pattern as every prior algorithm change logged in this file. Nothing
  needs to be rolled back in the meantime.
- [ ] Once it's running, watch `recentWinRate`/`recentGamesCount` under the
  new `"mcts-ucb1-v2"` tag build up before comparing it to the 81-82%
  figure above — don't call it off a handful of games, same standing
  discipline as always.

## 2026-08-12: `ipvgo_hud.js` — in-game panel instead of a scheduled dashboard refresh

Ken asked whether the status dashboard could refresh on a regular interval.
Walking through it: a cloud-scheduled routine can't reach `ipvgo_status.json`
at all (it's local-only, pulled by the daemon, gitignored — never on
GitHub), and even a local-bridge routine's 1-hour cron minimum isn't
"regular" for a game playing several games a minute. Ken's own
counter-suggestion, and the right one: an in-game scoreboard instead — no
refresh problem if it's just reading the file live.

- [x] Built `ipvgo_hud.js`, same shape as `mcp_hud.js` (reads
  `ipvgo_status.json`, self-supersedes, stacks at `y=850` below
  `mcp_hud.js`/`mcp_money.js`/`mcp_stocks.js`). `node --check` clean.
- [x] Added to `tools/bb_remote.py`'s `WATCHED_FILES` (30 → 31).
  `python3 tools/bb_remote.py selftest` passes (20 checks).
- [x] Documented in `docs/processes.md` alongside the other HUD panels.
- [ ] **Needs the daemon process restarted** to pick up the new
  `WATCHED_FILES` entry — it's a static Python list read once at daemon
  startup, same "doesn't hot-reload" story as the game side. The live
  connection also happens to be down right now (dropped again at 17:41:26,
  `close_code=1006`, same intermittent class of drop as before, unrelated
  to this work) — asked Ken before restarting, since a prior instruction
  this session was explicit: don't restart the daemon without being asked.
- [ ] Once the daemon's back up and synced, `run ipvgo_hud.js` once in the
  live terminal to open the panel (self-supersede makes future re-runs, if
  ever needed for repositioning, safe).

## 2026-08-12: Darknet Phase 3 (loot) — inline fix live, swarm restarted, darkweb currently RAM-blocked (handoff, session ending)

**Checkpointed mid-flight — Ken shutting the session down.** Read this
section first if resuming darknet work. Short version: the code is right
and pushed; getting past `darkweb`'s current RAM situation is the open
question, not a bug to fix.

**What's done, committed, and pushed to `origin/main`:**
- `e74762f` — `dnet_deploy.js` now scp+execs `dnet_loot.js` onto every
  neighbour the instant `acquireSession` confirms a session, instead of
  relying on `dnet_loot_all.js`'s separate batch pass (which came back
  0/103 looted live — most previously-cracked hosts are offline again by
  the time a later pass checks). Fixed two RAM-fit bugs finding this:
  `spread()` wasn't carrying `dnet_loot.js` onward at all, and the RAM
  check used `getServerMaxRam` alone (total) instead of
  `getServerMaxRam - getServerUsedRam` (free) — the second one is exactly
  what's biting `darkweb` right now, see below.
- `403228b` — Ken's own fix to `dnet_loot_all.js`'s RAM check (read a field,
  `maxRam`, that doesn't exist on `DarknetServerDetails`).
- `25f1501` — `dnet_killswarm.js` added: kills every `dnet_deploy.js`/
  `dnet_loot.js` process on every known host (`dnet_creds.txt`) + `darkweb`,
  so a fresh, fixed-code deployer can replace old-code occupants that
  `preventDuplicates` would otherwise block forever (Bitburner doesn't
  hot-reload). Hand-tested with mocked `ns` before running. **Run live**
  (this session, via CDP terminal-write): touched 5/104 known hosts (99 were
  already offline — consistent with the "cracked once ≠ online now" finding
  above), killed 5 old processes, one of which was on `darkweb` itself.
- `dnet_ramcheck.js` — new one-off diagnostic (`maxRam`/`usedRam`/`freeRam`/
  `blockedRam` for a host + whether `dnet_loot.js` fits), added and
  committed in this same checkpoint so it isn't a mystery untracked file.

**What's mid-flight, exactly:** a fresh `dnet_deploy.js` (no `--once`, pid
22200 as of this checkpoint) is running on `home` and looping normally —
**this is a safe, intended, non-broken state**, not a half-killed one. It
has *not* yet managed to spread onto `darkweb` or beyond: `dnet_status.json`
showed `deployed: 0` across 11 consecutive passes, every one correctly
reporting `lootSkipped.ram` (not silently failing — that's the point of the
earlier fix). `dnet_ramcheck.js darkweb` confirmed why: `maxRam=16,
usedRam=14.4, freeRam=1.6, blockedRam=0` — `dnet_loot.js` needs ~5.55GB and
even a fresh `dnet_deploy.js` copy (~4.8GB) doesn't fit in 1.6GB free.

**Real numbers as of this checkpoint (all still zero, honestly reported,
not a bug):** `dnet_status.json`'s `"loot"` section: `hostsLooted: 0`,
`totalRamFreed: 0`, `totalCachesOpened: 0`, `totalKarmaSpent: 0`.
`credsMerge.totalCracked: 103` (unchanged by this session's work, that's
from before). Only 5 of the 103+1 known hosts were reachable at all when
`dnet_killswarm.js` ran — the darknet's continuous churn means most
previously-cracked hosts are genuinely offline most of the time, which is
also why `dnet_loot_all.js` never worked as a standalone batch tool.

**Open question, not yet answered — this is the actual next step:** is
`darkweb`'s 14.4GB "used" a fluctuating thing (background/simulated load
that might free up on its own) or something durably stuck there? `blockedRam:
0` rules out the "needs memoryReallocation" explanation. Killing the one
old `dnet_deploy.js` process there (~4.8GB) did **not** bring `freeRam`
above the ~1.6GB seen post-kill, which is a real, slightly uncomfortable
finding worth sitting with rather than glossing over: it's possible
`darkweb` simply doesn't have room for a resident script most of the time,
and the old occupant that *was* there got lucky on timing when it first
spread, back when free RAM happened to be higher. **Next concrete step:**
re-run `run dnet_ramcheck.js darkweb` from `home` after some real time has
passed to see if `usedRam` moved on its own; if it drops enough, the
already-running fresh `dnet_deploy.js` on `home` will pick up the spread
automatically on its next pass with no further action needed (it retries
every pass, no `--once`). If it never drops, the next real question is
where that 14.4GB is coming from — not guessed at here, deliberately, since
that's exactly the kind of thing worth reading source for rather than
speculating.

**Live game state confirmed safe at handoff:** `mcp.js`, `ipvgo_player.js`,
and the `bb_remote.py` daemon (port 12526/12527, connected) are all running
normally, untouched by any of this. The darknet crawl is running (not
stopped, not erroring) — it's just currently unable to spread past
`darkweb` for a RAM reason it now correctly reports rather than hiding.

## 2026-08-11: IPvGO player built, needs one live run

Ken asked to "put a man on the IPvGO game." Built as a new, separate
subsystem — doesn't touch `mcp.js`/the money loop. Full design, API
citations, and reward-structure notes: `docs/ipvgo-strategy.md`.
`docs/processes.md` has the short map entry.

- [x] Read the full `Go`/`GoAnalysis`/`GoCheat` API in
  `NetscriptDefinitions.d.ts` (~5143–5715). Confirmed `ns.go.cheat` needs
  SF14.2 (Ken has neither that nor SF4); base `ns.go` carries no Source-File
  gate at all.
- [x] Read the in-game "How to Play" tab and the in-game "Automating IPvGO"
  documentation page live over CDP — got the real reward structure (area
  scoring, komi, stat-multiplier bonuses for territory held regardless of
  win/loss, favor on a two-win streak against a faction you're a member of)
  and the exact starter-script logic Bitburner's own docs walk through.
- [x] Confirmed live there's already a game in progress (7x7, Netburners,
  Black 21/White 25.5) — `ipvgo_player.js` is built to continue it, not
  discard it, on first run.
- [x] Built `ipvgo_player.js` at repo root: capture > defend > expand >
  random-with-airspace > anything-valid > pass, self-supersede, defensive
  Go-API-availability check. `node --check` passes.
- [x] **Pushed and run** — confirmed live, RAM measured at 34.45GB (vs.
  ~33.6GB arithmetic estimate). See the 2026-08-11 diagnosis section below
  for what the first ~22 games actually looked like (1 win) and the fix
  that came out of watching them.
- [x] Checked `ns.getPlayer().factions` (read live via the Factions page
  over CDP this session): Ken **is** a member of Netburners (112.491 favor,
  no augmentations left to buy), so the two-wins-in-a-row favor payout
  against the current default opponent is live/relevant, not moot.
  **confirmed live.**

Claude's own granular task list, session to session. Read this first at the
start of every session; update it as you work — check items off, add new
ones the moment they surface, don't let it go stale.

Distinct from the other two lists:
- `docs/kensTodo.md` — only things that need Ken's physical hand (a click,
  a download, an in-game action).
- `docs/process-backlog.md` — engineering-improvement ideas for the mcp
  loop itself, argued and reasoned, not task-tracked.
- This file — Claude's own multi-step work, flat and checklist-style like
  `kensTodo.md`, kept current rather than written once and left.

---

## 2026-08-11 (later): IPvGO diagnosis — found the collapse cause, fixed it, deploy blocked on an unrelated daemon bug

Ken asked directly whether anyone was watching/revising the IPvGO results.
Record at the start of this session: `ipvgo_status.json` showed 0 wins
across the first several games, some near-total shutouts (e.g. black 0 vs
white 49.5 on 7x7 — 49 total points on the board). Task was to find out
whether that's a real bug or just weak-but-working heuristic play, per this
task's own instructions: watch real games (not just re-read the strategy
doc), question the scoring assumptions first, then look for a structural
bug in `pickMove`/`findCaptureMoves`/`findDefendMoves`/`findExpandMoves`
before assuming the heuristic just needs to be smarter.

**Scoring/color assumptions: confirmed correct, not the problem.**
Watched the live IPvGO Subnet page directly over CDP (`document.body.innerText`
after clicking the nav item, several times across one game) and compared
its own displayed `Score: Black: N White: M` line against
`ns.go.getGameState()`'s `blackScore`/`whiteScore` as logged in
`ipvgo_status.json` and the terminal tail — they match exactly, and the
color assignment is stable (always Black, never flips). **confirmed live.**
Also confirmed live: Ken **is** in Netburners (112.491 favor, `ns.getPlayer
().factions` question from the strategy doc's "Open questions" — settled).

**The real finding, watching an actual game evolve:** polled the live board
several times across ~30 seconds and saw black's score go 23 → 29 → 13 → 6
→ 2 while white climbed steadily to 45.5 — a *solid mid-game lead
collapsing to a near-total shutout within the same game*, not a slow bleed.
Pulling the script's own `ns.print` move log (via the in-game tail window,
read over CDP — Active Scripts → ipvgo_player.js → LOG) showed why:
`findExpandMoves` (the move type that dominates most of the game, since
capture/defend are rare) had **zero liberty-safety checking** — it accepted
any move that touched *any* friendly stone, with no regard for the
resulting shape, unlike `findDefendMoves`, which only fires (and only after
a safety check) once a chain is already at exactly 1 liberty. The
consequence: every one of the bot's stones merges into one single connected
network with one shared liberty pool and no separate eye shapes — exactly
the "eyes" gap the strategy doc's own "next steps" already flagged as not
yet built. A single blob with no eyes is unconditionally capturable once an
opponent finds the vital point, and when it goes, **every stone on the
board goes with it in one move** — which is exactly the shutout shape in
`ipvgo_status.json` (0 vs 49.5, 2 vs 45.5, etc. — 22 games played, 1 win by
the time this was checked). **confirmed live** (the CDP score trace) +
**derived** (the single-network mechanism, reasoned from the move log +
the game's own documented capture rules, not directly observed as a single
board-state diff).

**Fix applied** (`ipvgo_player.js`): extracted `findDefendMoves`' own
"is this extension instantly recapturable" check (2+ empty neighbors of its
own, or a link to a different friendly chain with 3+ liberties — the
in-game doc's own logic) into a shared `isSafeExtension` helper, and
applied it to `findExpandMoves` too: safe extensions are preferred, and a
risky one is only played if literally nothing safer touches a friendly
chain (so nothing is lost versus before — a risky move that was the only
candidate is still offered, just deprioritized when a safer one exists).
This is the free half of "give the bot some life-and-death sense" — it
doesn't build real eye-shape awareness (that still needs
`getChains()`/`getControlledEmptyNodes()`, 16GB more RAM apiece, unbuilt),
but it stops the bot from volunteering the thin, easily-cut connections
that make one-shot total collapse likely in the first place.

**Tests**: `ipvgo_player.test.js` (`node --test ipvgo_player.test.js`, 16
tests, all pass) — covers `findCaptureMoves`, `findDefendMoves`,
`isSafeExtension`, `findExpandMoves` (including the specific
prefers-safe-over-risky and falls-back-when-nothing-safer cases), and
`pickMove`'s priority order, all against small hand-built boards using the
real `board[x][y]` convention. Kept in the *same* file as the pure
functions (just added `export` to each) rather than splitting into a
separate `ipvgo_logic.js` the way `mcp.js`/`mcp_logic.js` split — see the
deploy-blocker note below for why a second watched file wasn't practical
this session. `node --check ipvgo_player.js` and the full repo test suite
(`node --test *.test.js`, 46 tests) both pass.

**Deploy is blocked on a separate, unrelated, already-live daemon bug —
found while trying to push this fix.** `tools/bb_remote.py`'s
`RemoteApiServer` used the `websockets` library's default `max_size` (1MB).
`mcp_status_log.txt` (a `PULL_FILES` entry, gitignored, grows without bound
per this repo's own long-standing warning on that file) crossed 1MB during
this session, and pulling it doesn't just fail that one `getFile` call —
**it kills the entire connection** (`ConnectionClosedError: sent 1009
(message too big)...`), which then loops forever: reconnect → push resync
(sometimes completes, sometimes dies partway through depending on how the
concurrent push/pull tasks interleave) → die on the oversized pull →
reconnect again. **Fixed in code**: `tools/bb_remote.py` now passes
`max_size=20*1024*1024` to `websockets.serve` (a new `WS_MAX_SIZE`
constant). **This fix cannot take effect without restarting the daemon
process** (Python doesn't hot-reload any more than Bitburner does), and
this session's sandbox auto-mode classifier blocked the `kill` command
needed to restart it ("Blocked by classifier" — a process-kill guard, not
something to work around). The already-running daemon (pid was 95448 at
session start, cwd `/Users/Shared/BitBurner`, started via `python3
tools/bb_remote.py daemon --port 12526 --control-port 12527`) is still
running the old code and will keep crash-looping on every reconnect until
someone with permission to kill it restarts it with the same command.
- [ ] **Needs a human/parent-conversation action**: kill the existing
  `bb_remote.py daemon` process and relaunch it (same command as above, from
  repo root — it self-explains its own flags with `--help` if the exact
  invocation needs double-checking). Once it's back up and *stays* connected
  (check with `python3 tools/bb_remote.py ctl-status --control-port 12527`
  — `"connected": true` and no repeated DISCONNECTED lines in
  `tools/bb_remote_events.log`), the already-committed, already-tested
  `ipvgo_player.js` fix will push automatically on the next reconnect (it's
  already in `WATCHED_FILES`) — no extra step needed for the push itself.
- [ ] **Then**, get the fix running in-game: `run ipvgo_player.js` in the
  live terminal (self-supersede logic in the script kills the old running
  copy automatically) — either via the CDP terminal-write technique (see
  `docs/processes.md`'s IPvGO entry and this file's earlier IPvGO section
  for the exact steps already proven working this session for reading, if
  not yet for writing) or Ken typing the one line himself.
- [x] **Watched a handful of games** — `ipvgo_status.json` showed 5
  games / 3 wins under the self-atari-fixed heuristic, most recently a
  45-1.5 win (vs. the pre-fix 1-in-22 record). Real signal the fix worked,
  too small a sample to call a rate — and superseded before a bigger sample
  accumulated by the 2026-08-12 rewrite below (Ken's own next ask: a real
  cited algorithm, not another heuristic patch).
- [x] Eye-shape awareness (`getChains()`/`getControlledEmptyNodes()`) —
  superseded, not built: the 2026-08-12 Monte Carlo rewrite addresses the
  same problem (evaluating whether a group survives) more generally, via
  actual simulated outcomes, without the extra 16GB+16GB RAM. See below.

## 2026-08-12 (later): MCTS/UCB1 + opening-move learning — CHECKPOINT, session ending

**Read this section first if picking this up cold — it's a mid-session
checkpoint, not a finished/verified state.** Ken is shutting this session
down shortly; the coordinator asked for an explicit checkpoint rather than
waiting for a natural stopping point. Everything below is committed,
locally tested, and pushed to the game's filesystem, but **has not been
started with `run ipvgo_player.js`**, so the live game is completely
unaffected so far — see "Live game state right now" below.

**Why this round happened**: after the flat Monte Carlo rewrite (see the
section right below this one) ran live, the coordinator relayed real
numbers: 61 games, 41% rolling win rate (real progress from ~0% under the
old heuristic, but well short of 90%), and — the key finding — huge unused
timing headroom (avg 52ms, max 164ms per move). Two upgrades were
requested, in priority order: (1) upgrade flat Monte Carlo to real tree
search (MCTS with UCB1), the bigger lever; (2) add simple cross-game
learning on top (track which opening moves have actually correlated with
wins, bias toward those). Both are built.

**What's built and tested (33 new tests since the flat-MC state, 63 total
passing, `node --test *.test.js`; `node --check` clean on all three
files)**:

1. **MCTS with UCB1** (`ipvgo_logic.js`, `chooseBestMove` rewritten in
   place — its old flat-MC implementation and `evaluateMove` are gone,
   superseded, not kept alongside). Cites Kocsis & Szepesvári, "Bandit
   Based Monte-Carlo Planning" (ECML 2006,
   https://link.springer.com/chapter/10.1007/11871842_29) — the original
   UCT paper. Spends a shared simulation budget (`NUM_SIMULATIONS = 1500`
   in `ipvgo_player.js`) across a real search tree instead of splitting it
   evenly across every candidate move the way flat MC did. Backpropagates
   a win/loss indicator (not the old raw score margin) specifically so
   UCB1's textbook `C = sqrt(2)` constant is actually well-founded (margins
   aren't bounded to [0,1], win/loss is). **Komi is now threaded through
   explicitly** (`ns.go.getGameState().komi`, read fresh each move) for
   deciding win/loss during backpropagation — the flat-MC version silently
   never applied komi at all, which would have overrated Black in close
   games; this is a real correctness fix, not just an MCTS feature.
2. **Opening-move learning** (`computeOpeningMoveStats` in
   `ipvgo_logic.js`): builds a win-rate-per-first-move table from
   `ipvgo_status.json`'s `recentGames` (which now also records each game's
   `openingMove`). Only applied when a move has at least
   `DEFAULT_MIN_OPENING_SAMPLE` (5) recorded games — below that, no bias is
   applied, and this is genuinely enforced in code, not just a comment.
   Implemented as a "virtual visits" prior seeded into the relevant root
   tree node at the moment it's created (only ever at the true opening move
   of a fresh game, detected via `ns.go.getMoveHistory().length === 0`) —
   modeled on (a much simpler version of) Gelly & Silver, "Combining Online
   and Offline Knowledge in UCT" (ICML 2007,
   https://ai.dmi.unibas.ch/research/reading_group/gelly-silver-icml2007.pdf).
   **Will show zero effect for a long while after this deploys** —
   `recentGames`' rolling window resets fresh for this algorithm tag (see
   below), so `gamesWithOpeningData` starts at 0 and only grows from games
   played *after* this version actually starts running. This is the
   correct, honest behavior, not a bug — surfaced directly in
   `ipvgo_status.json`'s new `openingStats` field so nobody mistakes "not
   enough data yet" for "feature broken."
3. **`ALGORITHM` bumped to `"mcts-ucb1-v1"`** (from `"monte-carlo-flat-v1"`)
   in `ipvgo_player.js` — per the same "don't blend algorithm generations
   into one rolling-window number" logic already established for the prior
   rewrite. This means `recentGames`/`gamesPlayed`/`wins` all start fresh
   again the moment this version actually runs; the flat-MC 61-game/41%
   record stays in `ipvgo_status.json`'s history conceptually but won't mix
   into this version's own numbers.

**Two real bugs found and fixed during this session's own review, before
anything was pushed** (both would have been silent/subtle if missed —
exactly the class of bug this repo's own diagnosis discipline warns
about):
- A missing ko-bar check: `nonRootCandidateMoves` (used when the tree
  expands into a *simulated* future position, not the real root move) was
  calling `analyzeMoves` without passing that position's `koIndex`,
  meaning the simplified ko rule was silently not enforced anywhere except
  at the very root. Fixed by threading `koIndex` through properly.
- A stale `NUM_PLAYOUTS` reference left in `ipvgo_player.js`'s startup
  `ns.tprint` line after the constant was renamed to `NUM_SIMULATIONS` —
  would have thrown `ReferenceError: NUM_PLAYOUTS is not defined` as an
  **uncaught exception at startup**, outside the main loop's try/catch,
  the moment the script was run. `node --check` does not catch this class
  of bug (undefined-variable references are a runtime concern, not a
  syntax one) — only caught by manually grepping for stale symbol names
  after the rename, which is now worth doing as a standard step after any
  rename in this codebase, not just this once.
- Also caught (via `node -e` integration testing, not unit tests): a
  variable-aliasing bug where `chooseBestMove`'s returned `evaluated` count
  always came back as `0` regardless of how many moves were actually
  considered, because `root.untriedMoves` and the candidate-count array
  were the *same object*, and the search mutates it via `.pop()` as it
  runs — reading its `.length` *after* the search reports "how many are
  left unexpanded" (usually 0), not "how many there were." Fixed by
  capturing the count before the search loop runs; **covered by a new
  regression test** (`ipvgo_logic.test.js`, "reports the real candidate
  count in `evaluated`...") specifically because this is exactly the kind
  of bug that "looks fine" (the chosen move was still correct throughout —
  only the metadata was wrong) and would otherwise have silently corrupted
  the `evaluated` field in every live log line and could have looked like
  a real signal to a future session trying to diagnose something else.

**Live game state right now**: unaffected. `ipvgo_player.js`/
`ipvgo_logic.js` have been pushed to the game's filesystem via `ctl-push`
(confirmed via round-trip `ctl-get`), but **pushing a file does not change
what a currently-running script executes** — Bitburner doesn't hot-reload
(CLAUDE.md's own standing note). The live process is still running the
flat-MC version from earlier this session, still accumulating its own
61+-game record under `"monte-carlo-flat-v1"`. Nothing needs to be rolled
back.

**The exact next step, when someone's ready to actually try this version**:
`run ipvgo_player.js` in the live terminal (self-supersede kills the old
running copy automatically — no other action needed). Needs a human or a
CDP-capable session; this session had no browser/CDP connection to the
actual running game to do it directly. After that:
- Watch `ipvgo_status.json` (`cat` or `python3 tools/bb_remote.py ctl-get
  /ipvgo_status.json --control-port 12527`) for `recentWinRate`/
  `recentGamesCount` under the new `"mcts-ucb1-v1"` tag — don't compare it
  to the old 41% until a real sample accumulates, same standing discipline
  as always.
- Specifically check `moveMs`-related fields (`lastResult.avgMoveMs`/
  `maxMoveMs`) early — 1500 simulations/move is a real increase over the
  flat-MC version's budget, profiled locally at ~250ms worst-case but
  **not yet confirmed live**. If it's climbing uncomfortably close to
  mcp.js's own 10-second tick cadence, turn `NUM_SIMULATIONS` down in
  `ipvgo_player.js` (currently 1500).
- Once enough games accumulate, `openingStats.gamesWithOpeningData` in
  `ipvgo_status.json` shows whether the opening-move learning layer has
  enough data yet to mean anything — expect it to read as "not enough
  data" for a good while, that's the correct, honest state, not a failure.
- If the sample says still short of 90%, the next lever discussion should
  start from real MCTS-era numbers, not the flat-MC 41% — a fair
  comparison needs the new algorithm's own real sample.

**Not done, explicitly deferred, not started**: no further algorithm work
beyond what's described above. `docs/ipvgo-strategy.md`'s "2026-08-12
(later): flat Monte Carlo -> MCTS" section (to be written/expanded next,
after this checkpoint) should get the same citation-and-rationale treatment
the flat-MC section got — this claude-todo.md entry is the accurate,
detailed record in the meantime if that doc section lags behind.

- [x] Researched and cited MCTS/UCB1 (Kocsis & Szepesvári 2006) and the
  opening-prior technique (Gelly & Silver 2007).
- [x] Implemented, with 33 new tests (63 total passing) and two real bugs
  caught and fixed during review (ko-bar omission, stale-symbol
  `ReferenceError`) plus one caught via manual integration testing and
  covered with a new regression test (evaluated-count aliasing bug).
- [x] `node --check` clean on `ipvgo_player.js`, `ipvgo_logic.js`,
  `ipvgo_logic.test.js`.
- [x] Pushed to the game's filesystem via `ctl-push` (inert until run —
  live game unaffected, still running flat-MC).
- [x] **Ken ran `run ipvgo_player.js` in the live terminal 2026-08-12
  ~17:39 PDT.** Confirmed via `ctl-get /ipvgo_status.json`:
  `algorithm: "mcts-ucb1-v1"`, so MCTS/UCB1, opening-move learning, and the
  root-level eye-safety fix are all active together — this was one restart
  picking up three rounds of uncommitted-then-committed work at once.
- [ ] **Measure a real sample** — early read only, not a verdict: 6/7 wins
  (streak of 5) moments after restart. Nowhere near enough games to call a
  rate; watch `recentWinRate`/`recentGamesCount` under `"mcts-ucb1-v1"` as
  it grows, same standing discipline as every prior round. Ken's own
  visual read watching it play, separately: "looks like sensible go play
  to me now."
- [x] **Checked `avgMoveMs`/`maxMoveMs` live**: 340.8ms avg / 674ms max on
  the first recorded game — comfortably under `mcp.js`'s 10-second tick
  budget, no need to lower `NUM_SIMULATIONS` (1500) yet.
- [ ] Update `docs/ipvgo-strategy.md` with a full MCTS/opening-learning
  section (citations, design, limitations) mirroring the flat-MC section's
  own treatment — this claude-todo.md entry has the real content already,
  that doc just needs the equivalent writeup for its own audience/format.

## 2026-08-12 (later still): root-level eye-safety fix — a real bug, not a game irregularity

Picked back up from the checkpoint directly above (which stayed uncommitted
until this entry — committed together). Before resuming, Ken flagged
something he'd watched happen live: Black held the majority of the board in
a recent game, then filled both of its own eyes and died. Asked whether
this could mean the game itself doesn't implement real Go rules (in which
case algorithm work would be pointless).

**Traced it in the code — it's not a host irregularity, it's a real bug in
`chooseBestMove`'s root move selection**, and it predates this session
(present in the flat-MC version too, just newly relevant now that a bigger
sample exists). `nonRootCandidateMoves` in `ipvgo_logic.js` already
excludes self-eye-filling points via `isSimpleEye` at every node in the
MCTS tree *except the root* — the root's candidate set was always exactly
`ns.go.analysis.getValidMoves()`'s raw grid, on the reasoning that this
guarantees the submitted move is always accepted by the live game. That
reasoning has a gap: if a group degenerates into one shared-liberty blob
with no true separate eyes (the exact 2026-08-11 collapse mechanism,
`docs/ipvgo-strategy.md`'s "What was actually wrong" section), the only
legal points left can be the group's own eye-shaped liberties, and with no
filter, MCTS has no signal telling it not to play there.

A second, related finding: `pass` (`ns.go.passTurn()`, confirmed legal and
already wired up) is only ever used when the board has *zero* legal moves
anywhere — never offered to MCTS as a real candidate to weigh against
filling your own last liberties. So even when passing would clearly be
better than shrinking your own group, the bot never considers it unless
literally cornered.

**Fix applied to `chooseBestMove`** (`ipvgo_logic.js`): filter the root
candidate set through the same `isSimpleEye` check `nonRootCandidateMoves`
already applies everywhere else. If that leaves at least one candidate,
MCTS runs over the filtered set only — self-eye-fills are never chosen
while any other legal move exists. If filtering empties the candidate set
entirely (every remaining legal move is a self-eye-fill), `chooseBestMove`
now returns `move: null`, the same signal used for "no valid moves at all"
— the caller (`ipvgo_player.js`) already passes in that case, no change
needed there. This can never cause an illegal move to be submitted (the
fallback is pass, not a forced bad move), and never narrows the candidate
set below one option unless every option was a self-eye-fill anyway.

Covered by 2 new tests in `ipvgo_logic.test.js` ("never fills its own true
eye at the root when a safe alternative exists", "passes rather than fill
its own eye when that's the only legal move left"), both against the same
hand-built true-eye board the existing `isSimpleEye` tests use. Full suite:
**65/65 passing** (`node --test *.test.js`), `node --check` clean.

**Pushed live** — confirmed via `ctl-get` round-trip that the game's own
copy of `ipvgo_logic.js` now contains this fix. **Not yet active**, same
reason as the MCTS checkpoint above: the running script instance is still
executing whatever it started with (still tagged `"monte-carlo-flat-v1"`
in `ipvgo_status.json`, 366 games / 161 wins ≈ 44% as of this session).
`run ipvgo_player.js` in the live terminal picks up both this fix and the
still-unstarted MCTS/opening-learning rewrite from the checkpoint above in
one restart (self-supersede handles killing the old instance).

- [x] Confirmed via code tracing this is a real algorithm bug, not a game
  rules irregularity — the game's own `getValidMoves()`/suicide-prevention
  match documented area-scoring Go rules; the bot just wasn't filtering its
  own root candidates for eye safety the way it already did everywhere else
  in the search tree.
- [x] Fixed `chooseBestMove`'s root candidate generation to exclude
  self-eye-fills (falling back to pass, never to an illegal or forced-worse
  move) — `ipvgo_logic.js`.
- [x] 2 new regression tests added, full 65-test suite passing.
- [x] Pushed live, round-trip confirmed via `ctl-get`.
- [x] Restarted by Ken 2026-08-12 ~17:39 PDT. All three rounds
  (MCTS/UCB1, opening-move learning, this eye-safety fix) now active
  together under `"mcts-ucb1-v1"`.
- [x] **The eye-fix moved the win rate, confirmed with a real sample.**
  6/7 minutes after restart grew to **41/47 (87%), streak 9 (best 12)** by
  ~18:00 PDT — a genuine jump from the old flat-MC 44&ndash;50% baseline,
  closing in on the 90% target. Ken's own live read while watching it
  play: "looks like sensible go play to me now." 47 games is a real
  sample, not a fluke-sized one, but still worth letting grow before
  calling 90% hit or missed outright.
- [x] **90% target hit.** Grew from 41/47 to **63/70 (90%), streak 18
  (new best, ties the game's own record)** by ~18:10 PDT — Ken's original
  ask ("find a good rudimentary go algorithm... goal 90% win rate, then
  move up to a larger board") is now genuinely, not just approximately,
  satisfied. Move timing held at 227&ndash;255ms avg / 289&ndash;302ms
  max the whole climb, comfortable headroom under the 10s tick budget.
- [ ] **Next: try a larger board**, per the strategy doc's own explicit
  ordering ("once 90% is genuinely demonstrated — not before"). Real
  open question raised in conversation, not yet answered: root branching
  factor scales with board area (7&times;7=49 points, 9&times;9=81,
  13&times;13=169 — sizes the game actually offers, no 19&times;19 here),
  but `NUM_SIMULATIONS` is a fixed 1500 regardless of board size, and the
  playout length cap (`W*H*2`) scales right along with area too — so the
  same simulation budget gets spread thinner *and* each simulation costs
  more wall-clock time on a bigger board. Expect the win rate to dip
  initially on size alone, not because anything regressed — worth
  measuring one size step at a time (7&rarr;9 before 9&rarr;13) rather
  than jumping straight to 13, and watching `avgMoveMs`/`maxMoveMs`
  closely since timing headroom is the thing most likely to actually
  constrain this. `NUM_SIMULATIONS` is the first lever to raise if the
  dip is real and doesn't recover on its own. Opening-move learning's
  table also resets fresh on a size change — same "zero data, not a
  bug" as every prior algorithm-tag change.
- [x] Asked Ken; decided to hold at 7x7 for now rather than switch
  boards — he's about to install 9 augmentations, which resets the game
  session on its own, and doing both at once would muddy any before/after
  comparison. Revisit the board-size question after the reset settles.
- [ ] **Expect after the aug install**: same Remote API reconnect click
  as every other disconnect tonight (the reset reloads the game), then
  `run ipvgo_player.js` again — its in-memory `gamesPlayed`/`wins`
  counters reset on any script restart, same as `mcp.js`'s, so the panel
  will read `0/0` briefly. The 90%/70-game result is already recorded
  here and on the dashboard, not lost by this.

## 2026-08-12: Monte Carlo rewrite — real cited algorithm, targeting 90% win rate

Ken's own ask, verbatim: **"find on the internet a good rudimentary go
algorithm to implement. Goal, 90% win rate, then move up to a larger
board."** Full research citations, algorithm design, and a documented
performance rewrite are in `docs/ipvgo-strategy.md`'s new 2026-08-12
section — this entry is the working-list version: what's done, what's
pending, and the exact next action.

**What shipped**: `ipvgo_logic.js` (new file) — a from-scratch local Go
rules engine (flood-fill capture/liberties, suicide prevention, a
simplified ko rule, area scoring, simple-eye detection) plus a flat Monte
Carlo move-selection algorithm (`chooseBestMove`/`evaluateMove`/
`runPlayout`), citing Bruegmann's GOBBLE (1993, the original Monte Carlo Go
program) and Bouzy & Helmstetter's Olga/Oleg as the specific published
precedent. `ipvgo_player.js` rewritten to be just the `ns.go` event loop
around it. 23 tests in `ipvgo_logic.test.js` (capture, suicide, ko, eye
detection, area scoring, and — the ones that validate the algorithm choice
itself — that Monte Carlo evaluation reliably prefers a real capture over a
self-atari move), all passing, plus the full repo suite (69 tests across
`node --test *.test.js`). `ipvgo_player.test.js` (the old heuristic's
tests) removed, mirroring the `mcp.js`/`mcp_logic.js` split's own
convention of testing only the pure-logic file. `tools/bb_remote.py`'s
`WATCHED_FILES` updated to include the new `ipvgo_logic.js`.

**Performance finding worth knowing about**: the first draft added a
capture-seeking bias to the random playout policy (a published refinement
that's generally stronger than pure-uniform rollouts). Profiling on an
empty 7x7 board found it took **multiple seconds per move** — a real risk
to the "don't starve the shared game loop" constraint, since move selection
runs synchronously on the same JS thread as the rest of the game and
`mcp.js`. Switched to rejection sampling for playout move selection, which
cut it to ~150-300ms/move at 10-40 playouts (a ~20-30x speedup) and, as a
side effect, ended up closer to Gobble's original (simpler) policy anyway.
Also RAM should be *lower* than before (~17.6GB arithmetic estimate vs. the
old 34.45GB measured), since `getLiberties()` (16GB) is no longer called —
all liberty/chain computation is local now. Neither number is confirmed
live yet — see next steps.

**Two follow-up asks arrived from the coordinator mid-task** (extending the
status-dashboard's IPvGO scoreboard) and were folded into the same
`ipvgo_status.json` schema pass:

1. Reward/streak fields, from `ns.go.analysis.getStats()` (0GB, official
   doc, persists across restarts): **`winStreak`, `highestWinStreak`,
   `favorRep`, `bonusPercent`, `bonusDescription`, `opponentLifetimeWins`,
   `opponentLifetimeLosses`**. Caveat flagged explicitly (not asserted as
   fact): `bonusPercent`/`bonusDescription`'s exact live meaning (whether
   it's really the territory-held stat-multiplier bonus) isn't
   independently confirmed by reading an actual live value yet.
2. A rolling last-100-games win rate, so the number isn't diluted by an
   older/weaker algorithm generation: **`recentGames`** (capped array of
   `{won, blackScore, whiteScore, ts}`), **`recentGamesCount`**,
   **`recentWinRate`**. Restart-safe (reads the existing file back on
   startup) but scoped to an `algorithm` tag (`"monte-carlo-flat-v1"`) so
   this rewrite's own window starts fresh rather than blending in the old
   heuristic's games — same dilution problem the window exists to solve.
   Also fixed a pre-existing bug this surfaced: `gamesPlayed`/`wins` used
   to reset to 0 on every script restart; now restart-safe via the same
   read-back mechanism, still scoped per-algorithm.

**Field names for the coordinator's dashboard wiring**, all top-level in
`ipvgo_status.json`: `algorithm`, `gamesPlayed`, `wins`, `recentGames`,
`recentGamesCount`, `recentWinRate`, `winStreak`, `highestWinStreak`,
`favorRep`, `bonusPercent`, `bonusDescription`, `opponentLifetimeWins`,
`opponentLifetimeLosses`, `opponent`, `size`, `lastResult` (now includes
`avgMoveMs`/`maxMoveMs`).

- [x] Researched and cited a real algorithm (see `docs/ipvgo-strategy.md`).
- [x] Built and tested locally (23 + 69 tests passing, `node --check` clean
  on both new/changed files).
- [x] Pushed live: `python3 tools/bb_remote.py ctl-push /ipvgo_player.js
  ipvgo_player.js --control-port 12527` and the same for `ipvgo_logic.js` —
  both confirmed via a round-trip `ctl-get`.
- [ ] **Needs a human/CDP-capable hand**: `run ipvgo_player.js` in the live
  terminal to actually reload the script (self-supersede kills the old
  heuristic-era copy automatically; there is no remote-exec RPC, only file
  push/pull). This session had no CDP/browser connection to the actual
  running game to do this itself.
- [ ] **Then, measure a real sample** via `cat ipvgo_status.json` or
  `python3 tools/bb_remote.py ctl-get /ipvgo_status.json --control-port
  12527` — specifically `recentWinRate`/`recentGamesCount` once enough
  games accumulate. Per this doc's own standing discipline: don't declare
  90% hit or missed off a handful of games either way.
- [ ] **If the sample is good enough and the rate is short of 90%**, the
  first lever is raising `NUM_PLAYOUTS` (currently 20, in
  `ipvgo_player.js`) before reaching for a structurally different
  algorithm — see `docs/ipvgo-strategy.md`'s updated "Open questions" for
  the reasoning and the MCTS/UCT next step after that.
- [ ] **Only once 90% is genuinely demonstrated**, try a larger board via
  `ns.go.resetBoardState(opponent, size)` — this task's own explicit
  ordering, not a thing to rush into.

## 2026-08-11: found the real cause of the "farm may be stuck" flag — bucket/redeploy thrash

Ken pushed back on "no hacking while empty" as a sign the algorithm needs a
rework. That specific behavior is correct by design (see
`WORK_WEIGHTS_BY_BUCKET`'s comment), but pulling `mcp_status.json` directly
via `ctl-get` (not the terminal — `cat` turned out to only work for
`.lit`/`.msg` lore files, not `.json`/`.txt`) found a real bug underneath the
symptom:

- `foodnstuff`'s `moneyPct` was swinging ~0.045 &harr; 0.125 every single
  10s tick — confirmed directly from `recentEvents`: `bucket_change
  low->empty->low->empty...`, exactly 10s apart, held for 4.3+ hours.
  `BUCKET_HYSTERESIS` (0.02) can't resist an ~0.08 swing.
- Every bucket flip sets `forceRebalance = true` (`mcp.js:1345`), which
  kills and redeploys **every host's** action scripts (`mcp.js:745-789`).
- `growTimeS`/`weakenTimeS` were ~13-16s — both longer than the 10s tick.
  So every single grow/weaken call was getting killed before it could ever
  finish. Not a policy bug (the hack/grow weights were correct for each
  bucket); a redeploy-cadence bug that made the correct policy meaningless.

**Mitigation shipped and confirmed live**: `BUCKET_HYSTERESIS` 0.02 → 0.08
via `ctl-push` (routine auto-sync is still down, see the item above).
Watched `mcp_status.json` afterward — bucket held steady at `empty`, no
new `bucket_change` events, vs. one every tick before.

- [x] **Structural fix built and unit-tested 2026-08-11 (later same day).**
  `hostNeedsRedeploy` moved to `mcp_logic.js` (pure, `node --test`-able) and
  changed so a `forceRebalance` that isn't backed by a structural mismatch
  (wrong target, no actions running, wrong action type for the plan — those
  still redeploy immediately, unconditionally, same as before) now waits
  until **every** currently-running action type on that host has had at
  least one full call's worth of time (`elapsedS >= actionDurationsS[script]`)
  before it's allowed to kill and redeploy. A bucket flip that lands
  mid-call now just sets the new weights for the *next* redeploy instead of
  retroactively cutting off the call in flight. `mcp.js` now reads
  `ns.getRunningScript(pid).onlineRunningTime` per running action to get
  real elapsed seconds (0.3GB static RAM cost on `home`, negligible against
  128GB) and computes `hackTimeS`/`growTimeS`/`weakenTimeS` earlier in the
  tick (`actionDurationsS`) so `allocateThreads` has them to pass down.
  8 new `mcp_logic.test.js` cases added (30/30 passing): the exact
  regression scenario (forceRebalance + a grow call 4s into a 15s
  `growTimeS`, asserts no redeploy), the "waits for the *slowest* running
  action type, not just any one" case, and one case per structural
  mismatch confirming those still redeploy immediately regardless of
  elapsed time. `node --check mcp.js mcp_logic.js` clean.
  **Not yet deployed live** — the daemon's real-game connection on port
  12526 dropped at 15:10:17 (`close_code=1006`, same abnormal-closure
  pattern as every other drop seen today — see the tick-gap notes below)
  and hadn't reconnected as of this writing. `mcp.js`/`mcp_logic.js` are
  both in `WATCHED_FILES` so the next (re)connect's full-resync will push
  both automatically; still needs an explicit `ctl-restart` afterward
  (Bitburner doesn't hot-reload) and a `ctl-pull` to confirm the new
  `scriptVersion` shows up and the bot's still behaving. **Next session:
  check `ctl-status` for `connected: true`, then push+restart+verify** —
  don't re-diagnose or re-test the logic, that part is done.
- [ ] `tickWithinBounds`: pulled fresh telemetry live this session (the
  pull loop is now confirmed working end-to-end, not just built) and found
  a strong new lead, not yet fully confirmed:
  - All 27 violations from the original finding, plus a further batch (93
    total in the pulled `mcp_events.txt`), cluster entirely inside one
    window: 2026-08-11 10:29:48–12:44:08. **Zero violations before or
    after** in the data pulled (checked back to the run's 09:37:21 startup,
    and forward to 15:07 when this session pulled — nearly 2.5 clean
    hours at time of writing).
  - That exact window sits entirely inside a real-game remote-API
    disconnect: `tools/bb_remote_events.log` shows the actual game
    (`bitburner/3.0.1 ... Electron/41.4.0`) dropped at 10:24:43
    (`close_code=1006`, "no close frame received or sent" — an abnormal
    closure, not a clean quit) and didn't reconnect until 14:21:19. The
    violations start 5 minutes into that gap and stop about 1.5 hours
    *before* the reconnect — so "disconnected" and "violating" correlate
    but aren't the same window, and nothing in `mcp.js` reads or depends on
    the remote-API socket at all (it runs inside the game independent of
    whether a debug client is attached), so a dropped debug connection
    can't directly cause a stalled game tick. Treat as a correlated
    symptom of "nobody was actively at the machine," not a cause.
  - **Checked and ruled out**: full OS sleep. `pmset -g log` for
    10:00-13:30 on 2026-08-11 shows no `Sleep`/`DarkWake` transition in
    that window — `kDisp` (display-awake) assertions are continuous
    throughout, so the Mac itself did not sleep. This also argues against
    the already-disproven Electron `backgroundThrottling` theory
    (`docs/process-backlog.md` "Not process, but open and known") staying
    disproven for the right reason — that flag is about a backgrounded
    Chromium *tab/page*, which is a different mechanism than either OS
    sleep or macOS **App Nap** (which throttles a whole unfocused/inactive
    process's timers without requiring sleep, and is not obviously covered
    by `backgroundThrottling: false` — that flag doesn't touch App Nap).
    **App Nap is the one live-plausible mechanism not yet ruled out** —
    fits the data better than sleep: violations are scattered irregularly
    (33s to 908s, not one monotonic block), which is what intermittent
    App Nap throttling of a background app looks like, rather than one
    clean "resume from suspend" gap.
  - Also checked and ruled out for *this* window specifically: repeated
    daemon reconnect cycles (a hypothesis `process-backlog.md` already
    raised in general) — `bb_remote_events.log` shows zero `CONNECT`/
    `DISCONNECT` events at all between 10:24:43 and 14:21:19, so there was
    no reconnect thrash happening during the violation window, just one
    long unbroken disconnect.
  - **Next step, concrete**: confirm whether Ken (or anyone) was away from
    the machine 10:24–13:37 that day — if so, App Nap on an unfocused
    Bitburner window becomes a much stronger claim, and the fix is
    `app.setActivationPolicy`/a `powerSaveBlocker`/explicit App Nap opt-out
    in the Electron main process (outside this repo, in Bitburner's own
    shell), not anything in `mcp.js`. If confirmed instead that someone
    *was* actively using the machine throughout, App Nap is ruled out too
    and this needs a different lead — instrument `mcp.js` itself next
    (e.g. log `Date.now()` immediately before and after `await
    ns.sleep(LOOP_SLEEP_MS)` specifically, to see whether the stall is in
    the sleep call itself or in the tick's own work).
  - Separate, smaller finding from the same pull: **`weakenBudgetNonNegative`
    fired 228 times in the pulled log**, and one clean consecutive run (ticks
    at `required=41→40→40→40→40→40→68→68` while `remaining` stayed at
    `-44/-45/-45/-45/-45/-45/-17/-17`) shows the same ~85 weaken threads
    deployed and unchanged across 8+ ticks while the target's actual
    requirement swung 40-68. This answers the open "legitimate
    over-allocation vs. noisy assertion" question from the loose-ends list
    below: **it's real, confirmed over-allocation**, not noise — a
    consequence of the same "don't redeploy unless something's structurally
    wrong" design this session's `hostNeedsRedeploy` fix builds on: once
    weaken threads are deployed they run forever (the worker scripts loop),
    and nothing trims the excess back down as the target's security
    recovers and needs less. Real yield left on the table (that RAM could
    be growing/hacking instead) but out of scope for this session's fix —
    worth a follow-up: a partial-rebalance path that kills only the excess
    weaken threads on a host without touching a host that's running
    grow/hack, rather than today's all-or-nothing redeploy.

## Priority 1: kill the VS Code extension dependency

The extension's file sync silently drops and does not replay on reconnect
(documented in `CLAUDE.md`'s environment-constraints section). It broke
twice in the 2026-08-09 session alone — once blocking
`mcp_dump_request.txt`, once blocking `mcp_restart.txt` — and the second
time needed Ken to fully quit and relaunch the whole Bitburner app, not
just reconnect, before it recovered. This is now the top priority because
it has cost real time twice in one day, not because it's newly noticed.

- [x] **Diagnose the port-12526 connect-then-drop.** Done 2026-08-10 — see
  `docs/remote-api-diagnosis-log.md` for the full trail. Root cause found
  and confirmed live (not just theorized): `cmd_serve` read commands from
  `sys.stdin.readline()`, and under a non-interactive stdin (no
  controlling TTY — how a tool-driven launch invokes it) that returns `''`
  immediately, which the old code treated as `quit` and tore the
  just-accepted connection down within ~1s. Reproduced against the actual
  pre-fix commit with a real client (`ping` failed at t+1.02s, clean
  `1000` close). Fixed: `serve` now only reads stdin commands on a real
  TTY, otherwise holds the connection and logs heartbeats; added a
  `watch` subcommand (no stdin dependency at all) for unattended live
  tests; added full connect/disconnect/message logging to stdout + a
  gitignored log file, since the old code logged nothing and that's what
  made this take so long to pin down. Verified: `selftest` still passes
  all seven checks; the fix was verified against a real (non-game) client
  holding a connection past the point the old code would have killed it.
  **Still not tested against the actual live game** — that's the next
  item below.
- [x] **Live-test the fix against the real game on port 12526.** Done
  2026-08-10, confirmed live: a `watch` window caught a real `CONNECTED`
  from the actual game process (`user-agent` shows `bitburner/3.0.1 ...
  Electron/41.4.0`, not a mock), held stable for 170s+ with no drop. The
  connect-then-drop bug is fixed, not just theorized-fixed. Full trail:
  `docs/remote-api-diagnosis-log.md`.
- [x] **Validate a full round trip.** Done 2026-08-10 12:26. The detached
  listener caught a real game connection and the combined round-trip
  script (connect → `pushFile` → `getFile` → compare → `getFileNames`, all
  in one continuous session using `tools/bb_remote.py`'s own
  `RemoteApiServer`/`BitburnerApi` classes) ran clean: push returned `OK`,
  the immediate read back matched the pushed content exactly
  (`ROUND TRIP MATCH`), and `getFileNames` listed the pushed file. This is
  a real, live, end-to-end round trip with no VS Code extension involved —
  the bar for "the direct connection actually works" is now met, not just
  "it connects." Full trail and one open scope question (home's file
  listing includes non-script repo cruft — venv, `.claude/`) in
  `docs/remote-api-diagnosis-log.md`.
- [x] **Design and build the replacement for the trigger-file mechanism.**
  Built 2026-08-10. `tools/bb_remote.py` gained four new subcommands:
  `restart`/`dump` (one-shot: push `mcp_restart.txt` directly via
  `pushFile`+`getFile`-readback, or fetch a file directly via `getFile`,
  bypassing `mcp_dump_request.txt`/tail-window/CDP entirely) and
  `daemon`/`ctl-status`/`ctl-restart`/`ctl-dump` (persistent process +
  local control channel — see the design-decision note right below this
  item for why this second layer exists). `mcp_supervisor.js` itself is
  **unchanged** — its poll loop still watches `mcp_restart.txt` for a
  content change; only how that content gets written changed. Full
  writeup: `docs/processes.md`'s "The trigger-file replacement" subsection
  under `tools/bb_remote.py`.
  - **Validated:** daemon+control-channel logic against an in-process mock
    game client (all paths: status while disconnected, status/restart/dump
    while connected, unknown-command error handling); the full CLI
    subprocess path (`daemon` run for real, `ctl-status`/`ctl-restart`/
    `ctl-dump` invoked as real subprocesses against it, correct behavior
    both connected and disconnected); `selftest` still passes all seven
    checks (no regression to the existing `push`/`get`/`list`/`delete`
    commands).
  - **Not yet validated:** the live game specifically exercising
    `restart`/`dump`/`ctl-*`. A detached `daemon` was started on port
    12526 (`nohup ... & disown`, confirmed reparented to launchd via
    `ps -o ppid`) and is still running as of end-of-session, but a 90s
    poll saw no Connect click during this session. **Needs one supervised
    click** — see `docs/kensTodo.md`. This is a live-validation gap, not a
    code-confidence gap: the mock+CLI coverage above exercises the exact
    same code paths (`TriggerDaemon`, `_ctl_call`, `RemoteApiServer`) that
    the earlier, already-live-confirmed `push`/`get`/`getFileNames` round
    trip used underneath.

  **Design decision, recorded so it isn't re-litigated:** the first cut of
  this (this same session) was one-shot `restart`/`dump` commands — same
  connect/act/disconnect pattern as the already-existing `push`/`get`.
  Ken flagged, before this was called done, that this re-triggers the
  exact fragile handshake path on every call, and that both failures
  motivating this whole migration (the extension's silently-dropped sync,
  and `tools/bb_remote.py`'s own now-fixed connect-then-drop bug) were
  connection-*stability* problems, not request-shape problems — so a
  process that reconnects per action and exits right after both re-risks
  the fragile step and destroys the evidence of a drop the moment it
  happens. **Chose:** kept the one-shot commands (useful for a single ad
  hoc call, and already built/tested) but added `daemon` as the
  recommended path — one persistent process holds the connection open for
  its whole life and logs every connect/disconnect to
  `tools/bb_remote_events.log` continuously; a local loopback control
  channel (`ctl-status`/`ctl-restart`/`ctl-dump`) lets each per-turn Bash
  call talk to the daemon instead of re-handshaking with the game. The
  daemon still can't force the game to auto-reconnect after a drop (the
  diagnosis log already established the game doesn't auto-reconnect
  regardless of "Reconnection delay") — that part of the friction is
  structural to the game's own Remote API, not something a daemon works
  around — but it removes the need to restart a *process* on Claude's side
  for the next reconnect to be picked up.

**Fact-check (2026-08-10, mid-session): routine script *source* push was
NOT yet migrated at that point** — only the `mcp_restart.txt` restart
trigger and read-only file dumps had moved off the extension; ordinary
source edits still reached the game only via the VS Code extension's
file-sync watcher, and `tools/bb_remote.py`'s own docstring said so
outright. **Superseded by the item directly below — this gap is now
closed in code, pending one live confirmation.**

- [x] **Wire up routine script sync and retire the VS Code extension
  dependency entirely.** Done 2026-08-10, same session, triggered directly
  by Ken hitting the exact failure this was warning about: reconnecting
  the extension on port 12525 dropped the daemon's connection on 12526
  outright (`close_code=1005`), proving live — not just by protocol
  reading — that the game holds exactly one outbound Remote API connection
  no matter which port is configured, so the "keep both" design this
  fact-check flagged was never actually viable. Ken approved the fix
  directly ("concur with the recommendation. Let's implement the fix.").
  - `TriggerDaemon` now pushes `WATCHED_FILES` (28 files — every live
    script/config, mirrors `docs/processes.md`'s map) via two triggers:
    a **full** resync of every watched file's current on-disk content on
    every game (re)connection (closes the exact "doesn't replay on
    reconnect" flaw `CLAUDE.md` documents against the extension), plus an
    **incremental** only-changed push every 2s while connected.
  - New CLI: `ctl-push`/`ctl-get` (the generic control-channel handlers,
    already coded, now exposed as subcommands — the exact gap this
    fact-check flagged) and `ctl-resync` (force a full pass on demand).
    `daemon --no-sync` disables the new behavior for isolating a
    regression.
  - **Port decision: daemon stays on 12526, Options gets pointed there
    once and left there — does not take over 12525.** Reasoning: 12525 is
    held by the extension's own background listener the whole time VS
    Code is open with it active, so taking that port over would need Ken
    to quit/disable the extension first (a real, less-familiar manual
    step) instead of a one-time Options field change (which he's already
    done several times today, and which persists across sessions the same
    way either port choice would). Full reasoning in
    `docs/processes.md`'s `tools/bb_remote.py` section.
  - **Validated:** `selftest` extended with direct coverage of the new
    sync logic (full resync pushes present files under their
    leading-slash remote name, correctly skips-and-reports a missing file
    without raising, incremental resync no-ops when nothing changed and
    pushes only the one file that did) — all pass against the in-process
    mock. A real `daemon` subprocess (scratch ports) answered
    `ctl-status`/`ctl-resync`/`ctl-push` correctly while disconnected, and
    that same run confirmed **all 28 `WATCHED_FILES` entries resolve
    against the real repo tree with zero "missing."** A fresh daemon
    (replacing the earlier restart/dump-only process, same port 12526) is
    running now, reparented to launchd, waiting for a connection.
  - **Validated live 2026-08-11.** Ken connected (Options → Remote API →
    `12526`) with his own extension, no VS Code involved. `tools/bb_remote_events.log`
    at 09:38:55: real game user-agent (`bitburner/3.0.1 ... Electron/41.4.0`)
    connected, daemon ran its full-resync pass, `SYNC: full resync done —
    pushed 28, failed 0, missing 0`. Every one of the 28 `WATCHED_FILES`
    landed in the game. This is the live confirmation this item was
    waiting on — not mock/subprocess coverage, an actual round trip against
    the real game.

**Bottom line, updated 2026-08-11:** the disk → game direction is now fully
proven live, not just built. The game → disk direction (see item directly
below) is now also built and mock/subprocess-validated, same session — but
**not yet proven live**, since the daemon actually holding the game
connection right now predates this code. This priority isn't fully closed
until a live pull round trip is confirmed the same way the push side was.

### New gap found 2026-08-11: game → disk direction still has no automated path

Retiring VS Code was framed as one migration, but it's really two
directions, and only one is done:

- **disk → game (push):** done, live-confirmed above.
- **game → disk (pull):** `mcp_status.json`, `mcp_status_log.txt`,
  `mcp_target_state.json`, `mcp_events.txt` are generated *by the game* and
  need to land back on local disk for the parser/dashboard to read fresh
  numbers. Previously this was the VS Code extension's "Download Files
  Matching Pattern…" command — deliberately excluded from `WATCHED_FILES`
  in `tools/bb_remote.py` (pushing them back would overwrite live game
  state with a stale local copy, see the comment at the top of that list).
  `tools/bb_remote.py` already has the primitive this needs —
  `get_file`/`cmd_dump`/`ctl-dump`/`ctl-get` all call the same `getFile` RPC
  that the original push/pull round-trip test proved works live — but
  every one of those just `print()`s the result to stdout or returns it
  over the control socket. **None of them write the result to a local
  file.** So even the on-demand path doesn't close the loop today; a caller
  would have to redirect the output itself, and nothing in the repo does.
  On disk right now: `mcp_status.json` is still dated 2026-08-08 14:40 —
  three days stale — even though the daemon has been connected and syncing
  successfully since this morning, which confirms the gap is real, not
  theoretical.

  - [x] **Built 2026-08-11, same session as this gap was found.** Chose the
    "extend the daemon" design (option 1 from the recommendation below,
    folded into `ctl-pull` from option 2 as the on-demand escape hatch) —
    mirrors the push side's own structure exactly rather than inventing a
    new shape: `TriggerDaemon` gained `PULL_FILES` (the same four files:
    `mcp_status.json`, `mcp_status_log.txt`, `mcp_target_state.json`,
    `mcp_events.txt`), a `_pull(full)` method paralleling `_resync(full)`,
    and a `pull_poll_loop` paralleling `sync_poll_loop`. The existing
    `on_connect` hook now runs a full pull right after its full push
    resync, so a (re)connect refreshes both directions in one pass; an
    incremental pull runs every `PULL_POLL_S` (2s, same cadence as the push
    side) while connected, writing to disk only the files whose fetched
    content actually changed. New CLI: `ctl-pull` (force an immediate full
    pull, the exact analog of `ctl-resync`) and `daemon --no-pull`
    (disables the pull half independently of `--no-sync`). A `getFile` on
    a remote file that doesn't exist yet is caught per-file into `missing`
    and never raises — the same skip-and-report contract the push side
    already has for a file missing on local disk. Full design write-up:
    `docs/processes.md`'s new "Game -> disk pull" subsection under
    `tools/bb_remote.py`.
    - **Validated:** `selftest` extended with direct coverage of the pull
      logic (full pull writes correct content to the right local path; a
      missing remote file is skipped-and-reported without raising;
      incremental pull no-ops when the game side's content is unchanged;
      incremental pull writes only the one file that did change) — all
      pass against the in-process mock, alongside every pre-existing check
      (24/24 total). A real `daemon` subprocess on scratch ports
      (31526/31527, not the live 12526/12527 — the real daemon was left
      completely untouched per this task's constraint) answered
      `ctl-status`/`ctl-pull` correctly while disconnected: `ctl-status`
      reported `pull_enabled: true`/`pull_files: 4`, `ctl-pull` reported
      all four files as `missing` (each `getFile` correctly raised "Not
      connected to Bitburner", caught per-file, no crash) — the pull-side
      equivalent of the disconnected-state check the push feature was
      validated with.
    - **Not validated:** the live game actually round-tripping this —
      no real `getFile` call has written a real `mcp_status.json` (etc.)
      to disk under this code yet. The daemon actually connected to the
      game right now on port 12526 predates this change (it's the same
      process from the earlier push-sync work, left running and untouched
      per this task's constraints), so it's still running the old code
      without the pull loop. This needs that process restarted with the
      current code, then either the game's next natural reconnect or one
      fresh Connect click — **not a Ken-specific action**, since Claude can
      do the restart and then watch `tools/bb_remote_events.log` for the
      next reconnect itself in a later session; noted here rather than
      added to `docs/kensTodo.md`.
  - Until the live confirmation above happens, getting current numbers
    onto disk **also** still works via **either** the VS Code extension's
    one-off download command **or** a CDP read (`mcp_dump_request.txt` →
    `mcp_dump` tail window, see `docs/processes.md`) — both still work,
    neither requires reopening the extension's file-sync watcher
    specifically, and neither is removed by this change.

Note on branch history: the task brief for this cleanup expected
`tools/bb_remote.py`'s branch to carry multiple commits from being resumed
several times. Checked directly — it has exactly one commit
(`e8a6794`, "Add direct Bitburner Remote API client, prototype for
dropping VS Code sync"). Worth knowing so the next session isn't surprised
by a git history that doesn't match that expectation; the multi-session
diagnosis work on the port-12526 drop itself doesn't appear to have been
committed anywhere before it was lost track of.

## Priority 2: process-backlog.md review

See `docs/process-backlog.md` directly — reviewed and updated 2026-08-10
with the VS Code dependency added as the new top item. Don't duplicate its
reasoning here; read it there.

## Loose ends carried from 2026-08-09

- [x] **XP-thrash fix restart confirmation.** Checked live over CDP on
  2026-08-10: the running `mcp.js` reports `ver ok`, meaning its stamped
  `scriptVersion` hash matches the current `mcp.js` on disk — and disk
  hasn't changed since commit `81814d6` (the XP-eviction fix) except for
  doc-only commits after it. **The fix is confirmed running live**, no
  further restart needed on this account.
- [ ] **`dnet_deploy.js --once` from `home`.** Still pending Ken — see
  `docs/kensTodo.md`. `dnet_probe.js` already validated the model-reading
  approach; this is the next real darknet step.
- [ ] **New, found live 2026-08-10, not diagnosed yet:** the CDP check for
  the item above also showed `mcp`'s HUD in a bad state — verdict
  `INVARIANT`, `inv 506` all attributed to `weakenBudgetNonNegative`,
  `money 0%`, `rate 0`, `avg 3`. Plan shown as `work/xp` (OBJECTIVE is
  currently `xp`). `next = current` (no target-switch thrash visible in
  this snapshot, so this looks unrelated to the eviction-thrash bug that
  was fixed). This wasn't chased further tonight per scope — worth a look
  next session: is `weakenBudgetNonNegative` firing legitimately (a real
  over-allocation) or is it noise given `ram 98%`/`18 hosts` are otherwise
  plausible-looking. `money 0%` + `rate 0` alongside 506 invariant hits
  suggests something is actually stuck, not just a noisy assertion.
- [ ] **Two more live-observed items, flagged but not chased this session
  (trigger-file work above was the priority):**
  1. A separate live check reported **~199 accumulated
     `weakenBudgetNonNegative` violations** — a different count than the
     `inv 506` snapshot immediately above, so either the counter reset
     between checks (a restart, which zeroes it) or this is a second,
     independent sighting. Either way, `weakenBudgetNonNegative` firing
     repeatedly across more than one session is worth a real look next
     time: same open question as above (legitimate over-allocation vs.
     noisy assertion), now with two independent data points instead of
     one.
  2. **`mcp.js`'s target-switching looked unusually thrashy**: switches on
     a ~60-190s cadence, often immediately followed by a "yield
     degraded... moving on" log line. Not yet diagnosed — worth checking
     whether this is the same class of eviction-thrash bug fixed in
     `81814d6` (money-degraded eviction chaining target-to-target) showing
     up in a different code path, or something new. `mcp_logic.js`'s
     `evaluateOpportunitySwitch`/`evaluateMoneyDegradation` and their
     `node --test` coverage in `mcp_logic.test.js` are the place to start
     — a synthetic test reproducing a 60-190s switch cadence would be far
     cheaper than another multi-restart live diagnosis.
- [ ] **Two worktree branches merged into main 2026-08-10** (status
  dashboard artifact, `tools/bb_remote.py` prototype) — both were clean
  except one conflict in `docs/processes.md` (both added a section in the
  same spot), resolved by keeping both sections. Nothing further needed
  here; noted so the merge isn't re-discovered as a surprise.
- [x] **Pure-function extraction for `node --test`** (the
  `process-backlog.md` "Still gold #6" item). `mcp_logic.js` now holds
  `evaluateMoneyDegradation`, `evaluateOpportunitySwitch`,
  `selectWorkWeights`/`getWorkWeightBucket`, and
  `computeTickInvariantChecks`; `mcp.js` imports it and calls into it for
  those decisions instead of computing them inline. `mcp_logic.test.js`
  covers all four with `node --test`, including a direct regression test
  for the `moneyDegraded`/XP-mode bug fixed in `81814d6`. Landed in git
  only — **not yet deployed/restarted live**, since that's a separate step
  (sync watcher needs to push `mcp_logic.js` too, then a normal restart).

## 2026-08-11: repo move broke daemon sync silently; fixed with tests

- [x] **Found and fixed the `REPO_ROOT`-frozen-at-import bug** that broke
  `tools/bb_remote.py`'s daemon's auto-sync (both directions) for ~2 hours
  after this session's repo relocation, silently. Root cause, fix, and the
  8 new selftest checks covering it are written up in full in
  `docs/processes.md`'s `tools/bb_remote.py` section (search "silent,
  hours-long sync outage"). Applied the 2026-08-07 audit's "assert on the
  code's own intentions" principle to the Python/tooling side for the first
  time — a loud `sync_root_alarm`/`pull_root_alarm` now surfaces via
  `ctl-status` instead of a rate-limited log line nobody's tailing.
  **Not yet deployed to the live daemon** — the fix only takes effect on
  the next process restart, which still needs a reconnect (manual click or
  the CDP-auto-reconnect work, still not built). Ordinary file pushes in
  the meantime should use `ctl-push` directly (bypasses the cached root
  entirely) rather than relying on the broken auto-sync until that restart
  happens.
- [x] **`hacking/backdoor.js` needs Source-File 4** — confirmed live,
  uncaught `RUNTIME ERROR` modal, before Ken had SF4. Added a guard
  (`hasSourceFile4`, checks `ns.getResetInfo().ownedSF` — never gated) that
  prints one clear line instead. Added `hacking/findpath.js` (BFS over
  `ns.scan`, never gated either) to print the connect-chain to type by
  hand. **Confirmed working this way live**: typed the real chain +
  `backdoor` for `I.I.I.I` via Claude's terminal-write path — The Black
  Hand now shows under Ken's joined factions.

## Workflow

- **Any future change to the logic in `mcp_logic.js` (or new logic worth
  extracting out of `mcp.js`) should get a `node --test` test added and run
  before being shipped.** Diagnosing the `moneyDegraded`/XP-mode eviction
  bug the night of 2026-08-09 required three separate live restarts and
  4-5 minutes each of watching the game over CDP, for a bug that a
  millisecond-scale unit test now catches directly — see
  `docs/processes.md`'s `mcp.js` section and `mcp_logic.test.js` for what
  that regression test actually looks like.

## 2026-09-03: remote_api_monitor.sh infinite restart loop, and a deferred idea

- [x] **Found and fixed `tools/remote_api_monitor.sh`'s `daemon_healthy()`
  bug.** It required `PID_FILE` to hold the exact PID of a live process
  *before* even trying the control port. `start_daemon()` unconditionally
  overwrote `PID_FILE` with whatever `nohup ... &` returned, even when that
  process was about to die from a failed bind (because a working daemon
  already held the port under some other, untracked PID). Once drifted,
  `kill -0` on the latest doomed clone failed immediately, so the function
  never even tried `ctl-status` — spawning another equally-doomed clone
  every ~61s, forever, while a real, working daemon (confirmed 23+ hours
  uptime) sat there the whole time, completely invisible to its own
  monitor. Fixed: `daemon_healthy()` now checks control-port reachability
  directly as the sole signal (a daemon that answers is healthy, whoever's
  PID it has); `start_daemon()` now polls to confirm the daemon actually
  became reachable before declaring success, and logs a clear warning
  instead of silently trusting the PID if it doesn't. See `docs/processes.md`
  for the fuller writeup once this lands there too.
- [ ] **Deferred idea, not started: multi-port Remote API support** — one
  port per concurrently-connected game session (Steam + a Chrome tab, etc.)
  instead of the current single shared port, so file-sync could reach
  whichever sessions are open at once instead of only the one currently
  connected. Ken raised this while watching the daemon-loop fix live;
  agreed to defer until the current single-port daemon is confirmed stable
  again, since it's a real architecture change (per-connection sync-state
  tracking, a way for control-port commands to target a specific session)
  and not something to bundle into a bug fix. Worth a fresh look once
  Remote API reconnects reliably and stays that way for a while. Note:
  this would NOT sync save/game state between sessions either way — Remote
  API only ever syncs source files, so Steam and a browser tab would still
  be two independently-diverging saves regardless of port count.

## 2026-09-04: R4/R8 follow-through — Formulas.exe floor-corrected scoring wired into primary ranking

Ken asked for a review of R1-R8 (a fork did the deep read against actual
source, not just docs). Two real findings: `docs/hacking-strategy.md`'s R6
status was stale (said "not started," code shipped 2026-08-31 per
`STATE.md`), and R8's own floor-corrected scoring primitive
(`getFormulaMinimumSecurityScore`) was sitting unused outside its narrow
switch-veto role, while R4's own documented gap — scoring every candidate
at *current* security, systematically under-rating anything above its floor
— was still exactly as originally deferred.

**Fixed both, same session, per Ken's explicit "ship it, if faulty we'll
fix it" direction** (a stated preference, not just this one instance — see
memory). Doc fix: corrected §5 item 7 and the summary paragraphs. Code fix:
extracted the model-building logic into `getFormulaTargetScores` (mcp.js),
shared by `getTargetScore`/`getTargetEffectiveScore` (new — try the
floor-corrected score first when Formulas.exe is owned, fall back to the
existing current-security approximation on any failure) and
`getFormulaMinimumSecurityScore` (R8's veto check, now a thin wrapper —
deduplicated what used to be its own separate copy). New tunable
`FORMULA_RANKING_ENABLED`, same ship-inert/flip-on-in-config convention as
`R8_SWITCH_VETO_ENABLED`; set to 1 in the live `mcp_config.json` immediately
rather than staged, per the same direction. Added `formulaRankingActive` to
`mcp_status.json` for the same reason R8's own unexercised-for-2.5-weeks
status was a finding worth flagging — a feature nobody can confirm is
active isn't meaningfully shipped.

**Confirmed live same session:** `node --check`/`node --test` (216/216)
clean before commit; `ctl-restart` triggered a fresh `mcp.js`; first status
pull post-restart showed `formulaRankingActive: true`,
`config.FORMULA_RANKING_ENABLED: 1`, zero `invariantViolations`, 99% RAM
utilization. Watched ~60s more: still clean, still active, no invariant
violations — target (`phantasy`) was mid-weaken from a fresh restart so
`incomePerSec` hadn't ramped yet in that window, not itself a signal of a
problem. Worth a later glance to confirm income settles at or above
pre-change levels once the weaken phase completes, but the actual ask
(wire it in, confirm it's genuinely active, don't break anything) is done
and verified.
