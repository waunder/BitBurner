# Number review

Ken, 2026-11-18: "look at every breakdown, every number, question it, what does it mean, how can it be
improved... possibly slow, gradual. Your design, your control." Started after Ken, not a check, noticed
that MCP earned a fraction of the stacks' income per TB of RAM (fixed the same day: stacks 60% -> 90%).

## How it runs

- Each scheduled check-in (every 2 hours, step 5c) reviews **one** row: the one with the oldest
  `Last` date (blank first). About 10 minutes. Rows marked `again` after a change go first.
- For the row: read the live numbers, then answer three questions in writing:
  1. **Meaning.** What does it measure exactly, from the code that writes it? Is the label honest?
  2. **Doubt.** Is it right? Cross-check against another source (game API, metrics_log, a second file).
  3. **Better.** Compared with the other uses of the same resource (RAM, cash, player time, sleeves,
     rep), is it earning its share? Which fixed cap, share or threshold behind it is a guess?
- Record the finding in the row (one line) and details in the check-log entry. A tested, reversible
  improvement ships that run; a bigger one goes to `docs/opportunities.md`; something needing Ken goes
  in the run report.
- Add rows whenever a new number appears. Delete none: a row reviewed with no finding still gets a date.

## Queue

Resource it competes for in brackets. `Last` is the PC-clock date of the last review.

