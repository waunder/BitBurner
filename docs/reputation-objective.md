# Reputation objective

**Hypothetical raised-cap 4TB allocation:** live Formulas quote September 12 gives 999 threads at 4.1GB/thread, 4095.9GB, one core, share power 1.280600. Relative to the current four-core 31-thread allocation (power 1.149527), projected NiteSec rate is approximately 3.673 rep/sec versus 3.297: +11.40%, ~1,353 additional rep/hour, ~10.24% shorter remaining wait. Versus no sharing (2.868 rep/sec), the total boost is about 28.06%. Cost $225.28m, approximately 30.3% of the quoted $744.34m cash. Compared with the proposed 256GB cloud allocation (3.354 rep/sec), 4TB adds approximately 9.51% for sixteen times the purchase cost. Recommendation remains the small 256GB allocation unless reputation is the overriding bottleneck; dedicating all 4TB to sharing gives no hacking XP/money from that server. Limits unchanged and no purchase made. Evidence: `evidence/reputation-objective/cloud-4tb-quote.json`.

**Cloud recommendation, September 12:** buy one 256GB server for $14.08m (1.89% of the quoted $744.27m balance), then restart MCP so sharing relocates. Capacity adds 256GB; sharing grows from 31 threads/127.1GB on four-core avmnite-02h to 62 threads/254.2GB on a one-core cloud host, freeing the old host for hacking. Live Formulas quotes project power 1.169415 versus current 1.149527: about +1.73% reputation relative to current sharing, or 3.354 versus 3.297 NiteSec rep/sec (~205 extra rep/hour), assuming unchanged work, skills, multipliers and no other sharers. Monetary payback remains unmeasured because the worker pool is preparing its target. Opportunity cost is $14.08m plus 127.1GB more RAM reserved for sharing; approximately 128.9GB net additional capacity remains available to hacking. This small purchase is affordable, but 512GB ($28.16m), 1TB ($56.32m), and 4TB ($225.28m) produce the same capped reputation benefit. Do not buy those sizes solely for reputation. No purchase made by Codex. Evidence: `evidence/reputation-objective/cloud-quote.json`.

```text
run purchase_worker_server.js 256
run restart_mcp.js
```

**Measured Steam benefit, September 12:** a controlled on/off/on observation of NiteSec work at H303 showed 3.297 → 2.868 → 3.297 reputation/sec. Sharing adds 0.429 rep/sec (14.96%, about 1,544 rep/hour) and reduces time for a fixed remaining reputation requirement by about 13.0%. Each policy transition settled for approximately 22 seconds; reputation objective stayed selected and sharing was restored. Rates are UI-rounded and this is a short faction-work sample. Cost: 31 threads/127.1GB that cannot simultaneously hack. Script money was zero during server preparation, so this sample cannot quantify sustained money opportunity cost. Keep reputation mode while faction reputation is the bottleneck; return to XP for the hacking-level objective. Evidence: `evidence/reputation-objective/steam-impact.json`.

MCP now supports `money`, `xp`, and `reputation`. Reputation mode reserves up to 256GB on one host for a single share worker, with the remaining ordinary/cloud worker RAM following the existing money policy. Sharing increases faction-work reputation; it neither selects a faction nor starts player work and it does not boost company-work reputation. Choose faction work in the game before selecting reputation.

Ken explicitly overrode the historical sharing restriction on 2026-09-12. The policy is enabled and the new release is deployed to Steam. Use:

```text
run set_objective.js reputation
run set_objective.js money
run set_objective.js xp
run set_objective.js clear
```

No argument prints the resolved objective and sharing state. `clear` returns to the source configuration. A disabled or invalid reputation policy rejects the reputation command without changing the previous objective. The checked-in policy is enabled with a 256GB ceiling.

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

Source: [v3.0.1 sharing implementation](https://github.com/bitburner-official/bitburner-src/blob/v3.0.1/src/NetscriptFunctions.ts#L377). The bounded new implementation was tested in a separate browser save; that test is not proof that the old Steam incident cannot recur. Ken subsequently overrode the restriction and authorized Steam activation. The legacy worker is unchanged as evidence. Steam source was readback-verified and MCP restarted. During Steam verification, remote worker liveness required explicit host arguments; owner checks now query home and controller checks/kills query the worker host. The local fixture now enforces that distinction.

## Validation

Twelve focused local tests cover physical/configured/hard RAM caps, invalid policies, blocked-command preservation, owned-only retirement, duplicate-generation handling, idempotence, copy/exec failures, retry cooldown and worker owner exit. Existing MCP logic and multi-target tests are also checked. Browser evidence accompanies this document under `docs/evidence/reputation-objective/`; it exercises the actual game sharing API, multiple ten-second cycles and cleanup on returning to money. It does not measure faction-reputation ROI or certify the full MCP suite under Steam load.

All 102 focused/existing tests passed. The browser run used two threads consuming 8.2GB: share power settled at 1.043944 and the same worker survived five reconciliation samples without duplication. Returning to money removed the worker, released all 8.2GB, and restored power to 1 after settlement. This is a sharing-power measurement, not a measured 4.4% increase in actual faction reputation.

Steam activation: final run `mtyrug98-hky`, worker PID 657 on avmnite-02h, 31 threads and 127.1GB. After thirty seconds the same PID remained active, share power reached 1.149527, and MCP reported no invariant violations. NiteSec faction work was visible in the UI. This short observation establishes operation, not long-term stability or actual reputation ROI. The large MCP transfer exceeded the daemon's default 64KiB control-request limit; temporary text chunks were assembled in-game and the complete source readback matched the local file exactly. The transfer limit remains a separate tooling issue.
