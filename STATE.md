# Current BitBurner Handoff

Last refreshed: 2026-11-02 01:57 MST. Sources: Steam game via DevTools and
terminal, Remote API `mcp_status.json`, game source and live reads.

## Current live state (supersedes everything below)

**First install done, 2026-11-02 about 01:22 MST.** Hacking 376, charisma 329, $259b, NiteSec rep about 17k before it. Installed The Broken Wings
(`The W1ngs of Icarus`), 7 NiteSec augmentations and 8 NeuroFlux levels. 9 installed in all, so at least four more cycles. Leftover cash bought home RAM to
8.19TB, cores 2, which survived. Backup: `saves/bitburnerSave_pre-install1_BN15_2026-11-02.save`, validated (gitignored).

Rebuild found the player idle for about 30 minutes at hacking 1: `charismaTarget` 600 asked for Leadership with $1.6k, and `bestKarmaCrime` never returned a crime
because the game reports karma as positive. Fixed: under `minTrainingCash` ($10m default) the player does crime, chosen correctly (live: Deal Drugs). MCP now schedules on home
less 512GB, and `xp_filler.js` takes up to half of home. Live at 01:57 (game, status files): home 54% used, hacking 7, charisma 123 and rising without training, $2.6k, targets n00dles and foodnstuff.
Cash growth from home RAM not yet observed. Next lab is Cruel: depth 12, charisma 600. Faction rep and cloud servers are gone; `faction_join.js` skips city factions.
The Remote API dropped at about 00:20 (1006) and was reconnected from Options at 00:51; the game kept running.

## State before the install

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

`dnet_root.js` and `dnet_scout.js` are running live; the maze solver has not run live. Scheduled task `bitburner-bn15-progress` is enabled and runs hourly (confirmed 2026-11-01). Pause backup: hacking
182, $13.8m: `saves/bitburnerSave_pause_BN15_2026-11-01.save` (gitignored).

Stacked-batch trial on `omega-net`, 22:03 to 23:15 MST (`stack_status.json`): 341 batches, no resets,
$18.3b stolen, about $53.6m per batch, money and security held at ideal. It averaged $4.3m/s against
MCP's projected $1.4m/s for this target. At the intended one batch per 2s (seen live 23:15) that is
about $27m/s, not yet sustained. Launches nearly stopped while the Remote API was down, 22:14 to
23:00. Unproven guess: the game window is throttled when idle, which may also cause the repeated
1006 drops. `avgRate` and `incomePerSec` in MCP status understate income; compare `totalHacked`.

Live 21:03 MST (game): hacking 294, charisma 281, about $1.8b, 25 cloud servers at
639TB, home 512GB, Algorithms running. The game never paused; only the Remote API
was down from about 17:26 to 20:56, which Ken reopened. NiteSec joined; Sector-12 is
left for a deliberate choice. MCP used under 4% of cloud RAM (25TB), so `xp_filler.js`
now puts the idle part into hacking XP: 9.25m XP in 137s, about 67k/s against 810/s.
`capital_manager.js` stops cloud buying while MCP fills under 50%. MCP runs only on
cloud servers; the filler also fills rooted hosts (about 492GB). The daemon rereads
`sync_manifest.json` each pass. Unknown: whether the filler lowers MCP income, which
read 0 at 21:03 between harvests and averaged $2.7m/s; compare before keeping it.

Live 21:32 MST (status files): `th3_l4byr1nth` seen from `austin`; `dnet_lab.js` stopped on charisma
297/300 and has not walked the maze. Best scout depth is 6 (`byte:web`), up from 2, and that host
holds the stasis link, applied live, so chains now start there (`dnet_anchor.js`). At 21:44 `byte:web` had no neighbours, so a dead end there now starts one chain from `darkweb`. Keep the link on one
deep host; limit is 1 until Broken Wings. Money $12.4b, MCP $3.1m/s average, hacking XP 68k/s.
Leadership is ahead of hacking gates up to `charismaTarget` 600, at ZB in Volhaven (live 21:42 MST).
In scripts never name a variable `attempt`: the RAM check bills 10GB.
Three runs of this task overlapped at 21:06-21:18 and edited the same files. Before editing, run
`git status` and check no other BN15 session is running.

Live 22:03 MST (status files): the maze solver walked for the first time, from `digital:hydr0_tech`, 5 rooms
at about 5s each with 1 thread, then the link dropped after about a minute and it waited (expected). Charisma
307, hacking 357, money $23.6b. `dnet_lab.js` now waits for lab links and keeps its pid position; `dnet_root.js`
keeps one on the stasis host (`byte:web`) and scouts give it all free threads.

