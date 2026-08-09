/**
 * Watches two files for requests from outside the game, so neither a code
 * change nor a question about game state needs a human hand once this is
 * running: restarts and file inspection both become a local file write.
 *
 * 1. mcp_restart.txt -> kill and relaunch mcp.js. Bitburner does not
 *    hot-reload: a running script keeps executing the version it started
 *    with, so every code change needs this. The file sync extension already
 *    auto-pushes edits into the game; this is what acts on them.
 *
 * 2. mcp_dump_request.txt -> render a file's full contents into a tail
 *    window (mcp_dump). The CDP connection can read anything already
 *    rendered on screen, but nothing outside the game can call ns.read() —
 *    that only works from inside a running script. Bitburner's HUD (see
 *    mcp_hud.js) deliberately shows only a curated ~10-line summary, so it
 *    was never a substitute for the full mcp_status.json / mcp_events.txt /
 *    mcp_status_log.txt content that actually found bugs this session (the
 *    bucket-hysteresis thrashing, the invalid-extension write failure).
 *    Getting that onto disk still required a manual download. This closes
 *    that gap: write a request here, read the rendered dump over CDP.
 *
 * Both protocols use token comparison rather than a delete-the-flag
 * handshake, specifically to keep RAM down: ns.read costs 0GB and returns ""
 * for a missing file, so neither needs ns.fileExists (0.1GB) or ns.rm
 * (1GB). Every ns.ui.* call used for rendering the dump is also 0GB
 * (confirmed against the game's own cost table, not assumed).
 *
 * Total: 1.6GB script baseline + ns.run (1.0GB) + ns.ps (0.2GB) + ns.kill
 * (0.5GB, for self-supersede below) = 3.3GB. All four figures read directly
 * from the game's cost table, not estimated.
 *
 * @param {NS} ns
 */
const RESTART_FILE = "mcp_restart.txt"
const DUMP_FILE = "mcp_dump_request.txt"
const POLL_MS = 2000

// Bitburner renders ANSI escapes in tail windows. White separates our panels
// from the game's green.
const WHITE = "[37m"
const RESET = "[0m"

const DUMP_TITLE = "mcp_dump"
// A tail window's title becomes the first line of its own innerText, above
// whatever main() prints — the exact fact whose absence broke the
// out-of-game watcher's HUD matching earlier this session (it checked the
// whole panel blob against a verdict prefix and could never match past the
// "mcp" title line). Panels are found by title prefix over CDP, so keep it
// distinct from "mcp" (the HUD's title) — matching "mcp" would find the
// wrong window, and CDP-side code that greps for one must not silently pick
// up the other.
const DUMP_DEFAULT_LINES = 150
// A hard ceiling independent of what's requested, so a typo'd or malicious
// request can't try to render an unbounded file (mcp_status_log.txt has no
// size cap of its own) into the browser tab.
const DUMP_MAX_LINES = 500

/**
 * Renders a file for display: pretty-printed for .json, tailed raw lines for
 * everything else. Not a generic formatter — this project's only file
 * extensions are .json (one document) and .txt (either JSONL event/log
 * lines or the plain-text status log), so gating on extension is exact
 * rather than a heuristic guess.
 */
function formatDump(ns, filename, requestedLines) {
  const raw = ns.read(filename)
  const ts = new Date().toISOString()
  if (!raw) {
    return [`dump: ${filename}`, `@ ${ts}`, "", "(empty or does not exist)"]
  }

  if (filename.endsWith(".json")) {
    try {
      const pretty = JSON.stringify(JSON.parse(raw), null, 2)
      const lines = pretty.split("\n")
      return [`dump: ${filename}`, `@ ${ts} (${lines.length} lines)`, "", ...lines]
    } catch (e) {
      return [`dump: ${filename}`, `@ ${ts}`, "", `(invalid JSON: ${e})`, "", raw]
    }
  }

  // Drop a single trailing empty element from the final newline without
  // dropping genuine blank lines elsewhere in the file.
  const allLines = raw.split("\n")
  if (allLines.length > 0 && allLines[allLines.length - 1] === "") allLines.pop()
  const limit = Math.min(DUMP_MAX_LINES, requestedLines || DUMP_DEFAULT_LINES)
  const shown = allLines.slice(-limit)
  return [
    `dump: ${filename}`,
    `@ ${ts} (showing last ${shown.length} of ${allLines.length} lines)`,
    "",
    ...shown,
  ]
}

/**
 * Same fit-to-content sizing as get_stats.js/mcp_hud.js.
 *
 * The height is NOT cosmetic — it was originally capped at 700px on the
 * assumption that CDP's innerText read isn't affected by scroll position,
 * matching how a normal scrollable div works. That assumption was wrong and
 * cost real time to find: a 100-line dump request rendered only ~45 lines
 * over CDP, always the tail end, while a 45-line request rendered
 * completely. Bitburner's tail window only keeps in the DOM whatever fits
 * the window's actual configured height — it isn't a scrollable div with
 * everything present underneath, so undersizing the window silently drops
 * content from what CDP can read, even though ns.print genuinely wrote all
 * of it. The fix is to size tall enough to fit everything requested, not to
 * cap for visual tidiness — nothing here is optimizing for how the window
 * looks, only for what a reader outside the game can retrieve from it.
 */
