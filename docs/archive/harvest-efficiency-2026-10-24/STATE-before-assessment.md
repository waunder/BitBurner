# Current BitBurner Handoff

Last refreshed: 2026-10-24 10:03 PDT. Sources: Steam UI and direct Remote API.
Prior handoff: `docs/archive/target-preparation-2026-10-24/STATE-before-deployment.md`.

## Current objective and verified outcome

Ken authorized fewer, meaningfully funded preparation allocations. Implemented,
tested and deployed `finite-preparation-chunks-v7` in mcp_cloud.js. Partial prep
now needs 25% of the total preparation allowance, capped at full-plan RAM;
87.55GB minimum on the observed 412GB fleet. Complete smaller plans still run.
Existing finite cohorts are preserved, so old tiny weaken rows drain naturally.
Rollback: game cloud control `minimumPreparationFraction: 0` (hot-read).

New MCP run mvmnbfr3-j118 verified ~10:01 PDT. Over 66.8 seconds, eight cohorts
completed and hacking earned $2.02m; Phantasy received 287GB prep and Sigma
Cosmetics its complete 68.25GB security plan. No launch failures/invariant faults;
maintenance healthy. 128 focused tests pass. Not a controlled income comparison.
Deployment evidence and tradeoffs: `docs/preparation-chunks-2026-10-24.md`.

Steam H346, ~$212m, focused NiteSec work restored. Prior day's Daedalus/$71t
snapshot is historical; current BitNode has not been freshly queried.
Routine restart required temporarily freeing diagnostic RAM; crime_returns.js
money restored (PID2142), temporary ops HUD stopped and obsolete tails closed.
104-file source sync and exact game module readback verified. No reset or
augmentation installation performed.

## Outstanding

Earlier gang recruitment/wanted issue remains unvalidated in this new progression
state; do not infer a live gang from yesterday. No remaining implementation or
deployment work for this preparation change. Longer cash ROI remains unmeasured.
Standing autonomy and augmentation/reset approval boundaries remain in AGENTS.md.
