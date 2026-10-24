# Affordable harvest admission assessment — 2026-10-24

Ken requested better cash efficiency after observing Harakiri Sushi receiving
about 501GB while Phantasy received about 19GB despite a better fitted return.
He also authorized an ongoing evidence-based assessment, script changes,
commits and pushes. No augmentation installation, reset, BitNode transition,
capital purchase or player-work change was needed for this trial.

## Implementation and decision inputs

The deployed module is `finite-weighted-harvest-v9`. Two independent game-owned
control fields make the experiment reversible; both default to false:

- `efficientHarvestAdmission` ranks complete, placeable, RAM-fitted harvest
  plans by expected withdrawal divided by charged RAM-seconds. With cohort
  reservations enabled, charged RAM includes the whole cohort until restoration
  finishes. Ready harvests precede new preparation; competing targets receive
  bounded cohorts rather than an unfunded full-plan rank determining admission.
- `weightedHarvestShares` replaces equal cohort caps with proportional caps for
  the top four positive return scores. Candidate plans use a common reference
  budget; running cohorts contribute their recorded expected return and cost.
  Caps are admission limits, not physical reservations for future expansion.

All harvests still reserve their full grow/weaken compensation before launch.
Existing finite cohorts survive control changes and the source restart. The
previous useful-preparation-chunk rule remains active. Flags are read on the
next MCP tick; rollback requires setting both false, without killing workers.
The weighted flag has no effect unless efficient admission is also true.

Equal sharing gave low-yield n00dles roughly 129GB. Weighted sharing reduced its
cap to about 7GB and assigned roughly 256GB to Phantasy, 158GB to Max Hardware
and 119GB to Harakiri Sushi on a 540GB fleet. Those are allocation inputs,
not evidence of cash improvement. An inherited 117.25GB Silver Helix security
preparation finished naturally; a new 117.25GB Omega Net money preparation then
used the released capacity while Phantasy was still running a smaller cohort.
Phantasy therefore remained around 137GB during the measured weighted window.
Reserving future expansion against preparation is a possible future hypothesis,
not an implemented or validated improvement.

## Measurement

Source: timestamped Steam Remote API `mcp_status.json` snapshots under
`docs/evidence/harvest-efficiency-2026-10-24/`. Rates are differences in the
manager's cumulative hacking-income counter divided by embedded timestamp
differences. Each reported window stays within one run ID and fixed fleet
capacity. Source readback exactly matched the tested module at
2026-10-24 18:06:47 UTC (11:06:47 PDT); the SHA-256 proof is in that directory.

| Policy | Elapsed | Realized cash/sec | Hacking | Fleet | Completed cohorts |
| --- | ---: | ---: | ---: | ---: | ---: |
| B: fitted ranking, equal caps | 121.562s | $77,372 | 350→350 | 540GB | 16 |
| A: legacy admission | 128.807s | $79,835 | 350→350 | 540GB | 6 |
| C: fitted ranking, weighted caps | 180.883s | $69,482 | 351→351 | 540GB | 24 |

B versus A was -3.09%; C versus the earlier A was -12.97%. Neither candidate
established an income improvement. Cohort counts cannot stand in for income:
n00dles contributes many completions with little money. B/A used run
`mvmofit5-yebn`; C used restarted run `mvmpbyhp-sunw`. No income counter delta
crosses that restart. All three windows reported no launch failures and no
invariant violations.

These are short production windows, not a randomized steady-state benchmark.
Player skill, target balances, stochastic hack outcomes, earlier allocations,
and preparation occupancy can change between windows. The C window begins
after the inherited security-only preparation finished, but includes new
money preparation. Earlier attempts interrupted by Remote API transport
disconnects are retained as evidence and excluded from completed comparisons.
The game's scheduler continued running during those transport interruptions.

A same-run legacy recheck followed C with 60 seconds for old harvest cohorts
to settle. It observed $109,290/s over 63.152 seconds, then a transport
disconnect interrupted the planned three-minute window. It is incomplete and
excluded from the completed comparison table. Omega Net preparation had finished
and Phantasy had expanded to 243.7GB, so even its short observed advantage is
confounded by workload. No income delta includes the later disconnected
wall-clock gap. Steam remained productive; the connection was recovered through
Options → Remote API, with 104-file sync and 29-file pull verified and focused
NiteSec work restored.

## Retention decision

Leave both experimental flags false. Equal or weighted shares have not earned
production retention on measured cash evidence. Keep the tested reversible
options available for a future preparation-matched assessment, without claiming
that these short confounded windows establish a universal policy regression.
The useful-preparation-chunk, completion wake and cohort restoration policies
remain active. There is no further source iteration justified by this trial.

The next useful hypothesis is whether preparation takes capacity a superior
running harvest would use on its next admission. Compare that opportunity cost
under matched target preparation and skill before introducing future-capacity
reservation or re-enabling weighted caps. Inspect realized return and restoration
health; a more even allocation or more completed cohorts is insufficient.

At 2026-10-24 11:57:18 PDT, fresh post-recovery legacy verification measured
$119,513/s over 66.53 seconds and eight completed cohorts, H351 and 540GB
throughout, run `mvmpbyhp-sunw`. Both flags were false; no launch failures or
invariant faults were reported. Maintenance marked MCP fresh. Phantasy used
243.75GB, Max Hardware 144.5GB, Harakiri Sushi 118.5GB and n00dles 17.05GB.
This verifies healthy productive rollback; preparation had finished, so it
does not establish a controlled policy advantage over C.

## Verification and continuing assessment

All 134 focused tests passed with
`node --test mcp_cloud.test.js mcp_logic.test.js mcp_watchdog.test.js get_target_stats.test.js`.
Coverage includes fitted ranking, reservation charges, proportional shares,
safe cohort placement, flag rollback, active-job preservation, preparation
chunks, restart adoption and watchdog behavior. `git diff --check` passed.
Source synchronization/readback and the running source fingerprint were
verified; source edits alone were not treated as a deployment.

The existing `bitburner-efficiency-assessment` thread heartbeat runs every
30 minutes under `docs/scheduler-assessment-loop.md`. It should use measured
cash and restoration health to form the next bounded hypothesis and stay
quiet for unchanged healthy operation. The unrelated old campaign and
SQLInject automations remain paused. Installation/reset approval boundaries
remain unchanged.
