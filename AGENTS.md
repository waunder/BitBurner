# BitBurner — Working Guide

Operational notes for Codex. Deliberately short; process weight here should
match a solo hobby project. See `README.md` for the workflow, and in `docs/`:
`processes.md` for what every script does and how they connect,
`kensTodo.md` for actions that need Ken's hand specifically, and the audit
reports for why the current design is what it is.

## Working method — replaces the 2026-08-15/16 governance overlay

**2026-08-18: the tiered governance spine (standing-orders.md, the
directive ledger, promotion-state machine, the auditor tool, the
independent-review/controller/canary apparatus) is retired.** It produced a
genuine deadlock — no reachable stopping condition, a Tier-3 "independent
review" gate with no real independent party to perform it, a persistent
controller role that required exactly the kind of always-on automation the
same rules classified as forbidden, and a watched-file carve-out that taxed
ordinary edits. The result was measured directly: weeks where nearly every
logged "failure" was a process-compliance failure about the governance
system itself, and real, tested, working code (the R8 switch-veto patch)
sitting unlanded for two days for lack of a reviewer who didn't exist. Full
diagnosis is in the session history that produced this rewrite; it isn't
duplicated here.

**The working method is `docs/agent-working-agreement.md`.** It is
deliberately generic — written to be portable to any project, not just this
one — so this section only adds what's specific to *this* project: the
concrete list of things that still need Ken directly, and where session
continuity lives.

### The stop-list (this project's version of the agreement's fixed category 1)

Everything else is Codex's call, proceed without asking. Stop and get Ken's
explicit go-ahead first for:

- **Deploying real stock-market capital.** See "Stock trading" below —
  this one has already been crossed once and needs a clean bill before it's
  revisited.
