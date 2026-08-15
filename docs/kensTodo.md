# Ken's to-do

Only actions that genuinely need Ken's hand belong here. The Remote API now
handles routine source sync and telemetry pull; an in-game click, a connector
reopen, or a Tier 3 scope decision still belongs here when actually needed.
Checked items stay as history, not busywork to repeat.

Codex keeps this current: add an item the moment something really needs Ken's
hand and check it off once confirmed—same rule as `docs/processes.md`.

## Pending

- [x] **No governance-audit game action is presently requested.** The core MCP
  baseline may continue. Stock, IPvGO, Darknet, faction share, and another R8
  live run remain narrow holds in `docs/promotion-state.json`; a hold is not a
  task for Ken to remember or execute.

- [x] **Superseded: do not start the balanced faction-sharing allocation.**
  The earlier `run share_deploy.js` request is cancelled after the stability/
  loop incident. Re-enable is a separate Tier 3 decision after containment.

- [x] **Reconnect Bitburner to the Remote API on port 12526.** Confirmed
  2026-08-14: all 43 then-current watched files synced, the remotely-triggered clean swarm
  restart succeeded, and the new crawler/phishing behavior is live.

- [x] **Provide a way to restart the Dark Net swarm without another in-game
  command.** Done 2026-08-14: `restart_mcp.js --darknet` delegates cleanup and
  relaunch to `dnet_killswarm.js --restart`. Once Remote API reconnects Codex
  can push that trigger through the already-running supervisor.

- [x] **Reconnect Bitburner to the Remote API daemon on port 12526.**
  Confirmed 2026-08-14 via `tools/bb_remote.py ctl-status`: connected with
  no sync or pull alarms. A forced resync pushed all 40 watched files and a
  forced pull fetched all 7 telemetry files, with zero failures or missing
  files in either direction.

- [x] **Pull `origin/main` into the actual synced checkout at
  `/Users/Shared/BitBurner`.** Done — fast-forwarded `bd527fb..09062a6`,
  bringing in the darknet status-file clobbering fix. `node --test
  *.test.js` (85/85) and `python3 tools/bb_remote.py selftest` both clean
  in that checkout afterward.
- [x] **`dnet_status_merge.js` synced after a daemon restart.** Confirmed
  via `ctl-get`, daemon reparented to `launchd` (PID 81582), `watched_files`
  36/36 synced.
- [x] **Darknet swarm restarted and the status-file clobbering bug
  confirmed fixed, live.** Ken ran `dnet_killswarm.js` →
  `dnet_deploy.js` → `dnet_status_merge.js` → `dnet_creds_merge.js` →
  `dnet_loot_merge.js`. Pulled `dnet_status.json` twice, 8 seconds apart:
  `deployer`/`credsMerge` (586 cracked)/`loot` (71 hosts) all present both
  times, `deployer.pass` climbed 200→201 in between — the swarm kept
  heartbeating through the window without erasing anything. That's the
  actual regression test, not a one-off snapshot. **Bug confirmed fixed.**
- [x] **Superseded by the current Darknet hold: no Phase 3b live check is
  requested.** Historical task was to confirm the loot fix and check
  `dnet_status.json`'s `deployer.*.lootMode`; the implementation history is
  retained in `docs/claude-todo.md` and the Darknet plans, not as a launch ask.
- [x] **Pull `origin/main` into the actual synced checkout at
  `/Users/Shared/BitBurner`.** Done — plain `git pull`, fast-forwarded
  `001e504..d2e3ae3` (brought in `c33c13f`'s `NUM_SIMULATIONS` 1500→6000
  and algorithm tag v1→v2, plus the follow-up commit documenting the
  worktree/checkout sync gap itself). Confirmed live via `ctl-get
  /ipvgo_player.js`: the game's own copy now contains
  `NUM_SIMULATIONS = 6000` and `"mcts-ucb1-v2"`. Still needs one
  `run ipvgo_player.js` in the live terminal to actually take effect
  (Bitburner doesn't hot-reload) — same standing step as every prior
  algorithm change today.
- [x] **Restart the `tools/bb_remote.py daemon` process.** Done earlier
  this session — old process (PID 44858, pre-dating this session's
  `WATCHED_FILES` additions) killed and replaced with a fresh one,
  confirmed reparented to `launchd`/PID 1 so it survives independent of
  any one session. `ctl-status` has shown `"connected": true` with no
  repeated `DISCONNECTED` lines for hours since. The underlying
  `mcp_status_log.txt`-size crash-loop this item was originally about is
  resolved as a side effect (new process runs the current code, which
  already has the 20MB message-size fix).

## Done (kept for reference)

- [x] **Ran `dnet_deploy.js --once` from `home`** — confirmed by Ken
  2026-08-11. Results (hosts cracked, credentials in `dnet_creds.txt`) live
  only in the game's filesystem right now — `bb_remote.py`'s daemon was
  disconnected at the time (last connect dropped 10:24:43, `close_code=1006`)
  and has no pull-side sync yet (that gap is being closed right now, see
  `docs/claude-todo.md`), so Claude cannot read the actual output yet. Will
  report back what it found against `docs/darknet-*.md` as soon as either
  the pull mechanism ships and the game reconnects, or a manual download
  happens — no action needed from Ken for this specifically.

- [x] **`git push origin main` — landed 2026-08-11 (`29f63b2`).** The
  Cowork-session block noted below no longer applies: this session runs via
  Claude Code CLI directly on your Mac (repo also relocated
  `~/Documents/BitBurner` → `/Users/Shared/BitBurner` the same session, same
  volume, no disruption to the live daemon connection), so the real SSH
  agent was available and push just worked, no hand-off needed.
- [x] **One Connect click retired the VS Code extension's push side —
  confirmed live 2026-08-11.** `tools/bb_remote_events.log` shows the real
  game (`bitburner/3.0.1 ... Electron/41.4.0`) connecting to the daemon on
  port `12526` at 09:38:55 and triggering a full resync: **pushed 28,
  failed 0, missing 0**, all 28 `WATCHED_FILES` landed. This is the actual
  live round trip that was the one open gap as of 2026-08-10 — no longer
  theoretical. Routine script edits, restarts, and dumps all go through the
  daemon now; **Options should stay pointed at `12526` permanently, no
  "switch back" step.**
  - **Correction to the retired advice above:** it's not quite true yet
    that "the extension just won't be doing anything anymore." The daemon
    only covers the **disk → game** direction (source pushes). The
    **game → disk** direction — pulling `mcp_status.json`,
    `mcp_status_log.txt`, `mcp_target_state.json`, `mcp_events.txt` back
    out so the dashboard/parser can read fresh numbers — still has no
    automated path; historically that was the VS Code extension's
    "Download Files Matching Pattern…" command. Found 2026-08-11: this is
    a genuinely open gap, not just an unconfirmed one — see
    `docs/claude-todo.md` for the recommended fix (extend the daemon with
    a pull loop using the same `getFile` RPC the round-trip test already
    proved works). Until that's built, either that one VS Code download
    command or a fresh CDP read is still the only way to get current
    numbers onto disk — this doesn't require reopening the sync watcher,
    just the one-off download command.

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

- [x] **No Ken action: stock trader is quarantined pending a future explicit
  capital-deployment decision.** Do not resync, run, or add
  `mcp_stock_trader.js` to the daemon's watched files; the control ledger owns
  this hold so Ken does not have to remember it as a task.
- [x] **Leftover `get_stats.js` processes.** `ps` confirmed a single instance
  (PID 914) alongside a single `mcp_hud.js` (PID 986) — the three stray
  copies from before the self-supersede fix are gone.
