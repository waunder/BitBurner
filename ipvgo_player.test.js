/**
 * Tests for the pure board-logic functions in ipvgo_player.js.
 * Run with: node --test ipvgo_player.test.js
 *
 * Extracted/exported (rather than split into a separate ipvgo_logic.js the
 * way mcp.js/mcp_logic.js split) specifically so this file stays on
 * tools/bb_remote.py's existing WATCHED_FILES entry for ipvgo_player.js —
 * see the 2026-08-11 IPvGO investigation notes in docs/claude-todo.md for
 * why a second watched file wasn't an option in that session (the daemon
 * was mid an unrelated live-reconnect bug and could not pick up a new
 * WATCHED_FILES entry without a restart this session couldn't perform).
 * `export` on a function Bitburner's own `main()` never calls is harmless —
 * the game only ever invokes the exported `main`.
 *
 * These exist because the 2026-08-11 investigation into "0 wins across 4+
 * games" needed to tell apart two very different explanations — a genuine
 * heuristic-strength gap (expected, documented, not a bug) vs. an actual
 * coordinate/logic bug (would be a real bug) — without needing another
 * live-game round trip per hypothesis. See the isSafeExtension/
 * findExpandMoves tests below for the one concrete fix that came out of
 * that session: findExpandMoves used to have zero liberty-safety checking
 * at all, unlike findDefendMoves, letting the bot volunteer self-atari
 * connections that (combined with never separating its stones into
 * multiple living groups) produced the shutout-shaped losses actually
 * observed live over CDP that session (a solid 29-18.5 mid-game lead
 * collapsing to near-zero within the same game).
 */
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  isReservedSpace,
  pointAt,
  countEmptyNeighbors,
  isSafeExtension,
  findCaptureMoves,
  findDefendMoves,
  findExpandMoves,
  findRandomMoves,
  pickMove,
} from "./ipvgo_player.js"

// Boards below are written the same orientation ns.go.getBoardState() uses:
// board[x][y], each element a column-string, "X" = black (us), "O" = white,
// "." = empty, "#" = dead node. See docs/ipvgo-strategy.md's "Board and
// pieces" section for the citation.

describe("isReservedSpace — the starter script's own airspace heuristic", () => {
  test("both-even points are reserved", () => {
    assert.equal(isReservedSpace(0, 0), true)
    assert.equal(isReservedSpace(2, 4), true)
  })
  test("anything with an odd coordinate is not reserved", () => {
    assert.equal(isReservedSpace(1, 0), false)
    assert.equal(isReservedSpace(0, 1), false)
    assert.equal(isReservedSpace(3, 5), false)
  })
})

describe("pointAt — bounds handling for the board[x][y] convention", () => {
  const board = ["X.O", ".X.", "O.X"]
  test("reads the documented [x][y] (column-major) layout", () => {
    assert.equal(pointAt(board, 0, 0), "X")
    assert.equal(pointAt(board, 2, 0), "O")
    assert.equal(pointAt(board, 0, 2), "O")
  })
  test("returns undefined off either edge instead of throwing", () => {
    assert.equal(pointAt(board, -1, 0), undefined)
    assert.equal(pointAt(board, 3, 0), undefined)
    assert.equal(pointAt(board, 0, -1), undefined)
    assert.equal(pointAt(board, 0, 3), undefined)
  })
})

describe("findCaptureMoves", () => {
  // 3x3 board: a white stone at (1,0), boxed in on both flanks so its ONLY
  // real liberty is (1,1) -- liberties[1][0] must match that geometry, or
  // the test is asserting something the board itself couldn't produce.
  //   column 0: "X.."     (x=0: y0='X', y1='.', y2='.')
  //   column 1: "O.."     (x=1: y0='O', y1='.', y2='.')
  //   column 2: "X.."     (x=2: y0='X', y1='.', y2='.')
  const board = ["X..", "O..", "X.."]
  const validMoves = [
    [false, true, true],
    [false, true, true],
    [false, true, true],
  ]
  test("finds the move that fills an opponent chain's last liberty", () => {
    const liberties = [
      [-1, -1, -1],
      [1, -1, -1],
      [-1, -1, -1],
    ]
    const moves = findCaptureMoves(board, validMoves, liberties)
    assert.deepEqual(moves, [[1, 1]])
  })
  test("does not flag a move next to a chain with more than one liberty", () => {
    // Same shape but (1,0) actually has 2 liberties on this board -- (1,1)
    // and, say, an opened-up (0,0) would contradict "X" already being
    // there, so widen the board instead: drop the x=2 stone so (1,0) has
    // both (1,1) and (2,0) open.
    const openBoard = ["X..", "O..", "..."]
    const openValidMoves = [
      [false, true, true],
      [false, true, true],
      [true, true, true],
    ]
    const liberties = [
      [-1, -1, -1],
      [2, -1, -1],
      [-1, -1, -1],
    ]
    const moves = findCaptureMoves(openBoard, openValidMoves, liberties)
    assert.deepEqual(moves, [])
  })
})

