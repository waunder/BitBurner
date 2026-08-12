/**
 * Pure IPvGO board logic: a local Go rules engine (no `ns` calls, no side
 * effects) plus a flat Monte Carlo move-selection algorithm built on top of
 * it. Split out of ipvgo_player.js the same way mcp_logic.js was split out
 * of mcp.js — see that file's own header for the precedent — because this
 * is now a meaningfully larger amount of independently-testable logic than
 * the single-file heuristic version had. Unit-tested with `node --test
 * ipvgo_logic.test.js`.
 *
 * ## Why this algorithm (2026-08-12 rewrite)
 *
 * The prior version (see docs/ipvgo-strategy.md's 2026-08-11 sections) was
 * a hand-written heuristic (capture > defend > expand-with-safety-check >
 * random) with no real look-ahead and no life-and-death sense beyond "don't
 * volunteer a move that's instantly recapturable." Ken asked directly for a
 * real, known-good, citable algorithm instead of another from-scratch
 * heuristic, targeting a 90% win rate against the current opponent
 * (Netburners, 7x7) before considering a bigger board.
 *
 * **What was actually searched for and found (web search, 2026-08-12):**
 *
 * - **Bernd Bruegmann's GOBBLE (1993)** — the first program to use Monte
 *   Carlo evaluation in Go, per Bouzy & Helmstetter's own history of the
 *   technique. Its algorithm: to choose a move, play a large number of
 *   *almost entirely random* games out to completion from that move, and
 *   score each one; a move's value is the average of those scores. Its
 *   *only* domain-specific knowledge was forbidding a move that fills one's
 *   own eye. **source**: Bouzy & Helmstetter, "Developments on Monte-Carlo
 *   Go" (https://helios2.mi.parisdescartes.fr/~bouzy/publications/acg10.pdf),
 *   which itself credits Bruegmann; corroborated by Rémi Coulom's "The
 *   Monte-Carlo Revolution in Go" (https://www.remi-coulom.fr/JFFoS/JFFoS.pdf).
 * - **Bouzy & Helmstetter's Olga/Oleg (early 2000s)** — a deliberately
 *   *simpler* Monte Carlo approach than Bruegmann's, generating ~7000
 *   random 9x9 games/sec on 2GHz-era hardware, i.e. the same "flat Monte
 *   Carlo" idea (no tree search, no neural net) is cheap enough to run
 *   per-move in a scripting language. **source**: same Bouzy & Helmstetter
 *   paper above.
 * - This is exactly the "Monte Carlo Go / light random-playout evaluation"
 *   approach flagged as worth investigating in this task's own brief: real,
 *   published, effective on small boards, predates deep learning, and is
 *   genuinely implementable here. It is deliberately the *flat* (no
 *   tree/UCT) version, matching "rudimentary" — MCTS/UCB1 tree search is
 *   the documented next refinement (Coulom 2006, Kocsis & Szepesvári's
 *   UCT), not attempted this round.
 * - **Rules-engine implementation shape** (flood-fill chain discovery,
 *   capture-then-suicide-check ordering, simple-ko-by-single-capture
 *   detection, border-flood-fill area scoring) follows the description in
 *   "Implementing the Game of Go, Part 1" by Andy (moderndescartes.com,
 *   https://www.moderndescartes.com/essays/implementing_go/) — a from-first-
 *   principles Go rules implementation guide, cross-checked against this
 *   repo's own docs/ipvgo-strategy.md transcription of Bitburner's actual
 *   in-game rules text (capture > suicide-except-when-it-captures >
 *   superko).
 * - **The eye-shape/diagonal check** in isSimpleEye below is the standard
 *   "true eye" heuristic (all orthogonal neighbors friendly, at most
 *   one/zero opponent diagonal depending on edge vs. interior) described on
 *   Wikipedia's "Two eyes" article (https://en.wikipedia.org/wiki/Two_eyes)
 *   and "Eyes and False Eyes in Go" (https://polgote.com/blog/eyes-and-false-eyes-go/).
 *   It is intentionally a heuristic, not full life-and-death analysis (see
 *   "Known limitations" below).
 *
 * ## What this buys over the old heuristic
 *
 * The old bug (docs/ipvgo-strategy.md, 2026-08-11 (later)): findExpandMoves
 * had no real sense of *shape* — it would merge every friendly stone into
 * one blob with no separate eyes, which a competent opponent could capture
 * in its entirety in one move. Flat Monte Carlo doesn't need a hand-written
 * rule to avoid that: a move that leads to the whole group dying shows up
 * directly as a terrible average score across the random continuations
 * that follow it, because the *actual simulated outcome* captures it. This
 * is a more general fix than the specific isSafeExtension patch — it
 * doesn't just avoid one known failure shape, it evaluates the true
 * (simulated) consequence of every legal move. It also does this without
 * needing ns.go.analysis.getChains()/getControlledEmptyNodes() (16GB
 * apiece) — the whole rules engine, including chain-finding and area
 * scoring, is reimplemented locally and run against in-memory board copies,
 * per this task's own constraint that no hypothetical move may ever be
 * played for real via ns.go.makeMove.
 *
 * ## Known limitations (rudimentary is the point, but be honest about it)
 *
 * - **Ko handling is simplified ("positional ko by single capture"), not
 *   full superko.** After a move that captures exactly one stone and
 *   leaves the capturing stone itself as a lone stone with one liberty, the
 *   just-vacated point is barred for the *next* move only — the standard
 *   simple-ko approximation (moderndescartes.com's own description matches
 *   this exactly), not Bitburner's documented full superko (no repeated
 *   board state anywhere in game history). This only matters inside
 *   simulated playouts (used purely for move *evaluation*); the actual move
 *   submitted to the live game is always gated by ns.go.analysis.getValidMoves(),
 *   which the real game computes authoritatively, so an illegal move is
 *   never actually submitted.
 * - **Eye detection is the simple diagonal heuristic above, not true
 *   life-and-death analysis.** It can misjudge some real eye shapes (false
 *   eyes it thinks are real, or vice versa in unusual configurations). Its
 *   only job is to keep the *random rollout policy* from doing something
 *   obviously self-destructive (filling in your own group's last escape
 *   route) — it does not gate the real move choice at the root, only the
 *   simulated continuations used to score root moves.
 * - **Flat Monte Carlo, not MCTS.** Every candidate move gets a fixed
 *   playout budget; nothing reallocates more simulation time to promising
 *   moves the way UCT-based search does. This is a known, published
 *   limitation of the original Gobble-style approach (see Coulom's paper
 *   above) — the documented next step if this round's numbers justify
 *   further investment, not a bug.
 * - **Playout policy is uniform-random among non-eye-filling legal
 *   moves, with no capture bias or other pattern knowledge** — this
 *   deliberately matches Gobble's own original policy as closely as
 *   possible (Bruegmann's "sole domain-dependent knowledge" was the eye
 *   rule, full stop; see the citation above). An earlier draft of this
 *   file added a capture-seeking bias (the "light playout" refinement the
 *   Bouzy/Coulom retrospectives describe as generally stronger than pure
 *   uniform random), but implementing it required enumerating every legal
 *   move each rollout step to know which ones captured something, and
 *   profiling on a 7x7 board showed that made move selection take multiple
 *   *seconds* — unacceptable for a script sharing the browser's single
 *   JS thread with the rest of the game (see docs/ipvgo-strategy.md).
 *   Switching to rejection sampling (try random points, keep the first
 *   legal non-eye one) for move selection cut that to milliseconds, but
 *   makes a capture-seeking bias expensive to compute again for the same
 *   reason. Kept simple and fast rather than clever and slow, consistent
 *   with the whole point of picking a "rudimentary" algorithm.
 */

