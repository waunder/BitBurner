import test from "node:test"
import assert from "node:assert/strict"
import { main } from "./augmentation_readiness.js"

// Two or more --once passes against a fake game, as the steward runs them: the settling mark must
// survive through the status file.
async function passes({ settles, joined = true, gain = 160, at = [1.1, 1.4] }) {
  const reset = Date.now() - 1e8
  const files = {
    "player_activity_config.json": JSON.stringify({ gangCycleSettles: settles, favorTarget: "Daedalus", countFillersTo: 31, planByValue: true }),
    "run_target.json": "{}",
    "gang_status.json": "{}",
  }
  const installed = Array.from({ length: 40 }, (_, i) => `Aug ${i}`)
  let step = 0
  const ns = {
    args: ["--once"], disableLog() {},
    read: (file) => files[file] ?? "", write: (file, text) => { files[file] = text },
    getResetInfo: () => ({ lastAugReset: reset }), getFavorToDonate: () => 156,
    getPlayer: () => ({ money: 1e15, mults: { faction_rep: 1 }, exp: { hacking: 1e9 + step }, skills: { hacking: 3000 },
      factions: joined ? ["Slum Snakes", "Daedalus"] : ["Slum Snakes"] }),
    gang: { inGang: () => true, getGangInformation: () => ({ faction: "Slum Snakes" }) },
    singularity: {
      getOwnedAugmentations: () => installed,
      getFactionRep: (faction) => (faction === "Slum Snakes" ? 2e6 : 5e5) + step * 1000,
      getAugmentationsFromFaction: (faction) => (faction === "Slum Snakes" ? ["Good"] : []),
      getAugmentationRepReq: () => 1.8e6, getAugmentationPrereq: () => [], getAugmentationPrice: () => 1e9,
      getAugmentationStats: () => ({ hacking: 2 }),
      getFactionFavor: () => 0, getFactionFavorGain: (faction) => (faction === "Daedalus" ? gain : 1),
    },
  }
  const realNow = Date.now
  const out = []
  try {
    for (const hours of at) {
      Date.now = () => reset + hours * 3_600_000
      step++
      await main(ns)
      out.push(JSON.parse(files["augmentation_readiness.json"]).advice)
    }
  } finally {
    Date.now = realNow
  }
  return out
}

test("settled, gang covered, favor banked: installs before 4h on the pass after it settles", async () => {
  const [first, second] = await passes({ settles: true })
  assert.equal(first.verdict, "wait")
  assert.match(first.reason, /still growing/)
  assert.equal(second.verdict, "install")
})

test("without gangCycleSettles the plain 4h minimum stands", async () => {
  const [, second] = await passes({ settles: false })
  assert.equal(second.verdict, "wait")
  assert.match(second.reason, /minimum/)
  assert.equal(second.settling, undefined)
})

test("favor not banked waits", async () => {
  const [, second] = await passes({ settles: true, gain: 100 })
  assert.equal(second.verdict, "wait")
  assert.match(second.reason, /favor 100 of 156/)
})

test("eligible for Daedalus but not yet joined waits", async () => {
  const [, second] = await passes({ settles: true, joined: false })
  assert.equal(second.verdict, "wait")
  assert.match(second.reason, /join Daedalus/)
})

test("pill alone, through donation and plan: install, and not yet counted as owned", async () => {
  const reset = Date.now() - 1.5 * 3_600_000
  const files = {
    "player_activity_config.json": JSON.stringify({ gangCycleSettles: true, installRedPillAlone: true, favorTarget: "Daedalus", countFillersTo: 31, planByValue: true }),
    "run_target.json": "{}", "gang_status.json": "{}",
  }
  const ns = {
    args: ["--once"], disableLog() {},
    read: (file) => files[file] ?? "", write: (file, text) => { files[file] = text },
    getResetInfo: () => ({ lastAugReset: reset }), getFavorToDonate: () => 156,
    getPlayer: () => ({ money: 1e15, mults: { faction_rep: 1 }, exp: { hacking: 1e9 }, skills: { hacking: 3000 }, factions: ["Slum Snakes", "Daedalus"] }),
    gang: { inGang: () => true, getGangInformation: () => ({ faction: "Slum Snakes" }) },
    singularity: {
      getOwnedAugmentations: () => ["NeuroFlux Governor"],
      getFactionRep: (faction) => (faction === "Daedalus" ? 1000 : 2e6),
      getAugmentationsFromFaction: (faction) => (faction === "Daedalus" ? ["The Red Pill"] : []),
      getAugmentationRepReq: () => 2.6e6, getAugmentationPrereq: () => [], getAugmentationPrice: () => 0,
      getAugmentationStats: () => ({}),
      getFactionFavor: (faction) => (faction === "Daedalus" ? 160 : 0), getFactionFavorGain: () => 0,
    },
  }
  await main(ns)
  const status = JSON.parse(files["augmentation_readiness.json"])
  assert.deepEqual(status.installPlan.names, ["The Red Pill"])
  assert.equal(status.installPlan.donations[0][0], "Daedalus")
  assert.equal(status.advice.verdict, "install")
  assert.ok(!status.owned.includes("The Red Pill")) // auto install holds once it is
})
