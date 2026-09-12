# Reputation objective

MCP now supports `money`, `xp`, and `reputation`. Reputation mode reserves up to 256GB on one host for a single share worker, with the remaining ordinary/cloud worker RAM following the existing money policy. Sharing increases faction-work reputation; it neither selects a faction nor starts player work and it does not boost company-work reputation. Choose faction work in the game before selecting reputation.

Once the protected Steam share restriction has been resolved and its policy explicitly enabled, use:

```text
run set_objective.js reputation
run set_objective.js money
run set_objective.js xp
run set_objective.js clear
```

No argument prints the resolved objective and sharing state. `clear` returns to the source configuration. A disabled or invalid reputation policy rejects the reputation command without changing the previous objective. The checked-in policy is disabled.

## Allocation and controls

`reputation_config.json` is a hand-authored, committed policy: `enabled` must be a boolean; `ramGb` must be a finite positive number no greater than 256. Edit it in the connected local checkout, not just the game, because routine source syncing owns that file. The objective itself is a durable game-side override (`mcp_objective_override.txt`), which source syncing does not replace. This matches the established money/XP override behavior.

The allocator chooses one host offering the largest capped allocation, uses the worker's actual game RAM cost, protects the configured controller reserve on home, and releases only that host's MCP action workers when starting a share allocation. Remaining MCP work is recomputed from the reduced reclaimable RAM. It never purchases capacity. This initial version caps RAM rather than assuming all spare capacity should share; returns diminish logarithmically.

Only `mcp_share.js` workers belong to this path. Legacy `scripts/share.js` allocations are not killed or adopted, so they can still consume RAM and contribute to the reported global share power. A generation signature and owner PID identify the worker; duplicate, obsolete, over-budget, or disabled owned workers are retired. The controller records an action ID, reason and result, and retries failed/no-capacity starts no more often than once per minute. Copy failures happen before active workers are released. Execution failures surface through MCP's invariant system rather than reporting healthy sharing.

Switching away from reputation or disabling its policy kills owned sharing on the next MCP tick. If MCP exits, the share worker checks owner liveness after its current ten-second call and then exits; allow roughly one cycle for resource/power settlement. The new worker measures 4.1GB/thread in v3.0.1 because the owner-liveness API adds RAM cost to sharing. Budget calculations read this value from the game rather than assuming the legacy worker's 2.4GB.

## Status and value

`mcp_status.json.reputation` carries requested/enabled state, reason, host, PID, threads, RAM, global share power, configuration, retry time and ROI review time. The MCP HUD displays objective and share state; the terminal objective query prints sharing information. Share start/stop/wait events use the existing bounded MCP event stream.

The ROI record includes baseline share power, reserved RAM, the opportunity cost of forgone money/XP on that RAM, and a review time thirty minutes after launch. Actual marginal faction reputation remains explicitly unmeasured. This version cannot verify the player's faction work without adding a Source-File 4 dependency; status therefore says faction work is unverified. It does not automatically stop when the player changes activity. Return to money/XP when no longer doing faction work. Do not interpret global power as measured marginal benefit from this allocation, especially with legacy workers present.

## Historical incident and release boundary

The project stop-list still restricts re-enabling Steam share automation after its stability incident until its root cause is sufficiently understood. The prior claim that `ns.share()` did not yield and needed a sleep is unsupported: official v3.0.1 implementation awaits a ten-second delay, with one process representing all its threads. The additional sleep in the legacy worker introduces downtime; it is not evidence of a resolved freeze mechanism. That historical root cause remains unknown.

Source: [v3.0.1 sharing implementation](https://github.com/bitburner-official/bitburner-src/blob/v3.0.1/src/NetscriptFunctions.ts#L377). The bounded new implementation was tested in a separate browser save; that test is not proof that the old Steam incident cannot recur. Steam sharing remains disabled, and the legacy worker is unchanged as evidence. A running MCP must restart to load these source changes before the new objective is available; no Steam restart or activation was performed during implementation.

## Validation

Twelve focused local tests cover physical/configured/hard RAM caps, invalid policies, blocked-command preservation, owned-only retirement, duplicate-generation handling, idempotence, copy/exec failures, retry cooldown and worker owner exit. Existing MCP logic and multi-target tests are also checked. Browser evidence accompanies this document under `docs/evidence/reputation-objective/`; it exercises the actual game sharing API, multiple ten-second cycles and cleanup on returning to money. It does not measure faction-reputation ROI or certify the full MCP suite under Steam load.

All 102 focused/existing tests passed. The browser run used two threads consuming 8.2GB: share power settled at 1.043944 and the same worker survived five reconciliation samples without duplication. Returning to money removed the worker, released all 8.2GB, and restored power to 1 after settlement. This is a sharing-power measurement, not a measured 4.4% increase in actual faction reputation.
