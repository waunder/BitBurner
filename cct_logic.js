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

const SOLVERS = {
  "Find Largest Prime Factor": largestPrimeFactor,
  "Merge Overlapping Intervals": mergeIntervals,
  "Generate IP Addresses": generateIpAddresses,
  "Encryption I: Caesar Cipher": caesarCipher,
  "Unique Paths in a Grid I": uniquePaths,
  "Subarray with Maximum Sum": maxSubarray,
  "Total Ways to Sum": totalWaysToSum,
  "Algorithmic Stock Trader I": stockTraderI,
  "Algorithmic Stock Trader II": stockTraderII,
  "Array Jumping Game": arrayJumpingGame,
}

export function solveContract(type, data) {
  const solver = SOLVERS[type]
  if (!solver) return { supported: false, answer: null }
  return { supported: true, answer: solver(data) }
}
