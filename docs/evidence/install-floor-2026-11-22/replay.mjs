// Replay of BN12 run 1 through the settling rule. From the repo root, after `python tools/stage.py bn12`:
//   node docs/evidence/install-floor-2026-11-22/replay.mjs build/bn12 runtime/metrics_log.txt
// The log holds neither the candidates nor the gates, so: gang rep needed is run 1's 1.785m, pending favor
// comes from rep by the game's formula, the pill counts as planned once donations are open and Daedalus is
// joined (cash was 5000x the donation), and rows in a cycle's first 3 minutes (stale readiness) are dropped.
// Where the floor has not lapsed the logged verdict stands. Where it has, the batch alone decides: other
// candidates are not in the log, but none beat the (lower) average when the same cycles installed at 4h.
import { readFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const [staged, log] = process.argv.slice(2)
const name = "install_advisor_logic.js"
const { readdirSync } = await import("node:fs")
const file = readdirSync(staged, { recursive: true }).find((f) => path.basename(String(f)) === name)
const { batchMark, favorGate, floorState, installAdvice } = await import(pathToFileURL(path.resolve(staged, String(file))).href)

const START = 1795284499475, END = 1795364708703, HOUR = 3.6e6, NEEDED = 1.785e6, THRESHOLD = 153, CONFIRM = 300000
const rows = readFileSync(log, "utf8").split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l))
  .filter((r) => r.resetAt >= START && r.resetAt < END)
const starts = [...new Set(rows.map((r) => r.resetAt))].sort((a, b) => a - b)
let saved = 0
for (const [i, reset] of starts.entries()) {
  const all = rows.filter((r) => r.resetAt === reset)
  let mark = null, previous = null, ready = null, changed = false, reason = ""
  for (const r of all) {
    const age = (r.ts - reset) / HOUR
    if (age < 0.05) continue
    const joined = r.factionRep?.Daedalus !== undefined
    const rep = r.factionRep?.Daedalus ?? 0, favor = r.favor?.Daedalus ?? 0
    const total = rep + 25000 * (1.02 ** favor - 1)
    const gain = Math.log(total / 25000 + 1) / Math.log(1.02) - favor
    const rate = previous?.factionRep?.Daedalus !== undefined ? (rep - previous.factionRep.Daedalus) / ((r.ts - previous.ts) / HOUR) : null
    previous = r
    const endgame = r.installedCount >= 86
    let verdict = r.verdict
    if (r.gang?.faction) {
      const batchValue = r.batchValue ?? 0
      mark = batchMark({ batchValue, now: r.ts, reset, previous: mark })
      const gate = favorGate({ faction: "Daedalus", joined, eligible: r.installedCount >= 31, favor, gain, threshold: THRESHOLD, rate,
        held: endgame ? ["The Red Pill"] : [], planned: joined && favor >= THRESHOLD ? ["The Red Pill"] : [] })
      const floor = floorState({ cycleHours: age, mark, now: r.ts, gangRep: r.factionRep?.[r.gang.faction], gangRepNeeded: NEEDED, gate, endgame })
      if (floor.lapsed || (gate?.kind === "favor" && gate.hours !== null)) {
        const next = installAdvice({ batch: [{ name: "batch", value: batchValue }], candidates: [], cycleHours: age,
          repPerHour: 1, gang: { rate: null, candidates: [] }, money: r.money, floor, gate }).verdict
        if (next !== verdict) changed = true
        verdict = next
      }
      reason = floor.reason
    }
    if (verdict !== "install") ready = null
    else if (age >= 1 && !ready) ready = { ts: r.ts, age, value: r.batchValue, reason, rep, favor: favor + gain }
    if (ready && changed) break
  }
  const real = i + 1 < starts.length ? (starts[i + 1] - reset) / HOUR : null
  const last = all.filter((r) => (r.ts - reset) / HOUR >= 0.05).at(-1)
  if (!changed || !ready) {
    console.log(`cycle ${i + 1}: unchanged (${real ? real.toFixed(2) + "h" : "endgame, no install"})`)
    continue
  }
  const next = ready.age + CONFIRM / HOUR
  saved += real - next
  console.log(`cycle ${i + 1}: ${real.toFixed(2)}h -> ${next.toFixed(2)}h (${(real - next).toFixed(2)}h saved); ` +
    `batch ${ready.value.toFixed(3)} against ${last.batchValue.toFixed(3)} at the real install (${(100 * ready.value / last.batchValue).toFixed(1)}%); ` +
    `Daedalus favor ${ready.favor.toFixed(1)}; ${ready.reason}`)
}
console.log(`saved ${saved.toFixed(2)}h of 20.61h to The Red Pill installed (${(100 * saved / 20.61).toFixed(0)}%)`)
