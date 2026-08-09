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

- [ ] **Re-run `mcp_stocks.js`** — the first run (2026-08-09) crashed with a
  runtime error: the watchlist section checked the wrong 4S access flag
  (`has4SData` instead of `has4SDataTixApi`, two genuinely separate
  purchases) and threw calling `getForecast`, which also hid your position
  from that run since the crash discarded the whole panel's output before
  it reached the terminal. Fixed — `run mcp_stocks.js` again (optional
  `x= y= w= h=`, same as the other panels) and it should now show
  `wse/tix yes/yes`, `4S tix locked`, and your actual position under
  `positions`/`long value` rather than erroring out.

## Done (kept for reference)

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
