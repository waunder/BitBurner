import test from "node:test"
import assert from "node:assert/strict"
import { chooseProgressionGuidance } from "./progression_guidance_logic.js"

test("a discovered hacking gate remains the default player priority", () => {
  const result = chooseProgressionGuidance({ hacking: 397, charisma: 312, gate: { host: "catalyst", required: 401 }, gateScanOk: true, darknetLive: true })
  assert.equal(result.focus, "Hacking")
  assert.equal(result.best, "Rothman Algorithms until H401")
  assert.match(result.gate, /\+4 H/)
  assert.equal(result.confidence, "HIGH")
})

test("a live Darknet is passive Charisma evidence, not a reason to interrupt player work", () => {
  const result = chooseProgressionGuidance({ hacking: 500, charisma: 312, gateScanOk: true, darknetLive: true })
  assert.equal(result.focus, "No manual XP detour")
  assert.match(result.best, /DNET grows Charisma/)
  assert.equal(result.confidence, "MEDIUM")
})

test("does not invent a physical, crime, or faction goal", () => {
  const result = chooseProgressionGuidance({ hacking: 500, gateScanOk: true, darknetLive: false })
  assert.equal(result.focus, "Choose a named goal")
  assert.match(result.best, /No evidence for gym, crime, or faction work/)
})

test("a failed gate scan produces no directional training claim", () => {
  const result = chooseProgressionGuidance({ hacking: 500, gateScanOk: false, darknetLive: true })
  assert.equal(result.focus, "Hold current work")
  assert.equal(result.confidence, "LOW")
})
