---
name: bitburner-bn15-progress
description: Hourly check-in that keeps the BitBurner BN15 run moving toward completion
---

Continue Ken's BitBurner BitNode 15 run. The repository is the clone at C:\Users\kenne\BitBurner on this Windows PC; use absolute paths or Set-Location there. Git is at C:\Program Files\Git\cmd\git.exe, Node at C:\Program Files\nodejs\node.exe, Python at .venv\Scripts\python.exe in the clone.

First read AGENTS.md, STATE.md, docs/red-pill-path-2026-11-01.md and docs/processes.md's capital_manager, dnet_lab and dnet_scout sections. Treat AGENTS.md's mentions of Codex as applying to you. Before editing, run git status and check no other BN15 session is running.

Authority: on 2026-11-01 Ken gave full approval to carry BN15 through to completion, making any and all changes judged best, including purchases, code, commits, pushes and augmentation installs, and repeated that approval on 2026-11-02. Do not stop to ask within BN15. Two limits remain. (1) Export and validate a save backup before each install: read the 'save' key from IndexedDB database 'bitburnerSave' over Chrome DevTools at 127.0.0.1:9222, gunzip it, confirm player data parses, and store it in saves/. (2) Do not destroy w0r1d_daemon or enter another BitNode: when the World Daemon is ready, stop, record that in STATE.md, and notify Ken, because choosing the next BitNode needs him.

Access: the game runs in Steam on this PC. tools/bb_remote.py ctl-status, ctl-get, ctl-push talk to the Remote API daemon. tools/daemon_supervisor.py keeps that daemon up and reconnects the game. DevTools on port 9222 can read the page and type in the terminal; websocket-client is in the venv. First check #terminal-input is empty, because Ken may be typing. Only one tab may ever use the save; the game must never run on the Mac as well. Leave Ken's terminal on home when finished. A running script restores focused work within seconds, so do any multi-click UI sequence in a single evaluate call.

Each run: refresh live state with timestamps (BitNode, money, hacking, charisma, karma, factions, MCP status, capital_status.json, dnet_scout_status.json, dnet_lab_status.json). Status files not on disk are read with ctl-get. Confirm currentNode is still 15; if not, stop and report. Then do the highest-value work: restart anything that died; fix what the status files show is blocking; advance the plan. Priorities: keep MCP and capital_manager growing; get player_activity_controller.js running and useful; raise charisma toward labyrinth gates (300, 600, 1500, 2500, 3000); extend dnet_scout.js until the next labyrinth is reached; run dnet_lab.js; open the reward cache; install rewards in order until The Red Pill is installed (at least five installs; charisma resets on each); then earn hacking for the World Daemon. Gang needs -54000 karma if worthwhile. Set capital_policy.json reserve to 0 before an install. Measure changes, run node --test *.test.js before deploying, keep sync_manifest.json current, and mark what is unverified. Never claim live behaviour you did not observe. Report times in Pacific.

Refresh STATE.md when verified state changes and commit and push coherent changes, ending commit messages with: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

If nothing useful can be done this run, say so briefly and end. Report only material progress or real problems.