- **Re-enabling faction-share automation** after its stability incident
  (2026-08-18, `share_deploy.js`, a separate incident from darknet's below),
  until the root cause is understood well enough to say why it won't recur.
- **An augmentation install, or any other in-game action that resets or
  permanently forfeits progress.**

**Darknet is no longer on this list — resolved 2026-09-04, Ken's call.**
Four live freezes 2026-08-30 (`docs/darknet-strategy.md`'s status banner)
never pinned an exact mechanism; the working theory was `ns.dnet.probe()`/
`getServerDetails()`/`authenticate()` cost against the save's darknet graph.
2026-09-03 turned up a real, independently-motivated bug on the exact same
code path: `dnet_root.js` was missing `authenticate()`/`connectToSession()`
calls and brute-force wasn't enabled, so `acquireSession` could fail and
retry rather than succeed once — a coherent, plausible driver for exactly
the kind of runaway per-tick cost the freeze theory pointed at, found and
fixed without originally chasing the freeze itself. Since that fix: two
independent clean restarts (browser save, Steam save) plus one sustained
75+ minute live run under real load (mcp.js, HUD, maintenance all running
concurrently — more load than the isolated single-freeze test that failed
in under 90 seconds pre-fix), no freeze, no sluggishness. Not a controlled
isolated-root-cause experiment (the original incident's own suggested next
step — reading the game's bundled source for what those three calls cost
internally — was never done), but enough real-world evidence to close this
out as a practical matter for a solo hobby project. `startup.js` and
`startup_browser.js` both launch `dnet_root.js` by default now.

That's the whole list. It replaces the old risk-tier system; don't
reintroduce a parallel one. Landing tested, flag-gated, reversible code
(committing it, restarting `mcp.js` to pick it up, even flipping a new
feature flag on for a bounded live check) is ordinary work, not a stop
condition — the flag and the restart *are* the rollback.

### Session continuity

`STATE.md` at the repo root is the one durable file — current objective,
what's done, the next concrete action, and any real blocker. Read it at the
start of a session and resume from it. `docs/Codex-todo.md` is the same
information in slightly more detail; `docs/claude-todo.md` and the various
historical audit reports are history, not current authority.

**Keep `docs/processes.md` and `docs/kensTodo.md` current.** If a script
gains an argument, a file it reads or writes, or a failure mode, update
`processes.md` in the same commit. The moment something needs Ken's hand —
a download, an in-game click, anything Codex structurally cannot do — add
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
- **The legacy VS Code file-sync extension auto-pushes, and its broad download
  reverses and re-affirms source.** If it is enabled, the extension watches the filesystem (not just editor saves), so edits written
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
- **Codex can trigger routine source sync and telemetry pulls through the
  Remote API daemon.** The extension's UI-only command still cannot be clicked
  by Codex, but it is now a recovery path, not the normal workflow. The exact
  watched/pulled sets are `tools/bb_remote.py::WATCHED_FILES`/`PULL_FILES` —
  editing a `WATCHED_FILES` path in this connected checkout can push it into
  the running game (and, on restart, make it live), so know which file a
  given edit is before assuming it's purely local.
- **A dropped legacy extension session doesn't replay what it missed on reconnect.**
  `startup.js` was created and committed while the session had silently
  dropped (a known recurring issue — see the note above); reconnecting alone
  did not push it, even after confirming the connection was back. The
  watcher reacts to *new* filesystem events going forward, it doesn't diff
  local against remote on reconnect. Fix: force a fresh event —
  `touch <file>` from Codex's side (no content change needed) or a manual
  save in the editor from Ken's — and it pushes normally. The Remote API
  daemon instead performs a manifest resync/pull on reconnect; verify its
  result rather than applying this legacy workaround by habit.

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
  (`docs/kensTodo.md`, `docs/Codex-todo.md`, a doc, `docs/status-dashboard.html`),
  never pasted into chat.
- **Lead with a recommendation, not a menu**, whenever Ken has to decide
  something. He wants to confirm or override, not analyze from scratch.
- **Three lists, three jobs:** `docs/kensTodo.md` is only things Ken must
  physically do; `docs/Codex-todo.md` is Codex's own granular working
  list, read first every session; `docs/status-dashboard.html` (published
  as a Codex Artifact — URL in `docs/processes.md`) is the standing
  at-a-glance view Ken checks on his own schedule, redeployed in place
  rather than re-sent over chat.
- **A live coordination task that needs Ken's hand and hits repeated
  retries or corrections only puts the first ask and the final outcome in
  chat** — intermediate retry/failure updates go to the dashboard instead.
  Learned from the port-12526 saga (2026-08-09/10), where several failed
  rounds got narrated in chat before Ken asked for this fix himself.

## Git

Standing approval: commit and push non-force changes at Codex's discretion;
a task-specific protected-branch or no-push instruction overrides this
default. Repo is private at github.com/waunder/BitBurner. Ken is
habit-averse and has explicitly assigned version-control hygiene to Codex —
do not hand him routines to remember, just keep the tree committed.

Generated files (`mcp_status.json`, `mcp_status_log.txt`,
`mcp_target_state.json`, `mcp_events.txt`) are gitignored — they're game
output, and the log lives inside the save file, so it must not grow without
bound. `mcp_config.json` is the one exception: it's hand-authored and must
stay committed and out of the ignore list, or it can't sync into the game.

## Open work

`STATE.md` and `docs/Codex-todo.md` carry the current backlog. The Remote
API replacement for routine push/pull is built and live-confirmed; current
priority is `STATE.md`'s named next action.

**Stock trading stays read-only until Ken explicitly approves capital
deployment.** `mcp_stocks.js` (built 2026-08-09) never references
`buyStock`/`sellStock`/`buyShort`/`sellShort`/`placeOrder`/`cancelOrder`
anywhere, by design — it's a display panel, not a trader. Don't add a call to
any of those functions in this repo without Ken saying so directly first,
even in draft/experimental code. **This has already been violated once:**
`mcp_stock_trader.js` (untracked, present in the working tree) does call
`buyStock`/`sellStock` behind a `trade=1` flag, and a process list once
showed it actually running with that flag live before a restart (no
confirmed order execution). Leave the file as-is — it's evidence, not just
draft code — but do not run it, sync it, or add it to any watched/startup
path under any argument until Ken gives an explicit go-ahead on capital
deployment.

Rooting is handled by `hacking/crawler.js` → `hacking/worm.js` (not by
`mcp.js`), so the worker pool only grows while the crawler is running and
you own enough port-opener `.exe`s for each server's requirement. Known bug:
`crawler.js` does `Array(servers)` where it means `Array.from(servers)`, so
`serv_set` nests the seed list one level down and home's immediate
neighbours get re-queued on rediscovery. Wasteful, not fatal.