export const EMPTY = 0
export const BLACK = 1
export const WHITE = 2
export const DEAD = 3

const CHAR_TO_CODE = { ".": EMPTY, X: BLACK, O: WHITE, "#": DEAD }
const CODE_TO_CHAR = [".", "X", "O", "#"]

export const DEFAULT_NUM_PLAYOUTS = 20

const neighborTableCache = new Map()

// Precomputed per-(W,H) orthogonal-neighbor index lists. Board sizes are
// fixed for the lifetime of a game (5/7/9/13 per resetBoardState's type),
// so this cache only ever holds a handful of entries.
function neighborTable(W, H) {
  const key = W + "x" + H
  let table = neighborTableCache.get(key)
  if (table) return table
  table = new Array(W * H)
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const idx = x * H + y
      const list = []
      if (x > 0) list.push((x - 1) * H + y)
      if (x < W - 1) list.push((x + 1) * H + y)
      if (y > 0) list.push(x * H + (y - 1))
      if (y < H - 1) list.push(x * H + (y + 1))
      table[idx] = list
    }
  }
  neighborTableCache.set(key, table)
  return table
}

export function xyToIdx(x, y, H) {
  return x * H + y
}

export function idxToXY(idx, H) {
  return [Math.floor(idx / H), idx % H]
}

