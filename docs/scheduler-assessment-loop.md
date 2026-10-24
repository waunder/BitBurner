# Scheduler assessment and improvement loop

Ken requested an ongoing assessment/improvement loop on 2026-10-24, and
reconfirmed ongoing authority to modify scripts, commit and push. The existing
AGENTS.md installation/reset/permanent-progress approval boundary still applies.

The active thread heartbeat is `bitburner-efficiency-assessment`, every 30 minutes.
It stays quiet during healthy unremarkable progress and reports material changes,
failures, regressions or a real user decision. The unrelated old autonomous-campaign
heartbeat and retired SQLInject automation remain paused.

On each assessment:

1. Read current handoff/ledger, refresh Steam and Remote API, and inspect embedded
   telemetry timestamps. Never infer current progression from historical snapshots.
2. Check realized cash deltas, completed cohorts, preparation balances, worker
   failures, watchdog state, and the opportunity cost of occupied/reserved RAM.
3. Form one concrete hypothesis and use a reversible flag for risky scheduler
   changes. Compare actual affordable plans; static max money or RAM utilization
   alone is not an efficiency objective.
4. Run meaningful regression checks; deploy exact verified source and restart
   only what must reload. Preserve finite hack/grow compensation and unrelated work.
5. Let old cohorts drain, measure representative cash/progress windows, and
   compare capacity, player skill, objective and target balances. Label short or
   confounded comparisons honestly; revert regressions and retain supported gains.
6. Record decision inputs/outcomes in dated docs and keep STATE.md short/current.
   Commit/push coherent reviewed source and evidence, excluding generated runtime logs.

Latest completed assessment: affordable harvest ranking with equal/weighted
cohort caps did not establish better cash income, so both flags are off. See
`docs/harvest-efficiency-2026-10-24.md` for rates, confounders and the next
preparation-matched hypothesis; raw snapshots are under
`docs/evidence/harvest-efficiency-2026-10-24/`. The normal
money objective remains the authority for what workers should optimize; no
installation, reset or BitNode transition is implied by this recurring loop.
