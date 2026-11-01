import { test } from "node:test"
import assert from "node:assert/strict"
import { chooseCapitalAction, nextScriptToStart } from "./capital_logic.js"

const base = { spendable: 0, hasTor: true, homeRam: 512, homeRamTarget: 512, homeRamCost: 1, cloud: [], cloudLimit: 25 }

test("saves for TOR before anything else", () => {
  assert.equal(chooseCapitalAction({ ...base, hasTor: false, spendable: 100 }).kind, "save")
  assert.equal(chooseCapitalAction({ ...base, hasTor: false, spendable: 200e3 }).kind, "tor")
})
test("buys the first affordable missing program", () => {
  const programs = [{ name: "a", owned: true, cost: 0 }, { name: "b", owned: false, cost: 50 }, { name: "c", owned: false, cost: 10 }]
  assert.deepEqual(chooseCapitalAction({ ...base, programs, spendable: 50 }), { kind: "program", name: "b", cost: 50 })
  assert.equal(chooseCapitalAction({ ...base, programs, spendable: 49 }).name, "c")
})
test("home RAM precedes cloud RAM until its target", () => {
  const input = { ...base, homeRam: 32, homeRamCost: 100, cloudQuotes: [{ ram: 8, cost: 1 }] }
  assert.equal(chooseCapitalAction({ ...input, spendable: 100 }).kind, "home")
  assert.equal(chooseCapitalAction({ ...input, spendable: 99 }).kind, "cloud")
})
test("cloud buys the largest size within the budget fraction", () => {
  const cloudQuotes = [{ ram: 8, cost: 10 }, { ram: 16, cost: 20 }, { ram: 32, cost: 40 }]
  assert.deepEqual(chooseCapitalAction({ ...base, cloudQuotes, spendable: 50 }), { kind: "cloud", ram: 16, cost: 20 })
  assert.equal(chooseCapitalAction({ ...base, cloudQuotes, spendable: 10 }), null)
})
test("full slots upgrade the smallest affordable server", () => {
  const upgradeQuotes = [{ host: "big", fromRam: 64, toRam: 128, cost: 5 }, { host: "small", fromRam: 8, toRam: 16, cost: 9 }]
  const action = chooseCapitalAction({ ...base, cloud: ["big", "small"], cloudLimit: 2, upgradeQuotes, spendable: 100 })
  assert.equal(action.host, "small")
  assert.equal(chooseCapitalAction({ ...base, cloud: ["big", "small"], cloudLimit: 2, upgradeQuotes, spendable: 1 }), null)
})
test("starts the first waiting script that fits", () => {
  const scripts = [{ name: "done", running: true, ram: 1 }, { name: "large", running: false, ram: 30 }, { name: "small", running: false, ram: 3 }]
  assert.equal(nextScriptToStart(scripts, 5), "small")
  assert.equal(nextScriptToStart(scripts, 2), null)
})
