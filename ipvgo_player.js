/**
 * Plays Bitburner's IPvGO subnet minigame via ns.go, forever, unattended.
 *
 * ## 2026-08-12 rewrite: flat Monte Carlo move selection
 *
 * Replaces the prior hand-written heuristic (capture > defend > expand >
 * random, see git history / docs/ipvgo-strategy.md's 2026-08-11 sections)
 * with a real, citable, published algorithm, per this task's own brief:
 * "find on the internet a good rudimentary go algorithm to implement."
 * All pure board logic (a from-scratch local Go rules engine: flood-fill
 * chains/liberties, capture, suicide prevention, a simplified ko rule, area
 * scoring, simple-eye detection) plus the move-selection algorithm itself
 * now live in ipvgo_logic.js.
 *
 * ## 2026-08-12 (later): flat Monte Carlo -> MCTS/UCB1, plus opening-move learning
 *
 * After the flat-MC version ran live (61 games, 41% rolling win rate --
 * real progress from ~0% under the old heuristic, but short of the 90%
 * target -- with large unused timing headroom, avg 52ms/max 164ms per
 * move), upgraded to real tree search: Monte Carlo Tree Search with UCB1
 * (Kocsis & Szepesvári, 2006), which spends more of the simulation budget
 * on moves that are looking good rather than splitting it evenly across
 * every candidate. Also added a simple cross-game learning layer: track
 * which opening moves (the very first move of a fresh game) have actually
 * correlated with wins in `ipvgo_status.json`'s `recentGames` history, and
 * give a qualifying move (only once it has enough recorded games -- see
 * `DEFAULT_MIN_OPENING_SAMPLE`) a modest head start in the search via
 * virtual visits (Gelly & Silver, 2007). Full citations, algorithm design,
 * and known limitations (including why the reward signal is win/loss
 * rather than score margin, and why komi is now explicitly threaded
 * through) are in ipvgo_logic.js's own header. `node --test
 * ipvgo_logic.test.js` covers the rules engine, the UCB1 formula itself,
 * MCTS move selection, and the opening-stats aggregation, all against
 * small hand-built boards/fixtures.
 *
 * This file is now just the ns.go event loop: fetch the real board and
 * real valid-move grid from the game each turn, ask ipvgo_logic.js's
 * chooseBestMove() for the best move via MCTS, submit it, and track/
 * persist results (including which move opened each game, for the
 * learning layer above).
 *
 * ## Status file (ipvgo_status.json)
 *
 * Extended twice on 2026-08-12 at the coordinator's request, for the
 * status-dashboard's IPvGO scoreboard:
 *
 * - `winStreak`, `highestWinStreak`, `favorRep`, `bonusPercent`,
 *   `bonusDescription`, `opponentLifetimeWins`, `opponentLifetimeLosses` --
 *   from `ns.go.analysis.getStats()` (0GB, official doc), the game's own
 *   all-time per-opponent record. See readOpponentStats() below for the
 *   one caveat (bonusPercent/bonusDescription's exact live meaning isn't
 *   independently confirmed, just a well-founded inference from the .d.ts
 *   field names).
 * - `recentGames` (capped at RECENT_GAMES_WINDOW, each `{won, blackScore,
 *   whiteScore, ts}`), `recentGamesCount`, `recentWinRate` -- a rolling
 *   window kept specifically so the win rate isn't diluted by an old,
 *   weaker algorithm generation's results (Ken's own reasoning, relayed by
 *   the coordinator) -- exactly the same problem this task's own 90%-win-
 *   rate target has to watch for after a rewrite. Restart-safe (see
 *   loadPersistedStatus()) but deliberately *not* carried over across an
 *   `algorithm` tag change, for the same dilution reason.
 * - `gamesPlayed`/`wins` are the full cumulative count for the current
 *   `algorithm` tag specifically (also restart-safe now, which fixes a
 *   pre-existing bug: these used to reset to 0 on every script restart,
 *   contrary to CLAUDE.md's own "keep what matters in files" discipline).
 *
 * Deliberately never references ns.go.cheat.* (Illicit and dangerous IPvGO
 * tools -- the game's own d.ts doc comment on GoCheat says "Requires
 * Source-File 14.2 to use"; confirmed live Ken doesn't have SF14.2, and
 * doesn't even have SF4 yet). Bitburner's RAM statically analyzes only
 * functions actually referenced in the source, so simply never writing
 * ns.go.cheat anywhere in this file means there is nothing to guard against
 * at runtime -- see docs/processes.md's note on hacking/backdoor.js for
 * what the alternative failure mode (an uncaught RUNTIME ERROR for a
 * missing Source-File) looks like.
 *
 * Picks up an in-progress game as-is (does not reset it). Only calls
 * ns.go.resetBoardState() once the current game has actually ended
 * (ns.go.getCurrentPlayer() === "None"), using opponent=args[0] (default
 * "Netburners") and boardSize=args[1] (default 7) for every game after the
 * first.
 *
 * Self-supersedes: kills any other running copy of this same script on
 * this host first, since the game can only have one active subnet at a
 * time.
 *
 * ## RAM
 *
 * The old version measured 34.45GB live (its own startup ns.tprint),
 * arithmetic-estimated at ~33.6GB from makeMove(4) + getBoardState(4) +
 * getValidMoves(8) + getLiberties(16) + 1.6 baseline. This rewrite drops
 * getLiberties() entirely -- all liberty/chain computation now happens
 * locally in ipvgo_logic.js against an in-memory board copy, never against
 * the live game -- so the new arithmetic estimate is 1.6 + 4 (makeMove) + 4
 * (getBoardState) + 8 (getValidMoves) = ~17.6GB. Prints its own
 * ns.getScriptRam() figure on startup as before; treat the number above as
 * a placeholder until a live run confirms it, same as last time.
 *
 * ## Timing
 *
 * Move selection runs entirely synchronously (no `await` inside
 * chooseBestMove), which means it blocks the browser's single JS thread --
 * shared with the rest of the game and with mcp.js's own 10-second tick --
 * for however long it takes. Live data on the flat-MC predecessor (~980
 * total playouts/move): avg 52ms, max 164ms -- comfortable headroom, which
 * is why NUM_SIMULATIONS was raised for the MCTS rewrite. Local profiling
 * of *this* MCTS version on a synthetic empty 7x7 board (worst case): 1500
 * sims ~ 250ms (see ipvgo_logic.js's DEFAULT_NUM_SIMULATIONS comment for
 * the full table and reasoning). **Not yet confirmed against real live
 * play** -- logs its own elapsed-ms per move (ns.print) and tracks avg/max
 * per game in ipvgo_status.json specifically so this can be checked
 * without guessing, per this repo's own "measure live, don't estimate"
 * discipline -- turn NUM_SIMULATIONS down here if that data shows it's too
 * slow.
 *
 * @param {NS} ns
 */