function showDump(ns, lines) {
  if (!ns.ui) return
  if (typeof ns.ui.openTail === "function") ns.ui.openTail()
  if (typeof ns.ui.setTailTitle === "function") ns.ui.setTailTitle(DUMP_TITLE)

  ns.clearLog()
  for (const line of lines) ns.print(WHITE + line + RESET)

  if (typeof ns.ui.resizeTail === "function" && typeof ns.ui.getStyles === "function") {
    const styles = ns.ui.getStyles()
    const charWidth = styles.tailFontSize * 0.6
    const lineHeight = styles.tailFontSize * styles.lineHeight
    let maxLen = 0
    for (const line of lines) if (line.length > maxLen) maxLen = line.length
    const width = Math.min(1400, Math.max(200, Math.ceil(maxLen * charWidth) + 60))
    // No cap here on purpose — sized to DUMP_MAX_LINES's worst case
    // (~500 lines) with headroom, since a short window on a long dump means
    // lost content, not just a scrollbar.
    const height = Math.max(80, Math.ceil((lines.length + 1) * lineHeight) + 40)
    ns.ui.resizeTail(width, height)
  }
  if (typeof ns.ui.renderTail === "function") ns.ui.renderTail()
}

/**
 * mcp_dump_request.txt format, mirroring mcp_restart.txt's:
 *   line 1: a token/nonce, just to force change-detection even when
 *           re-requesting the same file
 *   line 2: filename
 *   line 3: optional line count for tailed (non-JSON) files
 */
function handleDumpRequest(ns, contents) {
  const lines = contents.split("\n").map((l) => l.trim()).filter(Boolean)
  const filename = lines[1]
  const requestedLines = lines[2] ? parseInt(lines[2], 10) : null

  if (!filename) {
    ns.tprint(`mcp_supervisor: dump request malformed (no filename on line 2): ${contents}`)
    return
  }

  ns.tprint(
    `mcp_supervisor: dump requested -> ${filename}${requestedLines ? ` (last ${requestedLines} lines)` : ""}`
  )
  showDump(ns, formatDump(ns, filename, requestedLines))
}

/**
 * Bitburner gives every running script its own process, so re-running this
 * to pick up new code (it doesn't hot-reload) would otherwise leave the old
 * copy running too — both watching the same trigger files, racing each
 * other on restart requests and dump renders. Same trap that hit
 * get_stats.js (three stray copies) and mcp_hud.js (two) earlier this
 * session; fixed here before it could happen a third time.
 *
 * ns.ps reports filenames without a leading slash — the same normalization
 * killActionScripts in mcp.js needed.
 *
 * ns.kill does NOT close the killed script's tail window — confirmed by
 * observation in mcp_hud.js and get_stats.js, which had the same gap.
 * Matters here specifically if a prior instance had an mcp_dump window open
 * at the moment it's superseded; ns.ui.closeTail(pid) is the separate call
 * that actually closes it.
 */
function killPriorInstances(ns) {
  const self = ns.pid
  const me = "mcp_supervisor.js"
  for (const proc of ns.ps(ns.getHostname())) {
    const name = proc.filename.startsWith("/") ? proc.filename.slice(1) : proc.filename
    if (name === me && proc.pid !== self) {
      if (ns.ui && typeof ns.ui.closeTail === "function") ns.ui.closeTail(proc.pid)
      ns.kill(proc.pid)
    }
  }
}

export async function main(ns) {
  ns.disableLog("ALL")
  killPriorInstances(ns)
  // Seed both from whatever is already on disk so a supervisor restart
  // doesn't immediately re-trigger on a stale token.
  let lastRestartToken = ns.read(RESTART_FILE)
  let lastDumpToken = ns.read(DUMP_FILE)
  ns.tprint(
    `mcp_supervisor: watching ${RESTART_FILE} and ${DUMP_FILE} ` +
      `(restart token="${lastRestartToken.split("\n")[0].trim() || "<none>"}")`
  )

  while (true) {
    const restartContents = ns.read(RESTART_FILE)
    if (restartContents && restartContents !== lastRestartToken) {
      lastRestartToken = restartContents
      const lines = restartContents.split("\n").map((l) => l.trim()).filter(Boolean)
      const args = lines.slice(1)
      ns.tprint(`mcp_supervisor: restart requested (token=${lines[0]})${args.length ? " args=" + args.join(" ") : ""}`)
      const pid = ns.run("restart_mcp.js", 1, ...args)
      if (pid === 0) {
        ns.tprint("mcp_supervisor: could not start restart_mcp.js (not enough RAM on home?)")
      }
    }

    const dumpContents = ns.read(DUMP_FILE)
    if (dumpContents && dumpContents !== lastDumpToken) {
      lastDumpToken = dumpContents
      handleDumpRequest(ns, dumpContents)
    }

    await ns.sleep(POLL_MS)
  }
}
