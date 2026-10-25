# Current BitBurner Handoff

Last refreshed: 2026-10-25 10:47 PDT. Sources: Steam UI and timestamped direct
Remote API reads. Previous handoff archived at
`docs/archive/2026-10-25/STATE-before-mcp-xp-and-gang-iteration.md`.

## Current objective and outcome

Continue measuring MCP yield while the live objective is XP; repair defects found
along the way. A short reversible comparison rejected an 80/20 hack/grow split.
The 50/50 split remains a monitored candidate, not a proven optimum: the final
110-second window had a 460 XP/s median while foodnstuff money rose 3.8% to 8.2%,
then a fresh status read showed 9.6%. Windows were phase-skewed and the 95/5
baseline was not matched. Details: `docs/mcp-xp-yield-2026-10-25.md`.

Gang wanted cleanup now has a severe-recovery band and a feasible exit threshold.
The previous 99.9% threshold was mathematically unreachable with the wanted floor
of 1 until respect reached 999. Below 5% of the maximum wanted multiplier, the
controller targets 4% wanted reduction per ten-cycle batch (versus 0.1% normally),
then returns to cash mode at 90% of the respect-dependent maximum penalty. The
controller was deployed and restarted at about 10:46 PDT.

## Latest verified live state

At 10:25:44 PDT, Steam/Remote API status showed MCP run `mvnn8tkf-wauz`, version
`1ep5kgh`, XP override active, continuous workers on foodnstuff, 395 XP/s, 9.6%
money, 4.296 security, 98.5% RAM use, no worker launch failures. Invariant
counts included `tickWithinBounds: 14`; no new worker or target-selection fault
was identified. Player hacking 507; Steam showed an Algorithms course in
progress.

At 10:46 PDT before restart, Steam showed The Black Hand with 5 members, wanted
18.41k, falling 16.81/s, penalty -99.96%, respect 8.11, and money $446/s. At
10:46:32 PDT after restart, all five members were on Ethical Hacking; wanted was
17.81k and falling 45.48/s, respect 8.40, penalty -99.95%, and money $14/s. At
10:47:16 PDT wanted was 15.92k, falling 40.73/s, penalty still -99.95%, respect
8.40, and money $15.62/s. The wanted decline is about 2.4x faster, with sharply
lower gang income; keep measuring recovery and confirm cash mode resumes near the
feasible exit. Recruitment still needs 125 respect. Remote API was connected at
10:44 PDT; incremental sync/pull passes succeeded and full sync pushed all 104
watched source files.

## Outstanding

Continue the XP split assessment with longer, phase-balanced windows; keep 50/50
reversible and monitored until better comparison data exists. Watch wanted
recovery, respect, and income through its respect-dependent exit; verify cash mode
resumes after recovery. No augmentation, installation, or reset was performed.
See `AGENTS.md` for standing authority and stop boundaries.