**Live 22:09 MST: first labyrinth solved** from `bungo`, 17 moves, 2 threads, about 4s a move. `dnet_loot.js` opened the
cache and The Broken Wings is queued, listed in game as `The W1ngs of Icarus` (read 22:11 with `getOwnedAugmentations`).
Installed 0. Hacking 364, charisma 315, money $32.7b, factions NiteSec and The Black Hand, karma -188.
Next: buy every augmentation rep allows (nothing automates this; capital_manager never touches augmentations), back up
the save, then install. Not installed yet because $32b is idle and only rep limits what the first install carries: hold for
faction rep no more than about two hours. Before the install set `charismaTarget` to 600 in `player_activity_config.json`.

**Live 23:22 MST (game, status files):** node 15, hacking 369, charisma 317, money about $75b at about $53m/s over two
minutes, NiteSec rep 6,828, Black Hand 1,892, karma -188. Remote API dropped at about 22:15 and was reconnected from
Options at 23:15; the game kept running. Player now works for NiteSec: new `repBeforeGates` config puts rep ahead of hack
gates, restarted live. Rep 2.24/s, 2.59/s with 64 share threads on home (`share_deploy.js balanced`, running). NiteSec
jumped 4,508 to 6,204 and Black Hand 211 to 1,881 within a minute around 23:17, cause unknown.
**Install plan:** rep only reaches about 14,000 by 00:10, which is the agreed limit, so install then. Steps: back up the save, set
`charismaTarget` 600, `run aug_install.js --install` (new; buys dearest first, then NeuroFlux, restarts `startup.js`; only
`--dry` has run live, planning BitWire alone at 6,800 rep). Install loses cloud servers; rebuild is expected. Home RAM and cores
survive (game source: only the BitNode reset clears them), so `--install` now spends leftover cash on them last; that part has not run live.

**Live 23:32 MST (game, status files):** $96b+, hacking 371, charisma 319 (exp 190k), NiteSec rep 7,490 (read 23:29). Hacking XP is lost
on install, so until then 99,172 share threads run across cloud and rooted hosts (`share_deploy.js network 256 128 100000`), share power
1.466 against about 1.17 before; expected rep about 3.3/s, not yet measured. `xp_filler.js` was restarted and fills only what is left. Stack
held afterwards: 52 batches in 116s, about $57m/s, money 100%, no resets. Install after 00:10 as planned; the share threads die with it.

**Live 23:58 Pacific (`money.js`, new, replaces `mcp_money.js` at startup):** cash $191b, net $63.6m/s: `omega-net` $60.4m/s, other hacking $3.2m/s. Per TB of RAM the stack
earns $3.69m/s against MCP's $102k/s. Four augmentations are ready for $2.53b; all 12 on offer cost about $726b, so rep limits now and cash could limit a big buy. `mcp_money.js` is still running until
the next startup. Launch stalls (7 batches in 148s at 23:56; 2 in 30s at 00:04 with 40,920GB in flight) are the 40TB `ramBudget`, not `xp_filler.js`: launches burst at one per 2s, stop at the budget, then resume as batches land. Stack average 23:41-00:03 was $38.6m/s, so $60m/s is the burst peak; the 10-minute figure at 00:06 was $26.1m/s, and yield $657k/TB against MCP $287k/TB, not the 36x of the first 1-minute sample. Default budget is now 64TB, needing a new stack run; the running stack keeps 40TB. `xp_filler.js` holds 64TB of whole cloud servers while a stack runs.
Modelled targets at hacking 373, one batch per 2s (survey 00:06, not run live): the-hub $116m/s 143TB, omega-net $57m/s 59TB, silver-helix $45m/s 58TB, phantasy $23m/s 17TB. `stack_batch.js` handles one target: status file, port and MCP skip would need per-target versions.
MCP's `totalHacked` and `avgRate` come from the game's whole `hacking` total, so they include the stack; `stack_status.json` `perSec` averages from 22:03 and reads low.

**Charisma is the biggest open risk.** Fit to live values: level = (32 ln(exp+535) - 200) × 1.1 × mult, mult 1.5376 now (the 1.1 is inferred).
At mult 1.75, roughly what the lab rewards give, 1,500 needs about 2e13 exp and 3,000 is out of reach; exp is 190k after 10 hours. The route needs
charisma-multiplier augmentations (for example Speech Processor) well before the Merciless lab. Not yet priced or planned.

Scout moving the link beside the lab returned false
at 22:03, reason unknown (likely under 14.2GB free). The Dark Net page holds the full topology (read by
`tools/dnet_map.py`), but links reshuffle about every minute, so a long route goes stale; the anchor works better.
Charisma target is now 300: it resets on install, and the 600 lab needs Broken Wings installed. Raise it after
that install. Player is on Algorithms at Rothman (live 22:00). Capital manager is idle with $23b while MCP fills
under 50%; money has no use until faction rep or the install. Sector-12 and Volhaven invites are still open.

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