// Converts ns.go.getBoardState()'s array-of-column-strings format
// (board[x][y], "X"/"O"/"."/"#") into a flat Uint8Array for fast local
// simulation. See docs/ipvgo-strategy.md for the board[x][y] convention
// citation (NetscriptDefinitions.d.ts's own doc comment on getBoardState).
export function boardToFlat(board) {
  const W = board.length
  const H = board[0].length
  const flat = new Uint8Array(W * H)
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      flat[xyToIdx(x, y, H)] = CHAR_TO_CODE[board[x][y]] ?? EMPTY
    }
  }
  return { flat, W, H }
}

// Inverse of boardToFlat, mainly useful for tests/debugging.
export function flatToBoard(flat, W, H) {
  const board = []
  for (let x = 0; x < W; x++) {
    let col = ""
    for (let y = 0; y < H; y++) col += CODE_TO_CHAR[flat[xyToIdx(x, y, H)]]
    board.push(col)
  }
  return board
}

// Flood-fills the chain (network) containing idx and returns its color,
// member stone indices, and liberty (empty-neighbor) indices. Dead nodes
// and opponent stones contribute neither stones nor liberties, matching
// the game's own "dead nodes don't count as territory or provide open
// ports" rule (docs/ipvgo-strategy.md, official doc).
export function findChain(flat, W, H, idx) {
  const color = flat[idx]
  const table = neighborTable(W, H)
  const stones = [idx]
  const liberties = new Set()
  const visited = new Uint8Array(flat.length)
  visited[idx] = 1
  const stack = [idx]
  while (stack.length) {
    const cur = stack.pop()
    for (const n of table[cur]) {
      if (flat[n] === color) {
        if (!visited[n]) {
          visited[n] = 1
          stones.push(n)
          stack.push(n)
        }
      } else if (flat[n] === EMPTY) {
        liberties.add(n)
      }
    }
  }
  return { color, stones, liberties }
}

