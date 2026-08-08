# Ken's to-do

Actions that need a human hand. Claude cannot trigger the VS Code extension's
download command or click anything in-game — see `CLAUDE.md`. Checked items
stay here as a record of what's already done, not busywork to repeat.

Claude should keep this current: add an item the moment something needs
Ken's hand, and check it off once it's confirmed done — same rule as
`docs/processes.md`.

## Pending

- [ ] **Restart `mcp_supervisor.js` once** to pick up the new file-dump
  feature and self-supersede fix. `run mcp_supervisor.js` again is now safe
  on its own (it kills any prior copy of itself first). Bitburner doesn't
  hot-reload, and the supervisor is the thing that provides remote restarts
  for everything else — it can't bootstrap itself, so this one genuinely
  needs a human hand, same as its original launch.

- [ ] **Try `startup.js` once, from a clean state, to confirm it actually
  works end to end** — not yet run in the real game, only reasoned through
  and RAM-verified against the game's own cost table. `killall` then
  `run startup.js` should bring up `mcp_supervisor.js`, `hacking/crawler.js`,
  `mcp.js`, `mcp_hud.js`, and `get_stats.js` in one shot, reporting which of
  the five started, which were already running, and which failed (almost
  certainly insufficient home RAM if so — it reports that explicitly rather
  than failing silently). This is the "killall, start, know I'm clean"
  workflow.

## Done (kept for reference)

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
