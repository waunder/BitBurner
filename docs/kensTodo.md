# Ken's to-do

Actions that need a human hand. Claude cannot trigger the VS Code extension's
download command or click anything in-game — see `CLAUDE.md`. Checked items
stay here as a record of what's already done, not busywork to repeat.

Claude should keep this current: add an item the moment something needs
Ken's hand, and check it off once it's confirmed done — same rule as
`docs/processes.md`.

## Pending

- [ ] **Check the VS Code Bitburner file-sync connection — now confirmed to
  also block `mcp_restart.txt`, not just dumps.** During the 2026-08-09
  XP-mode/invariant diagnosis session, five separate writes to
  `mcp_dump_request.txt` (with fresh tokens, one `touch`-forced) over ~1
  minute never reached the game. In the follow-up session implementing the
  approved XP-eviction fix, the same day, two fresh-token writes to
  `mcp_restart.txt` (~90s apart, ~2.5 minutes of polling total) also never
  reached it: `mcp_supervisor.js` prints `mcp_supervisor: restart requested
  (token=...)` via `ns.tprint` the instant it sees a changed token (2s poll
  loop), and that line never appeared. Confirmed independently via `ps`:
  `mcp.js` stayed on PID 4 and `mcp_supervisor.js` on PID 2 for the entire
  session — if the restart had fired, `restart_mcp.js` would have killed and
  re-exec'd `mcp.js` under a new PID. **Practical effect: Claude cannot
  currently restart `mcp.js` at all**, only edit its source and commit/push
  — a running instance keeps its old code indefinitely until something else
  restarts it. The game was otherwise live (HUD ticking, `mcp.js` actively
  switching targets), so this isn't a frozen game, just a dead push channel
  — matches the "dropped sync session doesn't replay" failure mode CLAUDE.md
  already documents. A reconnect or manual save in the editor should restore
  it (same fix as documented). **Concretely needed now:** reconnect the
  sync, then either save any file in the editor or ask Claude to re-touch
  `mcp_restart.txt` — the 2026-08-09 XP-eviction fix (see git log) is
  committed and pushed but has never actually run in-game because of this.

- [ ] **Run `dnet_deploy.js --once` from `home`** — `dnet_probe.js` (below)
  validated the model reading, so this is the next step: the roaming
  self-replicating deployer, single pass. ~4.6GB. See
  `docs/darknet-strategy.md` for what it does; report back what it finds
  (hosts cracked, credentials gathered) so `docs/darknet-*.md` can be
  checked against real results rather than just the source reading.

## Done (kept for reference)

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
