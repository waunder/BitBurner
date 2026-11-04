import { test } from "node:test"
import assert from "node:assert/strict"
import { applyMove, newSearch, nextMove, parseExits, resumeSearch } from "./dnet_lab_logic.js"

const DELTA = { south: [0, 1], east: [1, 0], north: [0, -1], west: [-1, 0] }

/** Carve a seeded maze the way the game does; rooms sit on odd coordinates. */
function maze(width, height, seed) {
  let value = seed
  const random = () => (value = (value * 1103515245 + 12345) % 2147483648) / 2147483648
  const grid = Array.from({ length: height }, () => Array(width).fill("#"))
  grid[1][1] = " "
  const stack = [[1, 1]]
  while (stack.length) {
    const [x, y] = stack.at(-1)
    const open = Object.values(DELTA).map(([dx, dy]) => [x + 2 * dx, y + 2 * dy, x + dx, y + dy])
      .filter(([nx, ny]) => nx > 0 && nx < width && ny > 0 && ny < height && grid[ny][nx] === "#")
    if (!open.length) { stack.pop(); continue }
    const [nx, ny, wx, wy] = open[Math.floor(random() * open.length)]
    grid[wy][wx] = " "; grid[ny][nx] = " "; stack.push([nx, ny])
  }
  return grid
}
const view = (grid, [x, y]) => [-1, 0, 1].map(dy => [-1, 0, 1].map(dx => grid[y + dy][x + dx]).join("")).join("\n")

function walk(grid, search, goal, limit) {
  let moves = 0
  while (`${search.position}` !== `${goal}`) {
    const move = nextMove(search, parseExits(view(grid, search.position)))
    if (!move) return null
    const [dx, dy] = DELTA[move.dir]
    assert.equal(grid[search.position[1] + dy][search.position[0] + dx], " ", "moved through a wall")
    search = applyMove(search, move)
    assert.ok(++moves <= limit, "search did not finish")
  }
  return { search, moves }
}

test("parses exits from a local map", () => {
  assert.deepEqual(parseExits("# #\n#@ \n###"), { north: true, west: false, east: true, south: false })
  assert.equal(parseExits("x"), null)
})
for (const [width, height] of [[21, 15], [31, 21], [41, 27], [61, 41]]) {
  test(`solves ${width}x${height} mazes within two passes of every room`, () => {
    for (let seed = 1; seed <= 25; seed++) {
      const grid = maze(width, height, seed)
      const rooms = (width - 1) / 2 * ((height - 1) / 2)
      assert.ok(walk(grid, newSearch("lab", [1, 1]), [width - 2, height - 2], 2 * rooms))
    }
  })
}
test("the trail survives backtracking as a direct route", () => {
  const grid = maze(21, 15, 7), goal = [19, 13]
  const { search } = walk(grid, newSearch("lab", [1, 1]), goal, 400)
  let position = [1, 1]
  for (const dir of search.trail) position = [position[0] + 2 * DELTA[dir][0], position[1] + 2 * DELTA[dir][1]]
  assert.deepEqual(position, goal)
})
test("resumes only from the same lab and entrance", () => {
  const saved = { ...newSearch("lab", [1, 1]), trail: ["south"], position: [1, 3], visited: ["1,1", "1,3"] }
  const same = resumeSearch(saved, "lab", [1, 1])
  assert.deepEqual(same.replay, ["south"])
  assert.deepEqual(same.search.position, [1, 1])
  assert.deepEqual(same.search.visited, saved.visited)
  assert.deepEqual(resumeSearch(saved, "other", [1, 1]).replay, [])
  assert.deepEqual(resumeSearch(saved, "lab", [3, 1]).replay, [])
  assert.deepEqual(resumeSearch(null, "lab", [1, 1]).search.trail, [])
})
