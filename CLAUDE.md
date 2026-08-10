# BitBurner — Working Guide

Operational notes for Claude. Deliberately short; process weight here should
match a solo hobby project. See `README.md` for the workflow, and in `docs/`:
`processes.md` for what every script does and how they connect,
`kensTodo.md` for actions that need Ken's hand specifically, and the audit
reports for why the current design is what it is.

**Keep `docs/processes.md` and `docs/kensTodo.md` current.** If a script
gains an argument, a file it reads or writes, or a failure mode, update
`processes.md` in the same commit. The moment something needs Ken's hand —
a download, an in-game click, anything Claude structurally cannot do — add
it to `kensTodo.md` right then, and check it off once confirmed done rather
than assuming. A stale doc is worse than none, because it gets trusted.

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
- **A tail window only keeps in the DOM what fits its configured height —
  it is not a scrollable div with everything present underneath.** Found via
  the dump feature: a 100-line request rendered only ~45 lines over CDP
  (always the tail end); a 45-line request rendered completely. Undersizing
  the window for "visual tidiness" silently drops content a reader outside
  the game can retrieve, even though `ns.print` genuinely wrote all of it.
  Size tall enough for the actual content, uncapped, whenever a window's
  purpose is being read over CDP rather than looked at directly.
- **`ns.kill`/`ns.killall` do not close the killed script's tail window.**
  The window is orphaned, frozen showing whatever it last rendered, and
  stays open indefinitely — found because two `startup.js` runs left two
  differently-stated "mcp" panels visible while `ps` showed only one live
  process. `ns.ui.closeTail(pid)` closes it (0GB, takes an optional PID
  specifically so another script can close a window that isn't its own);
  `mcp_hud.js`/`get_stats.js`/`mcp_supervisor.js`'s self-supersede logic
  calls it now. Only fixes it going forward — a window already orphaned by a
  now-dead process has no PID left in `ns.ps` to target, so it needs one
  manual close.
- **`ns.write` only accepts `.txt`, `.json`, `.css`, or a script extension.**
  Anything else throws `File path should be a text file or script` at the
  call site. `.log` hit this first; `.jsonl` hit it again for
  `mcp_events.txt` — every write threw for the file's entire first day,
  caught by a try/catch and printed only to `ns.print`, so the file never
  existed in the game and nothing visible said so. If a new generated file
  needs a "this is structured/line-delimited" hint, put it in the content or
  the filename stem, not the extension.
- **File sync auto-pushes, but a download reverses and re-affirms it.** The
  extension watches the filesystem (not just editor saves), so edits written
  by tooling *do* auto-push — but only while the server is running and the
  game is connected. **"Download Files from Server" overwrites local source
  with the game's copies, and the watcher then pushes those straight back**,
  making the stale version authoritative on both sides. Observed 2026-08-08:
  `Downloaded: mcp.js` immediately followed by `Pushed: /mcp.js`.
  - Use **"Download Files Matching Pattern..."** with the pattern in
    `docs/kensTodo.md` — pulls only generated telemetry, never source. Kept
    in one place rather than duplicated here, so it can't drift out of sync
    with itself. The extension remembers the last pattern, so it pre-fills
    after the first use.
  - It is **one** minimatch pattern, not a list: `**/*.txt **/*.json`
    silently matches zero files. Use brace expansion instead. Patterns are
    matched against names without a leading slash (`mcp_status.json`,
    `scripts/hack.js`). Avoid `mcp_status*` — it also catches the
    `mcp_status.js` *source* file. `mcp_config.json` must never be in the
    pattern — it's a hand-authored, committed file now, not generated
    output.
  - Keep the tree committed regardless, so a bad pull costs a `git checkout`
    (and the restore itself auto-pushes the correct version back).
- **Claude cannot trigger the download.** No CLI or API for the extension
  command, and its WebSocket port is occupied by the game. Getting in-game
  state onto disk requires Ken to click. Design telemetry accordingly:
  maximise information per click.
- **A dropped sync session doesn't replay what it missed on reconnect.**
  `startup.js` was created and committed while the session had silently
  dropped (a known recurring issue — see the note above); reconnecting alone
  did not push it, even after confirming the connection was back. The
  watcher reacts to *new* filesystem events going forward, it doesn't diff
  local against remote on reconnect. Fix: force a fresh event —
  `touch <file>` from Claude's side (no content change needed) or a manual
  save in the editor from Ken's — and it pushes normally. Worth checking for
  after any reconnect if a file that should be new in-game isn't.

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
- A caught exception silently `ns.print`'d is the same failure mode as an
  unrecorded decision: `mcp_events.txt` (originally `.jsonl`, see the
  `ns.write` constraint above) threw on every write for its entire first day
  and nothing surfaced it, because the in-memory data that fed the status
  file kept working regardless of whether the disk write succeeded. Route
  failures the code didn't expect through the invariant system
  (`ns.toast` + a status-file counter), not a print statement — see
  `checkTickInvariants` in `mcp.js`.

## Communication channels

Ken works from the counter, not the bench — he directs and confirms, he
doesn't want the mechanics narrated at him. Practical rules:

- **Default to background agents** for anything past a single trivial read.
  Don't narrate tool calls in chat; that noise is exactly what he's opted
  out of.
- **A background agent's final report to Ken is one plain sentence** — no
  code, no commit hashes, no jargon. Full detail goes to a file
  (`docs/kensTodo.md`, `docs/claude-todo.md`, a doc, `docs/status-dashboard.html`),
  never pasted into chat.
- **Lead with a recommendation, not a menu**, whenever Ken has to decide
  something. He wants to confirm or override, not analyze from scratch.
- **Three lists, three jobs:** `docs/kensTodo.md` is only things Ken must
  physically do; `docs/claude-todo.md` is Claude's own granular working
  list, read first every session; `docs/status-dashboard.html` (published
  as a Claude Artifact — URL in `docs/processes.md`) is the standing
  at-a-glance view Ken checks on his own schedule, redeployed in place
  rather than re-sent over chat.
- **A live coordination task that needs Ken's hand and hits repeated
  retries or corrections only puts the first ask and the final outcome in
  chat** — intermediate retry/failure updates go to the dashboard instead.
  Learned from the port-12526 saga (2026-08-09/10), where several failed
  rounds got narrated in chat before Ken asked for this fix himself.

## Git

Standing approval: commit and push (non-force) to `origin main` at Claude's
discretion. Repo is private at github.com/waunder/BitBurner. Ken is
habit-averse and has explicitly assigned version-control hygiene to Claude —
do not hand him routines to remember, just keep the tree committed.

Generated files (`mcp_status.json`, `mcp_status_log.txt`,
`mcp_target_state.json`, `mcp_events.txt`) are gitignored — they're game
output, and the log lives inside the save file, so it must not grow without
bound. `mcp_config.json` is the one exception: it's hand-authored and must
stay committed and out of the ignore list, or it can't sync into the game.

## Open work

`docs/process-backlog.md` holds the current backlog — it re-scores the
2026-08-07 process audit against the loop as it now exists (CDP connection,
supervisor, HUD, watcher), which invalidated that audit's "maximize
information per click" premise. The audit itself stays as the historical
record. **Top item as of 2026-08-10 is replacing the VS Code extension's
file sync entirely** — see `docs/claude-todo.md` priority 1 for the concrete
next steps. Version stamps, the single field list, hot-reloaded config, the
event log, and invariants all shipped 2026-08-08 — see the Done table there
for what shipped and what's still worth watching about each. Below the sync
replacement, in order: pure-function extraction for `node --test`, `probe=`
experiment mode, ports as a telemetry ring buffer, `mcp_doctor.js` (no
longer RAM-gated — home is 128GB as of 2026-08-09, build if independent
network measurement turns out to be wanted).

**Stock trading stays read-only until Ken explicitly approves capital
deployment.** `mcp_stocks.js` (built 2026-08-09) never references
`buyStock`/`sellStock`/`buyShort`/`sellShort`/`placeOrder`/`cancelOrder`
anywhere, by design — it's a display panel, not a trader. Don't add a call to
any of those functions in this repo without Ken saying so directly first,
even in draft/experimental code.

Rooting is handled by `hacking/crawler.js` → `hacking/worm.js` (not by
`mcp.js`), so the worker pool only grows while the crawler is running and
you own enough port-opener `.exe`s for each server's requirement. Known bug:
`crawler.js` does `Array(servers)` where it means `Array.from(servers)`, so
`serv_set` nests the seed list one level down and home's immediate
neighbours get re-queued on rediscovery. Wasteful, not fatal.
