# Ken's to-do

Actions that need a human hand. Claude cannot trigger the VS Code extension's
download command or click anything in-game — see `CLAUDE.md`. Checked items
stay here as a record of what's already done, not busywork to repeat.

Claude should keep this current: add an item the moment something needs
Ken's hand, and check it off once it's confirmed done — same rule as
`docs/processes.md`.

## Pending

- [ ] **`git push origin main` — one commit sitting local, unpushed.**
  Found 2026-08-11: today's session runs through Cowork, not a terminal on
  your Mac with your SSH agent. Cowork's shell sandbox has no SSH key for
  `git@github.com` and no stored HTTPS credentials either (both tested
  directly — SSH fails DNS resolution through the sandbox's proxy, HTTPS
  reaches GitHub but has no username/token). Commits still work fine (pure
  local git, no network needed) — only the push leg needs your machine.
  `main` is a few commits ahead of `origin/main` from this session's doc
  updates (`git log origin/main..main` to see exactly which). Run
  `git push` from a terminal on your Mac to land them — no conflicts
  expected, it's a fast-forward.
- [ ] **Run `dnet_deploy.js --once` from `home`** — `dnet_probe.js` (below)
  validated the model reading, so this is the next step: the roaming
  self-replicating deployer, single pass. ~4.6GB. See
  `docs/darknet-strategy.md` for what it does; report back what it finds
  (hosts cracked, credentials gathered) so `docs/darknet-*.md` can be
  checked against real results rather than just the source reading.

## Done (kept for reference)

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
