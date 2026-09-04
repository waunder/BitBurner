/**
 * The browser save's one-command boot: sync from GitHub, then bring up the
 * whole suite (mcp + darknet + everything else `startup.js` starts on
 * Steam). Built 2026-09-04 so there's exactly one thing to remember for a
 * fresh browser session — `run startup_browser.js` — instead of a manual
 * `run sync_from_github.js` followed by `run startup.js`.
 *
 * Sync runs first and is best-effort: a failed GitHub fetch is logged
 * loudly but does NOT block the rest of boot — whatever's already on disk
 * from the last successful sync still gets launched, since a stale-but-
 * working suite beats none at all.
 *
 * The pull-from-GitHub logic below is a deliberate duplicate of
 * sync_from_github.js's own, not an import of a shared sync_lib.js-style
 * module: a script's `import` is resolved before its body ever runs, so a
 * fresh browser save with only this one file pasted in by hand could never
 * reach the point of wget-ing a missing dependency into existence — the
 * whole script would just fail to load. Keeping this file bootstrappable
 * from nothing but itself is worth the small duplication; both copies are
 * short and rarely touched, kept in sync by hand.
 *
 * Everything after the sync step is the same closeTail-then-killall-then-
 * relaunch sequence as startup.js, plus dnet_root.js — see startup.js's own
 * header comment for why the ordering (close tails before killall, not
 * after) matters, and AGENTS.md's 2026-09-04 note for why darknet is back
 * in the default launch list. dnet_root.js fails cleanly on its own if
 * darkweb isn't reachable yet (ns.tprint + return on a failed
 * authenticate()/connectToSession() call, no hang, no crash) — nothing
 * extra needed here to handle that case.
 *
 * Cost: transient only, same shape as startup.js's own (ns.wget adds
 * negligible RAM — 0GB per the type definitions — on top of that).
 *
 * Confirmed live end-to-end 2026-09-04, first run: synced 81/81 file(s),
 * all 8 suite scripts started with 0 failed (dnet_root.js included), mcp.js
 * immediately picked a target and started running.
 *
 * @param {NS} ns
 */
const REPO = "waunder/BitBurner"
const BRANCH = "main"
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`
const MANIFEST_URL = `${RAW_BASE}sync_manifest.json`
const MANIFEST_LOCAL = "sync_manifest.json"

const SCRIPTS = [
  "mcp_supervisor.js",
  "hacking/crawler.js",
  "player_activity_controller.js",
  "mcp.js",
  "dnet_root.js",
  "maintenance_steward.js",
  "hud_consolidated.js",
  "mcp_xp.js",
]

export async function main(ns) {
  ns.disableLog("ALL")
  const host = ns.getHostname()

  ns.tprint(`startup_browser: syncing from GitHub (${REPO}@${BRANCH}) ...`)
  const sync = await pullFromGithub(ns)
  if (sync.requested === 0 && !sync.ok) {
    ns.tprint(`startup_browser: sync FAILED (${sync.reason}) — continuing with whatever's already on disk.`)
  } else {
    ns.tprint(
      `startup_browser: synced ${sync.succeeded.length}/${sync.requested} file(s)` +
        (sync.failed.length ? `, ${sync.failed.length} FAILED: ${sync.failed.join(", ")}` : "")
    )
  }

  // Close every open tail window BEFORE killing anything — see startup.js's
  // own header comment for the exact incident this ordering fixes.
  if (ns.ui && typeof ns.ui.closeTail === "function") {
    for (const proc of ns.ps(host)) {
      if (proc.pid !== ns.pid) ns.ui.closeTail(proc.pid)
    }
  }

  ns.killall(host)
  ns.tprint(`startup_browser: killed everything else on ${host}`)

  let started = 0
  let skipped = 0
  let failed = 0

  for (const file of SCRIPTS) {
    if (ns.scriptRunning(file, host)) {
      ns.tprint(`startup_browser: ${file} already running, skipping`)
      skipped += 1
      continue
    }
    const pid = ns.run(file, 1)
    if (pid === 0) {
      ns.tprint(`startup_browser: FAILED to start ${file} (not enough RAM on ${host}?)`)
      failed += 1
    } else {
      ns.tprint(`startup_browser: started ${file} (pid ${pid})`)
      started += 1
    }
  }

  ns.tprint(`startup_browser: done — ${started} started, ${skipped} already running, ${failed} failed`)
}

// Duplicate of sync_from_github.js's pull loop -- see this file's own header
// comment for why it isn't a shared import.
async function pullFromGithub(ns) {
  const gotManifest = await ns.wget(MANIFEST_URL, MANIFEST_LOCAL)
  if (!gotManifest) {
    return { ok: false, reason: "manifest fetch failed", requested: 0, succeeded: [], failed: [] }
  }

  let manifest
  try {
    manifest = JSON.parse(ns.read(MANIFEST_LOCAL))
  } catch (err) {
    return { ok: false, reason: `manifest parse failed: ${err}`, requested: 0, succeeded: [], failed: [] }
  }

  const files = manifest.files ?? []
  const succeeded = []
  const failed = []
  for (const file of files) {
    const ok = await ns.wget(RAW_BASE + file, file)
    if (ok) succeeded.push(file)
    else failed.push(file)
  }

  return { ok: failed.length === 0, requested: files.length, succeeded, failed }
}
