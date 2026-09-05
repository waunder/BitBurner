/** Pure coding-contract solvers. Submission is intentionally elsewhere. */

function largestPrimeFactor(n) {
  let value = Math.floor(n)
  let largest = 1
  for (let factor = 2; factor * factor <= value; factor += factor === 2 ? 1 : 2) {
    while (value % factor === 0) {
      largest = factor
      value /= factor
    }
  }
  return value > 1 ? value : largest
}

function mergeIntervals(intervals) {
  if (!intervals.length) return []
  const sorted = intervals.map((x) => [...x]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const out = [sorted[0]]
  for (const interval of sorted.slice(1)) {
    const last = out[out.length - 1]
    if (interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1])
    else out.push(interval)
  }
  return out
}

function generateIpAddresses(text) {
  const out = []
  const visit = (at, parts) => {
    if (parts.length === 4) {
      if (at === text.length) out.push(parts.join("."))
      return
    }
    for (let len = 1; len <= 3 && at + len <= text.length; len++) {
      const part = text.slice(at, at + len)
      if ((part.length > 1 && part[0] === "0") || Number(part) > 255) continue
      visit(at + len, [...parts, part])
    }
  }
  visit(0, [])
  return out
}

function caesarCipher([text, shift]) {
  return [...text].map((ch) => {
    if (ch < "A" || ch > "Z") return ch
    return String.fromCharCode((ch.charCodeAt(0) - 65 - shift + 26) % 26 + 65)
  }).join("")
}

function uniquePaths([rows, cols]) {
  let result = 1
  const choose = Math.min(rows - 1, cols - 1)
  for (let i = 1; i <= choose; i++) result = result * (rows + cols - 2 - choose + i) / i
  return Math.round(result)
}

function maxSubarray(values) {
  let best = -Infinity
  let ending = -Infinity
  for (const value of values) {
    ending = Math.max(value, ending + value)
    best = Math.max(best, ending)
  }
  return best
}

function totalWaysToSum(n) {
  const ways = Array(n + 1).fill(0)
  ways[0] = 1
  for (let part = 1; part < n; part++) {
    for (let sum = part; sum <= n; sum++) ways[sum] += ways[sum - part]
  }
  return ways[n]
}

// `Total Ways to Sum II` supplies [target, denominations].  Count
// combinations, not permutations: each denomination is introduced once and
// may then be reused any number of times.
function totalWaysToSumII([target, denominations]) {
  const ways = Array(target + 1).fill(0)
  ways[0] = 1
  for (const denomination of denominations) {
    for (let sum = denomination; sum <= target; sum++) {
      ways[sum] += ways[sum - denomination]
    }
  }
  return ways[target]
}

function stockTraderI(prices) {
  let low = Infinity
  let best = 0
  for (const price of prices) {
    low = Math.min(low, price)
    best = Math.max(best, price - low)
  }
  return best
}

function stockTraderII(prices) {
  let profit = 0
  for (let i = 1; i < prices.length; i++) profit += Math.max(0, prices[i] - prices[i - 1])
  return profit
}

function arrayJumpingGame(values) {
  let furthest = 0
  for (let i = 0; i < values.length && i <= furthest; i++) {
    furthest = Math.max(furthest, i + values[i])
    if (furthest >= values.length - 1) return 1
  }
  return 0
}

// Encode maximal runs as one decimal digit followed by the literal character.
// Bitburner's RLE format limits a count to 9, so longer runs must be split;
// characters such as "7" are data, never a count on their own.
function rleCompression(text) {
  let result = ""
  for (let index = 0; index < text.length;) {
    const character = text[index]
    let count = 1
    while (count < 9 && index + count < text.length && text[index + count] === character) count++
    result += `${count}${character}`
    index += count
  }
  return result
}

function spiralizeMatrix(matrix) {
  const out = []
  if (!matrix.length || !matrix[0].length) return out
  let top = 0
  let bottom = matrix.length - 1
  let left = 0
  let right = matrix[0].length - 1
  while (top <= bottom && left <= right) {
    for (let col = left; col <= right; col++) out.push(matrix[top][col])
    top++
    for (let row = top; row <= bottom; row++) out.push(matrix[row][right])
    right--
    if (top <= bottom) {
      for (let col = right; col >= left; col--) out.push(matrix[bottom][col])
      bottom--
    }
    if (left <= right) {
      for (let row = bottom; row >= top; row--) out.push(matrix[row][left])
      left++
    }
  }
  return out
}

