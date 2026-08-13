/**
 * Home-side assembler for the darknet deployer heartbeat. Same shard-then-
 * merge relationship to dnet_deploy.js's per-host shards that
 * dnet_creds_merge.js has to credential shards and dnet_loot_merge.js has
 * to loot shards (see either file's own docstring for the "why shards, not
 * one shared file" reasoning — identical here).
 *
 * Added 2026-08-12 to fix a real bug: dnet_deploy.js used to write its
 * "deployer" heartbeat locally via mergeStatus (safe by itself) and then
 * ship the *entire* dnet_status.json to home via a raw `ns.scp` — not a
 * merge. Every roaming instance's own local dnet_status.json only ever has
 * a "deployer" key (only home ever runs the merge scripts), so whichever
 * instance's scp landed on home last silently overwrote home's whole file,
 * erasing the "credsMerge"/"loot" sections dnet_creds_merge.js and
 * dnet_loot_merge.js had written there. `ns.write`/`ns.read` have no
 * remote-host form (checked against NetscriptDefinitions.d.ts), so there
 * was never a way for a remote instance to merge into home's copy
 * directly — `scp` was always a raw file copy. Full mechanism:
 * docs/darknet-functions.md's 2026-08-12 "status-file clobbering" section.
 *
 * The fix: dnet_deploy.js now writes its heartbeat to a uniquely-named
 * local shard (dnet_deployer_<host>.json, via dnet_lib.js's
 * writeDeployerShard) and ships *that* to home — unique filename per host
 * means concurrent scp's can never collide. This script is the other half:
 * it runs on home only, reads every deployer shard that has landed here,
 * and folds them into dnet_status.json's "deployer" section.
 *
 * Design decision — freshest shard wins, not a network-wide aggregate:
 * many independent dnet_deploy.js instances each report their own partial
 * view (see that file's writeDeployerStatus doc comment — `lifetime.*` and
 * `localKnownCreds` are already labelled this-instance-only, not network
 * totals). Summing them would double- or triple-count overlapping
 * neighbours different instances both happened to probe, which is not a
 * meaningful number. Picking the single freshest heartbeat instead keeps
 * the dashboard's "deployer" section showing exactly what it always
 * showed before this fix — one instance's live view — just now without
 * the risk of it vanishing seconds later. A genuine network-wide total
 * already exists for the one thing that's actually additive across
 * instances: dnet_creds_merge.js's "credsMerge.totalCracked" section,
 * which reads every credential shard ever shipped, not just the newest.
 * If a network-wide deployer aggregate (e.g. summed thisPass counts) turns
 * out to be more useful later, it's a small addition here — freshest-wins
 * was chosen as the smaller, closer-to-existing-behavior change, not
 * because summing would be wrong.
 *
 * Pruning: like dnet_creds_merge.js/dnet_loot_merge.js, --prune deletes
 * every shard read this pass after folding the freshest one into
 * dnet_status.json. Safe here for the same reason it's safe there: nothing
 * is lost — the assembled result already lives in dnet_status.json, and
 * dnet_deploy.js overwrites its own shard from scratch (`"w"` mode) every
 * pass anyway, so a pruned shard is simply re-created and re-shipped on
 * that instance's next heartbeat. Unlike credential shards (a durable
 * store of knowledge worth keeping until merged), deployer shards are pure
 * liveness pings with no value once a newer one exists or the current one
 * has been folded in, so pruning by default would also be defensible —
 * kept opt-in (`--prune`, default false) only for consistency with the
 * other two merge scripts' existing convention.
 *
 * Args: --prune (delete shards after a successful merge), --quiet.
 *
 * Reads:  dnet_deployer_*.json shards, dnet_status.json (merged into, not
 *         overwritten)
 * Writes: dnet_status.json
 *
 * RAM estimate ~2.0GB: 1.6 base + ls 0.2 + rm 1.0 when --prune is
 * reachable. read/write/getHostname are 0GB.
 *
 * @param {NS} ns
 */
import { DEPLOYER_SHARD_PREFIX, DEPLOYER_SHARD_SUFFIX, mergeStatus, pickFreshestShard } from "dnet_lib.js"

export async function main(ns) {
  const flags = ns.flags([
    ["prune", false],
    ["quiet", false],
  ])

  const host = ns.getHostname()
  const shardFiles = ns.ls(host, DEPLOYER_SHARD_PREFIX).filter((f) => f.endsWith(DEPLOYER_SHARD_SUFFIX))

  const shards = []
  for (const file of shardFiles) {
    try {
      const rec = JSON.parse(ns.read(file))
      if (rec && typeof rec.ts === "number") shards.push({ file, rec })
    } catch {
      // A half-written shard from a killed script is expected; skip it.
    }
  }

  if (shards.length === 0) {
    ns.tprint("dnet_status_merge: no deployer shards found -- nothing to assemble")
    return
  }

  const chosen = pickFreshestShard(shards)
  mergeStatus(ns, "deployer", {
    ...chosen.rec,
    assembledAt: Date.now(),
    shardsSeen: shards.length,
    sourceShard: chosen.file,
  })

  if (!flags.quiet) {
    for (const s of shards) {
      const flag = s.file === chosen.file ? "* " : "  "
      ns.tprint(`${flag}${s.file}  host=${s.rec.host}  ts=${new Date(s.rec.ts).toISOString()}`)
    }
  }

  if (flags.prune) {
    for (const s of shards) ns.rm(s.file)
  }

  ns.tprint(
    `dnet_status_merge: ${shards.length} shard(s) read, chose ${chosen.rec.host}'s heartbeat ` +
      `(ts=${new Date(chosen.rec.ts).toISOString()})${flags.prune ? ", shards pruned" : ""}`
  )
}

export function autocomplete() {
  return ["--prune", "--quiet"]
}
