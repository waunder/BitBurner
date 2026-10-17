# Current BitBurner Handoff

Last refreshed: 2026-10-16. This file is a compact handoff, not a substitute
for checking the live game. The detailed prior checkpoint stream is preserved
in `docs/archive/context-cleanup-2026-10-16/STATE-before-cleanup.md` and is
historical evidence only.

## Current goal and preferences

- Ken is pursuing Black Hand progression. The latest verified gang task
  objective was `reputation`, to build faction reputation for Black Hand
  augmentations. Karma/Homicide and player-work choices are user-directed;
  do not infer the current player activity from old notes.
- Gang task objective and gang capital phase are separate settings. The latest
  confirmed configuration was gang task `reputation`; capital phase
  `augmentation`, with equipment purchases disabled while accumulating cash
  toward optional QLink.
- Ken said he will pursue Covenant augmentations after reaching the necessary
  physical XP. Recheck live stats and requirements before recommending a
  change.
- Respect explicit requests to set the player's work through the game UI;
  script objectives do not automatically grant permission to change player
  work, install augmentations, or reset.

## Last verified live snapshot — 2026-10-16, 11:14 PDT

Verified through the Steam Bitburner UI after direct Remote API connection and
source sync:

- Remote API connected to plain WebSocket `127.0.0.1:12526`; control port is
  `12527`. The full manifest sync reported 99 files pushed without failures.
- Exactly one `gang-controller.js` process was running (PID 109469) and the
  consolidated HUD was running (PID 109470). `gang-status.js` was relaunched
  (PID 109472); the old frozen tail was closed.
- Gang detail showed 12 members, task objective `reputation / wanted-recovery`,
  Black Hand faction reputation about `624.68k` and rising about `+21/s`, and
  projected respect/cycle about `49.88`.
- Capital policy separately showed phase `AUGMENTATION`, QLink cash
  accumulation, and gang equipment purchases disabled. The HUD's
  `CAP AUGMENTATION` label refers to that capital policy, not gang tasks.
- The compact MCP HUD showed objective `xp` but `0/m` at that instant. Treat
  MCP's XP objective and the gang's reputation objective as distinct. Current
  player work, current XP rate, process IDs, and all game values must be
  refreshed before acting.

## Next session start

1. Read `AGENTS.md`, then this file, then `docs/Codex-todo.md` if the task is
   implementation work. `docs/processes.md` is the script map. Treat archived
   checkpoints, `docs/claude-todo.md`, old audits, and migration reports as
   history unless a current source explicitly points to them.
2. For live BitBurner work, refresh Steam UI and Remote API state before using
   telemetry or changing scripts. Follow `docs/remote-api-keepalive.md` for
   the exact check, connect, sync, and verification sequence.
3. Confirm which save and objective are live. Never assume the player's
   current activity or that an old HUD snapshot remains valid.
4. After source edits, sync the explicit manifest and verify the game copy;
   restart affected Netscripts because they do not hot-reload. Preserve
   unrelated dirty changes.

## Open work

No implementation task is carried forward from the context cleanup itself.
On the next gameplay request, inspect the live state and take the user's
stated goal as current direction; do not revive old backlog items without
checking whether they still apply.
