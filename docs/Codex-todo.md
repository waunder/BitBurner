# Codex current work ledger

Last reviewed: 2026-10-24. Revalidate old unchecked items against the live game,
repository and Ken's current goal; historical snapshots are not current authority.

The previous backlog is preserved in
`docs/archive/context-cleanup-2026-10-16/Codex-todo-before-cleanup.md` for
revalidation. The current session handoff is `STATE.md`; project rules are in
`AGENTS.md`; script behavior is in `docs/processes.md`.

## Active work

- Ongoing scheduler assessment/improvement loop authorized 2026-10-24.
  Assess realized cash and safe restoration, trial bounded changes, retain or
  revert on evidence, commit/push coherent changes. Thread heartbeat
  bitburner-efficiency-assessment is active every 30 minutes. Affordable harvest
  ranking and equal/weighted cohort caps were trialed; both flags are off after
  no measured cash improvement. Measurements and caveats are in
  docs/harvest-efficiency-2026-10-24.md. See
  docs/scheduler-assessment-loop.md. Installation/reset approval still required.

- Fix money-mode recruitment overriding wanted recovery in gang-controller.js.
  Verified 2026-10-23: four members, cleanupMode=true, wanted multiplier
  ~0.0000357. Reputation override now activates recovery; preserve this objective.

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

- Assessed scheduler churn and ran a fixed/completion-aware/fixed cash trial:
  $2.033m/s / $2.269m/s / $2.033m/s, +11.63% versus mean control. Retained
  completion-aware wake and cohort RAM reservation, preserving finite jobs at
  startup and validating adoption across restart. Final short production check
  ~$2.425m/s; 135 tests pass. Evidence: `docs/scheduler-efficiency-2026-10-19.md`.
  Ken's explicit standing autonomy instruction is recorded in AGENTS.md.

## Completed — 2026-10-20

- Money panel labels `other` as `hacking costs` (distinct from hacking income)
  and sorts signed amounts descending. Syntax/readback verified; Steam panel
  PID 1994 shows the negative cost below all income rows. Focused BitRunners
  work restored after routine Remote API reconnect and panel reload.


## Completed — 2026-10-24

- Concentrated finite preparation into meaningful chunks rather than token
  remainder allocations. Deployed fingerprint finite-preparation-chunks-v7,
  preserved active finite restoration, verified minimum/deferrals and productive
  new cohorts. 128 focused tests pass; functional live check earned $2.02m in
  66.8s with eight completed cohorts and no faults. Sustained cash uplift is not
  claimed. See docs/preparation-chunks-2026-10-24.md.

- Assessed affordable harvest ranking with equal and weighted cohort caps.
  Deployed/tested fingerprint finite-weighted-harvest-v9; both flags default off.
  Equal caps measured $77.4k/s, earlier legacy $79.8k/s, weighted $69.5k/s in
  short evolving-workload windows. Both trial flags reverted without killing
  finite restoration; 134 focused tests pass. Same-run legacy recheck and
  limitations: docs/harvest-efficiency-2026-10-24.md. Ongoing assessment remains
  active, with no augmentation/reset authorization implied.
