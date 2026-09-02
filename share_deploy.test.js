import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_SHARE_HOME_GB, targetShareThreads } from "./share_deploy.js"

describe("targetShareThreads — balanced home sharing", () => {
  test("the default target is approximately 256GB and fits whole threads only", () => {
    assert.equal(DEFAULT_SHARE_HOME_GB, 256)
    assert.equal(targetShareThreads(DEFAULT_SHARE_HOME_GB, 2.4), 106)
    assert.ok(targetShareThreads(DEFAULT_SHARE_HOME_GB, 2.4) * 2.4 <= DEFAULT_SHARE_HOME_GB)
  })

  test("uses every whole thread at exact and partial boundaries", () => {
    assert.equal(targetShareThreads(240, 2.4), 100)
    assert.equal(targetShareThreads(7.19, 2.4), 2)
    assert.equal(targetShareThreads(7.2, 2.4), 3)
  })

  test("honors an explicit whole-thread cap", () => {
    assert.equal(targetShareThreads(256, 2.4, 40), 40)
    assert.equal(targetShareThreads(256, 2.4, 0), 0)
    assert.equal(targetShareThreads(256, 2.4, 40.9), 40)
  })

  test("a stopped or unusable target requests no resident share threads", () => {
    assert.equal(targetShareThreads(0, 2.4), 0)
    assert.equal(targetShareThreads(-1, 2.4), 0)
    assert.equal(targetShareThreads(256, 0), 0)
  })
})
