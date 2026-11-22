---
name: bitburner-bn10-checkin-mac
description: Scheduled check-in on the BitBurner game on the Mac Mini: keep the run going and build what the route needs next
---

Continue Ken's BitBurner game. STATE.md's top entry says which BitNode run is live and which profile runs it. The game runs in Steam on this Mac Mini. The repository is
/Volumes/ExternalData/BitBurner; use absolute paths. Python is .venv/bin/python3 in the repo, Node is
/opt/homebrew/bin/node. Git pushes over HTTPS with `git -c credential.helper='!gh auth git-credential' push`.
Cap every command at 120 seconds. Report times in Mac local time.

First read AGENTS.md and STATE.md; treat AGENTS.md's mentions of Codex as applying to you. For code changes also
read docs/Codex-todo.md and the relevant part of docs/processes.md. Run `git status` and `git log -3`: if another
session is clearly working (fresh uncommitted edits or a commit in the last 15 minutes), stand aside, say so, end.

Where the game is: it must run on exactly one machine. If STATE.md says the game has moved back to the PC, report
"game on the PC, standing by" and change nothing. Never launch, reload or quit the game.

Authority (AGENTS.md "Handover", 2026-11-22): the route and completion of this game are yours; Ken asked that the
agent's autonomy be exercised. Not yours: starting a new game over this save, restoring, deleting or overwriting it,
permanently deleting game files, and anything outside the game. Installs follow tools/install_approvals.json: the
LaunchAgent com.bitburner.auto-install (tools/auto_install_mac.py) installs within ~6 minutes of the advisor's
`install` verdict; read its `autoinstall:` lines in runtime/autoinstall_mac.log and install by hand only if it is
down or stuck. A run not in that file has no install approval: do not install and do not add it in a check-in.
If tools/autoinstall.pause exists it is not stuck: do not install and do not remove the file (STATE.md says why).
Back up with `tools/save_export.py --out pre-install-<node>-<n>-<date>`; if it fails or does not validate, do not
install. Run an install with `tools/game_terminal.py "home; run aug_install.js --install"`, then add a row to
STATE.md's install table.
World Daemon: a check-in never roots, backdoors or destroys w0r1d_d43m0n and never runs tools/finish_node.py --go.
When it is ready (The Red Pill installed and hacking at its requirement): back up the save, record it in STATE.md,
alert Ken, and stop. Finishing is done in a session by docs/finish-procedure.md.

Access on the Mac:
- Remote API daemon: LaunchAgent com.bitburner.remote-api-monitor (docs/remote-api-keepalive.md, "Mac Mini setup").
  Check with `.venv/bin/python3 tools/bb_remote.py ctl-status`; use ctl-get, ctl-pull, ctl-push, ctl-restart.
  If the game is disconnected for more than a few minutes, report it; do not try to click in the game.
- DevTools: the Steam launch option is `--remote-debugging-port=9222` (set 2026-11-20). Check
  `curl -s -m 3 http://127.0.0.1:9222/json/version`. tools/game_terminal.py and tools/save_export.py work as on
  the PC (Runtime.evaluate only, never Input.*). If every game script has stopped, run `startup.js` with
  game_terminal.py. The PC's daemon_supervisor.py (outage watchdog) is Windows-only and not running here,
  so that check is yours; auto install runs here as its own LaunchAgent (above).

Each run:
1. Refresh live state with timestamps (ctl-pull, then read runtime/): money, hacking, karma and gang, install
   advisor verdict and installed count, entropy and graft_log.txt, MCP status, gang, darknet, contracts, sleeves,
   augmentation advisor, and the run page's alarms (`curl -s -m 5 http://127.0.0.1:8790/api/state`).
2. Restart anything that died; fix what the status files show is blocking the live run. Measure changes, run the
   tests in the staged copy before deploying (tools/stage.py <profile>, node --test), keep sync_manifest.json
   current, and mark what is unverified. Never claim live behaviour you did not observe.
3. Build ahead (when the live run needs nothing): take the next unfinished item for the route (docs/route.md "Engine
   we lack" for the next BitNodes, then docs/opportunities.md). Work only in profiles/<next> and new core files
   that no live manifest names; never edit the live profile's files for a future node, never run profile.py switch.
   Every change is tested (unit tests, stage.py, node --test). Leave a dated note in that profile's notes or
   docs/route.md saying what is built, what is tested, and what still needs a disposable-copy rehearsal.
4. Review one row of docs/number-review.md (step 5c) if time remains.
5. Replace "Latest check" in STATE.md and put the full entry at the top of docs/check-log.md.
6. Write runtime/run_report.json ({ts, title, lines}) and push it with ctl-push so the in-game Run report updates.
7. Commit and push coherent changes, ending commit messages with:
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
8. Alert Ken only for what he would act on now (World Daemon ready, the game stopped saving, an alarm you cannot
   clear, a decision reserved to him), with `.venv/bin/python3 tools/notify.py "<one line>"` once it exists, else
   say so in the report.

If nothing useful can be done this run, say so briefly and end. Report only material progress or real problems.
