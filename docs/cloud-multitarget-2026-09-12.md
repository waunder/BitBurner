# Cloud capacity for multiple targets

September 12 steering supersedes the conservative recommendation below: Ken explicitly requested aggressive use of existing resources and direct Steam testing. Implemented `mcp_cloud.js` under the existing MCP, 50% finite harvest/restore/weaken cohorts, up to 32 target slots as RAM permits, with 254.2GB sharing retained. It is separate from the old `mcpMulti.js`, which remains inactive. Initial test reached approximately 99% RAM use and completed max-hardware harvests at full restoration/minimum security, plus phantasy and n00dles activity. Long preparation calls account for much of the initial pool usage; this is not yet a sustained income comparison.

Control: `run set_cloud_mode.js status`, `run set_cloud_mode.js off`, or `run set_cloud_mode.js on 120` for a two-hour run. The initial test expires automatically after two hours and returns to the prepared phantasy fallback. Selecting XP also exits cloud money mode. `get_target_stats.js` is deployed and live, showing only selected targets with aggregate action counts across execution hosts. Consolidated HUD now exposes target phases and expiry.

An initial assembler error detected an omitted sixth source chunk and aborted before replacing MCP. The missing chunk was delivered; all nine final source/display files were subsequently verified by exact readback. Final module includes partial preparation when the full money-deficit restoration exceeds available RAM; without it, low-growth servers could require more RAM than the entire pool and never progress. Local checks: 128 passed. Steam is the integration environment by Ken's explicit instruction.

Recommendation: keep the corrected single-target farmer as the baseline, then test two targets with separately bounded hack/grow/weaken plans. Preserve the 256GB sharing reserve. No additional cloud purchases are justified by the present capacity.

The read-only Steam Formulas probe at H493 found three 4TB workers. A prepared, one-core, approximately 10% withdrawal plus restoration and security compensation needs the following total action RAM:

| Target | Batch RAM | Prepared cycle estimate | Projected money/sec |
|---|---:|---:|---:|
| phantasy | 165GB | 64s | $920K |
| silver-helix | 212GB | 113s | $971K |
| omega-net | 243GB | 159s | $988K |
| computek | 291GB | 399s | $1.16M |

These are projections, not measured scheduler income: one withdrawal per weaken-duration plus ten seconds, successful-hack probability included, all actions assumed at minimum security. They exclude preparation, interference and real scheduling delays. Grow assumes the entire withdrawal succeeds; security compensation is conservative. Most targets currently start at 4% money and elevated security. Phantasy is already full and is the current acceptance target. Silver-helix or omega-net is a useful second trial candidate once prepared. Cloud servers are execution hosts; targets are ordinary money servers.

The listed four batches together use about 911GB versus 12,288GB purchased capacity (254.2GB reserved for sharing). This supports spreading useful demand instead of using thousands of redundant grow threads on one full target. More RAM alone will not shorten game action duration; subsequent acceleration requires multiple targets or carefully spaced overlapping batches with tracked obligations.

Do not enable the existing `mcpMulti.js live=1` as it stands: it still uses looping launches and host-implicit running-script lookups, and its scoring/partition assumptions predate the cap. Port the tested completion/launch behavior, retain per-target in-flight hack budgets, reserve restoration RAM, prevent two managers owning the same workers, browser-test, then measure a two-target pilot against the single-target baseline. Acceptance is increased money/XP without deteriorating money/security or reputation allocation.

Evidence: `evidence/full-money-2026-09-12/cloud-targets.json`; probe source alongside it. No purchase, reset, or multi-target launch was performed.
