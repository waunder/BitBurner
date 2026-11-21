---
name: bitburner-bn10-checkin-mac
description: Scheduled check-in on the BitBurner BN10 run while the game runs on the Mac Mini
---

Continue Ken's BitBurner run: BN10 run 4. The game runs in Steam on this Mac Mini. The repository is
/Volumes/ExternalData/BitBurner; use absolute paths. Python is .venv/bin/python3 in the repo, Node is
/opt/homebrew/bin/node. Git pushes over HTTPS with `git -c credential.helper='!gh auth git-credential' push`.
Cap every command at 120 seconds. Report times in Mac local time.

First read AGENTS.md and STATE.md; treat AGENTS.md's mentions of Codex as applying to you. For code changes also
read docs/Codex-todo.md and the relevant part of docs/processes.md. Run `git status` and `git log -3`: if another
session is clearly working (fresh uncommitted edits or a commit in the last 15 minutes), stand aside, say so, end.

Where the game is: it must run on exactly one machine. If STATE.md says the game has moved back to the PC, report
"game on the PC, standing by" and change nothing. Never launch, reload or quit the game.

Authority (AGENTS.md): everything in the game is yours except installing augmentations by hand, resets and
permanent forfeits. The Red Pill is installed; auto install holds by itself. Ken's rule (2026-11-19): do not root,
backdoor or destroy w0r1d_daemon until The Covenant's 8th sleeve is bought. When it is bought: back up the save,
record it in STATE.md, notify Ken, and stop. Do not choose a BitNode.

Access on the Mac:
- Remote API daemon: LaunchAgent com.bitburner.remote-api-monitor (docs/remote-api-keepalive.md, "Mac Mini setup").
  Check with `.venv/bin/python3 tools/bb_remote.py ctl-status`; use ctl-get, ctl-pull, ctl-push, ctl-restart.
  If the game is disconnected for more than a few minutes, report it; do not try to click in the game.
- There is no DevTools access on the Mac, so tools/game_terminal.py, CDP save export and the PC's
  daemon_supervisor.py (outage watchdog, auto install) do not work here. Use mcp_supervisor.js's
  file-triggered restarts through the Remote API. If every game script has stopped, tell Ken to run
  `run startup.js` in the game terminal.

Each run:
1. Refresh live state with timestamps (ctl-pull, then read runtime/): money, hacking, The Covenant 8th sleeve cost
   vs cash, entropy and graft_log.txt, MCP status, gang, darknet, contracts, sleeves, augmentation advisor.
2. Restart anything that died; fix what the status files show is blocking; advance STATE.md's named work.
   Measure changes, run the tests in the staged copy before deploying (tools/stage.py bn10, node --test),
   keep sync_manifest.json current, and mark what is unverified. Never claim live behaviour you did not observe.
3. Review one row of docs/number-review.md (step 5c).
4. Replace "Latest check" in STATE.md and put the full entry at the top of docs/check-log.md.
5. Write runtime/run_report.json ({ts, title, lines}) and push it with ctl-push so the in-game Run report updates.
6. Commit and push coherent changes, ending commit messages with:
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

If nothing useful can be done this run, say so briefly and end. Report only material progress or real problems.