function vigenereCipher([text, keyword]) {
  let keyIndex = 0
  return [...text].map((ch) => {
    if (ch < "A" || ch > "Z") return ch
    const shift = keyword.charCodeAt(keyIndex++ % keyword.length) - 65
    return String.fromCharCode((ch.charCodeAt(0) - 65 + shift) % 26 + 65)
  }).join("")
}

function totalNumberOfPrimes([start, end]) {
  const limit = Math.max(1, Math.floor(end))
  const prime = Array(limit + 1).fill(true)
  prime[0] = prime[1] = false
  for (let factor = 2; factor * factor <= limit; factor++) {
    if (!prime[factor]) continue
    for (let multiple = factor * factor; multiple <= limit; multiple += factor) prime[multiple] = false
  }
  let count = 0
  for (let value = Math.max(2, Math.ceil(start)); value <= limit; value++) if (prime[value]) count++
  return count
}

function arrayJumpingGameII(values) {
  if (values.length <= 1) return 0
  let jumps = 0
  let currentEnd = 0
  let furthest = 0
  for (let index = 0; index < values.length - 1; index++) {
    furthest = Math.max(furthest, index + values[index])
    if (index !== currentEnd) continue
    jumps++
    currentEnd = furthest
    if (currentEnd >= values.length - 1) return jumps
    if (currentEnd <= index) return 0
  }
  return 0
}

// ============================================================================
// 2026-09-05: expanded solver coverage. Before this, SOLVERS covered 16 of
// Bitburner's 30 documented contract types (NetscriptDefinitions.d.ts's
// CodingContractName enum) -- every contract of the other 14 types was
// silently held by cct_watcher.js as "unsupported" rather than solved.
// Everything below is a standard, well-established algorithm for its type;
// confidence per type is called out inline where it's anything less than
// high. See docs/processes.md's cct section for the full coverage list and
// which types are still deliberately unimplemented.
// ============================================================================

// At most 2 non-overlapping transactions -- the standard 4-state DP
// (buy1/sell1/buy2/sell2), each state tracking the best profit achievable
// having made that many buy/sell actions so far.
function stockTraderIII(prices) {
  let buy1 = -Infinity
  let sell1 = 0
  let buy2 = -Infinity
  let sell2 = 0
  for (const price of prices) {
    buy1 = Math.max(buy1, -price)
    sell1 = Math.max(sell1, buy1 + price)
    buy2 = Math.max(buy2, sell1 - price)
    sell2 = Math.max(sell2, buy2 + price)
  }
  return Math.max(0, sell2)
}

// At most k non-overlapping transactions. When k >= n/2, an unlimited
// number of transactions is never worse than k (there are at most n/2
// disjoint profitable transactions possible), so it reduces to Stock
// Trader II's greedy sum -- this also avoids an O(k*n) blowup for a large k
// with a small price list, which the DP form alone would incur.
function stockTraderIV([k, prices]) {
  const n = prices.length
  if (n === 0 || k === 0) return 0
  if (k >= Math.floor(n / 2)) {
    let profit = 0
    for (let i = 1; i < n; i++) profit += Math.max(0, prices[i] - prices[i - 1])
    return profit
  }
  const buy = Array(k + 1).fill(-Infinity)
  const sell = Array(k + 1).fill(0)
  for (const price of prices) {
    for (let t = 1; t <= k; t++) {
      buy[t] = Math.max(buy[t], sell[t - 1] - price)
      sell[t] = Math.max(sell[t], buy[t] + price)
    }
  }
  return sell[k]
}

// Bottom-up DP over the triangle's rows: dp[col] holds the minimum path sum
// from the current row to the bottom, starting from the last row (already
// itself) and folding upward, since each step may move to column col or
// col+1 in the row below.
function minimumPathSumTriangle(triangle) {
  if (!triangle.length) return 0
  let dp = [...triangle[triangle.length - 1]]
  for (let row = triangle.length - 2; row >= 0; row--) {
    const next = []
    for (let col = 0; col <= row; col++) {
      next.push(triangle[row][col] + Math.min(dp[col], dp[col + 1]))
    }
    dp = next
  }
  return dp[0]
}

