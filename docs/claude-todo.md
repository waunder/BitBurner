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

- [ ] **Resume diagnosing the port-12526 connect-then-drop.** A prototype
  direct client (`tools/bb_remote.py`, now merged to main —
  `docs/remote-api-migration.md` has the full protocol writeup) was pointed
  at port 12526 (chosen so it wouldn't disturb the real sync, which stays
  on 12525) for a live test. It connected, then dropped back to offline.
  **Root cause is genuinely unknown** — nothing beyond "connects, then
  drops" was established before the session ended. Start from scratch:
  check `tools/bb_remote.py`'s own logging/error handling around the
  disconnect, check what the game's Options → Remote API status field
  shows at the moment it drops, check whether it's a timeout, a protocol
  mismatch on some message the self-test's mock never exercised, or
  something else entirely.
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
