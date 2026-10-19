# Scheduler efficiency assessment and cadence trial — 2026-10-19

## Question and initial finding

Ken proposed stable per-target weaken/grow/hack allocations adjusted gradually,
rather than repeated finite cohorts, and explicitly asked for independent
assessment. He then endorsed measuring changes and proceeding autonomously.

Steam UI and Remote API were refreshed on 2026-10-19 around 14:03 PDT. Remote
API was disconnected; reconnected through Steam Options, verified 103-file
full sync and full telemetry pull with no failures. Current objective money,
H700, working for The Black Hand. Player work/objective were preserved.

Retained durable events show 44 consecutive sigma-cosmetics harvest starts,
43 intervals spanning 430.389 seconds (13:55:52–14:03:03 PDT). Mean interval
10.0090s; mean longest scheduled action 8.6095s; mean excess interval 1.3995s.
The latest cohort has 265 hack / 588 grow / 58 weaken threads, with nominal
2.1361s / 6.8354s / 8.5442s action times. Worker pool 1612 GB. Its modeled
active action RAM-time is 8863 GB-seconds per approximately 10s cycle, about
55% of worker capacity over time. This is derived from launch durations and
counts, not a high-frequency direct RAM integration. Unrelated prep work adds
a small amount. No cancellation or launch-failure events were retained in the
300-event observation, supporting job completion rather than interrupted-work
thrashing. Actual recent hacking receipts were about $2.03m/s.

Evidence: `evidence/scheduler-efficiency-2026-10-19/observation.json`.

## Interpretation

The criticism identifies real unused capacity. Receipts established productive
operation; they never established optimal scheduling. The dominant measured
cost is waiting for the fixed scheduler cadence plus early-release slots, not
proven OS-style context-switch expense. Bitburner threads multiply an action's
effect/RAM; they are not individual OS worker threads. Installed v3.0.1 source
map confirms one NS2 main invocation per process, action delay captured at call
start, effect at completion, and finite-process cleanup on main return.

A persistent allocation is plausible but cannot reuse batch thread proportions:
hack repeats four times as often as weaken and 3.2 times as often as grow.
Current raw thread proportions are about 29.1% hack / 64.5% grow / 6.4% weaken;
nominal RAM-time proportions are instead about 10.9% / 79.4% / 9.8%. Even those
are only a planning starting point: security, per-host hack bursts, growth
saturation, core effects and completion ordering make continuously looping
allocations require feedback. Retuning must retire jobs at completion rather
than canceling in-flight work. A historical loop implementation's old faults
are evidence against replacing the current lifecycle without a controlled test.

Faster global polling alone has a hidden admission risk: long preparation
jobs could occupy early-freed harvest RAM and block its next cohort. The first
trial therefore uses completion-aware wake-up plus cohort-slot reservation.

## Trial plan and implementation

- Capture fixed-cadence baseline receipts/cycles over three minutes.
- Add opt-in `CLOUD_COMPLETION_WAKE_ENABLED`. Finite harvest cohorts wake near
  their predicted final action completion (100ms margin, 200ms retry floor,
  bounded by normal LOOP_SLEEP_MS). XP/share/draining/error paths retain their
  existing cadence.
- Hold RAM released by finished jobs until that cohort's restoration settles.
  It is free RAM physically but unavailable for new admission. On restart,
  adopt prior cohort metadata only after matching actual live process host,
  PID, filename, threads, target and batch ID. Preserve all existing finite jobs.
- Capture treatment receipts and cycles; return the flag to zero and capture
  fixed cadence again in the same new manager run. Compare actual hacking
  receipts, not wallet balance or launch-time utilization. Watch capacity,
  skill drift, launches/cancels and restoration health. Keep the setting only
  if actual results justify it; otherwise revert.

Theoretical elimination of the observed longest-action polling gap allows up
to ~17% more cycles at the sampled state. This is not a promised cash gain;
allocation/target changes may change the result. Persistent role allocation is
still a separate unproven optimization, not part of this narrow trial.

## Results and production decision

