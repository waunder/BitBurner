**2026-11-20 (Ken session): BITBURNER WORK NOW LIVES ON KEN'S MAC MINI (repo `/Volumes/ExternalData/BitBurner`, launchd daemon per docs/remote-api-keepalive.md) until a new GPU is installed and working in the PC. The PC is quiescent: do not start, reload or connect to BitBurner there, and do not run game commands from it.** PC side stopped 2026-11-20 ~14:10: Windows task "BitBurner daemon supervisor" disabled (re-enable: `Enable-ScheduledTask -TaskName 'BitBurner daemon supervisor'`), daemon killed, Claude check-in `bitburner-bn15-progress` paused by Ken. Not on the Mac: auto install, outage watchdog, DevTools reconnect (`daemon_supervisor.py` is Windows-only), so installs are by hand from a Mini session. Installs are permitted on the Mini as they were on the PC (Ken, 2026-11-20): backup first, advisor verdict as trigger; DevTools on the Mac since 17:22 (Steam launch option --remote-debugging-port=9222), so save_export.py backups and game_terminal.py work here. Reason: the PC's RTX 4070 Ti is faulty (10 crashes in 26h, 0x116 VIDEO_TDR_FAILURE; reseat did not help; OCCT VRAM test hung within a minute). The Mini loaded the Steam Cloud save from 2026-11-19 23:59 (the PC ran on to 09:34; ~9.5h of PC progress dropped). Two copies on one save clobber each other through autosave and Steam Cloud. Scheduled check-ins: report "game on the Mini, standing by" and change nothing. PC-side backup of everything before the switch: `Documents\bitburner-save-backups\2026-11-20_pre-reseat`. Moving back to the PC needs Ken: quit on the Mini first, let Steam Cloud upload, then launch here and take the cloud copy. The supervisor/daemon on the PC are harmless while the game is absent (they never launch it).

**2026-11-20 17:40 (Ken session): 8th sleeve now buys itself.** `sleeve_buyer.js` held every Covenant sleeve to the late-cycle cap (1% of cash per purchase), so the $100q sleeve would have waited for $10,000q. Fixed: a sleeve may use all cash above the reserve; memory keeps the cap. Restarted 17:3x (PID 350561), live status `saving for sleeve: 1.00e+17`. Cash $15.6q at 17:25, income ~$0.96q/h: about 88h, so around 2026-11-24 evening. Grafts are done (all rejected on net value; entropy 0). Next check: confirm the purchase in `sleeve_buyer_status.json` `purchases`, then the World Daemon stop (backup, notify Ken).

**2026-11-19 20:55 (Ken session): Ken wants the 8th sleeve first: do not root, backdoor or destroy the World Daemon until it is bought.** Install 10 (auto, 19:27) installed The Red Pill; auto install now holds. Sleeve memory is 100 on all 7; the only need is $100q cash (Covenant member; ~$0.5-1q/h, so ~4-8 days). The L4w of Bayes (queued) is not worth an install alone (+15% darknet money, ~2% of income). Entropy 6 (grafts, x0.886 on every multiplier) is the real lever: violet Congruity Implant graft ($150t, ~14 min) clears it. Fixed `graft_logic.js` (cure exempt from the entropy cap, valued by stacks removed). First try 20:47 was cancelled within a minute by `faction_join.js` Homicide (post-install kill rebuild) and the game kept the $150t; fixed (faction_join skips while grafting or graft_status claims the player). The controller retries by itself once cash >= $600t (25% price cap). Next: confirm `graft_log.txt` shows Congruity finished and entropy 0.

**2026-11-17 Ken session (to ~21:00):** darknet push live (16 managers, ~$350-500m/h vs ~$35m/h; plan in docs/opportunities.md "Darknet push" for the checks); cloud RAM obeys the allocator (game-only valuation_flags.json); mcp_xp.js retired; HUD line "Goal: BN10 Run 4 Cycle 2" (install_count.json, run_target.json `run`); run page BN10 layout; lessons in docs/lessons.md (restart tail scripts by running again).