import { chooseBestMove, computeOpeningMoveStats } from "ipvgo_logic.js"

// Total MCTS simulation budget per move (shared across the whole search
// tree, not per candidate the way the old flat-MC NUM_PLAYOUTS was -- see
// ipvgo_logic.js's own header for why that's the entire point of the
// 2026-08-12 (later) MCTS upgrade). 1500 was chosen from local profiling
// (see ipvgo_logic.js's DEFAULT_NUM_SIMULATIONS comment) after live data
// on the flat-MC version showed huge unused timing headroom (avg 52ms, max
// 164ms/move at ~980 total playouts/move); needs live confirmation this
// stays comfortably fast now that the budget has grown -- watch the
// moveMs figures in ipvgo_status.json and turn this down if they climb.
const NUM_SIMULATIONS = 1500

// Tag written into every ipvgo_status.json this script produces, and
// checked on startup (see loadPersistedStatus below) before resuming any
// history from a prior run's file. Bump this string whenever the move-
// selection algorithm changes meaningfully, so a rewrite's rolling window
// and cumulative counters start fresh instead of blending across
// algorithm generations -- see loadPersistedStatus's own comment for why
// that matters, straight from Ken's own reasoning for asking for a rolling
// window in the first place. Bumped from "monte-carlo-flat-v1" for the
// 2026-08-12 (later) MCTS/UCB1 rewrite -- flat MC's 61-game/41%-win-rate
// record should not blend into this version's own rolling window.
const ALGORITHM = "mcts-ucb1-v1"

