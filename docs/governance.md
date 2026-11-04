# Governance: how Ken oversees what Claude runs

Ken directs; Claude is the technical manager. Ken does not read code or administer the PC,
so this file is his view of what exists, what Claude may do alone, and what comes to him.
Claude keeps it current. Last checked: 2026-11-03 20:40 Pacific.

## What Claude does without asking

Everything inside the game and this repository, within `AGENTS.md`'s standing authority:
- game scripts, code, tests, commits and pushes to `waunder/BitBurner`;
- in-game spending, restarts, and augmentation installs up to BN15 completion (with a
  validated save backup first);
- subagents working in isolated worktrees, whose work Claude reviews before it merges.

## What always comes to Ken first

- **Game milestones:** destroying `w0r1d_daemon`, choosing or entering a BitNode, any other reset.
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
| Remote API daemon | Syncs scripts into the game and pulls status files; listens on 127.0.0.1:12526/12527 (local only) | `tools/bb_remote.py` | Connected all day |
| Chrome DevTools port | Lets Claude read the game page and type terminal commands | 127.0.0.1:9222 (local only), the Steam game | Listening |
| Claude app task `bitburner-bn15-progress` | Hourly autonomous check-in on the run | `~/.claude/scheduled-tasks/` | Working again. A run started 2026-11-02 15:58 Pacific froze on one command, and the scheduler skipped every later hour. Stopped 2026-11-03 20:36, and the next run completed. The prompt now caps every command at 120s and stands aside when another session is active. |
| GitHub SSH key "Kens-PC BitBurner" | Lets this PC push to the repo | Ken's GitHub account | In use |
| Repo `waunder/BitBurner` visibility | **Public** since 2026-09-04, so the browser save could fetch scripts. Everything pushed is world-readable, including `STATE.md` and docs. Saves and telemetry are gitignored. | GitHub | Public; making it private breaks only the browser-save sync |
| Python venv | Tool dependencies | `.venv/` in the repo | — |
| Save backups | Validated game saves before each install | `saves/` (gitignored, local only) | 5 so far |

Connected to Claude here but **not used for game work**: Gmail, Google Calendar, Google Drive,
Hugging Face. Claude does not touch them without Ken asking.

## Open questions for Ken

None. The six stalled sessions from the trust problem were archived on 2026-11-03 at Ken's
request (`docs/agent-working-models-2026-11-03.md`); archived sessions can be reopened.
