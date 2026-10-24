# Meaningful finite preparation chunks — 2026-10-24

Ken authorized concentrating preparation rather than issuing token leftover jobs.
Steam/Remote API inspection found 1-thread weaken cohorts on targets with ~29–30
excess security and 15–18.5-minute calls. Each could only remove 0.05 security,
then target exclusion prevented reinforcement until that cohort finished.

## Change

Finite module fingerprint `finite-preparation-chunks-v7`. Partial security and
money preparation must consume at least 25% of total fleet preparation allowance,
capped at the full required plan. On the verified 412GB fleet with 85% preparation
allowance, the minimum is 87.55GB. Complete smaller plans remain admissible.
Grow plans retain compensating weaken allocations. Placement fragmentation cannot
silently shrink a plan below the minimum. Waiting status records original required,
minimum, and currently available RAM. Explicit `minimumPreparationFraction: 0` in
the game-owned cloud control file restores old admission, without killing workers.

The expected benefit is fewer long target locks and meaningful progress per cohort.
The opportunity cost is idle remainder RAM while awaiting sufficient capacity;
rank ordering and harvest admission/reservations remain unchanged. Existing jobs
are preserved; tiny old preparations must drain before disappearing from the HUD.

## Deployment and verification

2026-10-24 ~10:00–10:02 PDT, Steam UI and direct Remote API:
full 104-file source sync succeeded, exact module readback matched local source.
Routine supervisor restart request could not launch restart_mcp.js due to home RAM.
Temporarily stopped the 32.15GB crime_returns.js diagnostic, ran restart_mcp.js,
and verified new run mvmnbfr3-j118 with the new source fingerprint. Exact finite
cohorts were adopted; grow/hack restoration was not killed. Routine restart also
started the operations HUD; stopped that temporary HUD so the original crime
returns diagnostic fit again, verified its PID 2142, and closed obsolete tails.
Restored focused NiteSec work at 1.961 rep/s. No purchases, installations or resets.

First post-deploy samples: timestamps 1792861283204 and 1792861350035, 66.831s
apart. Completed cohorts 0→8; hacking receipts +$2,021,351 (~$30.2k/s).
New Phantasy preparation used 287GB (151 grow, 13 weaken). Sigma Cosmetics used
68.25GB (39 weaken), its complete required security preparation. New insufficient
chunks deferred with measured minimum/available RAM. No worker launch failures,
no invariant violations, maintenance progress healthy. This is a functional
production check, not a controlled claim of higher steady-state cash income.

128 focused tests pass across finite scheduling, scheduler logic, target reporting
and watchdog. New regressions cover deferral/re-entry after capacity returns,
explicit-zero rollback, and fragmented grow plans respecting the minimum.
Raw before/after evidence: docs/archive/target-preparation-2026-10-24/.
