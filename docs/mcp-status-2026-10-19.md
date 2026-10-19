# MCP live effectiveness check — 2026-10-19

Sources: Steam UI and direct Remote API reads; post-recovery telemetry at 2026-10-19 12:31:05 PDT.

## Finding and intervention

Ken selected XP at event timestamp 1792437824899. MCP then drained all
finite money cohorts globally before allowing the continuous XP planner.
Three security-only preparation threads initially blocked that handoff:
omega-net PID 235 (1 thread, original weaken duration 1016 seconds) and
the-hub PID 547 (2 threads, original duration 1666 seconds). Their combined
5.25 GB allocation left the eligible 684 GB pool almost entirely idle.
Draining status projected an empty worker list, misleadingly showing zero
workers rather than the few jobs still running.

Omega-net completed naturally during diagnosis. Stopped PID 547 through the
Steam terminal and ran restart_mcp.js. No hack/grow restoration was cancelled.
Changed cloudTick so a tracked security-only preparation cohort is cancelled
on XP selection, emitting cloud_batch_cancel. Harvest and money-preparation
cohorts still drain; untracked finite jobs after restart remain conservative.
The tradeoff is forfeiting the unfinished weaken's eventual XP/security benefit
in exchange for immediately releasing the full pool for the selected objective.

## Verified result

- Full manifest sync: 103 files, no failures or missing files. Remote readback
  of mcp_cloud.js exactly matched local source; restarted MCP PID 950.
- Run mvfng9ud-r688: continuous XP, target foodnstuff, phase security-and-growth.
- 20 worker hosts, 384 action threads, 672/684 GB used (98.25%).
- Script XP rate 339.5/s; hacking level 439.
  This is the game's total script XP-rate metric, not a long-term benchmark.
- No worker launch failures or invariant violations in this sample.
- Money rate is zero during preparation and is not the selected XP objective.
- 11 cloud tests and 89 scheduler tests pass. Cloud fixtures were stale against
  existing 75% harvest, security margin, cloud API, and conservative drain behavior;
  refreshed them and added XP cancellation/restoration regressions.

## Other observations and limits

Steam showed Algorithms coursework, about $42.5m, and no gang in the current
reset (startup output). The old October 16 gang/capital snapshot is historical.
Player work was left as observed. Startup/restart also reported failure to start
the player activity controller; no automatic player-work changes were attempted.
Darknet HUD was stale with zero managers; no current Darknet ROI is established.

The target stats window's 3.40 TB total includes home. MCP deliberately excludes
home; its eligible worker pool is only 684 GB. Thus remaining home RAM should
not be described as idle eligible MCP capacity. Initial diagnosis showed roughly
3.2 TB idle in that broader display; this was not the scheduler's actual pool.