// Unique Paths in a Grid I's obstacle variant: grid[r][c] === 1 marks a
// blocked cell (per NetscriptDefinitions.d.ts's `(1 | 0)[][]` signature).
// Standard 2D DP: a cell's path count is the sum of the cell above and the
// cell to its left, zero if the cell itself is blocked.
function uniquePathsGridII(grid) {
  const rows = grid.length
  if (rows === 0) return 0
  const cols = grid[0].length
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0))
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 1) continue // stays 0
      if (r === 0 && c === 0) {
        dp[r][c] = 1
        continue
      }
      const fromTop = r > 0 ? dp[r - 1][c] : 0
      const fromLeft = c > 0 ? dp[r][c - 1] : 0
      dp[r][c] = fromTop + fromLeft
    }
  }
  return dp[rows - 1][cols - 1]
}

// Same grid convention as above (1 = obstacle). Breadth-first search from
// the top-left, since BFS on an unweighted grid finds a shortest path by
// construction; returns the move string ("D"/"U"/"L"/"R") for the first
// path found to the bottom-right, or "" if the endpoints are blocked or
// unreachable.
function shortestPathInGrid(grid) {
  const rows = grid.length
  const cols = rows > 0 ? grid[0].length : 0
  if (rows === 0 || cols === 0 || grid[0][0] === 1 || grid[rows - 1][cols - 1] === 1) return ""
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false))
  visited[0][0] = true
  const queue = [[0, 0, ""]]
  const directions = [
    [1, 0, "D"],
    [-1, 0, "U"],
    [0, -1, "L"],
    [0, 1, "R"],
  ]
  let head = 0
  while (head < queue.length) {
    const [r, c, path] = queue[head++]
    if (r === rows - 1 && c === cols - 1) return path
    for (const [dr, dc, label] of directions) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
      if (visited[nr][nc] || grid[nr][nc] === 1) continue
      visited[nr][nc] = true
      queue.push([nr, nc, path + label])
    }
  }
  return ""
}

function isBalancedParens(s) {
  let depth = 0
  for (const ch of s) {
    if (ch === "(") depth++
    else if (ch === ")") {
      depth--
      if (depth < 0) return false
    }
  }
  return depth === 0
}

// Classic minimum-removal parentheses sanitization (LeetCode 301):
// breadth-first over "remove one more parenthesis character" states,
// stopping at the first depth where any valid strings appear -- that depth
// is, by construction, the minimum number of removals, and every valid
// string found there is a legitimate minimal-removal answer. Only '(' and
// ')' characters are ever removed; letters/other characters are untouched.
function sanitizeParentheses(expression) {
  if (isBalancedParens(expression)) return [expression]
  let level = [expression]
  const seen = new Set(level)
  while (level.length) {
    const found = level.filter(isBalancedParens)
    if (found.length) return [...new Set(found)]
    const next = []
    for (const s of level) {
      for (let i = 0; i < s.length; i++) {
        if (s[i] !== "(" && s[i] !== ")") continue
        const candidate = s.slice(0, i) + s.slice(i + 1)
        if (!seen.has(candidate)) {
          seen.add(candidate)
          next.push(candidate)
        }
      }
    }
    level = next
  }
  return [""] // exhausted every parenthesis -- the empty string is always balanced
}

// LeetCode 282 "Expression Add Operators," adapted with BigInt throughout
// (digit strings can exceed Number.MAX_SAFE_INTEGER) and the standard
// "undo the last term, redo it multiplied" trick to give `*` correct
// precedence over `+`/`-` without a separate expression parser. No
// multi-digit operand may have a leading zero (matches the contract's own
// stated constraint) unless the operand is a single "0".
function findAllValidMathExpressions([digits, target]) {
  const results = []
  const n = digits.length
  const targetBig = BigInt(target)

  function backtrack(index, path, value, prev) {
    if (index === n) {
      if (value === targetBig) results.push(path)
      return
    }
    for (let len = 1; index + len <= n; len++) {
      const part = digits.slice(index, index + len)
      if (part.length > 1 && part[0] === "0") break
      const numeral = BigInt(part)
      if (index === 0) {
        backtrack(len, part, numeral, numeral)
      } else {
        backtrack(index + len, path + "+" + part, value + numeral, numeral)
        backtrack(index + len, path + "-" + part, value - numeral, -numeral)
        backtrack(index + len, path + "*" + part, value - prev + prev * numeral, prev * numeral)
      }
    }
  }
  backtrack(0, "", 0n, 0n)
  return results
}

