# Current BitBurner Handoff

Last refreshed: 2026-11-08 16:16 Pacific (PC clock), on the PC. Sources: Steam game via
DevTools, Remote API status files.

> **Which session is this? (standing note, keep at the top.)** The BitBurner run is meant to be worked from a Claude
> **Code** session on the PC, in the Claude desktop app's Code tab, with the folder `C:\Users\kenne\BitBurner`. Such a
> session has a shell, git, `tools/game_terminal.py` and the scheduled task's tools. If you are a plain **chat** session
> (claude.ai or the desktop Chat tab, no shell or repo folder), do not try to run, debug or change the game or the
> scheduled task from here. Tell Ken plainly: "This is a chat session. For BitBurner work, open the Claude desktop app,
> go to the Code tab, and start a session in C:\Users\kenne\BitBurner." Then help only with questions that need no
> game access. The 2-hourly check is the scheduled task "BitBurner BN10 progress"; its runs appear in the Code tab
> sidebar, and "Run now" there starts one. (On 2026-11-06 a chat-side attempt to sort out the task led to an
> unrecorded install.)

**2026-11-08 16:16 Pacific, 2-hourly task, BN10 run 2: steady, no changes.** Not a stand-aside run (no session
running). Live (autosave summary, game `free`/`ps`, readiness and sleeve status 16:14-16:16): BN10, $4.60b, hacking 154,
karma -12.95k, 0 installed, 0 queued, factions Tetrads, Slum Snakes, Tian Di Hui, CyberSec; player on Tetrads field work
for Bionic Arms (117k rep short). Home now **2.05TB** (1.20TB used); every resident running (MCP, supervisor, crawler,
steward, money, stack_manager, run_report, faction_join, player controller, capital_manager, metrics_logger, HUD,
dnet_root, cct_watcher, sleeve_controller, sleeve_buyer, xp_filler). Sleeves: **6**; 0-4 on Homicide (22% chance,
shock 12.8), sleeve 5 new (memory 1) on Synchronize at sync 36. Measured, 12 samples 15:20 to 16:15: rep/h Tetrads
3.03k, Tian Di Hui 1.08k, CyberSec 1.08k, Slum Snakes 151; hacking exp 7.03m/h (22.1 levels/h), karma -3.67k/h, cash
3.19b/h, MCP rate 10.4m/s average 1.78m/s, share 1.31. Trend: `cash/h 42.5m>589m>3.19b ACCELERATING | MCP
444k>1.62m>10.4m ACCELERATING | hackExp/h 496k>1.26m>7.03m ACCELERATING | lvl/h 13.5>14.7>22.1 context | rep work
Tetrads SWITCH | rep best Tetrads SWITCH`. Advisor: **wait** (20m for Neurotrainer I); decision: **no install**, agree;
the run target holds the first install for NiteSec (hacking 211, about 2.6h at 22 levels/h). World Daemon: not present
(no Red Pill). Share A/B not run: income is ramping several-fold per hour, which would swamp any share effect.
**Next:** NiteSec gate (~18:45), then first install; gang at -54k karma in about 11h at -3.67k/h.

**2026-11-08 14:15 Pacific, 2-hourly task, BN10 run 2: steady, no changes.** Not a stand-aside run (no session
running). Live (autosave summary, `ps`/`free` and readiness 14:14-14:15): BN10, $104m, hacking 117, karma -6.10k, 0
installed, 0 queued, factions Tetrads, Slum Snakes, Tian Di Hui, CyberSec; player on Tetrads field work for Bionic Arms
(rep 2.2k). Home **256GB** (214GB used); every resident is back: MCP, supervisor, crawler, steward, money,
stack_manager, run_report, faction_join, player controller, capital_manager, metrics_logger, HUD, dnet_root,
cct_watcher, sleeve_controller, sleeve_buyer, xp_filler. Measured, 12 samples 13:20 to 14:15: rep/h Tetrads 2.69k, Tian
Di Hui 2.58k, Slum Snakes 147, CyberSec 146; hacking exp 515k/h (13.5 levels/h), karma -2.24k/h, cash 50.5m/h, MCP rate
407k/s average 146k/s, share 1.21. Trend: `cash/h -->30.8m>50.5m n/a | MCP -->5.71k>407k n/a | hackExp/h -->287k>515k
n/a | lvl/h -->23.8>13.5 context | rep work Tetrads SWITCH | rep best Tetrads SWITCH` (cycle 4.7h, MCP only back since
12:16). Advisor: **wait** (13m for ADR-V1 Pheromone Gene); decision: **no install**, agree, and the run target holds the
first install for NiteSec (hacking 211, about 7h at the measured rate). World Daemon: not present (no Red Pill). Share A/B
not run (player switched faction work this cycle). **Next:** NiteSec gate, then first install; gang at -54k karma in
about 21h at -2.24k/h.

**2026-11-08 12:18 Pacific, 2-hourly task, BN10 run 2: MCP was down; fixed.** Not a stand-aside run (no session
running). Live (autosave 12:14, `player_activity_status.json` 12:14, game `ps`/`free` 12:15): BN10, $15.7m, hacking 79,
karma -3.07k, 0 installed, 0 queued, factions Slum Snakes and Tian Di Hui. Home **128GB**, but the residents
(player controller 36.8GB, capital_manager 17.25, HUD 15.45, stack_manager 11.05, faction_join 10.1 and the rest) used
127.95GB, so `mcp.js` (16.95GB) had not run since about 09:38 (steward recovery count 207). **Fix:** killed HUD and
`cct_watcher.js`, restarted `capital_manager.js`, started `mcp.js` (running at 12:16, 4.4GB free); `capital_manager.js`
now holds back `mcp.js`'s RAM while MCP is down (547 tests pass in build/bn10). Swapped `dnet_root.js` (registry empty,
darknet idle) for `metrics_logger.js`. Run 1's 1MB `metrics_log.txt` (which broke `metrics.py pull`) renamed in game to
`metrics_log_bn10run1.txt` (local copy `runtime/metrics_log_bn10run1.txt`), so run 2's log starts fresh. **No measured
rates or trend line this run** (no run 2 samples yet). Player controller has the player at Powerhouse Gym toward its 75
combat baseline (strength 68/75), not on Homicide (its candidate: 59% chance, about 0.59 karma/s); left as is. Advisor:
**build** ("nothing to install yet; best next Wired Reflexes in 7.2h"); decision: no install, agree. World Daemon: not
present in run 2 (needs The Red Pill). Still off for RAM: HUD, `cct_watcher.js`, `dnet_root.js`, `sleeve_controller.js`,
`xp_filler.js`; they return as home grows (256GB next). **Next:** check MCP income and the first run 2 metrics samples.

**2026-11-08 10:26 Pacific, BN10 run 2 (Ken session): player on Homicide, sleeves on Shoplift.** Home grew to 64GB
(capital_bootstrap handed over to capital_manager; the steward fills spare RAM at once, so a one-shot needs a
`kill <pid>; run ...` on one line). BN10 stat levels are about 0.4x: 6.7k strength exp gave strength 41, so the
gym target was 42 str / 44 def (Powerhouse Gym, ~12 exp/s at $2.4k/s), not 100. `player_now.js` (new, core/dev, pushed
by hand) put the player on Homicide: **measured 30 kills in ~5 min, about 30% success, about 0.3 karma/s** (Shoplift
0.05/s); BN10 does not appear to lower crime success. Ken moved the sleeves to Larceny; reverted to Shoplift with
his agreement (at dex/agi 27 Larceny succeeds 17%: $1.5k/s vs $7.5k/s; it wins only near dex/agi 146).
`sleeve_crime_now.js` now takes `gym:<stat>` and sleeve indices. **Next:** sleeves on Homicide need str/def ~42
(about 1h and $9m per sleeve; then about 0.23 karma/s each but $3.4k/s vs $7.5k/s money). Train them two at a time
once hacking income replaces sleeve money; all six would bring the -54k gang gate to about 9h instead of 27h.

**2026-11-08 05:20 PST (06:20 PC clock): BN10 World Daemon ready, Ken notified (2-hourly task).** Hacking **6070 of the required 6000** (`w0r1d_d43m0n` `requiredHackingSkill` 6000 from the autosave; live gate scan `gateScanOk` true). The daemon is **not rooted, not backdoored, not destroyed; no BitNode chosen.** The push notification was sent to the desktop; the phone push was not sent (Remote Control inactive). **Next: Ken opens a BitBurner session to choose the next BitNode. The 2-hourly task makes no further changes.**

**BN10 install 15 ran 2026-11-08 05:16 Pacific (PC clock 06:16), 2-hourly task: QLink, which crossed the 6000 gate.** Not a stand-aside run (no session running). Before (autosave summary 05:15, readiness 05:14, metrics to 05:10): BN10, cash $957t, hacking 4187, karma -54.6k, 76 installed, 1 queued (The St4ff of Asclepius, bought earlier this cycle by an unrecorded run), 13 factions, Illuminati re-joined (favor 179), player in the Algorithms class. Measured, 13 samples 04:10 to 05:10: rep/h Daedalus 463k, BitRunners 396k, NiteSec 301k, Illuminati 211k; hacking exp 74b/h, karma -222/h, cash 531t/h, MCP rate 186b/s average 130b/s, share 1.56. Trend: `n/a` on every line (cycle 1.9h, too short). Advisor: **install** ("nothing left worth waiting for"); decision: **install, agree**. QLink's +75% hacking was the step to 6000 (estimate from the level formula: about 2b exp needed afterwards). Backup `saves/bitburnerSave_pre-install15_BN10_2026-11-08.json.gz` (gzip checked, player parsed, node 10, 76 augs, 1 queued, 5 sleeves, SHA-256 1cbb81da6aa7017d05b2b73b24f6e8c9b031a693b4161c57896c5c85e8216360). `aug_install.js` (buy only): donated $595b to Illuminati, bought **QLink** and **PCMatrix**, then 5 NeuroFlux levels ($140.8t donated for them); then `aug_install.js --install`: installed. After (game `ps` 05:18, readiness, autosave): **79 installed, 0 queued**; all residents running (MCP, supervisor, crawler, steward, money, stack_manager, HUD, run_report, player controller, xp_filler, faction_join, metrics_logger, dnet_root, sleeve_controller, sleeve_buyer, capital_manager, gang-controller, cct_watcher). Hacking 5727 at 0.96b exp right after install, **6070 at 2.28b exp by 05:19**. `metrics.py pull` failed again (chunk limit, `metrics_log.txt` 1.0MB); the daemon's own pull kept `runtime/metrics_log.txt` current. New cycle not yet sampled, so no `metrics.py cycles` row for it.

