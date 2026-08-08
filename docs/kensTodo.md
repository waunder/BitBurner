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

- [ ] **Check `ps` for leftover `get_stats.js` processes and kill any but
  one.** Before the self-supersede fix (commit `577061c`), three separate
  copies were running (PIDs 4, 522, 601) — killing only shows up in `ns.ps`,
  which Claude can't read directly over CDP, only tail windows that happen
  to be open. A single `run get_stats.js` now supersedes any prior copy, so
  running it once is enough, but it's worth confirming with `ps` on the
  terminal that only one is left — two idle copies each hold RAM that would
  otherwise go to workers.

## Done (kept for reference)

- [x] `run mcp_supervisor.js` — confirmed running (PID 119, 2026-08-08).
  Restarts no longer need a keystroke; Claude bumps `mcp_restart.txt` directly.
- [x] `run mcp_hud.js` — confirmed running and healthy (`OK`, `ver ok`,
  `inv 0`, 2026-08-08).