// Extended Hamming code, matching Bitburner's own convention (community-
// verified against many independently-published solvers): the encoded
// string is 1-indexed internally for the parity-bit math, with data bits
// filling every non-power-of-two position (3, 5, 6, 7, 9, ...) MSB-first,
// parity bits at every power-of-two position (1, 2, 4, 8, ...) each
// covering the positions whose (1-indexed) position number has that bit
// set, and one additional overall even-parity bit prepended at position 0
// covering the entire rest of the string -- this extra bit is what lets
// `hammingDecode` below distinguish "no error" from "a single-bit error
// inside the checked region" from "an error in the overall parity bit
// itself." `hammingEncode`/`hammingDecode` were hand-verified against each
// other this session (encode(8), flip one bit, decode recovers 8) before
// being trusted -- see cct_logic.test.js.
function hammingEncode(n) {
  const bin = n === 0 ? "0" : n.toString(2)
  const dataBits = [...bin].map(Number)
  const dataLen = dataBits.length

  let p = 0
  while (1 << p < dataLen + p + 1) p++
  const totalLen = dataLen + p

  const encoded = Array(totalLen + 1).fill(0) // index 0 = overall parity, 1..totalLen = the rest
  let dataIndex = 0
  for (let pos = 1; pos <= totalLen; pos++) {
    if ((pos & (pos - 1)) === 0) continue // power-of-two position -> parity slot, filled below
    encoded[pos] = dataBits[dataIndex++]
  }

  for (let k = 0; 1 << k <= totalLen; k++) {
    const parityPos = 1 << k
    let parity = 0
    for (let pos = 1; pos <= totalLen; pos++) {
      if (pos === parityPos) continue
      if ((pos & parityPos) !== 0) parity ^= encoded[pos]
    }
    encoded[parityPos] = parity
  }

  let overall = 0
  for (let pos = 1; pos <= totalLen; pos++) overall ^= encoded[pos]
  encoded[0] = overall

  return encoded.join("")
}

function hammingDecode(encodedStr) {
  const bits = [...encodedStr].map(Number)
  const totalLen = bits.length - 1

  let syndrome = 0
  for (let k = 0; 1 << k <= totalLen; k++) {
    const parityPos = 1 << k
    let parity = 0
    for (let pos = 1; pos <= totalLen; pos++) {
      if ((pos & parityPos) !== 0) parity ^= bits[pos]
    }
    if (parity !== 0) syndrome |= parityPos
  }

  let overall = 0
  for (let pos = 0; pos <= totalLen; pos++) overall ^= bits[pos]

  const corrected = bits.slice()
  if (syndrome !== 0) {
    // A real single-bit error inside 1..totalLen always makes the overall
    // parity odd too; overall === 0 here would mean two errors, which
    // Bitburner's own contracts never inject -- left uncorrected rather
    // than guessing, since there is no way to recover the right bit from
    // this signal alone.
    if (overall !== 0 && syndrome <= totalLen) corrected[syndrome] ^= 1
  } else if (overall !== 0) {
    corrected[0] ^= 1 // the overall parity bit itself was the one flipped
  }

  let bin = ""
  for (let pos = 1; pos <= totalLen; pos++) {
    if ((pos & (pos - 1)) !== 0) bin += corrected[pos]
  }
  bin = bin.replace(/^0+(?=\d)/, "")
  return bin === "" ? 0 : parseInt(bin, 2)
}