// How many recent game outcomes to keep for the rolling win rate.
const RECENT_GAMES_WINDOW = 100

// Opening-move learning (added 2026-08-12 (later), at the coordinator's
// request): below this many recorded games for a specific first move,
// computeOpeningMoveStats' data isn't trusted enough to bias anything --
// see ipvgo_logic.js's own DEFAULT_MIN_OPENING_SAMPLE/DEFAULT_OPENING_PRIOR_WEIGHT
// comments for the full reasoning. Left as ipvgo_logic.js's own defaults
// (not overridden here) since there's no live evidence yet either way to
// tune them against.

function killDuplicates(ns) {
  const self = ns.getScriptName()
  const here = ns.getHostname()
  for (const proc of ns.ps(here)) {
    if (proc.filename === self && proc.pid !== ns.pid) {
      ns.tprint(`ipvgo_player: killing duplicate instance (pid ${proc.pid}) -- only one subnet can be active at a time`)
      ns.kill(proc.pid)
    }
  }
}

// ns.go carries no Source-File notice in NetscriptDefinitions.d.ts (unlike
// ns.go.cheat, which needs SF14.2, and unlike ns.singularity, which needed
// SF4 for hacking/backdoor.js) -- expected to just work. Checked defensively
// anyway, same pattern as hasSourceFile4() in hacking/backdoor.js: one clear
// ns.tprint line instead of an uncaught RUNTIME ERROR modal if this
// expectation turns out to be wrong.
function checkGoApiAvailable(ns) {
  try {
    ns.go.getCurrentPlayer()
    return true
  } catch (e) {
    ns.tprint(
      "ipvgo_player: ns.go threw on first call (" + String(e) + ") -- ",
      "this API was expected to need no Source-File, so something else is ",
      "wrong. Not attempting to play. See docs/ipvgo-strategy.md."
    )
    return false
  }
}

// Reads the game's own authoritative per-opponent record via
// ns.go.analysis.getStats() (0 GB, official doc per NetscriptDefinitions.d.ts
// -- see the type comments on SimpleOpponentStats): wins, losses, current
// win streak, highest win streak ever, "favor gain from winstreaks,
// calculated as converted rep," and the stat-multiplier bonus. This is
// persistent game state, not this script process's own memory -- unlike
// the gamesPlayed/wins counters below (which reset to 0 on every script
// restart, per CLAUDE.md's own "restarts wipe in-memory history" warning),
// this survives a restart untouched, which is exactly why it's the right
// source for streak/reward tracking rather than another in-memory counter.
//
// Added 2026-08-12 at the coordinator's request, for the dashboard's
// "rewards" section (favor from win streaks, stat-multiplier bonus from
// territory held). NOTE: bonusPercent/bonusDescription's *exact* live
// meaning is not yet confirmed by actually reading a real
// bonusDescription string -- the .d.ts only documents the field names as
// "Stat boost"/"Description of stat boost", and docs/ipvgo-strategy.md
// separately (and, so far, only via the in-game "How to Play" text, not
// this API) documents that territory held awards a stat-multiplier bonus
// regardless of win/loss. It's a reasonable inference that these are the
// same bonus -- it's the only stat-boost-shaped field the whole Go API
// exposes -- but flagged here explicitly rather than asserted as fact,
// per the coordinator's own "say so rather than guessing" instruction.
function readOpponentStats(ns, opponent) {
  try {
    const stats = ns.go.analysis.getStats()
    const s = stats?.[opponent]
    if (!s) return null
    return {
      wins: s.wins,
      losses: s.losses,
      winStreak: s.winStreak,
      highestWinStreak: s.highestWinStreak,
      favorRep: s.rep,
      bonusPercent: s.bonusPercent,
      bonusDescription: s.bonusDescription,
    }
  } catch (e) {
    ns.print(`ipvgo_player: ns.go.analysis.getStats() threw -- ${String(e)}`)
    return null
  }
}

