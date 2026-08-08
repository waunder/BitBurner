# BitBurner — Working Guide

Operational notes for Claude. Deliberately short; process weight here should
match a solo hobby project. See `README.md` for the workflow and `docs/` for
the audit reports that produced most of the current design.

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
- **File sync is bidirectional and asymmetric.** "Bitburner: Sync All Files"
  (local → game) is safe. **"Download Files from Server" (game → local)
  overwrites local edits without warning** and has destroyed work here. Keep
  the tree committed so a bad pull costs a `git checkout`.
- **`autoSync` fires on editor save**, so edits written by tooling outside the
  VS Code editor may never reach the game. Use the explicit sync command.
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
`ns.toast`. Also standing: nothing in this repo acquires root, so the worker
and target pool only grows by manual nuking.