// Standard bipartite-coloring via BFS from every uncolored vertex (handles
// a disconnected graph, not just one connected component). Returns [] the
// moment an edge connects two same-colored vertices -- no valid
// 2-coloring exists.
function proper2Coloring([n, edges]) {
  const adjacency = Array.from({ length: n }, () => [])
  for (const [a, b] of edges) {
    adjacency[a].push(b)
    adjacency[b].push(a)
  }
  const color = Array(n).fill(-1)
  for (let start = 0; start < n; start++) {
    if (color[start] !== -1) continue
    color[start] = 0
    const queue = [start]
    let head = 0
    while (head < queue.length) {
      const node = queue[head++]
      for (const neighbor of adjacency[node]) {
        if (color[neighbor] === -1) {
          color[neighbor] = 1 - color[node]
          queue.push(neighbor)
        } else if (color[neighbor] === color[node]) {
          return []
        }
      }
    }
  }
  return color
}

// Compression II/III share this format (community-verified, and the
// inverse of each other by construction -- lzCompress's output is tested
// by round-tripping it through this exact function, see
// cct_logic.test.js): the compressed string is a sequence of chunks that
// strictly alternate type (starting with a literal), each chunk beginning
// with one ASCII length digit (1-9):
//   - a literal chunk copies the following `length` characters verbatim.
//   - a backreference chunk is followed by one more ASCII digit (1-9), the
//     distance back into the *already-decompressed* output to start
//     copying `length` characters from -- this copy can be self-referential
//     (distance < length), each copied character becoming available for
//     the next one in the same chunk, which is exactly what makes a long
//     run of one character cheap to encode (e.g. distance 1 repeats the
//     immediately preceding character `length` times).
function lzDecompress(compressed) {
  let output = ""
  let i = 0
  let literalNext = true
  while (i < compressed.length) {
    const length = Number(compressed[i])
    i++
    if (length === 0) {
      literalNext = !literalNext
      continue
    }
    if (literalNext) {
      output += compressed.slice(i, i + length)
      i += length
    } else {
      const distance = Number(compressed[i])
      i++
      const start = output.length - distance
      for (let k = 0; k < length; k++) output += output[start + k]
    }
    literalNext = !literalNext
  }
  return output
}

// Whether copying `length` characters starting `distance` back from
// position `i` reproduces s[i..i+length-1] exactly -- checked directly
// against the known target string `s`, which is equivalent to simulating a
// self-referential decoder copy (see lzDecompress's own header) since by
// the time position i+k is emitted during real decoding, it necessarily
// already equals s[i+k].
function backreferenceMatches(s, i, length, distance) {
  if (distance > i) return false
  for (let k = 0; k < length; k++) {
    if (s[i + k] !== s[i - distance + k]) return false
  }
  return true
}

// Optimal LZ compression via dynamic programming: dp[i][0]/dp[i][1] is the
// minimum compressed length for s[i:] given that the next chunk emitted
// must be a literal (0) or a backreference (1) respectively -- chunks
// strictly alternate starting with a literal, so the answer is dp[0][0].
// Deliberately never emits a zero-length chunk of either type: a
// zero-length backreference chunk can only ever appear after a literal
// chunk, and a zero-length *literal* chunk is only meaningful as a way to
// let the very first chunk be a backreference -- which is never valid,
// since a backreference needs at least one character of prior output to
// copy from and there is none at position 0. Every other position always
// has both a real literal option (length >= 1) and, once i >= 1, a real
// backreference option available, so a "pass" chunk is never the cheapest
// way to reach a shorter total encoding.
function lzCompress(s) {
  const n = s.length
  const dp = Array.from({ length: n + 1 }, () => [Infinity, Infinity])
  const choice = Array.from({ length: n + 1 }, () => [null, null])
  dp[n][0] = 0
  dp[n][1] = 0

  for (let i = n - 1; i >= 0; i--) {
    for (let length = 1; length <= 9 && i + length <= n; length++) {
      const cost = 1 + length + dp[i + length][1]
      if (cost < dp[i][0]) {
        dp[i][0] = cost
        choice[i][0] = { length }
      }
    }
    for (let length = 1; length <= 9 && i + length <= n; length++) {
      for (let distance = 1; distance <= 9 && distance <= i; distance++) {
        if (!backreferenceMatches(s, i, length, distance)) continue
        const cost = 2 + dp[i + length][0]
        if (cost < dp[i][1]) {
          dp[i][1] = cost
          choice[i][1] = { length, distance }
        }
      }
    }
  }

  let out = ""
  let i = 0
  let literalNext = true
  while (i < n) {
    const c = choice[i][literalNext ? 0 : 1]
    if (literalNext) {
      out += String(c.length) + s.slice(i, i + c.length)
    } else {
      out += String(c.length) + String(c.distance)
    }
    i += c.length
    literalNext = !literalNext
  }
  return out
}