**2026-11-16 21:48 PC clock: BN10 run 4 entered (Ken chose BN10).** BN6 run 1 complete: Operation Daedalus won 21:47 (rank 1.36m; entered BN6 2026-11-14 17:15, about 52.5 h). Entered with `singularity.destroyW0r1dD43m0n(10, "startup.js")`; `profile.py switch bn10 --live` (backup `saves/pre-switch-bn10-20261116-214831.json.gz`, pushed 158, deleted 3); startup on 32GB home (5 started, 15 waiting for RAM); player and 7 sleeves on Shoplift; backup `saves/bn10-run4-entered-20261116.json.gz`. Purpose (Ken's choice; SF10 is already at its max level 3, so no Source-File gain): The Covenant's 8th sleeve (~$100q) and sleeve memory, which last across BitNodes. Lessons: `docs/lessons.md`. The BN6 and BN10 run 3 sections below are history until this file is rewritten for run 4.

**2026-11-16 19:15 PC clock: BN6 end ready, Ken notified.** Operation Centurion and Vindictus won; next black op is Operation Daedalus, rank 606k of 400k, odds 0.52-0.55 (`daedalusReady` true). Desktop notification sent 19:16 (no phone push: Remote Control off). Backup `saves/bn6-daedalus-ready-20261116-1915.json.gz`. Daedalus not attempted (`allowDaedalus` false); waiting for Ken to choose the next BitNode. No install pending.

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

- **Check-in every 2 hours, on the Mac Mini** (Ken, 2026-11-20 ~14:10, after a credit top-up): Claude app task
  `bitburner-bn10-checkin-mac`, cron `7 1-23/2 * * *`, prompt in `docs/mac-bn10-checkin-task.md`. The PC task
  `bitburner-bn15-progress` is paused (Ken, ~14:10) while the game is on the Mini. Each check-in also reviews
  one row of `docs/number-review.md` (step 5c).
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
- **Black ops tried at 0.35 odds** (2026-11-16 17:15, game-only `bladeburner_config.json` `{"blackOpMinChance": 0.35}`, default 0.6). Rank passed Centurion (300k) but odds 0.41-0.48 held it back; failure costs little rank. Daedalus stays blocked (`allowDaedalus` false). Delete the file to revert.
- **Four sleeves may infiltrate** (2026-11-16 15:15, game-only `sleeve_config.json` `maxInfiltrators` 4, default 2). Contract counts sat at 8-20, under the start bar of 20, so spare sleeves did Homicide. Remove the key to revert.
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
  **Status 2026-11-16:** the project stopped at R1 (shadow); the cycle-9 judgement and R2 never happened as the run
  moved to BN15 and BN6, and BN6 left allocator.js out for RAM. Restored to BN6 startup 12:25 (home 1TB, 513GB free).
  Its first pass granted all 13 sleeve aug batches bought after install 4 (early phase, no batch reserve). Next:
  judge it this cycle, then R2 (the gang's reserveInstallPlan is a local stand-in for its batch reserve).

## Installs BN10 run 4

| # | When (PC clock) | Bought | Installed after |
|---|---|---|---|
| 1 | 2026-11-17 17:42 | 7 (Power Recirculation Core, HemoRecirculator from Tetrads; S.N.A, ADR-V1 Pheromone Gene, Wired Reflexes from Tian Di Hui; BitWire, Neurotrainer I from CyberSec; ~$4.20b, `priorityAugs` + `priorityOnly`); no NeuroFlux. Backup saves/pre-install-bn10run4-1-20261117-1742.json.gz | 0 -> 7 |
| 2 | 2026-11-17 23:16 | 4 (Bionic Spine, Nanofiber Weave, Neurotrainer II, NutriGen Implant from Slum Snakes; ~$2.71b, value 0.54 by hand via `priorityAugs`, vs the advisor plan ADR-V2 + SmartSonar 0.14 for $3.46b) + NeuroFlux x3. Backup saves/pre-install-bn10run4-2-20261117-2318.json.gz | 7 -> 12 |
| 3 | 2026-11-18 05:15 | 5 (CRTX42-AA Gene Modification, Neurotrainer III, Combat Rib I, Augmented Targeting I, LuminCloaking-V1 from Slum Snakes; ~$3.63b, readiness plan by value 0.38, advisor install) + NeuroFlux x2. Backup saves/pre-install-bn10run4-3-20261118-0517.json.gz | 12 -> 17 |
| 4 | 2026-11-18 09:16 | 7 (Photosynthetic Cells, Bionic Legs, Combat Rib II, Augmented Targeting II, LuminCloaking-V2, INFRARET Enhancement, Synaptic Enhancement Implant from Slum Snakes; ~$27.4b, value 0.89, advisor plan; gang money mode paid for it) + NeuroFlux x2. Backup saves/pre-install-bn10run4-4-20261118-0920.json.gz | 17 -> 24 |
| 5 | 2026-11-18 13:16 | 5 (Graphene Bionic Spine Upgrade, Synfibril Muscle, Combat Rib III, Augmented Targeting III, Cranial Signal Processors - Gen I from Slum Snakes; $51.4b, value 1.25, advisor plan; gang money mode paid) + NeuroFlux x4; leftover cash took home 512GB -> 1TB. Backup saves/pre-install-bn10run4-5-20261118-1318.json.gz | 25 -> 30 (incl. grafted Bionic Arms) |
| 6 | 2026-11-18 19:16 | 9 (Graphene Bionic Legs Upgrade, Graphene Bone Lacings, NEMEAN Subdermal Weave, Synthetic Heart, Neotra, Neural Accelerator, Embedded Netburner Module, CSP Gen II, SmartSonar Implant from Slum Snakes; $1.52t, value 2.24, advisor install) + NeuroFlux x4 + queued The W1ngs of Icarus; home 1TB -> 4TB, 2 cores. Backup saves/pre-install-bn10run4-6-20261118-1920.json.gz | 32 -> 42 (incl. 2 grafts) |
| 8 | 2026-11-19 07:07 (auto) | 11 augs (names not kept: aug_install_status.json was overwritten by install 9); advisor install. Backup saves/pre-install-auto-20261119-0707.json.gz | 58 -> 69 |
| 9 | 2026-11-19 11:13 (auto) | 4 (ENM Core V3, PC DNI NeuroNet Injector, PC DNI Optimization Submodule, CSP Gen V) + NeuroFlux x17 + Daedalus donation $1.49t; home 2PB, 7 cores; advisor install. Backup saves/pre-install-auto-20261119-1113.json.gz | 69 -> 73 |
| 7 | 2026-11-19 01:15 | 12 (ENM DMA Upgrade, Artificial Bio-neural Network, OmniTek InfoLoad, HyperSight, ENM Core, Enhanced Myelin Sheathing, CSP Gen III, ADR-V2, DataJack from Slum Snakes; Neural-Retention from NiteSec; BrachiBlades from The Syndicate; Artificial Synaptic Potentiation; $4.65t, value 1.60, advisor install) + NeuroFlux x3 + queued The B00ts of Perseus; home 4TB -> 16TB, 4 cores. Backup saves/pre-install-bn10run4-7-20261119-0120.json.gz | 44 -> 57 |

## Installs BN6 run 1 (history)

| # | When (PC clock) | Bought | Installed after |
|---|---|---|---|
| 1 | 2026-11-15 07:16 | 7 (Power Recirculation Core, HemoRecirculator, LuminCloaking-V1 from Tetrads; Nuoptimal Nootropic Injector Implant, ADR-V1 Pheromone Gene, Speech Enhancement from Tian Di Hui; BitWire from CyberSec; ~$2.1b) + NeuroFlux x1 + The W1ngs of Icarus (darknet reward) | 0 -> 9 |
| 2 | 2026-11-15 19:17 | 5 (Bionic Arms from Tetrads; CSP Gen I, Synaptic Enhancement, Neurotrainer I from CyberSec; Wired Reflexes from Tian Di Hui; `priorityOnly` to skip Glibness Enhancement, $2.5b, value 0) + NeuroFlux x6; home 512GB -> 1TB | 9 -> 14 |
| 3 | 2026-11-15 23:15 | 4 (Nanofiber Weave, Speech Processor Implant, Social Negotiation Assistant from Tian Di Hui; LuminCloaking-V2 from Tetrads; ~$534m) + NeuroFlux x3; home stays 1TB | 14 -> 18 |
| 4 | 2026-11-16 11:05 | 4 (I.N.T.E.R.L.I.N.K.E.D from Bladeburners $10.45b; Neuroreceptor Management Implant, NutriGen Implant from Slum Snakes; Augmented Targeting I) ; ~$11.5b. Rank 44.4k at install, 9.8k/h over the prior hour; save backup saves/pre-install-bn6-cycle18-20261116-1102.json.gz | 18 -> 22 |

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

**2026-11-19 13:15 (scheduled run, BN10 run 4, cycle 10 at 2h): contract solver fixed; stack hack fraction 0.1 -> 0.25 from the next install; no install by hand.**
Auto installs 8 (07:07, 58 -> 69) and 9 (11:13, 69 -> 73) happened since the last check entry (table). Live 13:10: $1.67q (1.82q at 13:25), hacking 4044, str/def/dex/agi 87k/18k/5.0k/6.1k, karma -169k, 73 installed, 1 queued (The H4mmer of Daedalus), home 2PB 7 cores. Sleeve memory at cap on all 7; 8th sleeve $100q.
Measured (24 samples, 11:15-13:10): Slum Snakes 5.88m rep/h; Daedalus 502k; hackExp/h 43.7b; karma/h -705; cash/h 943t; MCP avg 171b/s. Trend n/a (one window per cycle).
Income h1-2 vs cycle 9: hacking 978t/h (382t), darknet 17.5b (9.3b), gang 61.9b (67.6b, 6 members on territory), sleeves 5.4b (3.4b), contracts 0 (0.27b; the fault below).
Fix: `cct_watcher.js` had failed 30 times (LZ solver threw on 10+ unmatched characters); fixed, 12 contracts claimed. Stacks earn $4-13b/s per TB on ~51TB with ~5.7PB idle: `HACK_FRACTION` 0.25 (stack_manager.js) for stacks started after the next install.
Install: advisor wait (gang minimum, ~2h more); agreed; auto install will act. Plan QLink + BitRunners Neurolink + Daedalus donation $1.31t: The Red Pill likely next, then the daemon (decision for Ken in docs/opportunities.md).
**Next run: per-stack $/s at 0.25 vs 0.1 (row 3 `again`); end check (Red Pill owned? daemon level); gang power build ends 23:53.**
**2026-11-19 06:51 (Ken session):** the 11-18 21:00:55 outage was Ken's accidental click on Active Scripts' Kill All Scripts (confirmed). New outage watchdog in the supervisor (`tools/outage_watchdog.py`, docs/processes.md): runs `startup.js` when all resident heartbeats are 10+ min old, once per 2h. Every check: grep `watchdog:` in `tools/daemon_supervisor.log`. Before a World Daemon or BitNode change: create `tools/watchdog.pause` (delete after).
**2026-11-19 06:57 (Ken session): installs are now automatic** (Ken: "let the install verdict also be the trigger"). `tools/auto_install.py` in the supervisor: verdict `install` for 5 min -> save backup `saves/pre-install-auto-*` -> `aug_install.js --install`. Checks: do not install by hand; grep `autoinstall:` in `tools/daemon_supervisor.log`, review each install like before (cycle review, install table row). Pause with `tools/autoinstall.pause`. Holds itself once The Red Pill is owned.
**2026-11-19 07:05 (Ken session): gang territory trial running to 10:03** (docs/gang-territory-trial.md; `territoryTrial` in the bn10 gang policy, ends by itself). Next check: fill in its Result section (power gained/h vs rival, respect/money given up, hours to a 9:1 lead), then remove `territoryTrial` from the policy. Weekly usage limit is near: check-ins cut to once a day until Ken restores them; the game runs on its own (auto install, outage watchdog).

## Daedalus ready (2026-11-16 21:35)

Rank 1.32m (gate 400k), 363k/h. Operation Daedalus: 100% odds, 7m16s, 1 count. NOT started (allowDaedalus false).
Save backed up: saves/daedalus-ready-bn6-20261116-2135.json.gz. Ken notified; ending BN6 is his call.
Bladeburner keeps working Assassination meanwhile.

## Next

1. **BN6 day one (17:20):** home 32GB, 7 sleeves, SF 1.2 2.1 4.3 5.3 10.3 15.1. Running: mcp_supervisor, crawler, capital_bootstrap,
   early_spread loops on joesguns; sleeves 0-6 Shoplift; player Shoplift (`crime_now.js`, dev). mcp.js was killed for RAM;
   capital_bootstrap/manager restart the residents as home RAM grows. BN6 multipliers (non-1): HackingLevel 0.35, HackExpGain 0.25,
   ServerMaxMoney 0.2, ScriptHackMoney 0.75, ServerStartingMoney 0.5, CrimeMoney 0.75, CompanyWorkMoney 0.5, GangSoftcap 0.7,
   GangUniqueAugs 0.2, DaedalusAugsRequirement 35, WorldDaemonDifficulty 2. No Bladeburner multiplier below 1, so hacking is the weak
   leg here and Bladeburner plus gang carry the run.
2. **Bladeburner controller live 2026-11-16 00:10** (`bladeburner.js`, commit 081ed2a, docs/processes.md "Bladeburner"). It owns the
   player (player_activity_controller holds); moved to Aevum; Field Analysis first. Never starts Operation Daedalus
   (`allowDaedalus` false): stop, back up and notify Ken when `bladeburner_status.json` `daedalusReady` is true.
   Sleeves on Bladeburner since 2026-11-16 ~00:30 (commits a92d623, d16148d): spare sleeves take contracts (start at 0.8 odds,
   keep down to 0.7), one infiltrates while the lowest count is under 300; the rest commit Homicide. Rank ~81 at 00:50, ~390/h.
   HUD: `hb` toggles the Bladeburner section; header "Node finish" line (white) is the Daedalus ETA at the current rate.
   Next: track rank/h trend; tune `minChance` and stamina thresholds; consider sleeve Training/Field Analysis instead of
   money crime; add rank to `metrics_logger` and the 2-hourly check; growth-based node ETA.
   **Sleeve augs (Ken 2026-11-16):** buyer now runs outside BN10 (f4d8ecd) but only for exp<1000 sleeves, a window
   that closes before cash exists (cash ~$65m at 1h, ~$200m at 2h after install). Build before next install:
   early-cycle window (~2h), combat augs + Neurotrainer I only (~$100m/sleeve), cheap group first across sleeves.
   Ken's framing: balance exp lost to each purchase against capability gained; maximize growth rate, don't
   under-buy. Measure it: sleeve contract odds and rank/h per cycle with vs without augs.
3. Rewrite this file for BN6 (objective, standing settings, run-1 install table). The scheduled task prompt is updated for BN6.
4. **Install timing (Ken and Claude, 2026-11-16 09:15):** hold the next install for a few hours of clean data on
   today's fixes (city hop, black ops at 0.6, sleeve teams, gang gear): rank/h rose from ~5k to 7.9k. In BN6 an
   install resets combat stats, so it costs Bladeburner rank/h for hours (unmeasured) while the batch is small
   (~4 augs for ~$13.5b; price x1.9 per aug). Install when rank/h growth flattens or the affordable batch clearly
   outweighs the dip; then measure the dip, the recovery and the first sleeve aug batches.
   **Done 11:05** (Ken approved after the gang cap, ed99b83: gang gear spends only cash above the install plan).
   Now measure: rank/h dip and recovery vs 9.8k/h; first sleeve aug batches (buyer in its early phase); gang spend.
5. **For the next-BitNode decision (Ken 2026-11-16):** we own 7 of 8 sleeves (3 from SF10.3, 4 Covenant). The 8th
   and sleeve memory upgrades are bought from The Covenant only in BN10; the 5th Covenant sleeve costs ~$100q
   (10^4 x $10t). Weigh a BN10 return for these against other BitNodes.
6. Still open: what destroyed run 2's daemon (crawler roots everything; now guarded). `metrics.py pull` over the 1MB limit.

## Open questions

None.
