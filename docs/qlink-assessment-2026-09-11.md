# QLink assessment — September 11, 2026, about 14:02 PDT

Recommendation: keep the money farm running and reserve QLink as the next augmentation purchase. For an active acceleration step, start with one 4,096GB cloud worker and measure the resulting income before buying more. No purchase or gameplay-policy change was made in this assessment.

## Live evidence

Steam Bitburner v3.0.1 (3162fd2), Remote API reconnected to localhost:12526. The new listener has automatic source sync and telemetry pulls disabled; this avoids overwriting the game's source during observation. Direct API reads succeeded. One finite read-only qlink_observe.js script was uploaded and run; it wrote qlink_observation.json and exited.

- QLink screen: $50 trillion, 1.875 million reputation, no missing prerequisite shown; queued augmentation price multiplier 1.000.
- Illuminati reputation: 7.137–7.139 million; favor 104.551. Reputation already exceeds the requirement by 5.26 million.
- Cash at final diagnostic: $35.479 trillion, leaving $14.521 trillion.
- Game-reported total script income: $2.401 billion/sec. At that rate the gap takes approximately 101 minutes. Use roughly 1.5–2 hours as a planning estimate, not a promise: income is variable and telemetry records prior long tick delays.
- Money sources since install: hacking $35.424t, Darknet $54.480b, contracts $675m. Hacking accounts for roughly 99.84% of positive income. No stock, gang, corporation, or work income this install.
- MCP is in money mode, targeting ecorp, with 43 worker hosts, 2,572GB total worker capacity, about 99% utilization, and no cloud workers. Formula ranking and R8 are enabled.
- Home has a running scripts/share.js process with 65,481 threads. Player is taking Algorithms. Share boosts faction work, so this allocation does not advance the current money gate. Do not infer that stopping it automatically increases income: the game's retrieved mcp.js explicitly skips home and kills home action workers.
- Hacking 4,270; the HUD's 4,500 goal concerns w0r1d_d43m0n, not purchasing QLink. The course is not a QLink prerequisite.

## Small capacity investment proposal — not executed

Live cloud quotes:

| Additional RAM | Cost |
|---|---:|
| 1,024GB | $116.785m |
| 4,096GB | $672.682m |
| 16,384GB | $3.875b |
| 65,536GB | $22.318b |
| 1,048,576GB | $740.457b |

Limit: 25 cloud servers, zero currently owned.

Proposed initial cap: one 4,096GB worker for $672.682m (0.0019% of available cash). This raises nominal worker RAM from 2,572GB to 6,668GB, a 159% increase. Existing MCP discovers cloud hosts and deploys workers; this path is present in the retrieved game source. Additional RAM is not a measured income multiplier: ecorp growth, security, scheduler allocation and game execution speed may constrain returns.

A deliberately modest illustrative benefit of +$100m/sec repays the purchase in 6.7 seconds after ramp-up; +$10m/sec repays in 67 seconds. Neither rate has been measured. More than roughly $112k/sec of extra income would repay the purchase within the current 101-minute runway, before allowing for startup time. The cash cost alone adds about 0.28 seconds at current income. XP benefit is unmeasured and secondary to this goal.

If implemented in a later task, collect a matched baseline and at least 10 minutes after deployment (current grow/weaken cycles last roughly 210/262 seconds); verify workers appear and compare cash gained per wall-clock second. Stop adding capacity if it does not improve net income or causes responsiveness problems. Reassess the same day, before any second purchase. Existing home RAM is an alternative with no purchase cost, but using it requires a tested scheduler change and an explicit bounded allocation; that engineering work may exceed this short runway.

## Other advice

Buy QLink before NeuroFlux or any other queued augmentation: each queued purchase raises later augmentation prices. Avoid an augmentation reset before purchasing QLink, because current cash and reputation would be lost. More faction work, donations, or share capacity are unnecessary for this purchase. Keep the game running and the computer awake; prior long scheduler tick intervals make wall-clock estimates uncertain, without proving the cause of those intervals.

Source verification of cloud pricing and upgrade differences: https://github.com/bitburner-official/bitburner-src/blob/v3.0.1/src/Server/ServerPurchases.ts . Augmentation purchase behavior: https://github.com/bitburner-official/bitburner-src/blob/stable/src/Augmentation/Augmentations.ts . Live prices above take precedence over baseline documentation.

Raw evidence: docs/evidence/qlink-2026-09-11/observation.json and mcp-status.json. UI observations are transcribed above. Local client limitation encountered: ctl-dump uses a 64KiB line reader and fails for large source files; a read-only socket request successfully retrieved mcp.js with an unrestricted line reader. No daemon code changed.
