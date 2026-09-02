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
}

export function solveContract(type, data) {
  const solver = SOLVERS[type]
  if (!solver) return { supported: false, answer: null }
  return { supported: true, answer: solver(data) }
}
