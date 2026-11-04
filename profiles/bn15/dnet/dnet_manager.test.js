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

  test("uses all RAM at an exact thread boundary", () => {
    assert.equal(threadsForFreeRam(3.6, 3.6), 1)
    assert.equal(threadsForFreeRam(7.2, 3.6), 2)
    assert.equal(threadsForFreeRam(36, 3.6), 10)
  })

  test("never rounds a nearly-complete thread up", () => {
    assert.equal(threadsForFreeRam(3.599999, 3.6), 0)
    assert.equal(threadsForFreeRam(7.199999, 3.6), 1)
  })

  test("zero free RAM launches nothing", () => {
    assert.equal(threadsForFreeRam(0, 3.6), 0)
  })
})
