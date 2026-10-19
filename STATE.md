# Current BitBurner Handoff

Last refreshed: 2026-10-19 14:21:45 PDT. Sources: Steam UI and direct Remote API.
Prior handoff: `docs/archive/scheduler-efficiency-2026-10-19/STATE-before-efficiency-trial.md`.

## Current objective and outcome

Ken questioned scheduler churn and endorsed measured changes. Completed an
A/B/A cash comparison and retained completion-aware finite dispatch:
$2.032725m/s fixed → $2.269217m/s treatment → $2.032815m/s fixed, **+11.63%**.
Capacity stayed 1612 GB; main target/batch sizes stayed unchanged. Full
results/limits: `docs/scheduler-efficiency-2026-10-19.md` and dated evidence.

## Verified live state

- Steam Remote API connected at 127.0.0.1:12526/control 12527 after routine
  reconnect/full-sync verification. Final source readbacks matched mcp.js,
  mcp_cloud.js, mcp_config.json and get_target_stats.js exactly.
- Final MCP PID 11994, run mvfrd7nr-g7zh, manager 1ep5kgh, cloud policy
  finite-completion-reserve-v6. `CLOUD_COMPLETION_WAKE_ENABLED: 1` and normal
  `LOOP_SLEEP_MS: 10000`. Zero disables the completion feature without restart.
- Finite cohorts wake near expected final completion and reserve early-freed
  slots until restoration settles. Continuous XP/share/drain/error cadence is
  unchanged. Startup now retires legacy loops only; phantasy finite PID 11957
  survived restart and was validated/adopted by the new manager.
- Target panel PID 12057 now shows COHORT HELD separately from physical RAM.
  Seven panel tests and scheduler/watchdog coverage total 135 passing tests.
- Final 58.745s production check: $2.424750m/s receipts,
  H723–724, 1612 GB, no launch failures/invariant violations.
- Live objective remains money. Latest Steam observation showed Black Hand
  faction work; preserve that player choice. Earlier zero-gang/Darknet notes
  require revalidation rather than being carried as current facts.

## Decision and limits

Concern identified a real efficiency opportunity. Cash receipts prove the
measured improvement; persistent W/G/H allocation is still unproven and was
not substituted. Logged durations estimate unused RAM-time, not direct CPU
context-switch cost. One brief telemetry gap was bridged using unchanged-run
cumulative receipts; its elapsed time/outlier remain in the treatment result.

No pending action for Ken. Standing instruction now explicitly covers autonomous
investigation, trial, implementation, deployment and verification; augmentation
installs/resets/permanent-forfeiture approval boundary remains unchanged.
