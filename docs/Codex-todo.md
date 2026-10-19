# Codex current work ledger

Last reviewed: 2026-10-19. No prior implementation item was verified as a
current commitment during the context cleanup. Do not resume an old unchecked
task without checking the live game, repository, and Ken's current goal.

The previous backlog is preserved in
`docs/archive/context-cleanup-2026-10-16/Codex-todo-before-cleanup.md` for
revalidation. The current session handoff is `STATE.md`; project rules are in
`AGENTS.md`; script behavior is in `docs/processes.md`.

## Active work

None.

## Completed — 2026-10-19

- Diagnosed XP transition blocked by security-only cloud preparation. Cancel
  tracked preparation on XP selection while retaining harvest/grow restoration.
  Updated stale cloud fixtures and added transition regressions; 11 cloud and
  89 scheduler tests pass. Steam deployment and live result recorded in
  `docs/mcp-status-2026-10-19.md`.

- Added and activated the independent MCP progress watchdog in the existing
  maintenance steward; objective-aware alerts feed the Operations HUD. Repairs
  require fresh process/batch evidence and share a 15-minute cooldown. All 122
  focused regression tests pass; live activation/readback verified. Details:
  `docs/mcp-watchdog-2026-10-19.md`.

- Corrected target-stats reporting: eligible worker RAM, actual versus planned
  batch threads, unlisted targets, and rolling realized hacking income. Seven
  focused tests pass; deployed/readback verified and Steam layout checked.
  Evidence: `docs/target-stats-2026-10-19.md`.
