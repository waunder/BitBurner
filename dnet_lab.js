/**
 * Solves a labyrinth from a directly connected darknet server. One long process
 * walks the maze, because the game tracks position per PID. Its progress is
 * saved locally and shipped home; on success it opens the reward cache.
 *
 * Start: dnet_root.js keeps one on the stasis-linked host, and dnet_crawl.js launches
 * one when a lab is a neighbour. Links come and go, so it waits for the lab each time.
 * @param {NS} ns
 */
import { LAB_HOSTS, NOT_ENOUGH_CHARISMA, applyMove, newSearch, nextMove, parseExits, resumeSearch } from "dnet_lab_logic.js"

const STATE = "dnet_lab_search.json"
const STATUS = "dnet_lab_status.json"
const LOOT = "dnet_loot.js"
const SAVE_EVERY = 5
const RETRY_MS = 1000
const MAX_FAILS = 20
const WAIT_MS = 2000

export async function main(ns) {
  ns.disableLog("ALL")
  let lab = ns.args[0] === undefined ? null : String(ns.args[0])
  const report = (state, extra = {}) => {
    ns.write(STATUS, JSON.stringify({ ts: Date.now(), lab, host: ns.getHostname(), state, ...extra }), "w")
    ns.scp(STATUS, "home")
  }
  // With no argument, the first lab to link up names the walk.
  const connected = () => {
    const near = ns.dnet.probe()
    lab ??= LAB_HOSTS.find(name => near.includes(name)) ?? null
    return near.includes(lab)
  }
  const waitForLab = async () => {
    report("waiting")
    while (!connected()) await ns.sleep(WAIT_MS)
  }
  await waitForLab()
  const required = ns.dnet.getServerRequiredCharismaLevel(lab), charisma = ns.getPlayer().skills.charisma
  if (charisma < required) return report("charisma", { required, charisma })
  const first = await ns.dnet.labreport()
  if (!first?.success) return report("no-lab", { message: first?.message })

  let saved = null
  try { saved = JSON.parse(ns.read(STATE) || "null") } catch { /* partial write: start over */ }
  const resumed = resumeSearch(saved, lab, first.coords)
  let search = resumed.search, exits = first, moves = 0, fails = 0
  const replay = [...resumed.replay]
  report("walking", { position: search.position, replay: replay.length, rooms: search.visited.length })

  while (true) {
    const move = replay.length ? { dir: replay[0], back: false } : nextMove(search, exits)
    if (!move) return report("stuck", { position: search.position, rooms: search.visited.length })
    const result = await ns.dnet.authenticate(lab, `go ${move.dir}`)
    if (result.code === NOT_ENOUGH_CHARISMA) return report("charisma", { message: result.message })
    if (result.success) {
      ns.write(STATE, "", "w")
      ns.scp(STATE, "home")
      ns.dnet.connectToSession(lab, result.data)
      const looted = ns.scp([LOOT, "dnet_lib.js"], lab) && ns.exec(LOOT, lab, 1)
      return report("solved", { moves, password: result.data, lootPid: looted || 0 })
    }
    const next = parseExits(result.data)
    // The game keeps this pid's position, so a lost link costs time and nothing else.
    if (!connected()) { await waitForLab(); continue }
    if (!String(result.message).startsWith("You have moved") || !next) {
      if (++fails >= MAX_FAILS) return report("failing", { code: result.code, message: result.message, position: search.position })
      await ns.sleep(RETRY_MS)
      continue
    }
    fails = 0
    if (replay.length) replay.shift()
    search = applyMove(search, move)
    exits = next
    if (++moves % SAVE_EVERY === 0) {
      ns.write(STATE, JSON.stringify(search), "w")
      ns.scp(STATE, "home")
      report("walking", { position: search.position, moves, rooms: search.visited.length })
    }
  }
}
