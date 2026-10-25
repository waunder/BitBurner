# Current BitBurner Handoff

Last refreshed: 2026-10-25 10:26 PDT. Sources: Steam UI and timestamped direct
Remote API reads. Previous handoff archived at
`docs/archive/2026-10-25/STATE-before-mcp-xp-and-gang-iteration.md`.

## Current objective and outcome

Continue measuring MCP yield while the live objective is XP; repair defects found
along the way. A short reversible comparison rejected an 80/20 hack/grow split.
The 50/50 split is retained as a monitored candidate: the final 110-second
window had a 460 XP/s median while foodnstuff money rose 3.8% to 8.2%, then a
fresh status read showed 9.6%. Windows were phase-skewed and the 95/5 baseline
was not matched, so this is not a proven optimum. Details:
`docs/mcp-xp-yield-2026-10-25.md`.

Fixed the gang money-mode priority defect: when wanted cleanup is active and a
cleaner exists, it now precedes recruitment respect growth. Deployed source and
restarted `gang-controller.js`. Steam then showed two of five members on Ethical
Hacking, wanted falling about 55/s, and three members still earning money.

## Latest verified live state

At 10:25:44 PDT, Steam/Remote API status showed MCP run `mvnn8tkf-wauz`, version
`1ep5kgh`, XP override active, continuous workers on foodnstuff, 395 XP/s, 9.6%
money, 4.296 security, 98.5% RAM use, no worker launch failures. Invariant
counts included `tickWithinBounds: 14`; no new worker or target-selection fault
was identified. Player hacking 507; Steam showed an Algorithms course in
progress.

At approximately 10:26 PDT, Steam showed The Black Hand at 5/12 members,
wanted 58.22k, falling 55.09/s, penalty still -100%. Two members were assigned
Ethical Hacking and the other three Money Laundering. Recruitment still needs
125 respect. Remote API was connected; full sync had pushed all 104 watched
source files without failures.

## Outstanding

Continue the XP split assessment with longer, phase-balanced windows; keep 50/50
reversible and monitored until better comparison data exists. Watch wanted
recovery until penalty clears its 99.9% hysteresis exit. No augmentation,
installation, or reset was performed. See `AGENTS.md` for standing authority
and stop boundaries.