| Window | Actual seconds | Hacking receipts | Receipts per second | Main cycle median |
| --- | ---: | ---: | ---: | ---: |
| Original fixed cadence | 180.173 | $366.24m | $2.032725m/s | 10.010s |
| Completion-aware | 224.203 | $508.77m | $2.269217m/s | 8.483s |
| Return to fixed cadence | 180.179 | $366.27m | $2.032815m/s | 10.010s |

The fixed windows agree within about 0.005%. Treatment beat their mean by
11.63%, approximately $236,447/s or $14.19m/min during these observations.
Capacity stayed at 1612 GB and sigma-cosmetics cohorts stayed 265 hack / 588
grow / 58 weaken. Hacking skill rose H705–709 in the first control, H712–717
in treatment, and H718–721 in the second control. No launch failures or
invariant violations were observed; measured-window events contain starts and
completions, with no cancellations. A/B/A is observational, not a randomized
or long-term benchmark, but returning to the same cash rate with a more-skilled
player strongly supports the dispatch change's benefit.

The Remote API disconnected briefly near the intended treatment endpoint.
The game continued in the same manager run. Reconnected through Steam,
verified full sync/pull, and used the unchanged run's cumulative receipts to
bridge the capture gap. The actual treatment window was therefore 224.203s,
not 180s. Its full wall-clock denominator and a 14.474s outlier cycle are
included; nothing was removed to improve the result. The main treatment cycle
mean was 8.7248s, median 8.483s. Treatment and the second control used the same
manager run; the initial control preceded source deployment.

Retained `CLOUD_COMPLETION_WAKE_ENABLED: 1` with normal `LOOP_SLEEP_MS: 10000`.
The feature affects finite harvest dispatch only; it does not turn XP/share
loops into a fast-resizing controller. Rollback is setting the flag to zero;
no restart is needed for that policy change.

## Restart lifecycle correction and final verification

During implementation, source review exposed a contradiction: mcp_cloud tried
to preserve finite cohorts across restart, but mcp.js's unconditional startup
cleanup killed them first. The initial trial deployment cleared lingering
preparation jobs through that pre-existing path; its timed measurement began
afterward. Fixed cleanup to retire only legacy looping action workers. This
additional safety change affects startup, not normal trial dispatch.

Final production restart retained actual finite preparation PID 11957 across
manager replacement and emitted `cloud_batch_adopt` for phantasy cohort
`mvfr1yzq-t81m:cloud:87`. This is live evidence of the preservation guard, in
addition to its regression tests. Final MCP PID 11994, run `mvfrd7nr-g7zh`,
manager version `1ep5kgh`, cloud policy `finite-completion-reserve-v6`. Target
panel refreshed as PID 12057 and displays `COHORT HELD` separately from actual
RAM use/free RAM, explicitly marked as the manager snapshot.

At 2026-10-19 14:21:03 PDT, direct Remote API showed completion-aware policy,
no launch failures/invariant violations, and about $2.42m/s cumulative income
in the new run's initial observation. That short production sample is a health
check, not a replacement for the controlled 11.63% result. Exact source
readbacks of mcp.js, mcp_cloud.js, mcp_config.json and get_target_stats.js
matched local files. A subsequent 58.745-second production observation
measured $2.424750m/s, unchanged capacity and no launch failures/invariant
violations; it remains a short health check. 135 focused tests pass, including completion timing,
released-slot reservation, cohort identity/adoption, malformed prior records,
and startup preservation of finite jobs.

Standing autonomy instruction was added to AGENTS.md at Ken's explicit
request. Existing augmentation/reset/permanent-forfeiture approval boundary
is unchanged.

## What this establishes, and what it does not

Ken's concern identified a genuine scheduling inefficiency. The measured fix
improves cash without changing target or batch composition, discarding jobs,
or introducing a persistent-ratio controller. It does not establish that all
remaining idle RAM-time is recoverable, nor that persistent allocations are
inferior. The latter remain plausible but require a separate comparison of
actual cash, target balance/security and retirement-at-completion behavior.
Longer-lived assignments should be evaluated by completed useful work, not
by making the Active Scripts page look calmer.

Durable trial data and capture script are in
`evidence/scheduler-efficiency-2026-10-19/`. The capture script is one-off host
analysis using the local daemon, not a new live Netscript or scheduled job.
