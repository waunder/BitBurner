# Current BitBurner Handoff

Last refreshed: 2026-11-10 16:20 PC clock, on the PC. Trimmed from 1,918 lines on 2026-11-10. Every
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
  earnings: 88%, 70%, 50% over cycles 6-8). Next is R1, a shadow allocator on branch
  `allocator-shadow` (not started).

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

Cash, not rep, limits each batch now (each aug in a batch costs 1.9x the one before). Backups are
`saves/bitburnerSave_pre-install<N>_BN10run2_<date>.json.gz`.

## Latest check

**2026-11-10 16:15 (2-hourly task): install 8, 54 -> 65 installed.** Before (metrics 16:05, readiness 16:13):
BN10, $5.67t, hacking 852, str/def/dex/agi 3919/8048/1000/1402, karma -113k. **The Covenant joined** (between 15:55
and 16:00); sleeve_buyer held to 1% of cash (late phase), so nothing spent there. Measured, 12 samples 15:10-16:05:
cash 4.29t/h, hacking exp 2.74b/h, NiteSec 1.12m rep/h, BitRunners 112k, MCP avg 901m/s. Trend: cash STEADY, MCP
STEADY, hackExp STEADY, rep work SWITCH (BitRunners), rep best NiteSec STEADY. Advisor **wait** only for the gang 4h
minimum (ended 16:15); next aug BitRunners Neurolink 6.4h away (0.036/h vs cycle 0.25/h). Decision: **install**.
Backup `pre-install8` validated. All residents restarted; readiness 16:15: 65 installed, 0 queued.
World Daemon: not present (no Red Pill).

## Next

1. Cycle 9 (from 16:15): rebuild hacking to 850 to rejoin The Covenant (membership was lost at install).
   Add `metrics.py cycles` for cycle 8 (12:15-16:15) to the check log once a new-cycle sample exists.
   Next install when the advisor and judgement agree (gang 4h minimum ends about 20:15).
2. Then Daedalus (hacking 2500 or all combat 1500, $100b) and The Red Pill.
3. Gang planner metrics M1–M7 (`docs/gang-planner.md`): M1 and M6 are met. Keep checking the
   others at installs.

## Open questions

None waiting on Ken.
