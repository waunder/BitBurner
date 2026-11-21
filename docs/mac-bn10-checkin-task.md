---
name: bitburner-bn10-checkin-mac
description: Scheduled check-in on the BitBurner run (BN12 run 1 since 2026-11-21) while the game runs on the Mac Mini
---

Continue Ken's BitBurner run: BN12 run 1 (entered 2026-11-21 11:08, profile bn12). The game runs in Steam on this Mac Mini. The repository is
/Volumes/ExternalData/BitBurner; use absolute paths. Python is .venv/bin/python3 in the repo, Node is
/opt/homebrew/bin/node. Git pushes over HTTPS with `git -c credential.helper='!gh auth git-credential' push`.
Cap every command at 120 seconds. Report times in Mac local time.

First read AGENTS.md and STATE.md; treat AGENTS.md's mentions of Codex as applying to you. For code changes also
read docs/Codex-todo.md and the relevant part of docs/processes.md. Run `git status` and `git log -3`: if another
session is clearly working (fresh uncommitted edits or a commit in the last 15 minutes), stand aside, say so, end.

Where the game is: it must run on exactly one machine. If STATE.md says the game has moved back to the PC, report
"game on the PC, standing by" and change nothing. Never launch, reload or quit the game.

Authority (AGENTS.md): everything in the game is yours except resets and permanent forfeits. Installs are
approved up to readiness to complete BN12 (Ken, 2026-11-21, same terms as earlier runs), with a validated save
backup in saves/ before each, and the install advisor's verdict as the trigger: install when it reads `install`.
Back up with `tools/save_export.py --out pre-install-bn12-<n>-<date>`; if it fails or does not validate, do not
install: report the advisor's verdict for Ken instead. Run the install with
`tools/game_terminal.py "home; run aug_install.js --install"`, then add a row to STATE.md's install table.
World Daemon: do not root, backdoor or destroy w0r1d_d43m0n. When it is ready (The Red Pill installed and hacking
at its requirement): back up the save, record it in STATE.md, notify Ken, and stop. Do not choose a BitNode.

Access on the Mac:
- Remote API daemon: LaunchAgent com.bitburner.remote-api-monitor (docs/remote-api-keepalive.md, "Mac Mini setup").
  Check with `.venv/bin/python3 tools/bb_remote.py ctl-status`; use ctl-get, ctl-pull, ctl-push, ctl-restart.
  If the game is disconnected for more than a few minutes, report it; do not try to click in the game.
- DevTools: the Steam launch option is `--remote-debugging-port=9222` (set 2026-11-20). Check
  `curl -s -m 3 http://127.0.0.1:9222/json/version`. tools/game_terminal.py and tools/save_export.py work as on
  the PC (Runtime.evaluate only, never Input.*). If every game script has stopped, run `startup.js` with
  game_terminal.py. The PC's daemon_supervisor.py (outage watchdog, auto install) is Windows-only and not
  running here, so those checks are yours.

Each run:
1. Refresh live state with timestamps (ctl-pull, then read runtime/): money, hacking, karma and gang, install
   advisor verdict and installed count (Daedalus needs 31 in BN12), entropy and graft_log.txt, MCP status, gang, darknet, contracts, sleeves, augmentation advisor.
2. Restart anything that died; fix what the status files show is blocking; advance STATE.md's named work.
   Measure changes, run the tests in the staged copy before deploying (tools/stage.py bn12, node --test),
   keep sync_manifest.json current, and mark what is unverified. Never claim live behaviour you did not observe.
3. Review one row of docs/number-review.md (step 5c).
4. Replace "Latest check" in STATE.md and put the full entry at the top of docs/check-log.md.
5. Write runtime/run_report.json ({ts, title, lines}) and push it with ctl-push so the in-game Run report updates.
6. Commit and push coherent changes, ending commit messages with:
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

If nothing useful can be done this run, say so briefly and end. Report only material progress or real problems.