// Applies a move for `color` at `idx` on a *copy* of flat, following the
// game's own documented rule ordering (docs/ipvgo-strategy.md, "official
// doc" tag, transcribed from the in-game "How to Play" special rules):
// captures resolve first, then the placed stone's own chain is checked for
// suicide — a move that captures is legal even if it would otherwise be a
// suicide, because the capture necessarily opens a liberty. Returns
// { legal: false } for an occupied point or a genuine suicide. On success,
// returns the new board plus how many stones were captured and, if this
// move fits the simple-ko shape (captured exactly one stone and the
// capturing stone is itself a lone one-liberty stone), the point that must
// be barred for the opponent's immediate next move.
export function applyMoveFlat(flat, W, H, idx, color) {
  if (flat[idx] !== EMPTY) return { legal: false }
  const next = flat.slice()
  next[idx] = color
  const opponent = color === BLACK ? WHITE : BLACK
  const table = neighborTable(W, H)
  const alreadyChecked = new Set()
  let capturedCount = 0
  let lastCapturedSingle = -1
  for (const n of table[idx]) {
    if (next[n] !== opponent || alreadyChecked.has(n)) continue
    const chain = findChain(next, W, H, n)
    for (const s of chain.stones) alreadyChecked.add(s)
    if (chain.liberties.size === 0) {
      for (const s of chain.stones) next[s] = EMPTY
      capturedCount += chain.stones.length
      if (chain.stones.length === 1) lastCapturedSingle = chain.stones[0]
    }
  }
  const ownChain = findChain(next, W, H, idx)
  if (ownChain.liberties.size === 0) {
    // Genuine suicide: removes the network's last open port and captured
    // nothing that would have reopened one. Illegal per the game's own
    // "cannot suicide except when it captures" rule.
    return { legal: false }
  }
  let koIndex = -1
  if (capturedCount === 1 && ownChain.stones.length === 1 && ownChain.liberties.size === 1) {
    koIndex = lastCapturedSingle
  }
  return { legal: true, flat: next, capturedCount, koIndex }
}

// Single pass over every empty point: which are legal for `color` to play
// (respecting the simple-ko bar), and which of those capture at least one
// opponent stone. Kept as one function so pickPlayoutMove doesn't run
// applyMoveFlat twice per candidate point.
export function analyzeMoves(flat, W, H, color, koIndex = -1) {
  const legal = []
  const capturing = []
  for (let idx = 0; idx < flat.length; idx++) {
    if (flat[idx] !== EMPTY || idx === koIndex) continue
    const res = applyMoveFlat(flat, W, H, idx, color)
    if (!res.legal) continue
    legal.push(idx)
    if (res.capturedCount > 0) capturing.push(idx)
  }
  return { legal, capturing }
}

// Standard diagonal-based "true eye" heuristic (Wikipedia "Two eyes";
// Polgote's "Eyes and False Eyes in Go", both cited above): every
// orthogonal neighbor must be friendly, and at most one diagonal neighbor
// may be the opponent's if the point is in the interior (all four diagonals
// on-board), or zero if it's on an edge or corner (fewer than four
// diagonals on-board). Used only to keep the random rollout policy from
// filling in a group's own eye — Gobble's own sole piece of domain
// knowledge, per Bouzy & Helmstetter's account cited above.
export function isSimpleEye(flat, W, H, idx, color) {
  if (flat[idx] !== EMPTY) return false
  const [x, y] = idxToXY(idx, H)
  for (const n of neighborTable(W, H)[idx]) {
    if (flat[n] !== color) return false
  }
  const opponent = color === BLACK ? WHITE : BLACK
  const diagCoords = [
    [x - 1, y - 1],
    [x - 1, y + 1],
    [x + 1, y - 1],
    [x + 1, y + 1],
  ]
  let diagonalsOnBoard = 0
  let opponentDiagonals = 0
  for (const [dx, dy] of diagCoords) {
    if (dx < 0 || dx >= W || dy < 0 || dy >= H) continue
    diagonalsOnBoard++
    if (flat[xyToIdx(dx, dy, H)] === opponent) opponentDiagonals++
  }
  const allowed = diagonalsOnBoard < 4 ? 0 : 1
  return opponentDiagonals <= allowed
}

