# Ken's to-do

Only actions that genuinely need Ken's hand belong here. The Remote API now
handles routine source sync and telemetry pull; an in-game click, a connector
reopen, or one of the stop-list items in `AGENTS.md` still belongs here when
actually needed. Checked items stay as history, not busywork to repeat.

Codex keeps this current: add an item the moment something really needs Ken's
hand and check it off once confirmed—same rule as `docs/processes.md`.

## Pending

- [ ] **One-time bootstrap: paste `sync_from_github.js` into the browser
  save's Script Editor — 2026-09-04.** The real fix for "the browser can't
  use the Remote API" (root-caused below): the repo is now public, and
  `sync_from_github.js` pulls every current file straight from GitHub via
  `ns.wget` (0GB, confirmed real function) — no browser automation, no
  remembering the clipboard-paste dance. This one script is the *only*
  thing that ever needs manual pasting; every future update, including to
  this script itself, comes through running it again. Steps:
  1. In the browser save's terminal: `nano sync_from_github.js` (creates it
     if new).
  2. Paste the full contents of `sync_from_github.js` from this repo, save.
  3. `run sync_from_github.js` — pulls everything `sync_manifest.json`
     lists. Watch the tail/terminal for a `done — N/N pulled` line; if
     anything's in the FAILED list, check `sync_from_github_status.json`.
  4. From then on, whenever you want the browser save current: just
     `run sync_from_github.js` again (no re-paste needed unless this
     script's own source changes — I'll flag that here if it ever does).
  **Not yet live-verified** (per `CLAUDE.md`): `ns.wget`'s real-world
  success rate across ~80 sequential fetches is unconfirmed. First run is
  the actual test — let me know what happens either way.

- [x] **Root-caused why the browser can't connect to Remote API — done 2026-09-03.
  Two real bugs fixed; the actual blocker turns out to be outside our
  control.**
  1. **Fixed:** `remote_api_monitor.sh`'s `daemon_healthy()` required
     `PID_FILE` to hold the exact PID of a live process before even trying
     the control port. Once that file drifted to a doomed clone (spawned
     because the real daemon already held the port under an untracked
     PID), the monitor was stuck spawning-and-losing-track-of a fresh
     clone every ~60s forever — the "address already in use" spam — while
     a real, working daemon sat there the whole time, invisible to its own
     monitor. `daemon_healthy()` now checks control-port reachability
     directly; `start_daemon()` now verifies the daemon actually became
     reachable before declaring success instead of trusting the PID
     blindly.
  2. **Fixed but not sufficient alone:** added the
     `Access-Control-Allow-Private-Network: true` header to the daemon's
     WebSocket handshake response, for Chrome's Private Network Access
     policy. Real fix, but Chrome enforces PNA for WebSocket entirely
     client-side — the daemon's log showed *zero* trace of the browser's
     connection attempts even after this fix, confirming Chrome blocks it
     before ever asking the server.
  3. **The actual, unfixable-from-our-side blocker:** confirmed via a
     differential test (a page served from `localhost` connects to the
     daemon instantly; the identical code from
     `https://bitburner-official.github.io` gets silently blocked, same
     browser/profile/daemon) that this is genuinely Chrome's Private
     Network Access policy rejecting a public origin reaching `localhost`.
     Also confirmed it's not `claude-in-chrome`'s extension interfering —
     you reproduced the identical failure yourself, in a completely
     separate, non-automated tab. The real fix needs Bitburner's own
     hosting to send a `Permissions-Policy` header opting into private-
     network access, which neither of us controls. **Practical
     consequence: the web version cannot get automatic Remote API sync
     under current Chrome policy — keep using the clipboard-paste-into-
     Script-Editor method there.** The Steam app should be unaffected
     (not a public web origin the same way) — worth confirming next time
     you're in it. If you want to chase a personal override, `chrome://flags`
     may have a private-network-access-related entry, but I can't check
     since automating `chrome://` pages is blocked for me — not expecting
     much given how far enforcement has progressed (full enforcement since
     Chrome 130).
  See `docs/processes.md`'s "Failure modes worth knowing" for the fuller
  writeup and `tools/bb_remote.py`/`tools/remote_api_monitor.sh` for the
  actual code fixes (commit pending).

