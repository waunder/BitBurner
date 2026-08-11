# IPvGO strategy

A self-contained subsystem, same shape as the darknet set: read the real API
and the real in-game rules first, write down what's confirmed vs. reasoned,
then build a first working version. Citation style matches
`docs/darknet-strategy.md` — every claim below is tagged **official doc**
(the game's own in-game documentation or `NetscriptDefinitions.d.ts`),
**confirmed live** (observed directly in Ken's actual running game),
**derived** (reasoned from the above, not directly observed), or
**speculative**/**unknown**.

**`ipvgo_player.js` is built and syntax-checked, but has not run in Bitburner
yet as of this writing (2026-08-11).** See "Status" at the bottom for exactly
what that means and the one concrete next step.

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

## Open questions / next steps, in the order they're actually worth doing

1. **Get it running live, once.** Nothing here has executed inside
   Bitburner yet — `node --check` only confirms syntax. Needs
   `ctl-push /ipvgo_player.js ipvgo_player.js` (routine, Claude can do this
   any time) and then one `run ipvgo_player.js` in the live terminal.
   Per this task's own instructions, that terminal-write step is being
   handed to the parent conversation rather than reimplemented independently
   here — see `docs/claude-todo.md`'s IPvGO entry for the exact command.
2. **Watch the first few games' `tprint` output** (via CDP tail read, or the
   terminal scrollback directly) to confirm the RAM figure, confirm moves
   are actually landing (no silently-caught errors), and see the real
   win/loss shape against whatever the fresh-subnet default ends up playing.
3. **Check faction membership before tuning opponent choice for favor.**
   The 500-rep-on-two-wins-in-a-row payout only applies to factions Ken is
   already a member of (see "Scoring and rewards" above) — `"Netburners"`
   may or may not even be one of them. Worth one `ns.getPlayer().factions`
   check before spending any thought on opponent selection.
4. **Add the documented smother/encircle/"eyes" move types** once steps 1–3
   have produced real win/loss data to know whether they're actually needed
   — the in-game doc is explicit that capture+defend+expand alone already
   scores points against most opponents, so this is a refinement, not a
   blocker.
5. **Stat-multiplier bonuses accrue from territory held regardless of win/
   loss** (see "Scoring and rewards") — worth eventually reading
   `ns.getPlayer()`'s multiplier fields before/after a session of games to
   confirm this is actually moving a number Ken cares about, the same
   "don't restructure around an unvalidated hypothesis" discipline
   `docs/darknet-strategy.md` used for the stock-access-key question.

## Where this genuinely might be wrong

- **The `"Netburners"`-is-easier claim is derived, not measured** — nothing
  here has actually compared win rates across opponents. It's the opponent
  of the subnet that happened to already be live, kept as the default out of
  convenience, not evidence.
- **The defend-move safety check is a direct transcription of the in-game
  doc's own logic, not independently verified against edge cases** — e.g. it
  doesn't check whether the "different friendly chain" it's connecting to
  is actually still there after superko considerations. Real games will be
  the actual test.
- **RAM is arithmetic, not measured**, flagged twice above deliberately —
  this repo's specific prior experience is that estimates and Bitburner's
  actual static analysis can disagree.

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
- [ ] **Not yet pushed into the game or run.** Next concrete step:
  `ctl-push`, then one `run ipvgo_player.js` — see `docs/claude-todo.md`.
- [ ] RAM not yet empirically confirmed (arithmetic estimate only, see
  above).
- [ ] No live win/loss data yet — everything under "Open questions" above is
  blocked on the first live run.
