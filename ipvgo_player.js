/**
 * Plays Bitburner's IPvGO subnet minigame via ns.go, forever, unattended.
 *
 * First version — a correct move-loop before optimizing strategy, per
 * docs/ipvgo-strategy.md. Move priority follows the game's own in-game
 * documentation (Documentation -> IPvGO, read live over CDP 2026-08-11) in
 * order: capture a vulnerable enemy network > defend a vulnerable friendly
 * one > expand a friendly network > play a random safe move > play anywhere
 * valid > pass. Smothering, encircling ("eyes"), and jump moves are the
 * documented next steps, not implemented yet — see the strategy doc.
 *
 * Deliberately never references ns.go.cheat.* (Illicit and dangerous IPvGO
 * tools — the game's own d.ts doc comment on GoCheat says "Requires
 * Source-File 14.2 to use"; confirmed this session Ken doesn't have SF14.2,
 * and doesn't even have SF4 yet). Bitburner's RAM statically analyzes only
 * functions actually referenced in the source, so simply never writing
 * ns.go.cheat anywhere in this file means there is nothing to guard against
 * at runtime — no uncaught RUNTIME ERROR risk the way ns.singularity.* was
 * for hacking/backdoor.js without SF4 (see docs/processes.md's note on that
 * file for what that failure mode looks like). The base ns.go/ns.go.analysis
 * surface carries no such Source-File notice in the .d.ts, so it's expected
 * to work as-is — checked defensively anyway, see checkGoApiAvailable below,
 * same "one clear ns.tprint line instead of an uncaught error" pattern.
 *
 * Picks up an in-progress game as-is (does not reset it) — there was a live
 * Netburners 7x7 subnet already in progress (black 21 / white 25.5) when
 * this was written, confirmed live by reading the IPvGO Subnet page over
 * CDP. Only calls ns.go.resetBoardState() once the current game has actually
 * ended (ns.go.getCurrentPlayer() === "None"), using opponent=args[0]
 * (default "Netburners") and boardSize=args[1] (default 7) for every game
 * after the first — a placeholder choice, not a tuned one; see the strategy
 * doc for what to revisit once favor/faction targeting matters. "Netburners"
 * is generally considered one of the easier opponents (unconfirmed —
 * derived from board familiarity, not measured win rate).
 *
 * Self-supersedes: kills any other running copy of this same script on this
 * host first, since the game can only have one active subnet at a time (the
 * in-game doc's own "Killing duplicate scripts" note) and two copies would
 * otherwise fight over the same board.
 *
 * RAM: not yet measured against the game's static analyzer — see
 * docs/ipvgo-strategy.md's "Confirmed vs. reasoned" section. Referenced
 * ns.go calls and their documented costs (from NetscriptDefinitions.d.ts):
 * makeMove 4GB, passTurn 0, opponentNextTurn 0, getBoardState 4GB,
 * getCurrentPlayer 0, getGameState 0, resetBoardState 0,
 * analysis.getValidMoves 8GB, analysis.getLiberties 16GB — arithmetic total
 * ~33.6GB including the 1.6GB baseline, not a measurement. Prints its own
 * ns.getScriptRam() figure on startup (0GB call) the first time it actually
 * runs, the same empirical-check pattern dnet_deploy.js's docstring uses.
 *
 * @param {NS} ns
 */

// The starter script's own heuristic for "leave some airspace so a network
// is never one move from having zero empty-node connections" — exclude
// points with even x AND even y from the lowest-priority random-move tier.
// Sourced directly from the in-game IPvGO documentation's getRandomMove().
function isReservedSpace(x, y) {
  return x % 2 === 0 && y % 2 === 0
}

function neighbors(x, y) {
  return [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ]
}

function pointAt(board, x, y) {
  if (x < 0 || x >= board.length) return undefined
  const col = board[x]
  if (y < 0 || y >= col.length) return undefined
  return col[y]
}

function countEmptyNeighbors(board, x, y) {
  let count = 0
  for (const [nx, ny] of neighbors(x, y)) {
    if (pointAt(board, nx, ny) === ".") count++
  }
  return count
}

// Any valid move adjacent to an opponent ("O") chain with exactly one
// liberty left captures and removes that whole chain — always worth taking.
function findCaptureMoves(board, validMoves, liberties) {
  const moves = []
  for (let x = 0; x < board.length; x++) {
    for (let y = 0; y < board[x].length; y++) {
      if (!validMoves[x]?.[y]) continue
      for (const [nx, ny] of neighbors(x, y)) {
        if (pointAt(board, nx, ny) === "O" && liberties[nx]?.[ny] === 1) {
          moves.push([x, y])
          break
        }
      }
    }
  }
  return moves
}

