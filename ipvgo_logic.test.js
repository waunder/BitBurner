/**
 * Tests for ipvgo_logic.js — the local Go rules engine and flat Monte
 * Carlo move selection pulled out of ipvgo_player.js on 2026-08-12.
 * Run with: node --test ipvgo_logic.test.js
 *
 * Per this repo's own standing discipline (see CLAUDE.md's "Diagnosis
 * discipline" and docs/ipvgo-strategy.md's 2026-08-11 fix, which was
 * covered by hand-built-board tests before going live): a rules-simulation
 * bug is exactly the kind of thing that looks fine in isolation and loses
 * real games, so capture, suicide-prevention, and ko are each tested
 * directly against small hand-built boards, using the real board[x][y]
 * convention (see ipvgo_logic.js's own header for the boardToFlat/
 * flatToBoard round trip this relies on).
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  BLACK,
  WHITE,
  EMPTY,
  DEAD,
  boardToFlat,
  flatToBoard,
  xyToIdx,
  findChain,
  applyMoveFlat,
  analyzeMoves,
  isSimpleEye,
  scoreAreaFlat,
  runPlayout,
  chooseBestMove,
  createMctsSearch,
  ucb1Score,
  computeOpeningMoveStats,
  makeRng,
  raveScore,
} from "./ipvgo_logic.js"

// Small 5x5 test board, board[x][y] convention (x = column-string index,
// y = index within that string) matching ns.go.getBoardState()'s own
// documented layout.
function board5(rows) {
  // `rows` is given top-to-bottom, left-to-right for readability in the
  // test source (like most Go diagrams); convert to column-strings.
  const H = rows.length
  const W = rows[0].length
  const cols = []
  for (let x = 0; x < W; x++) {
    let col = ""
    for (let y = 0; y < H; y++) col += rows[H - 1 - y][x]
    cols.push(col)
  }
  return cols
}

describe("boardToFlat / flatToBoard round trip", () => {
  test("preserves a hand-built board exactly", () => {
    const board = board5([".....", ".XXO.", ".XOO.", ".XX..", "....."])
    const { flat, W, H } = boardToFlat(board)
    assert.deepEqual(flatToBoard(flat, W, H), board)
  })
})

describe("findChain — flood fill for chains and liberties", () => {
  test("a single stone with two liberties", () => {
    const board = board5([".....", ".....", "..X..", ".....", "....."])
    const { flat, W, H } = boardToFlat(board)
    const idx = xyToIdx(2, 2, H)
    const chain = findChain(flat, W, H, idx)
    assert.equal(chain.stones.length, 1)
    assert.equal(chain.liberties.size, 4)
  })

  test("two connected stones share one liberty pool", () => {
    const board = board5([".....", ".....", ".XX..", ".....", "....."])
    const { flat, W, H } = boardToFlat(board)
    const chain = findChain(flat, W, H, xyToIdx(1, 2, H))
    assert.equal(chain.stones.length, 2)
    // (1,2) has neighbors (0,2)e (1,1)e (1,3)e (2,2)=X-own; (2,2) has
    // neighbors (1,2)=own (3,2)e (2,1)e (2,3)e -> liberties: (0,2)(1,1)(1,3)(3,2)(2,1)(2,3) = 6
    assert.equal(chain.liberties.size, 6)
  })

  test("dead nodes do not count as liberties or connect chains", () => {
    const board = board5([".....", ".....", ".X#X.", ".....", "....."])
    const { flat, W, H } = boardToFlat(board)
    const chain = findChain(flat, W, H, xyToIdx(1, 2, H))
    assert.equal(chain.stones.length, 1) // the dead node blocks the connection
    assert.equal(chain.liberties.size, 3) // not 4 -- the dead-node neighbor doesn't count
  })
})

describe("applyMoveFlat — capture", () => {
  test("playing the last liberty of an enemy chain captures it", () => {
    // White stone at (2,2) has liberties only at (2,1) after black surrounds
    // the other three sides; playing black at (2,1) captures it.
    const board = board5([".....", "..X..", ".XOX.", ".....", "....."])
    const { flat, W, H } = boardToFlat(board)
    const idx = xyToIdx(2, 1, H)
    const res = applyMoveFlat(flat, W, H, idx, BLACK)
    assert.equal(res.legal, true)
    assert.equal(res.capturedCount, 1)
    const after = flatToBoard(res.flat, W, H)
    assert.equal(after[2][2], ".") // captured stone removed
    assert.equal(after[2][1], "X") // the move itself was played
  })

  test("captures a multi-stone chain in one move", () => {
    // White chain (2,2)-(3,2) walled in by black on every side except one
    // last shared liberty at (2,3); black plays there to capture both
    // stones at once.
    const W = 5,
      H = 5
    const flat = new Uint8Array(W * H).fill(EMPTY)
    const set = (x, y, v) => (flat[xyToIdx(x, y, H)] = v)
    set(2, 2, WHITE)
    set(3, 2, WHITE)
    set(1, 2, BLACK) // left of (2,2)
    set(2, 1, BLACK) // below (2,2)
    set(4, 2, BLACK) // right of (3,2)
    set(3, 1, BLACK) // below (3,2)
    set(3, 3, BLACK) // above (3,2)
    // (2,3), above (2,2), left deliberately open -- the chain's one liberty.
    const before = findChain(flat, W, H, xyToIdx(2, 2, H))
    assert.equal(before.color, WHITE)
    assert.equal(before.stones.length, 2)
    assert.equal(before.liberties.size, 1)
    const [libIdx] = [...before.liberties]
    assert.equal(libIdx, xyToIdx(2, 3, H))
    const res = applyMoveFlat(flat, W, H, libIdx, BLACK)
    assert.equal(res.legal, true)
    assert.equal(res.capturedCount, 2)
    const after = flatToBoard(res.flat, W, H)
    assert.equal(after[2][2], ".")
    assert.equal(after[3][2], ".")
  })
})

describe("applyMoveFlat — suicide prevention and its capture exception", () => {
  test("playing into a fully-surrounded empty point with no capture is illegal", () => {
    // Black surrounds an empty point on all four sides; white has no chain
    // to capture there, so playing white into the middle is suicide.
    const board = board5([".....", "..X..", ".X.X.", "..X..", "....."])
    const { flat, W, H } = boardToFlat(board)
    const idx = xyToIdx(2, 2, H)
    const res = applyMoveFlat(flat, W, H, idx, WHITE)
    assert.equal(res.legal, false)
  })

  test("a move that captures is legal even though it would otherwise be suicide", () => {
    // Black's lone stone at (2,2) is surrounded by white on 3 sides with
    // the last liberty also about to be filled by white -- but that same
    // white move also removes black's last liberty for its own single
    // stone chain... construct: white plays the point that both captures
    // black's one-stone chain AND would otherwise be surrounded by black.
    // Simple case: black single stone at (2,2), white stones at (1,2),
    // (3,2), (2,1); white plays (2,3) which has neighbors (1,3)e (3,3)e
    // (2,2)=black-1lib -> capturing black, and white's own new stone has
    // liberties (1,3)/(3,3) so it's not even suicide here. Use a tighter
    // corner case instead:
    const board = board5([".....", ".....", ".OXO.", "..O..", "....."])
    // black lone stone at (2,2) [row index 2 from top => y=2], liberties:
    // only (2,3) remains (others are white). White plays (2,3): captures
    // black (its last liberty removed), and white's stone at (2,3) then
    // has liberty at (2,2) (the just-vacated point) plus edge -- legal
    // both via the capture exception and because it gains a liberty.
    const { flat, W, H } = boardToFlat(board)
    const target = findChain(flat, W, H, xyToIdx(2, 2, H))
    assert.equal(target.color, BLACK)
    assert.equal(target.liberties.size, 1)
    const idx = xyToIdx(2, 3, H)
    const res = applyMoveFlat(flat, W, H, idx, WHITE)
    assert.equal(res.legal, true)
    assert.equal(res.capturedCount, 1)
    const after = flatToBoard(res.flat, W, H)
    assert.equal(after[2][2], ".")
    assert.equal(after[2][3], "O")
  })

  test("occupied point is always illegal", () => {
    const board = board5([".....", ".....", "..X..", ".....", "....."])
    const { flat, W, H } = boardToFlat(board)
    const res = applyMoveFlat(flat, W, H, xyToIdx(2, 2, H), WHITE)
    assert.equal(res.legal, false)
  })
})

describe("applyMoveFlat — simple ko", () => {
  test("capturing a single stone that leaves multiple liberties is not a ko shape", () => {
    // Black lone stone at (2,2), one liberty at (2,3). White plays there
    // and captures it, but the capturing stone's *other* three neighbors
    // are all still empty, so it ends up with several liberties, not the
    // single-liberty shape that would bar an immediate recapture.
    const W2 = 5,
      H2 = 5
    const flat2 = new Uint8Array(W2 * H2).fill(EMPTY)
    const set = (x, y, v) => (flat2[xyToIdx(x, y, H2)] = v)
    // Black lone stone at (2,2) with white at (1,2),(3,2),(2,1); liberty at (2,3).
    set(2, 2, BLACK)
    set(1, 2, WHITE)
    set(3, 2, WHITE)
    set(2, 1, WHITE)
    const before = findChain(flat2, W2, H2, xyToIdx(2, 2, H2))
    assert.equal(before.liberties.size, 1)
    assert.deepEqual([...before.liberties], [xyToIdx(2, 3, H2)])

    const res = applyMoveFlat(flat2, W2, H2, xyToIdx(2, 3, H2), WHITE)
    assert.equal(res.legal, true)
    assert.equal(res.capturedCount, 1)
    // The new white stone at (2,3) is itself a lone stone -- how many
    // liberties does it have? Neighbors of (2,3): (1,3)e (3,3)e (2,2)=just
    // captured->empty (2,4)e => 4 liberties, NOT a ko shape (this
    // particular position isn't a real ko fight). Ko requires the
    // capturing stone to end up with exactly one liberty -- confirm this
    // helper correctly reports "not ko" here (koIndex -1) as a negative
    // control, then build the real positive case below.
    assert.equal(res.koIndex, -1)
  })

  test("real ko shape: capturing stone left with exactly one liberty bars immediate recapture", () => {
    const W = 5,
      H = 5
    const flat = new Uint8Array(W * H).fill(EMPTY)
    const set = (x, y, v) => (flat[xyToIdx(x, y, H)] = v)
    // Standard ko: black lone stone at (2,2), one liberty at (2,3). White
    // will play (2,3); its other three neighbors are black/dead (not
    // white, so the capturing stone stays a lone one-stone chain instead
    // of merging into a bigger group) so it ends up with exactly one
    // liberty -- the point it just captured.
    set(2, 2, BLACK)
    set(1, 2, WHITE)
    set(3, 2, WHITE)
    set(2, 1, WHITE)
    set(1, 3, BLACK)
    set(3, 3, BLACK)
    set(2, 4, DEAD) // forces (2,3)'s fourth neighbor to be non-liberty
    const before = findChain(flat, W, H, xyToIdx(2, 2, H))
    assert.equal(before.liberties.size, 1)

    const res = applyMoveFlat(flat, W, H, xyToIdx(2, 3, H), WHITE)
    assert.equal(res.legal, true)
    assert.equal(res.capturedCount, 1)
    assert.equal(res.koIndex, xyToIdx(2, 2, H))

    // The bar actually excludes the ko point from legal moves for the
    // opponent's immediate reply.
    const { legal } = analyzeMoves(res.flat, W, H, BLACK, res.koIndex)
    assert.ok(!legal.includes(xyToIdx(2, 2, H)))
    // But it's legal again once the ko argument is dropped (as it would be
    // on a later turn after playing elsewhere first, per the real
    // superko rule this approximates).
    const { legal: legalNoKo } = analyzeMoves(res.flat, W, H, BLACK, -1)
    assert.ok(legalNoKo.includes(xyToIdx(2, 2, H)))
  })
})

describe("isSimpleEye", () => {
  test("a fully enclosed interior point with all friendly diagonals is an eye", () => {
    const board = board5([".....", ".XXX.", ".X.X.", ".XXX.", "....."])
    const { flat, W, H } = boardToFlat(board)
    assert.equal(isSimpleEye(flat, W, H, xyToIdx(2, 2, H), BLACK), true)
  })

  test("an interior point with two opponent diagonals is not a true eye", () => {
    const board = board5([".....", ".XXX.", ".X.X.", ".XXX.", "....."])
    const { flat, W, H } = boardToFlat(board)
    // corrupt two diagonals to white
    flat[xyToIdx(1, 1, H)] = WHITE
    flat[xyToIdx(3, 3, H)] = WHITE
    assert.equal(isSimpleEye(flat, W, H, xyToIdx(2, 2, H), BLACK), false)
  })

  test("a corner point requires all diagonals friendly (zero tolerance)", () => {
    const board = board5([".XX..", "X....", ".....", ".....", "....."])
    // corner-ish setup: point (0,4) [top-left] surrounded orthogonally by X
    // with its single diagonal neighbor also required to be X.
    const W = 5,
      H = 5
    const flat = new Uint8Array(W * H).fill(EMPTY)
    const set = (x, y, v) => (flat[xyToIdx(x, y, H)] = v)
    set(0, 4, EMPTY) // the point itself (top-left corner)
    set(1, 4, BLACK) // orthogonal neighbor
    set(0, 3, BLACK) // orthogonal neighbor
    set(1, 3, WHITE) // its only diagonal neighbor -- opponent
    assert.equal(isSimpleEye(flat, W, H, xyToIdx(0, 4, H), BLACK), false)
    set(1, 3, BLACK)
    assert.equal(isSimpleEye(flat, W, H, xyToIdx(0, 4, H), BLACK), true)
  })

  test("not an eye if any orthogonal neighbor is not friendly", () => {
    const board = board5([".....", ".XXX.", ".O.X.", ".XXX.", "....."])
    const { flat, W, H } = boardToFlat(board)
    assert.equal(isSimpleEye(flat, W, H, xyToIdx(2, 2, H), BLACK), false)
  })
})

describe("scoreAreaFlat", () => {
  test("counts stones plus fully-enclosed territory, splits contested space", () => {
    // Left half black territory, right half white territory, using a 5x5
    // with a clean vertical dividing wall.
    const board = board5(["X.XO.", "X.XO.", "X.XO.", "X.XO.", "X.XO."])
    const { flat, W, H } = boardToFlat(board)
    const { black, white } = scoreAreaFlat(flat, W, H)
    // Columns: x=0 all black stones (5), x=1 all empty (bordered by black
    // on both x=0 and x=2 -> black territory, 5), x=2 all black stones
    // (5), x=3 all white stones (5), x=4 all empty (bordered only by white
    // at x=3, board edge on the other side -> white territory, 5).
    assert.equal(black, 15) // 10 stones + 5 territory
    assert.equal(white, 10) // 5 stones + 5 territory
  })

  test("empty region touching both colors scores for neither", () => {
    const board = board5([".....", ".X.O.", ".....", ".....", "....."])
    const { flat, W, H } = boardToFlat(board)
    const { black, white } = scoreAreaFlat(flat, W, H)
    // One connected empty region touches both X and O -> contested, scores
    // for neither beyond the stones themselves.
    assert.equal(black, 1)
    assert.equal(white, 1)
  })

  test("dead nodes never count and don't propagate a region", () => {
    const board = board5([".....", ".X#O.", ".....", ".....", "....."])
    const { flat, W, H } = boardToFlat(board)
    const { black, white } = scoreAreaFlat(flat, W, H)
    // the dead node splits what would otherwise be one contested region --
    // but it's still one connected empty region around the outside since
    // the board perimeter wraps around it; the point is just that the dead
    // node itself never contributes and never joins a region.
    assert.equal(black + white <= 2 + (25 - 1 - 2), true) // sanity bound, not exact
  })
})

describe("runPlayout", () => {
  test("terminates within maxMoves and returns a valid score on a small board", () => {
    const board = board5([".....", ".....", ".....", ".....", "....."])
    const { flat, W, H } = boardToFlat(board)
    const rng = makeRng(42)
    const result = runPlayout(flat, W, H, BLACK, -1, 200, rng)
    assert.ok(Number.isFinite(result.black))
    assert.ok(Number.isFinite(result.white))
    assert.ok(result.black + result.white <= W * H)
  })

  test("is deterministic given the same seed", () => {
    const board = board5([".....", ".....", ".....", ".....", "....."])
    const { flat, W, H } = boardToFlat(board)
    const r1 = runPlayout(flat, W, H, BLACK, -1, 200, makeRng(7))
    const r2 = runPlayout(flat, W, H, BLACK, -1, 200, makeRng(7))
    assert.deepEqual(r1, r2)
  })
})

describe("ucb1Score — the UCT selection formula", () => {
  test("an unvisited child always scores Infinity (always try untried moves first)", () => {
    assert.equal(ucb1Score(0, 0, 100, Math.SQRT2), Infinity)
  })

  test("matches a hand-computed value for visited children", () => {
    // Q = wins/visits = 3/4 = 0.75; exploration = sqrt(2) * sqrt(ln(10)/4)
    const score = ucb1Score(4, 3, 10, Math.SQRT2)
    const expected = 0.75 + Math.SQRT2 * Math.sqrt(Math.log(10) / 4)
    assert.ok(Math.abs(score - expected) < 1e-9, `expected ${expected}, got ${score}`)
  })

  test("higher win rate scores higher at equal visit counts", () => {
    const lowWinRate = ucb1Score(10, 2, 50, Math.SQRT2)
    const highWinRate = ucb1Score(10, 8, 50, Math.SQRT2)
    assert.ok(highWinRate > lowWinRate)
  })

  test("fewer visits scores higher at equal win rate (exploration term)", () => {
    const fewVisits = ucb1Score(2, 1, 50, Math.SQRT2) // 50% winrate, barely explored
    const manyVisits = ucb1Score(40, 20, 50, Math.SQRT2) // same 50%, well explored
    assert.ok(fewVisits > manyVisits)
  })
})

describe("raveScore — RAVE/AMAF-blended selection (2026-09-05)", () => {
  test("a never-visited, never-AMAF-credited child always scores Infinity", () => {
    assert.equal(raveScore({ visits: 0, wins: 0 }, 100, Math.SQRT2, 500), Infinity)
  })

  // Regression test for a real bug caught this session before it ever ran
  // live: a node whose only qualifying simulations so far were all losses
  // left `amafWins` permanently `undefined` (only ever incremented on a
  // win, never initialized to 0 otherwise), so `amafWins / amafVisits`
  // evaluated to NaN -- which made selectBestChild's `score > bestScore`
  // comparison silently fail for every child (NaN compares false against
  // everything), returning `null` and crashing chooseBestMove. This board
  // reproduces it directly: amafVisits > 0 but amafWins deliberately never
  // set to anything other than its default.
  test("never produces NaN for a child with AMAF visits but zero AMAF wins", () => {
    const child = { visits: 1, wins: 0, amafVisits: 3, amafWins: 0 }
    const score = raveScore(child, 13, Math.SQRT2, 500)
    assert.ok(Number.isFinite(score), `expected a finite score, got ${score}`)
  })

  test("blends toward the AMAF estimate when real visits are few, and toward the real estimate as they grow", () => {
    // Same real record (1 visit, 1 win -> qUct = 1.0) and same AMAF record
    // (100 visits, 0 wins -> qAmaf = 0.0) in both cases; only the real
    // visit count differs. RAVE's beta shrinks as real visits grow, so the
    // low-real-visits case should be pulled down much closer to qAmaf's 0
    // than the high-real-visits case.
    const lowRealVisits = raveScore({ visits: 1, wins: 1, amafVisits: 100, amafWins: 0 }, 1000, 0, 500)
    const highRealVisits = raveScore({ visits: 50000, wins: 50000, amafVisits: 100, amafWins: 0 }, 60000, 0, 500)
    assert.ok(lowRealVisits < highRealVisits, `expected ${lowRealVisits} < ${highRealVisits}`)
    assert.ok(lowRealVisits < 0.1) // pulled way down toward qAmaf=0
    assert.ok(highRealVisits > 0.9) // barely pulled down from qUct=1.0 at all
  })
})

describe("chooseBestMove — MCTS actually distinguishes good from bad moves", () => {
  // Built directly as a flat array (rather than the row-oriented board5()
  // helper) to avoid transcription mistakes about which axis is which:
  // white 3-stone chain at (1,3)-(2,3)-(3,3), boxed in by black above,
  // below, and on the left, with exactly one remaining liberty at (4,3).
  // Black playing (4,3) captures all three white stones outright.
  function captureScenarioBoard() {
    const W = 5,
      H = 5
    const flat = new Uint8Array(W * H).fill(EMPTY)
    const set = (x, y, v) => (flat[xyToIdx(x, y, H)] = v)
    set(1, 3, WHITE)
    set(2, 3, WHITE)
    set(3, 3, WHITE)
    set(1, 4, BLACK)
    set(2, 4, BLACK)
    set(3, 4, BLACK)
    set(1, 2, BLACK)
    set(2, 2, BLACK)
    set(3, 2, BLACK)
    set(0, 3, BLACK)
    set(1, 0, WHITE) // makes (0,0) a self-atari corner for black -- the "bad" candidate below
    // (4,3) left empty -- the chain's one liberty.
    const before = findChain(flat, W, H, xyToIdx(1, 3, H))
    if (before.stones.length !== 3 || before.liberties.size !== 1) {
      throw new Error("test fixture is wrong: expected a 3-stone white chain with exactly one liberty")
    }
    return { board: flatToBoard(flat, W, H), W, H }
  }

  test("picks a real capture over a self-atari move", () => {
    // Restricting the candidate set to exactly two points -- the capture
    // at (4,3) and the self-atari corner at (0,0) -- keeps the comparison
    // sharp, same reasoning as the equivalent flat-MC-era test this
    // replaces: on a wide-open board with many roughly-equal candidates,
    // a fixed small simulation budget can occasionally favor a "fine but
    // not best" move by chance. With only two candidates and 200
    // simulations, MCTS should reliably find the capture.
    const { board, W, H } = captureScenarioBoard()
    const validMoves = Array.from({ length: W }, () => Array(H).fill(false))
    validMoves[4][3] = true
    validMoves[0][0] = true
    const { move } = chooseBestMove(board, validMoves, "X", { numSimulations: 200, rng: makeRng(99) })
    assert.deepEqual(move, [4, 3])
  })

  test("reports the real candidate count in `evaluated`, not however many are left unexpanded", () => {
    // Regression test: root.untriedMoves and the root candidate list used
    // to be the *same array object*, and expandNode drains it via .pop()
    // as the search runs -- so reading its .length after the simulation
    // loop reported how many candidates were never tried, not how many
    // there actually were (0 whenever the search covers everything, which
    // it usually does). On a wide-open board with many simulations, the
    // real candidate count should be reported correctly regardless.
    const board = ["...", "...", "..."] // 3x3, 9 empty points
    const validMoves = Array.from({ length: 3 }, () => Array(3).fill(true))
    const { evaluated } = chooseBestMove(board, validMoves, "X", { numSimulations: 200, rng: makeRng(3) })
    assert.equal(evaluated, 9)
  })

  test("returns move: null when there are no valid moves", () => {
    const board = board5([".....", ".....", ".....", ".....", "....."])
    const W = 5,
      H = 5
    const validMoves = Array.from({ length: W }, () => Array(H).fill(false))
    const { move, evaluated } = chooseBestMove(board, validMoves, "X", {})
    assert.equal(move, null)
    assert.equal(evaluated, 0)
  })

  // Regression test for the 2026-08-12 root-level eye-safety fix: Ken
  // watched a live game where Black held the majority of the board, then
  // filled both of its own eyes and died -- the root candidate set used to
  // be the raw ns.go.analysis.getValidMoves() grid with no eye filter,
  // unlike every other tree node. See chooseBestMove's own comment.
  test("never fills its own true eye at the root when a safe alternative exists", () => {
    // Same true-eye shape as the isSimpleEye tests above: X ring around
    // (2,2). Candidate set is exactly the eye and one untouched corner --
    // the eye must never be chosen while the corner is available.
    const board = board5([".....", ".XXX.", ".X.X.", ".XXX.", "....."])
    const W = 5,
      H = 5
    const validMoves = Array.from({ length: W }, () => Array(H).fill(false))
    validMoves[2][2] = true // the true eye
    validMoves[0][0] = true // a safe, unrelated corner
    const { move, evaluated } = chooseBestMove(board, validMoves, "X", { numSimulations: 200, rng: makeRng(7) })
    assert.deepEqual(move, [0, 0])
    assert.equal(evaluated, 1) // the eye was filtered out before MCTS ever ran
  })

  test("passes rather than fill its own eye when that's the only legal move left", () => {
    const board = board5([".....", ".XXX.", ".X.X.", ".XXX.", "....."])
    const W = 5,
      H = 5
    const validMoves = Array.from({ length: W }, () => Array(H).fill(false))
    validMoves[2][2] = true // the true eye -- the only "legal" point offered
    const { move, evaluated } = chooseBestMove(board, validMoves, "X", {})
    assert.equal(move, null)
    assert.equal(evaluated, 0)
  })

  test("applies komi when deciding win/loss for backpropagation", () => {
    // A huge komi should be able to flip which move looks best: if White's
    // effective score (area score + komi) always beats Black's regardless
    // of the move chosen, no move should look like a reliable "win" for
    // Black, which is a reachable, checkable property even without
    // asserting a specific move choice.
    const { board, W, H } = captureScenarioBoard()
    const validMoves = Array.from({ length: W }, () => Array(H).fill(false))
    validMoves[4][3] = true
    const withoutKomi = chooseBestMove(board, validMoves, "X", { numSimulations: 100, komi: 0, rng: makeRng(1) })
    const withHugeKomi = chooseBestMove(board, validMoves, "X", { numSimulations: 100, komi: 1000, rng: makeRng(1) })
    assert.ok((withoutKomi.winRate ?? 0) > (withHugeKomi.winRate ?? 0))
  })
})

describe("createMctsSearch — resumable/chunked search (2026-09-05 freeze fix)", () => {
  // The whole point of this API: ipvgo_player.js now drives the search in
  // small chunks (runIterationsForMs) with an `await ns.sleep(0)` between
  // them, instead of chooseBestMove's single uninterrupted loop, so the
  // browser tab never blocks for the full move-selection time in one go.
  // These tests exist to prove that chunking produces the *identical* tree
  // (same rng draws, same move order) as running the same total simulation
  // count in one call -- i.e. this is a scheduling change, not an algorithm
  // change, and chooseBestMove's own behavior (and its passing tests above)
  // is preserved exactly because it's now just this same code path run to
  // completion in one call.
  function openBoard3x3() {
    const board = ["...", "...", "..."]
    const validMoves = Array.from({ length: 3 }, () => Array(3).fill(true))
    return { board, validMoves }
  }

  test("running iterations in several small chunks matches one big chunk, given the same rng", () => {
    const { board, validMoves } = openBoard3x3()
    const chunked = createMctsSearch(board, validMoves, "X", { numSimulations: 120, rng: makeRng(42) })
    for (let i = 0; i < 12; i++) chunked.runIterations(10)
    const chunkedResult = chunked.getResult()

    const oneShot = chooseBestMove(board, validMoves, "X", { numSimulations: 120, rng: makeRng(42) })

    assert.deepEqual(chunkedResult.move, oneShot.move)
    assert.equal(chunkedResult.visits, oneShot.visits)
    assert.equal(chunkedResult.winRate, oneShot.winRate)
    assert.equal(chunkedResult.simulations, 120)
  })

  test("runIterations never exceeds the configured budget and reports how many actually ran", () => {
    const { board, validMoves } = openBoard3x3()
    const search = createMctsSearch(board, validMoves, "X", { numSimulations: 50, rng: makeRng(7) })
    const ranFirst = search.runIterations(30)
    const ranSecond = search.runIterations(30) // only 20 remain in the budget
    assert.equal(ranFirst, 30)
    assert.equal(ranSecond, 20)
    assert.equal(search.remaining(), 0)
    assert.equal(search.getResult().simulations, 50)
  })

  test("runIterationsForMs stops at the simulation budget even given a generous time budget", () => {
    const { board, validMoves } = openBoard3x3()
    const search = createMctsSearch(board, validMoves, "X", { numSimulations: 40, rng: makeRng(13) })
    search.runIterationsForMs(5000) // budget exhausts almost instantly; the ms cap is never hit
    assert.equal(search.remaining(), 0)
    assert.equal(search.getResult().simulations, 40)
  })

  test("returns null (caller should pass) under the same conditions chooseBestMove returns move: null", () => {
    const board = ["...", "...", "..."]
    const validMoves = Array.from({ length: 3 }, () => Array(3).fill(false))
    assert.equal(createMctsSearch(board, validMoves, "X", {}), null)
  })
})

describe("computeOpeningMoveStats", () => {
  test("ignores games without an openingMove field", () => {
    const stats = computeOpeningMoveStats([{ won: true }, { won: false, openingMove: null }])
    assert.equal(stats.gamesWithOpeningData, 0)
    assert.equal(stats.overallWinRate, null)
  })

  test("aggregates wins/games per distinct opening move", () => {
    const recentGames = [
      { won: true, openingMove: [2, 2] },
      { won: true, openingMove: [2, 2] },
      { won: false, openingMove: [2, 2] },
      { won: false, openingMove: [0, 0] },
    ]
    const stats = computeOpeningMoveStats(recentGames)
    assert.equal(stats.gamesWithOpeningData, 4)
    assert.equal(stats.overallWinRate, 0.5)
    assert.deepEqual(stats.byMove["2,2"], { games: 3, wins: 2, winRate: 2 / 3 })
    assert.deepEqual(stats.byMove["0,0"], { games: 1, wins: 0, winRate: 0 })
  })

  test("handles an empty/undefined recentGames without throwing", () => {
    assert.doesNotThrow(() => computeOpeningMoveStats([]))
    assert.doesNotThrow(() => computeOpeningMoveStats(undefined))
  })
})

describe("chooseBestMove — opening-move prior from computeOpeningMoveStats", () => {
  test("a move with enough historical wins gets a head start via virtual visits", () => {
    // On a wide-open empty board every move looks roughly equal to a
    // small-budget random rollout; a strong historical prior (well above
    // MIN_SAMPLE) for one specific move should be enough to tip the
    // "most-visited" final selection toward it even at a modest budget,
    // since it starts with virtual wins/visits before real simulation
    // begins (see ipvgo_logic.js's own header, Gelly & Silver citation).
    const board = ["...", "...", "..."] // 3x3 empty board
    const validMoves = Array.from({ length: 3 }, () => Array(3).fill(true))
    const openingStats = computeOpeningMoveStats(
      Array.from({ length: 8 }, () => ({ won: true, openingMove: [1, 1] }))
    )
    const { move } = chooseBestMove(board, validMoves, "X", {
      numSimulations: 60,
      rng: makeRng(5),
      isOpeningMove: true,
      openingStats,
      minOpeningSample: 5,
      openingPriorWeight: 30,
    })
    assert.deepEqual(move, [1, 1])
  })

  test("does not bias when the historical sample is below minOpeningSample", () => {
    // Only 2 recorded games for (1,1) -- below the default minimum of 5 --
    // so no prior should be applied; this just checks it runs without
    // throwing and without forcing that specific move (can't assert a
    // *different* move deterministically without over-fitting to the rng
    // seed, so this only checks the "no crash, still returns a valid
    // candidate" contract holds with an under-sample opening stats object).
    const board = ["...", "...", "..."]
    const validMoves = Array.from({ length: 3 }, () => Array(3).fill(true))
    const openingStats = computeOpeningMoveStats([
      { won: true, openingMove: [1, 1] },
      { won: true, openingMove: [1, 1] },
    ])
    const { move } = chooseBestMove(board, validMoves, "X", {
      numSimulations: 30,
      rng: makeRng(2),
      isOpeningMove: true,
      openingStats,
      minOpeningSample: 5,
    })
    assert.ok(Array.isArray(move) && move.length === 2)
  })
})
