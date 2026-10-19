# Current BitBurner Handoff

Last refreshed: 2026-10-19 12:31:05 PDT. Source: Steam UI and direct Remote API.
Prior handoff archived at `docs/archive/mcp-check-2026-10-19/STATE-before-check.md`.

## Current objective

Ken asked whether MCP works effectively. Live objective is `xp` through the
in-game override. Preserve his Algorithms coursework and manual player-work
control. Augmentation installs/resets still require explicit approval.

## Verified live state

- Steam Remote API connected at 127.0.0.1:12526; control 12527. Full sync
  delivered 103 manifest files without errors; mcp_cloud.js readback matched.
- Found XP globally blocked by tiny, long security-only finite cohorts. Fixed
  tracked cohort cancellation on XP selection; harvest/grow restoration still
  drains. Recovered live via stopping the remaining preparation PID 547 and
  restart_mcp.js; MCP PID 950, run mvfng9ud-r688.
- 20 eligible hosts, 384 threads, 672/684 GB in use (98.25%); foodnstuff
  security/growth preparation, 339.5 script XP/s, H439.
  No worker launch failures/invariant violations in the sampled status.
- The target display's 3.40 TB includes home; MCP reserves home and excludes
  it from worker capacity. Do not interpret that display as all eligible RAM.
- Current reset has no gang per Steam startup output; old Black Hand gang
  snapshot is historical. Steam showed Algorithms coursework and ~$42.5m.
- Darknet HUD stale/zero managers. Player activity controller failed to start
  during startup/restart; player work remains manually controlled.

## Outcome and follow-up

MCP is producing XP again. 100 tests pass. Detailed evidence, tradeoff and
limits: `docs/mcp-status-2026-10-19.md`. No pending action for Ken.
Recheck fresh live telemetry before further gameplay decisions; reported XP
rate is a short sample, not a sustained efficiency benchmark.