- [x] **Verify dnet_root.js hang + HUD fix on the browser save — done 2026-09-03.**
  Root-caused and fixed the dnet "paused" issue live (commits a235dbf,
  4c26e3a, pushed). Confirmed from your own fresh browser tab, not just
  Codex's: `Darknet ▶ gateway live, network already covered 5t [hd]`,
  `Status: ACTIVE`.
  **Near-miss along the way:** you had a second tab open to the same
  exported save, opened before Codex's. Both tabs autosave to the same
  browser storage independently — your older tab's stale in-memory state
  (still showing Paused) was overwriting Codex's saved fix each time it
  autosaved, so a refresh of your tab kept showing the bug as "back."
  Fixed by closing your tab and forcing an explicit save from Codex's, then
  you reopened fresh and confirmed ACTIVE. **Lesson: never have two tabs
  open to the same Bitburner save at once** — same-origin browser storage
  has no merge, last write wins, and it's very easy to silently undo real
  work this way.

- [x] **Verify the same fix reaches your Steam save — done 2026-09-04.**
  Confirmed via Remote API (Steam's own Electron connection, distinct from
  the browser save — `dnet_status.json` there was stale from 2026-08-12/13,
  proving darknet hadn't run on this save since before the freeze
  investigation). Ken ran `dnet_killswarm.js` then `dnet_root.js` as two
  separate commands. Pulled `dnet_deployer_home.json` fresh afterward:
  heartbeat 3.8s old (well under the 120s staleness threshold), `pass: 15`
  and climbing; `dnet_manager_registry.json` showed 2 resident managers
  (`darkweb`, `d0s_s11ppers`) registered 25s prior. By the HUD's own
  liveness logic (`hud_consolidated.js`'s `darknetStatus`) that reads
  ACTIVE, not Paused. Second independent save confirmed — this item is
  closed.

- [ ] **Run Darknet Canary Phase 1 (single-manager test) — 2026-09-02 infrastructure ready.**
  Testing infrastructure created to diagnose the 4 freeze incidents (2026-08-30).
  **Key insight:** `dnet_scorecard.js` reads 586+ credential shards every 30s and could cause CPU spike.
  
  **To run:**
  ```bash
  bash tools/dnet_canary_test.sh --phase 1 --runs 3
  ```
  
  - Prerequisites: MCP running stable 30+ min, Remote API connected
  - Runs 3x 5-minute tests with scorecard disabled
  - Monitors CPU, game responsiveness, manager count
  - Stops immediately on freeze detection
  - Logs results to `docs/darknet-canary-log.md`
  - **Timeline:** ~2 hours (30m runtime + 90m waits)
  
  **Outcomes:**
  - ✅ Phase 1 succeeds: Scorecard is likely culprit, safe to expand
  - ❌ Phase 1 fails: Problem is `ns.dnet.*` API cost, needs game source investigation
  
  See `docs/dnet-canary-testing-guide.md` for complete walkthrough.

- [x] **Historical: first cap attempt (15, 5s merge) — done 2026-08-30.**
  Restarted, overshot to 30 registry entries (48 known hosts) before being
  killed — no sluggishness reported at that peak. Tightened same day: cap
  15→8, registry merge 5s→1s, documented as a soft (not hard) cap. Also
  fixed a real drift bug where `dnet_crawl.js`'s duplicated cap constant had
  gone stale.
- [x] **Historical: second cap attempt (tightened to 8, 1s merge) — done
  2026-08-30.** Restarted, overshot *worse* (36 entries vs. cap 8) and
  froze *faster* than the first attempt. Root cause turned out to be the
  propagation burst itself, not resident count — a resident-count cap was
  never going to fix that regardless of how tight. Fixed differently:
  `MAX_SPREAD_PER_PASS` throttles `dnet_crawl.js`'s own fan-out directly,
  `jitteredRecrawlMs` desyncs recrawl timing. See `docs/claude-todo.md`'s
  2026-08-30 entries for the full arc.
- [x] **Historical: third and fourth cap/throttle attempts — done
  2026-08-30, darknet paused.** Third restart under the propagation
  throttle grew gradually (no burst) yet froze anyway, at a lower resident
  count than either prior attempt. A cleanly isolated fourth restart
  (darknet alone, nothing else running — `mcp.js`/`dnet_scorecard.js`/HUD/
  supervisor all confirmed off) then froze within ~90 seconds with only 6
  real resident managers, well under the cap. That rules out every
  mitigation tried so far — aggregate load, propagation burst speed,
  resident count are all eliminated. Four live freezes total this session;
  no live-restart-based fix landed. **Darknet stays off** until a real
  investigation happens (likely needs reading the game's own bundled
  source for what `ns.dnet.probe()`/`getServerDetails()`/`authenticate()`
  actually cost against this save's darknet graph) — see
  `docs/darknet-strategy.md`'s 2026-08-30 status banner for the full
  incident arc, and `docs/claude-todo.md` for the session-by-session
  writeup. No restart action pending — the next step here is investigation,
  not another retry.
- [x] **Footgun found and fixed procedurally, not in code:**
  `dnet_killswarm.js`'s `TARGET_SCRIPTS` includes `dnet_root.js` itself and
  its cleanup scan covers `home` — chaining `run dnet_killswarm.js;run
  dnet_root.js` on one line lets the kill scan race the very process the
  same line just launched, since `run` doesn't block for completion. Always
  run them as two separate terminal commands, never `;`-chained or
  aliased that way.

- [ ] **Run `mcpMulti.js` (dry-run, no arg) once it's synced into the game**
  to generate real projected numbers. Built 2026-08-29 to test whether
  spreading the worker pool across several targets beats `mcp.js`'s
  single-target approach — see `docs/claude-todo.md`'s 2026-08-29 entry.
  Dry-run only: it never calls `ns.exec`/`ns.scp`/`ns.kill`, so it's safe to
  run right alongside the live `mcp.js`. Check `mcp_multi_status.json`'s
  `multiTargetProjectedTotal` vs. `singleTargetBaselineScore` after it's had
  a few ticks. Needs the Remote API daemon reconnected first (next item) —
  its `WATCHED_FILES`/`PULL_FILES` were updated for the new files, but that
  needs the daemon process restarted, not just a resync, to take effect.

- [ ] **Reconnect Bitburner to the existing Remote API daemon on port 12526.**
  The daemon disconnected at 2026-08-16 13:33 PT and no longer answers its
  local control channel, so Codex cannot pull fresh core telemetry. In
  Bitburner, open Options → Remote API and click Connect for port `12526`.
  No source sync, restart, or held-subsystem action is requested.
  
  **Keep-alive system added 2026-09-02:** See `docs/remote-api-keepalive.md`
  for automated daemon monitoring. Start the system monitor with:
  ```bash
  nohup /Users/Shared/BitBurner/tools/remote_api_monitor.sh --daemon &
  ```
  This will auto-restart the daemon if it ever crashes again.

- [x] **Historical: the promotion-state.json hold apparatus is retired
  (2026-08-18).** Stock, IPvGO, Darknet, and faction share stay off per
  `AGENTS.md`'s short stop-list now, not a JSON hold file; nothing here for
  Ken to remember or execute either way.

- [x] **Superseded: do not start the balanced faction-sharing allocation.**
  The earlier `run share_deploy.js` request is cancelled after the stability/
  loop incident. Re-enable needs Ken's explicit go-ahead per `AGENTS.md`'s
  stop-list, after the root cause is understood.

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

- [x] **Stock trader authorization and launch.** Ken explicitly approved
  capital deployment on 2026-08-18; the adaptive `trade=1` instance is live
  and its two source files are now daemon-watched for reconnect-safe sync.
- [x] **Leftover `get_stats.js` processes.** `ps` confirmed a single instance
  (PID 914) alongside a single `mcp_hud.js` (PID 986) — the three stray
  copies from before the self-supersede fix are gone.
