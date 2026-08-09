# Ken's to-do

Actions that need a human hand. Claude cannot trigger the VS Code extension's
download command or click anything in-game — see `CLAUDE.md`. Checked items
stay here as a record of what's already done, not busywork to repeat.

Claude should keep this current: add an item the moment something needs
Ken's hand, and check it off once it's confirmed done — same rule as
`docs/processes.md`.

## Pending

- [ ] **Run `dnet_probe.js` from `home`** — the darknet work is entirely
  blocked on this one click. It is ~2.3GB, already committed and
  syntax-checked, and it mutates almost nothing: it probes, prints each
  neighbour's details, and attempts exactly one `authenticate("darkweb", "")`.
  Everything in `docs/darknet-{functions,tactics,strategy}.md` is derived from
  reading the game's bundled source rather than from play, and this run is the
  cheapest possible test of whether that reading is trustworthy. **If
  `authenticate("darkweb","")` succeeds, the method is validated and
  `dnet_deploy.js --once` is the next step. If it fails, stop and say so —
  do not run the deployer**, because it would mean the model rules are misread.
  Output goes to the terminal via `ns.tprint`, so it's readable over CDP
  without a tail window. (If it turns out this has already been run, the
  output is what's needed — the result matters more than a fresh run.)

- [ ] **Run `startup.js` once** — this single action now covers both of what
  were two separate pending items: it kills the currently-running
  `mcp_supervisor.js` (which is still on the pre-dump-feature code, since
  Bitburner doesn't hot-reload) and launches a fresh copy from the current
  file on disk, alongside `hacking/crawler.js`, `mcp.js`, `mcp_hud.js`, and
  `get_stats.js`. **Not yet run in the real game** — reasoned through and
  RAM-verified against the game's own cost table (including `ns.killall`'s
  `safetyGuard` behavior, checked against the actual implementation, not
  just the doc text), but unconfirmed end to end. It reports per-script
  outcome, so a failure (almost certainly insufficient home RAM) will be
  visible rather than silent.

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
