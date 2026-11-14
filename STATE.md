# Current BitBurner Handoff

Last refreshed: 2026-11-13 17:20 PC clock, on the PC. Trimmed from 1,918 lines on 2026-11-10. Every
earlier note is unchanged in `docs/archive/state-2026-11-10/STATE-full.md`. Run 2's detailed check
entries are in `docs/check-log.md`.

> **Which session is this? (standing note, keep at the top.)** The BitBurner run is meant to be worked from a Claude
> **Code** session on the PC, in the Claude desktop app's Code tab, with the folder `C:\Users\kenne\BitBurner`. Such a
> session has a shell, git, `tools/game_terminal.py` and the scheduled task's tools. If you are a plain **chat** session
> (claude.ai or the desktop Chat tab, no shell or repo folder), do not try to run, debug or change the game or the
> scheduled task from here. Tell Ken plainly: "This is a chat session. For BitBurner work, open the Claude desktop app,
> go to the Code tab, and start a session in C:\Users\kenne\BitBurner." Then help only with questions that need no
> game access. The 2-hourly check is the scheduled task "BitBurner BN10 progress"; its runs appear in the Code tab
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

## Installs this run

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

Run 2's 13 installs are in `docs/check-log.md`. Backups are `saves/bitburnerSave_pre-install<N>_BN10run3_<date>.json.gz`.

## Latest check

**2026-11-13 17:15 (scheduled run): install 9, 13 augs + NeuroFlux x3, 51 -> 64.** Before (metrics 17:10, readiness
17:14, save 17:16): BitNode 10, $5.09t, hacking 666, str/def/dex/agi 1256/1559/858/1100, karma -131k, cycle 9 3.98h.
Measured (60 min to 17:10, 13 samples): rep/h Slum Snakes 1.82m (9.68m banked), The Black Hand 25.5k; hackExp/h 1.7b
(17 lvl/h); karma/h -50; cash/h 2.01t; MCP 250m/s (avg 446m/s). Trend: `cash/h 665b>1.99t>2.01t STEADY | MCP STEADY |
hackExp/h STEADY | rep best Slum Snakes 1.67m>1.77m>1.82m STEADY`. Advisor **wait** (gang minimum, 1m left; batch 0.69 vs
average 0.17); decision **install**: the minimum was up by the purchase, and a value-chosen batch (1.00) beat it. The
Covenant's hacking 850 needs about 4.5e11 exp at the current multiplier (1.7b/h), so holding for the invite was not worth
it. After: all 20 residents restarted, home 8TB. Backup `saves/bitburnerSave_pre-install9_BN10run3_2026-11-13.json.gz`.

## Next

2. Gang: **created with Slum Snakes about 22:00** (2026-11-11; 3963dac moved it off NiteSec's hacking 211 gate).
   8 members, reputation mode. At 07:15 on 11-12 it earned ~108 faction rep/h (respect 12.9k): look at member stats and
   tasks before counting on gang-sold augs.
5. Cycle 10 (from 17:16): rebuild; gang back in reputation mode until its target, then money. Gang 4h minimum ends
   about 21:16. Slum Snakes now has only zero-value augs left (Analyze Engine 0.03 aside), so the next batch comes from
   other factions' rep: Graphene Bionic Arms (Dark Army 1m), The Black Hand (200k), Graphene BrachiBlades (Speakers 450k),
   Neural Accelerator (BitRunners 400k). Consider steering player work to one of these.
6. **Install batch choice:** when cash limits the batch, `aug_install.js` buys dearest first and ignores value; set
   `priorityAugs` (bn10 `player_activity_config.json`) to the best value-per-cost augs before each install, as at installs
   5-7, until the planner weighs value itself. It now lists only owned augs. `planPurchases` also appends affordable
   filler after the list (CashRoot at install 9, about $0.7t at the stepped price); a `minValue` cut would stop that.
3. Next install: confirm the starved-MCP rule buys a cloud server and holds home RAM (`capital_status.json` reason
   "MCP starved" / "cloud RAM for MCP"), and that the player skips the gym.
4. Find what destroyed run 2's daemon (check log 2026-11-11 09:47) before this run nears hacking 6000.

## Open questions

None.
