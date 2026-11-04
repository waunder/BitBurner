import test from "node:test"
import assert from "node:assert/strict"
import { addSample, augOutlook, duration, KEEP_MS, money, nextStackTotal, orderedCost, ramYield, streams, windowRate } from "./money_logic.js"

const sample = (t, hacking, stack, extra = {}) => ({ t, stacks: { "omega-net": stack }, sources: { total: hacking, hacking, ...extra } })

test("money and duration stay short", () => {
  assert.equal(money(135168000000), "135b")
  assert.equal(money(-38310000000), "-38.3b")
  assert.equal(money(1500000), "1.50m")
  assert.equal(duration(30), "30s")
  assert.equal(duration(1800), "30m")
  assert.equal(duration(-1), "--")
})

test("stack total survives a restart and ignores a stale file from before an install", () => {
  const first = nextStackTotal(null, 100, 500)
  const second = nextStackTotal(first, 150, 600)
  assert.equal(second.total, 150)
  assert.equal(nextStackTotal(second, 20, 650).total, 170)
  assert.equal(nextStackTotal(null, 900, 500).total, 0)
})

test("addSample drops only what is older than the longest window", () => {
  const samples = []
  addSample(samples, sample(0, 0, 0))
  addSample(samples, sample(KEEP_MS, 0, 0))
  addSample(samples, sample(KEEP_MS + 1, 0, 0))
  assert.equal(samples.length, 2)
})

test("windowRate waits for half a window of data", () => {
  const samples = [sample(0, 0, 0), sample(20000, 100, 0)]
  assert.equal(windowRate(samples, 60000, (s) => s.sources.hacking), null)
  samples.push(sample(30000, 300, 0))
  assert.equal(windowRate(samples, 60000, (s) => s.sources.hacking), 10)
})

test("streams separates the stack from other hacking and sorts spending apart", () => {
  const { income, spending } = streams([sample(0, 100, 40, { servers: -5 }), sample(60000, 700, 340, { servers: -5, darknet: 10 })])
  assert.deepEqual(income.map((r) => [r.label, r.total, r.rates[0]]), [["other hacking", 360, 5], ["omega-net", 340, 5], ["darknet", 10, null]].map(([a, b, c]) => [a, b, c === null ? 10 / 60 : c]))
  assert.deepEqual(spending.map((r) => r.label), ["cloud+home"])
})

test("streams gives each stacked target its own row", () => {
  const rows = streams([{ t: 0, stacks: { a: 30, b: 10 }, sources: { total: 100, hacking: 100 } }]).income
  assert.deepEqual(rows.map((r) => [r.label, r.total]), [["other hacking", 60], ["a", 30], ["b", 10]])
})

test("streams labels plain hacking when no stack has run", () => {
  assert.deepEqual(streams([sample(0, 100, 0)]).income.map((r) => r.label), ["hacking"])
})

test("orderedCost prices the dearest first", () => {
  assert.equal(orderedCost([1, 10], 2), 12)
})

test("augOutlook says rep limits when cash covers what is ready", () => {
  const out = augOutlook(100, [
    { name: "A", repGap: 0, price: 10 }, { name: "B", repGap: 50, price: 20 }, { name: "B", repGap: 5, price: 20 }, { name: "C", repGap: 9, price: 30 },
  ], 10)
  assert.equal(out.limit, "rep")
  assert.equal(out.ready, 1)
  assert.equal(out.spare, 90)
  assert.equal(out.next.repGap, 5)
  assert.equal(out.all, 3)
})

test("augOutlook says cash limits and when it clears", () => {
  const out = augOutlook(5, [{ name: "A", repGap: 0, price: 25 }], 10)
  assert.equal(out.limit, "cash")
  assert.equal(out.readyWait, 2)
})

test("ramYield is income per TB", () => {
  assert.equal(ramYield(60, 2048), 30)
  assert.equal(ramYield(null, 2048), null)
  assert.equal(ramYield(60, 0), null)
})