// Any valid move adjacent to a friendly ("X") chain with exactly one
// liberty left saves it from capture next turn — but only play it if the
// new point itself won't be immediately recapturable (two+ empty neighbors
// of its own, or it also touches a different friendly chain with 3+
// liberties already). Same safety check the in-game doc gives for this move
// type.
function findDefendMoves(board, validMoves, liberties) {
  const moves = []
  for (let x = 0; x < board.length; x++) {
    for (let y = 0; y < board[x].length; y++) {
      if (!validMoves[x]?.[y]) continue
      let threatened = false
      for (const [nx, ny] of neighbors(x, y)) {
        if (pointAt(board, nx, ny) === "X" && liberties[nx]?.[ny] === 1) {
          threatened = true
          break
        }
      }
      if (!threatened) continue

      let safe = countEmptyNeighbors(board, x, y) >= 2
      if (!safe) {
        for (const [nx, ny] of neighbors(x, y)) {
          if (pointAt(board, nx, ny) === "X" && (liberties[nx]?.[ny] ?? 0) >= 3) {
            safe = true
            break
          }
        }
      }
      if (safe) moves.push([x, y])
    }
  }
  return moves
}

// Any valid, non-reserved move touching a friendly chain grows it — the
// in-game doc's "network expansion" step, the first real improvement over
// pure random play.
function findExpandMoves(board, validMoves) {
  const moves = []
  for (let x = 0; x < board.length; x++) {
    for (let y = 0; y < board[x].length; y++) {
      if (!validMoves[x]?.[y]) continue
      if (isReservedSpace(x, y)) continue
      for (const [nx, ny] of neighbors(x, y)) {
        if (pointAt(board, nx, ny) === "X") {
          moves.push([x, y])
          break
        }
      }
    }
  }
  return moves
}

function findRandomMoves(board, validMoves, allowReserved) {
  const moves = []
  for (let x = 0; x < board.length; x++) {
    for (let y = 0; y < board[x].length; y++) {
      if (!validMoves[x]?.[y]) continue
      if (!allowReserved && isReservedSpace(x, y)) continue
      moves.push([x, y])
    }
  }
  return moves
}

function pickRandom(moves) {
  return moves[Math.floor(Math.random() * moves.length)]
}

// Priority order per docs/ipvgo-strategy.md, sourced from the in-game
// IPvGO documentation: capture > defend > expand > random-with-airspace >
// anything valid > pass.
function pickMove(board, validMoves, liberties) {
  const capture = findCaptureMoves(board, validMoves, liberties)
  if (capture.length) return { move: pickRandom(capture), kind: "capture" }

  const defend = findDefendMoves(board, validMoves, liberties)
  if (defend.length) return { move: pickRandom(defend), kind: "defend" }

  const expand = findExpandMoves(board, validMoves)
  if (expand.length) return { move: pickRandom(expand), kind: "expand" }

  const random = findRandomMoves(board, validMoves, false)
  if (random.length) return { move: pickRandom(random), kind: "random" }

  const fallback = findRandomMoves(board, validMoves, true)
  if (fallback.length) return { move: pickRandom(fallback), kind: "fallback" }

  return { move: null, kind: "pass" }
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

/** @param {NS} ns */
export async function main(ns) {
  killDuplicates(ns)

  if (!checkGoApiAvailable(ns)) return

  const opponent = ns.args[0] ?? "Netburners"
  const size = Number(ns.args[1] ?? 7)

  ns.tprint(
    `ipvgo_player: starting (RAM ${ns.getScriptRam(ns.getScriptName()).toFixed(2)}GB). ` +
      `Fresh-subnet default: ${opponent} ${size}x${size} -- an in-progress game is always continued as-is first.`
  )

  let gamesPlayed = 0
  let wins = 0

  while (true) {
    try {
      if (ns.go.getCurrentPlayer() === "None") {
        const state = ns.go.getGameState()
        const hadAGame = gamesPlayed > 0 || state.whiteScore > 0 || state.blackScore > 0
        if (hadAGame) {
          const won = state.blackScore > state.whiteScore
          wins += won ? 1 : 0
          gamesPlayed++
          ns.tprint(
            `ipvgo_player: game over -- black ${state.blackScore} vs white ${state.whiteScore} ` +
              `(${won ? "WIN" : "loss"}). Lifetime ${wins}/${gamesPlayed}.`
          )
        }
        ns.go.resetBoardState(opponent, size)
        ns.tprint(`ipvgo_player: new subnet vs ${opponent}, ${size}x${size}.`)
        await ns.sleep(200)
        continue
      }

      // Not our color to move -- most likely we picked up a game where the
      // opponent still owed a move (e.g. the game was closed/reloaded mid-turn,
      // exactly the case ns.go.opponentNextTurn()'s own doc comment calls out).
      if (ns.go.getCurrentPlayer() !== "Black") {
        await ns.go.opponentNextTurn()
        continue
      }

      const board = ns.go.getBoardState()
      const validMoves = ns.go.analysis.getValidMoves()
      const liberties = ns.go.analysis.getLiberties()

      const { move, kind } = pickMove(board, validMoves, liberties)

      if (move) {
        await ns.go.makeMove(move[0], move[1])
        ns.print(`played ${kind} move at [${move[0]},${move[1]}]`)
      } else {
        await ns.go.passTurn()
        ns.print("passed -- no valid move found")
      }

      await ns.sleep(50)
    } catch (e) {
      ns.tprint(`ipvgo_player: error in main loop, continuing -- ${String(e)}`)
      await ns.sleep(1000)
    }
  }
}
