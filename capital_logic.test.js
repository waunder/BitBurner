import { test } from "node:test"
import assert from "node:assert/strict"
import { chooseCapitalAction, nextScriptToStart } from "./capital_logic.js"

const base = { spendable: 0, hasTor: true, homeRam: 512, homeRamTarget: 512, homeRamCost: 1, cloud: [], cloudLimit: 25 }

test("saves for TOR before anything else", () => {
  assert.equal(chooseCapitalAction({ ...base, hasTor: false, spendable: 100 }).kind, "save")
  assert.equal(chooseCapitalAction({ ...base, hasTor: false, spendable: 200e3 }).kind, "tor")
})
test("buys programs strictly in order", () => {
  const programs = [{ name: "a", owned: true, cost: 0 }, { name: "b", owned: false, cost: 50 }, { name: "c", owned: false, cost: 10 }]
  assert.deepEqual(chooseCapitalAction({ ...base, programs, spendable: 50 }), { kind: "program", name: "b", cost: 50 })
  assert.equal(chooseCapitalAction({ ...base, programs, spendable: 49 }), null)
})
test("nothing outranks the home RAM floor", () => {
  const input = { ...base, homeRam: 64, homeRamCost: 1000, cloudQuotes: [{ ram: 8, cost: 1 }], spendable: 100 }
  assert.equal(chooseCapitalAction(input).reason, "home RAM floor")
  assert.equal(chooseCapitalAction({ ...input, homeRam: 128 }).kind, "cloud")
})
test("home RAM precedes cloud RAM until its target", () => {
  const input = { ...base, homeRam: 256, homeRamCost: 100, cloudQuotes: [{ ram: 8, cost: 1 }] }
  assert.equal(chooseCapitalAction({ ...input, spendable: 100 }).kind, "home")
  assert.equal(chooseCapitalAction({ ...input, spendable: 99 }).kind, "cloud")
})
test("holds cloud buying when the next priority is within reach", () => {
  const input = { ...base, homeRam: 256, homeRamCost: 1000, cloudQuotes: [{ ram: 8, cost: 1 }], spendable: 100 }
  assert.equal(chooseCapitalAction({ ...input, incomePerSec: 10 }).kind, "save")
  assert.equal(chooseCapitalAction({ ...input, incomePerSec: 1 }).kind, "cloud")
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

test("BN10 cloud shape: 15 slots, half max RAM and 5x prices still fill, then upgrade the smallest", () => {
  // Game: price = ram x 55000 x 5 x 1.1^(log2(ram) - 6 if above 64), limit round(25 x 0.6), max RAM 524288.
  const cost = ram => ram * 55000 * 5 * Math.pow(1.1, Math.max(0, Math.log2(ram) - 6))
  const quotes = []
  for (let ram = 8; ram <= 524288; ram *= 2) quotes.push({ ram, cost: cost(ram) })
  const early = chooseCapitalAction({ ...base, homeRam: 512, cloudLimit: 15, cloudQuotes: quotes, spendable: 5e6 })
  assert.deepEqual(early, { kind: "cloud", ram: 8, cost: 8 * 275000 })
  const full = Array.from({ length: 15 }, (_, i) => `w${i}`)
  const upgradeQuotes = [{ host: "w0", fromRam: 8, toRam: 16, cost: cost(16) - cost(8) }, { host: "w1", fromRam: 64, toRam: 128, cost: cost(128) - cost(64) }]
  assert.equal(chooseCapitalAction({ ...base, homeRam: 512, cloud: full, cloudLimit: 15, cloudQuotes: quotes, upgradeQuotes, spendable: 1e9 }).host, "w0")
  assert.equal(chooseCapitalAction({ ...base, homeRam: 512, cloud: full, cloudLimit: 15, cloudQuotes: quotes, upgradeQuotes: [], spendable: 1e9 }), null)
})

test("cloud buying stops while MCP leaves RAM idle", () => {
  const input = { spendable: 1e9, hasTor: true, homeRam: 512, homeRamTarget: 512, cloud: ["a"], cloudLimit: 1, upgradeQuotes: [{ host: "a", fromRam: 8, toRam: 16, cost: 1e3 }] }
  assert.equal(chooseCapitalAction({ ...input, ramUtilization: 0.04 }), null)
  assert.equal(chooseCapitalAction({ ...input, ramUtilization: 0.8 }).kind, "upgrade")
  assert.equal(chooseCapitalAction({ ...input, ramUtilization: 0.04, cloudDemandFloor: 0 }).kind, "upgrade")
})
