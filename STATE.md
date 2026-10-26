# Current BitBurner Handoff

Last refreshed: 2026-10-26 16:22 PDT. Sources: Steam augmentation page, Remote
API `augmentation_readiness.json`, `mcp_status.json`, and Remote API monitor.
Previous handoff archived at
`docs/archive/2026-10-25/STATE-before-wanted-monitoring-2026-10-25.md`.

## Current objectives

MCP is on money (`mcp_objective_override.txt`; `mcp_status.json` averaged
$196.5k/s at 15:11 PDT). Gang's near-term target remains 50k Black Hand rep;
the current Steam page showed about 39.55k around 15:10 PDT. Current cash was
$8.33b at 15:09:41 PDT, with five installed augmentations, one queued
(`LuminCloaking-V1 Skin Implant`), and a 1.9x price multiplier. The selected
filter's five rep-ready hacking/experience augmentations project to about
$6.13b if queued in descending base-price order, including the 50k
Neuralstimulator. CSP III at 50k additionally requires CSP II from NiteSec;
NiteSec was 12.441k and CSP II requires 18.75k. See
`docs/gang-all-in-strategy-2026-10-25.md` for the selective budget and
50–100k deferral recommendation.

Remote API monitor was connected at 15:05 PDT with a fresh full sync of 104
files and full telemetry pull of 29/29, no failures. No augmentation purchase
or install was performed for this assessment. Gang-controller safeguards in
the working tree are local and un-deployed; tests passed in the prior pass.

The five-minute wanted-level heartbeat remains active. It should alert if
wanted reaches 100k while rising, rises by 10% or 10k between reads, or stays
above 50k without declining. The current Steam augmentation page did not expose
a fresh wanted reading; re-read the Gang page before relying on a current
wanted estimate.

See `AGENTS.md` for standing authority and the augmentation-install approval
boundary.

## Latest live regression

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
