# Ken's to-do

Actions that need a human hand. Claude cannot trigger the VS Code extension's
download command or click anything in-game — see `CLAUDE.md`. Checked items
stay here as a record of what's already done, not busywork to repeat.

Claude should keep this current: add an item the moment something needs
Ken's hand, and check it off once it's confirmed done — same rule as
`docs/processes.md`.

## Pending

- [ ] **Trigger-file replacement daemon is running and waiting — one
  Connect click confirms it.** A persistent `tools/bb_remote.py daemon`
  process is already running (started 2026-08-10, `nohup`'d so it survives
  independent of any Claude session) and listening on port `12526` — the
  same port used for the earlier general round-trip test, so no new setup
  is needed. It replaces `mcp_restart.txt`/`mcp_dump_request.txt`'s
  dependence on the VS Code extension's file sync, which dropped silently
  twice on 2026-08-09. When convenient: **Options → Remote API → confirm
  Port reads `12526` → Connect.** Nothing else needs clicking — the daemon
  picks the connection up immediately and stays connected (no re-click
  needed for follow-up restarts/dumps this session). Once confirmed
  working, switch the port back to `12525` and Connect again to restore
  the normal VS Code sync for ongoing source-file edits (same reversible
  action as always) — Claude will ask again next time the direct channel
  is needed. See `docs/claude-todo.md` priority 1 and
  `docs/processes.md`'s `tools/bb_remote.py` section for what this
  confirms.

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
