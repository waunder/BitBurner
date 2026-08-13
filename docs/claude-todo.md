# Claude's working list

## 2026-08-12 (latest): `ipvgo_hud.js` — in-game panel instead of a scheduled dashboard refresh

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
