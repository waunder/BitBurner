# Current BitBurner Handoff

Last refreshed: 2026-11-11 01:25 PC clock, on the PC. Trimmed from 1,918 lines on 2026-11-10. Every
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

**BN10 run 2**, entered 2026-11-08 by Ken. Route (`run_target.json`): gang (done, NiteSec) →
NiteSec augs → The Covenant (gate: hacking and combat 850, $75b) → The Red Pill (Daedalus) → World
Daemon. Installs are approved up to readiness to complete BN10, each with a save backup first. Stop at
the World Daemon or any other reset, and notify Ken (`AGENTS.md`). Install timing is the agent's
judgement. The install advisor is one input to it.

**After this run (Ken, 2026-11-10): likely BN10 run 3.** Still stop at the World Daemon: Ken enters the
next BitNode himself. Plan the allocator rollout to be proven in run 2 so run 3 starts with it.

Owned source files: SF 1.2, 2.1, 4.3, 5.3, 10.1, 15.1. Six sleeves (2 from SF10, 4 bought from The
Covenant in run 1).

## Standing settings (live, nothing to undo at installs)

- **Gang objective is `auto`** (2026-11-10, commit 667d2ab). The gang earns NiteSec rep until it
  covers every aug NiteSec sells (`gangRepNeeded` in `augmentation_readiness.json`, 3.5m now), then
  switches to Money Laundering by itself. An install resets faction rep, so the gang goes back to
  reputation on its own. Live 09:21: all 12 on Money Laundering, about $50b/h, penalty 0.999.
- **Cloud buying by cycle phase** (2026-11-10, commit 085ffe8). Game-only `capital_policy.json`:
  `{"reserve":0,"homeRamTarget":262144,"homeDemandFloor":0.5,"cloudDemandFloor":0,"lateCloudDemandFloor":0.5,"earlyCycleHours":1.5}`.
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
| 1 | 11-09 06:59 | 13 augs + 2 NeuroFlux | about 14 |
| 2 | 11-09 14:16 | 9 augs | 23 |
| 3 | 11-09 18:15 | 4 augs + 2 NeuroFlux (gang planner deployed) | 27 |
| 4 | 11-09 22:17 | 3 augs + W1ngs of Icarus | 32 |
| 5 | 11-10 02:19 | 6 augs + 1 NeuroFlux | 38 |
| 6 | 11-10 06:20 | 6 augs (all NiteSec) | 44 |
| 7 | 11-10 12:15 | 9 augs (all NiteSec) + B00ts of Perseus | 54 |
| 8 | 11-10 16:15 | 9 NiteSec augs + Neural Accelerator + 3 NeuroFlux + H4mmer of Daedalus | 65 |
| 9 | 11-10 19:17 | 17 augs (NiteSec, BitRunners, Black Hand) + 2 NeuroFlux + St4ff of Asclepius; cores 4 | 83 |
| 10 | 11-10 21:20 | The L4w of Bayes only; unplanned, cause unknown, no backup, $365t unspent | 84 |
| 11 | 11-10 23:00 | 1 aug for about $549t; unplanned, cause unknown, no backup | 85 |
| 12 | 11-10 23:48 | 1 aug queued before it; unplanned, cause unknown, no backup; Daedalus favor -> 183 | 86 |

Cash, not rep, limits each batch now (each aug in a batch costs 1.9x the one before). Backups are
`saves/bitburnerSave_pre-install<N>_BN10run2_<date>.json.gz`.

## Latest check

**2026-11-11 01:15 (2-hourly task): The Red Pill is queued (bought by hand about 01:12); third unplanned install at 23:48; not installed by me.**
The game reset again at 23:48:52 (85 -> 86, one augmentation queued since about 23:40, no backup, no `aug_install.js` record). That install
banked Daedalus favor 183, past 150. Between the 01:10 and 01:15 samples The Red Pill was bought for $0 with no donation; no repo script can buy it
(only `aug_install.js` calls `purchaseAugmentation`), so someone was likely playing in the game. I did not install, so as not to race them.
Live 01:15: $604t, hacking 3223, karma -117k, 86 installed, 1 queued (The Red Pill), all 20 residents running, player on Daedalus work.
Measured, 12 samples 00:20-01:15: NiteSec 2.41m rep/h, Daedalus 1.2m, Illuminati 301k; hacking exp 20.2b/h; cash 554t/h; MCP avg 96.1b/s.
Trend: n/a on every series (cycle 1.4h). Advisor wait (stale 4h gang minimum; plan QLink via an $795b Illuminati donation); decision: install The Red Pill next run.
World Daemon: not present (Red Pill queued, not installed).

## Next

1. Install The Red Pill: backup first, then `aug_install.js --install` (its plan adds QLink via an $795b Illuminati donation, favor 172).
   Do it at the next run unless the game has already been installed by then; check `queued` first.
2. Then the World Daemon gate, hacking 6000 (`getServerRequiredHackingLevel`). Stop there for Ken.
3. Gang planner metrics M1–M7 (`docs/gang-planner.md`): M1 and M6 are met. Keep checking the
   others at installs.

## Open questions

- **Ken: are you playing by hand?** The game was installed at 21:20, 23:00 and 23:48 on 11-10 without any script or session doing it, and
  The Red Pill was bought about 01:12 on 11-11 with no script able to. If it was you, say so and whether you want to do the Red Pill install
  yourself; until then each run installs it with a backup only when nobody seems active.
