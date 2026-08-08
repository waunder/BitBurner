# Ken's to-do

Actions that need a human hand. Claude cannot trigger the VS Code extension's
download command or click anything in-game — see `CLAUDE.md`. Checked items
stay here as a record of what's already done, not busywork to repeat.

Claude should keep this current: add an item the moment something needs
Ken's hand, and check it off once it's confirmed done — same rule as
`docs/processes.md`.

## Pending

- [ ] **Update the "Download Files Matching Pattern…" pattern.** Currently
  `mcp_*.{json,txt}`, which misses the new `mcp_events.jsonl` (added
  2026-08-08). Change it to:

  ```
  mcp_{status,status_log,target_state,events}.{json,txt,jsonl}
  ```

  Verified against every current `mcp_*` filename with real `minimatch`: it
  catches the four generated files (`mcp_status.json`, `mcp_status_log.txt`,
  `mcp_target_state.json`, `mcp_events.jsonl`) and **excludes
  `mcp_config.json`** on purpose — that file is now hand-authored and
  committed, not generated output, so pulling it down could overwrite a local
  edit with a stale in-game copy exactly the way bulk source downloads have
  before (see `CLAUDE.md`). It also skips every `.js` source file, avoiding
  the `mcp_status*` trap that used to catch `mcp_status.js`. The extension
  remembers the last pattern, so this is a one-time change.

## Done (kept for reference)

- [x] `run mcp_supervisor.js` — confirmed running (PID 119, 2026-08-08).
  Restarts no longer need a keystroke; Claude bumps `mcp_restart.txt` directly.
- [x] `run mcp_hud.js` — confirmed running and healthy (`OK`, `ver ok`,
  `inv 0`, 2026-08-08).
- [x] **Leftover `get_stats.js` processes.** `ps` confirmed a single instance
  (PID 914) alongside a single `mcp_hud.js` (PID 986) — the three stray
  copies from before the self-supersede fix are gone.
