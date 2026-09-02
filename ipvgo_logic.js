/**
 * Pure IPvGO board logic: a local Go rules engine (no `ns` calls, no side
 * effects) plus a Monte Carlo Tree Search (MCTS/UCT) move-selection
 * algorithm built on top of it. Split out of ipvgo_player.js the same way
 * mcp_logic.js was split out of mcp.js — see that file's own header for the
 * precedent — because this is now a meaningfully larger amount of
 * independently-testable logic than the single-file heuristic version had.
 * Unit-tested with `node --test ipvgo_logic.test.js`.
 *
 * ## 2026-08-12 (later): flat Monte Carlo -> MCTS with UCB1
 *
 * After the flat Monte Carlo version below ran live: 61 games, 41% rolling
 * win rate (a real jump from ~0% under the old heuristic, but well short of
 * the 90% target) and, crucially, huge unused timing headroom (avg 52ms,
 * max 164ms per move against the ~500ms-ish budget this repo's own
 * "don't starve the shared game loop" discipline allows). The coordinator's
 * own framing, and the correct next step per the same "actual published
 * algorithm, not another heuristic" standard used for the first rewrite:
 * upgrade to real tree search.
 *
 * **What was searched for and found** (web search, this session):
 *
 * - **Kocsis & Szepesvári, "Bandit Based Monte-Carlo Planning," ECML 2006**
 *   (https://link.springer.com/chapter/10.1007/11871842_29) — introduced
 *   UCT: treat move selection at *every* explored tree node as its own
 *   multi-armed bandit problem, and use UCB1 (Auer et al. 2002) to pick
 *   which arm (move) to explore next. This is THE standard, well-cited next
 *   step up from flat Monte Carlo (Gobble/Bruegmann, cited below) — instead
 *   of splitting a fixed playout budget evenly across every candidate move
 *   (flat MC's whole limitation), spend more simulations on moves that are
 *   looking good and fewer on ones that look clearly bad, while still
 *   guaranteeing every move gets tried at least once.
 * - **The UCB1-for-trees formula** (see e.g. chessprogramming.org's UCT
 *   page, https://www.chessprogramming.org/UCT, and the GeeksforGeeks MCTS
 *   explainer found in the same search): for a child node,
 *   `score = Q(child) + C * sqrt(ln(N(parent)) / N(child))`, where `Q` is
 *   the child's average reward so far and `N(x)` is `x`'s visit count.
 *   `C = sqrt(2)` is the standard textbook choice *specifically when the
 *   reward is normalized to [0,1]* — which is exactly why `runMctsIteration`
 *   below backpropagates a plain win/loss indicator (1/0), not flat MC's
 *   raw area-scoring margin: margins aren't naturally bounded, so using
 *   them with `C = sqrt(2)` would be an unfounded, untuned combination
 *   rather than the textbook one.
 * - **Gelly & Silver, "Combining Online and Offline Knowledge in UCT,"
 *   ICML 2007** (https://ai.dmi.unibas.ch/research/reading_group/gelly-silver-icml2007.pdf)
 *   — one of their three proposed techniques for injecting prior knowledge
 *   into UCT is exactly "initialize new action-state nodes with visit
 *   counts and Q-values from prior knowledge" instead of starting every
 *   node at zero. This is the (much simpler, cruder) technique
 *   `computeOpeningMoveStats`/the opening-move prior below is modeled on —
 *   their prior knowledge came from a learned value function; this one is
 *   just an empirical win-rate lookup table built from this script's own
 *   `ipvgo_status.json` history, per the coordinator's explicit "keep this
 *   simple" instruction.
 *
 * Flat Monte Carlo's own functions (`pickPlayoutMove`, `runPlayout`,
 * `scoreAreaFlat`, etc.) are unchanged and still do all the real work
 * *inside* each simulation's random rollout (MCTS's "default policy") —
 * only the part that decides *where in the tree to spend simulations* is
 * new. See "MCTS design" further down for the concrete node/selection/
 * expansion/backpropagation implementation.
 *
 * ## Why this algorithm (original 2026-08-12 rewrite, flat Monte Carlo)
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
 *   eyes it thinks are real, or vice versa in unusual configurations). Used
 *   to keep the *random rollout policy* from doing something obviously
 *   self-destructive (filling in your own group's last escape route), and,
 *   as of 2026-08-12, also filters the root candidate set in chooseBestMove
 *   for the same reason (see that function's own comment) — misjudging an
 *   edge case there means at worst an extra pass, not an illegal move,
 *   since the fallback when filtering empties the candidate set is to pass
 *   rather than force a choice among what's left.
 * - ~~**Flat Monte Carlo, not MCTS.**~~ **Addressed 2026-08-12 (later)** —
 *   see the MCTS section above/below. Kept here as the historical record of
 *   why the upgrade happened.
 * - **MCTS's backpropagated reward is win/loss only, discarding the
 *   area-scoring margin.** A move that wins by 1 point and a move that wins
 *   by 30 look identical to the tree search (both are a "1"). This is a
 *   deliberate simplification to keep UCB1's `C = sqrt(2)` textbook-correct
 *   (see above) rather than inventing an untuned constant for a
 *   margin-scaled reward — and arguably the right target anyway, since the
 *   real game is won/lost by score comparison, not by margin. The
 *   trade-off: it can't distinguish "barely winning" from "dominating,"
 *   which matters for `docs/ipvgo-strategy.md`'s note that territory held
 *   awards stat-multiplier bonuses regardless of win/loss — the current
 *   algorithm isn't optimizing for that at all, only for winning.
 * - **Komi is applied only when scoring a finished simulated game for
 *   win/loss purposes, not inside `scoreAreaFlat` itself** (which stays a
 *   pure, komi-free area count). The real game gives White a komi bonus
 *   (5.5 by default per `NetscriptDefinitions.d.ts`'s
 *   `setTestingBoardState` parameter, confirmed live per-game via
 *   `ns.go.getGameState().komi`) to offset Black's first-move advantage —
 *   omitting it, which the flat Monte Carlo version silently did, would
 *   have systematically overrated Black's simulated win rate in close
 *   games. Threaded through as an explicit `komi` option now.
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

// Total simulation budget for chooseBestMove's MCTS search (shared across
// the whole tree, NOT per candidate move the way flat MC's
// DEFAULT_NUM_PLAYOUTS was -- that's the entire point of switching to UCT:
// letting the search decide where to spend it). Live profiling after the
// flat-MC deploy showed huge unused timing headroom (avg 52ms, max 164ms
// per move at ~20 playouts/candidate, ~980 total playouts on a full 7x7
// board). Local profiling of this MCTS version on a synthetic empty 7x7
// board (the worst case -- most candidates, longest rollouts): 800 sims ~
// 130ms, 1500 sims ~ 250ms, 3000 sims ~ 480ms, with returns visibly
// diminishing well before 3000 (the chosen move and its win-rate estimate
// were already stable by ~400-800). 1500 was picked as a real increase
// over flat MC's own live cost while keeping worst-case timing well under
// where "starving the shared game loop" would become a concern -- still
// needs live confirmation (see ipvgo_player.js's own profiling note),
// same "measure, don't just estimate" discipline as every RAM/timing
// number in this file.
export const DEFAULT_NUM_SIMULATIONS = 1500

// Opening-move learning defaults (see computeOpeningMoveStats and the
// Gelly & Silver citation above). MIN: don't apply any bias for a move
// until it's been played at least this many times -- below that, the
// "honest" answer is "not enough data yet," not a guess dressed up as a
// signal. PRIOR_WEIGHT: how many virtual (pseudo) simulations worth of
// confidence a qualifying move's historical record is worth at the moment
// its tree node is created, before any of *this* move's own real
// simulations run -- small enough that a bad real-time read can still
// override it as the search progresses, per Gelly & Silver's own point
// that prior knowledge should nudge, not dictate.
export const DEFAULT_MIN_OPENING_SAMPLE = 5
export const DEFAULT_OPENING_PRIOR_WEIGHT = 10

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
// rejection sampling -- try a few random empty points and prefer a capture
// when one appears, otherwise accept the first one.
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
// This keeps rollout cost close to the old path while making obvious sampled
// captures visible to the simulation policy.
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

  let firstLegal = null
  let bestCapture = null
  for (let attempt = 0; attempt < REJECTION_SAMPLE_ATTEMPTS; attempt++) {
    const idx = emptyIdxs[Math.floor(rng() * emptyIdxs.length)]
    if (isSimpleEye(flat, W, H, idx, color)) continue
    const res = applyMoveFlat(flat, W, H, idx, color)
    if (!res.legal) continue
    const candidate = { idx, flat: res.flat, koIndex: res.koIndex, capturedCount: res.capturedCount }
    if (!firstLegal) firstLegal = candidate
    if (candidate.capturedCount > 0 && (!bestCapture || candidate.capturedCount > bestCapture.capturedCount)) {
      bestCapture = candidate
    }
  }
  if (bestCapture) return bestCapture
  if (firstLegal) return firstLegal
  // Fallback: exhaustive scan (rare -- only reached when random sampling
  // keeps hitting eyes/illegal points, i.e. near the end of a game).
  let firstFallback = null
  for (const idx of emptyIdxs) {
    if (isSimpleEye(flat, W, H, idx, color)) continue
    const res = applyMoveFlat(flat, W, H, idx, color)
    if (!res.legal) continue
    const candidate = { idx, flat: res.flat, koIndex: res.koIndex, capturedCount: res.capturedCount }
    if (!firstFallback) firstFallback = candidate
    if (candidate.capturedCount > 0) return candidate
  }
  return firstFallback || { idx: -1 }
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

// ============================================================================
// MCTS design (2026-08-12 (later)) -- see the file header for citations.
// ============================================================================
//
// A tree node represents a board position reached after some "mover" color
// played the move that produced it (the root has no mover -- it's the real
// current position). `node.colorToMove` is whose turn it is *at* that node
// (i.e. the color choosing among `node.children`). `node.visits`/`node.wins`
// accumulate simulation outcomes from the *mover's* perspective -- so when
// `node.colorToMove` is comparing its children via UCB1, each child's own
// (wins/visits) is already the right perspective (that child's mover IS
// node.colorToMove). The root's own visits/wins follow the same bookkeeping
// (visits gets incremented so UCB1's ln(parent.visits) term works for its
// children; wins is simply never read for the root since nothing "moved
// into" it).
//
// Moves are tracked as flat indices internally; only chooseBestMove's final
// return value converts back to [x, y].

export const UCB1_EXPLORATION_CONSTANT = Math.SQRT2

// The UCB1-for-trees formula itself (see file header for the citation and
// why C=sqrt(2) requires a [0,1]-normalized reward, which is why this
// engine backpropagates win/loss rather than a raw score margin). An
// unvisited child always wins (Infinity) -- standard UCT practice of trying
// every move at least once before comparing established averages.
export function ucb1Score(childVisits, childWins, parentVisits, explorationConstant) {
  if (childVisits === 0) return Infinity
  return childWins / childVisits + explorationConstant * Math.sqrt(Math.log(parentVisits) / childVisits)
}

function createMctsNode(flat, koIndex, colorToMove, untriedMoves, priorVisits, priorWins) {
  return {
    flat,
    koIndex,
    colorToMove,
    untriedMoves,
    children: [], // { moveIdx, node }
    visits: priorVisits,
    wins: priorWins,
  }
}

// Legal moves available to `color` at a *non-root* tree node. Excludes
// simple-eye-filling points, same as the rollout policy (pickPlayoutMove)
// already does -- an established Go-AI practice (not just this rollout's
// own convenience): a move that fills your own eye is essentially never
// worth spending tree-search budget exploring, so it's excluded from the
// tree's own candidate set too, not merely deprioritized. chooseBestMove
// below applies the same filter at the root now too (added 2026-08-12,
// see its own comment for why the original "never touch the root" reasoning
// was wrong) -- this function still exists as-is for every node below the
// root, which never needs to fall back to the game's raw
// ns.go.analysis.getValidMoves() grid the way the root does when filtering
// would otherwise empty its candidate set entirely.
function nonRootCandidateMoves(flat, W, H, color, koIndex) {
  const { legal } = analyzeMoves(flat, W, H, color, koIndex)
  return legal.filter((idx) => !isSimpleEye(flat, W, H, idx, color))
}

// Selection phase: descend via UCB1 while a node is fully expanded (no
// untried moves left) and has at least one child.
function selectBestChild(node, explorationConstant) {
  let best = null
  let bestScore = -Infinity
  for (const entry of node.children) {
    const score = ucb1Score(entry.node.visits, entry.node.wins, node.visits, explorationConstant)
    if (score > bestScore) {
      bestScore = score
      best = entry
    }
  }
  return best
}

// Runs one full select -> expand -> simulate -> backpropagate iteration
// starting from `root`, mutating the tree in place.
function runMctsIteration(root, W, H, komi, explorationConstant, maxPlayoutMoves, rng, openingContext) {
  const path = [root]
  let node = root
  while (node.untriedMoves.length === 0 && node.children.length > 0) {
    const entry = selectBestChild(node, explorationConstant)
    node = entry.node
    path.push(node)
  }
  if (node.untriedMoves.length > 0) {
    const isRoot = node === root
    const entry = expandNode(node, W, H, isRoot, openingContext, rng)
    node = entry.node
    path.push(node)
  }

  const { black, white } = runPlayout(node.flat, W, H, node.colorToMove, node.koIndex, maxPlayoutMoves, rng)
  const blackWon = black > white + komi

  for (let i = path.length - 1; i >= 0; i--) {
    const n = path[i]
    n.visits++
    if (i === 0) continue // root has no mover -- nothing to credit a win to
    const moverColor = path[i - 1].colorToMove
    const moverWon = moverColor === BLACK ? blackWon : !blackWon
    if (moverWon) n.wins++
  }
}

// Expansion phase: try one untried move from `node`, creating its child.
// `openingContext` (only ever passed when `node` is the root AND the
// caller says this is a fresh game's opening move -- see chooseBestMove's
// opts) seeds the new child with virtual visits/wins from historical data
// instead of starting at zero, when that specific move has enough
// historical samples -- see DEFAULT_OPENING_PRIOR_WEIGHT's own comment and
// the Gelly & Silver citation in the file header.
function expandNode(node, W, H, isRoot, openingContext, rng) {
  const i = Math.floor(rng() * node.untriedMoves.length)
  const moveIdx = node.untriedMoves[i]
  node.untriedMoves[i] = node.untriedMoves[node.untriedMoves.length - 1]
  node.untriedMoves.pop()

  const res = applyMoveFlat(node.flat, W, H, moveIdx, node.colorToMove)
  const childColor = node.colorToMove === BLACK ? WHITE : BLACK
  const childCandidates = res.legal ? nonRootCandidateMoves(res.flat, W, H, childColor, res.koIndex) : []

  let priorVisits = 0
  let priorWins = 0
  if (isRoot && openingContext && openingContext.stats) {
    const [x, y] = idxToXY(moveIdx, H)
    const key = x + "," + y
    const moveStats = openingContext.stats.byMove[key]
    if (moveStats && moveStats.games >= openingContext.minSample) {
      priorVisits = openingContext.priorWeight
      priorWins = openingContext.priorWeight * moveStats.winRate
    }
  }

  const entry = { moveIdx, node: createMctsNode(res.flat, res.koIndex, childColor, childCandidates, priorVisits, priorWins) }
  node.children.push(entry)
  return entry
}

// The move-selection entry point: Monte Carlo Tree Search (UCT/UCB1) over
// every point the real game currently reports as valid
// (ns.go.analysis.getValidMoves()). Spends `numSimulations` total
// simulations deciding where in the tree to look, rather than splitting a
// fixed budget evenly across every candidate the way the old flat Monte
// Carlo version did (see file header). Returns the most-visited root move
// (the standard "robust child" choice -- more resistant to reward noise at
// finite sample sizes than picking the highest-average-value child; see
// e.g. chessprogramming.org's UCT page, cited above, for this "robust
// child" vs. "max child" distinction). Returns `{ move: null, ... }` when
// there are no valid moves at all, or (as of 2026-08-12) when every
// remaining valid move would fill one of our own true eyes -- either way,
// the caller should pass.
//
// opts:
//   numSimulations   total simulation budget (default DEFAULT_NUM_SIMULATIONS)
//   maxPlayoutMoves  safety cap on a single rollout's length (default 2*W*H)
//   rng              injectable RNG for deterministic tests (default Math.random)
//   explorationConstant  UCB1's C (default sqrt(2) -- see file header)
//   komi             added to the opponent's score before deciding
//                     win/loss for backpropagation (default 0 -- see file
//                     header's "Known limitations" on why this must be
//                     passed explicitly, not baked into scoreAreaFlat)
//   isOpeningMove    true iff this is the very first move of a fresh game
//                     (caller's own responsibility to determine, e.g. via
//                     ns.go.getMoveHistory().length === 0) -- gates whether
//                     openingStats is consulted at all
//   openingStats     computeOpeningMoveStats(...)'s return value, or null
//   minOpeningSample / openingPriorWeight  see the DEFAULT_* constants above
export function chooseBestMove(board, validMoves, colorChar, opts = {}) {
  const {
    numSimulations = DEFAULT_NUM_SIMULATIONS,
    maxPlayoutMoves,
    rng = Math.random,
    explorationConstant = UCB1_EXPLORATION_CONSTANT,
    komi = 0,
    isOpeningMove = false,
    openingStats = null,
    minOpeningSample = DEFAULT_MIN_OPENING_SAMPLE,
    openingPriorWeight = DEFAULT_OPENING_PRIOR_WEIGHT,
  } = opts
  const { flat, W, H } = boardToFlat(board)
  const color = colorChar === "X" ? BLACK : WHITE
  const cap = maxPlayoutMoves ?? W * H * 2

  const allValidCandidates = []
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      if (validMoves[x]?.[y]) allValidCandidates.push(xyToIdx(x, y, H))
    }
  }
  if (allValidCandidates.length === 0) return { move: null, visits: 0, winRate: null, simulations: 0, evaluated: 0 }

  // Root-level eye safety, confirmed needed live 2026-08-12 (Ken watched a
  // game where Black held the majority of the board, then filled both of
  // its own eyes and died): isSimpleEye was already excluding self-eye-fills
  // from every *non-root* tree node (nonRootCandidateMoves above), on the
  // stated reasoning that the root should stay exactly the game's own
  // authoritative legal-move grid so the submitted move is always accepted.
  // That reasoning missed a case -- a group that's degenerated into one
  // shared liberty pool (docs/ipvgo-strategy.md's 2026-08-11 bug) can leave
  // *only* self-eye-filling points as legal root candidates, and with no
  // filter, MCTS has no reason not to pick one, since nothing else is
  // offered for comparison. This is exactly Bruegmann's "sole
  // domain-dependent knowledge" case (see file header) applied one level
  // higher. Filtering here can never reject a move that was the *only*
  // legal option, because that case is handled by the fallback below.
  const rootCandidates = allValidCandidates.filter((idx) => !isSimpleEye(flat, W, H, idx, color))
  // If every remaining legal move is a self-eye-fill, that's strictly worse
  // than passing -- it can only shrink our own liberties -- so treat it the
  // same as "no valid moves" and let the caller pass instead.
  if (rootCandidates.length === 0) return { move: null, visits: 0, winRate: null, simulations: 0, evaluated: 0 }
  // Captured now, before the tree mutates: root.untriedMoves *is*
  // rootCandidates (same array reference, not a copy), and expandNode
  // drains it via .pop() as the search progresses -- reading
  // rootCandidates.length after the simulation loop would report however
  // many candidates were left *unexpanded*, not how many there were.
  const candidateCount = rootCandidates.length

  const root = createMctsNode(flat, -1, color, rootCandidates, 0, 0)
  const openingContext =
    isOpeningMove && openingStats ? { stats: openingStats, minSample: minOpeningSample, priorWeight: openingPriorWeight } : null

  for (let i = 0; i < numSimulations; i++) {
    runMctsIteration(root, W, H, komi, explorationConstant, cap, rng, openingContext)
  }

  let best = null
  for (const entry of root.children) {
    if (!best || entry.node.visits > best.node.visits) best = entry
  }
  if (!best) return { move: null, visits: 0, winRate: null, simulations: numSimulations, evaluated: candidateCount }

  const [x, y] = idxToXY(best.moveIdx, H)
  return {
    move: [x, y],
    visits: best.node.visits,
    winRate: best.node.visits ? best.node.wins / best.node.visits : null,
    simulations: numSimulations,
    evaluated: candidateCount,
  }
}

// Builds a per-opening-move win-rate lookup table from ipvgo_status.json's
// `recentGames` array (each entry optionally carrying the [x, y] first
// move actually played that game -- see ipvgo_player.js). Games without an
// `openingMove` field (i.e. any game predating this feature) are simply
// skipped, not treated as data -- this is deliberately a fresh signal, not
// backfilled or estimated. Returns null-safe zero/empty results rather
// than throwing on an empty or malformed `recentGames`.
export function computeOpeningMoveStats(recentGames) {
  let totalGames = 0
  let totalWins = 0
  const byMove = {}
  for (const g of recentGames ?? []) {
    if (!g || !Array.isArray(g.openingMove) || g.openingMove.length !== 2) continue
    const key = g.openingMove[0] + "," + g.openingMove[1]
    totalGames++
    if (g.won) totalWins++
    if (!byMove[key]) byMove[key] = { games: 0, wins: 0 }
    byMove[key].games++
    if (g.won) byMove[key].wins++
  }
  for (const key of Object.keys(byMove)) {
    byMove[key].winRate = byMove[key].wins / byMove[key].games
  }
  return {
    overallWinRate: totalGames > 0 ? totalWins / totalGames : null,
    gamesWithOpeningData: totalGames,
    byMove,
  }
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
