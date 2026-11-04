/**
 * Live RAM on weaken, grow and hack, split into cloud and hacked servers.
 * Measured from running processes, so it includes xp_filler.js workers, which
 * mcp_status.json leaves out. Shared by hud_consolidated.js and get_target_stats.js.
 */
const ACTIONS = { "scripts/weaken.js": "weaken", "scripts/xp_weaken.js": "weaken", "scripts/grow.js": "grow", "scripts/hack.js": "hack" }
const STACK_ACTION = p => p.filename.replace(/^\//, "") === "scripts/stack_job.js" ? String(p.args[0]) : null

/** @param hosts [{cloud, max, jobs: [{filename, ram}]}] */
export function summarizeRam(hosts) {
  const empty = () => ({ hosts: 0, max: 0, weaken: 0, grow: 0, hack: 0 })
  const summary = { cloud: empty(), hacked: empty() }
  for (const host of hosts) {
    const group = host.cloud ? summary.cloud : summary.hacked
    group.hosts++
    group.max += host.max
    for (const job of host.jobs) {
      const action = job.action ?? ACTIONS[job.filename.replace(/^\//, "")]
      if (action) group[action] += job.ram
    }
  }
  return summary
}

function ramText(gb) {
  return gb >= 1024 ? `${(gb / 1024).toFixed(1)}TB` : `${gb.toFixed(gb >= 100 ? 0 : 1)}GB`
}

export function formatRamGroup(name, group) {
  const idle = Math.max(0, group.max - group.weaken - group.grow - group.hack)
  return `${name} ${ramText(group.max)} (${group.hosts}): W ${ramText(group.weaken)} G ${ramText(group.grow)} H ${ramText(group.hack)} idle ${ramText(idle)}`
}

/** @param {NS} ns */
export function readFleetRam(ns) {
  const cloud = new Set(ns.cloud.getServerNames())
  const seen = new Set(["home"])
  for (const host of seen) for (const next of ns.scan(host)) seen.add(next)
  for (const host of cloud) seen.add(host)
  const hosts = [...seen].filter(host => host !== "home" && ns.hasRootAccess(host) && ns.getServerMaxRam(host) > 0).map(host => ({
    cloud: cloud.has(host),
    max: ns.getServerMaxRam(host),
    jobs: ns.ps(host).map(p => ({ filename: p.filename, action: STACK_ACTION(p), ram: p.threads * ns.getScriptRam(p.filename, host) })),
  }))
  return summarizeRam(hosts)
}