// Area scoring per docs/ipvgo-strategy.md (official doc, transcribed from
// the in-game rules): one point per stone on the board, plus one point per
// empty point *fully* surrounded by a single color (flood-filled — an
// empty region bordering both colors, or only dead nodes, scores for
// neither). Dead nodes never count for either side and never propagate a
// region (matches "doesn't count as territory" from the official rules
// text).
export function scoreAreaFlat(flat, W, H) {
  let black = 0
  let white = 0
  const table = neighborTable(W, H)
  const visited = new Uint8Array(flat.length)
  for (let idx = 0; idx < flat.length; idx++) {
    const v = flat[idx]
    if (v === BLACK) {
      black++
      continue
    }
    if (v === WHITE) {
      white++
      continue
    }
    if (v === DEAD || visited[idx]) continue
    const region = [idx]
    visited[idx] = 1
    const stack = [idx]
    let touchesBlack = false
    let touchesWhite = false
    while (stack.length) {
      const cur = stack.pop()
      for (const n of table[cur]) {
        const nv = flat[n]
        if (nv === BLACK) touchesBlack = true
        else if (nv === WHITE) touchesWhite = true
        else if (nv === EMPTY && !visited[n]) {
          visited[n] = 1
          region.push(n)
          stack.push(n)
        }
      }
    }
    if (touchesBlack && !touchesWhite) black += region.length
    else if (touchesWhite && !touchesBlack) white += region.length
    // contested (touches both) or fully walled off by dead nodes only:
    // scores for neither, matching area-scoring convention for neutral space.
  }
  return { black, white }
}

// One rollout step: pick a legal, non-eye-filling move for `color` via
// rejection sampling -- try random empty points and accept the first one
// that's both legal and not a self-filled eye, rather than enumerating
// every empty point's legality every single step (that full-board-scan
// approach was the original implementation here, and profiling on a 7x7
// board showed it made move selection take several *seconds*, because
// analyzeMoves calls applyMoveFlat -- a full board clone plus flood-fill --
// once per empty point, every rollout ply, for every playout, for every
// candidate root move. Rejection sampling needs ~1 applyMoveFlat call per
// accepted move on average instead of ~n, which is the difference between
// freezing the game for seconds per move and running comfortably inside a
// single tick. Falls back to an exhaustive scan only if random sampling
// hasn't found a legal move after a bounded number of attempts (this
// becomes likely only very late in a game, when most remaining empty
// points are eyes).
//
// Returns { idx: -1 } to mean "pass" (nothing worth playing found).
// Otherwise returns { idx, flat, koIndex } -- the already-computed result
// of playing that move, so the caller (runPlayout) never has to redo the
// same applyMoveFlat call.
const REJECTION_SAMPLE_ATTEMPTS = 6

export function pickPlayoutMove(flat, W, H, color, koIndex, rng) {
  const n = flat.length
  const emptyIdxs = []
  for (let idx = 0; idx < n; idx++) {
    if (flat[idx] === EMPTY && idx !== koIndex) emptyIdxs.push(idx)
  }
  if (emptyIdxs.length === 0) return { idx: -1 }

  for (let attempt = 0; attempt < REJECTION_SAMPLE_ATTEMPTS; attempt++) {
    const idx = emptyIdxs[Math.floor(rng() * emptyIdxs.length)]
    if (isSimpleEye(flat, W, H, idx, color)) continue
    const res = applyMoveFlat(flat, W, H, idx, color)
    if (res.legal) return { idx, flat: res.flat, koIndex: res.koIndex }
  }
  // Fallback: exhaustive scan (rare -- only reached when random sampling
  // keeps hitting eyes/illegal points, i.e. near the end of a game).
  for (const idx of emptyIdxs) {
    if (isSimpleEye(flat, W, H, idx, color)) continue
    const res = applyMoveFlat(flat, W, H, idx, color)
    if (res.legal) return { idx, flat: res.flat, koIndex: res.koIndex }
  }
  return { idx: -1 }
}