describe("findDefendMoves", () => {
  // Friendly chain at (1,0), boxed in on both flanks by white so its only
  // liberty is (1,1). Playing (1,1) has two empty neighbors of its own
  // ((0,1) and (2,1), since (1,0) itself is the friendly chain being
  // joined and (1,2) would be a third) so it's a safe save.
  //   column 0: "O.."
  //   column 1: "X.."
  //   column 2: "O.."
  const boardSafe = ["O..", "X..", "O.."]
  const validMoves = [
    [false, true, true],
    [false, true, true],
    [false, true, true],
  ]
  test("saves an atari'd chain when the save point has 2+ empty neighbors", () => {
    const liberties = [
      [-1, -1, -1],
      [1, -1, -1],
      [-1, -1, -1],
    ]
    const moves = findDefendMoves(boardSafe, validMoves, liberties)
    assert.deepEqual(moves, [[1, 1]])
  })

  test("refuses a save that would itself be instantly recapturable", () => {
    // Same friendly chain in atari, but now (1,1)'s OTHER neighbors are
    // also walled off by white on both flanks, so extending onto the
    // liberty gains no new liberties and touches no other strong friendly
    // chain -- per the in-game doc this "save" is a trap, not a real
    // defense.
    //   column 0: "OOO"
    //   column 1: "X.."
    //   column 2: "OOO"
    const boardTrap = ["OOO", "X..", "OOO"]
    const trapValidMoves = [
      [false, false, false],
      [false, true, true],
      [false, false, false],
    ]
    const liberties = [
      [-1, -1, -1],
      [1, -1, -1],
      [-1, -1, -1],
    ]
    const moves = findDefendMoves(boardTrap, trapValidMoves, liberties)
    assert.deepEqual(moves, [])
  })
})

describe("isSafeExtension", () => {
  const board = ["O..", "X..", "O.."]
  test("false when the point has <2 empty neighbors and no strong friendly link", () => {
    // Reuse the "trap" geometry: (1,1)'s only real neighbors here are
    // (1,0) [the X chain itself, liberties=1] and (1,2) [empty] -- one
    // empty neighbor, no qualifying backup chain.
    const trapBoard = ["OOO", "X..", "OOO"]
    const liberties = [
      [-1, -1, -1],
      [1, -1, -1],
      [-1, -1, -1],
    ]
    assert.equal(isSafeExtension(trapBoard, liberties, 1, 1), false)
  })
  test("true when the point touches a different friendly chain with 3+ liberties", () => {
    // Candidate (1,1) sits between two SEPARATE friendly stones -- (1,0),
    // a weak 1-liberty chain, and (1,2), a strong 3-liberty chain (not
    // connected to (1,0): they only share the empty candidate as a
    // neighbor, not each other). Its own other neighbors ((0,1),(2,1)) are
    // both white, so the first clause (2+ empty neighbors) is false and
    // this only passes because of the second, different-chain clause.
    const twoChainBoard = ["OOO", "X.X", "OOO"]
    const liberties = [
      [-1, -1, -1],
      [1, -1, 3],
      [-1, -1, -1],
    ]
    assert.equal(countEmptyNeighbors(twoChainBoard, 1, 1), 0, "sanity: first clause must not be what makes this pass")
    assert.equal(isSafeExtension(twoChainBoard, liberties, 1, 1), true)
  })
})

