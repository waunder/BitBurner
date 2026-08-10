# Ken's to-do

Actions that need a human hand. Claude cannot trigger the VS Code extension's
download command or click anything in-game — see `CLAUDE.md`. Checked items
stay here as a record of what's already done, not busywork to repeat.

Claude should keep this current: add an item the moment something needs
Ken's hand, and check it off once it's confirmed done — same rule as
`docs/processes.md`.

## Pending

- [ ] **One Connect click retires the VS Code extension entirely — point
  Options → Remote API at port `12526` and leave it there.** As of
  2026-08-10, `tools/bb_remote.py`'s `daemon` now handles *all* routine
  game sync, not just the restart/dump trigger: it pushes every live
  script/config file (`mcp.js`, everything under `hacking/` and `scripts/`,
  `mcp_config.json`, `mcp_hud.js`, the `dnet_*.js` set, etc. — 28 files,
  see `WATCHED_FILES` in `tools/bb_remote.py` or `docs/processes.md`)
  straight into the game itself, the same way the VS Code extension's file
  watcher used to. **This is the actual fix for the extension's core flaw**
  (silently drops and doesn't replay on reconnect, see `CLAUDE.md`): the
  daemon does a *full* push of every watched file's current content on
  every game connection — first connect or any reconnect after a drop —
  so a drop can never leave the game silently stale the way it did on
  2026-08-09.

  **What to do:** Options → Remote API → confirm Port reads `12526` →
  Connect. A fresh daemon (PID replacing the earlier one, same port) is
  already running, `nohup`'d so it survives independent of any Claude
  session — confirmed via `ps`/`lsof` reparented to launchd, and via a
  local `ctl-status` call reporting `sync_enabled: true`, `watched_files:
  28`, all 28 resolving with zero "missing" against the real repo tree.
  **Not yet confirmed against the live game** — no live `pushFile`/`getFile`
  round trip has happened since this session's changes; see
  `docs/claude-todo.md` for exactly what's validated (mock + real-file-path
  checks) vs. what still needs the live game (the actual round trip).

  **This time, do not switch back to port `12525` afterward.** The earlier
  version of this item said to flip back to `12525` to restore VS Code
  sync — that advice is now wrong and has been removed. The whole point of
  this change is that VS Code sync is no longer needed for anything, ever,
  once this click lands: routine edits, restarts, and dumps all go through
  the daemon on `12526` from here on. Options should simply stay pointed
  at `12526` permanently — there is no more "switch back" step, and no
  reason to reopen the VS Code Bitburner extension's sync again. (You can
  leave the extension installed; it just won't be doing anything anymore.)

- [ ] **Run `dnet_deploy.js --once` from `home`** — `dnet_probe.js` (below)
  validated the model reading, so this is the next step: the roaming
  self-replicating deployer, single pass. ~4.6GB. See
  `docs/darknet-strategy.md` for what it does; report back what it finds
  (hosts cracked, credentials gathered) so `docs/darknet-*.md` can be
  checked against real results rather than just the source reading.

## Done (kept for reference)

- [x] **VS Code file-sync dead push channel (blocked both
  `mcp_dump_request.txt` and `mcp_restart.txt` on 2026-08-09).** Recovered
  after Ken fully quit and relaunched the Bitburner app — not just a
  reconnect. Confirmed resolved 2026-08-10 via CDP: the running `mcp.js`
  now shows `ver ok`, meaning the sync did eventually push the XP-eviction
  fix (commit `81814d6`) and a restart did land it. **This is a recurring
  failure mode, not a one-time fix** — the same "dropped sync session
  doesn't replay on reconnect" pattern documented in `CLAUDE.md` caused two
  separate incidents in one day already, and nothing about this recovery
  changes the underlying mechanism. Expect it to happen again; the actual
  fix is replacing the extension's sync entirely (see
  `docs/claude-todo.md` priority 1), not this recovery step.

- [x] **Run `dnet_probe.js` from `home`.** Confirmed 2026-08-09: 1 darknet
  server visible (`darkweb`, model `ZeroLogon`, online/connected/session all
  true), and `authenticate("darkweb", "")` returned `success=true`. **The
  model-reading method is validated** — `docs/darknet-{functions,tactics,strategy}.md`,
  derived from reading the game's bundled source rather than from play, held
  up against a real attempt. `dnet_deploy.js --once` is next.

- [x] **Re-run `mcp_stocks.js`.** Confirmed live via CDP 2026-08-09: running
  as PID 371 alongside the rest of the suite, no crash in the terminal
  scrollback — the `has4SDataTixApi` fix held.

- [x] **Run `startup.js` once.** Confirmed 2026-08-09 — Ken ran it
  post-augmentation-install ("augments installed. restart run."); HUD
  reported `HEALTHY`/`OK` afterward with fresh (post-reset) telemetry.

- [x] **`mcp_events.txt` downloading correctly.** Confirmed 2026-08-08: three
  lines, valid JSON-lines, `startup` → `target_adopt` → `bucket_change`
  (`low`→`empty` at moneyPct 0.0608 — below the 0.08 hysteresis floor, as
  designed). The extension bug is fully closed; no pattern change was ever
  needed.

- [x] **Download pattern.** Confirmed set to
  `mcp_{status,status_log,target_state,events}.{json,txt,jsonl}` — correct
  as originally recommended. The missing `mcp_events.jsonl` turned out to be
  a code bug (invalid file extension), not a pattern problem; see Pending.

- [x] `run mcp_supervisor.js` — confirmed running (PID 119, 2026-08-08).
  Restarts no longer need a keystroke; Claude bumps `mcp_restart.txt` directly.
- [x] `run mcp_hud.js` — confirmed running and healthy (`OK`, `ver ok`,
  `inv 0`, 2026-08-08).
- [x] **Leftover `get_stats.js` processes.** `ps` confirmed a single instance
  (PID 914) alongside a single `mcp_hud.js` (PID 986) — the three stray
  copies from before the self-supersede fix are gone.