// Integer square root via Newton's method (BigInt throughout -- this
// contract's numbers are far beyond Number's safe integer range), then
// rounded to the *nearest* integer rather than floored, per the contract's
// own stated requirement. NetscriptDefinitions.d.ts's tuple entry for this
// type is malformed compared to every other entry (a 3-element tuple where
// every other type is a clean 2-element [data, answer] pair), so the exact
// data/answer shape here is inferred from general knowledge of this
// contract type rather than a clean signature -- moderate confidence, not
// the same as the rest of this file. Worth a live dry-run check the next
// time one of these actually appears, before fully trusting the automatic
// watcher pathway with it.
function bigintSqrt(value) {
  if (value < 2n) return value
  let x = value
  let y = (x + 1n) / 2n
  while (y < x) {
    x = y
    y = (x + value / x) / 2n
  }
  return x
}

function squareRoot(n) {
  const value = typeof n === "bigint" ? n : BigInt(n)
  const floorRoot = bigintSqrt(value)
  const ceilRoot = floorRoot + 1n
  const lowDiff = value - floorRoot * floorRoot
  const highDiff = ceilRoot * ceilRoot - value
  return (highDiff < lowDiff ? ceilRoot : floorRoot).toString()
}

const SOLVERS = {
  "Find Largest Prime Factor": largestPrimeFactor,
  "Merge Overlapping Intervals": mergeIntervals,
  "Generate IP Addresses": generateIpAddresses,
  "Encryption I: Caesar Cipher": caesarCipher,
  "Unique Paths in a Grid I": uniquePaths,
  "Subarray with Maximum Sum": maxSubarray,
  "Total Ways to Sum": totalWaysToSum,
  "Total Ways to Sum II": totalWaysToSumII,
  "Algorithmic Stock Trader I": stockTraderI,
  "Algorithmic Stock Trader II": stockTraderII,
  "Array Jumping Game": arrayJumpingGame,
  "Array Jumping Game II": arrayJumpingGameII,
  "Compression I: RLE Compression": rleCompression,
  "Spiralize Matrix": spiralizeMatrix,
  "Encryption II: Vigenère Cipher": vigenereCipher,
  "Total Number of Primes": totalNumberOfPrimes,
  // Added 2026-09-05 -- see the block comment above these functions'
  // definitions for sourcing/confidence. Deliberately not included:
  // "Largest Rectangle in a Matrix" -- its output shape (two corner
  // coordinates) doesn't match this session's confident recollection of
  // the usual "largest all-same-value rectangle" problem (normally just an
  // area), and there's no live specimen available to check against. Left
  // unsupported (held by cct_watcher.js, not guessed at) rather than risk
  // a wrong answer burning a contract's limited tries.
  "Algorithmic Stock Trader III": stockTraderIII,
  "Algorithmic Stock Trader IV": stockTraderIV,
  "Minimum Path Sum in a Triangle": minimumPathSumTriangle,
  "Unique Paths in a Grid II": uniquePathsGridII,
  "Shortest Path in a Grid": shortestPathInGrid,
  "Sanitize Parentheses in Expression": sanitizeParentheses,
  "Find All Valid Math Expressions": findAllValidMathExpressions,
  "HammingCodes: Integer to Encoded Binary": hammingEncode,
  "HammingCodes: Encoded Binary to Integer": hammingDecode,
  "Proper 2-Coloring of a Graph": proper2Coloring,
  "Compression II: LZ Decompression": lzDecompress,
  "Compression III: LZ Compression": lzCompress,
  "Square Root": squareRoot,
}

export function solveContract(type, data) {
  const solver = SOLVERS[type]
  if (!solver) return { supported: false, answer: null }
  return { supported: true, answer: solver(data) }
}
