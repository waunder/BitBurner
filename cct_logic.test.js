import { test } from "node:test"
import assert from "node:assert/strict"
import { solveContract } from "./cct_logic.js"

const solve = (type, data) => solveContract(type, data).answer

test("coding-contract solvers cover the audited types", () => {
  assert.equal(solve("Find Largest Prime Factor", 780424956), 12227)
  assert.deepEqual(solve("Merge Overlapping Intervals", [[1, 3], [8, 10], [2, 6], [10, 16]]), [[1, 6], [8, 16]])
  assert.deepEqual(solve("Generate IP Addresses", "25525511135"), ["255.255.11.135", "255.255.111.35"])
  assert.equal(solve("Encryption I: Caesar Cipher", ["ABC Z", 2]), "YZA X")
  assert.equal(solve("Unique Paths in a Grid I", [4, 14]), 560)
  assert.equal(solve("Subarray with Maximum Sum", [-2, 1, -3, 4, -1, 2, 1, -5, 4]), 6)
  assert.equal(solve("Total Ways to Sum", 4), 4)
  assert.equal(solve("Total Ways to Sum II", [10, [2, 5, 3, 6]]), 5)
  assert.equal(solve("Total Ways to Sum II", [4, [1, 2, 3]]), 4)
  assert.equal(solve("Algorithmic Stock Trader I", [7, 1, 5, 3, 6, 4]), 5)
  assert.equal(solve("Algorithmic Stock Trader II", [7, 1, 5, 3, 6, 4]), 7)
  assert.equal(solve("Array Jumping Game", [2, 3, 1, 1, 4]), 1)
  assert.equal(solve("Array Jumping Game", [3, 2, 1, 0, 4]), 0)
  assert.equal(solve("Compression I: RLE Compression", ""), "")
  assert.equal(solve("Compression I: RLE Compression", "aabccc"), "2a1b3c")
  assert.equal(solve("Compression I: RLE Compression", "aaaaaaaaaa"), "9a1a")
  assert.equal(solve("Compression I: RLE Compression", "7777777777"), "9717")
  assert.equal(solve("Compression I: RLE Compression", "a111b"), "1a311b")
  assert.deepEqual(solve("Spiralize Matrix", [[1, 2, 3], [4, 5, 6], [7, 8, 9]]), [1, 2, 3, 6, 9, 8, 7, 4, 5])
  assert.deepEqual(solve("Spiralize Matrix", [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]), [1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7])
  assert.equal(solve("Encryption II: Vigenère Cipher", ["DASHBOARD", "LINUX"]), "OIFBYZIEX")
  assert.equal(solve("Total Number of Primes", [0, 20]), 8)
  assert.equal(solve("Total Number of Primes", [2613956, 3373214]), 50952)
  assert.equal(solve("Array Jumping Game II", [2, 3, 1, 1, 4]), 2)
  assert.equal(solve("Array Jumping Game II", [3, 2, 1, 0, 4]), 0)
})

// 2026-09-05: coverage expansion (16 -> 29 of the 30 documented contract
// types -- see cct_logic.js's own block comment for the one deliberately
// unsupported type, "Largest Rectangle in a Matrix", and its reasoning).
test("Algorithmic Stock Trader III -- at most 2 transactions", () => {
  assert.equal(solve("Algorithmic Stock Trader III", [3, 3, 5, 0, 0, 3, 1, 4]), 6)
  assert.equal(solve("Algorithmic Stock Trader III", [1, 2, 3, 4, 5]), 4)
  assert.equal(solve("Algorithmic Stock Trader III", [7, 6, 4, 3, 1]), 0)
  assert.equal(solve("Algorithmic Stock Trader III", []), 0)
})

test("Algorithmic Stock Trader IV -- at most k transactions", () => {
  assert.equal(solve("Algorithmic Stock Trader IV", [2, [2, 4, 1]]), 2)
  assert.equal(solve("Algorithmic Stock Trader IV", [2, [3, 2, 6, 5, 0, 3]]), 7)
  // k >= n/2 collapses to the unlimited-transactions case (Stock Trader II).
  assert.equal(solve("Algorithmic Stock Trader IV", [100, [7, 1, 5, 3, 6, 4]]), 7)
  assert.equal(solve("Algorithmic Stock Trader IV", [0, [7, 1, 5, 3, 6, 4]]), 0)
})

test("Minimum Path Sum in a Triangle", () => {
  assert.equal(
    solve("Minimum Path Sum in a Triangle", [[2], [3, 4], [6, 5, 7], [4, 1, 8, 3]]),
    11
  )
  assert.equal(solve("Minimum Path Sum in a Triangle", [[-10]]), -10)
})

test("Unique Paths in a Grid II -- obstacles block paths", () => {
  assert.equal(
    solve("Unique Paths in a Grid II", [
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ]),
    2
  )
  assert.equal(solve("Unique Paths in a Grid II", [[0, 1], [0, 0]]), 1)
  assert.equal(solve("Unique Paths in a Grid II", [[1, 0]]), 0) // blocked start
})