**BN10 install 14 ran 2026-11-08 03:16 Pacific (PC clock 04:16), 2-hourly task: for Illuminati favor, toward QLink.**
Not a stand-aside run (no session running). Before (autosave summary 03:15, readiness and metrics 03:10-03:15): BN10,
cash $1.07q, hacking 3893 (required for `w0r1d_d43m0n` 6000; World Daemon not ready), karma -54.4k, 72 installed, 1
queued (The H4mmer of Daedalus), 11 factions; **Illuminati joined this cycle**, player on Illuminati hacking work (rep 829k,
QLink gap 2.9m, about 5h). Measured, 12 samples 02:15 to 03:10: rep/h Illuminati 570k, Daedalus 317k, BitRunners 300k,
NiteSec 226k, The Syndicate 214k; hacking exp 47.5b/h, karma -32/h, cash 604t/h, MCP rate 324b/s average 144b/s, share
1.55. Trend: `n/a` on every line (cycle 1.9h, too short). Advisor: **install** ("best next QLink adds +11.7%/h, under the
cycle's +12.3%/h"); decision: **install, agree**, for a reason it does not weigh: Illuminati favor 0 banks about +178,
so next cycle a donation buys QLink (+75% hacking) at once instead of 5h of rep work. By the level formula
(mult x (32 ln exp - 200), multiplier about 6.4 now) 6000 is out of reach by exp alone (about 2.5e15 needed); with QLink
(about 11.2) roughly 10b exp suffices, a few hours of rebuild. Backup `saves/bitburnerSave_pre-install14_BN10_2026-11-08.json.gz`
(gzip checked, player parsed, node 10, 72 augs, 1 queued, 5 sleeves, SHA-256
0b1b380e9e28c968b6648f8eef325001b9290553f2fc7a0716b26fee26a6ecb8). `aug_install.js --install` (`aug_install_status.json`):
bought FocusWire, ADR-V2 Pheromone Gene, Neuregen Gene Modification (The Black Hand), **5 NeuroFlux** ($92.5t donated
for them), home 2PB / 7 cores unchanged; installed. After (game `ps` 03:19, readiness 03:17): **76 installed, 0 queued**,
cash $574m; all residents running (MCP, supervisor, crawler, steward, money, stack_manager, HUD, run_report, player
controller, xp_filler, faction_join, metrics_logger, dnet_root, sleeve_controller, sleeve_buyer, capital_manager,
gang-controller, cct_watcher). New cycle not yet sampled (`metrics.py cycles` next run). **Next:** once Illuminati
re-invites (hacking 1500, combat 1200, $150b; last cycle this took under 2h), run `aug_install.js` (no flag buys
without installing) to donate and buy QLink and anything else Illuminati offers, then install. Run target: step added.
Note: `metrics.py pull` failed ("Separator is found, but chunk is longer than limit"; `metrics_log.txt` is 1.0MB), but
the daemon's own pull kept `runtime/metrics_log.txt` current (sample age 5 min), so the summary is valid.

**BN10 install 13 ran 2026-11-08 01:16 Pacific (PC clock 02:16), 2-hourly task: The Red Pill installed.** Not a
stand-aside run (no session running). Before (autosave summary, readiness 01:14, metrics 01:15): BN10, cash $315t,
hacking 3444, karma -54.3k, 71 installed, 0 queued, 9 factions, player idle at the gym (strength; no actionable target).
**Daedalus favor was already 168** (above 150), so the readiness plan was "donate $1.14t to Daedalus, buy The Red Pill".
Measured, 12 samples 00:20 to 01:15: rep/h BitRunners 233k, NiteSec 176k, The Syndicate 172k, Daedalus 121k; hacking exp
43.1b/h, karma -28.4/h, cash 361t/h, MCP rate 77.2b/s average 63.9b/s, share 1.55. Trend: `n/a` on every line (cycle
1.0h, too short). Advisor: **build** ("nothing to install; value lies in factions not yet joined"); decision:
**install, differs**: The Red Pill is the last gate before the World Daemon and the cycle was only 1h old, so the install
cost about 40b hacking exp. Backup `saves/bitburnerSave_pre-install13_BN10_2026-11-08.json.gz` (gzip checked, player
parsed, node 10, 71 augs, 0 queued, 5 sleeves, SHA-256 8ae011f49accbf4960baeb380a1c258a96cdb0da47999b58fe40ba5034624b26).
`aug_install.js --install` (`aug_install_status.json`): donated to Daedalus, bought **The Red Pill**, then **8 NeuroFlux**
levels ($50.9t donated for them), home 2PB / 7 cores unchanged; installed. The dry run had also planned 13 Black Hand
augmentations (Hydroflame Left Arm and others) after a $742b Black Hand donation, but the live donation was refused (The
Black Hand is the gang's faction, and the game refuses donations to it), so they dropped out. Install 12's record of a
"$743b Black Hand donation" was the same planned-not-made entry. **Fixed** `core/player/aug_install.js`: the gang faction
(read from `augmentation_readiness.json`, no ns.gang RAM) is no longer a donation target, and `donations` in the status
now lists only donations that went through; 547 tests pass in build/bn10. After (autosave 01:18, game `ps` 01:18): **72
installed, 0 queued, The Red Pill installed**; all residents running (MCP, steward, money, stack_manager, HUD, run_report,
player controller, xp_filler, faction_join, metrics_logger, dnet_root, sleeve_controller, sleeve_buyer, capital_manager,
gang-controller, cct_watcher). **World Daemon: `w0r1d_d43m0n` now exists in the save, required hacking 6000, not rooted;
not ready.** `metrics.py cycles`: the closed cycle ran 1.01h (00:14 to 01:16); new cycle not yet sampled. Run target:
Red Pill step marked done, pushed.

**Planning note for the 6000 gate (estimate from the hacking formula, not measured).** Level is about
mult x (32 ln(exp) - 200). At 40.4b exp and level 3444 the multiplier is about 5.9 (before the +8% from NeuroFlux). A 26h
cycle at about 43b/h gives roughly 1.1t exp, which at the new multiplier (about 6.4) is still only about 4400. Reaching
6000 needs the hacking multiplier up by roughly 35-50% more (NeuroFlux levels, the remaining hacking augmentations, The
Black Hand's via gang rep) and long cycles, since exp counts only logarithmically. Next runs should judge installs by
hacking multiplier gained against hacking exp lost.

**2026-11-08 09:20 PST (10:20 PC clock), 2-hourly task, run 2 check: steady, no changes.** Not a stand-aside run (no session running; Ken's "Bitburner session" idle since 09:10). Live (autosave 09:19, `capital_status.json` 09:16): BN10, $20m, hacking 54, karma -466, 0 installed, factions Slum Snakes and Tian Di Hui, player at Powerhouse Gym (defense). Home **64GB**, 1 core; `capital_manager.js` is saving $47.8m for the next home upgrade at about $22k/s. 6 sleeves on Shoplift, shock 23.5. Running (game `ps` 09:16): mcp_money, capital_manager, steward, money, faction_join, run_report, dnet_root. Not yet running for lack of RAM: mcp.js, stack_manager, HUD, player controller, metrics_logger, sleeve_controller. No metrics for run 2 yet (logger not running; `metrics.py pull` still fails on the 1.1MB run 1 `metrics_log.txt`), so no measured rates or trend line. World Daemon: not present in run 2 (needs The Red Pill); the "World Daemon ready" line above is run 1. Note: `game_terminal.py` returned empty output for `free`/`ps` several times (output is sliced by line count; a full terminal buffer gives nothing), and once refused with "terminal holds typed text: sa 3". **Next:** after the home upgrade, check capital_manager starts the rest; if sleeve_controller still does not fit, consider moving some sleeves from Shoplift to Mug for karma.

**BN10 run 2 entered 2026-11-08 (Ken destroyed the World Daemon and chose BN10 himself, in his session).**
Save backup before the daemon: `saves/bitburnerSave_pre-worlddaemon_BN10_2026-11-08.json.gz` (node 10, hacking 8032,
79 installed). Live after entry (autosave): BN10, SF 1.2, 2.1, 4.3, 5.3, 10.1, 15.1; $82k, home 32GB, karma -0.8;
player on Shoplift (Ken). **6 sleeves** (min(3, SF10 1 + 1 in BN10) + 4 Covenant): 5 at memory 100 and sync 100, the new
6th at memory 1 and sync 25; all at shock 24.9 (BN10 entry caps shock at 25). Same 32GB squeeze as run 1, so as
then: killed `mcp.js` (17GB); `sleeve_crime_now.js` (new, core/dev, pushed by hand) put all 6 sleeves on Shoplift
for money and karma, since `sleeve_controller.js` (26GB) does not fit; `capital_bootstrap.js` runs (buys home RAM);
`early_spread.js joesguns` rooted 5 and started 41 loop threads, plus 6 on home. **Next: as home grows, kill the
weakenGrowHack loops and `run startup.js`; sleeve_controller then takes the sleeves (it recovers shock to 5 first).**
`run_target.json` rewritten for run 2: gang first (karma -54k), NiteSec, Covenant (6th sleeve memory, $100q 5th
sleeve as a bonus), Red Pill, World Daemon. Authority: Ken confirmed run 1's terms carry over (installs approved with a
backup, stop at the World Daemon or any reset); recorded in `AGENTS.md`.

**Gang change 2026-11-08 (Ken session; Ken away overnight, left it in the agent's hands).** In reputation mode the
gang had spent over 95% of its time with all 9 members on Ethical Hacking: 1.9 respect/s. That was the 0.998/0.999
attainable-penalty cleanup band, tuned for the old 13m-respect gang. Reputation mode now uses an absolute
wanted-penalty band from `gang_capital_policy.json` (`reputationCleanupEnter`/`Exit`). Results: bn10 at 0.90/0.95
measured about 50 respect/s and 8 Black Hand rep/s; at 0.80/0.90 (kept) about 74 respect/s and 12 rep/s, with 10
members. Ken: money should not weigh in gang work now; reputation (Daedalus for the Red Pill, Black Hand for augs) is
the focus. Not done: rank gear by respect rather than money payback in reputation mode; allow ascension in reputation
mode (disabled now). Also check whether Daedalus or The Covenant rep work serves the Red Pill route better.

**BN10 install 12 ran 2026-11-08 00:14 Pacific (PC clock 01:14), 2-hourly task, after the 4th Covenant sleeve.**
Not a stand-aside run (no session running). Before (autosave summary, sleeve/buyer/readiness status, metrics 23:13 to
00:13): BN10, cash $9.85q, hacking 3154, karma -54.3k, 54 installed, 0 queued, 12 factions, player on Daedalus hacking
work (Red Pill gap 4.77m rep). **`sleeve_buyer.js` bought the 4th Covenant sleeve at 23:33 ($10q, ok, cash to $378b)**,
then memory for it, 2 points per poll, to **memory 100 at 00:10** (about $210t; the 5th sleeve costs $100q, out of reach
at about 500t/h). My `kill sleeve_buyer.js` at 23:42 did not take (status kept updating, purchases kept landing); I let
it finish, since memory can only be bought in BN10 and is permanent. World Daemon: Red Pill not installed; not ready.
Measured, 23 samples 22:15 to 00:05: rep/h Daedalus 291k, BitRunners 224k, NiteSec 157k, The Covenant 147k, The
Syndicate 140k; hacking exp 29.2b/h, karma -18.9/h, MCP rate 96.5b/s average 138b/s, share 1.56 (cash/h negative from
the sleeve purchase). Trend at 23:15: `cash/h 502t>503t>504t STEADY | MCP 144b>122b>82.7b DECELERATING | hackExp/h
29.3b>29.3b>29.2b STEADY | rep work The Covenant 420k>435k>331k SWITCH | rep best STEADY` (MCP figure is the
instantaneous rate during target rotation; cash/h was flat). Advisor: **install** ("nothing left worth waiting for");
decision: **install, agree**, once the sleeve and its memory landed: Daedalus favor would bank about +117 (rep x2.2
next cycle) and The Covenant +253. Backup `saves/bitburnerSave_pre-install12_BN10_2026-11-07.json.gz` (00:13, gzip
checked, player parsed, node 10, 54 augs, 0 queued, 5 sleeves, 4 from The Covenant, memory all 100, SHA-256
fc6aee08dbc59ad4a8eb67d9c595442f63d1647342efd935126906fedae915b0). `aug_install.js --install` with $40.8t
(`aug_install_status.json`): donated $743b to The Black Hand, bought 17 (ENM Core V3, ENM DMA, ENM Analyze Engine,
Unstable Circadian Modulator, SPTN-97, Graphene Bone Lacings, Graphene Bionic Arms, Synthetic Heart, Graphene
BrachiBlades, Synfibril Muscle, Eloquence, Neurotrainer III, Golden Tongue, three Hacknet, INFRARET), none failed, no
NeuroFlux; home 2PB, 7 cores; installed. After (autosave 00:17-00:19, status files): **71 installed, 0 queued**,
hacking 2702 five minutes in, cash $3.6b; sleeves, player controller, MCP, capital and buyer status all fresh; player at
the gym for the 75 physical baseline (normal rebuild). `metrics.py cycles`: previous cycle 25.7h, rebuild hacking 0.29h,
rep rate 13.6h; rep earned BitRunners 5.4m, NiteSec 3.79m, The Covenant 3.74m, The Syndicate 3.35m, Daedalus 635k;
favor banked (tracked) The Syndicate +74.4, BitRunners +67.2, Speakers +59.1. New cycle not yet measured. **Config
(bn10 profile, pushed):** `covenantTarget` false (nothing left to buy there; its training ranks above faction work);
`favorTarget` Daedalus, so the controller works Daedalus to favor 150, then the next install donates for The Red
Pill's rep; run target marks the 4th sleeve done and drops the Covenant invite step. Next: rejoin Daedalus ($100b),
read its favor, work it to 150, install, donate, buy The Red Pill.

**BN10 check 2026-11-07 21:15 Pacific (PC clock 22:15), 2-hourly task: steady, no changes.** Not a stand-aside
run (no session running). Live (autosave summary, sleeve/buyer/readiness status and metrics 21:15): BN10, cash
$8.84q, hacking 3141, combat 861/1040/880/850, karma -54.2k, **54 installed, 0 queued**, 12 factions; player back on
**The Covenant** hacking work (Embedded Netburner Module Core V3 Upgrade, +506k rep). Sleeves: 0 on The Covenant rep
(shock 0, sync 99, memory 100), 1-3 on shock recovery (shock 56.9, down 10.7 in 2h, so about 10.5h more).
`sleeve_buyer.js` bought sleeve 0's remaining augmentation (Graphene Bionic Arms Upgrade, $3.75b, ok, about 20:05) and
is saving for the 4th Covenant sleeve ($10q, $1.16q short, about 2.3h at 502t/h, so near 23:35 Pacific). World
Daemon: Red Pill not installed, hacking 3141; not ready. Measured, 12 samples 20:20 to 21:15: cash 502t/h, hacking exp
29.3b/h (6.8 levels/h), karma -18.7/h, MCP rate 115b/s average 138b/s, share 1.55; rep/h The Covenant 420k,
BitRunners 216k, NiteSec 151k, The Syndicate 135k. Trend: `cash/h 501t>502t>502t STEADY | MCP 114b>204b>115b STEADY |
hackExp/h 29.2b>29.3b>29.3b STEADY | rep work The Covenant 440k>412k>420k SWITCH | rep best The Covenant
440k>412k>420k SWITCH` (cycle 22.7h; SWITCH is the Dark Army to Covenant move). Advisor: **wait** (Embedded Netburner
Module Core V3 Upgrade in 1.1h, +15.3%/h beats the cycle's +6.7%/h); decision: **no install, agree**; the next check
(about 23:15) falls just before the 4th sleeve purchase, so install at the check after it lands.

**BN10 check 2026-11-07 19:15 Pacific (PC clock 20:15), 2-hourly task: steady, no changes.** Not a stand-aside run
(no session running; Ken's 18:29 session had ended). Live (autosave summary, sleeve/buyer/readiness/player status
19:14, metrics 19:15): BN10, cash $7.84q, hacking 3127, combat 861/1040/880/850, karma -54.2k, **54 installed, 0
queued**, 12 factions. The player controller moved the player from The Covenant to **The Dark Army** hacking work
(Graphene Bionic Arms Upgrade, +369k rep; Covenant rep 2.52m). Sleeves: 0 on The Dark Army rep (shock 0, sync 99,
memory 100), 1-3 on shock recovery (shock 67.6, down 10.8 in 2h, so about 12.5h more). `sleeve_buyer.js` (new
version with sleeve augmentations, Ken's 19:29 commit) is saving for the 4th Covenant sleeve ($10q, $2.17q short,
about 4.3h at 501t/h, so near 23:35 Pacific); no purchases since 13:15 (sleeve 0 already has every augmentation,
1-3 are not at shock 0). World Daemon: Red Pill not installed (Daedalus rep 87k), hacking 3127; not ready.
Measured, 12 samples 18:20 to 19:15: cash 501t/h, hacking exp 29.2b/h (7.4 levels/h), karma -18.8/h, MCP rate
114b/s average 137b/s, share 1.56; rep/h The Dark Army 440k, BitRunners 222k, NiteSec 156k, The Syndicate 139k.
Trend: `cash/h 499t>500t>501t STEADY | MCP 5.61b>111b>114b STEADY | hackExp/h 29.3b>29.3b>29.2b STEADY | rep work
The Dark Army 417k>376k>440k SWITCH | rep best The Dark Army 417k>376k>440k SWITCH` (cycle 20.7h; SWITCH is the
Covenant to Dark Army move, not a slowdown). Advisor: **wait** (Graphene Bionic Arms Upgrade in 50m, +34%/h beats
the cycle's +6.1%/h); decision: **no install, agree**; keep holding until the 4th Covenant sleeve is bought, then
install (13 augmentations plannable for $2.7t).

**BN10 check 2026-11-07 17:15 Pacific (PC clock 18:15), 2-hourly task: steady on Covenant work, no changes.** Not a
stand-aside run (no session running). Live (autosave summary, sleeve/buyer/readiness status 17:15, metrics 17:10): BN10,
cash $6.83q, hacking 3111, combat 861/1040/880/850, karma -54.2k, **54 installed, 0 queued**, 12 factions, player on The
Covenant hacking work. Sleeves: 0 on The Dark Army rep (shock 0, sync 99), 1-3 on shock recovery (shock 78.4, down 10.8
in 2h, so about 14h more). `sleeve_buyer.js` saving for the 4th Covenant sleeve ($10q, $3.2q short, about 6.4h at
499t/h, so near 23:40 Pacific); no purchase since 13:15. World Daemon: Red Pill not installed, hacking 3111; not ready.
Measured, 12 samples 16:15 to 17:10: cash 499t/h, hacking exp 29.3b/h (8.2 levels/h), karma -18.6/h, MCP rate 5.61b/s
average 137b/s, share 1.55; rep/h The Covenant 417k, BitRunners 218k, NiteSec 153k, The Syndicate 137k. Trend: `cash/h
497t>498t>499t STEADY | MCP 98.7b>156b>5.61b STEADY | hackExp/h 29b>28.8b>29.3b STEADY | rep work The Covenant
420k>416k>417k STEADY | rep best The Covenant 420k>416k>417k STEADY` (cycle 18.6h; the low MCP figure is the
instantaneous rate during target rotation, cash/h is flat). Advisor: **wait** (Graphene Bone Lacings from The Covenant
in 11m); decision: **no install, agree**; keep holding installs until the 4th Covenant sleeve is bought. SPTN-97 needs
+370k Covenant rep (about 53m).

**BN10 check 2026-11-07 15:15 Pacific (PC clock 16:15), 2-hourly task: steady on Covenant work, no changes.** Not a
stand-aside run (no session running). Live (autosave summary, sleeve/buyer/readiness status 15:15, metrics 15:15):
BN10, cash $5.84q, hacking 3094, combat 861/1040/880/850, karma -54.1k, **54 installed, 0 queued**, 12 factions, player
on The Covenant hacking work. Sleeves: 0 on Speakers for the Dead rep (shock 0, sync 99), 1-3 on shock recovery
(shock 89.2, down from 100 at 13:15, so about 16h more). `sleeve_buyer.js` is saving for the 4th Covenant sleeve
($10q); no purchase since 13:15. Game `ps` again returned no lines (player focused); residents judged from status
files under 2 min old. World Daemon: Red Pill not installed, hacking 3094; not ready. Measured, 13 samples 14:15 to
15:15: cash 497t/h, hacking exp 29.1b/h (9.3 levels/h), karma -19/h, MCP rate 91.6b/s average 136b/s, share 1.55;
rep/h The Covenant 418k, BitRunners 217k, NiteSec 153k, The Syndicate 137k. Trend: `cash/h 494t>-580t>497t STEADY |
MCP 33.7b>121b>91.6b STEADY | hackExp/h 29.2b>29.2b>29.1b STEADY | rep work The Covenant 413k>417k>418k STEADY | rep
best The Covenant 413k>417k>418k STEADY` (cycle 16.7h; the negative middle cash window is the 13:15 sleeve purchases).
Advisor: **wait** (Synthetic Heart from The Covenant in 24m, +168.8k rep); decision: **no install, agree**. Judgement
for the next runs: an install resets cash, so hold installs until the 4th Covenant sleeve is bought ($4.16q short,
about 8.4h at 497t/h, so near 23:40 Pacific) unless rep gain decelerates sharply; the sleeve persists into every later
BitNode, an extra install cycle does not. Share A/B: already run 2026-11-05 (docs/experiments.md, x1.48 rep, kept
on); the task prompt's "not yet run" note is stale.

**Sleeve 0 augmentations bought by Ken, 2026-11-07 morning Pacific (manual).** Ken bought every augmentation available to the first sleeve. No script buys sleeve augmentations (no `purchaseSleeveAug` anywhere), so a cash dip around then is this. Same session: gang objective set to reputation, gang gear buying on (bn10 `gang_capital_policy.json`, cheap useful gear under 0.01% of cash), `mcp_money` shows donations, HUD wraps at 48 characters and caps its height to the game window.

**Gang created 2026-11-07 about 09:26 Pacific (Claude Code session, Ken's choice).** New `gang_create.js` (core/gang, in `startup.js` in place of `gang-controller.js`) created The Black Hand hacking gang at karma -54k and started `gang-controller.js` (3 members training hacking, respect mode). **Discovery:** creating a gang sets that faction's rep to 0 (bitburner-src `PlayerObjectGangMethods.ts` `startGang`: `fac.playerReputation = 0`). The Black Hand lost about 1.09m rep and its pending +38.8 favor; its 183 favor stays, so donations still work. In practice nothing was lost: all 10 augmentations The Black Hand sells were already owned (save export checked against bitburner-src `Augmentations.ts`), and NeuroFlux is sold by factions with more rep. As the gang faction it now offers most augmentations, paid for with gang respect or donation. In a future BitNode, check what the faction still sells first.

**BN10 check 2026-11-07 13:15 Pacific (PC clock 14:15), 2-hourly task: joined The Covenant, 3 Covenant sleeves
bought.** Not a stand-aside run (no session running). Live (autosave summary, status files and metrics 13:15): BN10,
cash $7.17q before purchases, hacking 3075, combat 861/1040/880/850, karma -54.1k, **54 installed, 0 queued**, 12
factions: **The Covenant joined** (invite came after the 11:15 check) and the player works for it (hacking). Started
`sleeve_buyer.js` via game_terminal.py at about 13:15: it **bought 3 Covenant sleeves ($10t, $100t, $1q) and 99 memory
points on each of the 4 sleeves (memory 1 to 100), $2.33q in all, every purchase `ok`** (`sleeve_buyer_status.json`,
43 records with cost, payoff model and cash before/after; the model's payback hours are an assumption, the real
payoff is that sleeves and memory persist into later BitNodes). Cash after: $4.85q. The buyer now saves for the 4th
Covenant sleeve ($10q, about 10h at the measured cash rate). `sleeve_controller.js` picked up the new sleeves at once:
sleeves 1-3 on shock recovery (shock 100, about 18 game hours), sleeve 0 on Speakers for the Dead rep. Status shows
reserve 0 although the pulled `capital_policy.json` says $70b; harmless at this cash, not investigated. Game `ps`
again returned no lines (player focused), so `run_report.js` and other residents were judged from fresh status files.
World Daemon: Red Pill not installed, hacking 3075; not ready. Measured, 12 samples 12:20 to 13:15: cash 494t/h,
hacking exp 29.2b/h (10.9 levels/h), karma -18.6/h, MCP rate 47.8b/s average 136b/s, share 1.56; rep/h The Covenant
411k, BitRunners 215k, NiteSec 152k, The Syndicate 139k. Trend: `cash/h 493t>494t>494t STEADY | MCP 130b>214b>47.8b
STEADY | hackExp/h 29.3b>29.1b>29.2b STEADY | rep work The Covenant -->349k>411k SWITCH | rep best The Covenant
212k>349k>411k SWITCH` (cycle 14.7h). Advisor: **wait** (Synfibril Muscle from The Covenant in 34m); decision: **no
install, agree** (Covenant rep at 411k/h is the best source; SPTN-97 needs +2.0m). Run target updated: sleeve
milestones replaced by "Fourth Covenant sleeve ($10q)"; aug weights moved from combat to hacking (combat 0.2,
hacking_exp 0.3) since the combat gate is met and Red Pill/hacking 6000 come next. Share A/B not run (faction work
only just started; first quiet two-hour stretch on Covenant work is a candidate).

**BN10 check 2026-11-07 11:15 Pacific (PC clock 12:15), 2-hourly task: Covenant gym, steady, no changes.** Not a
stand-aside run (no session running). Live (autosave summary, readiness/MCP/player/maintenance status 11:15, metrics
11:10): BN10, cash $6.18q, hacking 3053, combat 861/1040/849/844, karma -54.0k, **54 installed, 0 queued**, 11
factions, player at Powerhouse Gym on agility (covenantTarget). Gang (The Black Hand, created 09:26) karma gain has
stopped as expected (-18/h). Game `ps` via game_terminal.py returned no lines in three tries (player focused at the gym),
so residents were judged from fresh status files (MCP, player, readiness, maintenance, CCT all under 10 min old);
`gang-controller.js` not directly confirmed. World Daemon: Red Pill not installed, hacking 3053; not ready. Measured, 13
samples 10:10 to 11:10: cash 493t/h, hacking exp 29.3b/h (13 levels/h), MCP rate 91.1b/s average 134b/s, share 1.56;
rep/h BitRunners 212k, NiteSec 149k, The Syndicate 133k, CyberSec 125k, Tian Di Hui 117k (no faction worked). Trend:
`cash/h 462t>492t>493t STEADY | MCP 173b>109b>91.1b DECELERATING | hackExp/h 29.1b>28.7b>29.3b STEADY | rep work n/a |
rep best BitRunners 203k>210k>212k STEADY` (cycle 12.6h). The MCP deceleration is in the instantaneous rate only
(average 134b/s, cash/h flat), so it reads as target rotation noise, not lost income. Advisor: **wait** (Synfibril
Muscle in 1.6h); decision: **no install, agree** (an install would reset the gym stats one level short of the
invite). Covenant: agility 844/850 and dexterity 849/850, strength and defence done: **invite expected within about
an hour**; next run joins-check and starts `sleeve_buyer.js` (exits harmlessly before membership). Share A/B not run
(player not on faction work).

**BN10 check 2026-11-07 09:15 Pacific (PC clock 10:15), 2-hourly task: Covenant gym, steady, no changes.** Not a
stand-aside run (no session running). Live (autosave summary, readiness/MCP/player status 09:14, metrics 09:10, game
`ps` read): BN10, cash $5.19q, hacking 3027, combat 836/1038/848/824, karma -53.8k, **54 installed, 0 queued**, 11
factions, player at Powerhouse Gym on agility (covenantTarget). All residents running, including `run_report.js`,
`metrics_logger.js` and the new `gang_create.js` (commit 40f7d15); at -1.14k karma/h it should create The Black Hand
gang about 09:25 Pacific and start `gang-controller.js` (not observed yet). World Daemon: Red Pill not installed,
hacking 3027; not ready. Measured, 11 samples 08:15 to 09:10: cash 462t/h, hacking exp 29.1b/h (15.3 levels/h), karma
-1.14k/h, MCP rate 173b/s average 119b/s, share 1.56; rep/h BitRunners 203k, NiteSec 143k, The Syndicate 128k, Tian
Di Hui 111k, The Black Hand 110k (no faction worked). Trend: `cash/h 486t>488t>462t STEADY | MCP 105b>164b>173b STEADY |
hackExp/h 29.4b>28.9b>29.1b STEADY | rep work n/a | rep best BitRunners 212k>212k>203k STEADY` (cycle 10.6h). Advisor:
**build** (Graphene BrachiBlades in 1m); decision: **no install, agree** (an install resets the gym). Covenant: agility
824/850 (+22 levels in 2h), strength 836, dexterity 848, defence done: **invite expected about 11:30 to 12:30 Pacific**,
then start `sleeve_buyer.js`. Share A/B not run (player not on faction work).

**BN10 check 2026-11-07 07:15 Pacific (PC clock 08:15), 2-hourly task: Covenant gym, steady, no changes.** Not a
stand-aside run (no session running). Live (autosave summary, readiness/MCP/maintenance status 07:14, metrics 07:10):
BN10, cash $4.24q, hacking 2995, combat 816/1023/805/802, karma -51.5k, **54 installed, 0 queued**, 11 factions
(Daedalus rep 35.7k, favor 0), player at Powerhouse Gym, currently on strength (covenantTarget). Residents judged from
fresh status files (MCP, player, readiness, maintenance all 07:13 to 07:14); game `ps` not read. World Daemon: Red Pill
not installed, hacking 2995; not ready. Measured, 12 samples 06:15 to 07:10: cash 486t/h, hacking exp 29.4b/h (19.1
levels/h), karma -950/h, MCP rate 63.2b/s average 136b/s, share 1.56; rep/h BitRunners 210k, NiteSec 148k, The
Syndicate 136k, Tian Di Hui 115k (no faction worked). Trend: `cash/h 492t>484t>486t STEADY | MCP 264b>51.3b>63.2b
STEADY | hackExp/h 28.9b>29.1b>29.4b STEADY | rep work n/a | rep best BitRunners 208k>208k>210k STEADY` (cycle 8.6h).
Advisor: **build** (Graphene BrachiBlades in 26m); decision: **no install, agree** (an install resets the gym).
Covenant ETA from the metrics: agility exp 1.07m of about 1.70m, +288k over the last 2h (about 144k/h), strength 119k
of 148k, dexterity 95k of 126k, so about 5h more: **invite expected about 12:00 to 12:30 Pacific**, then start
`sleeve_buyer.js`. Share A/B not run (player not on faction work).

**BN10 check 2026-11-07 05:15 Pacific (PC clock 06:15), 2-hourly task: Covenant gym, steady, no changes.** Not a
stand-aside run (no session running). Live (autosave summary, readiness/MCP/player status 05:14, metrics 05:10): BN10,
cash $3.24q, hacking 2954, combat 799/1007/802/769, karma -49.4k, **54 installed, 0 queued**, 11 factions (Daedalus rep
27.5k, favor 0), player at Powerhouse Gym on agility (covenantTarget). Game `ps` via game_terminal.py again returned no
output (player focused at the gym); residents judged from fresh status files (MCP, player, readiness, maintenance, CCT,
dnet all 05:05 to 05:14). World Daemon: Red Pill not installed, hacking 2954 vs 6000; not ready. Measured, 13 samples
04:10 to 05:10: cash 492t/h, hacking exp 28.9b/h (25.2 levels/h), karma -1.16k/h, MCP rate 268b/s average 137b/s,
share 1.56; rep/h BitRunners 207k, NiteSec 146k, The Syndicate 130k, Tian Di Hui 113k (no faction worked). Trend:
`cash/h 518t>522t>492t STEADY | MCP 186b>131b>268b STEADY | hackExp/h 29.2b>28.9b>28.9b STEADY | rep work n/a | rep best
BitRunners 203k>205k>207k STEADY` (cycle 6.6h). Advisor: **build** (Graphene BrachiBlades in 52m); decision: **no
install, agree** (an install resets the gym). Covenant ETA from the metrics: agility exp 786k of about 1.70m, +124k in
the last hour (strength also took +26k, now 106k of 148k; dexterity 93k of 126k), so about 6 to 7h more: **invite
expected about 12:00 to 13:00 Pacific**, then start `sleeve_buyer.js`. Share A/B not run (player not on faction work).

**BN10 check 2026-11-07 03:16 Pacific (PC clock 04:16), 2-hourly task: Covenant gym, steady, no changes.** Not a
stand-aside run (no session running). Live (autosave summary, readiness 03:13, MCP status 03:15, metrics 03:10): BN10,
cash $2.26q, hacking 2901, combat 756/989/740/729, karma -47.2k, **54 installed, 0 queued**, 11 factions (Daedalus rep
18.7k, favor 0), player at Powerhouse Gym on agility (covenantTarget). MCP fresh; game `ps` through game_terminal.py
again returned no output (player focused at the gym), so residents were judged from fresh status files only. World
Daemon: Red Pill not installed, not ready. Measured, 12 samples 02:15 to 03:10: cash 518t/h, hacking exp 29.2b/h (37.6
levels/h), karma -1.05k/h, MCP rate 179b/s average 133b/s, share 1.56; rep/h BitRunners 204k, NiteSec 144k, The
Syndicate 128k, Tian Di Hui 112k (no faction worked). Trend: `cash/h 507t>512t>518t STEADY | MCP 140b>203b>179b STEADY |
hackExp/h 29.1b>29b>29.2b STEADY | rep work n/a | rep best BitRunners 201k>201k>204k STEADY` (cycle 4.6h). Advisor:
**build** (Graphene BrachiBlades in 1.3h); decision: **no install, agree** (an install resets the gym). Covenant ETA
from the metrics: agility exp 538k of about 1.70m, gaining 147k/h over the last hour, so about 8h; strength (79k of
148k) and dexterity (62k of 126k) add about 1h. **Invite expected about 12:00 Pacific**, then start `sleeve_buyer.js`.
Share A/B not run (player not on faction work).

**BN10 check 2026-11-07 01:20 Pacific (PC clock 02:20), 2-hourly task: Covenant gym, steady, no changes.** Not a
stand-aside run (no session running). Live (autosave summary, player status 01:13, readiness 01:13, sleeve status
01:14, metrics 01:10): BN10, cash $1.23q, hacking 2814, combat 694/970/735/658, karma -45.0k, **54 installed, 0
queued**, 11 factions (Daedalus rep 9.8k, favor 0), player at Powerhouse Gym on agility (covenantTarget), sleeve 0 on
Homicide (shock 0, sync 99). MCP, steward, controller, readiness and metrics files are all fresh; game `ps` through
game_terminal.py returned no output this run, so the resident list was not read directly. World Daemon: Red Pill not
installed, not ready. Measured, 26 samples 23:10 to 01:10: cash 508t/h, hacking exp 29b/h (112 levels/h), karma
-1.06k/h, MCP rate 159b/s average 116b/s, share 1.55; rep/h BitRunners 200k, NiteSec 136k, The Syndicate 122k, Tian Di
Hui 106k (no faction worked). Trend: `cash/h 504t>508t n/a | MCP 194b>130b n/a | hackExp/h 29.1b>29b n/a | rep work n/a
| rep best BitRunners 187k>199k n/a` (cycle 2.6h). Advisor: **build** (Graphene BrachiBlades in 1.8h); decision: **no
install, agree**: an install would reset the gym progress. **Covenant ETA revised down from 35h:** from the metrics,
agility (level multiplier 3.28) needs 1.70m exp for 850 against 265k now, and gained about 122k exp/h over the last
0.9h (part of that hour went to dexterity), so about 10 to 11h of gym; strength (needs 148k, has 52k) and dexterity
(126k, has 60k) add under 1h. The open decision from 23:17 is settled: keep the gym, no installs until the invite. Cash
already covers Covenant sleeves 1 to 3 ($10t + $100t + $1q); the 4th is $10q. `capital_policy.json` reserve stays 0,
since `sleeve_buyer.js` spends cash above the reserve and cash is accumulating. Share A/B not run (player not on faction
work). Next: Covenant invite in about 11h, then start `sleeve_buyer.js`.

**The 22:32 Pacific install is explained, 2026-11-07 about 01:00 Pacific.** Ken: it came from a chat session while
he was working out why the scheduled task would not run there (the wrong environment for it). So it was not a rogue
automated run. It stays unrecorded: NEMEAN Subdermal Weave installed (53 to 54), no `pre-install12` backup, no metrics
before it. Nothing to fix; later checks need not flag it. **Stand-aside rule changed** in the scheduled task: a run now
stands aside only when another BitBurner session or run of the task shows `isRunning` true in the app's session list,
not on a commit under 30 minutes old (4 of the last 20 runs stood aside for idle sessions). Schedule is now every 2nd
hour (7 past odd hours, PC clock).

**Augmentations sold by several factions, 2026-11-07 about 00:35 Pacific (PC clock 01:35).** Ken: make sure the
code treats an augmentation offered by more than one faction as one choice and picks the best route. Changes:
`donationPlan` (aug_install_logic.js) no longer sizes a faction's gift by a name already rep-ready elsewhere, and a name
sold by several donating factions is donated for only where its rep gap is smallest; `fluxSeller` buys NeuroFlux from a
donating seller, then the one with most rep (was the first donating one found); the player controller
(player_activity_logic.js `repTarget`) skips work for a name any donating faction sells (cash buys that rep), and keeps
its bundle scoring, which credits a faction with every name its climb reaches, so a shared name goes to the cheaper
route; the readiness advisor counts such names as cash-limited, and skips names rep-ready anywhere. 533 tests pass;
files synced (`profile.py check --content` 0 differ); controller restarted (`restart_player.js`), readiness re-runs each
2 min via the steward; both read back ok at 00:33/00:34. Live example: Synfibril Muscle and Synthetic Heart are sold by
both Speakers for the Dead and Daedalus.

**BN10 hourly check 2026-11-06 23:17 Pacific (PC clock 00:17 on 11-07), hourly task: Covenant gym, run target
extended.** Not a stand-aside run (last commit 22:25 Pacific). Live (autosave summary 23:14, readiness 23:13, sleeve
status 23:14, game `ps`, metrics 23:15): BN10, cash $222t, hacking 2584, combat 587/849/625/437, karma -42.8k, **54
installed**, 0 queued, Daedalus joined (rep 1.7k, favor 0), player at Powerhouse Gym on agility (covenantTarget),
sleeve 0 on Homicide (shock 0, sync 99), MCP fresh, residents and run_report.js running. **Unrecorded install:** a new
cycle began 22:32 Pacific and NEMEAN Subdermal Weave is now installed (53 to 54); no STATE entry, commit or
`saves/pre-install12` backup exists for it, so whichever session did it skipped the backup and the record. World Daemon:
in the save but not linked (Red Pill not installed), requires hacking 6000; not ready. Measured, 9 samples 22:35 to
23:15: cash 356t/h, hacking exp 25.9b/h (905 levels/h), karma -956/h, MCP rate 127b/s average 43.6b/s, share 1.49;
rep/h Tian Di Hui 20.5k, NiteSec 19.7k, Slum Snakes 17.3k, CyberSec 16.3k (no faction worked). Trend: all n/a (cycle
0.7h). Advisor: **build** (Graphene BrachiBlades in 2.2h); decision: **no install, agree**. Covenant ETA: agility is the
long pole. From the samples, agility's level multiplier is about 3.3, so 850 needs about 1.7m exp against about 33k
now, and it gained about 8k exp in 10 min: roughly 35h of gym, and any install resets it. Strength (about 150k exp) and
dexterity (about 120k) are short. Red Pill: 5m Daedalus rep (x2 in BN10). Route: work Daedalus to favor 150 (about 465k
rep), install, then donate for the rest. Changed: `run_target.json` gains Second Covenant sleeve ($100t), Red Pill and
World Daemon hacking 6000 steps (528 tests pass, pushed to the game). **Open decision for the next runs:** 35h of
install-free gym for the Covenant versus Daedalus favor and the Red Pill first. Weigh agility augmentations, and whether
the gym estimate drops as agility exp grows.

**BN10 install 11 ran 2026-11-06 21:15 Pacific (PC clock 22:15), hourly task.** Before (autosave summary 21:14,
readiness 21:13, metrics 21:10): BN10, cash $2.09q, hacking 2344, combat 301/221/316/203, karma -39.4k, 44 installed, 0
queued, all 17 residents running, player on The Syndicate hacking work (rep 475k to 483k, favor gain 151.3). World
Daemon: not present (no Daedalus, Red Pill not installed). Measured, 13 samples 20:10 to 21:10: cash 582t/h, hacking exp
15.6b/h (41 levels/h), karma -1.01k/h, MCP rate 146b/s average 146b/s, share 1.55; rep/h The Syndicate 235k, BitRunners
93.9k, NiteSec 85.3k, Tian Di Hui 64.1k, The Black Hand 62k, CyberSec 60.1k. Trend: `cash/h 599t>575t>582t STEADY | MCP
245b>147b>141b STEADY | hackExp/h 15.7b>15.6b>15.6b STEADY | rep work The Syndicate SWITCH | rep best The Syndicate
SWITCH` (cycle 3.9h). Advisor: **install** (NEMEAN Weave +15.5%/h under the cycle's +59.2%/h). **Decision: install,
agree:** the Syndicate favor-150 hold from 20:15 was met. Backup `saves/bitburnerSave_pre-install11_BN10_2026-11-06.json.gz`
(gzip checked, player parsed, node 10, 44 augs, 0 queued, SHA-256
ebf3a45ce2b0e901e401514381adc2ffaab1d83e5af47cbed71c0b44161224cc). `aug_install.js` bought The Illustrated Primer, The
Shadow's Simulacrum, Bionic Legs, Bionic Spine, BrachiBlades, Combat Rib II and III, Augmented Targeting II and III, then
6 NeuroFlux ($5.78t donated for NeuroFlux rep); `--install` put the remaining $1.08q into home RAM (2,097,152GB) and a 7th
core, then installed. After: game `ps` 22:16 PC clock shows all 17 residents from PID 2; autosave summary **53 installed,
0 queued**, karma -39.4k. The game_terminal call for `--install` timed out on the websocket (the install reloads the
page); state confirmed afterwards. Capital (AGENTS.md rule): about $1q on augmentations, NeuroFlux and home. Expected
payoff: combat multipliers toward the Covenant's 850 and Syndicate favor 151 (donations open). Outcome: pending next
check. `metrics.py cycles` pending (no new-cycle sample yet). Next: factions rejoin, buy NEMEAN Subdermal Weave (1.75m
rep) by Syndicate donation, then Daedalus at hacking 2500 and combat toward 850.

**BN10 hourly check 2026-11-06 20:15 Pacific (PC clock 21:15), hourly task: install held for Syndicate favor 150.** Live
(autosave summary, game `ps` 20:16, readiness 20:14, sleeve status 20:14, metrics 20:10): BN10, cash $1.51q, hacking 2304,
combat 298/219/314/202, karma -38.3k, 44 installed, 0 queued, all 17 residents running, player on The Syndicate hacking
work (rep 249k, favor 0), sleeve 0 on Homicide (shock 0, sync 99). World Daemon: not present (no Daedalus, Red Pill not
installed). Measured, 12 samples 19:15 to 20:10: cash 575t/h, hacking exp 15.6b/h (59 levels/h), karma -961/h, MCP rate
147b/s average 140b/s, share 1.56; rep/h The Syndicate 227k, BitRunners 93.1k, NiteSec 82.5k, Tian Di Hui 60.5k, The
Black Hand 60k, CyberSec 56k. Trend: `cash/h n/a | MCP n/a | hackExp/h n/a | rep work The Syndicate SWITCH | rep best The
Syndicate SWITCH` (cycle 2.9h; MCP rate fell 245b to 147b/s and levels/h 113 to 59, the latter expected as level follows
log of exp). Advisor: **wait** 13m for Bionic Legs (300k). **Decision: wait, agree, but longer than advised:** keep
working The Syndicate to about 465k rep (favor gain 150, from 25000*(1.02^f-1)), about 55 min past Bionic Legs, then install.
Next cycle The Syndicate is then donatable, so NEMEAN Subdermal Weave (1.75m rep, the best value left, 0.79) and The
Illustrated Primer can be bought by donation at once instead of about 3.5h more work and another install. Install plan
then: Shadow's Simulacrum, Bionic Spine, BrachiBlades, Combat Rib II, Augmented Targeting II, Bionic Legs, NeuroFlux.
Daedalus estimate corrected: hacking 2500 needs about 2e11 exp (about 126 levels per e-fold of exp), about 10h at
15.6b/h without an install, not 2h. No changes made. Next: install at Syndicate rep >= 465k (about 21:15 Pacific).

**BN10 hourly check 2026-11-06 19:15 Pacific (PC clock 20:15), hourly task: The Syndicate joined, steady.** Live
(autosave summary, game `ps`, readiness 19:14, metrics 19:10): BN10, cash $934t, hacking 2246, combat 296/218/312/200,
karma -37.4k, 44 installed, 0 queued, all 17 residents running, player on The Syndicate hacking work (rep 21.0k, favor 0,
so no donations there). The `faction_join.js` change from 18:16 is now observed: The Syndicate invite was accepted.
World Daemon: not present (no Daedalus, hacking 2246/2500 for it; Red Pill not installed). Measured, 12 samples 18:15
to 19:10: cash 599t/h, hacking exp 15.7b/h (113 levels/h), karma -4.61k/h, MCP rate 245b/s average 122b/s, share 1.56;
rep/h BitRunners 86.6k, NiteSec 78.6k, Tian Di Hui 62.9k, The Black Hand 56.9k, CyberSec 53k, Tetrads 50.6k, Slum Snakes
49.4k. Trend: `cash/h n/a | MCP n/a | hackExp/h n/a | rep work The Syndicate SWITCH | rep best BitRunners n/a` (cycle
1.9h). Advisor: **wait** (BrachiBlades 4.0k rep away, then Combat Rib II, Bionic Spine 90k, Bionic Legs 300k at about
223k rep/h); decision: **wait, agree**: buy The Syndicate's combat augmentations as rep allows and install them in one
batch. No changes made. Next: Syndicate rep, Daedalus at hacking 2500 (about 2h at this rate), The Dark Army at combat
300 (defense and agility short), gang at karma -54k (about 3.6h).

**BN10 hourly check 2026-11-06 18:16 Pacific (PC clock 19:16), hourly task: Syndicate and Dark Army gates added.** Live
(autosave summary, `ps`, metrics 18:10): BN10, cash $336t, hacking 2133, combat 273/201/288/184, karma -33.0k, 44
installed, 0 queued, all 17 residents running, player on Homicide for karma. World Daemon: not present (no Daedalus, Red
Pill not installed). Measured, 11 samples 17:20 to 18:10: cash 379t/h, hacking exp 12.7b/h (876 levels/h), karma -1.8k/h,
MCP rate 130b/s average 41.6b/s, share 1.5; rep/h BitRunners 75.4k, NiteSec 68.4k, Tian Di Hui 49.6k, The Black Hand
49.5k (no faction is being worked). Trend: all n/a (cycle 0.9h). Advisor: **build** (nothing valued in joined factions);
decision: **build, agree**. NeuroFlux by donation is affordable but waits to share an install with the new factions'
augmentations, since each queued purchase raises later prices about 1.9x. **Changed:** `faction_join.js` now travels to
Sector-12 for The Syndicate (hacking and combat 200, karma -90) and back to Chongqing for The Dark Army (hacking and
combat 300, 5 kills), requirements read from bitburner-src `FactionInfo.tsx`; both sell combat augmentations toward the
Covenant's 850. 522 tests pass; restarted in game (PID 79480). Agility (184) is the only Syndicate blocker and rises
about 1 level per 5 minutes from Homicide, so the invite is expected in about 80 minutes; not yet observed. Next:
Daedalus at hacking 2500, gang at karma -54k (about 12h), Syndicate augmentations then an install.

**BN10 install 10 ran 2026-11-06 17:17 Pacific (PC clock 18:17), hourly task.** Before (metrics 17:10, readiness
17:13, autosave summary 17:14): BN10, cash $138t to $155t, hacking 1470, combat 233/172/247/158, karma -31.0k, 42
installed, 0 queued, all 17 residents running. World Daemon: not present (no Daedalus, Red Pill not installed).
BitRunners favor read back **163** (install 9 confirmed), NiteSec 260, Tian Di Hui 161, The Black Hand 159: past the 150
donation threshold. Measured, 12 samples 16:15 to 17:10 (new cycle): hacking exp 4.77b/h, karma -1.02k/h, cash 98.5t/h
(MCP rate 56.9b/s, average 8.48b/s, share 1.43; about 17x last cycle's 5.6t/h after CSP Gen V and the ENM Core
Implant); rep/h negative for every faction (the install reset). Trend: all n/a (cycle 0.9h). Advisor: **build** (Neurolink
1.6m rep, about 4.7h by work), blind to donations. **Decision: buy by donation, then install, disagree.** `aug_install.js`
(no `--install`) donated $661b to BitRunners and bought Embedded Netburner Module Core V2 Upgrade and BitRunners
Neurolink, then 11 NeuroFlux ($2.28t donated for NeuroFlux rep), cash $155t to $28.7t. That left every joined faction
with nothing to sell, so BitRunners work only added hacking exp. I installed at once rather than bank cash for more
NeuroFlux: 13 queued purchases multiply every later price by about 1.9 each, and the gang augmentations bought after
karma -54k must not pay that. Backup `saves/bitburnerSave_pre-install10_BN10_2026-11-06.json.gz` (gzip checked, player
parsed, node 10, 42 augs, 13 queued, SHA-256 3190b5278ff9f3714dcb0894dcacd8bc4687ba9ac79183dbd0229930a2c6d8ca).
`aug_install.js --install` (`aug_install_status.json`): nothing more to buy, $34t to home cores (6, was 5), installed.
After: game `ps` 17:20 shows all 17 residents from PID 2; autosave summary: **44 installed, 0 queued**, karma -31.1k,
hacking already **1180 at 5.8m exp** (implied hacking mult about 3.95, was about 2.85). At that mult Daedalus's hacking
2500 needs about 2e11 exp, a day or two at this cycle's exp rate. Worth watching (Daedalus leads to The Red Pill and the
World Daemon stop). Player controller 17:19: gym, agility 2/75 baseline; not yet observed after it: crime
for karma toward -54k, the gang that should sell combat augmentations). `metrics.py cycles` pending (no new-cycle
sample yet). Capital (AGENTS.md rule): about $155t on augmentations and NeuroFlux, $34t on a home core. Expected payoff:
+11% every multiplier and the hacking jump above. Outcome: hacking 1180 on 5.8m exp, read in the autosave right after
the install.

**BN10 install 9 ran 2026-11-06 about 16:14 Pacific (PC clock 17:14), hourly task.** Before (metrics 16:10, readiness
16:12, autosave summary 16:14): BN10, cash $9.04t, hacking 942, combat 242/178/239/163, karma -29.9k, 35 installed, 1
queued (The B00ts of Perseus), all 17 residents running, sleeve on Homicide. World Daemon: not present (no Daedalus, Red
Pill not installed). Measured, 12 samples 15:15 to 16:10: BitRunners 114k rep/h, NiteSec 28.6k, The Black Hand 19.7k,
Tian Di Hui 18.9k, CyberSec 17.9k, Tetrads 17.1k, Slum Snakes 16.3k, hacking exp 7.91b/h, karma -982/h, cash 5.6t/h, MCP
average 1.52b/s, rate 2.42b/s. Trend: `cash/h 4.89t>-16.4t>5.6t STEADY | MCP 773m>1.05b>2.42b ACCELERATING | hackExp/h
7.35b>7.83b>7.91b STEADY | rep work BitRunners 107k>112k>114k STEADY | rep best BitRunners STEADY`. Advisor: **install**
(next, BitRunners Neurolink, is 1.18m rep and about 10h away, +1.5%/h against the cycle's +5.4%/h); decision: **install,
agree**. Backup `saves/bitburnerSave_pre-install9_BN10_2026-11-06.json.gz` (gzip checked, player parsed, node 10, 35
augs, 1 queued, SHA-256 f4031e2a0324c0b435ad11b366147d2894b1b1d6f2eabb012350906d59573b20). `aug_install.js --install`
(`aug_install_status.json`) bought Artificial Bio-neural Network Implant, Embedded Netburner Module Core Implant, Neural
Accelerator, Cranial Signal Processors Gen IV and **Gen V** (added to the plan since last hour), Neuroreceptor Management
Implant, no failures, plus 3 NeuroFlux ($663b donated); home 256TB, 5 cores. After: game `ps` 16:15 shows all 17
residents back from PID 2; autosave summary 16:15: **42 installed, 0 queued**, hacking 30, player at Powerhouse Gym
(defense baseline 75 for Slum Snakes), cash slightly negative from gym fees (-$47k) while MCP starts. BitRunners favor
should be about 41 to 163 (readiness predicted +122; not yet read back, the readiness assessor runs on cloud servers and
had not refreshed). `metrics.py cycles`: closed cycle 09:28 to 16:14, 6.77h, rebuild hacking 2.02h; rep earned
BitRunners 561k, Tian Di Hui 241k, NiteSec 172k, The Black Hand 134k, CyberSec 114k, Tetrads 97.1k, Slum Snakes 96.2k;
favor banked pending (new cycle has two samples). Recovered by metrics 16:20: cash $1.98b, hacking 1037 (past the
pre-install 942), RAM 295k GB, advisor `build`. **Next:** confirm BitRunners favor; Covenant still needs every
combat stat 850 (`covenantTarget` true); first Covenant sleeve $10t after the invite.

**Hourly check, 2026-11-06 15:15 Pacific (PC clock 16:15): no changes by me; capital_manager bought home RAM.** Live
(metrics 15:10, readiness 15:12, `ps` 15:18, `capital_status.json` 15:14): BN10, cash $3.06t, hacking 931, combat
239/176/237/162, karma -28.9k, 35 installed, 1 queued (The B00ts of Perseus), all 17 residents running, sleeve on
Homicide. World Daemon: not present (no Daedalus, Red Pill not installed). **Capital purchase (AGENTS.md rule):**
`capital_manager.js` bought home RAM 131072GB to 262144GB at 14:37 for $14.99t (policy `homeRamTarget` 262144, `reserve`
0; set earlier, see the 2026-11-03 notes). Expected payoff: home RAM survives installs, so every later rebuild starts
with 256TB home. Observed so far: total RAM 7.995m to 8.126m GB (+1.6%), no visible change in MCP or cash/h in 35
minutes. Home is now at target, so no further home steps fire. Cash resets toward the first Covenant sleeve's $10t,
which still waits on combat 850 anyway. Measured, 13 samples 14:10 to 15:10: BitRunners 112k rep/h, NiteSec 26.3k,
Tian Di Hui 19.8k, The Black Hand 19.5k, CyberSec 17.8k, Tetrads 16.9k, Slum Snakes 16.1k, hacking exp 7.81b/h, karma
-1.07k/h, cash/h -15.1t (the purchase; income before it about 5.3t/h), MCP average 1.47b/s, rate 980m/s, share 1.47.
Trend: `cash/h 5.29t>4.66t>-15.1t DECELERATING | MCP 1.42b>1.02b>980m STEADY | hackExp/h 7.61b>7.17b>7.81b STEADY |
rep work BitRunners 112k>102k>112k STEADY | rep best BitRunners STEADY` (cash DECELERATING is the one-off $15t home
purchase, not an income drop; hacking income grew about 5.3t/h throughout). Advisor: **wait** (Artificial Bio-neural
Network Implant 95k rep away, about 50m); decision: **wait, agree**: one more hour adds it to Neural Accelerator, ENM
Core Implant, CSP Gen IV, Neuroreceptor and the queued B00ts of Perseus, and the install also takes BitRunners favor
from 41 to about 152, past the donation threshold. Expect the install next check (cash $3t covers the about $160b plan).

**Hourly check, 2026-11-06 14:15 Pacific (PC clock 15:15): steady, no changes.** Live (autosave summary, `ps` 14:16,
readiness 14:14, sleeve status 14:14, metrics 14:15): BN10, cash $12.8t, hacking 919, combat 237/174/234/160, karma
-27.9k, 35 installed, **1 queued: The B00ts of Perseus** (new since 13:15; in BN15 it was the cruel-lab reward, likely the darknet again; source not checked),
all 17 residents running, 1 sleeve on Homicide for karma (shock 0, sync 99). World Daemon: not present (no Daedalus,
Red Pill not installed). Player on BitRunners hacking work (346k rep). Measured, 10 samples 13:30 to 14:15: BitRunners
112k rep/h, NiteSec 26.9k, The Black Hand 20.8k, Tian Di Hui 19.5k, CyberSec 18.6k, Tetrads 16.6k, Slum Snakes 15.8k,
hacking exp 7.67b/h, karma -1.07k/h, cash 5.28t/h, MCP average 1.15b/s, rate 665m/s, share 1.56. Trend: `cash/h
2.64t>5.35t>5.28t STEADY | MCP 1.11b>1.45b>665m STEADY | hackExp/h 7.62b>7.61b>7.67b STEADY | rep work BitRunners
SWITCH | rep best BitRunners SWITCH` (cycle 4.8h, nothing DECELERATING; the last MCP read is low but the window
average holds). Advisor: **wait** (Embedded Netburner Module Core Implant 3.8k rep away, minutes); decision: **build,
agree**: Neural Accelerator is 54k away (about 0.5h at 112k/h). Expect the install next check, with Neural Accelerator,
ENM Core Implant, Cranial Signal Processors Gen IV, Neuroreceptor and the queued B00ts of Perseus. Cash is past the first
Covenant sleeve's $10t, but the invite still waits on combat 850.

**Hourly check, 2026-11-06 13:15 Pacific (PC clock 14:15): steady, no changes.** Live (autosave summary, `ps` 13:16,
readiness 13:13, sleeve status 13:15, metrics 13:15): BN10, cash $8.02t, hacking 903, combat 234/172/232/158, karma
-26.9k, 35 installed, 0 queued, all 17 residents running, 1 sleeve on Homicide for karma (shock 0, sync 99). World
Daemon: not present (no Daedalus, Red Pill not installed). Player on BitRunners hacking work for Neural Accelerator
(160k rep away, cash ready). Measured, 13 samples 12:15 to 13:15: BitRunners 112k rep/h, The Black Hand 31.4k, NiteSec
27.7k, Tian Di Hui 19.1k, CyberSec 18.1k, Tetrads 16.9k, Slum Snakes 16k, hacking exp 7.61b/h, karma -941/h, cash
5.31t/h, MCP average 1.09b/s, rate 1.48b/s, share 1.56. Trend: `cash/h 367b>2.3t>5.31t ACCELERATING | MCP
1.24b>1.04b>1.48b STEADY | hackExp/h 4b>7.63b>7.61b STEADY | rep work BitRunners SWITCH | rep best BitRunners SWITCH`
(cycle 3.8h, nothing DECELERATING). Advisor: **build** (Neural Accelerator in about 1.5h); decision: **build, agree**:
Neural Accelerator and Cranial Signal Processors Gen IV are close, and Neuroreceptor stays queued in `installPlan` for
that install. Cash passed $8t; the first Covenant sleeve still waits on combat 850 for the invite.

**Hourly check, 2026-11-06 12:15 Pacific (PC clock 13:15): steady, no changes.** Live (autosave summary, `ps` 12:16,
readiness 12:15, activity status 12:14, sleeve status 12:15, metrics 12:15): BN10, cash $2.81t, hacking 878 (past the
Covenant's 850), combat 231/170/229/156, karma -26.0k, 35 installed, 0 queued, all 17 residents running, 1 sleeve on
Homicide for karma (shock 0, sync 99). World Daemon: not present (no Daedalus, Red Pill not installed). Neuroreceptor
Management Implant is rep-ready (Tian Di Hui 166k; readiness `installPlan` lists it, $2.75b, not yet bought); the
controller moved the player to BitRunners hacking work at about 11:45 for Artificial Bio-neural Network Implant (422k
rep away). Measured, 12 samples 11:20 to 12:15: Tian Di Hui 96.6k rep/h, BitRunners 60.7k, NiteSec 26.9k, The Black Hand
20.4k, CyberSec 18.8k, Tetrads 16.2k, Slum Snakes 15.4k, hacking exp 7.62b/h, karma -995/h, cash 2.64t/h, MCP average
959m/s, rate 1.11b/s, share 1.55. Trend: `cash/h -->367b>2.64t n/a | MCP -->1.24b>1.11b n/a | hackExp/h -->4b>7.62b n/a
| rep work Tian Di Hui SWITCH | rep best Tian Di Hui SWITCH` (cycle 2.8h, nothing flagged DECELERATING). Advisor:
**build** (best next Neural Accelerator, 268k rep, about 2.4h); decision: **build, agree**: installing now would bank
only Neuroreceptor, and Neural Accelerator plus Cranial Signal Processors Gen IV (BitRunners, 118k away) land within
the next few hours. `priorityAugs` keeps Neuroreceptor until it is bought at the next install.

**Neuroreceptor Management Implant is the player target, 2026-11-06 about 10:40 Pacific (PC clock 11:40).** Ken: once
Bionic Arms is done, shift to Neuroreceptor. BN10 `player_activity_config.json` `priorityAugs` is now Bionic Arms (bought
in install 8) and Neuroreceptor Management Implant. Read live: the controller reason is "Tian Di Hui needs +127053 rep for
Neuroreceptor Management Implant (priority)". Priority picks come ahead of the favor push and the valued ranking. Remove the
name from `priorityAugs` once it is bought. Share confirmed back by itself after install 8 (1.41 at 10:15).

**Hourly check, 2026-11-06 10:15 Pacific (PC clock 11:15): steady, no changes.** Live (autosave summary, `ps` 10:15,
readiness 10:13, activity status 10:18, metrics 10:10): BN10, cash $72b to $112b, hacking 723 to 733, combat 148-223,
karma -24.0k, **35 installed** (install 8 read back: 33 + Glibness + Bionic Arms), 0 queued, all 17 residents running.
World Daemon: not present (no Daedalus, Red Pill not installed). Post-install gym baseline ran 09:40 to 10:17 (same
pattern as the 05:14 cycle), then the controller moved the player to BitRunners hacking work at 10:17 for Artificial
Bio-neural Network Implant (546k rep away). Measured, 8 samples 09:35 to 10:10 (new cycle only): NiteSec 17.7k rep/h,
The Black Hand 13.1k, Tian Di Hui 12.6k, CyberSec 12k, Slum Snakes 11.7k, BitRunners 3.95k, hacking exp 957m/h, karma
-996/h, cash 241b/h, MCP average 290m/s, rate 343m/s, share 1.41. Trend: all n/a (cycle 0.7h). `metrics.py cycles`:
previous cycle 4.23h, rebuild hacking 0.67h, rep 1.25h; rep earned Tetrads 124k, NiteSec 79.9k; favor banked The Black
Hand +40.3, NiteSec +32.4, Tetrads +16.7. Advisor: **build** (best next Neural Accelerator, 396k rep, about 5.6h);
decision: **build, agree**. Covenant combat 850: implied combat mult now about 1.9 (was 1.37), but `covenantGymHours`
still far over 48h, so combat remains the long pole (gang augmentations, karma -24.0k of -54k). The share A/B the
earlier entries call "not run" already ran on 2026-11-05 (`docs/experiments.md`: x1.38 to x1.48 rep, share kept on).

**BN10 install 8 ran 2026-11-06 about 09:29 Pacific (PC clock 10:29), hourly task.** Before (autosave summary 09:14
and 09:28, readiness 09:26, metrics 09:10, `ps` 09:16): BN10, cash $3.10t to $4.39t, hacking 841 to 844, combat
179-204, karma -23.2k, 33 installed, 0 queued, all 17 residents running. World Daemon: not present (no Daedalus, Red
Pill not installed). Player on Tetrads field work until Bionic Arms (125k) was rep-ready at about 09:26. Measured, 12
samples 08:15 to 09:10: Tetrads 38.7k rep/h, NiteSec 20.4k, The Black Hand 17.1k, Tian Di Hui 16.3k, CyberSec 15.4k,
Slum Snakes 12.8k, BitRunners 2.77k, hacking exp 6.9b/h, karma -937/h, cash -1.91t/h (cloud buying), MCP average
1.13b/s, rate 1.3b/s, share 1.56. Trend: `cash/h 279b>1.95t>-1.91t STEADY | MCP 713m>1.77b>1.3b STEADY | hackExp/h
7.4b>6.77b>6.9b STEADY | rep work Tetrads 32.4k>36.8k>38.7k STEADY | rep best Tetrads STEADY`; nothing decelerating.
Advisor: **install** (best next Neural Accelerator +1.2%/h, under the cycle's +13.3%/h); decision: **install, agree**:
the next weighted augmentation (ENM Core Implant) is about 294k rep away, 7h+ at the measured rate. Backup
`saves/bitburnerSave_pre-install8_BN10_2026-11-06.json.gz` (gzip checked, player parsed, node 10, 33 augs, 0 queued,
SHA-256 ae496ae8e0f2d950173b0c1e0e95ac06357bac5afdc5c0dcc6dcb428b10f1bb9). `aug_install.js --install`
(`aug_install_status.json`) bought Glibness Enhancement and Bionic Arms, no failures, plus 8 NeuroFlux ($501b donated
for NeuroFlux rep); home 128TB (was 32TB), 4 cores. After (`ps` 09:30): every resident back from PID 2. Expected 35
installed plus NeuroFlux levels (not yet read back). `metrics.py cycles`: pending, no sample from the new cycle yet.
Share relaunches itself via `xp_filler.js` as cloud servers rebuild. Covenant: installs met; still needs hacking 850
(reached 844 before the reset) and combat 850 (the long pole). Share A/B still not run (install hour).

**Hourly check, 2026-11-06 08:15 Pacific (PC clock 09:15): steady, no changes.** Live (autosave summary, `ps` 08:16,
readiness, metrics 08:10): BN10, cash $2.41t to $2.78t, hacking 824, combat 170-193, karma -22.1k, 33 installed, 0 queued,
all 17 residents running. World Daemon: not present (no Daedalus, Red Pill not installed). Player on Tetrads field work:
Glibness Enhancement 2.6k rep away (weight 0), Bionic Arms 46.6k away (about 1.2h). Measured, 12 samples 07:15 to 08:10:
Tetrads 36.8k rep/h, NiteSec 30.7k, The Black Hand 16.3k, Tian Di Hui 15.6k, CyberSec 14.6k, Slum Snakes 12.5k,
BitRunners 4.43k, hacking exp 6.77b/h, karma -1.05k/h, cash 1.95t/h, MCP average 1.03b/s, rate 1.77b/s, share 1.56.
Trend: `cash/h -->279b>1.95t n/a | MCP -->713m>1.77b n/a | hackExp/h -->7.4b>6.77b n/a | rep work Tetrads -->32.4k>36.8k
n/a | rep best Tetrads n/a` (cycle 2.9h, two windows only). Advisor: **build** (nothing to install; Bionic Arms in 1.2h);
decision: **build, agree**. Hacking 850 about 1h out at 26 levels/h; combat 850 and karma -54k (gang, about 30h) remain
the long poles. Share A/B not run: an install is likely within two hours.

**BN10 combat weighted like hacking, 2026-11-06 about 08:20 Pacific (PC clock 09:20).** Ken left the call to Claude.
The Covenant needs every combat stat 850. From the 07:50 sample the implied combat mult is about 1.37 (strength 175 at 27k
exp), so 850 needs about 1.35e11 exp per stat; hacking (783, mult about 1.49) needs about 28b and gets there in hours.
`covenantTraining` only starts the gym under 48h at 20 exp/s, which needs combat mult about 3.6. So
`profiles/bn10/config/run_target.json` now has `augWeights` with strength/defense/dexterity/agility 1 (were 0.25) and
combat exp 0.1 (were 0.025); hacking, hacking exp and faction rep unchanged. Read live: readiness `weightsFrom`
run_target.json, Bionic Arms value 0.131 to 0.525, still the controller's target. No defense or agility augmentation is
offered by a joined faction yet. Sleeve stays on Homicide: karma -20.9k toward -54k for a gang (about 35h at -940/h),
whose faction should sell the combat augmentations; sleeve gym time pays only once the mults are near 3.6.

**Share relaunches itself after installs, 2026-11-06 about 07:50 Pacific (PC clock 08:50).** `xp_filler.js` now keeps
`scripts/share.js` on the N smallest fillable cloud servers each 20s pass (`share_policy.json` `cloudServers`, default 8;
`share_deploy.js cloud N` writes N, `stop` writes 0), tops them up as they grow and stops share on other cloud servers.
So after an install share returns as cloud servers are rebuilt; **the hourly task no longer needs to run `share_deploy.js
cloud 8` after installs.** 522 tests pass in `build/bn10`; `profile.py check --content` clean; `xp_filler.js` restarted
live: status lists 8 share hosts (the ones already sharing, nothing to top up), share power 1.50 at 07:50.

**Hourly check, 2026-11-06 06:15 Pacific (PC clock 07:15): share relaunched, otherwise steady; no install.** Live
(autosave summary, `ps` 06:15, readiness, metrics 06:15): BN10, cash $139b to $186b, hacking 738, combat 144-164, karma
-20.1k, 33 installed (install 7 read back), 0 queued, all 17 residents running. World Daemon: not present (no Daedalus,
Red Pill not installed). Player on Tetrads field work for Bionic Arms, 116k rep away (about 4.3h). Cloud servers rebuilt
(RAM 2.92m GB), so `run share_deploy.js cloud 8` was relaunched; the 06:15 sample shows share power 1.50. Measured, 10
samples 05:20 to 06:05 (new cycle only; the 60-minute window crosses the install): Tetrads 17.1k rep/h, NiteSec 9.06k,
The Black Hand 7.51k, Tian Di Hui 7.16k, CyberSec 6.71k, Slum Snakes 6.52k, BitRunners 5.96k, hacking exp 1.85b/h,
karma -940/h, cash 247b/h, MCP average 275m/s, rate 487m/s. Trend: all n/a (cycle 0.9h). `metrics.py cycles`: previous
cycle 3.97h, rebuild hacking 1.81h, rep 2.06h; rep earned The Black Hand 208k, NiteSec 41k, CyberSec 33.7k, Tian Di Hui
32k, Tetrads 27.3k, Slum Snakes 22k, BitRunners 2.73k; favor banked: none recorded. New cycle rebuilt hacking in 0.67h.
Favor now: NiteSec 186, The Black Hand 137, Tian Di Hui 126. Advisor: **build** (nothing to install; best next Bionic
Arms in 4.3h); decision: **build, agree**. Covenant: installs met; still needs hacking 850, combat 850.

**BN10 install 7 ran 2026-11-06 about 05:15 Pacific (PC clock 06:15), hourly task.** Before (autosave summary,
`augmentation_readiness.json`, metrics 05:10, `ps` 05:14): BN10, cash $459b, hacking 662, combat 141-157, karma -19.2k,
30 installed, 0 queued, all 17 residents running. World Daemon: not present (no Daedalus, Red Pill not installed). Player
had moved to Tetrads field work (Bionic Arms, 96k gap); The Black Hand 208.8k, so Neuralstimulator, The Black Hand and
Enhanced Myelin Sheathing were rep-ready, CSP Gen IV (250k) 41k away. Measured, 13 samples 04:10 to 05:10: The Black Hand
42.3k rep/h, Tetrads 18.9k, NiteSec 14.1k, CyberSec 12.5k, Tian Di Hui 10.9k, Slum Snakes 8.0k, BitRunners 1.1k, hacking
exp 7.32b/h, karma -921/h, cash -31.4b/h (cloud buying), MCP average 505m/s, rate 518m/s, share 1.41. Trend: `cash/h
163b>299b>-31.4b STEADY | MCP 640m>447m>518m STEADY | hackExp/h 4.56b>3.6b>7.32b STEADY | rep work Tetrads
58.8k>91.7k>18.9k SWITCH | rep best The Black Hand 58.8k>91.7k>42.3k STEADY`; The Black Hand's fall is the player
leaving it for Tetrads, not a slowdown. Advisor: **install** (best next Bionic Arms +3.9%/h, under the cycle's +6.9%/h);
decision: **install, agree**: three augmentations were ready, CSP Gen IV is weighted 0 and would not lift The Black Hand
favor past 150 (97 + 40 now). Backup `saves/bitburnerSave_pre-install7_BN10_2026-11-06.json.gz` (gzip checked, player
parsed, node 10, 30 augs, 0 queued, SHA-256 d2b028ef1545a7dbb56e313d01056a91271848e84206db0a1eeb6e5512c7cac8).
`aug_install.js --install` (`aug_install_status.json`) bought Neuralstimulator, Enhanced Myelin Sheathing and The Black
Hand, no failures, plus 5 NeuroFlux ($179b donated for NeuroFlux rep); home 32TB, 4 cores. After (`ps` 05:15): every
resident back from PID 2. `run share_deploy.js cloud 8` at 05:16 launched nothing (install removes the cloud servers);
**next run: relaunch it once capital_manager has rebuilt cloud servers.** Expected 33 installed plus NeuroFlux levels
(not yet read back; the autosave predates the install). `metrics.py cycles`: pending, no sample from the new cycle yet.
Covenant: installs met; still needs hacking 850, combat 850.

**Hourly check, 2026-11-06 04:15 Pacific (PC clock 05:15): steady, no changes; install due next run.** Live (autosave
summary, `ps` 04:20, readiness, metrics 04:10): BN10, cash $356b to $487b, hacking 640, combat 131-145, karma -18.2k,
30 installed, 0 queued, all 17 residents running. World Daemon: not present (no Daedalus, Red Pill not installed). Player
on The Black Hand hacking work, rep 169.9k: Neuralstimulator (100k) is rep-ready; The Black Hand augmentation and Enhanced
Myelin Sheathing (both 200k) are 30.1k away, about 20 min; CSP Gen IV (250k) about 50 min. Measured, 13 samples 03:10 to
04:10 (share on, power 1.32 average): The Black Hand 92.4k rep/h, NiteSec 11.9k, Tian Di Hui 10.4k, CyberSec 10.2k, Slum
Snakes 7.65k, Tetrads 4.82k, BitRunners 1.04k, hacking exp 3.61b/h, karma -848/h, cash 256b/h, MCP average 468m/s, rate
582m/s. Trend: `cash/h 169b>256b n/a | MCP 652m>582m n/a | hackExp/h 4.73b>3.61b n/a | rep work The Black Hand
59.4k>92.4k n/a` (cycle 2.9h, so all n/a). Share confirmed: The Black Hand rep/h rose 56% hour on hour with share on,
in line with the A/B's x1.48; the hacking exp and MCP dips are likely share threads taking cloud RAM. Advisor: **wait**
19m for The Black Hand; decision: **wait, agree**. Next run (about 05:15) should find The Black Hand near 250k: install
then with Neuralstimulator, The Black Hand, Enhanced Myelin Sheathing and CSP Gen IV if rep-ready; after install,
relaunch `share_deploy.js cloud 8`. Covenant: 30/20 installs met; still needs hacking 850, combat 850.

**Hourly check, 2026-11-06 03:15 Pacific (PC clock 04:15): share restored, otherwise steady.** Live (autosave
summary, `ps` 03:15, readiness, metrics 03:10/03:20): BN10, cash $132b to $222b, hacking 622, combat 129-143, karma
-17.4k, 30 installed, 0 queued, all 17 residents running. **BitRunners joined** (rep 650, favor 10.2). World Daemon:
not present (no Daedalus, Red Pill not installed). Player on The Black Hand hacking work: Neuralstimulator 76.8k/100k,
23.2k gap, about 25 min at the measured rate. **Fixed:** share power read 1.00 since install 6 (install kills share
threads, and nothing relaunches them); ran `home; run share_deploy.js cloud 8` at 03:15, and the 03:20 sample reads
share power 1.53 (the A/B measured x1.48 rep with share on). Measured, 12 samples 02:15 to 03:10 (share off): The Black
Hand 59.9k rep/h, NiteSec 7.7k, Tian Di Hui 6.7k, CyberSec 6.2k, Slum Snakes 5.0k, Tetrads 3.1k, BitRunners 0.7k,
hacking exp 4.91b/h, karma -875/h, cash 154b/h, MCP average 389m/s, rate 638m/s. Trend: all n/a (cycle 1.9h). Advisor:
**build** (best next The Black Hand augmentation in 2.0h); decision: **build, agree**: Neuralstimulator is under an
hour away and The Black Hand / Enhanced Myelin Sheathing (200k) about 2h with share on, so an install around 05:15 to
06:15 Pacific looks right. Covenant: 30/20 installs met; still needs hacking 850, combat 850. Next run: confirm The
Black Hand rep/h rises with share; after every install, relaunch `share_deploy.js cloud 8`.

**Hourly check, 2026-11-06 02:15 Pacific (PC clock 03:15): install 6 confirmed, steady, no changes.** Live (autosave
summary, `ps` 02:16, readiness, metrics 02:10): BN10, cash $59b to $95b (cloud buying again at reserve 0), hacking 548,
combat 127-140, karma -16.5k, **30 installed** (install 6 confirmed), 0 queued, all 17 residents running. Favor after
install: NiteSec 153.8, Tian Di Hui 120.7, CyberSec 104.0, The Black Hand 97.2, Slum Snakes 80.4, Tetrads 55.9. World
Daemon: not present (Red Pill not installed). Player on The Black Hand hacking work (Neuralstimulator 100k, 83k gap).
Measured, 11 samples 01:20 to 02:10 (new cycle, 0.9h): The Black Hand 16.4k rep/h, NiteSec 5.9k, Tian Di Hui 5.1k,
CyberSec 4.7k, Slum Snakes 4.3k, Tetrads 2.7k, hacking exp 779m/h, karma -899/h, cash 110b/h, MCP average 138m/s, rate
285m/s. Trend: all n/a (cycle under 3h). `metrics.py cycles`: previous cycle 9.02h, +3 installed, rep NiteSec 290k,
The Black Hand 82.4k, Tian Di Hui 75.4k, CyberSec 60.5k, Tetrads 50.5k; favor banked NiteSec +40.7, CyberSec +18.8,
Tian Di Hui +16.4. Advisor: **build** (nothing to install; Bionic Arms 2.2h at its 55k rep/h); decision: **build,
agree**, though Tetrads measures 2.7k/h, so Bionic Arms is further off than 2.2h; Neuralstimulator is about 5h at the
measured rate. Share A/B not run: the cycle is in its rebuild (cloud RAM still growing), which would confound it.
Covenant: 30/20 installs met; still needs hacking 850, combat 850, $75b held.

**BN10 install 6 ran 2026-11-06 about 01:16 Pacific (PC clock 02:16), hourly task.** Before (autosave summary,
`augmentation_readiness.json`, metrics 01:15): BN10, cash $3.13t, hacking 610, combat 132-147, karma -15.6k, 27 installed,
0 queued; Tetrads 50.5k, so Power Recirculation Core was rep-ready. Player had moved to The Black Hand hacking work
(Neuralstimulator, 17.6k rep gap). Measured, 13 samples 00:15 to 01:15: The Black Hand 33.4k rep/h, NiteSec 9.0k, Tian Di
Hui 8.6k, Tetrads 8.3k, CyberSec 7.4k, hacking exp 9.24b/h, karma -842/h, cash 760b/h, MCP average 323m/s, rate 318m/s.
Trend: cash STEADY, MCP STEADY, hacking exp STEADY, work rep SWITCH (Tetrads to The Black Hand). Advisor: **wait** 1.1h for
Bionic Arms; decision: **install now, disagree**. The advisor prices Bionic Arms (Tetrads, 74k gap) at 68.8k rep/h, but
Tetrads measured 8.3k to 14.6k/h, so it is hours away; the install banks NiteSec 113 to about 154 (past 150, so later
installs can donate cash for rep and NeuroFlux at $760b/h income), Tetrads 0 to 56 and The Black Hand 62 to 97.
Neuralstimulator (about 30 min away) was the one thing given up. Backup
`saves/bitburnerSave_pre-install6_BN10_2026-11-06.json.gz` (gzip checked, player parsed, node 10, 27 augs, 0 queued,
SHA-256 e482cfb9a22a47004a9f6a2284f9e767a0a5d9df0ed9e278e3578cbda556639c). `aug_install.js --install`
(`aug_install_status.json`) bought DataJack, Power Recirculation Core and HemoRecirculator, no failures, plus 9 NeuroFlux;
home now 32TB, 4 cores. After (game `ps` 01:17): every resident back from PID 2 (mcp_supervisor, crawler, mcp, steward,
mcp_xp, money, stack_manager, HUD, run_report, controller, xp_filler, faction_join, metrics_logger, dnet_root,
sleeve_controller, capital_manager, cct_watcher). **Changed:** `capital_policy.json` `reserve` $2t back to 0 (pushed, read
back), so the rebuild buys cloud servers again. Expected 30 installed, plus NeuroFlux levels (not yet read back: status
files had not refreshed). `metrics.py cycles` for the new cycle: pending, no sample yet. No Red Pill, so no World Daemon.
**Next:** confirm installed count and favor; next targets Neuralstimulator (The Black Hand 100k) and Bionic Arms (Tetrads
125k); Covenant still needs hacking 850 and combat 850 (`covenantTarget` true).

**Hourly check, 2026-11-06 00:15 Pacific (PC clock 01:15): steady, install due next run.** Live (autosave summary,
`ps`, readiness, metrics 00:10): BN10, cash $2.52t, hacking 602, combat 129-143, karma -14.7k, 27 installed, 0 queued,
all residents running (`ps` 00:16). World Daemon: not present (no Daedalus, Red Pill not installed). Player on Tetrads
field work; Power Recirculation Core rep gap 7.7k (Tetrads 42.3k/50k). Measured, 12 samples 23:15 to 00:10: Tetrads
14.6k rep/h, NiteSec 8.9k, Tian Di Hui 8.6k, CyberSec 7.4k, hacking exp 7.57b/h, karma -885/h, cash 738b/h, MCP average
316m/s, rate 298m/s. Trend: cash STEADY, MCP STEADY, hacking exp STEADY, Tetrads rep SWITCH. Advisor: wait 31m for Power
Recirculation Core (+25.1%/h against the cycle's +1.0%/h); decision: **wait, agree**. Nothing changed. Next run (about
01:15 Pacific): Power Recirculation Core should be rep-ready; back up the save and install (plan then DataJack,
HemoRecirculator, Power Recirculation Core, about $3.6b plus NeuroFlux), banking NiteSec 153, Tetrads 50.

**Hourly check, 2026-11-05 23:15 Pacific (PC clock 00:15): install deferred about 1.5h for Power Recirculation Core.**
Live (autosave summary, `ps`, readiness, metrics 23:15): BN10, cash $1.76t, hacking 595, combat 123-137, karma -13.8k,
27 installed, 0 queued, all residents running (MCP, crawler, money, stacks, steward, capital_manager, HUD, run_report,
xp_filler, dnet_root, sleeve_controller, faction_join, player controller, metrics_logger, cct_watcher). World Daemon: not
present (no Daedalus, Red Pill not installed). Live `capital_policy.json` reserve $2t (read back). Player on Tetrads field
work. HemoRecirculator is now rep-ready: install plan DataJack + HemoRecirculator, $2.68b. Measured, 12 samples 22:20 to
23:15: Tetrads 14.2k rep/h, NiteSec 9.6k, Tian Di Hui 8.4k, CyberSec 7.2k, hacking exp 7.6b/h, karma -814/h, cash
1.24t/h, MCP average 309m/s, rate 362m/s. Trend: cash ACCELERATING (reserve now holding cash), MCP ACCELERATING,
hacking exp ACCELERATING, Tetrads rep SWITCH. Advisor: wait 1.5h for Power Recirculation Core (Tetrads, 22.2k rep gap,
+7.8%/h against the cycle's +1.1%/h); decision: **wait, agree**. Nothing is decelerating, Tetrads favor is 0 so the rep
rate does not fall before reset, and cash keeps building at the $2t reserve. Install when Power Recirculation Core is
rep-ready (about 00:45 to 01:15 Pacific), backup first; reserve stays $2t until then.

**Hourly check, 2026-11-05 22:15 Pacific (PC clock 23:15): NiteSec favor push done; cash held for an install.** Live
(autosave summary, `ps`, status files, metrics 22:10): BN10, cash $366b to $530b (sawtooth), hacking 585, combat 115-128,
karma -13.0k, 27 installed, 0 queued, all residents running, 1 sleeve on Homicide for karma. World Daemon: not present
(no Daedalus, Red Pill not installed). NiteSec favor 113.2 +38.0 pending = 151, past 150; the controller left NiteSec at
about 21:20 for Tetrads field work toward HemoRecirculator (about 6.5k rep gap at 22:15). Measured, 13 samples 21:10 to
22:10: Tetrads 12k rep/h (14k over the last 30 min), NiteSec 12.6k, hacking exp 6.0b/h, karma -829/h, cash -36b/h, MCP
average 299m/s, rate 217m/s. Trend: cash STEADY, MCP DECELERATING, hacking exp STEADY, Tetrads rep SWITCH, NiteSec STEADY.
MCP deceleration: not RAM (utilization 0.73, 4.8m of 6.6m GB used); likely target money falling as cohorts spread over
more servers, not traced. **Cash traced:** `capital_manager.js` has been upgrading cloud servers to 512TB at $271.5b each
every 12-15 min (workers 0-9 done, 10-14 left, about $1.36t), which is the -36b/h. **Changed:** `capital_policy.json`
`reserve` $0 to $2t (pushed, read back), so cash builds for the install instead (income about $1.3t/h by the manager's
estimate). Reason: cloud servers are lost at install and RAM is not limiting MCP; cash at install buys augmentations,
NeuroFlux via NiteSec donations, and home RAM/cores, which persist. Advisor: build; decision: **install next run** once
HemoRecirculator is rep-ready (backup first), agreeing with the advisor now. Tetrads field work at 14k/h makes Power
Recirculation Core and Bionic Arms many hours away, while the install banks NiteSec 151, Tetrads +21.8, The Black Hand
+18.9. If the next run does not install, set `reserve` back to 0.

**Hourly check, 2026-11-05 21:15 Pacific (PC clock 22:15): share A/B done, share stays on.** Live (autosave summary,
`ps`, metrics 21:10): BN10, cash $449b to $509b, hacking 574, combat 104-115, karma -12.1k, 27 installed, 0 queued,
all residents running. World Daemon: not present (no Daedalus, Red Pill not installed). Player on NiteSec hacking
work, favor 113 +36.6 pending, about 1.4 favor short of 150; next modelled target HemoRecirculator at Tetrads
(18.9k rep gap). Measured, 12 samples 20:15 to 21:10: NiteSec 82.6k rep/h, hacking exp 3.09b/h, karma -942/h, cash
-27b/h (money spent as fast as earned; not traced this run), MCP average 290m/s. Trend: cash STEADY, MCP STEADY,
hacking exp STEADY, NiteSec rep STEADY. Advisor: build; decision: no install, agree (nothing queued). **Share A/B
result:** hour B 83.1k rep/h at share 1.39 against hour A 56.2k at 1.00, x1.48; exp cost confounded by MCP, at most
about 4b/h. Share left on (`docs/experiments.md`).

**Rep target counts shared faction rep, 2026-11-05 about 19:30 Pacific (PC clock 20:30).** Ken: DataJack could have
come from The Black Hand while that rep also built toward its other augmentations, instead of from NiteSec alone.
`repTarget` (`player_activity_logic.js`) now scores a target by the sum of distinct valued augmentations its faction's
rep reaches by then, per rep gap. 521 tests pass in `build/bn10`; `profile.py check --content` clean; player controller
restarted (`restart_player.js`, read live 19:33): still the NiteSec favor push (favor 113 +30.2 pending), so the new
ranking first acts when that push ends. Not changed: named `priorityAugs` lists still take the smallest gap. The
restart fell inside share A/B hour A but did not change the player's work.

**Hourly check, 2026-11-05 20:15 Pacific (PC clock 21:15): share A/B hour B started.** Live (autosave summary,
`ps`, metrics 20:15): BN10, cash $422b, hacking 567, karma -11.2k, 27 installed, 0 queued, all residents running
(MCP, crawler, money, stacks, steward, capital_manager, HUD, run_report, xp_filler, dnet_root, sleeve_controller,
faction_join, player controller, metrics_logger). World Daemon: not present (no Daedalus, Red Pill not installed).
Player on NiteSec hacking work, favor 113 +27.1 pending toward 150. Measured, 13 samples 19:10 to 20:10 (share off):
NiteSec 56.9k rep/h, hacking exp 7.1b/h, karma -793/h, cash 240b/h, MCP average 275m/s. Trend: cash STEADY, MCP
ACCELERATING, hacking exp ACCELERATING, NiteSec rep n/a (share was off, so the -27% is the experiment, not a slowdown).
Advisor: build (HemoRecirculator at Tetrads, 20m modelled); decision: no install, agree (nothing queued). **Share A/B:**
hour A measured NiteSec 56.2k rep/h with share off against 77.5k the hour before with share 1.46 (x1.38); hour B
(`share_deploy.js cloud 8`) from 20:14, share power 1.53 at 20:15. Next run: fill in hour B with
`metrics.py rates --from 2026-11-05T20:20 --to 2026-11-05T21:15 --before 0` in `docs/experiments.md`; leave share on.

**Hourly check, 2026-11-05 19:15 Pacific (PC clock 20:15): share A/B hour A started.** Live (save summary and
`ps`, 19:14): BN10, cash $217b, hacking 540, karma -10.4k, 27 installed, 0 queued, all residents running. World
Daemon: not present (no Daedalus, Red Pill not installed). Player on NiteSec hacking work, favor 113 +19.3 pending
toward 150 (about 143k more rep, about 2h, modelled). Measured, 13 samples 18:10 to 19:10: NiteSec 76.2k rep/h,
hacking exp 3.35b/h, karma -780/h, cash 32b/h, MCP average 252m/s. Trend: n/a everywhere (cycle 2.9h). Advisor:
build (HemoRecirculator at Tetrads, 15m); decision: no install, agree (nothing queued). **Share A/B:** hour A
(`share_deploy.js stop`) from 19:15; the next hourly run should run `home; run share_deploy.js cloud 8` for hour B
and record both in `docs/experiments.md`. If the next run stands aside, share stays off: restore it then.

**Measurement regime live, 2026-11-05 about 18:00 Pacific (PC clock 19:00).** New resident `metrics_logger.js`
(`metrics_logic.js`, tests beside it) appends one JSON sample every 5 minutes, on the clock, to the game's
`metrics_log.txt` (money, sinceInstall income, skills, exp, karma, city, share power, work and controller reason, faction
rep, favor, installs, advisor verdict, MCP rate, RAM); stale status files (over 10 min) are listed in `stale`, not copied;
trimmed to the last 1500 lines (about 5 days, up to about 2MB in the save). Registered in `core/manifest.json`, `startup.js`
and `capital_manager.js` `MANAGERS` (the running manager keeps its old list until restarted; the logger was started by
hand with `game_terminal.py`). `bb_remote.py` pulls it to `runtime/` after its next restart (not restarted); until then
`tools/metrics.py pull` fetches it. `tools/metrics.py summary | cycles | rates | trend` give least-squares rates within one
install cycle, per-install rows (rebuild hours, rep earned, favor banked), experiment windows and, at Ken's request, a
one-line trend: three 60-minute windows for cash/h, MCP rate, hacking exp/h (levels/h for context), rep/h of the work and
best faction, flagged DECELERATING / STEADY / ACCELERATING / SWITCH / n/a. **Verified live:** 4 samples 17:45 to 18:00, no
stale sources; over them (measured, 4 samples): NiteSec 7.0k rep/h, Tian Di Hui 6.7k, CyberSec 5.8k while the player is in
the gym (rep grows for every faction without faction work), hacking exp 1.9b/h (48 levels/h), karma -860/h, MCP average
221m/s, share 1.46. Trend reads n/a until three full hours exist this cycle. `docs/experiments.md` holds today's four
changes (point-read baselines only) and a planned share A/B; the hourly task's prompt now pulls, quotes measured rates and
the trend line, explains decelerations and weighs them in install calls, adds `cycles` after installs, and runs the A/B once.
520 node tests in `build/bn10` and 43 Python tests pass.

**Faction value survey, 2026-11-05 about 17:50 Pacific (PC clock 18:50): Tetrads before company factions.** One-shot
`core/dev/faction_value_survey.js` (`faction_value_survey.json`, advisor weights): every company's best eligible job is IT
Intern at 9.1 company rep/s (Formulas), so a 400k invite is about 12h and resets each install; Clarke is 0.626 value for
875k faction rep. Tetrads is 0.325 for 195k (HemoRecirculator, Power Recirculation Core, Bionic Arms) and needs only
combat 75 each (about 17 gym minutes, modelled from the skill formula), karma -18 and Chongqing/New Tokyo/Ishima.
Changed: bn10 `physicalTarget` 0 to 75 (gym runs first after every install); `faction_join.js` generalised to
city-gated factions (Tian Di Hui, Tetrads: travels to Chongqing once ready). Controller decided gym at 17:52, held by
its switch cooldown when read. Company factions: revisit when hacking/charisma unlock better jobs. Also high value
but gated: The Syndicate (combat 200), Fulcrum (company + backdoor), Covenant.

**Macro review acted on, 2026-11-05 about 17:30 Pacific (PC clock 18:30): share on, NiteSec favor push.** Review
(one-shot `core/dev/macro_probe.js`, `macro_probe.json`): since BN10 start hacking earned $14.1t, servers cost $13.2t,
augmentations $0.63t; rep, not cash, limits every goal. (1) `share_deploy.js cloud 8`: share power 1.00 to **1.46**
(read live); the work page then showed 14.4 rep/s focused at The Black Hand. (2) New `favorTarget` (bn10 config:
NiteSec) in the player controller, after `priorityAugs`: works that faction until favor + pending gain reaches
`getFavorToDonate()` (150); readiness now writes `favor` and `favorToDonate`. NiteSec favor 113.2 (+1.9 pending), so
about 250k more NiteSec rep (modelled). At 150, `aug_install.js` donates cash for rep and NeuroFlux at each install.
Favor banks at each install, so installs need not wait for it. Controller decided NiteSec at 17:30. 513 tests pass.
Not done: company factions (no `companyTarget` in BN10), IPvGO off all BN10, sleeve karma-vs-rep test.

**Rep target by value per rep, 2026-11-05 about 16:55 Pacific (PC clock 17:55).** `augmentation_readiness.js` tags
each candidate with the advisor's weighted `value`; the player controller now ranks cash-ready candidates by value per
rep and skips zero-value ones (named `priorityAugs`/`charismaAugs` keep the old order). With nothing valued it falls
through to the next gate, then karma. Seen live after `restart_player.js`: the player moved from NiteSec (DataJack, value 0)
to The Black Hand hacking work for The Black Hand (value 0.165, 192.8k rep gap, about 7.1h at the sampled rate,
modelled). The Black Hand had been rejoined since install 5. 512 tests pass in `build/bn10`.

**Install advisor in shadow mode, 2026-11-05 about 16:35 Pacific (PC clock 17:35).** At Ken's request: install timing
as optimal foraging (wait while the next augmentation's multiplier gain per hour beats the cycle's average, else
install), in `augmentation_readiness.json` `advice`, on the HUD, and in the hourly report; nothing acts on it. Steward
restarted for its new copy list. **Install 5 confirmed live: 27 installed, 0 queued.** First live verdict: build, with
no valued augmentation in joined factions: NiteSec, Tian Di Hui and CyberSec have only DataJack and Neuroreceptor left
(no hacking, combat or rep mults), yet the controller works NiteSec toward DataJack (225k rep). Value now lies in
rejoining The Black Hand, Slum Snakes, BitRunners and others. Covenant needs a hacking mult x1.73 above today's to
reach 850 in a 24h cycle (hacking exp about 7.1e7/h, modelled). Combat is 6. **Next:** compare the advisor with the
hourly task's calls; candidate fix: rep target by value per hour instead of smallest gap. **Ken, 16:45 Pacific:** install
decisions stay with the hourly task's judgement; the advisor is an input, never a trigger.

**BN10 install 5 ran 2026-11-05 about 16:15 Pacific (PC clock 17:15), hourly task.** Before (autosave, game `ps`,
`augmentation_readiness.json`, `player_activity_status.json`): BN10, about $327b (autosave; $345b live at install),
hacking 479, karma -8042, 23 installed, 1 queued (The W1ngs of Icarus), same five factions, player on The Black Hand
hacking work. Install plan fully rep-ready: Cranial Signal Processors Gen III and CRTX42-AA (NiteSec), SmartSonar Implant
(Slum Snakes). Backup `saves/bitburnerSave_pre-install5_BN10_2026-11-05.json.gz` (gzip checked, player parsed, node 10,
23 augs, no Red Pill, SHA-256 c66eb2d65489eb5853491d2e73808044ccabe1f450091bce5387b176de6125dd). `aug_install.js
--install` (`aug_install_status.json`) bought all three, no failures, plus 6 NeuroFlux; **home 16TB -> 32TB**, 3 cores.
After (game `ps`): all 16 resident scripts and run_report back; the player controller chose crime for cash. Expected 27
installed (readiness file not yet refreshed, so not read back live). No Red Pill, so no World Daemon. **Next:** confirm
27 installed and the planner's next rep target; Covenant still gated on 850 hacking and combat (see 10:15 entry).

**Hourly check, 2026-11-05 about 15:15 Pacific (PC clock 16:15): install deferred one hour.** Live (autosave, game
`ps`, `augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json` over the API): BN10, about
$485b, hacking 472, karma -7293, 23 installed, 1 queued (The W1ngs of Icarus), same five factions. All 16 resident
scripts, run_report and 4 stack batches run; nothing died. SmartSonar Implant is now rep-ready (in the install plan), and
the controller moved the player to NiteSec hacking work: CRTX42-AA Gene Modification 70.0k of 90k at about 31k/h (1.05k
rep in 120s between two readiness samples, modelled), so about 40 minutes; Cranial Signal Processors Gen III (100k) about
an hour. **Decision:** not installing now; the 16:15 Pacific run installs with CRTX42 (and Gen III if ready), with a save
backup, since an install resets the rep that is about to buy them. Sleeve 0: shock 0, sync 99.0, Homicide. No Red Pill,
so no World Daemon.

**Hourly check, 2026-11-05 about 14:15 Pacific (PC clock 15:15): steady, no changes.** Live (autosave, game `ps`,
`augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json` over the API): BN10, about $372b,
hacking 464, karma -6540, 23 installed, 1 queued (The W1ngs of Icarus), same five factions. All 16 resident scripts,
run_report and 4 stack batches run; nothing died. Slum Snakes 42.3k of 45k for SmartSonar Implant (about 12k/h, so
about 15 minutes, modelled); next run buys it and installs both with a save backup. Sleeve 0: shock 0, sync 99.0,
Homicide. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-05 about 13:15 Pacific (PC clock 14:15): steady, no changes.** Live (game `ps`,
`augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json` over the API, autosave): BN10, about
$196b, hacking 454, karma -5747, 23 installed, 1 queued (The W1ngs of Icarus), same five factions. All 16 resident
scripts, run_report and 4 stack batches run; nothing died. Slum Snakes 29.9k of 45k for SmartSonar Implant (about 10.8k/h
from 19.1k at 12:15, so about 1.4h, modelled); install both then. Sleeve 0: shock 0, sync 99.0, Homicide. No Red Pill, so
no World Daemon.

**Hourly check, 2026-11-05 about 12:15 Pacific (PC clock 13:15): steady, darknet aug queued.** Live (autosave,
game `ps`, `augmentation_readiness.json`, `sleeve_status.json` over the API): BN10, about $207b, hacking 440, karma -5121,
23 installed, **1 queued: The W1ngs of Icarus** (labyrinth reward via `dnet_loot.js` since the last check; cash fell from
about $230b). Same five factions. All 16 resident scripts, run_report and 4 stack batches run; nothing died. Slum Snakes
19.1k of 45k for SmartSonar Implant (about 10k/h from 9.0k at 11:15, so about 2.5h, modelled). Not installing for one aug:
bundle it with SmartSonar. Sleeve 0: shock 0, sync 99.0, Homicide. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-05 about 11:15 Pacific (PC clock 12:15): steady, no changes.** Live (autosave, game `ps`,
`augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json` over the API): BN10, about $230b,
hacking 424, karma -4381, 23 installed, 0 queued, same five factions. All 16 resident scripts and 4 stack batches run;
nothing died. Player on Slum Snakes field work: 9.0k of 45k for SmartSonar Implant (about 8k/h from 0.7k at 10:15, so
roughly 4.5h, modelled). Sleeve 0: shock 0, sync 99.0, Homicide. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-05 about 10:15 Pacific (PC clock 11:15): Covenant gym goal gated on reachability.** Live
(autosave, `player_activity_status.json`, game `ps`): BN10, about $75.0b, hacking 398, karma -3724, 23 installed, 0 queued,
factions The Black Hand, NiteSec, Slum Snakes, Tian Di Hui and CyberSec. The Covenant goal had the player in the gym, but
the gate is out of reach: from the skill formula, strength 92 at 14.2k exp (effective mult 0.87) needs about 1e16 exp for
850, and the gym gives about 20 exp/s; hacking 850 likewise needs about 3.6e16 exp (1.6e9 now). Fix: `covenantTraining`
infers each stat's multiplier from level and exp and skips the goal when the gym would take over `covenantMaxTrainHours`
(48). 504 tests pass in `build/bn10`; synced, `restart_player.js` run, and the controller now decides Slum Snakes field
work for SmartSonar Implant (0.7k/45k rep), held by the 10-minute switch cooldown when read (switch not yet observed).
`covenantTarget` stays true. Sleeve 0: shock 0, sync 99.0, Homicide. No Red Pill; `w0r1d_d43m0n` unlinked, needs hacking
6000. **Implication:** The Covenant needs far higher stat multipliers (many more installs and NeuroFlux), so the run is in
a long aug-grinding phase; worth Ken's review whether BN10's Covenant goal is realistic.

**Hourly check, 2026-11-05 about 09:20 Pacific (PC clock 10:20): fixed the Covenant gym start.** Live (autosave, game
`ps`, `augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json` over the API): BN10, about $38.6b,
hacking 345, karma -3227, **23 installed** (install 4 confirmed), 0 queued, factions NiteSec, Tian Di Hui and CyberSec.
The controller had picked the Covenant goal (strength 27/850) but `gymWorkout` was refused every poll: the player was in
Chongqing and Powerhouse Gym is in Sector-12. Fix: gym decisions now carry `city` (`gymCity`, default Sector-12) and the
controller travels first (503 tests pass in `build/bn10`); pushed, controller restarted, live work read back as CLASS str at
Powerhouse Gym. All 16 resident scripts and 4 stack batches run. Sleeve 0: shock 0, sync 99.0, Homicide. No Red Pill, so no
World Daemon. **Watch:** the Covenant goal needs cash >= $37.5b each poll, with no hysteresis, so spending can flip the
player back to NiteSec work; add hysteresis if that is seen.

**BN10 install 4 ran 2026-11-05 about 08:15 Pacific (PC clock 09:15), hourly task.** Before (autosave, game `ps`,
`augmentation_readiness.json`, `sleeve_status.json`): BN10, about $241.7b, hacking 405, karma -2618, 19 installed, 0
queued, factions The Black Hand, NiteSec, Tetrads, Slum Snakes, Tian Di Hui and CyberSec. Neural Wit Amplifier rep-ready
and Combat Rib I within 27 rep. Backup `saves/bitburnerSave_pre-install4_BN10_2026-11-05.json.gz` (gzip checked, player
parsed, node 10, 19 augs, no Red Pill, SHA-256 c5fa0f867b4eeac4fca13242ebc5960941bc331b7b7e80071cfc99feeb4128c1).
`aug_install.js --install` (`aug_install_status.json`) bought Combat Rib I, Neural Wit Amplifier, LuminCloaking-V1 and
V2, no failures, plus 6 NeuroFlux; home stays 16TB, 3 cores. After (game `ps`): all 16 resident scripts back. Expected 23
installed (not yet read back live). **`covenantTarget` set true** in `profiles/bn10/config/player_activity_config.json`
(503 tests pass in `build/bn10`; pushed and read back from the game): once cash reaches $37.5b the player trains combat
to 850, then hacking to 850, for The Covenant (also $75b). Sleeve 0: shock 0, sync 99.0, Homicide. No Red Pill, so no
World Daemon. **Next:** confirm 23 installed and that the controller picks the Covenant goal; start `sleeve_buyer.js`
after joining The Covenant.

**Hourly check, 2026-11-05 about 07:20 Pacific (PC clock 08:20): steady, no changes.** Live (autosave, game `ps`,
`augmentation_readiness.json`, `sleeve_status.json` over the API): BN10, about $106b, hacking 388, karma -2062, 19
installed, 0 queued, same five factions. All 16 resident scripts and 4 stack batches run; nothing died. Slum Snakes 7.8k of
10k for Neural Wit Amplifier (LuminCloaking-V1 already rep-ready). **Plan unchanged:** install once Neural Wit is
rep-ready (the 08:15 Pacific check), reaching 20, then set `covenantTarget` true. Sleeve 0: shock 0, sync 99.0,
Homicide. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-05 about 06:15 Pacific (PC clock 07:15): steady, joined Slum Snakes.** Live (autosave, game
`ps`, `augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json` over the API): BN10, about $46b,
hacking 364, karma -1575, 19 installed, 0 queued, factions The Black Hand, NiteSec, Slum Snakes, Tian Di Hui and
CyberSec. Every resident script, crawler and run_report run; nothing died. The planner moved the player to Slum Snakes
field work for its cheap augs: LuminCloaking-V1 (3k rep, $25m) at 1.2k, then Neural Wit Amplifier (10k, $50m), at about
3.7k/h (modelled from 1.2k over ~19 min). **Plan:** install 4 (reaches 20) once Neural Wit is rep-ready, about 08:45
Pacific, then set `covenantTarget` true. Sleeve 0: shock 0, sync 99.0, Homicide. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-05 about 05:20 Pacific (PC clock 06:20): install 3 confirmed, steady.** Live (autosave, game
`ps`, `augmentation_readiness.json`, `aug_install_status.json`, `sleeve_status.json` over the API): BN10, about $13.1b,
hacking 313 (reset at 04:15 Pacific), karma -1088, **19 installed**, 0 queued, factions NiteSec, Tian Di Hui and CyberSec
(The Black Hand not yet rejoined after the reset). Every resident script, crawler and run_report run; nothing died. Rep
target CRTX42-AA Gene Modification (NiteSec 13.9k of 90k, $1.125b); player works NiteSec hacking. Sleeve 0: shock 0, sync
99.0, Homicide for karma. `covenantTarget` still false: set it after the next install (20+). No Red Pill, so no World Daemon.

**BN10 install 3 ran 2026-11-05 about 04:15 Pacific (PC clock 05:15), hourly task.** Before (autosave, game `ps`,
`augmentation_readiness.json`, `sleeve_status.json`): BN10, about $194.6b, hacking 385, karma -701, 17 installed, 0 queued,
factions The Black Hand, NiteSec, Tian Di Hui and CyberSec; Black Hand 33.0k, so Magnetism Amplifier (30k) was rep-ready
beside Nanofiber Weave, the planned trigger. Backup `saves/bitburnerSave_pre-install3_BN10_2026-11-05.json.gz` (gzip
checked, player parsed, node 10, 17 augs, SHA-256 e7c77a76c30807bda4ef31a975afdb527a57e100d82a9f912217c368f4b68015).
`aug_install.js --install` (`aug_install_status.json`) bought both planned (Magnetism Amplifier, Nanofiber Weave), no
failures, plus 10 NeuroFlux; home now 16TB (from 8.19TB), 3 cores. After (game `ps`, PIDs restarted from 2): every resident
script back (mcp, supervisor, crawler, steward, mcp_xp, money, stack_manager, HUD, run_report, controller, xp_filler,
faction_join, dnet_root, sleeve_controller, capital_manager, cct_watcher). Expected 19 installed (not yet read back live:
status files and autosave had not refreshed at check time). Sleeve 0 (the only sleeve): shock 0, sync 99.0, Homicide for
karma. No Red Pill, so no World Daemon. **Next:** confirm 19 installed; next rep target Neuroreceptor Management Implant
(Tian Di Hui 150k, rep now reset); one more install reaches 20, then set `covenantTarget` true (Covenant also needs
hacking 850 and combat 850).

**Hourly check, 2026-11-05 about 03:15 Pacific (PC clock 04:15): steady, no changes.** Live (autosave, game `ps`,
`augmentation_readiness.json`, `sleeve_status.json` over the API): BN10, about $177b, hacking 377, karma -428, 17
installed, 0 queued, factions The Black Hand, NiteSec, Tian Di Hui and CyberSec. Every resident script, crawler and
run_report run. Black Hand 20.0k of 30k for Magnetism Amplifier (about 15k/h, so roughly 40 min, modelled); Nanofiber
Weave still held for that batch. Sleeve 0: shock 0, sync 99.0, Homicide for karma. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-05 about 02:15 Pacific (PC clock 03:15): Nanofiber rep-ready, install held.** Live (autosave,
game `ps`, `augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json` over the API): BN10, about
$169b, hacking 368, karma -248, 17 installed, 0 queued, factions The Black Hand, NiteSec, Tian Di Hui and CyberSec. Every
resident script, crawler and run_report run. Tian Di Hui 76.6k, so Nanofiber Weave ($625m) is the whole install plan;
held for a bigger batch, as with CSP Gen II. Player now works The Black Hand for Magnetism Amplifier (5.1k of 30k, about
15k/h, so roughly 1.6 h, modelled). **Next:** when Magnetism is rep-ready, back up, then `aug_install.js --install`.
Sleeve 0: shock 0, sync 99.0, now on Homicide for karma (1.5% chance; still the best karma rate by the logic's model).
Next gate rothman-uni at hacking 392. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-05 about 01:15 Pacific (PC clock 02:15): steady, no changes.** Live (autosave, game `ps`,
`augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json` over the API): BN10, about $71.1b,
hacking 355, karma -217, 17 installed, 0 queued, factions The Black Hand (newly joined), NiteSec, Tian Di Hui and CyberSec.
Every resident script, crawler and run_report run. Tian Di Hui 62.9k of 75k for Nanofiber Weave (about 19k/h, so under
an hour, modelled). Next gate rothman-uni at hacking 392. Sleeve 0: shock 0, sync 96.3, synchronizing. No Red Pill, so no
World Daemon.

**Hourly check, 2026-11-05 about 00:15 Pacific (PC clock 01:15): steady, no changes.** Live (autosave, game `ps`,
`augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json` over the API): BN10, about $79.6b,
hacking 339, karma -209, 17 installed, 0 queued, factions NiteSec, Tian Di Hui and CyberSec. Every resident script,
crawler and run_report run. Tian Di Hui 43.6k of 75k for Nanofiber Weave (about 18k/h, so roughly 1.7 h, modelled). Next
gate I.I.I.I at hacking 344. Sleeve 0: shock 0, sync 92.5, synchronizing. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-04 about 23:15 Pacific (PC clock 00:15 11-05): steady, no changes.** Live (autosave, game `ps`,
`augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json` over the API): BN10, about $38.9b,
hacking 309, karma -199, 17 installed, 0 queued, factions NiteSec, Tian Di Hui and CyberSec. Every resident script,
crawler and run_report run. Tian Di Hui 25.3k of 75k for Nanofiber Weave (about 16k/h, so roughly 3 h, modelled). Next
gate computek at hacking 312. Sleeve 0: shock 0, sync 88.8, synchronizing. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-04 about 22:15 Pacific (PC clock 23:15): install 2 confirmed, steady, no changes.** Live
(autosave, game `ps`, `augmentation_readiness.json`, `player_activity_status.json`, `mcp_status.json`, and
`sleeve_status.json` and `capital_status.json` over the API): BN10, about $9.6b, hacking 247, karma -191, **17 installed**,
0 queued, factions NiteSec (rejoined), Tian Di Hui and CyberSec. Every resident script, crawler and run_report run.
MCP about $37m/s, total about $66m/s; capital_manager took cloud workers 0-8 to 2TB after the reset. Player works Tian Di
Hui for Nanofiber Weave (9.5k of 75k); NiteSec at 0.3k, so CRTX42-AA (90k) is further. Sleeve 0: shock 0, sync 85.0,
synchronizing. Next gate johnson-ortho at hacking 267. No Red Pill, so no World Daemon.

**BN10 install 2 ran 2026-11-04 about 21:17 Pacific (PC clock 22:17), hourly task.** Before (save export 21:16, readiness
file): BN10, $107.7b, hacking 278, karma -162, 14 installed, 0 queued, factions NiteSec, Tian Di Hui and CyberSec; NiteSec
42.2k rep, so Embedded Netburner Module (30k) and Neural-Retention (40k) were rep-ready beside CSP Gen II. Backup
`saves/bitburnerSave_pre-install2_BN10_2026-11-04.json.gz` (gzip checked, player parsed, node 10, 14 augs, SHA-256
e8c3f229bc80854782ae8654e78fb5b3f197a7568eb744da2be7c311bbd8f6f1). `aug_install.js --install` (`aug_install_status.json`)
bought all 3 planned (Neural-Retention, ENM, CSP Gen II), no failures, plus 10 NeuroFlux; home stays 8.19TB, 2 cores.
After (game `ps` 21:18): every resident script back (mcp, supervisor, crawler, steward, mcp_xp, money, stack_manager, HUD,
run_report, controller, xp_filler, faction_join, dnet_root, sleeve_controller, capital_manager, cct_watcher); controller on
crime for cash; `reserve` 0. Expected 17 installed (not yet read back live). NiteSec lost again; the crawler should
re-backdoor avmnite-02h at hacking 211. `covenantTarget` left false: Covenant also needs hacking 850 and combat 850, far off.
Sleeve 0: shock 0, sync 81.5. No Red Pill, so no World Daemon. **Next:** confirm 17 installed and NiteSec rejoin; CRTX42-AA
(NiteSec 90k) is the next rep target.

**Hourly check, 2026-11-04 about 19:15 Pacific (PC clock 20:15): steady, no changes.** Live (autosave, game `ps`,
`augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json`, `mcp_status.json` over the API): BN10,
about $102.6b, hacking 265, karma -147, 14 installed, 0 queued, factions NiteSec, Tian Di Hui and CyberSec. Home 8.19TB.
MCP about $83m/s. Every resident script, crawler and run_report run. NiteSec 15.7k of 30k for Embedded Netburner Module
(about 14k/h since the 18:16 switch, so roughly 1 h, modelled); CSP Gen II still rep-ready via CyberSec. Next: install
that batch once ENM is rep-ready. Sleeve 0: shock 0, sync 73.9, synchronizing. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-04 about 18:15 Pacific (PC clock 19:15): rep target now the smallest gap.** Live (autosave,
game `ps`, `augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json`, `capital_status.json` over
the API): BN10, about $97b, hacking 257, karma -139, 14 installed, 0 queued, factions NiteSec, Tian Di Hui and CyberSec.
Income about $64m/s; every resident script, crawler and run_report run; `reserve` 0. CyberSec reached 37.9k, so CSP Gen
II is rep-ready ($625m, the whole install plan); install held for a bigger batch. Change: the controller ranked
cash-ready rep targets cheapest first and had moved to Tian Di Hui for Nanofiber Weave (66k gap) over NiteSec's
Embedded Netburner Module (29k gap). `player_activity_logic.js` now takes the smallest gap when cash is ready (cheapest
otherwise); 503 tests pass; synced, controller restarted 18:16, its next decision chose NiteSec (`switched` true).
Sleeve 0: shock 0, sync 70.1, synchronizing. Next gate johnson-ortho at hacking 279. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-04 about 17:15 Pacific (PC clock 18:15): steady, no changes.** Live (autosave, game `ps`,
`augmentation_readiness.json`, `sleeve_status.json`, `capital_policy.json` and `capital_status.json` over the API): BN10,
about $32.9b, hacking 245, karma -132, 14 installed, 0 queued, factions NiteSec, Tian Di Hui and CyberSec. The cash drop
from $51b is capital_manager upgrading cloud workers 0-8 to 64TB at $25.5b each (income about $58m/s). Every resident
script, crawler and run_report run; `reserve` 0. CyberSec 34.1k of 37.5k for CSP Gen II (about 20 min, modelled). Next
gate: johnson-ortho at hacking 279. Sleeve 0: shock 0, sync 66.4, synchronizing. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-04 about 16:15 Pacific (PC clock 17:15): steady, NiteSec rejoined by itself.** Live (autosave,
game `ps`, `augmentation_readiness.json`, `sleeve_status.json` and `capital_policy.json` over the API): BN10, about $51b,
hacking 231, karma -125, 14 installed, 0 queued, factions NiteSec, Tian Di Hui and CyberSec. NiteSec is back without a
manual step, so the crawler backdoor retry works. Every resident script, crawler and run_report run; `reserve` 0. CyberSec
22.8k of 37.5k for CSP Gen II (about 10k/h, so roughly 1.5 h, modelled). Next gate: johnson-ortho at hacking 279. Sleeve 0:
shock 0, sync 62.7, synchronizing. No Red Pill, so no World Daemon. No changes made.

**Run report window, 2026-11-04 about 15:20 Pacific (PC clock 16:20).** New resident `run_report.js` shows
`run_report.json` in a "Run report" tail window; the hourly task now writes and pushes a short report at the end of
every run (prompt updated). First report (the 15:15 check) seen live in the game. capital_manager.js keeps it alive
after its next restart (source pushed, not restarted). The HUD process runs (PID 10) but its tail window was not
on screen at 15:20; left alone.

**Hourly check, 2026-11-04 about 15:15 Pacific (PC clock 16:15): steady, no changes.** Live (autosave, game `ps`,
status files, `capital_policy.json` and `sleeve_status.json` read over the API): BN10, $8.4-9.3b, hacking 205, karma -116,
14 installed, 0 queued, factions Tian Di Hui and CyberSec. Every resident script plus crawler runs; `reserve` 0. CyberSec rep
12.6k of 37.5k for CSP Gen II (about 9k/h, so roughly 3 h, modelled). The avmnite-02h gate now reads hacking 216
(`player_activity_status.json`), not 211. Sleeve 0: shock 0, sync 58.9, synchronizing. No Red Pill, so no World Daemon.
Note: `runtime/capital_policy.json` is a stale pull (shows the old $70b); read the live file with `ctl-get`.

**Hourly check, 2026-11-04 about 14:15 Pacific (PC clock 15:15): crawler now retries faction backdoors.** Live (autosave,
game `ps`, status files, `capital_policy.json` read over the API): BN10, $1.06b, hacking 165, karma -108, home 8.19TB (half
used), 14 installed, 0 queued, factions Tian Di Hui and CyberSec (NiteSec lost at the install). Every resident script
runs; `reserve` is 0. Player works CyberSec for CSP Gen II (3.5k of 37.5k). Sleeve 0: shock 0, sync 55, synchronizing.
No Red Pill, so no World Daemon. Change: `hacking/crawler.js` now runs `backdoor.js` on CSEC, avmnite-02h, I.I.I.I and
run4theh111z whenever one is rooted, within hacking level and not backdoored (worm.js only tried at its own nuke, which is
why avmnite-02h needed a manual backdoor). 502 tests pass; synced, crawler restarted (pid 6119). Not yet observed firing:
avmnite-02h needs hacking 211. **Next:** confirm NiteSec rejoins by itself at 211; rebuild cash toward install 2.

**BN10 install 1 ran 2026-11-04 about 13:25 Pacific (PC clock 14:25), hourly task.** NiteSec reached 20,207 rep at
13:24 (`augmentation_readiness.json`). Before (save over DevTools): BN10, $171.4b, hacking 233, karma -91.5, 0 installed.
Backup `saves/bitburnerSave_pre-install1_BN10_2026-11-04.json.gz` (gzip checked, player parsed, node 10, SHA-256
554930090510642f1be0f57767f380e01b827c217f0d24fee6b9264d4de7b0cf). `aug_install.js --install` (`aug_install_status.json`)
bought all 13 planned, no failures: Artificial Synaptic Potentiation, CSP Gen I, Speech Processor, Neurotrainer II, S.N.A,
Nuoptimal, ADR-V1, Augmented Targeting I, Speech Enhancement, BitWire, Synaptic Enhancement, Neurotrainer I, Wired
Reflexes, plus 2 NeuroFlux. After (status files 13:32): 14 installed, $1.6m, controller on crime for cash, `ps` shows every
resident script (mcp, capital_manager, steward, money, stack_manager, HUD, controller, xp_filler, faction_join, dnet_root,
sleeve_controller, cct_watcher). `capital_policy.json` `reserve` set back to 0 (read back). Sleeve 0 synchronizing (sync
52.5). Next readiness candidate: CSP Gen II at CyberSec (37.5k short). No Red Pill, so no World Daemon. **Next:** rebuild
cash and hacking; aim for the next install batch; Covenant needs 20 installed, $75b, hacking 850, combat 850.

**Hourly check, 2026-11-04 about 12:15 Pacific (PC clock 13:15): reserve raised for the install.** Live (autosave,
game `ps`, status files): BN10, cash $32.8-36.9b, hacking 227, karma -82.5, home 8.19TB (4TB used), 0 installed,
0 queued, 4 factions. Every resident script runs. NiteSec rep 11,749 (about 1.8 rep/s): Artificial Synaptic Potentiation
12.5k minutes away, Neurotrainer II and CSP Gen I 20k in about 75 min (modelled). Tian Di Hui's Speech Processor 176
short. Sleeve 0: shock 0, sync 47.7, synchronizing. `aug_install.js --dry` still plans the 9 ($8.9b); adding NiteSec's
three makes 12 at about $63b (1.9x per purchase, modelled). capital_manager had spent about $25b per 10 min on cloud
upgrades (mcp-worker-8 to 13 to 64TB, 11:17-12:12), which an install wipes, so I set `capital_policy.json` `reserve`
to $70b (was 0; confirmed read at 12:16). At about $43m/s cash covers the batch within the hour. **Next: install once
NiteSec reaches 20k (backup first), then set `reserve` back to 0.** No Red Pill, so no World Daemon.

**Hourly check, 2026-11-04 about 11:15 Pacific (PC clock 12:15).** Live (autosave, game `ps`, status files): BN10,
cash $45.9b, hacking 221, karma -77.5, home 8.19TB (half used), 0 installed, 0 queued, 4 factions. Every resident
script runs. Player works NiteSec hacking: 5,184 rep in an hour (about 1.4 rep/s); Artificial Synaptic Potentiation
12.5k (about 1.5 h, modelled), Neurotrainer II and CSP Gen I 20k (about 3 h). Tian Di Hui's Speech Processor 327 short.
MCP on omega-net, $42m/s now ($26.5m/s average). Install plan unchanged (9 augmentations, $8.9b), still held for NiteSec.
No Red Pill, so no World Daemon. Changed nothing in the game.

**Hourly check, 2026-11-04 about 10:15 Pacific (PC clock 11:15): NiteSec joined.** Live (autosave, game `ps`, status
files): BN10, cash $29.7-32.3b, hacking 214 (past avmnite-02h's 211), karma -71.5, 0 installed, 0 queued. Every resident
script runs. The worm's backdoor of avmnite-02h fires only once, at rooting, when hacking was still too low, so I ran
`hacking/backdoor.js avmnite-02h` by hand ("backdoor installed"); faction_join took the invite within a minute (4
factions). NiteSec rep 0: Artificial Synaptic Potentiation 12.5k, Neurotrainer II and CSP Gen I 20k. The controller
finishes Tian Di Hui's Speech Processor (747 rep short), then its cheapest-first rule picks Neurotrainer II at NiteSec;
config unchanged. Install plan still 9 augmentations, $8.9b, held for NiteSec (run_target step 2). At about 1.5 rep/s
that is a few hours (modelled). No Red Pill, so no World Daemon. Gate now crush-fitness 235.

**HUD run target, 2026-11-04 about 09:35 Pacific (PC clock 10:35).** At Ken's request the HUD now opens with a pinned
run-target block (Goal, Now with progress bars, Next, Work) from `run_target.json` (`profiles/bn10/config`). Seen live:
"NiteSec gate, hack 208/211, 98%". **Keep `run_target.json` current as the plan changes** (edit, `profile.py build bn10`,
`ctl-push run_target.json profiles/bn10/config/run_target.json`); see `docs/processes.md`. Augmented Targeting I has joined
the install plan (7 augmentations, $2.4b).

**Hourly check, 2026-11-04 about 09:15 Pacific (PC clock 10:15).** Live (autosave, game `ps`, status files): BN10,
cash $22.6-23.0b, hacking 204 (NiteSec gate avmnite-02h needs 211; it is rooted), karma -67.5, home 4TB (2TB used),
0 installed, 0 queued. faction_join added Sector-12; the player works Sector-12 hacking for Augmented Targeting I
(1,434 rep short); Tian Di Hui is 289 short of Nuoptimal (10,000). Install plan now 6 augmentations, $1.21b (ADR-V1,
Speech Enhancement, BitWire, Synaptic, Neurotrainer I, Wired Reflexes). Every resident script runs; MCP $19.5m/s
($20.9m/s average), 15 cloud servers. Still holding the install for NiteSec, now 7 hacking levels away. No Red Pill,
so no World Daemon. Changed nothing in the game.

**Hourly check, 2026-11-04 about 08:15-08:25 Pacific (PC clock 09:15).** Live (autosave, game `ps`, status files):
BN10, cash $15-21b, hacking 190, karma -58.5, home 4.10TB (1.95TB used), 0 installed, 0 queued, same 3 factions. Every
resident script runs (as at 07:20). MCP harvesting omega-net, $45m/s now ($16m/s average), 15 of 15 cloud servers.
CyberSec 7,801 rep, Tian Di Hui 4,097 (about 1.6 rep/s); the player is on Tian Di Hui for Speech Enhancement (5,000).
Rep-ready install plan: BitWire, Synaptic, Neurotrainer I, Wired Reflexes ($279m). **Held the install:** these are
small multipliers, and installing now resets hacking to 1 (NiteSec's avmnite-02h needs 211; the worm backdoors it once
rooted) and throws away CyberSec's progress toward CSP Gen I (20,000). Install once NiteSec augmentations join the
batch or rep stalls. No Red Pill, so no World Daemon. Changed nothing in the game.

**Hourly check, 2026-11-04 about 07:20 Pacific (PC clock 08:20).** Live (autosave, game `ps`, Remote API files):
BN10, cash $15.0b, hacking 169, karma -50.5, home 4.10TB (half used), 0 installed, 0 queued. Factions CyberSec, Tian Di
Hui, Sector-12. Every resident script runs (MCP, capital_manager, steward, faction_join, sleeve_controller, xp_filler,
HUD, player controller, dnet_root, 4 stack batches); gang-controller is not running (no gang yet). Only **one** sleeve
exists (the plan expected two): shock 3.0, sync 29, synchronizing for karma. Rep, not cash, is the limit: CyberSec 3,617
(Synaptic at 4,000, BitWire 7,500, CSP Gen I 20,000); rep-ready now: Neurotrainer I, Wired Reflexes. No install yet:
wait for the CyberSec batch. No Red Pill, so no World Daemon. Changed nothing.

**Augmentations under way, 2026-11-04 about 05:55 Pacific.** Home is 1TB (capital_bootstrap/capital_manager bought it
with coding-contract and cache money; cash $680m). capital_manager had restarted hud, player_activity_controller and
dnet_root, but not the startup.js-only scripts, so I ran faction_join, sleeve_controller, xp_filler, gang-controller
(no gang yet, karma -45). Factions: CyberSec, plus Tian Di Hui joined by faction_join (Sector-12 and Chongqing invites
left; city factions). Player works CyberSec hacking rep for Neurotrainer I (rep gap 1879, cash ready), then Synaptic
Enhancement, BitWire, CSP Gen I. Sleeve 0: shock 4.9, synchronizing. The game terminal had been left connected to CSEC;
`home` first.

**MCP back, 2026-11-04 about 04:35 Pacific (PC clock 05:35), Ken awake.** capital_manager bought home 32 to
64GB ($15.1m) at 04:33. The loops are gone: new `early_stop.js` (core/dev, pushed by hand, not in the manifest)
killed weakenGrowHack on 24 servers. `run startup.js` (after killing hud_consolidated and capital_manager for its
4.55GB): started mcp_supervisor, crawler, mcp.js, capital_bootstrap, maintenance_steward, mcp_xp, money.js,
stack_manager; failed for RAM: hud_consolidated, player_activity_controller, xp_filler, faction_join,
gang-controller, dnet_root, sleeve_controller. MCP is preparing targets across all 24 rooted servers. Home is
full again; capital_bootstrap keeps buying home RAM (next $47.8m) until capital_manager fits, so HTTPWorm waits
until then. Correction to the 04:15 test: the darknet does earn. With dnet_root off, the self-spreading `dnet_crawl.js`
on darknet hosts kept opening darkweb caches, four of them cash ($8.7m to $9.0m each, $35.3m by 04:42). BN10 money sources
then: coding contracts $220.8m, hacking $120.9m, darknet $35.3m. **Next: as home grows, rerun `run startup.js` (free 4.55GB first); do not rerun early_spread now that MCP runs.**

**BN10 early game, 2026-11-04 about 04:15 Pacific.** Darknet versus hacking test: in 30 min the darknet
earned $1,353 (but charisma 18 to 70); hack loops on rooted starter servers earned $1.37m in about 18 min
(game money sources). So: `mcp.js` is paused (it cannot fit beside the rest on 32GB anyway), `dnet_root.js`
runs on home for charisma and cracking, and `scripts/weakenGrowHack.js joesguns` loops fill every rooted
server (Ken's idea). BruteSSH bought; 12 servers rooted, 118 threads. `early_spread.js` (core/dev, pushed by
hand, not in the manifest) roots what the owned openers allow and fills free RAM; rerun after each port
opener. Update 04:25 Pacific: FTPCrack bought; 19 servers rooted, about 218 loop threads. The hourly run
briefly restarted mcp.js; capital_bootstrap handed over to `capital_manager.js` (17.25GB), which also
started `maintenance_steward.js`; home is full, so `dnet_root.js` is off until home grows. **When home fits `mcp.js` again: kill the weakenGrowHack loops first, then `run startup.js`.**

**Update 2026-11-04 04:20 Pacific (PC clock 05:20), hourly run.** Live (Steam, game terminal and autosave): BN10, hacking 94,
$6.3m at 04:18, home 32GB full (mcp_supervisor, crawler, capital_manager, maintenance_steward), 0 augs, no factions, karma -7,
player studying CS at Rothman. capital_manager bought relaySMTP by itself. I stopped the steward, ran
`early_spread.js joesguns`: 8 more rooted, 384 more loop threads (about 600 in all); the steward came straight back.
Next opener: HTTPWorm $30m (capital_manager buys it; then rerun early_spread the same way). Times in the 04:25 note
above were the PC clock, which runs an hour ahead of Pacific (PST since 2026-11-01).

**BN10 entered 2026-11-04 about 03:30 Pacific (PC clock 04:30).** Ken destroyed the World Daemon; at his word I
entered BN10.1 (default options). SF15 awarded. Cutover done: `restructure` merged to main (f58e530), daemon
restarted (map manifest, clean full sync of 142), `profile.py switch bn10 --live` (backup
`saves/pre-switch-bn10-20261104-033022.json.gz`, pushed 146, deleted 0), `check --content` OK, profile
manifest committed. `run startup.js`: home is 32GB, so only mcp_supervisor, crawler, mcp.js, mcp_xp started; 11
failed for RAM (incl. player_activity_controller 36.8GB, sleeve_controller 26.3GB, dnet_root 7.45GB). By hand:
killed mcp_xp, started capital_bootstrap.js (raises home RAM), player studying Computer Science (free) at
Rothman. Next: rerun `run startup.js` as home grows. Audit finding 6 was wrong: mcp.js plus mcp_xp left
capital_bootstrap 0.15GB short on 32GB. GitHub refused pushes 03:20-03:35 (outage); main pushed after.

## Repo layout (restructure branch; applies once it is merged at the BN10 cutover)

The repo is a tree (`core/`, `profiles/<name>/`, `tools/`, `docs/`); the game still has the flat
file names below. `sync_manifest.json` maps game path to repo path. **Status and event files pulled
from the game now land in `runtime/<game path>`** (e.g. `runtime/mcp_status.json`,
`runtime/augmentation_readiness.json`), not at the repo root: refresh STATE from there. Until the
merge, the root copies are the live ones. See `docs/architecture-profiles.md`.

**BN10 cutover checks, 2026-11-04 03:25 PC clock (Ken awake, reviewing).** Live: BN15, hacking 7,100
of 6,000, 66 installed, daemon connected. `restructure` merged with main (78f0ea1, committed locally;
push refused while GitHub reports an outage): 465/492 node tests, 27 Python, selftest all pass. Save backup
`saves/bitburnerSave_pre-worlddaemon_BN15_2026-11-04.json.gz` (SHA-256 a009e9a3…). Waiting on Ken's call
at the World Daemon.

## Current live state (supersedes everything below)

**2026-11-04 01:15 PST (02:15 PC clock): World Daemon ready, Ken notified (hourly task).** Live save over DevTools: node 15, hacking 6,656 of the required 6,000 (`w0r1d_d43m0n` `requiredHackingSkill` read from the save), $128t, karma -6,681, 66 installed, none queued, Remote API connected, player on Daedalus hacking work. The daemon shows **rooted** (`hasAdminRights` true) by the existing automation since 00:43 PST; not backdoored, not destroyed, no BitNode chosen. The push notification tool reported "not sent" because the app terminal was active; the message is in the `bitburner-bn15-progress` session instead. **Next: Ken opens a BitBurner session and says "review the BN10 startup steps" (`docs/bn10-cutover-runbook.md`). The hourly task makes no further changes.**

**Install 7 ran 00:39 PST 2026-11-04 (hourly task): the hacking augmentations are installed.** Before (00:15-00:39, save over DevTools, `ctl-status`, `augmentation_readiness.json`): node 15, $1.61q, hacking 3,795 of 6,000, karma -6,669, 52 installed, The L4w of Bayes queued, Remote API connected, MCP about $100b/s net. OmniTek InfoLoad became rep-ready at 00:38 (626.4k of 625k, about 126 rep/s as modelled). Backup `saves/bitburnerSave_pre-install7_BN15_2026-11-04.json.gz` (gzip checked, player parsed, L4w queued, SHA-256 5eae137658eccd4562f1a690eff0e3c09142cce6777f8412da6b74849ff4996b). `aug_install.js --install` (`aug_install_status.json`) bought 13: ENM Analyze Engine, PC Direct-Neural Interface, OmniTek InfoLoad, nextSENS, Neuronal Densification, Social Dynamics Processor, Synfibril Muscle, Bionic Legs, Bionic Spine, Combat Rib II and III, Augmented Targeting II and III; 6 NeuroFlux ($81.7b donated for NeuroFlux rep), no failures; home to 2,097,152GB, 7 cores.
**After it (save 00:41 PST, `ps`):** 66 installed, none queued, all startup scripts running, controller on crime for cash as in earlier rebuilds. **Hacking 4,629 two minutes after the install** (exp 4.1e8). By level = mult x 0.6 x (32 ln exp - 200), 6,000 needs about 2.3e10 exp (modelled), so probably within the next hour or two. World Daemon not rooted, not touched.
**Next:** the hourly task checks hacking against `getServerRequiredHackingLevel("w0r1d_d43m0n")` (6,000) and notifies Ken when reached. Nothing else to buy for the daemon.

**23:15-23:17 PST 2026-11-03 (hourly task; save over DevTools, `ctl-status`, `augmentation_readiness.json`, `player_activity_status.json`, `hacking_survey.json`):** node 15, $1.02q, hacking 3,737 of 6,000 (World Daemon required level read live by the controller's gate scan: 6,000; not ready, not rooted), exp 5.68e11, mult 9.35, karma -6,641, 52 installed, The L4w of Bayes queued (no hacking stats; not in the survey), Remote API connected. Clarke rep 423.7k to 438.8k in 120s (about 125 rep/s with share), so nextSENS and Neuronal are both rep-ready. At 23:16:14 the controller switched itself to OmniTek hacking work for OmniTek InfoLoad (needs +621.8k; status file, the save had not autosaved yet). At 125 rep/s that is about 83 minutes, so InfoLoad rep about 00:40 PST (modelled); PC Direct-Neural Interface (x1.08, 375k, OmniTek) comes on the way.
**Why wait for InfoLoad before installing:** level = mult x 0.6 x (32 ln exp - 200). With nextSENS and Neuronal only (mult about 12.9), 6,000 needs about 1.7e13 exp, roughly 68 hours at 7e7/s. With InfoLoad and PC DNI too (mult about 16.7, exp mult about 20.9), it needs about 7e10 exp, under an hour (modelled). Xanipher (NWO) is not needed. **Next:** when OmniTek reaches 625k: back up, then `aug_install.js --install`.
Clock note: the PC's clock is British Columbia time (UTC-7, `BCDT`), an hour ahead of US Pacific (PST, UTC-8) since 2026-11-01. Entries below marked "Pacific" on 2026-11-03 after about 18:00 used the PC clock.

**23:14-23:24 Pacific 2026-11-03 (hourly task; save over DevTools, `ctl-status`, status files, game page):** node 15, $621t, hacking 3,682 of 6,000 (World Daemon not ready, not rooted), exp 4.05e11 rising about 6.9e7/s, karma -6,610, 52 installed, none queued, Remote API connected. Clarke faction joined: 128.7k rep at about 80 rep/s unshared (Neuronal Densification 187.5k, nextSENS 437.5k). Favor (save): Clarke 0, Daedalus 87, so neither takes donations; BitRunners 218, Bachman 179, NiteSec 153.
**Changed:** `share_deploy.js cloud 8`: 2.09m share threads on 8 cloud servers (save). `companyTarget` Clarke to OmniTek Incorporated (pushed, read back). The controller switched at 23:17 on its own, and the page shows focused Business Analyst work at 314.9 company rep/s, 35.3k so far, so the 400k invite is about 20 minutes away (modelled). After the invite, the controller goes back to priority faction work unaided (Neuronal, nextSENS, then OmniTek InfoLoad). Effect of share on faction rep not yet measured. The 23:20 save showed focus off; the page at 23:23 showed focused work.
**Next:** when nextSENS, Neuronal and InfoLoad are rep-ready: back up, then `aug_install.js --install`. Optionally set `companyTarget` to NWO for Xanipher first; that is about 1.5 hours more, modelled.

**22:15-22:20 Pacific 2026-11-03 (hourly task; save over DevTools, `hacking_survey.json`, `company_survey.json`): hacking 6,000 is out of reach at the current multiplier. One more install with hacking augmentations is needed.** Live: node 15, $177t, hacking 3,512, hacking mult 9.35, exp mult 15.17, exp 1.62e11 rising about 7e7/s, karma -6,591, 52 installed, none queued, Remote API connected. World Daemon still needs 6,000 (read from the save), not rooted. Level is mult x 0.6 (BN15 `HackingLevelMultiplier`, read) x (32 ln exp - 200), so each doubling of exp adds only about 124 levels: 6,000 at mult 9.35 needs about 1.7e17 exp, a million times today's. At exp 1e13 it needs mult about 13.2 (x1.41). Unowned hacking augmentations (survey): nextSENS x1.20 (438k) and Neuronal Densification x1.15 (188k) at Clarke Incorporated; OmniTek InfoLoad x1.20 (625k); Xanipher x1.20 (NWO, 875k); ENM Core V3 x1.10 (1.75m, Daedalus, joined); QLink x1.75 (Illuminati, $75t, needs combat 1,200, combat is 2-169). Clarke plus OmniTek gives mult about 15.5, and 6,000 then needs about 3e11 exp, about an hour of today's rate (modelled).
**Changed:** `player_activity_config.json` `companyTarget` Bachman (joined) to Clarke Incorporated, Business; `priorityAugs` now nextSENS, Neuronal Densification, OmniTek InfoLoad, Xanipher, ENM Core V3. Pushed and read back from the game. Business Intern at Clarke models 246 rep/s (Formulas, `company_survey.js`), so the company invite should take well under an hour; not yet seen. It had been on Daedalus hacking work for Synfibril Muscle (combat, no hacking value); seen switched to Clarke company work at 22:19 (save). **Next:** once Clarke's faction invites and nextSENS is rep-ready, switch `companyTarget` to OmniTek Incorporated; install when both are bought (backup first), then rebuild to 6,000. New one-shot `hacking_survey.js`.

**At the World Daemon, follow `docs/bn10-cutover-runbook.md`.** The hourly task notifies Ken when hacking reaches 6000. Ken then reviews the BN10 startup steps with a session and hands the cutover over. Live 21:50 Pacific: hacking 3,055 of 6,000.

**Branches waiting for the BN10 cutover (not on `main`, not in the game):** `restructure`, which contains `bn10-prep`, holds the BN10 packages and the core/profiles layout (`docs/architecture-profiles.md`). Verified 21:45 Pacific: the bn15 build matches the live file set byte for byte, except the manifest, two browser-sync scripts and the newly listed `formulas_logic.js`. 465 tests pass in `build/bn15` and 492 in `build/bn10` (bn10 now extends bn15 for the darknet; profile startup lists drive `startup.js`), plus 26 Python tests and 33 `bb_remote.py` selftest checks. Untested against the real game: the map-form sync, `profile.py switch` and `profile.py check`. Cutover steps are in `docs/bn10-plan.md` on that branch and run only after Ken chooses BN10.

**Install 6 ran 21:16 Pacific 2026-11-03: The Red Pill is installed (seen in the post-install save).** The Eternal lab had been solved between 18:58 and 21:15 by the existing automation; this run found The Red Pill queued. Before the install (21:15, save over DevTools): node 15, $609t, hacking 3,189, charisma 6,295, karma -6,538, 42 installed. Backup `saves/bitburnerSave_pre-install6_BN15_2026-11-03.json.gz` (gzip checked, player parsed, Red Pill queued, SHA-256 4c212f767a3a41cca8f437343e0791e2d767be8b91dcefb394a3ae1ab6b40d07). `aug_install.js --install` bought 9 Tetrads/Slum Snakes augmentations and 9 NeuroFlux ($63.5b donated for NeuroFlux rep), home to 1,048,576GB and 7 cores. After it: 52 installed, none queued, $67k, hacking 5, hacking mult 9.35, hacking exp mult 15.17, controller on crime for cash, `ps` shows all startup scripts.
**World Daemon:** `w0r1d_d43m0n` now exists in the save, needs hacking **6,000** and 5 ports; not rooted or backdoored. Nothing automated backdoors it (`worm.js` backdoors only the four faction gateways; XP scripts only weaken; MCP hacks only servers with money). **Next: rebuild to hacking 6,000, then stop and tell Ken. Do not backdoor it; choosing the next BitNode (planned BN10, `docs/bn10-plan.md`) is Ken's call.**
`player_activity_config.json`: `charismaTarget` 0 and `charismaAugs` empty, read back from the game 21:16, because no lab remains and charisma work would slow the hacking rebuild.

**Install 5 ran 18:56 Pacific 2026-11-03: The St4ff of Asclepius installed.** Uber lab (`ub3r_l4byr1nth`, depth 23) solved 18:38:38 by `dnet_lab.js` on `the_void` (depth 22, 152 moves), 1h45m after install 4; the route came from `tools/dnet_map.py` once links reached rows 19-20. Before the install: $189t, hacking 2,402, charisma 4,422, karma -3,956, Staff queued. Backup `saves/bitburnerSave_pre-install5_BN15_2026-11-03.json.gz` (gzip checked, player parsed, SHA-256 ddd3230d10bafa1731e4f4b28b3928b08a317c8c255d85c6c4238451799b2dde). `aug_install.js --install` bought The Black Hand, Neuregen, Magnetism Amplifier and 15 NeuroFlux ($7.9b donated for NeuroFlux rep), home to 524,288GB and 6 cores. After it: $1,262, controller on crime for cash, `ps` shows all startup scripts. `charismaTarget` 3000 (read back from the game).
**Next: Eternal lab, depth 29, charisma 3,000, reward The Red Pill.** Row 24 is the next empty row, so lifting is needed again (floor 21 from rows 17-23). Then the World Daemon: stop before destroying it and tell Ken.

**Live 17:16-17:17 Pacific 2026-11-03 (save over DevTools, `ctl-status`, status files), 80 minutes after install 4:** node 15, hacking 1,738, **charisma 3,085 (already past the Staff lab's 2,500)**, $3.19b, karma -960, 38 installed, none queued. Remote API connected, last full sync 15:06 clean. Now joined 7 factions including Chongqing (was left alone; Sector-12 now excluded). Player on Black Hand hacking work; controller wants Chongqing for Neuregen (34.4k rep short), held by its 10-minute cooldown. Install plan so far: Magnetism Amplifier only ($750m).
MCP rebuilding: run `mw1cf1hs-k7uy`, 1,574 batches, about $172m/s hacking over 1 minute, RAM use 5%, objective override on. `capital_manager.js` is spending income on cloud upgrades (16TB to 32TB), so net cash is about +$9m/s. Contracts idle.
Darknet: scout cracking `rho_construction` at depth 13 (`hacker&net`); lab status `waiting`, no lab linked yet; `dnet_lift.js` refused (`n07_a_5erver`, session). Staff needs depth 23, so the row 16 crossing is the blocker, not charisma.

**Darknet 17:18-18:07 Pacific (status files, logged every 3s):** row 16 is already crossed: riders on lifted hosts reached depth 18-20 (`crack%tech`, `granny-s$blade_industries`), and admin hosts sit at row 17. The lab (row 23) links only from row 22. What stopped chains at 17-19 was cracking: `KingOfTheHill` had no solver and `RateMyPix.Auth` ran out of its 180s at about 50 guesses (needs about 70 at difficulty 19-21).
**Fixed and deployed:** `KingOfTheHill` solver in `dnet_feedback.js` from the game source (Gaussian hills; simulated median 13 guesses, p90 16). **Seen working live 18:05-18:06:** `charlie` cracked `dark_5o1ution5` and the chain hopped to depth 20, then started on `lightdata;oasis` (depth 21, RateMyPix). `RateMyPix.Auth` now gets 290s (under the 5-minute scout stale mark); not yet seen succeeding. Old file copies kept travelling host to host, so the scout now pulls its files from home at start and the rider before each scout; new one-shot `dnet_refresh.js` pushed the kit to 15 live hosts (5,557 stored passwords are stale). `tools/dnet_map.py` now reads the map during focused work; the page shows only rows up to about 2 past the deepest admin host, so no route to the lab yet.

**Install 4 ran about 15:55 Pacific 2026-11-03 (`aug_install_status.json`):** donated $320b to BitRunners, which was enough for every planned item: bought ENM Core V2, BitRunners Neurolink, Neuroreceptor, DataJack, CRTX42-AA, Nanofiber, then 13 NeuroFlux; home 262144GB, cores 3 to 5. After it: 38 installed, none queued, $1,262, hacking 3, charisma 143, karma -923; startup scripts all running (`ps`), controller on crime for cash as in earlier rebuilds. `charismaTarget` now 2500 for the Staff lab (depth 23). The donation formula is now seen working. Next: rebuild, darknet to depth 23 (lifting needs difficulty-21 hosts from row 17), charisma 2,500, solve, install The Staff.
**15:52 Pacific 2026-11-03: Ken approved installs up to readiness to complete BN15 (standing exception in AGENTS.md; still stop before `w0r1d_daemon` or any BitNode choice).** Merciless lab solved: The H4mmer of Daedalus queued. Live: charisma 3,403 (mult 7.27), hacking 1,498, $28.5t, faction rep mult 2.70, 31 installed. Backup `saves/bitburnerSave_pre-install4_BN15_2026-11-03.json.gz` (gzip checked, SHA-256 71df6993172cb8587c3d68fb0fa843b7e96256cde6d4db33c3cd1fc3b42a5af0).
**Rep boosters:** BitRunners favor 161 is past the 150 donation threshold, so `aug_install.js` now donates (up to 25% of cash) to lift each donating faction to its dearest unowned offer, and buys NeuroFlux rep the same way; dry run: $321b to BitRunners, then ENM Core V2, Neurolink, Neuroreceptor, DataJack, CRTX42-AA, Nanofiber. The donation formula (amount / 1e6 x faction rep mult) is from memory of the game source; the real run reads rep back, so a short donation only drops an item. No joined faction sells a rep-mult augmentation (`rep_survey.js`); The Shadow's Simulacrum (x1.15, 37.5k) needs Speakers for the Dead, The Dark Army or The Syndicate. Favor after this install, modelled from `getFactionFavorGain`: NiteSec 131, Tian Di Hui 112, Bachman 145, so none new reaches 150. Invites pending: Sector-12, Chongqing (left alone; they exclude each other).
**Fixed:** the controller worked BitRunners rep for DataJack, which NiteSec already sold; a target rep-ready at any faction is now skipped. **HUD:** the Augmentation section shows queued names, what the install would buy and its cost (`augmentation_readiness.json` `installPlan`), and the controller's rep target; seen live. `maintenance_steward.js` now copies `aug_install_logic.js` and `player_activity_config.json` with the readiness script, since it imports the planner; a steward-written status with `installPlan` was seen.

**14:58 Pacific 2026-11-03: the game crashed (APPCRASH c0000005 in bitburner.exe, Windows event log 14:58:26) the moment a DevTools `Input.dispatchKeyEvent` Enter (keyDown with `"text": "\r"`, keyUp with `"text": null`) was sent to run `run restart_player.js` in the terminal. Cause confirmed 15:10-15:16: the dump (CrBrowserMain, decoded with Electron 41.4.0 breakpad symbols) crashed while deserializing `params.text` in `Input.dispatchKeyEvent`; Edge rejects the same message with -32602. New `tools/game_terminal.py` (Runtime.evaluate only) tested on the disposable web game (ls, help, typed-text refusal, None guard), then live: `run restart_player.js` (controller now PID 2818) and `ps`, game stayed up and refocused.** Install 3 had already run at about 14:42 (31 installed, 14 bought, no NeuroFlux, home 262144GB / 3 cores); Neuroreceptor Management Implant was squeezed out of its plan by price compounding. New `priorityAugs` in `player_activity_config.json` (Neuroreceptor) now leads faction work and is reserved for in `aug_install.js`'s plan; tests pass (455) and the code is on the game.
**Relaunched through Steam 15:06 Pacific; Remote API reconnected on its own.** Save summary over DevTools: 31 installed, $549m, hacking 962, charisma 1,845 (past the 1,500 Merciless gate), karma -878. The relaunch restarted saved scripts from current source, so no `restart_player.js` was needed: `player_activity_status.json` 15:07:54 picks Tian Di Hui, "needs +55541 rep for Neuroreceptor Management Implant (priority)".

**Live 14:34 Pacific 2026-11-03 (save over DevTools, status files): pre-install checklist done, install not run.** node 15, hacking 842, charisma 1,204, $21.9t, karma -858, 16 installed, Boots queued, Bachman faction rep 383.8k (past 375k; the player had moved on to BitRunners for Neurolink, 579k of 875k). `capital_policy.json` reserve now 0 and `charismaTarget` 1500, both read back from the game. Backup `saves/bitburnerSave_pre-install3_BN15_2026-11-03.json.gz` (gzip checked, player data parsed; SHA-256 4091d6e855d9a60efed0aa573c0811ac25fc5543dfd9477c8121eb08aec9850d), so `save_export.py --out` is now seen working. Next: Ken runs `run aug_install.js --install` (optionally `--dry` first).

**Live 15:21 Pacific (game page, status files):** node 15, hacking 783, charisma 1,042, $3.24t, net $345m/s over 1 minute, karma -471, 16 installed, Boots queued. Bachman rep 49.1k at 13.0 rep/s on the page, so 375k about 22:20 Pacific if the rate holds. Stacks and MCP earning; Remote API connected. `player_activity_status.json` lags the page, so read the page for the rep rate.
**Decision: install at 375k, do not wait for 472k.** This replaces "worth deciding then" below. 375k already gives about 139 Bachman favor by the fit below, so about 97k more in a later cycle reaches 150 donations without the 2.2-hour delay now. More charisma augmentations are not needed: Boots, ESI, SmartJaw and ADR-V2 (62.5k rep, same faction) take the level multiplier to about 7, so 1,500 needs about 216k exp, 2,500 about 12m and 3,000 about 90m, all modelled with the fit in the charisma route below, and Hammer and Staff cut those further. Cash will not limit the buy: about $180b modelled for the 8 augmentations rep will allow, at x1.9 each.
Row 16: `dnet_lift.js` now takes only neighbours able to clear the next wall (difficulty 13 from rows 9-15, 21 from rows 17-23), so charges are not spent on hosts that cannot cross. Tests pass (453) and it is on the game; it has not run, because lifting stops once the lab is solved. The game source (v3.0.1) shows stasis links are 1 plus Wings, Hammer and Staff, so 2 now. Merciless and later labs drop only the manual UI; scripts walk them the same way. Offset labs change only the start and end, which the search does not assume.
`tools/save_export.py` reads and validates the save over DevTools; `--out NAME` writes `saves/NAME.json.gz`. The summary and the DevTools read are seen working; `--out` has not been run, so check its output at the first backup.

**Live 14:19 Pacific (game page, save over DevTools, status files):** node 15, hacking 777, charisma 1,024 (exp 52.7m), $2.02t, net $294m/s over 1 minute, karma -456, 16 installed, Boots queued. Bachman invited and `faction_join.js` accepted; the controller moved the player to Bachman hacking work unaided, so the 11:27 fix is now seen working. Stacks 4/4, no new resets.
**Rep:** was 6.5/s and unfocused at 14:14. Now 12.9/s, read twice (14:18, 14:19), with work focused and share on: 2.5k of the 375k, so about 22:20 Pacific if the rate holds; modelled, and it rises slowly with hacking. New `share_deploy.js cloud 8` took 8 cloud servers from `xp_filler.js` (threads 11.97m to 7.42m, so about 38% less hacking exp), leaving the servers held for MCP and stacks. Why 8: above about 2m threads share power barely moves. Rate matches share power about 1.58; `getSharePower` itself not read.
Other faction rep with no work is the game's passive gain, 1% to 10% of the work rate by favor (game source), not a darknet effect. Corporation bribes are not worth it at $1b a rep. Faction hacking work beats field and security here (game formula).
**At 375k, in this order:** `capital_policy.json` reserve 0; raise `charismaTarget` to 1500 in `player_activity_config.json`; back up and validate the save; `run aug_install.js --install`. Charisma 1,500 then needs about 400k exp with Boots, ESI and SmartJaw (modelled). Merciless needs a second crossing, which has never run: lifting past row 16 needs a host of difficulty 13 or more.
Worth deciding then: 472k Bachman rep gets donations next cycle (about 2 more hours, modelled), against a rep cap of 375k now. If `charisma_survey.js` still shows more charisma behind Bachman, the extra hours pay back at each later install.
This was the hourly task's first run on the PC.

**Game is live on the PC, 13:18 Pacific. The Mac copy is stale: do not start it there.** Export imported and hash matched. Connected with a clean full sync: 138 pushed, 29 pulled, none failed or missing. Seen 12:48-13:18: node 15, hacking 755, charisma 988, cash $898b, 16 installed, The B00ts of Perseus queued, install not done, focused Bachman work at 317.5k rep and 18.9 rep/s, reserve $100b. All four stacks batching at full money; the-hub loaded at 15% money and rebuilt by 12:57. Net $288m/s over 1 minute.
Not checked on the PC: running beside Cities: II, `dnet_promote.js` thread count, `dnet_root.js`. `dnet_status.json` and `dnet_roi_current.json` hold old data; `dnet_scout_status.json` is live. This PC pushes over SSH (key `Kens-PC BitBurner`, added 2026-11-02).
**Live 13:32 Pacific (status files):** $1.17t, net $343m/s over 10 minutes, the-hub $155m/s. Scout active at depth 7 (`dnet_scout_status.json`). Player on Bachman until its faction invites.
`tools/daemon_supervisor.py` restarts a dead daemon and reconnects the game; seen working 13:31 after the daemon was stopped on purpose (daemon back in 2s, connected 30s later, full sync clean). It runs hidden from the Windows logon task `BitBurner daemon supervisor` (Ken approved 2026-11-02; `tools/install_supervisor_task.ps1`), which does not start the game after a reboot. The app's hourly `bitburner-bn15-progress` task exists on the PC, saved in Auto mode, and runs only while the Claude app is open. Its first run is not yet seen.
`money_status.json` and the stack and capital status files are not pulled to disk; read them with `ctl-get`. A script restarted between 12:42 and 12:46 could have run a copy with garbled non-ASCII text from the first failed sync; a clean resync replaced the files, and none was seen misbehaving.

**Mac closed down for the PC move, 12:16 MST. The game is not running anywhere until the PC starts it.** Export taken 12:15:33: node 15, cash $191b (home upgrades took the $2.58t), hacking 749, charisma 982, karma -429, 16 installed, The B00ts of Perseus queued, install still held. File: `saves/bitburnerSave_pc-move_BN15_2026-11-02.json.gz` on the Mac (gitignored, gzip checked, player data parsed), SHA-256 28180fbecce89dcae95848a282e75615cba16052835aed9d261f68925a8426f6, handed to Ken through session Outputs. Mac game quit; `com.bitburner.remote-api-monitor` booted out, daemon stopped; hourly task disabled and to be recreated on the PC. PC prep was still in progress at shutdown. Continue at "On the PC" in `docs/pc-move-2026-11-02.md`, step 6. Import this file, not Steam Cloud. If you are on the Mac, this copy is stale: stop.
**Live 11:32 (status files):** $2.58t, net about $291m/s over 1 minute, the-hub $162m/s, omega-net $59m/s, silver-helix $44m/s, phantasy $21m/s. Reserve $100b. Remote API connected.

**Live 11:24-11:28 (game page, save over DevTools, status files):** node 15, hacking 725, charisma 957 (exp 24.4m), $2.43t, net about $300m/s, Bachman rep 227.6k at 18.35 rep/s as Operations Manager, karma -416. 400k lands about 14:05 MST at that rate. MCP, capital and darknet reporting; 47 `dnet_promote.js` threads. Boots still queued, install held. Hacking exp 43.4e9, so the 1PB cloud kept the rate from 10:33; income is unchanged by it (about $300m/s).
**Fixed a stall that was waiting at the invite:** charisma augmentations only took faction work while charisma was under `charismaTarget` (600), and it is 957. The player would have gone to the cheapest augmentation (Neural Wit at BitRunners) and worked up by price, leaving Enhanced Social Interaction and SmartJaw nearly last. `charismaAugs` now win regardless (deployed, controller restarted 11:27 with new `restart_player.js`, focus restored). The transition itself is unverified until the invite.
`capital_policy.json` (game file): `reserve` $500b to $100b and `homeRamTarget` 262144. Augmentations that matter cost under $100b and $1t/hour arrives, so the old reserve only delayed home RAM, which survives installs. Home steps fire at about $3.26t (about 12:10) and about $6.4t. Modelled, not observed. **Set `reserve` to 0 before the install**, or it stalls the rebuild.
Seen, unexplained: rep rose with no faction work, Tian Di Hui 14.9k at 05:00 to 41.8k, NiteSec 26.2k. Nanofiber Weave is already buyable. Neural Wit needs 4.1k more rep and Magnetism 9.3k: about 45 minutes in all, worth weighing just before the install, after 375k.

**Live 10:24-10:33 (save over DevTools, status files):** node 15, hacking 638, charisma about 915 (exp 15.2m, about 2,700 exp/s), $1.47t, Bachman rep 164.8k at 15.1 rep/s at 10:24, karma -401. MCP, capital and darknet reporting. Cruel lab solved, Boots queued, install held.
**Idle cash turned into hacking XP.** Faction rep rate follows hacking level, and cash was piling up against a need under $100b. `capital_manager.js` refused cloud RAM because MCP used under half of it, so the policy now has `cloudDemandFloor` 0 (`capital_policy.json`, game file). All 25 cloud servers went to 1PB, the game's cap: 401TB to 26.2PB for about $1.38t, 10:27-10:29. `xp_filler.js` threads 85,883 to 11.9m. Hacking exp 1.63e9 at 10:27:56 to 4.88e9 at 10:32:39, about 11m exp/s (about 100x the 2h rate before), hacking 594 to 638 in 5 minutes.
Modelled, not observed: hacking about 790 at the 14:40 invite. Faction rep about 11/s with share against 8.3/s, so the 375k lands about 23:40 tonight rather than 03:30. These servers die on install; only the cash is spent. Home upgrade ($3.16t) still buys itself at $3.66t, about 2 hours at recent income. Effect on income not yet measured; MCP average unchanged after 5 minutes.
**At the invite:** check `faction_join.js` accepted, the player moved to faction hacking work, and start share with `share_deploy.js network 256 128 1000000`; share RAM has to come from the filler. All unverified. `restart_capital.js` restarts the manager and restores focus.

**Live 09:25-09:47 (game page, save read over DevTools, status files):** node 15, hacking 583, charisma 854, $1.8t, net about $316m/s, Bachman rep 125.8k at 14.25 rep/s, on track for the 400k invite about 14:40 MST. Karma -386.
**Charisma exp is now 1,256/s, was about 190/s** (two saves 180s apart, 09:36-09:39; exp 7.54m to 7.77m). Save showed only 5 `dnet_promote.js` threads and they gave nearly all charisma exp, about 35 exp/s a thread. The solved Cruel lab is rooted with 128GB free, so `dnet_lab.js` now fills it: 31 threads, seen in the save. It dies with the next install because Cruel leaves the network; other hosts held 1,186GB free at 09:27, mostly unrooted.
Why it matters: exp resets on install, so this only adds company rep now (rate moved 13.9 to 14.25 with charisma and hacking, roughly in step with charisma). The lasting lesson is for after each install: exp rate adds 32 ln(k) to the level term, so many threads cut the rebuild. Bundle below ESI and SmartJaw noted: Nanofiber, Magnetism, Neural Wit, DermaForce add about x1.17; TITN-41 (25k, Silhouette), Golden Tongue and SoA Beauty need factions not reached.
After a solve, chains now start at `darkweb` to spread promoters; riders exit so their scouts stop keeping the status fresh. Live 09:46: spread worked, save shows 52 threads on 7 hosts (5 new since 09:43) and 1,572 exp/s over 120s, with the 31 on the lab. Promoters on ordinary hosts may die in mutations; lasting count not yet seen. Not tried after an install.

**Live 08:24-08:29 (game page, status files, one-shot probe):** node 15, hacking 568, charisma 836, $2.07t before spending, net about $281m/s over 10 minutes, Bachman rep 62.6k as Business Manager at 14.1 rep/s focused. MCP, capital and darknet all reporting; karma -370. Cruel lab reads solved, Boots queued, still held. Invite estimate: 200k rep (Operations Manager, 15.8/s) in about 2.7h, 400k about 3.5h later, so about 14:45 MST.
Faction rep after that is about 5.6/s at hacking 568, about 8.3/s with share, from rates seen earlier and not measured on Bachman: 375k is about 12.5 hours, so the charisma install lands about 03:30 on 2026-11-03. Rep, not cash, limits this: about $1t/hour arrives against rep that needs under $100b of augmentations for the two that matter.
Donations do not help yet: `getFavorToDonate` is 150. Favor: NiteSec 36, Tian Di Hui 18, Black Hand 13. 150 is about 472k total rep (fit: 25,500 x (1.02^favor - 1)). Earning 472k rather than 375k at Bachman would unlock donations there from the next cycle, about 1.5 more hours; decide then. Bachman company favor would gain 63 from rep so far; not enough to justify installing, because rep and charisma both reset.
Spent idle cash: `capital_policy.json` now has `homeRamTarget` 131072 and `reserve` $500b (game file, gitignored). Home went 8.19TB to 65.5TB for $1.42t at 08:27, which survives installs. Next step costs about $3.16t and will buy itself once cash passes about $3.66t. Effect on income not yet measured.
Running a one-shot while focused: click "Do something else simultaneously", then the Terminal sidebar item; end the script with `ns.singularity.setFocus(true)` to restore the rep rate.

**Live 07:29 (game page, status files):** node 15, hacking 547, charisma 826, $1.07t, net $244m/s over 10 minutes, Bachman rep 17.8k as Business Analyst. Bachman work is now focused (`focusWork`): 12.0 rep/s seen on the page, against 80% of that unfocused. The controller refocuses hourly, so the Steam game shows the work page, not the terminal, and `#terminal-input` is missing. Click "Do something else simultaneously" to get the terminal for up to an hour. Invite at this rate, rising with promotions: about 15:00 MST, not observed.
Checked and ruled out, 07:25: the `b-and-a` backdoor needs hacking 1,061. No early install: Boots, Nanofiber and 13 NeuroFlux give about x1.27, which needs about 1e8 charisma exp for 1,500. Rehearsing the row 16 crossing is not possible yet: migrations cap at the lab row minus 1, and the active lab stays Cruel until The Boots is installed. Infiltration pays well (Storm Technologies 8.7k rep a run, difficulty 3.48, above about 3.5 is barred) but the game fails any untrusted key event, so scripting it would mean defeating its automation check; not done. By hand it stays open to Ken for the 375k faction rep, and it gives no company rep.

**Live 07:15 (game):** `ops_hud.js` rewritten and deployed: automation health, player decision, next lab goal, attention list; its version string lives in `mcp_launch.js` too. `omega-net` and `silver-helix` show 2 stack resets each, cause unknown: the runner kept no reason. No more in a 2-minute sample at 07:16, money and security at ideal. New runs record `lastReset`; running stacks do not until restarted. ZB Leadership would add about 35 charisma exp/s (`formulas.work`, assumes per-tick gains) on 197/s passive, read 07:09: not worth leaving Bachman.

**Cruel lab solved, 2026-11-02 06:52 MST. `The B00ts of Perseus` is queued, read directly with `getOwnedAugmentations(true)`. Not installed.**
**Live 06:58 (game, status files):** node 15, hacking 529, charisma 821 (exp 5.1m at 06:51, mult 2.523), $602b, capital income about $167m/s, Remote API connected. Links: `quantum%matrix:1932` (depth 11) and `apex_sanctuary` (7).
Why chains stalled at 7: game source never places a host in rows 8, 16 or 24, and links join only adjacent rows. New `dnet_lift.js` moves a neighbour with `induceServerMigration`, and scripts on it survive. First live lift, 06:43-06:48: `quantum%matrix:1932` went from 7 to 11, `quantum-security` (difficulty 5) fell to 3. The rider's scout linked the host and started the walker; about 3.5 minutes from 06:49 to solved. `dnet_root.js` had two copies running; it now has one (pid 36295).
**Decision: hold the install.** Merciless (depth 19, charisma 1,500) needs about x1.84 level multiplier at today's exp; 1,500 on the current multiplier needs about 2.7e9 exp. Enhanced Social Interaction x1.6 plus The Boots and NeuroFlux covers it. Rep resets on install, so earning it now saves one rebuild. Installing now would carry only The Boots, Nanofiber Weave, Synaptic Enhancement and NeuroFlux. Corporate factions have `keepOnInstall` in the source: they should stay joined after an install, not yet seen live.
Player now works at Bachman & Associates (Business), which also sells SmartJaw x1.5. Live 06:57-06:58: 758 to 1,534 rep, 8.1 rep/s as intern, unfocused. Promotions apply automatically. The faction invites at 400k company rep (about 10 hours at modelled job rates, 300k with a backdoor on its server, not tried), then both augmentations need 375k faction rep (over 10 hours at faction rates seen so far). `faction_join.js` should accept it, and `charismaAugs` already lists both. Unverified: invite, join, faction work, promotions.
**Next:** if a much shorter route to x1.84 appears, take it. When Enhanced Social Interaction is affordable in rep: back up the save, `run aug_install.js --install`. Merciless needs a second crossing, at row 16; lift range is difficulty + 4 and the lab links from row 18.

**Live 05:00-06:07 MST (game, status files):** node 15, hacking 472, **charisma 735, past the Cruel gate of 600**, $134.8b at 05:00, capital income about $88m/s, Tian Di Hui rep 14.9k at 4.8/s. All managers running. Do not install until The Boots is queued: the gate needs charisma at solve time, and it resets.
Blocker was reach. Game source: only hosts at depth 11 link to the lab, and the Dark Net page shows only 3 past the deepest admin host, so "nothing at 12" on the page proves nothing. The one link sat on `travel_agency:8314`, depth 0, with 4GB free, too small for a scout, so chains restarted from a full `darkweb`.
Fixed and deployed 06:00: scouts use every link from `getStasisLinkLimit()`, chains and the walker start at the deepest, and charisma workers are killed when they alone block a link or hop. Seen live by 06:07: second link on `zenith-net` (depth 1) beside the first, chains reaching depth 5 and retrying from there. Not yet seen: a link deeper than 1, depth 11, or the Cruel lab.

**Second install done, 2026-11-02 03:26 MST.** Before it (03:25): hacking 399, charisma 426 (exp 526k), $68b, Tian Di Hui rep about 11k, karma -260. Installed Speech Processor, S.N.A, Nuoptimal, ADR-V1, Speech Enhancement, Neurotrainer I, Wired Reflexes and 6 NeuroFlux levels. Charisma mult 1.748 to 2.523, exp mult 1.544 to 2.177. Backup: `saves/bitburnerSave_pre-install2_BN15_2026-11-02.save`, validated (gitignored).
Why now: 600 needed about 8.9m exp at the old mult (exp was rising about 170/s) and needs about 442k at the new one. About $67b was left unspent: `--install` bought no home upgrade, so the cheaper of RAM and cores evidently costs over that (home 8.19TB, cores 2). Costs not read.
**Live 03:27:50 MST (game, status files):** node 15, hacking 1, charisma 178 (exp 3,339, about 36 exp/s from 03:26:41 to 03:27:50 with no training), $1.8k, MCP preparing n00dles and foodnstuff. Status 03:27:34: scout at depth 3, chain running. At 03:28:29 `money.js` showed $562k and crime income $19k/s, matching the Deal Drugs estimate of $20k/s; charisma 216 (03:28:28).
Fixed this run: while short of cash the player chose crime by karma rate, which picked Homicide at 1.5%; it now picks by money rate. `capital_policy.json` reserve is 0 on game and disk, because $600m would have stopped the rebuild. Raise it only when saving for an install.
**Next:** Cruel lab: depth 12, charisma 600, reward The Boots. The Dark Net page at 03:25 listed 46 hosts to depth 9, none at 12, and no lab on it. The labs need charisma at solve time, so solve before the next install. Merciless (1,500) needs about x1.85 more level multiplier: Enhanced Social Interaction x1.6 or SmartJaw x1.5 at 375k corporate rep.

**First install done, 2026-11-02 about 01:22 MST.** Hacking 376, charisma 329, $259b, NiteSec rep about 17k before it. Installed The Broken Wings
(`The W1ngs of Icarus`), 7 NiteSec augmentations and 8 NeuroFlux levels. 9 installed in all, so at least four more cycles. Leftover cash bought home RAM to
8.19TB, cores 2, which survived. Backup: `saves/bitburnerSave_pre-install1_BN15_2026-11-02.save`, validated (gitignored).

Rebuild found the player idle for about 30 minutes at hacking 1: `charismaTarget` 600 asked for Leadership with $1.6k, and `bestKarmaCrime` never returned a crime
because the game reports karma as positive. Fixed: under `minTrainingCash` ($10m default) the player does crime, chosen correctly (live: Deal Drugs). MCP now schedules on home
less 512GB, and `xp_filler.js` takes up to half of home. Live at 01:57 (game, status files): home 54% used, hacking 7, charisma 123 and rising without training, $2.6k, targets n00dles and foodnstuff.
Cash growth from home RAM not yet observed. Next lab is Cruel: depth 12, charisma 600. Faction rep and cloud servers are gone; `faction_join.js` skips city factions.
The Remote API dropped at about 00:20 (1006) and was reconnected from Options at 00:51; the game kept running.

**Live 02:03 MST (game, status files):** node 15, hacking 233, charisma 171 (mult 1.748, exp 7,852, +13.4 exp/s with no training), CyberSec joined, cash $640k, income about $12.5k/s and rising.
**Charisma route, replaces the risk note below** (`charisma_survey.js`, read 02:00; level = 1.1 x mult x (32 ln(exp+534.6) - 200)): 600 needs about 8e6 exp at today's mult, about 7 days at the current rate. Speech Processor (x1.2, 7.5k rep) plus
Speech Enhancement (x1.1, 2.5k rep), both at Tian Di Hui, lower that to about 830k exp once installed. Corporate augmentations reach far past 3,000: every level multiplier together is about x16, for example Enhanced Social Interaction x1.6 and SmartJaw x1.5 at 375k rep. Exp resets on install, so
plan an early install 2 as soon as the Tian Di Hui augmentations are bought, not waiting for the Cruel lab. Leadership would otherwise have blocked all rep work until charisma 600; `charismaAugs` in the player config now goes first, and `faction_join.js` travels to Chongqing for the invite at hacking 50, $1.5m (deployed 02:01).
Neither has fired yet: cash is under $1.5m because `capital_manager.js` keeps spending it. If cash stays low next run, reserve it with `reserve` in `capital_policy.json`.

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

**Superseded by the 02:03 route above.** Fit to live values: level = (32 ln(exp+535) - 200) × 1.1 × mult, mult 1.5376 now (the 1.1 is inferred).
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
