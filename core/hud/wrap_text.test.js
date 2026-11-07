import test from "node:test"
import assert from "node:assert/strict"
import { wrapText } from "./wrap_text.js"

test("short lines are unchanged", () => {
  assert.deepEqual(wrapText("  Warfare: off", 20), ["  Warfare: off"])
})

test("long lines break at spaces, keep their indent and indent continuations", () => {
  const lines = wrapText("  Capital policy objective: Accumulate cash toward optional QLink", 24)
  assert.deepEqual(lines, ["  Capital policy", "    objective:", "    Accumulate cash", "    toward optional", "    QLink"])
  for (const line of lines) assert.ok(line.length <= 24)
})

test("a word longer than the width is cut", () => {
  const lines = wrapText("x " + "a".repeat(25), 10)
  for (const line of lines) assert.ok(line.length <= 10)
  assert.equal(lines.join("").replace(/ /g, ""), "x" + "a".repeat(25))
})
