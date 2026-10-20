# Current BitBurner Handoff

Last refreshed: 2026-10-20 08:52 PDT. Sources: Steam UI and direct Remote API.
Prior handoff: `docs/archive/money-panel-2026-10-20/STATE-before-money-panel.md`.

## Current objective and outcome

Ken requested renaming the money panel's `other` spending category and putting
negative entries below income. Deployed `hacking costs` to distinguish it from
existing `hacking` income, with signed descending sort. Syntax and exact game
source readback verified; panel PID 1994 visibly shows costs last. No pending
work or action for Ken.

## Live verification — October 20

Remote API reconnected through Steam Options and full sync/pull verified:
103 watched files, no failures. Restarted only the self-superseding money panel;
prior tail closed and saved position retained. Restored focused BitRunners
hacking faction work after navigation. Steam showed ~H631 and money objective;
these are new-reset observations, not yesterday's benchmark state.

## Prior measured scheduler work

Completion-aware finite dispatch remains committed with configuration flag 1;
this task did not change scheduler behavior. Yesterday's A/B/A comparison
measured +11.63% cash, with finite-worker preservation across restart. Details:
`docs/scheduler-efficiency-2026-10-19.md`. Treat its PIDs, rates, capacities and
progression snapshot as dated history; refresh before further gameplay work.

Standing autonomy and augmentation/reset approval boundaries remain in AGENTS.md.
