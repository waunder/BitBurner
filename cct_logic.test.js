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
})
