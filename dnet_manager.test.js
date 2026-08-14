import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { threadsForFreeRam } from "./dnet_manager.js"

describe("threadsForFreeRam — resident Dark Net farm sizing", () => {
  test("fills only complete threads", () => {
    assert.equal(threadsForFreeRam(10.85, 3.6), 3)
    assert.equal(threadsForFreeRam(7.19, 3.6), 1)
  })

  test("invalid or insufficient RAM launches nothing", () => {
    assert.equal(threadsForFreeRam(3.59, 3.6), 0)
    assert.equal(threadsForFreeRam(10, 0), 0)
    assert.equal(threadsForFreeRam(-1, 3.6), 0)
  })
})
