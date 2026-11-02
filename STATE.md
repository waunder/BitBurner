# Current BitBurner Handoff

Last refreshed: 2026-11-01 21:05 MST. Sources: Steam game via DevTools and
terminal, Remote API `mcp_status.json`, game source and live reads.

## Current live state (supersedes everything below)

The live save is **BitNode 15**, entered 2026-11-01 about 13:48 MST with
`ns.singularity.b1tflum3(15, "startup.js")`, on Ken's delegated choice of node.
BN5 gave no reward because SF5 was at its cap of 3. Owned: SF 1.2, 2.1, 4.3, 5.3.
The BN5 run ended at hacking 461, $9.1b and 67.6TB; a validated backup is
`saves/bitburnerSave_pre-flume_BN5x3_2026-11-01.save` (gitignored).

BN15 multipliers: hacking level and speed 0.6, server max money 0.8, starting
money 0.5, security 1.5, augmentations 3× cost, Daedalus needs 20 augmentations,
World Daemon difficulty 2. Script hack money is 1, against 0.15 in BN5. The Red
Pill is the fifth labyrinth reward and needs at least five installs and charisma
3,000 (`docs/red-pill-path-2026-11-01.md`). Gangs need -54,000 karma, and
karma reset to 0.

`capital_bootstrap.js` hands over to `capital_manager.js` when it fits. The
manager buys TOR, programs, home RAM and cloud RAM, then starts managers that did
not fit at startup. `player_activity_config.json` is on auto with physical
training off; player is on Shoplift. Ken gave full approval on 2026-11-01 to
finish BN15 with any changes, including purchases and installs. Choosing the
next BitNode still needs him. Why BN15, and the numbers: `docs/bitnode-choice-2026-11-01.md`.

`dnet_root.js` and `dnet_scout.js` are running live; No lab reached yet; the maze solver has not run
live. Best scout depth is 2 (17:21 MST), and charisma is 213 against the first
gate of 300. Scheduled task `bitburner-bn15-progress` was resumed by Ken on 2026-11-01. Pause backup: hacking
182, $13.8m: `saves/bitburnerSave_pause_BN15_2026-11-01.save` (gitignored).

Live 21:03 MST (game): hacking 294, charisma 281, about $1.8b, 25 cloud servers at
639TB, home 512GB, Algorithms running. The game never paused; only the Remote API
was down from about 17:26 to 20:56, which Ken reopened. NiteSec joined; Sector-12 is
left for a deliberate choice. MCP used under 4% of cloud RAM (25TB), so `xp_filler.js`
now puts the idle part into hacking XP: 9.25m XP in 137s, about 67k/s against 810/s.
`capital_manager.js` stops cloud buying while MCP fills under 50%. MCP runs only on
cloud servers, so rooted hosts stay empty (492GB total, by design). The daemon rereads
`sync_manifest.json` each pass. Unknown: whether the filler lowers MCP income, which
read 0 at 21:03 between harvests and averaged $2.7m/s; compare before keeping it.

DevTools runs on 127.0.0.1:9222 through the Steam launch option.

## Earlier snapshot, 2026-11-01 10:45 MST

The save was reset by an augmentation install on 2026-10-31 20:18 local (4
installed, none queued, no factions, no gang). Everything from "Current
objectives" down predates that reset and is history until revalidated.
At 2026-11-01 10:45 MST: Remote API connected with full sync; hacking 284,
money about $466m after contracts; 17 rooted workers, 524GB, no cloud servers;
MCP on money in finite cloud mode, target phantasy; player activity on manual
override, doing Larceny. `gang-controller.js` failed in `startup.js` for RAM
(39GB needed, 23GB free on home); harmless while there is no gang.

Both pending `Largest Rectangle in a Matrix` contracts were accepted ($16.7m,
$50m) with the new solver; the queue is idle. Contract work now uses free RAM
beside finite cohorts, so cloud mode no longer starves it. The pending
post-install resilience edits are committed. All 347 tests pass.

## Current objectives

Gang focus is the reversible `cash` objective; no territory acquisition is
being pursued. At 17:29:07 PDT the live controller reported all 12 members on
Money Laundering, projected gang money rate about $3.47m/s, Black Hand rep
1,337,477, wanted level 60,947, wanted penalty 0.9974, and no territory
warfare/clash. The cash objective suppresses combat training and Territory
Warfare power building while preserving wanted cleanup and recruitment
priorities. The override had reverted to `money`; it was reset to `cash` and
the next controller report confirmed all members reassigned. Switch to
`money` only to resume territory training/power behavior, or `reputation` for
faction respect. The 2.5m Black Hand Red Pill gate remains a future objective
for this BitNode 2 run. Refresh MCP status before relying on its current
objective or rate.

Remote API monitor was connected at 17:28:55 PDT; a fresh full sync completed
with 104 source files and no sync failures. Its telemetry pull returned 21/29
files on this connection. The cash-mode code is deployed; only the persistent
objective override needed reapplying. No augmentation purchase or install was
performed in this turn.

The five-minute wanted-level heartbeat remains active. It should alert if
wanted reaches 100k while rising, rises by 10% or 10k between reads, or stays
above 50k without declining. Latest live wanted level is 60,947; its rate is
about +0.0475 per gang cycle and cleanup is currently off because the wanted
penalty is above the controller's 99.5% entry threshold.

See `AGENTS.md` for standing authority and the augmentation-install approval
boundary.

At 00:38 PDT on 2026-10-27, after deploying and restarting widened cleanup hysteresis (enter 0.998, exit 0.999), telemetry showed mode=wanted-recovery, cash objective, cleanup active, wanted 61,039.65 with actual -6.6859/cycle and projected -6.6793/cycle, penalty 0.995344, gang respect 13.0488m, and faction reputation 1.3823m. Recovery is live and reducing wanted; keep the controller unchanged while the rate remains negative.

At 01:33 PDT on 2026-10-27, Steam UI showed wanted 17,574.83 falling at -6.45225/sec, penalty 0.11%, gang respect 15.67104m, faction reputation 1.652m, with Ethical Hacking active. Recovery is healthy after the hysteresis widening.

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

At 22:06 PDT on 2026-10-28, Remote API reconnected and completed full sync/pull (104 pushed, 29 pulled), but `gang_status.json` remained stale with embedded timestamp 2026-10-27 20:25 PDT and unchanged cash-mode telemetry (wanted 20,700.23, projected/actual rate +0.055/cycle, penalty 0.99917, cleanup false). Treat this as a controller telemetry-freshness/watchdog fault: connection health is restored, but current gang trend and controller liveness are not yet verified. Do not infer present wanted behavior from this stale file.

At 22:54 PDT on 2026-10-28, after reconnecting Steam Remote API, I started `gang-controller.js` from the in-game terminal (PID 317). It exited immediately with `gang v2: no gang`. This confirms the old `gang_status.json` snapshot (wanted 20.7k, cash mode) is historical from a prior gang and must not be used as live state. Current save has no gang, so gang wanted level, penalty, respect, faction reputation, recovery allocation, and controller objective are presently inapplicable.
