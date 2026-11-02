import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_SHARE_HOME_GB, shareCloudHosts, targetShareThreads } from "./share_deploy.js"

describe("shareCloudHosts", () => {
  const hosts = Array.from({ length: 6 }, (_, i) => ({ host: `c${i}`, max: 100 }))

  test("never takes the servers kept clear for MCP or the stacks", () => {
    assert.deepEqual(shareCloudHosts(hosts, 2, 50), ["c4", "c5"])
    assert.deepEqual(shareCloudHosts(hosts, 9, 50), ["c4", "c5"])
  })

  test("no servers asked for, none taken", () => {
    assert.deepEqual(shareCloudHosts(hosts, 0), [])
  })
})

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
