# Ken's to-do

Actions that need a human hand. Claude cannot trigger the VS Code extension's
download command or click anything in-game — see `CLAUDE.md`. Checked items
stay here as a record of what's already done, not busywork to repeat.

Claude should keep this current: add an item the moment something needs
Ken's hand, and check it off once it's confirmed done — same rule as
`docs/processes.md`.

## Pending

- [ ] **Pull `origin/main` into the actual synced checkout at
  `/Users/Shared/BitBurner`** (a plain `git pull`, or `git checkout .` if
  it's clean but behind) to bring in commit `c33c13f` (`NUM_SIMULATIONS`
  1500→6000, algorithm tag v1→v2 — full reasoning in this session's
  `docs/claude-todo.md` "(latest)" entry and in the dashboard footnote).
  Found this session: this work was done in an isolated agent worktree
  (`.claude/worktrees/agent-a141ec9395f55e1c3`), which is a **separate
  directory on disk** from `/Users/Shared/BitBurner` — the same repo
  history, but the two have independent working-tree files. The commit is
  pushed to `origin/main`, but `tools/bb_remote.py`'s daemon watches
  `/Users/Shared/BitBurner`'s files directly (per `CLAUDE.md`'s own sync
  notes), and confirmed via `ctl-get /ipvgo_player.js` after this push that
  it's still serving the **old** `NUM_SIMULATIONS = 1500` /
  `"mcts-ucb1-v1"` content — a worktree agent has no way to run `git` in
  that shared checkout to fix it directly (attempted, structurally
  blocked). Once the pull lands, the daemon's own filesystem watcher should
  pick up the change and auto-push it into the game the normal way (per
  `CLAUDE.md`) — then the standing `run ipvgo_player.js` step below still
  applies, since Bitburner doesn't hot-reload either way.
- [ ] **Restart the `tools/bb_remote.py daemon` process — it's stuck
  crash-looping.** Found and root-caused 2026-08-11 (later session):
  `mcp_status_log.txt` grew past 1MB, which trips the websocket library's
  default message-size limit and kills the **entire** connection (not just
  that one file read) every time the daemon tries to pull it — so every
  reconnect now goes reconnect → partial push → crash on that one file →
  reconnect again, forever. The fix is already committed
  (`tools/bb_remote.py` now allows 20MB messages), but a running Python
  process doesn't pick up a code change without being restarted, and this
  session's sandbox blocked the `kill` command needed to do that. **What's
  needed: kill the existing daemon process and run this again from the repo
  root:** `python3 tools/bb_remote.py daemon --port 12526 --control-port
  12527`. (The game's own Options → Remote API → Connect button doesn't
  need to be touched separately — the daemon does that handshake on its
  own once it's listening and the game reconnects, or one Connect click
  will do it if the game doesn't auto-retry.) Once it's up, confirm with
  `python3 tools/bb_remote.py ctl-status --control-port 12527` showing
  `"connected": true` and no repeated `DISCONNECTED` lines appearing in
  `tools/bb_remote_events.log` afterward. This blocks getting the
  already-tested `ipvgo_player.js` self-atari fix running live (see
  `docs/claude-todo.md`'s IPvGO diagnosis entry) and any other routine sync
  until it's done.

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
- [x] **Leftover `get_stats.js` processes.** `ps` confirmed a single instance
  (PID 914) alongside a single `mcp_hud.js` (PID 986) — the three stray
  copies from before the self-supersede fix are gone.
