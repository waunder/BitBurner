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

**Fact-check (2026-08-10, mid-session): routine script *source* push was
NOT yet migrated at that point** — only the `mcp_restart.txt` restart
trigger and read-only file dumps had moved off the extension; ordinary
source edits still reached the game only via the VS Code extension's
file-sync watcher, and `tools/bb_remote.py`'s own docstring said so
outright. **Superseded by the item directly below — this gap is now
closed in code, pending one live confirmation.**

- [x] **Wire up routine script sync and retire the VS Code extension
  dependency entirely.** Done 2026-08-10, same session, triggered directly
  by Ken hitting the exact failure this was warning about: reconnecting
  the extension on port 12525 dropped the daemon's connection on 12526
  outright (`close_code=1005`), proving live — not just by protocol
  reading — that the game holds exactly one outbound Remote API connection
  no matter which port is configured, so the "keep both" design this
  fact-check flagged was never actually viable. Ken approved the fix
  directly ("concur with the recommendation. Let's implement the fix.").
  - `TriggerDaemon` now pushes `WATCHED_FILES` (28 files — every live
    script/config, mirrors `docs/processes.md`'s map) via two triggers:
    a **full** resync of every watched file's current on-disk content on
    every game (re)connection (closes the exact "doesn't replay on
    reconnect" flaw `CLAUDE.md` documents against the extension), plus an
    **incremental** only-changed push every 2s while connected.
  - New CLI: `ctl-push`/`ctl-get` (the generic control-channel handlers,
    already coded, now exposed as subcommands — the exact gap this
    fact-check flagged) and `ctl-resync` (force a full pass on demand).
    `daemon --no-sync` disables the new behavior for isolating a
    regression.
  - **Port decision: daemon stays on 12526, Options gets pointed there
    once and left there — does not take over 12525.** Reasoning: 12525 is
    held by the extension's own background listener the whole time VS
    Code is open with it active, so taking that port over would need Ken
    to quit/disable the extension first (a real, less-familiar manual
    step) instead of a one-time Options field change (which he's already
    done several times today, and which persists across sessions the same
    way either port choice would). Full reasoning in
    `docs/processes.md`'s `tools/bb_remote.py` section.
  - **Validated:** `selftest` extended with direct coverage of the new
    sync logic (full resync pushes present files under their
    leading-slash remote name, correctly skips-and-reports a missing file
    without raising, incremental resync no-ops when nothing changed and
    pushes only the one file that did) — all pass against the in-process
    mock. A real `daemon` subprocess (scratch ports) answered
    `ctl-status`/`ctl-resync`/`ctl-push` correctly while disconnected, and
    that same run confirmed **all 28 `WATCHED_FILES` entries resolve
    against the real repo tree with zero "missing."** A fresh daemon
    (replacing the earlier restart/dump-only process, same port 12526) is
    running now, reparented to launchd, waiting for a connection.
  - **Validated live 2026-08-11.** Ken connected (Options → Remote API →
    `12526`) with his own extension, no VS Code involved. `tools/bb_remote_events.log`
    at 09:38:55: real game user-agent (`bitburner/3.0.1 ... Electron/41.4.0`)
    connected, daemon ran its full-resync pass, `SYNC: full resync done —
    pushed 28, failed 0, missing 0`. Every one of the 28 `WATCHED_FILES`
    landed in the game. This is the live confirmation this item was
    waiting on — not mock/subprocess coverage, an actual round trip against
    the real game.

**Bottom line, updated 2026-08-11:** the disk → game direction is now fully
proven live, not just built. The game → disk direction (see item directly
below) is now also built and mock/subprocess-validated, same session — but
**not yet proven live**, since the daemon actually holding the game
connection right now predates this code. This priority isn't fully closed
until a live pull round trip is confirmed the same way the push side was.

### New gap found 2026-08-11: game → disk direction still has no automated path

Retiring VS Code was framed as one migration, but it's really two
directions, and only one is done:

- **disk → game (push):** done, live-confirmed above.
- **game → disk (pull):** `mcp_status.json`, `mcp_status_log.txt`,
  `mcp_target_state.json`, `mcp_events.txt` are generated *by the game* and
  need to land back on local disk for the parser/dashboard to read fresh
  numbers. Previously this was the VS Code extension's "Download Files
  Matching Pattern…" command — deliberately excluded from `WATCHED_FILES`
  in `tools/bb_remote.py` (pushing them back would overwrite live game
  state with a stale local copy, see the comment at the top of that list).
  `tools/bb_remote.py` already has the primitive this needs —
  `get_file`/`cmd_dump`/`ctl-dump`/`ctl-get` all call the same `getFile` RPC
  that the original push/pull round-trip test proved works live — but
  every one of those just `print()`s the result to stdout or returns it
  over the control socket. **None of them write the result to a local
  file.** So even the on-demand path doesn't close the loop today; a caller
  would have to redirect the output itself, and nothing in the repo does.
  On disk right now: `mcp_status.json` is still dated 2026-08-08 14:40 —
  three days stale — even though the daemon has been connected and syncing
  successfully since this morning, which confirms the gap is real, not
  theoretical.

  - [x] **Built 2026-08-11, same session as this gap was found.** Chose the
    "extend the daemon" design (option 1 from the recommendation below,
    folded into `ctl-pull` from option 2 as the on-demand escape hatch) —
    mirrors the push side's own structure exactly rather than inventing a
    new shape: `TriggerDaemon` gained `PULL_FILES` (the same four files:
    `mcp_status.json`, `mcp_status_log.txt`, `mcp_target_state.json`,
    `mcp_events.txt`), a `_pull(full)` method paralleling `_resync(full)`,
    and a `pull_poll_loop` paralleling `sync_poll_loop`. The existing
    `on_connect` hook now runs a full pull right after its full push
    resync, so a (re)connect refreshes both directions in one pass; an
    incremental pull runs every `PULL_POLL_S` (2s, same cadence as the push
    side) while connected, writing to disk only the files whose fetched
    content actually changed. New CLI: `ctl-pull` (force an immediate full
    pull, the exact analog of `ctl-resync`) and `daemon --no-pull`
    (disables the pull half independently of `--no-sync`). A `getFile` on
    a remote file that doesn't exist yet is caught per-file into `missing`
    and never raises — the same skip-and-report contract the push side
    already has for a file missing on local disk. Full design write-up:
    `docs/processes.md`'s new "Game -> disk pull" subsection under
    `tools/bb_remote.py`.
    - **Validated:** `selftest` extended with direct coverage of the pull
      logic (full pull writes correct content to the right local path; a
      missing remote file is skipped-and-reported without raising;
      incremental pull no-ops when the game side's content is unchanged;
      incremental pull writes only the one file that did change) — all
      pass against the in-process mock, alongside every pre-existing check
      (24/24 total). A real `daemon` subprocess on scratch ports
      (31526/31527, not the live 12526/12527 — the real daemon was left
      completely untouched per this task's constraint) answered
      `ctl-status`/`ctl-pull` correctly while disconnected: `ctl-status`
      reported `pull_enabled: true`/`pull_files: 4`, `ctl-pull` reported
      all four files as `missing` (each `getFile` correctly raised "Not
      connected to Bitburner", caught per-file, no crash) — the pull-side
      equivalent of the disconnected-state check the push feature was
      validated with.
    - **Not validated:** the live game actually round-tripping this —
      no real `getFile` call has written a real `mcp_status.json` (etc.)
      to disk under this code yet. The daemon actually connected to the
      game right now on port 12526 predates this change (it's the same
      process from the earlier push-sync work, left running and untouched
      per this task's constraints), so it's still running the old code
      without the pull loop. This needs that process restarted with the
      current code, then either the game's next natural reconnect or one
      fresh Connect click — **not a Ken-specific action**, since Claude can
      do the restart and then watch `tools/bb_remote_events.log` for the
      next reconnect itself in a later session; noted here rather than
      added to `docs/kensTodo.md`.
  - Until the live confirmation above happens, getting current numbers
    onto disk **also** still works via **either** the VS Code extension's
    one-off download command **or** a CDP read (`mcp_dump_request.txt` →
    `mcp_dump` tail window, see `docs/processes.md`) — both still work,
    neither requires reopening the extension's file-sync watcher
    specifically, and neither is removed by this change.

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

## 2026-08-11: repo move broke daemon sync silently; fixed with tests

- [x] **Found and fixed the `REPO_ROOT`-frozen-at-import bug** that broke
  `tools/bb_remote.py`'s daemon's auto-sync (both directions) for ~2 hours
  after this session's repo relocation, silently. Root cause, fix, and the
  8 new selftest checks covering it are written up in full in
  `docs/processes.md`'s `tools/bb_remote.py` section (search "silent,
  hours-long sync outage"). Applied the 2026-08-07 audit's "assert on the
  code's own intentions" principle to the Python/tooling side for the first
  time — a loud `sync_root_alarm`/`pull_root_alarm` now surfaces via
  `ctl-status` instead of a rate-limited log line nobody's tailing.
  **Not yet deployed to the live daemon** — the fix only takes effect on
  the next process restart, which still needs a reconnect (manual click or
  the CDP-auto-reconnect work, still not built). Ordinary file pushes in
  the meantime should use `ctl-push` directly (bypasses the cached root
  entirely) rather than relying on the broken auto-sync until that restart
  happens.
- [x] **`hacking/backdoor.js` needs Source-File 4** — confirmed live,
  uncaught `RUNTIME ERROR` modal, before Ken had SF4. Added a guard
  (`hasSourceFile4`, checks `ns.getResetInfo().ownedSF` — never gated) that
  prints one clear line instead. Added `hacking/findpath.js` (BFS over
  `ns.scan`, never gated either) to print the connect-chain to type by
  hand. **Confirmed working this way live**: typed the real chain +
  `backdoor` for `I.I.I.I` via Claude's terminal-write path — The Black
  Hand now shows under Ken's joined factions.

## Workflow

- **Any future change to the logic in `mcp_logic.js` (or new logic worth
  extracting out of `mcp.js`) should get a `node --test` test added and run
  before being shipped.** Diagnosing the `moneyDegraded`/XP-mode eviction
  bug the night of 2026-08-09 required three separate live restarts and
  4-5 minutes each of watching the game over CDP, for a bug that a
  millisecond-scale unit test now catches directly — see
  `docs/processes.md`'s `mcp.js` section and `mcp_logic.test.js` for what
  that regression test actually looks like.
