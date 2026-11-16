**2026-11-14 ~17:15 PC clock: BN6 run 1 entered by Ken (Bladeburners). Profile bn6 active, fresh-node bootstrap running.** BN10 run 3 complete (SF10.3). Plan: `docs/bn6-plan.md`. The BN10 sections below are history until this file is rewritten for BN6.

**2026-11-14 11:23 PC clock: BN10 World Daemon ready, Ken notified** (hacking 6024 of 6000 at 11:23:15; daemon present, not rooted; desktop notification sent, no phone push because Remote Control was off). Waiting for Ken to choose the next BitNode. Do not root, backdoor, hack or destroy it.

Last refreshed: 2026-11-14 11:25 PC clock, on the PC. Trimmed from 1,918 lines on 2026-11-10. Every
earlier note is unchanged in `docs/archive/state-2026-11-10/STATE-full.md`. Run 2's detailed check
entries are in `docs/check-log.md`.

> **Which session is this? (standing note, keep at the top.)** The BitBurner run is meant to be worked from a Claude
> **Code** session on the PC, in the Claude desktop app's Code tab, with the folder `C:\Users\kenne\BitBurner`. Such a
> session has a shell, git, `tools/game_terminal.py` and the scheduled task's tools. If you are a plain **chat** session
> (claude.ai or the desktop Chat tab, no shell or repo folder), do not try to run, debug or change the game or the
> scheduled task from here. Tell Ken plainly: "This is a chat session. For BitBurner work, open the Claude desktop app,
> go to the Code tab, and start a session in C:\Users\kenne\BitBurner." Then help only with questions that need no
> game access. The 2-hourly check is the scheduled task "BitBurner BN6 progress" (id bitburner-bn15-progress; prompt updated for BN6 2026-11-14); its runs appear in the Code tab
> sidebar, and "Run now" there starts one. (On 2026-11-06 a chat-side attempt to sort out the task led to an
> unrecorded install.)

## How to keep this file

This file is the handoff, not a log. Keep it to about a page. Each run of the 2-hourly task
replaces **Latest check** below, adds one row to the install table when it installs, and writes its
full entry at the top of `docs/check-log.md`. Ken sessions do the same: change a standing setting
here when it changes, and put the detail in the check log. When a note here stops being true, remove
it. Its record is in the check log or the archive.

## Objective and authority

