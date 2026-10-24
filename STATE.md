# Current BitBurner Handoff

Last refreshed: 2026-10-24 11:57 PDT. Sources: Steam UI and timestamped direct
Remote API reads. Prior handoff is preserved in
`docs/archive/harvest-efficiency-2026-10-24/STATE-before-assessment.md`.

## Current objective and outcome

Keep improving scheduler cash efficiency through bounded, reversible trials.
The `bitburner-efficiency-assessment` heartbeat is active every 30 minutes;
workflow: `docs/scheduler-assessment-loop.md`. It reports material changes,
failures or a real decision and otherwise stays quiet. Older unrelated campaign
and SQLInject automations remain paused.

Deployed/tested module `finite-weighted-harvest-v9` adds affordable fitted-harvest
ranking and equal/weighted competing-cohort caps. Both experimental game-owned
flags are now **false**: `efficientHarvestAdmission`, `weightedHarvestShares`.
Equal caps measured $77.4k/s, earlier legacy $79.8k/s and weighted caps $69.5k/s
in short evolving-workload windows. No improvement was established; retain the
tested options dormant. Existing finite restoration was preserved throughout.
Inputs, interrupted attempts, caveats and next hypothesis:
`docs/harvest-efficiency-2026-10-24.md`.

The earlier useful-preparation-chunk policy remains active (minimum fraction
0.25, observed minimum 114.75GB at current fleet/prep settings). Completion-aware
wake and cohort RAM reservation remain active. No purchase, installation or
reset was performed. Player work remains focused NiteSec.

## Latest verified live state

At 11:57:18 PDT, Remote API status: H351, 540GB worker fleet, run
`mvmpbyhp-sunw`, fingerprint `finite-weighted-harvest-v9`, four harvest cohorts,
no launch failures or invariant faults. Phantasy 243.75GB, Max Hardware 144.5GB,
Harakiri Sushi 118.5GB, n00dles 17.05GB. Fresh post-recovery verification earned
$119,513/s over 66.53 seconds with eight completions; this is a health check,
not a controlled policy improvement claim. Maintenance reported MCP fresh.

Remote transport disconnected during the legacy recheck; its 63.152-second
partial observation was retained and excluded from completed comparisons.
Reconnect verified 104-file source sync and 29-file telemetry pull; focused
NiteSec work was restored. No cash delta spans the disconnected wall-clock gap.
Exact source readback matched local source. All 134 focused tests and
`git diff --check` pass.

## Outstanding

Next useful assessment: match preparation occupancy and player skill before
testing whether preparation takes capacity a superior running harvest needs on
its next admission. Do not equate allocation fairness or cohort count with ROI.
No further source iteration is justified by this completed trial alone.
Earlier gang recruitment/wanted issue remains unvalidated in current
progression. Standing autonomy and augmentation/reset approval boundaries
remain in AGENTS.md.
