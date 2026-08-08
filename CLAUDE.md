# BitBurner — Working Guide

Operational notes for Claude. Deliberately short; process weight here should
match a solo hobby project. See `README.md` for the workflow, and in `docs/`:
`processes.md` for what every script does and how they connect, and the audit
reports for why the current design is what it is.

**Keep `docs/processes.md` current.** If a script gains an argument, a file it
reads or writes, or a failure mode, update it in the same commit. Ken asked
for that map explicitly; a stale one is worse than none, because it gets
trusted.

## What this is

Netscript automation for the game Bitburner. `mcp.js` is an orchestrator that
runs on `home`, scans the network, picks a target server, and deploys
`weaken`/`grow`/`hack` worker threads across rooted hosts to farm money from
it. Everything else is support: `get_stats.js` (live display),
`restart_mcp.js` (kill + relaunch), `mcp_status_parser.py|js` (local log
reading).

## The environment constraints that shape everything

- **Scripts run inside the game, not on this machine.** `node` can syntax-check
  them but cannot execute them meaningfully. Every behavioural claim is
  unverified until it has actually run in Bitburner.
- **Bitburner does not hot-reload.** A running script keeps executing the
  version it started with. Edits require a restart (`run restart_mcp.js`).
  This burned a full hour once — fixes appeared not to work because the old
  process was still running.
- **File sync auto-pushes, but a download reverses and re-affirms it.** The
  extension watches the filesystem (not just editor saves), so edits written
  by tooling *do* auto-push — but only while the server is running and the
  game is connected. **"Download Files from Server" overwrites local source
  with the game's copies, and the watcher then pushes those straight back**,
  making the stale version authoritative on both sides. Observed 2026-08-08:
  `Downloaded: mcp.js` immediately followed by `Pushed: /mcp.js`.
  - Use **"Download Files Matching Pattern..."** with exactly
    `mcp_*.{json,txt}` — pulls only the three telemetry files. Never
    bulk-download source. The extension remembers the last pattern, so it
    pre-fills after the first use.
  - It is **one** minimatch pattern, not a list: `**/*.txt **/*.json`
    silently matches zero files. Use brace expansion instead. Patterns are
    matched against names without a leading slash (`mcp_status.json`,
    `scripts/hack.js`). Avoid `mcp_status*` — it also catches the
    `mcp_status.js` *source* file.
  - Keep the tree committed regardless, so a bad pull costs a `git checkout`
    (and the restore itself auto-pushes the correct version back).
- **Claude cannot trigger the download.** No CLI or API for the extension
  command, and its WebSocket port is occupied by the game. Getting in-game
  state onto disk requires Ken to click. Design telemetry accordingly:
  maximise information per click.

## Diagnosis discipline

The hard-won lesson (see `docs/audit-2026-08-07-process.md`): **log decisions,
not just state.** Recording outcomes without the inputs to the decision that
produced them forces backward inference, which is exactly the guessable step.
Several bugs took 3–5 restart cycles because the value that would have
falsified a wrong theory was never written anywhere.

Practical rules:

- An event should record every variable that appeared in the predicate that
  fired it.
- Build the status object first, derive log lines *from* it. Maintaining
  parallel hand-written field lists is how a diagnostic field ends up in the
  wrong channel and stays invisible.
- Restarts wipe in-memory history (`rateSamples`, `moneyPctSamples`,
  `totalHacked`). The test cycle is also an evidence-destruction cycle — keep
  what matters in files.
- `ns.print` goes to the tail window; only `ns.tprint` reaches the terminal;
  neither reaches the JSON/log files. Know which channel the reader is using.

## Git

Standing approval: commit and push (non-force) to `origin main` at Claude's
discretion. Repo is private at github.com/waunder/BitBurner. Ken is
habit-averse and has explicitly assigned version-control hygiene to Claude —
do not hand him routines to remember, just keep the tree committed.

Generated files (`mcp_status.json`, `mcp_status_log.txt`,
`mcp_target_state.json`) are gitignored — they're game output, and the log
lives inside the save file, so it must not grow without bound.

## Open work

`docs/audit-2026-08-07-process.md` holds the current backlog. The
highest-value unimplemented items, in order: hot-reloaded `mcp_config.json`
(lets tunables change without a restart, and without wiping history), an
event log with predicate inputs, and in-game invariant assertions via
`ns.toast`.

Rooting is handled by `hacking/crawler.js` → `hacking/worm.js` (not by
`mcp.js`), so the worker pool only grows while the crawler is running and
you own enough port-opener `.exe`s for each server's requirement. Known bug:
`crawler.js` does `Array(servers)` where it means `Array.from(servers)`, so
`serv_set` nests the seed list one level down and home's immediate
neighbours get re-queued on rediscovery. Wasteful, not fatal.
