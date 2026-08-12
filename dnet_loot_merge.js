/**
 * Home-side collector for darknet loot reports, same relationship to
 * dnet_loot.js's shards that dnet_creds_merge.js has to credential shards
 * (see that file's own docstring for the "why shards, not one shared
 * file" reasoning -- identical here).
 *
 * Folds every dnet_loot_<host>.json shard into totals and writes the
 * "loot" section of dnet_status.json: total karma spent (a real,
 * one-way cost, worth seeing plainly), total RAM freed, total caches
 * opened, and a per-host breakdown for anything worth investigating
 * individually.
 *
 * Args: --prune (delete shards after a successful merge), --quiet.
 *
 * Reads:  dnet_loot_*.json shards, dnet_status.json (merged into, not
 *         overwritten)
 * Writes: dnet_status.json
 *
 * RAM estimate ~2.0GB: 1.6 base + ls 0.2 + rm 1.0 when --prune is
 * reachable. read/write are 0GB.
 *
 * @param {NS} ns
 */
import { mergeStatus } from "dnet_lib.js"

export async function main(ns) {
  const flags = ns.flags([
    ["prune", false],
    ["quiet", false],
  ])

  const host = ns.getHostname()
  const shards = ns.ls(host, "dnet_loot_").filter((f) => f.endsWith(".json"))

  const perHost = {}
  let totalKarma = 0
  let totalRamFreed = 0
  let totalCachesOpened = 0
  let totalCachesFound = 0

  for (const shard of shards) {
    let rec
    try {
      rec = JSON.parse(ns.read(shard))
    } catch {
      continue // a half-written shard from a killed script is expected; skip it
    }
    if (!rec || typeof rec.host !== "string") continue

    const ramFreed = Math.max(0, (rec.ram?.before ?? 0) - (rec.ram?.after ?? 0))
    const karma = rec.caches?.karma ?? 0
    const opened = rec.caches?.opened ?? 0
    const found = rec.caches?.found ?? 0

    perHost[rec.host] = { model: rec.model, difficulty: rec.difficulty, ramFreed, karma, opened, found, at: rec.at }
    totalRamFreed += ramFreed
    totalKarma += karma
    totalCachesOpened += opened
    totalCachesFound += found
  }

  if (flags.prune) {
    for (const shard of shards) ns.rm(shard)
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
      `${totalCachesOpened}/${totalCachesFound} caches opened, ${totalKarma} karma spent` +
      `${flags.prune ? ", shards pruned" : ""}`
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
