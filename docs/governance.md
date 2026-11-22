# Governance: how Ken oversees what Claude runs

Ken directs; Claude is the technical manager. Ken does not read code or administer the PC,
so this file is his view of what exists, what Claude may do alone, and what comes to him.
Claude keeps it current. Last checked: 2026-11-04.

## What Claude does without asking

Everything inside the game and this repository, within `AGENTS.md`'s standing authority:
- game scripts, code, tests, commits and pushes to `waunder/BitBurner`;
- in-game spending, restarts, augmentation installs and Covenant sleeve purchases through BN10
  completion (Ken's handover, 2026-11-04), with a validated save backup before each install;
- subagents working in isolated worktrees, whose work Claude reviews before it merges.

## What always comes to Ken first

- **Game milestones:** handed to Claude for this game on 2026-11-22 (AGENTS.md, "Handover"), usable once
  `docs/finish-procedure.md` says READY. Still Ken's: starting a new game over this save, deleting or overwriting it.
- **Anything real outside the game:** Ken's email, calendar or Drive; real money; GitHub
  repository settings, collaborators or visibility.
- **Changes to the PC:** new scheduled tasks, services, startup items, open network ports,
  installed software, firewall or security settings; deleting anything outside this repo.
- **Trust and permissions:** granting a folder trust, widening permission modes, new
  connectors or plugins.
- **Doubt:** whenever Claude is unsure an action is safe or reversible, or a result looks wrong.

## Permissions policy (Ken, 2026-11-03)

1. **Claude does not expand its own permissions.** It may ask Ken for more, saying why, and
   must wait for his grant. Raising the permission mode already requires Ken's click. The
   gap: Claude can write files, including the Claude settings files that hold permission
   allow-rules (`.claude/settings*.json` and `~/.claude/settings.json`). So by policy Claude
   never edits permission rules, hooks or trust settings in those files, or anywhere else,
   without Ken's explicit grant for that change.
2. **Claude never gives an agent or session more than it has.** Subagents inherit this
   session's permissions and cannot exceed them. Sessions Claude starts run at its own
   permission mode or lower.
3. **Requests to widen another agent's or session's permissions are not made.** Ken would
   deny them. If wider access is truly needed, Claude asks for it for itself, and does
   the work itself.

## How Ken hears about things

- Questions and doubts go at the top of Claude's reply, in plain words, never buried.
- `STATE.md` is the dated game dashboard. This file is the PC and governance dashboard.
- Each piece of work closes with what changed, what is verified, and what is not.

## Inventory: what runs outside the game

| Item | What it does | Where it lives | Status (2026-11-03) |
| --- | --- | --- | --- |
| Windows task "BitBurner daemon supervisor" | Keeps the Remote API daemon alive at logon | Task Scheduler; runs `tools\daemon_supervisor.py` | Running |
| Remote API daemon | Syncs scripts into the game (from the generated `sync_manifest.json`) and pulls status files into `runtime/`; listens on 127.0.0.1:12526/12527 (local only) | `tools/bb_remote.py` | Connected; restarted 2026-11-04 03:29 for the map-form manifest, clean full sync |
| Profile tool | Merges core and a BitNode profile into the manifest; `switch` (needs `--live`) rewrites the game's files at a BitNode boundary, `check` compares the game with the manifest. Never run unattended. | `tools/profile.py`, `tools/stage.py` | Live since the BN10 cutover, 2026-11-04 03:30 Pacific: `switch bn10` and `check` ran cleanly |
| Chrome DevTools port | Lets Claude read the game page and type terminal commands | 127.0.0.1:9222 (local only), the Steam game | Listening |
| Claude app task `bitburner-bn15-progress` (titled "BitBurner BN10 progress") | Hourly autonomous check-in on the run; prompt rewritten for BN10 on 2026-11-04 | `~/.claude/scheduled-tasks/` | Working again. A run started 2026-11-02 15:58 Pacific froze on one command, and the scheduler skipped every later hour. Stopped 2026-11-03 20:36, and the next run completed. The prompt now caps every command at 120s and stands aside when another session is active. |
| GitHub SSH key "Kens-PC BitBurner" | Lets this PC push to the repo | Ken's GitHub account | In use. Pushes refused for a while on 2026-11-04 during a GitHub outage; main pushed after |
| Repo `waunder/BitBurner` visibility | **Public** since 2026-09-04, so the browser save could fetch scripts. Everything pushed is world-readable, including `STATE.md` and docs. Saves and telemetry are gitignored. | GitHub | Public; making it private breaks only the browser-save sync |
| Python venv | Tool dependencies | `.venv/` in the repo | — |
| Generated folders | Test copies and pulled telemetry; safe to delete, never source | `build/`, `runtime/` (gitignored) | New with the restructure |
| Save backups | Validated game saves before each install | `saves/` (gitignored, local only) | 5 so far |
| Offline repo backup | Git bundle (full history) and zip of the clone, saves included, made at Ken's request while GitHub was degraded | `D:\Backups\BitBurner\` on the HDD | First made 2026-11-04 04:25 PC clock |

### Mac Mini (since 2026-11-20, while the PC's GPU is faulty)

| Item | What it does | Where it lives | Status (2026-11-20) |
| --- | --- | --- | --- |
| LaunchAgent `com.bitburner.remote-api-monitor` | Keeps the Remote API daemon alive (127.0.0.1:12526/12527) | `~/Library/LaunchAgents`, copy in `tools/` | Running; kill test recovered in ~20s |
| LaunchAgent `com.bitburner.auto-install` | Backs up the save and installs when the advisor says install, only in a run listed in `tools/install_approvals.json`; waits for grafts; never with The Red Pill owned. Pause: `tools/autoinstall.pause` | `~/Library/LaunchAgents`, copy in `tools/` | Since 2026-11-21; restarted 23:13 that day with the graft fix |
| LaunchAgent `com.bitburner.watchdog` | Runs `startup.js` when no resident script is running (two autosaves), also after entering a BitNode the active profile covers. Runs nothing else; never launches or reloads the game. Pause: `tools/watchdog.pause` | `~/Library/LaunchAgents`, copy in `tools/`; log `runtime/watchdog_mac.log` | Ken approved and installed 2026-11-22 10:54; restarts itself after a kill |
| LaunchAgent `com.bitburner.run-page` | Ken's run page, read-only (reads the autosave on disk; writes only its history, `runtime/run_page_samples.jsonl`), port 8790 on all interfaces (LAN 192.168.68.56, Tailscale 100.103.184.36) | `~/Library/LaunchAgents`, copy in `tools/` | Running; network access needs the firewall to allow Homebrew Python (Ken) |
| Full Disk Access for `/bin/bash` | Lets the LaunchAgents read the external drive | System Settings, granted by Ken | On. Claude Code also got Full Disk Access by accident at 13:44; Ken may remove it |
| Steam launch option `--remote-debugging-port=9222` | DevTools for save backups and the game terminal | Steam, Bitburner properties; 127.0.0.1 only | Listening |
| Claude app tasks `bitburner-bn10-checkin-mac` (2-hourly) and `bitburner-stack-spacing-test` (one-time 19:25) | Scheduled check-ins | `~/.claude/scheduled-tasks/` | Enabled |

Connected to Claude here but **not used for game work**: Gmail, Google Calendar, Google Drive,
Hugging Face. Claude does not touch them without Ken asking.

## Open questions for Ken

None. The six stalled sessions from the trust problem were archived on 2026-11-03 at Ken's
request (`docs/agent-working-models-2026-11-03.md`); archived sessions can be reopened.
