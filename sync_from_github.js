/**
 * Pulls the current committed source straight from GitHub into the game via
 * ns.wget — the browser save's answer to what the Remote API does for
 * Steam. Built 2026-09-04 because the browser can't use the Remote API at
 * all: Chrome's Private Network Access policy silently blocks a public
 * origin (bitburner-official.github.io or wherever this is hosted) from
 * opening a WebSocket to localhost, confirmed unfixable from our side (see
 * CLAUDE.md / docs/kensTodo.md's 2026-09-03 root-cause entry) — clipboard-
 * paste into the Script Editor, file by file, was the only remaining path
 * until now.
 *
 * `ns.wget(url, target, host?)` is a real, 0GB Netscript function (its own
 * doc example fetches from raw.githubusercontent.com) whose fetch happens
 * to a normal public HTTPS host, not localhost — so it isn't subject to the
 * same Private Network Access block. The repo (github.com/waunder/BitBurner)
 * was made public 2026-09-04 specifically to unblock this: raw.githubusercontent.com
 * won't serve a private repo's content without an auth token, and ns.wget
 * has no way to send one.
 *
 * Reads sync_manifest.json fresh from GitHub every run rather than
 * expecting a local copy — the browser save otherwise has no way to receive
 * one, and this keeps this script itself the *only* thing that ever needs
 * pasting into the Script Editor by hand. Whatever the manifest lists is
 * whatever gets pulled; this file has no independent file list to drift out
 * of sync with tools/bb_remote.py's WATCHED_FILES (same manifest, both
 * readers — see sync_manifest.json's own "_comment" and the note where
 * bb_remote.py loads it).
 *
 * Usage: run sync_from_github.js [pattern]
 *   run sync_from_github.js          — every file in the manifest
 *   run sync_from_github.js dnet_*   — only manifest entries matching the
 *                                       glob (same * / ? syntax as lsf.js)
 *
 * Not live-verified yet (per CLAUDE.md — nothing here has run in Bitburner):
 * ns.wget's real-world success rate across ~80 sequential fetches, and
 * whether GitHub or the game itself rate-limits a burst like that. Reports
 * a clear per-file pass/fail tally rather than assuming success either way,
 * and never aborts the whole run over one failed file.
 *
 * Writes: sync_from_github_status.json (one record per run: counts, list of
 * any failed files, branch/commit reference where available)
 *
 * @param {NS} ns
 */
const REPO = "waunder/BitBurner"
const BRANCH = "main"
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`
const MANIFEST_URL = `${RAW_BASE}sync_manifest.json`
const MANIFEST_LOCAL = "sync_manifest.json"
const STATUS_FILE = "sync_from_github_status.json"

export async function main(ns) {
  const pattern = typeof ns.args[0] === "string" ? ns.args[0] : null

  ns.tprint(`sync_from_github: fetching manifest from ${MANIFEST_URL} ...`)
  const gotManifest = await ns.wget(MANIFEST_URL, MANIFEST_LOCAL)
  if (!gotManifest) {
    ns.tprint("sync_from_github: FAILED to fetch sync_manifest.json — aborting, nothing pulled.")
    ns.write(
      STATUS_FILE,
      JSON.stringify({ ts: Date.now(), ok: false, reason: "manifest fetch failed" }),
      "w"
    )
    return
  }

  let manifest
  try {
    manifest = JSON.parse(ns.read(MANIFEST_LOCAL))
  } catch (err) {
    ns.tprint(`sync_from_github: FAILED to parse manifest: ${err} — aborting.`)
    ns.write(
      STATUS_FILE,
      JSON.stringify({ ts: Date.now(), ok: false, reason: `manifest parse failed: ${err}` }),
      "w"
    )
    return
  }

  let files = manifest.files ?? []
  if (pattern) {
    const regex = globToRegex(pattern)
    files = files.filter((f) => regex.test(f))
    if (files.length === 0) {
      ns.tprint(`sync_from_github: no manifest entries match "${pattern}"`)
      return
    }
  }

  ns.tprint(`sync_from_github: pulling ${files.length} file(s) from ${REPO}@${BRANCH} ...`)

  const succeeded = []
  const failed = []
  for (const file of files) {
    const ok = await ns.wget(RAW_BASE + file, file)
    if (ok) {
      succeeded.push(file)
      ns.print(`OK   ${file}`)
    } else {
      failed.push(file)
      ns.print(`FAIL ${file}`)
    }
  }

  ns.tprint(
    `sync_from_github: done — ${succeeded.length}/${files.length} pulled` +
      (failed.length ? `, ${failed.length} FAILED: ${failed.join(", ")}` : "")
  )
  ns.write(
    STATUS_FILE,
    JSON.stringify({
      ts: Date.now(),
      ok: failed.length === 0,
      repo: REPO,
      branch: BRANCH,
      pattern: pattern ?? null,
      requested: files.length,
      succeeded: succeeded.length,
      failed,
    }),
    "w"
  )
}

// Same glob-to-regex translation as lsf.js: * -> "any run of characters",
// ? -> "any one character", anchored full-string match.
function globToRegex(pattern) {
  const source =
    "^" +
    pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") +
    "$"
  return new RegExp(source)
}
