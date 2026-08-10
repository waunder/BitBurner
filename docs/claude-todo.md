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
- [ ] **Live-test the fix against the real game on port 12526.** Ask Ken
  to open Options → Remote API, set port to `12526`, click Connect, while
  `tools/bb_remote.py watch --port 12526 --duration 180` is running and
  being actively read from `tools/bb_remote_events.log`. If the connection
  now holds (expected, given the fix reproduces and resolves the bug found
  above), proceed straight to the round-trip item below in the same
  session. If it still drops, the new logging will show close_code/
  close_reason/exception this time instead of nothing.
- [ ] **Validate a full round trip once the drop is fixed.** Push one real
  file through `tools/bb_remote.py`, confirm it actually lands in the game
  (read it back, or dump/tail it), without touching the VS Code extension
  at all. This is the bar for "the direct connection actually works," not
  just "it connects."
- [ ] **Design and build the replacement for the trigger-file mechanism.**
  `mcp_restart.txt` and `mcp_dump_request.txt` are currently the only
  remote-trigger channel into the game (`mcp_supervisor.js` polls them).
  Once the direct connection round-trips reliably, design what replaces
  that polling — likely `tools/bb_remote.py` (or a wrapper around it)
  calling `pushFile`/`getFile` directly instead of writing a file and
  waiting for the extension to sync it. Don't start this until the round
  trip above is confirmed; building on an unconfirmed transport just moves
  the unknown one layer up.

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
- [ ] **Two worktree branches merged into main 2026-08-10** (status
  dashboard artifact, `tools/bb_remote.py` prototype) — both were clean
  except one conflict in `docs/processes.md` (both added a section in the
  same spot), resolved by keeping both sections. Nothing further needed
  here; noted so the merge isn't re-discovered as a surprise.