describe("findExpandMoves — the 2026-08-11 self-atari fix", () => {
  test("a lone touching candidate is returned regardless of safe/risky classification", () => {
    // column 0: "X.."   x=0: y0=X,y1=.,y2=.
    // column 1: "O.O"   x=1: y0=O,y1=.,y2=O
    // column 2: "..."   x=2: all empty, but not adjacent to (0,0) so not a
    //                    candidate at all
    // (0,1) is the ONLY point touching the friendly chain at (0,0) here --
    // the point of this test is that "prefer safe" never means "drop the
    // only option," not to pin down whether this particular geometry rates
    // as safe or risky (see the "filters out" test below for that).
    const board = ["X..", "O.O", "..."]
    const validMoves = [
      [false, true, true],
      [false, true, false],
      [true, true, true],
    ]
    const liberties = [
      [-1, 1, -1],
      [-1, -1, -1],
      [-1, -1, -1],
    ]
    const moves = findExpandMoves(board, validMoves, liberties)
    assert.deepEqual(moves, [[0, 1]])
  })

  test("filters out a risky join when a safe one is also available", () => {
    // Two separate, unconnected friendly stones on a 4-wide board:
    // (0,0), boxed in so its only liberty (0,1) is a risky, easily-cut
    // extension (0 empty neighbors of its own, weak 1-liberty backer); and
    // (2,1), a healthy 3-liberty stone whose extension at (3,1) has 2 open
    // flanks of its own -- safe.
    //   x=0: "X.O"   (0,0)=X (0,1)=. (0,2)=O
    //   x=1: "OOO"   fully separates the two groups
    //   x=2: ".X."   (2,0)=. (2,1)=X (2,2)=.
    //   x=3: "..."   all empty
    const board = ["X.O", "OOO", ".X.", "..."]
    const validMoves = [
      [false, true, false],
      [false, false, false],
      [true, false, true],
      [true, true, true],
    ]
    const liberties = [
      [1, -1, -1],
      [-1, -1, -1],
      [-1, 3, -1],
      [-1, -1, -1],
    ]
    const moves = findExpandMoves(board, validMoves, liberties)
    // (0,1) touches only the weak (0,0) chain: its own neighbors are all
    // O/X (0 empty) and its one friendly neighbor has only 1 liberty, so
    // it's risky. (3,1) touches the healthy (2,1) chain and has 2 open
    // flanks of its own ((3,0),(3,2)) -- safe. ((2,0)/(2,2) also touch
    // (2,1) but are both-even reserved points, excluded from expand
    // entirely regardless of safety.) Since a safe candidate exists, the
    // risky one must be excluded.
    assert.ok(moves.every(([x, y]) => !(x === 0 && y === 1)), "must not include the risky self-atari join")
    assert.ok(moves.length > 0, "must still return the safe joins")
  })

})

describe("findRandomMoves", () => {
  const board = ["...", "...", "..."]
  const validMoves = [
    [true, true, true],
    [true, true, true],
    [true, true, true],
  ]
  test("excludes both-even (reserved) points by default", () => {
    const moves = findRandomMoves(board, validMoves, false)
    assert.ok(!moves.some(([x, y]) => isReservedSpace(x, y)))
  })
  test("includes reserved points when allowReserved is true", () => {
    const moves = findRandomMoves(board, validMoves, true)
    assert.ok(moves.some(([x, y]) => isReservedSpace(x, y)))
    assert.equal(moves.length, 9)
  })
})

describe("pickMove — priority order", () => {
  test("capture beats everything else when available", () => {
    // Same boxed-in white stone as the findCaptureMoves tests: (1,0)=O
    // with its only liberty at (1,1). A friendly stone at (2,1) also sits
    // on the board so an "expand" candidate would otherwise be available
    // too -- capture must still win.
    const board = ["X..", "O..", "X.X"]
    const validMoves = [
      [false, true, true],
      [false, true, true],
      [false, true, false],
    ]
    const liberties = [
      [-1, -1, -1],
      [1, -1, -1],
      [-1, -1, -1],
    ]
    const { move, kind } = pickMove(board, validMoves, liberties)
    assert.equal(kind, "capture")
    assert.deepEqual(move, [1, 1])
  })

  test("passes when no move of any kind is valid", () => {
    const board = ["X"]
    const validMoves = [[false]]
    const liberties = [[-1]]
    const { move, kind } = pickMove(board, validMoves, liberties)
    assert.equal(kind, "pass")
    assert.equal(move, null)
  })
})
