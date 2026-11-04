/**
 * Home-side collector for darknet loot reports, same relationship to
 * dnet_loot.js's shards that dnet_creds_merge.js has to credential shards
 * (see that file's own docstring for the "why shards, not one shared
 * file" reasoning -- identical here).
 *
 * Folds every immutable dnet_loot_<host>_<timestamp>.json event into totals and writes the
 * "loot" section of dnet_status.json: total karma spent (a real,
 * one-way cost, worth seeing plainly), total RAM freed, total caches
 * opened, and a per-host breakdown for anything worth investigating
 * individually.
 *
 * A shard may come from dnet_loot.js ("full") or dnet_loot_realloc.js
 * ("realloc-only"). Event filenames never collide, and no-op passes write
 * nothing, so later runs cannot erase earlier RAM or cache gains.
 *
 * Args: --prune (accepted but ignored; events are the durable ledger), --quiet.
 *
 * Reads:  dnet_loot_*.json shards, dnet_status.json (merged into, not
 *         overwritten)
 * Writes: dnet_status.json
 *
 * RAM estimate ~1.8GB: 1.6 base + ls 0.2. read/write are 0GB.
 *
 * @param {NS} ns
 */
import { aggregateLootRecords, mergeStatus } from "dnet_lib.js"

export async function main(ns) {
  const flags = ns.flags([
    ["prune", false],
    ["quiet", false],
  ])

  const host = ns.getHostname()
  const shards = ns.ls(host, "dnet_loot_").filter((f) => f.endsWith(".json"))

  const records = []

  for (const shard of shards) {
    let rec
    try {
      rec = JSON.parse(ns.read(shard))
    } catch {
      continue // a half-written shard from a killed script is expected; skip it
    }
    records.push(rec)
  }

  const { perHost, totalKarma, totalRamFreed, totalCachesOpened, totalCachesFound } =
    aggregateLootRecords(records)

  if (flags.prune) {
    ns.tprint("dnet_loot_merge: --prune ignored; immutable event shards are the cumulative ledger")
  }

  const hosts = Object.keys(perHost).sort()
  if (!flags.quiet) {
    for (const name of hosts) {
      const h = perHost[name]
      ns.tprint(`  ${name}  ram+${h.ramFreed}  caches ${h.opened}/${h.found}  karma ${h.karma}`)
    }
  }
  ns.tprint(
    `dnet_loot_merge: ${hosts.length} host(s) looted; ram+${totalRamFreed} total, ` +
      `${totalCachesOpened}/${totalCachesFound} caches opened, ${totalKarma} karma spent`
  )

  mergeStatus(ns, "loot", {
    hostsLooted: hosts.length,
    totalRamFreed,
    totalCachesOpened,
    totalCachesFound,
    totalKarmaSpent: totalKarma,
    perHost,
  })
}

export function autocomplete() {
  return ["--prune", "--quiet"]
}
