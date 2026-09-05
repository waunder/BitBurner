# IPvGO strategy

> **Status, 2026-09-05:** live and active; the freeze fix below is
> **live-confirmed**, not just locally profiled — Ken, watching a real game
> against The Black Hand on 13x13 (the exact board that had the problem):
> "No sign of bb interface freezing. Your diagnosis is solid!" Measured
> `avgMoveMs`/`maxMoveMs` 6100/8351ms, down from the pre-fix
> 11,721/13,591ms. The 2026-08-18 "disabled after repeated responsiveness
> incidents" banner that stood here before today was itself stale —
> `ipvgo_status.json` showed 12,700+ lifetime games under `mcts-ucb1-v2`
> alone, so play had continued after that note was written without the doc
> being corrected; `AGENTS.md`'s stop-list no longer lists IPvGO either.
> Historical "live"/"disabled" wording further down is the record of what
> happened when, not current status; this banner is.

## 2026-09-05: browser-freeze root cause found and fixed; time-budgeted search

Ken's own framing: results against tougher opponents needed improvement,
and separately, IPvGO has repeatedly been suspected of freezing the
Bitburner tab — his working theory was "the program became too large,"
with a proposed fix of moving it to a cloud server. Investigated the freeze
claim first, since a plausible-sounding cause proposed without evidence is
exactly this repo's own recurring failure mode (`docs/CLAUDE.md`'s
"Diagnosis discipline") — and because the fix that follows from "too large"
(more/different hardware) is completely different from the fix that
follows from "blocks the render thread" (yield more often), so getting this
right mattered before writing any code.

### What was actually found

**confirmed live** (data already sitting in `ipvgo_status.json`, not
newly gathered): `lastResult.avgMoveMs` = 11,721, `maxMoveMs` = 13,591, on
the current 13x13-vs-The-Black-Hand subnet. That is an eleven-to-fourteen
*second* delay before every single move gets submitted.

**derived, then confirmed by direct code reading**: `ipvgo_player.js`
called `chooseBestMove()` once per move, synchronously, with no `await`
anywhere inside `ipvgo_logic.js`'s MCTS simulation loop
(`for (let i = 0; i < numSimulations; i++) runMctsIteration(...)`).
Bitburner executes Netscript on the browser tab's single JS thread — the
same thread that renders the UI and runs every other script, including
`mcp.js` — so a long uninterrupted synchronous call blocks *everything*,
not just this script, for exactly as long as it takes. This is the same
class of bug this repo already fixed once, in the same session that
produced the current `ipvgo_player.js` commit history: `scripts/share.js`
needed a sleep between `ns.share()` calls "so many resident share threads
don't monopolize the event loop." The arithmetic checks out exactly against
the observed timing: 13x13 has ~3.4x the points of the 7x7 board the
6000-simulation budget (`NUM_SIMULATIONS`, raised 2026-08-12) was tuned
against, `maxPlayoutMoves` (2×W×H) scales the same way so per-simulation
rollout cost scales with roughly the *square* of that ratio (~12x), and the
sim count itself was already 4x the original 1500 — 12×4 = 48x the
original ~250ms/1500-sim profiled baseline lands almost exactly on the
observed ~11.7s. **Conclusion: this is not "the program became too
large" in a code-size or RAM sense — RAM was last measured at ~17.6GB
(arithmetic) and doesn't scale with board size at all.** It is a single
long synchronous computation that was never re-checked after the board
size it was tuned for changed, and that computation blocks the whole
browser tab for its entire duration because nothing inside it ever yields.

### Why a cloud server would not fix this (the investigation Ken asked for)

Ken's proposed fix — "acquire a cloud server with sufficient resources to
run your program reliably" — does not apply here, and this is worth being
explicit about since it was a direct instruction:

- **`ns.go.*` only exists inside the actual running game's own JS VM, in
  the browser tab.** There is no Bitburner API, documented or otherwise,
  for calling `makeMove`/`getBoardState`/etc. from outside the game.
  Whatever compute a cloud server has, it cannot submit a move.
- **This repo's own Remote API bridge (`tools/bb_remote.py`) is a file-sync
  channel, not a live RPC link.** It pushes/pulls source files and a
  handful of generated telemetry files, on a poll/reconnect cadence meant
  for development, not a sub-second round trip that could ship a board
  state out mid-turn, compute a move on faster hardware, and get it back in
  time to matter. Building that channel from scratch would be a
  significantly larger project than the actual fix, for a problem it
  doesn't even solve (see next point).
- **The bottleneck was never "not enough CPU somewhere."** A cloud server
  would compute the same 6000 simulations *faster in wall-clock terms*, but
  the freeze isn't caused by the computation being slow in absolute terms —
  it's caused by however long it takes happening in one uninterrupted
  stretch on the thread the browser also needs for everything else. A
  faster machine still produces one long blocking call; it would freeze the
  tab for less time, not zero time, and only if the hypothetical low-latency
  RPC channel above existed to use it at all.

**Recommendation, followed through below:** fix the actual mechanism —
make the existing computation yield periodically — rather than build
infrastructure that doesn't address the cause.

### The fix: chunked, yielding search + a time-based budget

