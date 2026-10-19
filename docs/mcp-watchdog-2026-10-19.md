# MCP progress watchdog — 2026-10-19

Ken authorized detection and safe repair of fresh-heartbeat/no-progress stalls.

## Implementation

`mcp_watchdog.js` is imported by the existing maintenance steward. No additional
persistent process is needed. Every 30 seconds it independently scans eligible
rooted/cloud worker hosts and their actual action processes. It excludes home
and RAM occupied by unrelated scripts. Per-process cumulative XP/money, job
membership and target/batch changes are progress evidence; player coursework
and lifetime-average XP rates are deliberately excluded.

A fresh money/XP status plus less than 25% action utilization, at least 32 GB
usable capacity and 16 GB spare must show no progress for three minutes.
Manager context changes and sampling gaps over 90 seconds reset the timer.

- No active action jobs with a selected target: request the normal supervisor
  restart after independently checking that jobs remain absent.
- XP finite drain whose remaining jobs all have exact durable security-only
  batch evidence: revalidate manager context, filenames, arguments and process
  identity, then cancel only those preparation jobs. MCP resumes on its next tick.
- Unknown jobs, harvest/grow compensation, no target or other active jobs:
  report an alert while preserving work.
- Stale telemetry retains the existing separate recovery path. All repair
  attempts, including failed ones, share its 15-minute cooldown. Exceptions
  produce evidence rather than terminating the steward.

`maintenance_status.json.progress` contains the assessment and inputs.
`maintenance_history.txt` retains the latest 100 health transitions/repairs.
The existing automation reviewer surfaces fresh progress alerts on the HUD.
The new module is included in `sync_manifest.json`.

## Tests and deployment evidence

122 tests pass across watchdog, maintenance, automation health, finite cloud and
scheduler suites. Cases include fresh heartbeat with no jobs, known security-only
orphan drain, mixed/unknown restoration jobs, progress resets, cooldowns, status
staleness, objective/context changes, sampling gaps, host/RAM accounting, missing
batch evidence, new jobs before repair and changed objective before repair.
Recovery decisions and runtime mutation guards were exercised with mocked game
APIs; no artificial stall was introduced into the live Steam save.

Steam/Remote API were refreshed before deployment. Source sync delivered the
existing 103 watched files; the running daemon caches its manifest at startup,
so the new manifest-listed module was additionally delivered by explicit
ctl-push. Future daemon starts load the expanded 104-file manifest. Direct
Remote API readbacks of final watchdog and steward exactly matched local files.

Steam terminal confirmed final maintenance steward PID 2693 and reviewer PID
2488. Only these consumers were restarted; the healthy MCP manager was retained.
Ken changed the live objective to money through his terminal during this work;
monitoring followed that objective without changing it.

At 2026-10-19 12:45:35 PDT (direct maintenance_status.json read), progress-v1
reported `none / low utilization; observing action progress`, 1484 GB usable
worker capacity, 96.25 GB active actions, three action processes. No repair was
requested. An earlier sample at 12:44:23 PDT showed 1039.5 GB active actions,
11 processes and a healthy assessment. This variance is expected finite-cohort
behavior and illustrates why low utilization alone must not trigger recovery.
The pre-existing recovery count 179 and last recovery timestamp 1792436444013
remained unchanged. The automation reviewer reported no alerts. A second final-code poll at
12:46:05 PDT advanced normally, observed two jobs/94.5 GB active RAM and
reset the grace start on actual intervening progress; no repair was requested.

## Cost and limits

The cost is one small network/process inspection every 30 seconds within an
already-running steward. Expected payoff is reclaiming minutes of idle network
capacity after a proven stall. Normal healthy monitoring has required no repair
so far; sustained uptime and recovered capacity remain future observations.

Missing batch-start history prevents automatic cancellation by design. The
watchdog alerts on uncertain active work instead of guessing what may be killed.
It detects severe underutilization with no progress; it is not an optimizer for
busy but inefficient allocations. Repairs depend on the maintenance steward and
existing supervisor continuing to run.
