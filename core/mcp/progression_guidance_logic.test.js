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

test("a concrete live augmentation reputation gap directs faction work when hacking is clear", () => {
  const result = chooseProgressionGuidance({ hacking: 500, gateScanOk: true, augmentation: { queued: 0, candidate: { name: "BitWire", faction: "CyberSec", repGap: 250, cashReady: true } } })
  assert.equal(result.focus, "Faction reputation")
  assert.match(result.best, /CyberSec/)
  assert.match(result.gate, /\+250 rep/)
})

test("a queued augmentation batch becomes visible when no Hack gate remains", () => {
  const result = chooseProgressionGuidance({ hacking: 500, gateScanOk: true, augmentation: { queued: 3 } })
  assert.equal(result.focus, "Augmentation batch ready")
  assert.match(result.best, /3 augmentations queued/)
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