`ipvgo_logic.js`'s `chooseBestMove` is unchanged in what it computes (same
MCTS/UCB1 algorithm, same rules engine, same 35 pre-existing tests still
pass verbatim) but its internals are now exposed as a resumable handle,
`createMctsSearch(board, validMoves, colorChar, opts)`, returning either
`null` (no legal non-self-eye-fill move — caller should pass, same as
`chooseBestMove`'s `{ move: null }`) or an object with:

- `runIterations(n)` — run up to `n` more simulations right now
- `runIterationsForMs(ms)` — run simulations for approximately `ms` of wall
  time (checked every 8 iterations, not every single one, to keep the
  `Date.now()` polling itself cheap on a fast board)
- `getResult()` — same return shape `chooseBestMove` always had

`chooseBestMove` itself is now a two-line wrapper (`createMctsSearch(...)`
then `runIterations(numSimulations)` then `getResult()`) — kept for tests
and any one-shot use, where blocking synchronously is exactly what's
wanted. `ipvgo_player.js` no longer calls it for live play. Instead its
move-selection loop now looks like:

```js
const search = createMctsSearch(board, validMoves, "X", { numSimulations: MAX_SIMULATIONS, komi, isOpeningMove, openingStats })
if (search) {
  const deadline = Date.now() + TARGET_THINK_MS
  while (search.remaining() > 0 && Date.now() < deadline) {
    search.runIterationsForMs(CHUNK_MS) // 40ms
    await ns.sleep(0)
  }
}
const { move, visits, winRate, simulations, evaluated } = search ? search.getResult() : { move: null, ... }
```

This also replaces the fixed `NUM_SIMULATIONS` constant — the actual root
cause of the tuning drift above — with a wall-clock **thinking budget**
(`TARGET_THINK_MS`) plus a high simulation ceiling (`MAX_SIMULATIONS =
20000`) as a safety valve. A slow-per-simulation board (13x13) naturally
gets fewer, deeper simulations within the time budget; a fast board
(5x5/7x7) exhausts the simulation ceiling and returns early, well under the
time budget, instead of wasting time on search that's already converged.
Board size can never again silently invalidate a hand-tuned constant the
way it did here, because there is no board-size-specific constant to tune.

**Strengthening, not just a fix**: local profiling (`node`, this session)
of `createMctsSearch` on a synthetic empty 13x13 board — the actual size
now in play — measured ~595 simulations/sec via chunked
`runIterationsForMs` calls, max single chunk 57ms (i.e. no perceptible
freeze at all, versus the prior single 11.7s block). At the first,
more conservative `TARGET_THINK_MS` value tried (5000ms) that only reaches
~2984 simulations — under half the old (blocking, 11.7s/move) 6000-sim
depth, which would have traded the freeze for a quietly *weaker* search,
the opposite of what this task asked for. `TARGET_THINK_MS` was set to
10000ms instead, landing close to or above the old depth (~5950 sims at
the profiled rate) while every individual chunk still stays under ~60ms.
Games now take longer in real wall-clock time per move (this runs
unattended in the background, so that's an acceptable trade), but the
browser tab is never blocked, and search depth on the harder board/opponent
matches or exceeds what it had before the freeze was even a known problem.

### What the loss data actually shows (the "assess every defeat" ask)

`recentGames` (last 100, `ipvgo_status.json`) shows a size/opponent
transition partway through the current window: earlier entries are
smaller-margin games (`32-41.5`, `29-47.5`, etc. — consistent with a
smaller board) and the most recent handful jump to much larger absolute
scores (`66-95.5`, `71-90.5`, `64-96.5`) against The Black Hand on 13x13,
with `recentWinRate` at 76% overall but `opponentLifetimeWins: 0,
opponentLifetimeLosses: 1` for this specific opponent — i.e. the
tougher-opponent/bigger-board era so far is only a handful of games, too
small a sample to read as a rate yet (this doc's own standing discipline,
restated every time this comes up).

**What the three recent losses are *not***: none is a shutout-to-zero
(Black still holds 64-71 points in each), which is the specific signature
of the already-fixed 2026-08-11 whole-network-collapse bug (single blob, no
separate eyes, dies all at once — that bug's own shutout scores were things
like `0 vs 49.5`). These are comfortable, whole-game losses on a bigger
board, not a structural blind spot recurring.

**What they're consistent with**: a search that's evaluating correctly
locally but not deeply enough relative to a board with ~3.4x the points and
proportionally longer rollouts — exactly this doc's own already-stated
escalation order ("more simulations before a structurally different
algorithm," `docs/ipvgo-strategy.md`'s pre-2026-09-05 "Open questions" #6)
— compounded by the fact that the freeze itself was silently preventing
the sim count from being raised any further to compensate, since doing so
would only have made the blocking worse. The freeze fix above directly
addresses this: it doesn't just stop the freeze, it removes the ceiling
that made "just use more simulations" a bad trade in the first place.

**Not yet separable from the above without more games**: whether the
freeze itself (an 11-14s browser stall every move, all game) had any
in-game side effect beyond slow play — e.g. whether a stalled tab ever
caused a missed `opponentNextTurn()` read or a stale board fetch. No
evidence either way was found (no error logs from that period point to it),
so this is flagged as an open question, not asserted as a contributing
cause.

### 2026-09-05 (later): reputation is the real goal — faction targeting now persists across restarts

Ken's own follow-up, mid-session: "I think the primary IPvGO reward is
faction reputation... your goal is not just to win a single game, but
improvement through a series of games." This is correct against this doc's
own "Scoring and rewards" section above — winning twice in a row against
the same opponent's faction converts 500 reputation into favor with that
faction, but only while you're a member of it — and it exposed a real,
timely bug: `ipvgo_player.js` picked its target opponent purely from
`ns.args[0]`, defaulting to the hardcoded `"Netburners"` whenever no arg was
given. **Every restart with no arg silently reset the target faction back
to that default**, discarding whatever win streak/reputation series was
actually in progress against whatever faction was really being farmed
(currently The Black Hand, 13x13) — including the restart this very session
is about to ask Ken to do, to pick up the freeze fix above. A "series of
games" goal cannot survive a bug that resets the series on every restart.

**Fixed**: `ipvgo_player.js` now reads the opponent/size it was last
actually playing straight back off `ipvgo_status.json`
(`readPersistedFactionChoice`) and uses that as the default whenever
`ns.args[0]`/`[1]` aren't given — an explicit arg still overrides it, for
whenever Ken deliberately wants to redirect at a different faction. Unlike
`gamesPlayed`/`wins`/`recentGames` (`loadPersistedStatus`), this is *not*
scoped to the current `algorithm` tag, since which faction to farm isn't a
performance measurement a rewrite should reset — it's just "what Ken chose."

**Also added**: a startup check (`checkFactionMembership`, via
`ns.getPlayer().factions` — 0GB, no Source-File gate, already used
elsewhere in this repo) that warns plainly if the target opponent is a real
joinable faction (`Netburners`/`Slum Snakes`/`The Black Hand`/`Tetrads`/
`Daedalus`/`Illuminati` — not `"No AI"` or `"????????????"`, neither of
which is a real faction) Ken hasn't actually joined yet, since the
win-streak favor conversion silently does nothing in that case (territory
stat bonuses still accrue regardless — this is informational, not a gate).
Surfaced in `ipvgo_status.json` as `targetFaction`/`isFactionMember` and in
`ipvgo_hud.js` as a new row, so "is this run actually banking reputation"
is visible at a glance rather than something to infer.

**Confirmed live, 2026-09-05 (same day):** restarting surfaced the
persistence bug in the act — the first restart attempt used no faction arg
and landed on `Netburners`/7x7 (the old hardcoded default), because the
*prior* run of the pre-fix code had already overwritten
`ipvgo_status.json`'s persisted choice away from The Black Hand before the
fix could take effect — a real, live demonstration of exactly the bug the
persistence fix targets. A second restart with the faction spelled out
explicitly (`run ipvgo_player.js "The Black Hand" 13`) confirmed
`isFactionMember: true` (Ken is a member) and `algorithm: "mcts-ucb1-v3"`.
Separately, the first restart attempt also failed to connect the Remote API
at all — traced to Ken being on the **web** version, where the connection
is categorically blocked by Chrome's Private Network Access policy
(pre-existing, confirmed-unfixable finding, not new); switching to the
**Steam** app connected immediately.

### Next steps, in order

1. ~~Get `ipvgo_player.js` restarted live.~~ **Done and confirmed live
   2026-09-05.** `ipvgo_status.json` after the restart: `algorithm:
   "mcts-ucb1-v3"`, `opponent: "The Black Hand"`, `size: 13`,
   `isFactionMember: true`, `avgMoveMs`/`maxMoveMs` **6100/8351ms** (down
   from the pre-fix 11,721/13,591ms, and both comfortably under the
   `TARGET_THINK_MS=10000` budget plus overhead). **Ken, watching the actual
   game live: "No sign of bb interface freezing. Your diagnosis is
   solid!"** This is the real-world confirmation the local 13x13 profiling
   (595 sims/sec, max chunk 57ms) predicted but couldn't itself prove.
2. **Accumulate enough post-fix games against The Black Hand/13x13 to read
   a real win rate** — 2/2 so far right after the restart, nowhere near
   enough of a sample; the pre-fix 76%/handful-of-games figure spanning the
   size transition still isn't a fair read of the new search depth either.
3. **If the win rate still lags after that**, the next well-cited lever
   (not attempted this round, kept simple per this project's own
   discipline, but a real published technique rather than another
   heuristic) is RAVE / AMAF (Gelly & Silver, "Combining Online and Offline
   Knowledge in UCT," ICML 2007 — already cited in `ipvgo_logic.js`'s
   header for the opening-move prior, which is one of that same paper's
   three proposed techniques): share value estimates across tree nodes for
   the same move regardless of when it's played, which converges much
   faster than plain UCB1 under a limited simulation budget — exactly the
   "sparse samples on a big board" situation here. Deferred this round
   because it changes the tree's selection formula and needs its own live
   validation the way every algorithm change here has, and this session's
   priority (per Ken's own framing) was the freeze fix first.

## 2026-08-14: low-cost tactical rollout upgrade

The existing MCTS remains unchanged. Rollouts now sample a handful of legal
non-eye moves and prefer a sampled capture, falling back to the first legal
move. This is deliberately smaller than a full tactical policy: it adds a
cheap source of tactical awareness without a full legal-move scan at every
rollout step. `node --test ipvgo_logic.test.js` remains the gate before a live
push; the win-rate effect still needs live measurement against the existing
opponents.

A self-contained subsystem, same shape as the darknet set: read the real API
and the real in-game rules first, write down what's confirmed vs. reasoned,
then build a first working version. Citation style matches
`docs/darknet-strategy.md` — every claim below is tagged **official doc**
(the game's own in-game documentation or `NetscriptDefinitions.d.ts`),
**confirmed live** (observed directly in Ken's actual running game),
**derived** (reasoned from the above, not directly observed), or
**speculative**/**unknown**.

**As of 2026-08-12: a heuristic version ran live and won 3/5 recent games
(most recently 45-1.5), then was replaced with a real, cited algorithm
(flat Monte Carlo — see the 2026-08-12 section below) targeting a 90% win
rate. The rewrite is pushed live and syntax/unit-tested (23 tests,
`node --test ipvgo_logic.test.js`) but has not yet been started with `run
ipvgo_player.js` in the live terminal** — see "Status" at the bottom and
`docs/claude-todo.md`'s 2026-08-12 section for the one concrete next step.

---

## What IPvGO actually is

**official doc** (in-game Documentation → IPvGO, and the "How to Play" tab on
the IPvGO Subnet page itself, both read live over CDP this session):

> IPvGO is a strategic territory control minigame accessible from DefComm in
> New Tokyo, or the CIA in Sector-12. Form networks of routers on a grid to
> control open space and gain stat multipliers and favor, but make sure the
> opposing faction does not surround and destroy your network!

It is Go, with the game's own name for the pieces: your stones are
"routers," a chain of connected same-color stones is a "network," and a
liberty is an "open port." **official doc**, explicit: this is *area*
scoring (traditional Go rules), not Japanese *territory* scoring — "All
stones are alive and count towards score unless captured during the game.
Chains that could be dead are not automatically captured after the game, and
prisoners are not calculated." Real-Go endgame instincts about dead-stone
cleanup do not apply here; every stone on the board at the end counts.

### Board and pieces

- `getBoardState()` returns an array of column-strings — `board[x][y]`,
  **not** `board[row][col]`. `"X"` = your routers (black), `"O"` = opponent
  (white), `"."` = empty/open node, `"#"` = a dead node, not part of the
  playable subnet at all (doesn't count as territory, doesn't provide open
  ports to adjacent routers). **official doc** (`.d.ts` doc comment on
  `getBoardState`, matches the in-game "How to Play" text on dead nodes
  exactly).
- Board sizes: 5, 7, 9, or 13 (`resetBoardState`'s type signature only
  accepts those four). **official doc**.
- You are always black unless the opponent is specifically `"No AI"` (the
  only case `playAsWhite` is meaningful for `makeMove`/`passTurn`). **official
  doc**.
- Opponents (`GoOpponent` type): `"Netburners"`, `"Slum Snakes"`, `"The Black
  Hand"`, `"Tetrads"`, `"Daedalus"`, `"Illuminati"`, `"????????????"`, or
  `"No AI"`. **official doc**.

### The rules that actually matter for move legality

**official doc**, from "How to Play"'s "Special Rule Details":

- A network that loses its last connection to any empty node is removed
  entirely ("intense packet loss").
- You cannot suicide your own network by playing a move that removes its
  last open port — **except** the one specific case where that same move
  would capture an opponent network, which is always legal.
- Superko: you cannot repeat a previous board state. This is why a
  "flashing," one-liberty enemy network sometimes can't be captured
  immediately after a capture-recapture — you have to play elsewhere first
  to change the board state, then come back for it.

### Scoring and rewards — this is the part that differs from real Go and matters most for strategy

**official doc**, same source:

- At game end (both pass consecutively, or every open node is fully
  surrounded by one color): each player scores one point per empty node they
  fully surround, plus one point per router they have on the board. Area
  scoring, as above — no prisoner subtraction.
- White gets **komi** (a fixed bonus, "5.5" is the default per
  `setTestingBoardState`'s parameter default in the `.d.ts` — **official
  doc**) to offset black's first-move advantage.
- **Territory controlled at game end awards stat multiplier bonuses,
  regardless of whether you won.** "Winning the node will increase the
  amount gained, but is not required." This is the single most important
  scoring fact for strategy: you don't need to beat the AI to get value out
  of a game, you need to control territory. A loss where you still hold a
  meaningful chunk of the board is not a wasted game.
- **Winning twice in a row against the same opponent's faction converts 500
  reputation into favor with that faction** (capped at 100,000 reputation
  worth), **but only if you are already a member of that faction.** Applied
  immediately as favor — no augmentation install needed to realize it.
  **derived, not yet checked this session:** which factions Ken is currently
  a member of, and therefore which opponent choices could ever pay out favor
  at all, is unconfirmed — worth checking with `ns.getPlayer().factions` or
  the Factions page before optimizing opponent selection for this specifically.

### What the game already exposes for analysis

**official doc**, `NetscriptDefinitions.d.ts` lines ~5170–5715 (`Go`,
`GoAnalysis`, `GoCheat` interfaces, read in full this session):

| Function | RAM | What it's for |
| --- | --- | --- |
| `go.makeMove(x, y, playAsWhite?)` | 4GB | Play a move, await the opponent's reply in the same promise |
| `go.passTurn(passAsWhite?)` | 0GB | Pass; ends the game if the opponent also just passed (or passes next) |
| `go.opponentNextTurn(logOpponentMove?, playAsWhite?)` | 0GB | Get/await the opponent's move without playing your own — for picking a game back up mid-turn |
| `go.getBoardState()` | 4GB | Current board, as column-strings |
| `go.getMoveHistory()` | 0GB | All prior board states this game |
| `go.getCurrentPlayer()` | 0GB | `"White"` \| `"Black"` \| `"None"` (none = game over) |
| `go.getGameState()` | 0GB | Current player, both scores, previous move, komi, bonus cycles |
| `go.getOpponent()` | 0GB | Which faction owns the current subnet |
| `go.resetBoardState(opponent, boardSize)` | 0GB | Abandon the current game (if any) and start a fresh subnet |
| `go.analysis.getValidMoves(boardState?, priorBoardState?, playAsWhite?)` | 8GB | Per-point legal-move boolean grid |
| `go.analysis.getChains(boardState?)` | 16GB | Per-point network/chain ID, `null` for dead nodes |
| `go.analysis.getLiberties(boardState?)` | 16GB | Per-point open-port count for that point's chain, `-1` for empty/dead |
| `go.analysis.getControlledEmptyNodes(boardState?)` | 16GB | Per-empty-point: which color fully encircles it, `'?'` if contested |
| `go.getStats()` / `go.resetStats()` | 0GB | Win/loss/streak/favor history per opponent |
| `go.highlightPoint`/`clearPointHighlight`/`clearAllPointHighlights` | 0GB | Pure UI, no gameplay effect |

**`go.cheat.*` ("Illicit and dangerous IPvGO tools") requires Source-File
14.2** — every method's doc comment says so explicitly. **confirmed live
this session, separately:** Ken doesn't have SF14.2, and doesn't even have
SF4 yet. `ipvgo_player.js` never references `ns.go.cheat` anywhere in its
source specifically so Bitburner's static RAM analyzer never has a reason to
gate on it — same avoidance strategy as `hacking/backdoor.js` had to add
*after the fact* for `ns.singularity` (see `docs/processes.md`'s note on
that file), just applied up front here instead. The base `ns.go` /
`ns.go.analysis` surface carries **no** Source-File notice anywhere in the
`.d.ts` — expected to just work, but `ipvgo_player.js` still checks
defensively on startup (`checkGoApiAvailable`) rather than assuming, same
one-clear-`tprint`-line pattern.

### Confirmed live: there is already a game in progress

**confirmed live**, read directly off Ken's running game over CDP this
session (screenshot, not inferred): a 7×7 subnet, "Subnet owner: Netburners,"
score **Black 21 / White 25.5**, mid-game with several networks of both
colors on the board. `ipvgo_player.js` is built to pick this up and keep
playing it — `resetBoardState` is only ever called once
`ns.go.getCurrentPlayer() === "None"` for the *current* game, never on
script startup — so the first live run continues this exact game rather
than throwing away whatever state currently exists.

---

## The starter script Bitburner itself ships in its docs

**official doc**, the in-game Documentation → IPvGO page (distinct from the
"How to Play" tab — this one is specifically about scripting, titled
"Automating IPvGO," read in full over CDP this session). It walks through
building a script in the exact order `ipvgo_player.js` implements:

1. Check `analysis.getValidMoves()` for legality.
2. Fall back to a random valid move, deliberately skipping points where `x %
   2 === 0 && y % 2 === 0` ("leave some airspace") so you don't fill in your
   own networks' last escape routes.
3. Call `makeMove`/`passTurn`, loop until `result.type === "gameOver"`.
4. **Capture**: any valid move adjacent to an opponent chain with exactly 1
   liberty (via `analysis.getLiberties()`) captures that whole chain.
5. **Defend**: any valid move adjacent to a friendly chain with exactly 1
   liberty saves it — but only if the new point itself has ≥2 empty
   neighbors, or also touches a *different* friendly chain with ≥3
   liberties (otherwise the "defense" is instantly recapturable).
6. **Smother**/**expand**/**encircle**/**eyes**: documented as further
   refinements, explicitly not required for a script to start scoring points
   — "the script will consistently get points on the subnet against most
   opponents... and will sometimes even get lucky and win against the
   easiest factions" with just steps 1–5.

`ipvgo_player.js` implements exactly steps 1–5 (capture > defend > expand >
random-with-airspace > anything-valid > pass) and stops there deliberately,
per this task's own instruction to get a correct move-loop working before
optimizing further. Steps 6 are the concrete next-step list, not guesswork —
see "Next steps" below.

---

## What's built: `ipvgo_player.js`

Repo-root standalone script (same tier as `mcp_stocks.js` — a self-contained
feature, not wired into `mcp.js`/`startup.js`/`mcp_supervisor.js`).

- **Self-supersedes** on startup (kills any other running copy) — the
  in-game doc's own advice, since only one subnet can be active at a time.
- **Never resets an in-progress game.** Only calls `resetBoardState` once
  `getCurrentPlayer() === "None"` for the current game.
- **Picks the opponent/board-size only for the *next* fresh game**
  (`ns.args[0]`/`ns.args[1]`, default `"Netburners"`/`7` — a placeholder
  matching whatever was already live, not a tuned choice; see "Open
  questions" below).
- Logs one `ns.tprint` line per completed game (both scores, win/loss,
  lifetime record) and one at startup (its own `ns.getScriptRam()` figure —
  see "RAM" below).
- Loop body is wrapped in try/catch — an unexpected error prints one line
  and the loop retries after 1s, rather than crashing the whole script.

## RAM — arithmetic so far, not yet measured

`ns.getScriptRam()` prints on every startup, the same empirical-check habit
`dnet_deploy.js`'s docstring already uses — **this repo has been burned by
RAM estimates not matching Bitburner's static analyzer before,** so treat
the number below as a placeholder until a real run confirms it.

Arithmetic total, adding up every `ns.go`/`ns.go.analysis` function actually
referenced in the source plus the 1.6GB baseline:

1.6 (baseline) + 4 (`makeMove`) + 4 (`getBoardState`) + 8 (`getValidMoves`) +
16 (`getLiberties`) = **~33.6GB**, arithmetic only.

`getChains()` (16GB) and `getControlledEmptyNodes()` (16GB) are
deliberately **not** referenced yet — they're only needed for the
"encircling"/"eyes" move types this version doesn't implement — so adding
them later will also raise this number; check the `tprint`ed figure again
after any such change, don't just re-add to this estimate by hand.

---

## 2026-08-11 (later): why the first ~22 games were 1 win, and the fix

Ken asked directly whether anyone was actually watching/revising IPvGO
results. First live run happened earlier the same day (see "Status" below);
by the time this follow-up investigation started, `ipvgo_status.json` showed
**1 win in 22 games**, several near-total shutouts (0 vs 49.5, 2 vs 45.5 —
on a 7x7 board with only 49 total points). Investigated per this task's own
priority order: verify scoring/color assumptions first, then look for an
actual logic bug, before assuming the heuristic just needs to be smarter.

**Scoring interpretation and color assignment: both confirmed correct, not
the bug.** Read the live IPvGO Subnet page directly over CDP
(`document.body.innerText` after clicking the nav item — no game state
touched, purely observational) several times across one game, and compared
its own `Score: Black: N White: M` line against `ns.go.getGameState()`'s
`blackScore`/`whiteScore` as written to `ipvgo_status.json` — they match
exactly. Player color stayed Black throughout, never flipped. **confirmed
live.** Also settled the open faction-membership question from "Open
questions" below: Ken **is** a member of Netburners (112.491 favor via the
Factions page, read live over CDP), so the two-wins-streak favor payout
against the current default opponent is real, not moot.

**What was actually wrong, found by watching a game evolve, not just its
final score:** polled the live board repeatedly (~6-10s apart) across one
game and saw Black's score go 23 → 29 → 13 → 6 → 2 while White climbed
steadily to 45.5 — a solid mid-game lead (Black *ahead* 29-18.5 at one
point) collapsing to a near-total shutout within that same game, not a slow
loss. Pulled the script's own move log via the in-game tail window (Active
Scripts → ipvgo_player.js → LOG, read over CDP) to see why: `findExpandMoves`
dominates the middle of every game (capture/defend fire rarely — most
turns fall through to expand), and it had **zero liberty-safety checking**,
unlike `findDefendMoves`. It accepted any move touching *any* friendly
stone regardless of the resulting shape. The consequence: the bot's stones
all merge into one single connected network sharing one liberty pool, with
no separate eye shapes — exactly the "eyes" gap this doc's own next-steps
list already named as unbuilt. A single blob with no eyes is
unconditionally capturable once an opponent finds the vital point, and the
*entire board* dies in one move when it goes — matching the shutout scores
in `ipvgo_status.json` exactly. **confirmed live** (the CDP score trace and
move log) + **derived** (the single-network causal mechanism — reasoned
from the move log and the game's documented capture rules, not directly
observed as a single board-state diff at the moment of collapse).

**Fix applied**: extracted `findDefendMoves`'s existing "is this extension
instantly recapturable" safety check (2+ empty neighbors of its own, or a
link to a *different* friendly chain with 3+ liberties — the in-game doc's
own logic, previously only used for defending an already-atari'd chain)
into a shared `isSafeExtension` helper, and now also apply it to
`findExpandMoves`: safe extensions are preferred; a risky one is only
played if nothing safer touches a friendly chain at all (so nothing is lost
versus before — a risky move that's the *only* candidate still gets played,
just deprioritized when a safer alternative exists). This is the
no-extra-RAM half of "give the bot some life-and-death sense" — it does
**not** build real eye-shape awareness (still needs `getChains()` /
`getControlledEmptyNodes()`, 16GB apiece, unbuilt — see "Open questions"
below), but it stops the bot from *volunteering* the thin, easily-cut
connections that make a one-move total collapse likely in the first place.
Covered by 16 new tests in `ipvgo_player.test.js` (`node --test
ipvgo_player.test.js`) against small hand-built boards using the real
`board[x][y]` convention — all pass, as does the full repo suite (46 tests).

**Not yet re-verified live** — see `docs/claude-todo.md`'s matching
2026-08-11 entry for why: pushing the fix surfaced a separate, unrelated,
already-live bug in `tools/bb_remote.py` (an oversized `mcp_status_log.txt`
tripping the websocket library's default 1MB message-size limit and killing
the whole daemon connection on every reconnect). Fixed in code
(`max_size=20MB` on the server), but needs the daemon *process* restarted
to take effect, which this session could not do (process-kill blocked by
the sandbox). Once that's unblocked, the already-committed fix pushes
automatically (it's already in `WATCHED_FILES`) — the only remaining steps
are `run ipvgo_player.js` in the live terminal to reload, then watching
`ipvgo_status.json` for a real change in the win rate / shutout frequency.

## Open questions / next steps, in the order they're actually worth doing

1. ~~Get it running live, once.~~ **Done** — see "Status" below.
2. ~~Watch the first few games.~~ **Done, then some** — see the 2026-08-11
   (later) section above for what that watching actually found.
3. ~~Check faction membership before tuning opponent choice for favor.~~
   **Done** — Ken is in Netburners. **confirmed live.**
4. ~~Get the self-atari fix actually running and watch its effect on the win
   rate.~~ **Done** — 3 wins / 5 games, most recently 45-1.5. Then
   superseded by the Monte Carlo rewrite before a large-enough sample
   accumulated under the heuristic alone.
5. **Run the 2026-08-12 Monte Carlo rewrite live and measure a real sample
   against the 90% target.** This is now the single most important next
   step — everything above it is done, and item 6 below only matters if
   this one falls short. Needs one `run ipvgo_player.js` in the live
   terminal (already pushed; see `docs/claude-todo.md`'s 2026-08-12 section
   for the exact remaining step) and then enough games for the number to
   mean something — this doc's own standing discipline says not to declare
   victory *or* failure off a handful of games.
6. **If 90% isn't hit, the next lever is more playouts per move (currently
   20) before reaching for a structurally different algorithm** — flat
   Monte Carlo's accuracy scales with sample size, and the profiled timing
   headroom (~150-300ms/move at 20 playouts, well under any tick-starving
   threshold) suggests there's room to raise it substantially before
   timing becomes the constraint. MCTS/UCT (reallocating playouts toward
   promising moves instead of a fixed budget per candidate) is the
   documented structural next step after that, per Coulom's paper cited
   above.
7. **Add real eye-shape awareness via `getChains()`/`getControlledEmptyNodes()`
   is likely no longer the right next step** — the Monte Carlo rewrite
   addresses the same underlying problem (groups dying because nothing
   evaluates their survival) more generally, via actual simulated outcomes
   rather than a hand-written shape rule. Revisit only if live results show
   the bot still losing to whole-group captures despite Monte Carlo
   evaluation, which would suggest playout count/quality, not missing eye
   detection, is the bottleneck.
8. **Add the documented smother/encircle move types** — largely superseded
   by the Monte Carlo rewrite (a move that smothers/encircles well should
   already show up as high-margin in simulation); revisit only if a
   specific tactical pattern keeps losing games after 90%-target
   measurement.
9. **Stat-multiplier bonuses accrue from territory held regardless of win/
   loss** (see "Scoring and rewards") — `bonusPercent`/`bonusDescription`
   are now plumbed into `ipvgo_status.json` (see the 2026-08-12 section
   above), but their exact live meaning still isn't independently
   confirmed by reading a real value — a one-line check once the rewrite is
   running live.
10. **Once 90% is genuinely demonstrated** (this task's own explicit
    ordering — not before), try a larger board via
    `ns.go.resetBoardState(opponent, size)`.

## Where this genuinely might be wrong

- **The `"Netburners"`-is-easier claim is derived, not measured** — nothing
  here has actually compared win rates across opponents. It's the opponent
  of the subnet that happened to already be live, kept as the default out of
  convenience, not evidence.
- **The defend/expand safety check is a direct transcription of the in-game
  doc's own logic, not independently verified against edge cases** — e.g. it
  doesn't check whether the "different friendly chain" it's connecting to
  is actually still there after superko considerations. It's also a
  heuristic, not real life-and-death analysis — it can still be wrong about
  whether a shape is actually safe in cases the in-game doc's simple rule
  doesn't cover. Real games are the actual test, and the live re-verification
  of this exact fix is still pending (see above).
- **RAM is now measured, not arithmetic** — 34.45GB confirmed via the
  script's own startup `ns.tprint`, superseding the ~33.6GB estimate below.
- **The single-network collapse mechanism is derived, not directly
  observed as a board-state diff** — the CDP score trace (29→13→6→2) and
  the move log strongly support it, and it matches the game's documented
  capture rules exactly, but no single board state was captured at the
  literal moment of a whole-network capture this session.

## Status

- [x] Read the full `Go`/`GoAnalysis`/`GoCheat` API surface in
  `NetscriptDefinitions.d.ts` (~line 5143–5715).
- [x] Read the in-game "How to Play" tab and the in-game "Automating IPvGO"
  documentation page, both live over CDP, confirming the reward structure
  (area scoring, komi, stat multipliers, favor-on-streak) and getting the
  official starter-script logic straight from the source Bitburner ships.
- [x] Confirmed live there is an existing in-progress game (7x7, Netburners,
  Black 21/White 25.5) that a first run should continue, not discard.
- [x] Built `ipvgo_player.js` at repo root, implementing capture > defend >
  expand > random-with-airspace > anything-valid > pass, self-supersede, and
  a defensive Go-API-availability check.
- [x] `node --check ipvgo_player.js` passes.
- [x] **Pushed and run live.** RAM confirmed at 34.45GB via its own startup
  `ns.tprint`.
- [x] Live win/loss data collected: 1 win in 22 games before this
  investigation, several shutout-shaped losses — see the 2026-08-11 (later)
  section above for the diagnosis and fix.
- [x] Root-caused the shutout pattern: `findExpandMoves` had no
  liberty-safety check, letting the bot's stones merge into one
  no-separate-eyes network that dies all at once. Fixed by reusing
  `findDefendMoves`'s own safety check (`isSafeExtension`) for expansion
  too. 16 tests at the time, all passing. (This heuristic and its tests
  were superseded and removed by the 2026-08-12 Monte Carlo rewrite below —
  kept here only as the historical record of what shipped and why.)
- [x] **Fix re-verified against live games**, once the daemon bug was
  unblocked: `ipvgo_status.json` showed 5 games / 3 wins under the
  self-atari-fixed heuristic by the time the 2026-08-12 rewrite below
  started, most recently a 45–1.5 win (vs. the pre-fix 1-in-22 record) —
  real signal the fix worked, on a sample too small to call a rate. This is
  the heuristic-era baseline the 2026-08-12 Monte Carlo rewrite below is
  actually trying to beat.
- [x] **2026-08-12: replaced the heuristic with a real, cited algorithm
  (flat Monte Carlo) and a from-scratch local rules engine** — see the new
  section immediately below for the full writeup. Pushed live
  (`ctl-push`, round-trip-verified via `ctl-get`) but **not yet started
  with `run ipvgo_player.js` in the live terminal** — see
  `docs/claude-todo.md`'s 2026-08-12 section for the one remaining step.

## 2026-08-12: flat Monte Carlo rewrite — real algorithm, cited, targeting 90%

Ken's own words, relayed verbatim: **"find on the internet a good
rudimentary go algorithm to implement. Goal, 90% win rate, then move up to
a larger board."** This is a request for a *found*, published, citable
algorithm — not another from-scratch heuristic derived from the game's own
tutorial text (which is what both the original version and the 2026-08-11
fix were). What follows is what was actually searched for, what was found,
what got built, and — critically, since a good algorithm badly measured is
indistinguishable from a bad one — what's actually confirmed vs. still
pending.

### What was searched for and found

**source**, all via live web search this session:

- **Bernd Bruegmann's GOBBLE (1993)** — the first program to use Monte
  Carlo evaluation in Go. Its algorithm, per Bouzy & Helmstetter's own
  historical account: to pick a move, play a large number of *almost
  entirely random* games to completion from that move, score each one, and
  average the scores — the move with the best average wins. Its *only*
  domain-specific knowledge was forbidding a move that fills your own eye.
  **source**: Bouzy & Helmstetter, "Developments on Monte-Carlo Go"
  (https://helios2.mi.parisdescartes.fr/~bouzy/publications/acg10.pdf).
- **Bouzy & Helmstetter's own Olga/Oleg programs (early 2000s)** — a
  deliberately *simpler* Monte Carlo approach than Bruegmann's, cheap
  enough to generate ~7000 random 9x9 games/sec on 2GHz-era hardware. This
  is the concrete evidence that "flat" (no tree search) Monte Carlo Go is
  genuinely implementable in a scripting language against small boards,
  which is exactly this repo's situation (5/7/9/13, currently 7x7). Same
  source as above.
- **Rémi Coulom, "The Monte-Carlo Revolution in Go"**
  (https://www.remi-coulom.fr/JFFoS/JFFoS.pdf) — corroborates the above and
  discusses the "light" (pattern/capture-biased) playout refinement that
  came later; used here to make an informed choice *not* to implement that
  refinement this round (see "Playout policy" below).
- **"Implementing the Game of Go, Part 1"**
  (https://www.moderndescartes.com/essays/implementing_go/) — a
  from-first-principles rules-implementation guide: flood-fill chain/
  liberty discovery, capture-then-suicide-check ordering, a simple-ko-by-
  single-capture detection rule, border-flood-fill area scoring. This is
  the shape `ipvgo_logic.js`'s rules engine follows, cross-checked against
  this doc's own transcription of Bitburner's actual rules text above.
- **Wikipedia's "Two eyes"** (https://en.wikipedia.org/wiki/Two_eyes) and
  Polgote's "Eyes and False Eyes in Go"
  (https://polgote.com/blog/eyes-and-false-eyes-go/) — the standard
  diagonal-based "true eye" heuristic used to keep the random playout
  policy from filling in its own group's eye.

This is exactly the "Monte Carlo Go / light random-playout evaluation"
approach flagged as worth investigating in this task's own brief — real,
published, predates deep learning, and well suited to small boards.
Deliberately the *flat* version (no tree search / UCT) — see "Known
limitations" below for why, and what the actual next step would be if this
round's numbers justify it.

### What got built

All in `ipvgo_logic.js` (new — split out of `ipvgo_player.js` the same way
`mcp_logic.js` split out of `mcp.js`, since this is now meaningfully more
pure logic than a single file should carry):

- **A from-scratch local Go rules engine**, run only against in-memory
  board copies, never against the real game — `applyMoveFlat` (capture,
  suicide prevention with the game's own "except when it captures"
  exception, a simplified single-capture ko rule), `findChain` (flood-fill
  chains/liberties), `scoreAreaFlat` (area scoring matching this doc's own
  "Scoring and rewards" section above: one point per stone, one point per
  empty point fully surrounded by one color, dead nodes never count).
  Satisfies this task's own constraint that no hypothetical move may ever
  be played for real via `ns.go.makeMove` — every simulation runs against a
  local `Uint8Array` copy seeded once per turn from the real
  `ns.go.getBoardState()`.
- **`chooseBestMove`**: for every point the real game currently reports as
  valid (`ns.go.analysis.getValidMoves()`), play it locally, then run
  `NUM_PLAYOUTS` (20, tunable in `ipvgo_player.js`) random rollouts to
  completion from the result and average the score margin. Play whichever
  candidate has the best average margin. This is literally Gobble's own
  algorithm, applied to Bitburner's IPvGO ruleset.
- **Why this should be a real improvement, not just a different
  heuristic**: the 2026-08-11 bug (a single no-eyes blob dying whole-board
  at once) was a *life-and-death* failure — the old heuristic had no way to
  evaluate whether a shape survives. Monte Carlo doesn't need a hand-written
  rule for that: a move that leads to the whole group dying shows up
  directly as a bad average score across the simulated continuations that
  follow it, because those continuations are *actual simulated Go games*,
  not a proxy heuristic. This is a more general fix than the specific
  `isSafeExtension` patch, and does it without `getChains()`/
  `getControlledEmptyNodes()` (16GB apiece) — arguably resolving open
  question #5 below by a different, cheaper route than the one originally
  planned.

### Playout policy: simpler than first drafted, on purpose, after profiling

The first draft added a capture-seeking bias to the random playout policy
(the "light playout" refinement Coulom's paper describes as generally
stronger than pure-uniform rollouts). Implementing it required enumerating
every legal move each rollout step to know which ones captured something.
**Profiling this on an empty 7x7 board found it took multiple *seconds* per
move** (`chooseBestMove` at 10 playouts: 2.4s; at 20 playouts: 5.3s) —
unacceptable given this task's own "don't starve the shared game/event
loop" constraint, since move selection runs synchronously on the same
single JS thread as the rest of the game and `mcp.js`.

**Fix**: switched move selection inside playouts to rejection sampling (try
random empty points, accept the first legal non-eye-filling one) instead of
enumerating every point's legality every step. This cut the same benchmark
to ~100-300ms at 10-40 playouts — roughly a 20-30x speedup — simply by
needing ~1 legality check per accepted move instead of ~n. The tradeoff:
implementing the capture bias efficiently under rejection sampling wasn't
straightforward, so it was dropped rather than re-added at the cost of the
same slowdown. The resulting playout policy — uniform random among
non-eye-filling legal moves, nothing else — is actually a *closer* match to
Bruegmann's original Gobble policy than the first draft was, so this
counts as a fidelity improvement as much as a performance one. **derived +
confirmed live (locally, via `node -e` profiling, not yet in the actual
game)**: see `ipvgo_logic.js`'s own header for the full before/after story.

### Known limitations (stated up front, not discovered by surprise later)

- **Ko is a simplified single-capture rule, not full superko** — matters
  only inside simulated playouts (used for move *evaluation*), since the
  actual move submitted to the live game is always gated by
  `ns.go.analysis.getValidMoves()`, the real authoritative check.
- **Eye detection is a diagonal heuristic, not true life-and-death
  analysis** — good enough to keep rollouts from self-destructing, not a
  claim of correctness in unusual shapes.
- **Flat Monte Carlo, not MCTS** — every candidate gets a fixed playout
  budget; nothing reallocates simulation time to promising moves the way
  UCT-based search does. This is a known, published limitation of the
  original approach (Coulom's paper), not a bug — the documented next step
  if this round's numbers justify further investment.
- **No capture bias in the playout policy** (see above) — a deliberate
  simplicity/speed tradeoff, closer to Gobble's original policy, not an
  oversight.
- **NUM_PLAYOUTS=20 and the resulting ~150-300ms/move timing are profiled
  locally against synthetic boards, not yet measured against the actual
  live game's real move cadence** — see "Status" below for the concrete
  next step.

### Status file additions (2026-08-12, at the coordinator's request)

Two follow-up asks arrived from the coordinator while this rewrite was in
progress, both folded into the same `ipvgo_status.json` schema pass rather
than done as separate changes:

1. **Streak/reward fields for the dashboard's "rewards" section**:
   `winStreak`, `highestWinStreak`, `favorRep`, `bonusPercent`,
   `bonusDescription`, `opponentLifetimeWins`, `opponentLifetimeLosses` —
   all read from `ns.go.analysis.getStats()` (**official doc**,
   `NetscriptDefinitions.d.ts`'s `SimpleOpponentStats` type, 0GB,
   persistent across script restarts since it's the game's own record, not
   this script's memory). **Not independently confirmed live**:
   `bonusPercent`/`bonusDescription`'s exact real-world meaning (i.e.
   whether it really is the "territory held" stat-multiplier bonus this
   doc's "Scoring and rewards" section describes) hasn't been checked
   against an actual live value yet — the .d.ts only documents the field
   names as "stat boost"/"description of stat boost", and this is the only
   stat-boost-shaped field anywhere in the Go API, so it's a reasonable
   inference, not a confirmed fact. Flagged explicitly rather than
   asserted, per the coordinator's own "say so rather than guessing"
   instruction.
2. **A rolling last-100-games win rate**, so the dashboard's win rate isn't
   diluted by a previous (weaker) algorithm generation's results — Ken's
   own reasoning, relayed by the coordinator, and directly relevant to this
   task's own 90%-win-rate measurement too. Implemented as `recentGames`
   (capped ring buffer, each `{won, blackScore, whiteScore, ts}`),
   `recentGamesCount`, `recentWinRate`. Restart-safe (read back from the
   existing file on startup) but scoped to an `algorithm` tag
   (`"monte-carlo-flat-v1"` for this version) — a restart of the *same*
   algorithm resumes the window, but this rewrite itself (and any future
   one) starts its own window fresh rather than blending across algorithm
   generations, which would reproduce the exact dilution problem the
   window exists to solve. This also fixed a pre-existing, previously
   unnoticed bug: `gamesPlayed`/`wins` used to reset to 0 on every script
   restart (an in-memory-only counter, contrary to CLAUDE.md's own "keep
   what matters in files" discipline) — now restart-safe via the same
   mechanism.