**BN10 run 3**, entered 2026-11-11 about 10:20 by Ken (run 2's daemon went unattended at about 09:47; check log).
**Ken is hands-off for the whole run** (2026-11-11): every action in the game is ours, so an unexplained install or
purchase is a script fault to find, not Ken. Route (`run_target.json`): gang (Slum Snakes, combat; changed from NiteSec 2026-11-11 21:45) → gang-faction augs → The Covenant
(hacking and combat 850, $75b) → Daedalus, one install once its rep banks favor 150 → The Red Pill → World Daemon.
Installs are approved up to readiness to complete BN10, each with a save backup first. Stop at the World Daemon or
any other reset, take a backup and notify Ken (`AGENTS.md`). Install timing is the agent's judgement. The install
advisor is one input to it.

Owned source files: SF 1.2, 2.1, 4.3, 5.3, 10.2, 15.1 (10.2 assumed from the 7th sleeve; confirm). Seven sleeves.

## Standing settings (live, nothing to undo at installs)

- **Monitors may always be killed for RAM** (Ken, 2026-11-11): HUD (`hud_consolidated.js`, `ops_hud.js`),
  `run_report.js`, `mcp_xp.js`, `get_target_stats.js`. While MCP waits for room (`capacity-wait`), `capital_manager`
  holds its smallest batch's RAM so they are not relaunched, and buys the cheapest cloud server that fits one batch
  if no worker can (any phase; commit below). Added after install 1 left MCP idle at 17:17 with 1.5GB per host.
- **Port openers wait for a server within reach** (2026-11-11, 40dbc09). `capital_manager` buys BruteSSH..SQLInject
  only when a not-yet-rooted server with required hacking <= hacking x1.25+10 needs that many ports
  (`capital_status.json` `portsNeeded`); DarkscapeNavigator and Formulas are unaffected. An install deletes programs,
  and the crawler roots only at the level anyway. Owned at 18:25: all but SQLInject.
- **Gym baseline 30** (2026-11-11, `player_activity_config.json` `physicalTarget` 75 -> 30). 75 was a run-1 Tetrads
  route; after install 1 the gym cost $8.3m against MCP's $7.3m. 30 covers the Slum Snakes invite. The Covenant's
  850 training is separate (`covenantTarget`).
- **Gang objective is `auto`** (2026-11-10, commit 667d2ab). The gang earns NiteSec rep until it
  covers every aug NiteSec sells (`gangRepNeeded` in `augmentation_readiness.json`, 3.5m now), then
  switches to Money Laundering by itself. An install resets faction rep, so the gang goes back to
  reputation on its own. (Run 3 gang: Slum Snakes, created 2026-11-11 about 22:00.)
- **Cloud buying by cycle phase** (2026-11-10, commit 085ffe8). Game-only `capital_policy.json`:
  `{"reserve":0,"homeRamTarget":262144,"homeRamFloor":256,"homeDemandFloor":0.5,"cloudDemandFloor":0,"lateCloudDemandFloor":0.5,"earlyCycleHours":1.5}`.
  For 1.5h after an install, cloud RAM is bought freely to speed up the hacking rebuild. After that,
  cloud RAM is bought only while MCP's own jobs fill half of it, which in practice means none. Home
  RAM is bought only while the scripts that need home fill half of it (`homeDemandFloor`;
  `capital_status.json` `homeDemand`; commit below). Added 2026-11-10 after a $4.74t home upgrade at
  14:53 bought RAM that sat 0.23% used. `capital_status.json` `cyclePhase` shows the phase. Why: in cycle 7, cloud
  RAM tripled while hacking income stayed flat, because MCP uses 0.2% of it.
- **Late in each cycle the aug batch comes first** (2026-11-10). From 1.5h after an install
  (`lateCycleLimit` in `capital_logic.js`): nothing an install wipes is bought (cloud RAM, sleeve
  augs), and anything lasting (home RAM, sleeve memory, sleeves) is held to 1% of cash per purchase
  (`lateSpendFraction`). Home RAM also needs demand. The gang already qualifies: money mode buys only
  gear that pays back in 30 minutes; reputation mode buys rep the batch needs. Status files:
  `capital_status.json` `homeDemand`, `sleeve_buyer_status.json` `cyclePhase` and `limits`.
- **Gang planner** (merged 2026-11-09, 47b5559; `docs/gang-planner.md`). The advisor keeps a 4h
  minimum cycle for the gang faction (cap 12h). Ascension runs in either mode, at x1.5 and at most one
  per loop. Reputation mode uses the 0.80/0.90 wanted-penalty band.
- **Sleeves do karma crime while shocked** (2026-11-15 01:16, game-only `sleeve_config.json` `{"karmaWhileShocked": true}`).
  BN6 started sleeves at high shock; recovery to 5 would have held karma near -8/h for about 10 more hours. Delete the file to revert.
- Share stays on (A/B recorded 2026-11-05).
- **Home RAM floor 512GB** (2026-11-11 22:08, was 256; `capital_policy.json` `homeRamFloor`; game-only). Bought 512GB for $477m so the HUD (killed for the install advisor's 35GB) could run again. Plus code: while mcp.js is
  down and does not fit, home RAM ignores the late-cycle cap (`mcpBlocked` in `capital_logic.js`).
- **Allocator project** (`docs/allocator-design.md`; Ken approved 2026-11-10): central valuation,
  each script still buys, one `own`/`shadow`/`valued`/`sweep`/`never` setting per purchase kind in
  `valuation_flags.json`. Step R0, the spending ledger, merged 2026-11-10 (bd6aa68):
  `metrics.py spend` reports spending per cycle and B1 (late spend outside the batch, % of late
  earnings: 88%, 70%, 50% over cycles 6-8). Step R1, the shadow allocator, merged 2026-11-10 16:40
  (245363b) and running: `allocator.js` (5.45GB) writes `spend_grants.json` and one line per purchase
  to `allocator_shadow_log.txt`; it buys nothing and every kind is `own`. It is judged over cycle 9
  (install 8 at 16:15) on S1-S5 in the design doc before R2 lets any kind obey it.

## Installs this run (BN6 run 1)

| # | When (PC clock) | Bought | Installed after |
|---|---|---|---|
| 1 | 2026-11-15 07:16 | 7 (Power Recirculation Core, HemoRecirculator, LuminCloaking-V1 from Tetrads; Nuoptimal Nootropic Injector Implant, ADR-V1 Pheromone Gene, Speech Enhancement from Tian Di Hui; BitWire from CyberSec; ~$2.1b) + NeuroFlux x1 + The W1ngs of Icarus (darknet reward) | 0 -> 9 |
| 2 | 2026-11-15 19:17 | 5 (Bionic Arms from Tetrads; CSP Gen I, Synaptic Enhancement, Neurotrainer I from CyberSec; Wired Reflexes from Tian Di Hui; `priorityOnly` to skip Glibness Enhancement, $2.5b, value 0) + NeuroFlux x6; home 512GB -> 1TB | 9 -> 14 |

## Installs BN10 run 3 (history)

| # | When (PC clock) | Bought | Installed after |
|---|---|---|---|
| 1 | 2026-11-11 17:17 | 7 (Tian Di Hui 5, CyberSec 2; $5.3b), no NeuroFlux | 0 -> 7 |
| 2 | 2026-11-12 05:16 | 4 (Nanofiber Weave, Wired Reflexes from Tian Di Hui; CSP Gen I, Neurotrainer I from CyberSec; $1.0b) + NeuroFlux x5 | 7 -> 11 + NF5 |
| 3 | 2026-11-12 15:16 | 3 (Neuroreceptor Management Implant from Tian Di Hui; Neurotrainer III, Augmented Targeting I from Slum Snakes; $3.48b) + NeuroFlux x1 | 12 -> 15 + NF |
| 4 | 2026-11-12 21:15 | 2 (Bionic Arms, Cranial Signal Processors Gen II, both Slum Snakes; ~$2.56b) + NeuroFlux x1 | 15 -> 17 + NF |
| 5 | 2026-11-13 01:17 | 6 (Bionic Legs, Power Recirculation Core, Bionic Spine, Neurotrainer II, HemoRecirculator, HNCA Neural-Upload; all Slum Snakes, ~$10.8b; chosen by value through `priorityAugs`) | 17 -> 23 |
| 6 | 2026-11-13 05:17 | 5 (Graphene Bionic Spine Upgrade, CSP Gen III, Embedded Netburner Module, Combat Rib I, Neural Wit Amplifier; all Slum Snakes, ~$40.6b; chosen by value through `priorityAugs`) | 23 -> 28 |
| 7 | 2026-11-13 09:16 | 11 (Graphene Bionic Legs Upgrade, BitRunners Neurolink, Graphene Bone Lacings, NEMEAN Subdermal Weave, Synthetic Heart, Synfibril Muscle, Neuregen, SmartSonar, Combat Rib II, Augmented Targeting II, LuminCloaking-V1; all Slum Snakes, ~$866b; value 2.22 through `priorityAugs`) | 28 -> 39 |
| 8 | 2026-11-13 13:15 | 12 (ENM DMA Upgrade, ECorp HVMind, Artificial Bio-neural Network, HyperSight, ENM Core, Enhanced Myelin, Combat Rib III, Augmented Targeting III, INFRARET, LuminCloaking-V2 from Slum Snakes; CRTX42-AA from NiteSec; BrachiBlades from The Syndicate; value 1.52 through `priorityAugs`) + NeuroFlux x3; home to 2TB, 2 cores | 39 -> 51 + NF3 |
| 9 | 2026-11-13 17:16 | 13 (Unstable Circadian Modulator, ENM Core V2, PC Direct-Neural Interface, Neuralstimulator, SmartJaw, CSP Gen IV, FocusWire, ADR-V2, DataJack, The Shadow's Simulacrum, Artificial Synaptic Potentiation, CashRoot (filler) from Slum Snakes; Neural-Retention from NiteSec; value 1.00 through `priorityAugs`) + NeuroFlux x3; home to 8TB, 3 cores | 51 -> 64 + NF3 |
| 10 | 2026-11-13 21:17 | 4 (ENM Core V3 Upgrade, PC DNI Optimization Submodule, CSP Gen V from Slum Snakes; The Black Hand from The Black Hand; value ~1.08 through `priorityAugs` with new `priorityOnly`) + queued The W1ngs of Icarus + NeuroFlux x12; home to 64TB, 4 cores | 64 -> 69 + NF12 |
| 11 | 2026-11-14 01:17 | 2 (Graphene BrachiBlades Upgrade from Speakers; Neural Accelerator from BitRunners; `priorityOnly`) + queued The B00ts of Perseus + NeuroFlux x18 ($17b donated); home to 1PB, 7 cores | 69 -> 72 + NF18 |
| 12 | 2026-11-14 05:17 | 2 (SPTN-97 Gene Modification from The Covenant, Graphene Bionic Arms Upgrade from The Dark Army, both by donation; `priorityOnly`) + NeuroFlux x16; home to 2PB, 7 cores. Banks ~161 favor at Illuminati (joined that cycle) | 72 -> 74 + NF16 |
| 13 | 2026-11-14 07:16 | 1 (QLink from Illuminati by donation, $237.5t + $707b donation; `priorityOnly`) + queued The H4mmer of Daedalus + NeuroFlux x12. Banks Daedalus favor 0 -> ~178.6 | 74 -> 76 + NF12 |
| 14 | 2026-11-14 11:18 | The Red Pill (Daedalus donation $703b; `priorityOnly`) + NeuroFlux x12 ($8.6t donated). World Daemon appeared; hacking reached 6000 at ~11:23 | 76 -> 77 + NF12 |

Run 2's 13 installs are in `docs/check-log.md`. Backups are `saves/bitburnerSave_pre-install<N>_BN10run3_<date>.json.gz`.

## Latest check

**2026-11-15 21:14 (scheduled run): steady, no changes made.** All residents running; nothing died since install 2 (19:17).
Live (probe 21:15): BitNode 6, $190m, hacking 144, combat 274/210/270/240, karma -166k, home 1TB, 14 installed, 0 queued. Gang Slum Snakes respect 34k, territory 14%.
Measured (13 samples, 20:10-21:10): rep/h Tian Di Hui 9.73k, Tetrads 1.57k, CyberSec 358, Slum Snakes 200; hackExp/h 573k; karma/h -22k; cash/h 84.3m; MCP avg 69k/s.
Trend: n/a (cycle 3 only 1.9h old); nothing DECELERATING.
Advisor wait (gang 4h minimum; Nanofiber Weave ~2.2h away); decision wait, agreed.
End check: no daemon; Bladeburner rank 0, idle, next black op Operation Typhoon (2500); not ready.

## Next

1. **BN6 day one (17:20):** home 32GB, 7 sleeves, SF 1.2 2.1 4.3 5.3 10.3 15.1. Running: mcp_supervisor, crawler, capital_bootstrap,
   early_spread loops on joesguns; sleeves 0-6 Shoplift; player Shoplift (`crime_now.js`, dev). mcp.js was killed for RAM;
   capital_bootstrap/manager restart the residents as home RAM grows. BN6 multipliers (non-1): HackingLevel 0.35, HackExpGain 0.25,
   ServerMaxMoney 0.2, ScriptHackMoney 0.75, ServerStartingMoney 0.5, CrimeMoney 0.75, CompanyWorkMoney 0.5, GangSoftcap 0.7,
   GangUniqueAugs 0.2, DaedalusAugsRequirement 35, WorldDaemonDifficulty 2. No Bladeburner multiplier below 1, so hacking is the weak
   leg here and Bladeburner plus gang carry the run.
2. Joined Bladeburner 2026-11-14 23:15 (rank 0). Next: measure action times, odds, stamina, `mem`; design the controller (`docs/bn6-plan.md`).
3. Rewrite this file for BN6 (objective, standing settings, run-1 install table). The scheduled task prompt is updated for BN6.
4. Still open: what destroyed run 2's daemon (crawler roots everything; now guarded). `metrics.py pull` over the 1MB limit.

## Open questions

None.
