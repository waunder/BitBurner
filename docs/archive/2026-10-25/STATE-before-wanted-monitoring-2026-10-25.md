# Current BitBurner Handoff

Last refreshed: 2026-10-25 12:22 PDT. Sources: Steam Gang UI and timestamped MCP
Remote API reads. Previous handoff archived at
`docs/archive/2026-10-25/STATE-before-mcp-xp-and-gang-iteration.md`.

## Current objective and outcome

Continue measuring MCP yield while the live objective is XP; repair defects found
along the way. Keep the reversible 50/50 hack/grow split as the conservative
monitored candidate. Same-run A/B/A windows found 60/40's XP median only 2% above
the first 50/50 window and 8% above the return control, while target money median
was lower; phase mix was unbalanced. No reliable 60/40 advantage is established.
Details: `docs/mcp-xp-yield-2026-10-25.md`.

Gang wanted cleanup now has a severe-recovery band and a feasible exit threshold.
Below 5% of the maximum wanted multiplier, the controller targets 4% wanted
reduction per ten-cycle batch (versus 0.1% normally), then returns to cash mode at
90% of the respect-dependent maximum penalty. The controller was deployed and
restarted at about 10:46 PDT. On 2026-10-25 at 12:16 PDT, the gang objective was
set to reputation. Steam confirmed 4 members on Cyberterrorism and 5 on Ethical
Hacking: respect +194.07/s, faction rep 3.211k, wanted -3.82/s, penalty -12.54%,
and money +$1.525k/s. The stance is delivering the desired faction-reputation
output while wanted continues falling.

## Latest verified live state

At 12:21 PDT, Steam MCP HUD showed roughly 470 XP/s on foodnstuff. A/B/A direct
Remote API telemetry (run `mvo5rnwk-5jnw`, 1,100 GB eligible worker RAM) completed
at 12:21 PDT: 50/50 windows had XP medians 425 and 401/s; 60/40 had 433/s. The
60/40 window's moneyPct median was 0.509 versus 0.622 and 0.767 in the two 50/50
windows. Phase differences prevent a firm rate comparison. No launch failures;
RAM use stayed near 98.5%; invariant counter `tickWithinBounds: 9`.

At 12:16 PDT Steam showed The Black Hand with 9 members, respect 47.887k
(+194.07/s), wanted 6.869k (-3.82/s), penalty -12.54%, faction reputation
3.211k, and money +$1.525k/s. Gang reputation objective is confirmed live.
Remote API health refresh was attempted at 12:21 PDT but the sandbox denied
loopback access to port 12527 (`health_unknown`); no daemon action was taken.
The live Steam UI remains the source for current gang state.

## Outstanding

Keep MCP XP at 50/50 and gather phase-balanced samples when useful. Watch gang
faction reputation alongside respect and wanted; ensure the reputation stance
continues to keep wanted controlled. No augmentation, installation, or reset
was performed. See `AGENTS.md` for standing authority and stop boundaries.