test("Shortest Path in a Grid -- BFS move string, empty when unreachable", () => {
  const path = solve("Shortest Path in a Grid", [
    [0, 0, 0],
    [1, 1, 0],
    [0, 0, 0],
  ])
  assert.equal(path.length, 4) // shortest route length is fixed even if the exact route isn't unique
  // Walk the path to confirm it actually reaches the bottom-right avoiding obstacles.
  const grid = [
    [0, 0, 0],
    [1, 1, 0],
    [0, 0, 0],
  ]
  let r = 0
  let c = 0
  for (const move of path) {
    if (move === "D") r++
    else if (move === "U") r--
    else if (move === "L") c--
    else if (move === "R") c++
    assert.equal(grid[r][c], 0)
  }
  assert.deepEqual([r, c], [2, 2])
  assert.equal(
    solve("Shortest Path in a Grid", [
      [0, 1],
      [1, 0],
    ]),
    ""
  )
})

test("Sanitize Parentheses in Expression -- minimum removals, all valid results", () => {
  assert.deepEqual(new Set(solve("Sanitize Parentheses in Expression", "()())()")), new Set(["()()()", "(())()"]))
  assert.deepEqual(new Set(solve("Sanitize Parentheses in Expression", "(a)())()")), new Set(["(a)()()", "(a())()"]))
  assert.deepEqual(solve("Sanitize Parentheses in Expression", ")("), [""])
})

test("Find All Valid Math Expressions -- backtracking with correct * precedence", () => {
  assert.deepEqual(new Set(solve("Find All Valid Math Expressions", ["123", 6])), new Set(["1+2+3", "1*2*3"]))
  assert.deepEqual(new Set(solve("Find All Valid Math Expressions", ["105", 5])), new Set(["1*0+5", "10-5"]))
  assert.deepEqual(solve("Find All Valid Math Expressions", ["00", 0]), ["0+0", "0-0", "0*0"])
})

test("HammingCodes: encode/decode round-trip, including single-bit-error correction", () => {
  // Hand-derived and verified this session (see cct_logic.js's own header
  // comment): encoding 8 ("1000") needs 3 parity bits (dataLen=4, smallest
  // p with 2^p >= dataLen+p+1 is 3), giving positions 1-7 plus an overall
  // parity bit at position 0.
  const encoded = solve("HammingCodes: Integer to Encoded Binary", 8)
  assert.equal(encoded, "11110000")
  assert.equal(solve("HammingCodes: Encoded Binary to Integer", encoded), 8)

  // Flipping any single bit must still decode back to the original value.
  for (let i = 0; i < encoded.length; i++) {
    const flipped = encoded.slice(0, i) + (encoded[i] === "0" ? "1" : "0") + encoded.slice(i + 1)
    assert.equal(solve("HammingCodes: Encoded Binary to Integer", flipped), 8, `flipping bit ${i} should still decode to 8`)
  }

  // Round-trip a handful of other values with no injected error.
  for (const n of [0, 1, 2, 255, 1234567]) {
    const enc = solve("HammingCodes: Integer to Encoded Binary", n)
    assert.equal(solve("HammingCodes: Encoded Binary to Integer", enc), n)
  }
})

test("Proper 2-Coloring of a Graph -- bipartite coloring, [] when impossible", () => {
  const coloring = solve("Proper 2-Coloring of a Graph", [
    4,
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
    ],
  ])
  for (const [a, b] of [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
  ]) {
    assert.notEqual(coloring[a], coloring[b])
  }
  // A triangle (odd cycle) is never 2-colorable.
  assert.deepEqual(
    solve("Proper 2-Coloring of a Graph", [
      3,
      [
        [0, 1],
        [1, 2],
        [2, 0],
      ],
    ]),
    []
  )
})

test("Compression II: LZ Decompression -- literal and self-referential backreference chunks", () => {
  assert.equal(solve("Compression II: LZ Decompression", "3abc"), "abc")
  assert.equal(solve("Compression II: LZ Decompression", "1a41"), "aaaaa") // "a" then 4 more copied 1-back
  assert.equal(solve("Compression II: LZ Decompression", ""), "")
})

test("Compression III: LZ Compression -- round-trips through the decompressor for every case", () => {
  const cases = ["", "a", "abc", "aaaaaaaaaa", "abcabcabcabcabc", "mississippi", "aabcaabcaabcaabaab", "the quick brown fox"]
  for (const original of cases) {
    const compressed = solve("Compression III: LZ Compression", original)
    assert.equal(solve("Compression II: LZ Decompression", compressed), original, `round-trip failed for ${JSON.stringify(original)}`)
  }
  // A long repeated run should compress far below its own length (sanity
  // check against a degenerate "just emit everything as literals" bug).
  const longRun = "a".repeat(50)
  assert.ok(solve("Compression III: LZ Compression", longRun).length < longRun.length)
})

test("Square Root -- BigInt nearest-integer rounding", () => {
  assert.equal(solve("Square Root", 16n), "4")
  assert.equal(solve("Square Root", 2n), "1") // sqrt(2)=1.41... rounds down
  assert.equal(solve("Square Root", 3n), "2") // sqrt(3)=1.73... rounds up
  assert.equal(solve("Square Root", 10n ** 30n), (10n ** 15n).toString())
})