// Reads back whatever ipvgo_status.json already exists (if anything) on
// startup, so gamesPlayed/wins/recentGames survive a script restart
// instead of resetting to zero/empty every time -- CLAUDE.md's own
// standing warning ("restarts wipe in-memory history... keep what matters
// in files") applies just as much to this script's own counters as it did
// to mcp.js's rateSamples/moneyPctSamples.
//
// Deliberately does NOT resume history from a file written by a different
// `algorithm` tag (including no tag at all, i.e. a pre-2026-08-12 file).
// This matters specifically because of *why* the rolling window was asked
// for: "a rolling recent window is a much more honest signal of whether
// the current algorithm is actually good... an all-time number gets
// diluted by old, worse versions of the bot." Blending the old capture>
// defend>expand heuristic's games into this rewrite's own rolling-100
// window on the very first restart would reproduce exactly the dilution
// problem the window exists to avoid -- so a changed (or missing) tag
// means "start this generation's own history fresh," not "keep going."
function loadPersistedStatus(ns, algorithm) {
	const empty = { gamesPlayed: 0, wins: 0, recentGames: [] }
	try {
		const raw = ns.read("ipvgo_status.json")
		if (!raw) return empty
		const parsed = JSON.parse(raw)
		if (parsed.algorithm !== algorithm) return empty
		return {
			gamesPlayed: Number.isFinite(parsed.gamesPlayed) ? parsed.gamesPlayed : 0,
			wins: Number.isFinite(parsed.wins) ? parsed.wins : 0,
			recentGames: Array.isArray(parsed.recentGames) ? parsed.recentGames.slice(-RECENT_GAMES_WINDOW) : [],
		}
	} catch (e) {
		ns.print(`ipvgo_player: couldn't read/parse existing ipvgo_status.json, starting this algorithm's history fresh -- ${String(e)}`)
		return empty
	}
}

// Persisted so lifetime record/last result can be checked from outside the
// game (ctl-pull, same pattern as mcp_status.json) instead of only living in
// terminal scrollback.
//
// gamesPlayed/wins/recentGames are all now restart-safe (see
// loadPersistedStatus above) and scoped to *this algorithm generation*
// (ALGORITHM), not this script process's uptime and not the opponent's
// all-time record. recentGames/recentWinRate (added 2026-08-12, at the
// coordinator's/Ken's request) is the rolling-last-100 signal meant to
// answer "is the current algorithm actually good" without being diluted by
// a prior rewrite's results; gamesPlayed/wins remain the full cumulative
// count *for this algorithm* (equal to the rolling window's own count
// until more than 100 games accumulate, then diverges to cover the full
// history). opponentLifetime is a separate, third thing again -- the
// game's own all-time record for this opponent, spanning every algorithm
// this script has ever used against it, which is the right source for the
// reward/favor fields specifically (see readOpponentStats above) but the
// wrong source for "is this algorithm good."
function writeStatus(ns, { gamesPlayed, wins, recentGames, opponent, size, lastResult, opponentLifetime }) {
	const recentWins = recentGames.filter((g) => g.won).length
	// Surfaced for the dashboard/coordinator per the 2026-08-12 (later)
	// "keep this simple... say so plainly if the sample size is too small"
	// instruction -- shows exactly what data (if any) the opening-move
	// prior is working from, not just that the feature exists. See
	// computeOpeningMoveStats in ipvgo_logic.js.
	const openingStats = computeOpeningMoveStats(recentGames)
	ns.write(
		"ipvgo_status.json",
		JSON.stringify(
			{
				ts: Date.now(),
				algorithm: ALGORITHM,
				gamesPlayed,
				wins,
				opponent,
				size,
				lastResult,
				// Rolling window, added 2026-08-12: last RECENT_GAMES_WINDOW game
				// outcomes for *this* algorithm generation (see loadPersistedStatus
				// above for why it's scoped that way), each { won, blackScore,
				// whiteScore, ts, openingMove }.
				recentGames,
				recentGamesCount: recentGames.length,
				recentWinRate: recentGames.length ? recentWins / recentGames.length : null,
				// Opening-move learning visibility, added 2026-08-12 (later):
				// gamesWithOpeningData will be 0 for a long while after this
				// deploys (recentGames only gets openingMove going forward, not
				// backfilled) -- that's the honest, expected state, not a bug.
				openingStats,
				// Reward/streak fields, also added 2026-08-12, from
				// ns.go.analysis.getStats() -- see readOpponentStats() above for
				// exactly what each one is, where it comes from, and the one
				// caveat on bonusPercent/bonusDescription's exact live meaning.
				winStreak: opponentLifetime?.winStreak ?? null,
				highestWinStreak: opponentLifetime?.highestWinStreak ?? null,
				favorRep: opponentLifetime?.favorRep ?? null,
				bonusPercent: opponentLifetime?.bonusPercent ?? null,
				bonusDescription: opponentLifetime?.bonusDescription ?? null,
				opponentLifetimeWins: opponentLifetime?.wins ?? null,
				opponentLifetimeLosses: opponentLifetime?.losses ?? null,
			},
			null,
			2
		),
		"w"
	)
}