// Plays a single random-ish game to completion (or until maxMoves, as a
// safety valve) starting from `flat` with `colorToMove` to move, and
// returns the final area score. This is Gobble's own evaluation loop
// (Bruegmann 1993, per Bouzy & Helmstetter's account cited above): "play a
// large number of almost entirely random games... and score them," with
// eye-filling forbidden as "the sole domain-dependent knowledge used in
// Gobble" (same source) -- no capture bias or other pattern knowledge, by
// design, both for fidelity to the cited algorithm and because it keeps
// each rollout step to ~O(1) amortized work (see pickPlayoutMove above).
export function runPlayout(flat, W, H, colorToMove, koIndex, maxMoves, rng) {
  let board = flat
  let color = colorToMove
  let ko = koIndex
  let consecutivePasses = 0
  for (let move = 0; move < maxMoves; move++) {
    const picked = pickPlayoutMove(board, W, H, color, ko, rng)
    if (picked.idx === -1) {
      consecutivePasses++
      if (consecutivePasses >= 2) break
      color = color === BLACK ? WHITE : BLACK
      ko = -1
      continue
    }
    consecutivePasses = 0
    board = picked.flat
    ko = picked.koIndex
    color = color === BLACK ? WHITE : BLACK
  }
  return scoreAreaFlat(board, W, H)
}

// Evaluates a single candidate move for `colorChar` ("X" or "O") by
// playing it, then running numPlayouts random rollouts from the resulting
// position and averaging the margin (own score minus opponent score) each
// one ends in. Returns null if the move turns out to be locally illegal
// (should not happen for a move the real game already reported as valid —
// guarded defensively anyway since this is a from-scratch reimplementation
// of the rules, not the game's own authoritative check).
export function evaluateMove(board, x, y, colorChar, opts = {}) {
  const { numPlayouts = DEFAULT_NUM_PLAYOUTS, maxPlayoutMoves, rng = Math.random } = opts
  const { flat, W, H } = boardToFlat(board)
  const color = colorChar === "X" ? BLACK : WHITE
  const idx = xyToIdx(x, y, H)
  const placed = applyMoveFlat(flat, W, H, idx, color)
  if (!placed.legal) return null
  const opponent = color === BLACK ? WHITE : BLACK
  const cap = maxPlayoutMoves ?? W * H * 2
  let total = 0
  for (let i = 0; i < numPlayouts; i++) {
    const { black, white } = runPlayout(placed.flat, W, H, opponent, placed.koIndex, cap, rng)
    total += color === BLACK ? black - white : white - black
  }
  return total / numPlayouts
}

// The move-selection entry point: flat Monte Carlo over every point the
// real game currently reports as valid (ns.go.analysis.getValidMoves()) —
// evaluate each with evaluateMove and play whichever has the best average
// simulated margin, breaking ties randomly. Returns { move: null, ... } iff
// there are no valid moves at all, i.e. the caller should pass.
export function chooseBestMove(board, validMoves, colorChar, opts = {}) {
  const W = board.length
  const H = board[0].length
  const candidates = []
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      if (validMoves[x]?.[y]) candidates.push([x, y])
    }
  }
  if (candidates.length === 0) return { move: null, margin: null, evaluated: 0 }

  let bestMargin = -Infinity
  let bestMoves = []
  for (const [x, y] of candidates) {
    const margin = evaluateMove(board, x, y, colorChar, opts)
    if (margin === null) continue
    if (margin > bestMargin) {
      bestMargin = margin
      bestMoves = [[x, y]]
    } else if (margin === bestMargin) {
      bestMoves.push([x, y])
    }
  }
  if (bestMoves.length === 0) return { move: null, margin: null, evaluated: candidates.length }
  const rng = opts.rng ?? Math.random
  const chosen = bestMoves[Math.floor(rng() * bestMoves.length)]
  return { move: chosen, margin: bestMargin, evaluated: candidates.length }
}

// Deterministic seeded RNG (mulberry32) for reproducible tests — the
// Monte Carlo functions above all accept an injectable `rng` for exactly
// this reason.
export function makeRng(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
