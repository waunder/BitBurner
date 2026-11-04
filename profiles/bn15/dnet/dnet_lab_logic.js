/** Pure labyrinth maze search for dnet_lab.js. No ns calls, no side effects. */
export const LAB_HOSTS = ["th3_l4byr1nth", "cru3l_l4byr1nth", "m3rc1l3ss_l4byr1nth", "ub3r_l4byr1nth", "et3rn4l_l4byr1nth",
  "end13ss_l4byr1nth", "f1n4l_l4byr1nth", "b0nus_l4byr1nth"]
export const NOT_ENOUGH_CHARISMA = 451

// One move spans two map cells: the wall gap and the next room.
const DELTA = { south: [0, 2], east: [2, 0], north: [0, -2], west: [-2, 0] }
const OPPOSITE = { south: "north", north: "south", east: "west", west: "east" }
// The exit normally sits toward the far corner, so try those directions first.
const ORDER = ["south", "east", "north", "west"]

const key = ([x, y]) => `${x},${y}`

export function newSearch(lab, start) {
  return { lab, start, position: start, visited: [key(start)], trail: [] }
}

/** Read exits from the 3x3 map an authenticate move returns. */
export function parseExits(map) {
  const rows = String(map ?? "").split("\n")
  if (rows.length < 3) return null
  return { north: rows[0][1] === " ", west: rows[1][0] === " ", east: rows[1][2] === " ", south: rows[2][1] === " " }
}

/** Depth-first choice: an unvisited room, else one step back along the trail. */
export function nextMove(search, exits) {
  const seen = new Set(search.visited)
  const [x, y] = search.position
  for (const dir of ORDER) {
    const [dx, dy] = DELTA[dir]
    if (exits[dir] && !seen.has(key([x + dx, y + dy]))) return { dir, back: false }
  }
  const last = search.trail.at(-1)
  return last ? { dir: OPPOSITE[last], back: true } : null
}

/** Record a move the game accepted. */
export function applyMove(search, { dir, back }) {
  const [dx, dy] = DELTA[dir]
  const position = [search.position[0] + dx, search.position[1] + dy]
  const trail = back ? search.trail.slice(0, -1) : [...search.trail, dir]
  const name = key(position)
  const visited = search.visited.includes(name) ? search.visited : [...search.visited, name]
  return { ...search, position, trail, visited }
}

/**
 * Resume saved work. Each process starts at the lab entrance, so a saved trail
 * is only valid from the same entrance; `replay` walks back to where it ended.
 */
export function resumeSearch(saved, lab, start) {
  if (saved?.lab !== lab || key(saved.start ?? []) !== key(start) || !Array.isArray(saved.trail)) return { search: newSearch(lab, start), replay: [] }
  return { search: { ...saved, position: start, trail: [] }, replay: saved.trail }
}
