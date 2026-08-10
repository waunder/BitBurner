# Claude's working list

Claude's own granular task list, session to session. Read this first at the
start of every session; update it as you work — check items off, add new
ones the moment they surface, don't let it go stale.

Distinct from the other two lists:
- `docs/kensTodo.md` — only things that need Ken's physical hand (a click,
  a download, an in-game action).
- `docs/process-backlog.md` — engineering-improvement ideas for the mcp
  loop itself, argued and reasoned, not task-tracked.
- This file — Claude's own multi-step work, flat and checklist-style like
  `kensTodo.md`, kept current rather than written once and left.

---

## Priority 1: kill the VS Code extension dependency

The extension's file sync silently drops and does not replay on reconnect
(documented in `CLAUDE.md`'s environment-constraints section). It broke
twice in the 2026-08-09 session alone — once blocking
`mcp_dump_request.txt`, once blocking `mcp_restart.txt` — and the second
time needed Ken to fully quit and relaunch the whole Bitburner app, not
just reconnect, before it recovered. This is now the top priority because
it has cost real time twice in one day, not because it's newly noticed.

- [x] **Diagnose the port-12526 connect-then-drop.** Done 2026-08-10 — see
  `docs/remote-api-diagnosis-log.md` for the full trail. Root cause found
  and confirmed live (not just theorized): `cmd_serve` read commands from
  `sys.stdin.readline()`, and under a non-interactive stdin (no
  controlling TTY — how a tool-driven launch invokes it) that returns `''`
  immediately, which the old code treated as `quit` and tore the
  just-accepted connection down within ~1s. Reproduced against the actual
  pre-fix commit with a real client (`ping` failed at t+1.02s, clean
  `1000` close). Fixed: `serve` now only reads stdin commands on a real
  TTY, otherwise holds the connection and logs heartbeats; added a
  `watch` subcommand (no stdin dependency at all) for unattended live
  tests; added full connect/disconnect/message logging to stdout + a
  gitignored log file, since the old code logged nothing and that's what
  made this take so long to pin down. Verified: `selftest` still passes
  all seven checks; the fix was verified against a real (non-game) client
  holding a connection past the point the old code would have killed it.
  **Still not tested against the actual live game** — that's the next
  item below.
- [x] **Live-test the fix against the real game on port 12526.** Done
  2026-08-10, confirmed live: a `watch` window caught a real `CONNECTED`
  from the actual game process (`user-agent` shows `bitburner/3.0.1 ...
  Electron/41.4.0`, not a mock), held stable for 170s+ with no drop. The
  connect-then-drop bug is fixed, not just theorized-fixed. Full trail:
  `docs/remote-api-diagnosis-log.md`.
- [x] **Validate a full round trip.** Done 2026-08-10 12:26. The detached
  listener caught a real game connection and the combined round-trip
  script (connect → `pushFile` → `getFile` → compare → `getFileNames`, all
  in one continuous session using `tools/bb_remote.py`'s own
  `RemoteApiServer`/`BitburnerApi` classes) ran clean: push returned `OK`,
  the immediate read back matched the pushed content exactly
  (`ROUND TRIP MATCH`), and `getFileNames` listed the pushed file. This is
  a real, live, end-to-end round trip with no VS Code extension involved —
  the bar for "the direct connection actually works" is now met, not just
  "it connects." Full trail and one open scope question (home's file
  listing includes non-script repo cruft — venv, `.claude/`) in
  `docs/remote-api-diagnosis-log.md`.
- [x] **Design and build the replacement for the trigger-file mechanism.**
  Built 2026-08-10. `tools/bb_remote.py` gained four new subcommands:
  `restart`/`dump` (one-shot: push `mcp_restart.txt` directly via
  `pushFile`+`getFile`-readback, or fetch a file directly via `getFile`,
  bypassing `mcp_dump_request.txt`/tail-window/CDP entirely) and
  `daemon`/`ctl-status`/`ctl-restart`/`ctl-dump` (persistent process +
  local control channel — see the design-decision note right below this
  item for why this second layer exists). `mcp_supervisor.js` itself is
  **unchanged** — its poll loop still watches `mcp_restart.txt` for a
  content change; only how that content gets written changed. Full
  writeup: `docs/processes.md`'s "The trigger-file replacement" subsection
  under `tools/bb_remote.py`.
  - **Validated:** daemon+control-channel logic against an in-process mock
    game client (all paths: status while disconnected, status/restart/dump
    while connected, unknown-command error handling); the full CLI
    subprocess path (`daemon` run for real, `ctl-status`/`ctl-restart`/
    `ctl-dump` invoked as real subprocesses against it, correct behavior
    both connected and disconnected); `selftest` still passes all seven
    checks (no regression to the existing `push`/`get`/`list`/`delete`
    commands).
  - **Not yet validated:** the live game specifically exercising
    `restart`/`dump`/`ctl-*`. A detached `daemon` was started on port
    12526 (`nohup ... & disown`, confirmed reparented to launchd via
    `ps -o ppid`) and is still running as of end-of-session, but a 90s
    poll saw no Connect click during this session. **Needs one supervised
    click** — see `docs/kensTodo.md`. This is a live-validation gap, not a
    code-confidence gap: the mock+CLI coverage above exercises the exact
    same code paths (`TriggerDaemon`, `_ctl_call`, `RemoteApiServer`) that
    the earlier, already-live-confirmed `push`/`get`/`getFileNames` round
    trip used underneath.

  **Design decision, recorded so it isn't re-litigated:** the first cut of
  this (this same session) was one-shot `restart`/`dump` commands — same
  connect/act/disconnect pattern as the already-existing `push`/`get`.
  Ken flagged, before this was called done, that this re-triggers the
  exact fragile handshake path on every call, and that both failures
  motivating this whole migration (the extension's silently-dropped sync,
  and `tools/bb_remote.py`'s own now-fixed connect-then-drop bug) were
  connection-*stability* problems, not request-shape problems — so a
  process that reconnects per action and exits right after both re-risks
  the fragile step and destroys the evidence of a drop the moment it
  happens. **Chose:** kept the one-shot commands (useful for a single ad
  hoc call, and already built/tested) but added `daemon` as the
  recommended path — one persistent process holds the connection open for
  its whole life and logs every connect/disconnect to
  `tools/bb_remote_events.log` continuously; a local loopback control
  channel (`ctl-status`/`ctl-restart`/`ctl-dump`) lets each per-turn Bash
  call talk to the daemon instead of re-handshaking with the game. The
  daemon still can't force the game to auto-reconnect after a drop (the
  diagnosis log already established the game doesn't auto-reconnect
  regardless of "Reconnection delay") — that part of the friction is
  structural to the game's own Remote API, not something a daemon works
  around — but it removes the need to restart a *process* on Claude's side
  for the next reconnect to be picked up.

**Fact-check (2026-08-10, later): routine script *source* push is still NOT
migrated — do not read the checked-off items above as "VS Code extension no
longer needed."** Verified directly against `tools/bb_remote.py`'s current
code (not just its docstrings) plus `docs/processes.md`:

- Only two actions have moved off the extension: the `mcp_restart.txt`
  restart trigger (`restart`/`ctl-restart`) and read-only file dumps
  (`dump`/`ctl-dump`, via `getFile`).
- Ordinary source edits (`mcp.js`, anything under `hacking/` or `scripts/`,
  `mcp_logic.js`, etc.) still reach the running game **only** via the VS
  Code extension's file-sync watcher auto-pushing on save/write — exactly
  the CLAUDE.md "File sync auto-pushes" mechanism, unchanged.
- `tools/bb_remote.py` does already have a generic single-file push:
  `python3 tools/bb_remote.py push <remote_filename> <local_file>` (a
  live-validated `pushFile` call, not just a mock), and `TriggerDaemon`'s
  control-channel handler even has generic `"push"`/`"get"` cases coded in
  already — but there is **no `ctl-push`/`ctl-get` CLI subcommand** exposed
  (`build_parser()` only defines `ctl-status`/`ctl-restart`/`ctl-dump`), and
  nothing in this repo calls `push` automatically on a file change. It's a
  capability that exists, not a wired-up path.
- The module's own docstring says this outright: the restart/dump commands
  "are NOT meant to replace the VS Code extension's role for ongoing
  *source* file sync (mcp.js edits etc.) — that stays on the
  extension/port 12525 for now."
- They're also **mutually exclusive at the connection level**, not just
  by convention: the game's Options → Remote API panel holds one outbound
  connection to one hostname:port at a time, so while it's pointed at
  `bb_remote.py` (port 12526, for a restart/dump/push call) it is *not*
  simultaneously connected to the extension on 12525 — a manual switch in
  that panel is required either direction.

**Bottom line: if Ken stops using the VS Code Bitburner extension right
now, routine script edits Claude makes would silently stop reaching the
live game.** Only the restart trigger and diagnostic dumps would still
work.

**Candidate next step, not started:** wire a `ctl-push` CLI subcommand
(the daemon-side handler already supports `cmd: "push"`) and switch
Claude's own edit-then-deploy workflow to call it instead of relying on
the extension's watcher — that would need the Remote API panel pointed at
the daemon's port as the new steady state, which is itself a one-time
manual switch Ken would need to make. Worth doing if/when Ken wants to
drop the extension entirely; out of scope for a fact-finding pass, and not
started here.

Note on branch history: the task brief for this cleanup expected
`tools/bb_remote.py`'s branch to carry multiple commits from being resumed
several times. Checked directly — it has exactly one commit
(`e8a6794`, "Add direct Bitburner Remote API client, prototype for
dropping VS Code sync"). Worth knowing so the next session isn't surprised
by a git history that doesn't match that expectation; the multi-session
diagnosis work on the port-12526 drop itself doesn't appear to have been
committed anywhere before it was lost track of.

## Priority 2: process-backlog.md review

See `docs/process-backlog.md` directly — reviewed and updated 2026-08-10
with the VS Code dependency added as the new top item. Don't duplicate its
reasoning here; read it there.

## Loose ends carried from 2026-08-09

- [x] **XP-thrash fix restart confirmation.** Checked live over CDP on
  2026-08-10: the running `mcp.js` reports `ver ok`, meaning its stamped
  `scriptVersion` hash matches the current `mcp.js` on disk — and disk
  hasn't changed since commit `81814d6` (the XP-eviction fix) except for
  doc-only commits after it. **The fix is confirmed running live**, no
  further restart needed on this account.
- [ ] **`dnet_deploy.js --once` from `home`.** Still pending Ken — see
  `docs/kensTodo.md`. `dnet_probe.js` already validated the model-reading
  approach; this is the next real darknet step.
- [ ] **New, found live 2026-08-10, not diagnosed yet:** the CDP check for
  the item above also showed `mcp`'s HUD in a bad state — verdict
  `INVARIANT`, `inv 506` all attributed to `weakenBudgetNonNegative`,
  `money 0%`, `rate 0`, `avg 3`. Plan shown as `work/xp` (OBJECTIVE is
  currently `xp`). `next = current` (no target-switch thrash visible in
  this snapshot, so this looks unrelated to the eviction-thrash bug that
  was fixed). This wasn't chased further tonight per scope — worth a look
  next session: is `weakenBudgetNonNegative` firing legitimately (a real
  over-allocation) or is it noise given `ram 98%`/`18 hosts` are otherwise
  plausible-looking. `money 0%` + `rate 0` alongside 506 invariant hits
  suggests something is actually stuck, not just a noisy assertion.
- [ ] **Two more live-observed items, flagged but not chased this session
  (trigger-file work above was the priority):**
  1. A separate live check reported **~199 accumulated
     `weakenBudgetNonNegative` violations** — a different count than the
     `inv 506` snapshot immediately above, so either the counter reset
     between checks (a restart, which zeroes it) or this is a second,
     independent sighting. Either way, `weakenBudgetNonNegative` firing
     repeatedly across more than one session is worth a real look next
     time: same open question as above (legitimate over-allocation vs.
     noisy assertion), now with two independent data points instead of
     one.
  2. **`mcp.js`'s target-switching looked unusually thrashy**: switches on
     a ~60-190s cadence, often immediately followed by a "yield
     degraded... moving on" log line. Not yet diagnosed — worth checking
     whether this is the same class of eviction-thrash bug fixed in
     `81814d6` (money-degraded eviction chaining target-to-target) showing
     up in a different code path, or something new. `mcp_logic.js`'s
     `evaluateOpportunitySwitch`/`evaluateMoneyDegradation` and their
     `node --test` coverage in `mcp_logic.test.js` are the place to start
     — a synthetic test reproducing a 60-190s switch cadence would be far
     cheaper than another multi-restart live diagnosis.
- [ ] **Two worktree branches merged into main 2026-08-10** (status
  dashboard artifact, `tools/bb_remote.py` prototype) — both were clean
  except one conflict in `docs/processes.md` (both added a section in the
  same spot), resolved by keeping both sections. Nothing further needed
  here; noted so the merge isn't re-discovered as a surprise.
- [x] **Pure-function extraction for `node --test`** (the
  `process-backlog.md` "Still gold #6" item). `mcp_logic.js` now holds
  `evaluateMoneyDegradation`, `evaluateOpportunitySwitch`,
  `selectWorkWeights`/`getWorkWeightBucket`, and
  `computeTickInvariantChecks`; `mcp.js` imports it and calls into it for
  those decisions instead of computing them inline. `mcp_logic.test.js`
  covers all four with `node --test`, including a direct regression test
  for the `moneyDegraded`/XP-mode bug fixed in `81814d6`. Landed in git
  only — **not yet deployed/restarted live**, since that's a separate step
  (sync watcher needs to push `mcp_logic.js` too, then a normal restart).

## Workflow

- **Any future change to the logic in `mcp_logic.js` (or new logic worth
  extracting out of `mcp.js`) should get a `node --test` test added and run
  before being shipped.** Diagnosing the `moneyDegraded`/XP-mode eviction
  bug the night of 2026-08-09 required three separate live restarts and
  4-5 minutes each of watching the game over CDP, for a bug that a
  millisecond-scale unit test now catches directly — see
  `docs/processes.md`'s `mcp.js` section and `mcp_logic.test.js` for what
  that regression test actually looks like.
