# Current BitBurner Handoff

Last refreshed: 2026-10-26 12:25 PDT. Sources: Remote API monitor and live
`gang_status.json` after deploying and restarting `gang-controller.js`.
Previous handoff archived at
`docs/archive/2026-10-25/STATE-before-wanted-monitoring-2026-10-25.md`.

## Current objectives

Gang focus is the reversible `cash` objective; no territory acquisition is
being pursued. At 12:25:41 PDT the live controller reported all 12 members on
Money Laundering, gang money rate about $2.93m/s, Black Hand rep 793,261,
wanted level 43,675, wanted penalty 0.9954, and no territory warfare/clash.
The cash objective suppresses combat training and territory power building
while preserving wanted cleanup and recruitment priorities. Source was
deployed by a full Remote API sync and `gang-controller.js` was restarted so
Netscript loaded it. Switch back with `run set_gang_objective.js money` to
resume territory training/power behavior, or `reputation` for faction respect.
The 100k Black Hand gate remains a future augmentation target; cash has
priority for now. Refresh MCP status before relying on its current objective
or rate.

Remote API monitor was connected at 12:23:37 PDT; a fresh full sync completed
with 104 source files and 29/29 telemetry files, no failures. The cash-mode
controller change is deployed and verified live. No augmentation purchase or
install was performed.

The five-minute wanted-level heartbeat remains active. It should alert if
wanted reaches 100k while rising, rises by 10% or 10k between reads, or stays
above 50k without declining. Latest live wanted level was 43,675 with a
0.9954 wanted penalty.

See `AGENTS.md` for standing authority and the augmentation-install approval
boundary.

## Prior wanted-monitoring snapshots

These earlier observations are retained for incident evidence; the current
live level and cash objective are recorded above.

Remote API `gang_status.json` at 16:22 PDT reports wanted 66,680 and rising
at +0.0895/cycle, with wanted penalty 0.9907. The controller is in
`territory-training` with `cleanupMode=false` despite the wanted level being
above 50k. This is a material regression from the prior recovery window and
is recorded in `docs/gang-monitoring-2026-10-26.md`; inspect the transition
guard before changing behavior.

After the bounded threshold change and controller restart, the 16:36 PDT
readback showed wanted 57,403 and falling at -6.16/cycle, cleanup active with
one cleaner, projected rate -6.16/cycle, and penalty improved to 0.99244. The
change is retained pending continued decline.

At 16:41 PDT wanted crossed below 50k to 48,824 and continued falling at
-5.30/cycle; cleanup remained active and penalty improved to 0.99371.
At 20:36 PDT, after reconnect, wanted had risen back above 50k to 50,281 at
+0.112/cycle with cleanup off and penalty 0.99507. This is a fresh regression
requiring a bounded review of the cleanup exit threshold.
