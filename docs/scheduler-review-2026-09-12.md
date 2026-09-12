# Scheduler review — September 12, 2026

Recommendation: repair objective-specific switching and worker replacement before introducing concurrent targets. The security-offset arithmetic is sound as a steady-state rate calculation, but the lifecycle implementation does not reliably preserve completed work or guarantee that the planned weaken threads launch. Multiple targets merit a bounded comparison after those defects are fixed; the existing multi-target script should not replace MCP unchanged.

## Current state and evidence boundary

The resumed Steam session is substantially different from September 11: hacking 275, approximately $680m, working for NiteSec, MCP in XP mode targeting phantasy, 16 worker hosts totaling 492GB. The previous QLink funding runway and 4TB-worker economics are historical observations, not recommendations for this run. This review did not establish whether QLink was acquired or how the reset occurred.

Remote API reconnected successfully with automatic source syncing and pulls disabled. Deployed mcp.js, mcp_logic.js and all three action workers exactly match local source. MCP reports version 62f735, run mtykyflb-dcj3. This verifies delivered files and the manager's reported identity; imported modules/workers do not independently report their loaded release.

## Findings, in priority order

### 1. XP selection is blocked by a money-only guard — live-confirmed

At timestamp 1789237801803, the normal XP selector rates foodnstuff 1.04397 versus phantasy 0.36369: a 2.87048 ratio, exceeding the 1.3 switch threshold. The hold condition is satisfied. R8 then compares MONEY scores: $119,629 versus $1,144,170, ratio 0.10456, and vetoes the switch. The durable recent events record the decision.

Cause: mcp.js:1549 enables R8 without checking OBJECTIVE. Its getFormulaMinimumSecurityScore helper is a money model. This contradicts the explicit XP objective. The label `switchEval.basis: effective` is also misleading here: these are XP scores.

Recommended repair: restrict the existing money guard to money mode, or define a separately tested XP guard. Do not substitute a money threshold into an XP decision. The 2.87 ratio is modeled per-thread XP potential, not a measured promise of 2.87 times total player XP.

### 2. Replacement can silently omit required weaken threads — locally reproduced

mcp.js:1125 processes changes in weaken/grow/hack order, killing and launching each script immediately. A full grow host has no free RAM when the new weaken job is attempted. Only afterward does the smaller grow job release memory. The failed exec result is neither retained as a diagnostic nor retried within that replacement pass.

The diagnostic harness executes the actual extracted allocateThreads function: on a 175GB host, changing 100 grow threads to 90 grow plus 10 weaken first fails the weaken launch at zero free RAM, then starts 90 grow, leaving 17.5GB unused and no weaken. Subsequent ticks may recover, but the intended protection is absent during that interval. This failure was reproduced locally, not attributed to a specific live missed launch.

Recommended repair: first release the memory from all jobs selected for replacement, then launch the new allocation with weaken first; record failed launches and desired-versus-observed counts. Couple this with the completion protection below so releasing memory does not itself destroy useful progress.

### 3. Process age is not the current action's age — locally reproduced

mcp.js:1030 reads onlineRunningTime, while mcp_logic.js:723 compares it with the current estimated action duration. All three workers loop indefinitely. A process aged 50 seconds with 32-second grow calls is already 18 seconds into its second call, yet the predicate permits killing it. Once the first cycle passes, this check offers no protection for later in-flight calls. Current duration can also differ from the duration captured when a call began.

Recommended repair: explicit completion/retirement acknowledgements or finite jobs whose completion is observed before resizing. Simple process-age modulo arithmetic is insufficient when durations change. Browser integration tests must exercise multiple cycles, security changes, and RAM contention before a new lifecycle reaches Steam.

### 4. Allocation mathematics is an approximation, not an exact large-server plan

The maintenance rates correctly include duration ratios: one hack thread requires 0.16 weaken threads, and one grow thread requires 0.10, before rounding, at one core (0.002 × 4 / 0.05 and 0.004 × 1.25 / 0.05). That confirms the basic weaken/hack and weaken/grow rate relationship. It does not guarantee safe completion ordering or transient security levels.

The weaken phase intentionally puts remaining RAM into grow after assigning the network-wide primary weaken need to earlier hosts. Thus an all-grow cloud worker during a weaken phase is allowed by the design. Growing at full money can still earn XP; high utilization alone is not evidence of useful marginal money production.

Money work weights use a small-drain approximation and then apply safety/readiness throttles. A prior-state calculation for the 4TB host gives 173 hack threads, which remove about 47.1% in one successful call at the sampled hack percentage. Exact logarithmic replacement is 0.6372 versus the linear estimate 0.4712, a 35.2% difference. This is model error, not proof of net under-growth: the current conservative grow allocation may more than compensate. Host-sized bursts, asynchronous completions and repeated resizing still need modeling.

### 5. Money selection discounts preparation inconsistently

Formulas-at-minimum-security ranking is useful and enabled. However, productive-target switching uses raw potential (mcp.js:1528–1533), bypassing the grow preparation discount. The discount itself (mcp_logic.js:289–298) ignores initial weaken time and can predict less than a complete grow cycle. A candidate can therefore look attractive before accounting for how long it takes to produce its first return. For XP, current-security ranking can also undervalue a target that would improve after preparation.

Recommended repair: compare expected return over the same horizon, including preparation, actual assigned capacity, and at least complete action durations. Expose the score components rather than promising the theoretical score as income.

## September 11 observation completed before the pause

The retained 31 samples span 300.198 seconds with ecorp and the 4TB worker. Cash increased from $37.8435t to $38.0319t: net $627.5m/sec over that window. Thirteen samples reported work and eighteen weaken; target money ranged from 28.1% to 100%, security from 66.486 to 69.168. The farm resumed hacking, but this window demonstrates substantial preparation cycling rather than a measured sustained cloud-server speed-up. There is no matched control window, so it cannot establish the purchase's causal return.

## Concurrent targets

Yes, reconsider them for money when measured marginal returns on one target fall below the return from preparing and working another. Benefits could include putting excess grow capacity to work elsewhere and avoiding an all-income pause while one target recovers. Splitting scarce capacity also duplicates preparation and rounding overhead, so it is not automatically faster. For pure XP, concentrating on the best sustainable XP-per-RAM-second target may remain better; money saturation alone is not an XP reason to split.

mcpMulti_logic.js already models saturation and assigns whole hosts greedily, but a large cloud host can overshoot a target's need. mcpMulti.js lacks current cloud enumeration and uses older current-security ranking, and inherits the shared lifecycle weaknesses. It is not ready for a direct live substitution.

Proposed sequence: (1) fix the demonstrated XP guard error; (2) fix launch ordering and completion-aware replacement; (3) measure single-target money and XP across multiple full cycles; (4) compare a two-target shadow allocation using marginal return after preparation; (5) browser-test a bounded two-target implementation before considering Steam. Define separate money and XP objectives rather than assuming one split optimizes both. No fixes, purchases, restarts or objective changes were performed in this review.

## Verification

The existing mcp_logic and mcpMulti_logic suites pass: 90 tests, zero failures. Two additional diagnostic reproductions demonstrate the launch-order and mid-cycle replacement weaknesses outside that test coverage. These passing suites do not certify the full scheduler lifecycle.

Source reference for grow completion behavior: https://github.com/bitburner-official/bitburner-src/blob/v3.0.1/src/NetscriptFunctions.ts . Local evidence is retained in `/tmp/bb-scheduler-review/` and `/tmp/bb-allocation-review.mjs`; durable copies accompany this report in `docs/evidence/scheduler-review-2026-09-12/`.
