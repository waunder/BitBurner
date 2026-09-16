# Full-money harvest and worker completion

Ken authorized the correction September 12 after observing phantasy at $600M/$600M, security 7/minimum 7, while MCP showed 552 weaken, 6784 grow and zero hack. This state should produce money instead of launching growth that cannot increase the balance.

## Behavior and limits

Money and reputation objectives use a full-money harvest regime. Above the recovery security threshold, new work is limited to necessary weaken. At acceptable security and full money, new work is hack with maintenance weaken and no grow. A shared network allocation budget is `max(1, floor(HACK_WITHDRAWAL_FRACTION / ns.hackAnalyze(target)))`, currently a 25% withdrawal, with a one-thread minimum. The reserve uses the existing hack-security and action-duration ratios. Money below full returns to the existing growth-aware weights while retaining the same network hack cap: large cloud pools must not drain the balance in one short hack call before slower growth completes. XP work weights remain distinct.

The 25% starting policy is deliberately bounded rather than a demonstrated optimum for sustained income. Retained in-flight hacks consume the budget before new hacks can launch; if they already exceed it, no additional hacks are requested. Previously started calls are allowed to finish and cannot be retroactively capped. A grow that began below full may finish after money becomes full. XP recovery retains grow for experience. Idle capacity under small useful demand is intentional; expanding to another target requires separate marginal-return evidence.

Normal MCP workers run continuously: reassessment changes their desired allocation without creating a completion/relaunch gap. The separately controlled cloud multi-target scheduler supplies the optional second worker argument `once` for its bounded cohorts. A target switch or manager restart can still retire workers immediately.

Legacy replacements release all changed jobs before any new action launches, then launch weaken before grow before hack. Remote age lookups specify the worker host, and unavailable age defaults to zero for legacy-job protection. Failed launches enter allocation `launchFailures`, status `workerLaunchFailures`, and the `workerLaunchSucceeded` invariant/event path. Each allocation exposes desired and observed actions. Normal ticks retry absent work; there is no tight recovery loop.

## Acceptance and evidence

- Actual planning-wrapper tests cover full money/minimum security, security recovery, depleted-money regrowth, and preservation of XP weights.
- Allocation tests cover zero grow during full-money recovery and a single shared hack budget across small and 4TB hosts.
- Actual execution-helper tests cover full-RAM replacement ordering, finite-call preservation, wrong-target replacement, explicit remote-host age lookup, unavailable age, and durable launch-failure inputs.
- Browser integration uses real NS calls on n00dles: a full-RAM finite grow survives a changed allocation, completes, then releases RAM for weaken; finite hack calls finish and relaunch across two cycles while weaken is preserved; all worker RAM ultimately releases. It includes changed security and money and a real remote process-age lookup. The resumed harness uses the final execution helpers. A clean test-start cleanup handles workers restored by a browser reload; closing the earlier tab had caused a harness-start collision, rather than an allocation failure.
- Steam acceptance requires exact source readback against `evidence/full-money-2026-09-12/source-manifest.json`, the new manager version and `workerMode: finite`, full-money harvest with zero new grow, a completed harvest followed by regrowth, and no launch failures in a bounded observation. Sustained money/XP ROI remains a subsequent measurement rather than inferred from RAM utilization or finite-process income estimates.

Evidence resides in `docs/evidence/full-money-2026-09-12/`. Initial status of browser and Steam checks: pending at implementation time; final results are recorded below after execution.

September 12 execution: 119 local checks passed; all eight browser checks completed successfully. All five Steam source files matched the SHA256 manifest, and manager version `1f5usex` started with `workerMode: finite`, reputation and sharing preserved. Automatic adoption selected unprepared computek (approximately 19 minutes for its initial weaken), so the bounded acceptance run explicitly pins the already prepared phantasy. The pin is visible in startup events and manager arguments.

Target ranking remains approximate: its older balanced-pool score does not model the new 10% cap. It must not be treated as achieved income. The minimum one-thread policy can exceed 10% on easy targets. Mixed legacy and finite jobs can still be replaced together; normal startup cleanup retires inherited jobs before migration.

Steam acceptance observed recovery from 9.506 to minimum security 7 with zero grow, full-money harvest with 24 hack threads and zero grow, then completed withdrawals ($110.8M at the captured regrowth sample) and replenishment jobs. No launch failures or invariant violations; reputation remains selected. The cap limits concurrent in-flight hacks, not cumulative withdrawals while slower growth completes. Growth below full still fills spare RAM under the existing allocator, so precise restoration sizing is a material next optimization before spreading targets.

## Rollback

Final bounded Steam observation completed two regrowth-to-full transitions, then resumed harvesting; $378.5M withdrawn, security back at 7, no launch failures/invariant violations. See `steam-cycle-complete.json`. Ken subsequently requested aggressive use of existing resources for multiple targets; this supersedes the proposed conservative two-target phase, but does not remove browser integration checks or the reputation reserve.

Deliver the pre-change `mcp.js` and `mcp_logic.js` (parent of the implementation commit), then restart MCP. The optional worker argument remains backward compatible with the old caller. Do not change reputation policy, install augmentations, purchase servers, or touch stock automation as part of this correction.
