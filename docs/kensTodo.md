# Ken's to-do

Actions that need a human hand. Claude cannot trigger the VS Code extension's
download command or click anything in-game — see `CLAUDE.md`. Checked items
stay here as a record of what's already done, not busywork to repeat.

Claude should keep this current: add an item the moment something needs
Ken's hand, and check it off once it's confirmed done — same rule as
`docs/processes.md`.

## Pending

- [ ] **Re-download once mcp has restarted with the `mcp_events.txt` fix.**
  Ken correctly set the pattern to
  `mcp_{status,status_log,target_state,events}.{json,txt,jsonl}` and it never
  matched anything — not a pattern problem. The event file was named
  `mcp_events.jsonl`, and Bitburner's `ns.write` only accepts `.txt`/`.json`/
  `.css`/a script extension, so every write to it threw "File path should be
  a text file or script" from the moment it shipped, caught silently by a
  try/catch and printed only to a channel nobody reads. The file never
  existed in the game. Fixed by renaming it to `mcp_events.txt` — the
  pattern above already covers `.txt`, so **nothing about the pattern needs
  to change**, just download again after the next restart.

## Done (kept for reference)

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