| # | Number (source) | Question to start from | Last | Finding / status |
|---|---|---|---|---|
| 1 | Money panel hacking rows: stacks vs MCP (`money_status.json`) [RAM] | Per-TB yield of every hacking use; is the split right? | 2026-11-18 | MCP $0.2-0.7m/s/TB vs stacks $1-5m/s; share 60->90%, 5 stacks, silver-helix added. `again` once omega-net fits |
| 2 | Stack estimates vs measured (`stack_manager_status.json` estimates, `stack_status_*` perSec) [RAM] | Do stacks earn what the formula predicts? Which run under? | 2026-11-19 | 2026-11-19: estimate matches measured (alpha-ent $711m/s vs formula ~$0.8b/s); but MAX_STACKS 5 froze the cycle's first five picks ($17m/s/TB) while megacorp est $516m/s/TB went unstacked; cap 5 -> 10, five new stacks started 04:15. 2026-11-19 13:30: nine stacks measured within 2-15% of estimate (megacorp $51.2b/s vs $52.4b/s; ecorp ~87%), ~$265b/s on ~51TB while ~5.7PB idle; cash/h 9.55t -> 943t. Done; fraction moved to row 3. |
| 3 | Stack parameters: hackFraction 0.4, spacing 500ms, gap 100ms (`stack_manager.js`) [RAM] | Are these tuned or guessed? Yield per TB at 0.05/0.2? | 2026-11-20 | 2026-11-19: 0.1 was a guess that left the fleet idle; 0.25 from the next install (row 2). 2026-11-20 18:17: 0.4, spacing 1000ms. 19:31: spacing 500ms, gap 100ms (landings span 300ms): 9 stacks $1.540t/s -> $3.466t/s, 0 resets, kept. Next lever would be spacing again (budget-bound) or fraction (capped under 0.5 by isHealthy); `again` |
| 4 | MCP targets and phases (`mcp_status.json` targets) [RAM] | How much MCP RAM is preparing vs harvesting? Prepping targets nobody will harvest? | 2026-11-20 | 2026-11-18: MCP prepping silver-helix while a stack took it. 2026-11-20 19:15 (Mac): 32 harvest targets 11.1TB, projected $15.7b/s ($1.4b/s/TB vs stacks ~$250b/s/TB); 22 prep targets only 326GB; no overlap with the 9 stack targets. RAM is not the limit (util 42% of ~10PB). Label fix: `mcpRate` is all hacking income since install (mcp_cloud.js `sinceInstall.hacking` delta), so metrics.py "MCP rate" -> "hacking ... (all scripts)"; MCP itself is ~1% of hacking |
| 5 | MCP cloud control: prep fraction 0.85, floor 0.25, recovery 0.95 (`mcp_status.json` cloudControl) [RAM] | Still right with stacks holding 90%? | | |
| 6 | xp_filler (`xp_filler_status.json`) [RAM] | Hacking exp/h it adds vs what that RAM would earn as money | | |
| 7 | Home RAM use (`capital_status.json` homeDemand 0.34) [cash] | Is two-thirds of home idle? Should workers use it? | | |
| 8 | Capital spending (`capital_status.json` purchases, action) [cash] | Payback time of each cloud upgrade vs holding cash for augs | | |
| 9 | Allocator "over grant" saves (`capital_status.json`, valuation flags) [cash] | How often does it block a buy, and was the saved cash used well? | | |
| 10 | Install advisor (`augmentation_readiness.json` advice: average, next.rate, verdict) [player time, cash] | Does the cycle-average rule pick good install times? Compare cycles in metrics.py | 2026-11-18 | Label honest (average = batchValue / cycle hours). Cycle 6 v/h peaked 0.57 at 3.1h, 0.49 at 4.1h (install verdict), 0.375 at the 5.98h install: checks every 3h, not the rule, set the timing. To Ken |
| 11 | Augmentation plan cost and order (`augmentation_readiness.json` installPlan) [cash] | Dearest-first with the 1.9 step; any cheaper ordering or skipped value? | 2026-11-19 | Install 7: plan cost $4.646t matches base x1.9^i exactly; dearest-first is optimal (ascending: $111t); last 4 augs = 62% of cost, greedy has no floor vs home RAM (opportunities) |
| 12 | Aug value weights (`run_target.json` augWeights) [all] | Do the weights match what actually limits the run (Covenant 850 hacking and combat)? | | |
| 13 | Player activity (`player_activity_status.json` decision) [player time] | Rep/h or exp/h of the chosen work vs the alternatives; focus held? | | |
| 14 | Grafting (`graft_status.json`, alternativeRate, entropy) [player time, cash] | Value per graft hour vs faction work; now focused, check actual vs predicted hours | | 2026-11-18: focus true instead of grafting Neuroreceptor |
| 15 | Sleeves (`sleeve_status.json`) [sleeves] | Each sleeve's task and its value per hour; any on a weak task? | | |
| 16 | Sleeve buyer (`sleeve_buyer_status.json`) [cash] | Aug spend per sleeve vs its gain; augHold delaying cloud buys? | 2026-11-18 | Cycle 7: $502b in 1.7h (44% of gross), 5 of 7 sleeves on money crime earning ~$0-1b/h; buy by role (opportunities) |
| 17 | Gang (`gang_status.json`) [gang members] | Respect/money split, territory warfare timing, gear payback | | |
| 18 | Darknet (`dnet_*_status.json`, money panel darknet row) [home RAM, player?] | $/s and what it costs; the 19h $0 outage of 2026-11-18 was missed | | |
| 19 | Coding contracts (`cct_*_status.json`) [none] | Solved vs failed vs skipped; reward taken (money or rep) the best? | | |
| 20 | Faction joins and rep (`faction_join_status.json`, metrics rep/h) [player time] | Joined everything useful? Rep going to the faction that limits the plan? | | |
| 21 | Hacknet (money panel, hacknet rows) [cash] | Bought? Should it be, in BN10? | | |
| 22 | IPvGO (`ipvgo_status.json`) [home RAM] | Win rate and bonus earned vs RAM it holds | | |
| 23 | Money panel spending rows and sleeve augs [cash] | Where cash went this cycle; anything spent with no visible return? | | |
| 24 | metrics.py summary and trend (`metrics_log.txt`) [all] | Each DECELERATING line: cause and fix | | |
| 25 | Run report and HUD lines [Ken's view] | Does each line tell Ken something true and useful? Mislabels like "other hacking"? | | |
