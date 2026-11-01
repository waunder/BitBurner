# Cloud capacity purchase — 2026-11-01

Ken asked for better MCP efficiency, hack XP, money and busy hosts. The live
constraint was RAM: 524GB rooted, no cloud servers, $2.85b unspent, and the
large rooted targets waiting for preparation RAM. All port openers were owned,
so unrooted servers are gated by hacking level, not programs.

Decision inputs: quotes were $116.8m for 1TB ($114k/GB), $280m for 2TB, $673m
for 4TB. Per-GB cost rises with size, so smaller servers won until slots ran
out. No factions or augmentation offers competed for the cash.

Bought 20 × 1TB ($2.34b), then 5 × 2TB ($1.40b) and home RAM 128→256GB ($101m).
All 25 slots are now used: 30.72TB cloud plus 524GB rooted. These servers are
lost on augmentation install.

| Measure (Remote API `mcp_status.json`) | Before, 12:46 MST | 20TB, 357s window from 12:50 MST |
| --- | ---: | ---: |
| Hacking income | ~$0.13m/s | $2.66m/s |
| Hack XP | ~89/s | 1,293/s |
| Hacking level | 327 | 341→365 |

The income window is short and lumpy: single harvests land as spikes above
$10m/s. Launch failures stayed zero, and utilization reached 99.9% at 12:59 MST,
so the idle-RAM filler considered during this work was not built. Each target
still runs one cohort at a time, so idle RAM returns if demand ever falls below
fleet capacity. No scheduler code changed. Raw samples:
`docs/evidence/cloud-capacity-2026-11-01/samples1.jsonl`.

BitNode multipliers read live: ScriptHackMoney 0.15, HackExpGain 0.5,
AugmentationMoneyCost 2, GangUniqueAugs 0.5.