/** @param {NS} ns */
export async function main(ns) {
  killDuplicates(ns)

  if (!checkGoApiAvailable(ns)) return

  const opponent = ns.args[0] ?? "Netburners"
  const size = Number(ns.args[1] ?? 7)

  ns.tprint(
    `ipvgo_player: starting (RAM ${ns.getScriptRam(ns.getScriptName()).toFixed(2)}GB, ` +
      `MCTS/UCB1, ${NUM_SIMULATIONS} simulations/move, algorithm=${ALGORITHM}). ` +
      `Fresh-subnet default: ${opponent} ${size}x${size} -- an in-progress game is always continued as-is first.`
  )

  let { gamesPlayed, wins, recentGames } = loadPersistedStatus(ns, ALGORITHM)
  let moveMsSum = 0
  let moveMsCount = 0
  let moveMsMax = 0
  // Deliberately NOT the same thing as `gamesPlayed > 0`: gamesPlayed can
  // now be nonzero immediately on startup (loaded from a persisted file --
  // see loadPersistedStatus above), but that says nothing about whether
  // *this process* has actually watched a live game yet. Without this
  // separate flag, restarting the script at the exact moment between two
  // games (board freshly reset, genuinely 0-0, nobody has moved) would
  // satisfy the old `gamesPlayed > 0` check purely from persisted history
  // and record a bogus 0-0 loss. observedActiveGame is only set once this
  // run has actually seen the board in a non-"None" state.
  let observedActiveGame = false
  // The first move *this specific game* actually played (once known),
  // recorded into that game's recentGames entry at game-end -- the raw
  // data computeOpeningMoveStats builds its win-rate-per-opening-move
  // table from. null until the first successful makeMove of a fresh game.
  let openingMove = null
  ns.tprint(
    `ipvgo_player: resuming this algorithm's own record: ${wins}/${gamesPlayed} lifetime, ` +
      `${recentGames.length} game(s) in the rolling window.`
  )
  writeStatus(ns, { gamesPlayed, wins, recentGames, opponent, size, lastResult: null, opponentLifetime: readOpponentStats(ns, opponent) })

  while (true) {
    try {
      if (ns.go.getCurrentPlayer() === "None") {
        const state = ns.go.getGameState()
        const hadAGame = observedActiveGame || state.whiteScore > 0 || state.blackScore > 0
        if (hadAGame) {
          const won = state.blackScore > state.whiteScore
          wins += won ? 1 : 0
          gamesPlayed++
          recentGames.push({ won, blackScore: state.blackScore, whiteScore: state.whiteScore, ts: Date.now(), openingMove })
          if (recentGames.length > RECENT_GAMES_WINDOW) recentGames = recentGames.slice(-RECENT_GAMES_WINDOW)
          const recentWinRate = recentGames.filter((g) => g.won).length / recentGames.length
          const avgMoveMs = moveMsCount > 0 ? moveMsSum / moveMsCount : null
          ns.tprint(
            `ipvgo_player: game over -- black ${state.blackScore} vs white ${state.whiteScore} ` +
              `(${won ? "WIN" : "loss"}). Lifetime ${wins}/${gamesPlayed}, ` +
              `rolling last ${recentGames.length}: ${(recentWinRate * 100).toFixed(1)}%. ` +
              `avg/max move time ${avgMoveMs?.toFixed(0) ?? "?"}/${moveMsMax}ms.`
          )
          writeStatus(ns, {
            gamesPlayed,
            wins,
            recentGames,
            opponent,
            size,
            lastResult: {
              won,
              blackScore: state.blackScore,
              whiteScore: state.whiteScore,
              avgMoveMs,
              maxMoveMs: moveMsMax || null,
            },
            opponentLifetime: readOpponentStats(ns, opponent),
          })
        }
        moveMsSum = 0
        moveMsCount = 0
        moveMsMax = 0
        observedActiveGame = false
        openingMove = null
        ns.go.resetBoardState(opponent, size)
        ns.tprint(`ipvgo_player: new subnet vs ${opponent}, ${size}x${size}.`)
        await ns.sleep(200)
        continue
      }

      // Reaching here means getCurrentPlayer() !== "None" -- there is an
      // active game, whatever happens next this iteration.
      observedActiveGame = true

      // Not our color to move -- most likely we picked up a game where the
      // opponent still owed a move (e.g. the game was closed/reloaded mid-turn,
      // exactly the case ns.go.opponentNextTurn()'s own doc comment calls out).
      if (ns.go.getCurrentPlayer() !== "Black") {
        await ns.go.opponentNextTurn()
        continue
      }

      const board = ns.go.getBoardState()
      const validMoves = ns.go.analysis.getValidMoves()
      // Both 0GB. komi: the real game's actual value for *this* game (not
      // assumed to be the 5.5 default -- see NetscriptDefinitions.d.ts'
      // setTestingBoardState doc comment, which only documents 5.5 as a
      // *parameter default*, not a guarantee for every opponent/game).
      // isOpeningMove: getMoveHistory() is empty iff nobody has played a
      // move yet this game -- the one point where the opening-move prior
      // (see ipvgo_logic.js) is even considered.
      const komi = ns.go.getGameState().komi ?? 0
      const isOpeningMove = ns.go.getMoveHistory().length === 0
      const openingStats = isOpeningMove ? computeOpeningMoveStats(recentGames) : null

      const t0 = Date.now()
      const { move, visits, winRate, simulations, evaluated } = chooseBestMove(board, validMoves, "X", {
        numSimulations: NUM_SIMULATIONS,
        komi,
        isOpeningMove,
        openingStats,
      })
      const elapsedMs = Date.now() - t0
      moveMsSum += elapsedMs
      moveMsCount++
      if (elapsedMs > moveMsMax) moveMsMax = elapsedMs

      if (move) {
        await ns.go.makeMove(move[0], move[1])
        if (openingMove === null) openingMove = move
        let openingNote = ""
        if (isOpeningMove) {
          const key = move[0] + "," + move[1]
          const moveStats = openingStats?.byMove?.[key]
          openingNote = moveStats
            ? ` [opening prior: ${moveStats.games} game(s), ${(moveStats.winRate * 100).toFixed(0)}% win rate]`
            : " [opening: not enough data yet for this move]"
        }
        ns.print(
          `played [${move[0]},${move[1]}] -- ${visits}/${simulations} visits, ` +
            `${(winRate * 100).toFixed(1)}% sim win rate, ${evaluated} candidates, ${elapsedMs}ms${openingNote}`
        )
      } else {
        await ns.go.passTurn()
        ns.print(`passed -- no valid move found (${evaluated} candidates considered)`)
      }
    } catch (e) {
      ns.tprint(`ipvgo_player: error in main loop, continuing -- ${String(e)}`)
      await ns.sleep(1000)
    }
  }
}
