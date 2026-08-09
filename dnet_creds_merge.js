/**
 * Home-side collector for darknet credentials.
 *
 * Roaming dnet_deploy.js agents each write their findings to a per-host shard
 * (dnet_cred_<host>.txt) and scp it here, because many agents appending to one
 * shared file would clobber each other and a script killed mid-write would
 * leave the store truncated. This folds the shards into dnet_creds.txt, newest
 * record per host wins, and reports which hosts are known.
 *
 * NOT YET RUN IN BITBURNER.
 *
 * Run this on home before re-seeding the net after a mass script death: the
 * merged dnet_creds.txt is what a fresh deployer carries out with it, and
 * every password in it turns a multi-second authenticate into a free
 * connectToSession.
 *
 * Args: --prune (delete shards after a successful merge), --quiet.
 *
 * Reads:  dnet_cred_*.txt shards, dnet_creds.txt
 * Writes: dnet_creds.txt
 *
 * RAM estimate ~2.0GB: 1.6 base + ls 0.2 + getHostname 0.05 + rm 1.0 when
 * --prune is reachable. read/write are 0GB.
 *
 * @param {NS} ns
 */
import { CREDS_FILE, SHARD_PREFIX, parseCreds } from "dnet_lib.js"

export async function main(ns) {
  const flags = ns.flags([
    ["prune", false],
    ["quiet", false],
  ])

  const host = ns.getHostname()
  const merged = parseCreds(ns.read(CREDS_FILE))
  const shards = ns.ls(host, SHARD_PREFIX).filter((f) => f.endsWith(".txt"))

  let added = 0
  let updated = 0

  for (const shard of shards) {
    for (const [name, rec] of Object.entries(parseCreds(ns.read(shard)))) {
      const prev = merged[name]
      if (!prev) {
        merged[name] = rec
        added++
      } else if ((rec.at ?? 0) > (prev.at ?? 0) && rec.password !== prev.password) {
        merged[name] = rec
        updated++
      }
    }
  }

  const hosts = Object.keys(merged).sort()
  const body = hosts.map((name) => JSON.stringify(merged[name])).join("\n")
  ns.write(CREDS_FILE, body + (body ? "\n" : ""), "w")

  if (flags.prune) {
    for (const shard of shards) ns.rm(shard)
  }

  if (!flags.quiet) {
    for (const name of hosts) ns.tprint(`  ${name}  model=${merged[name].model}  pw=${JSON.stringify(merged[name].password)}`)
  }
  ns.tprint(
    `dnet_creds_merge: ${hosts.length} host(s) known; ${shards.length} shard(s) read, ` +
      `${added} new, ${updated} rotated${flags.prune ? ", shards pruned" : ""}`
  )
}

export function autocomplete() {
  return ["--prune", "--quiet"]
}
