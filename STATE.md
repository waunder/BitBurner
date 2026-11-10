# Current BitBurner Handoff

Last refreshed: 2026-11-10 14:20 PC clock, on the PC. Trimmed from 1,918 lines on 2026-11-10. Every
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
  `{"reserve":0,"homeRamTarget":262144,"cloudDemandFloor":0,"lateCloudDemandFloor":0.5,"earlyCycleHours":1.5}`.
  For 1.5h after an install, cloud RAM is bought freely to speed up the hacking rebuild. After that,
  cloud RAM is bought only while MCP's own jobs fill half of it, which in practice means none. Home
  RAM is bought throughout. `capital_status.json` `cyclePhase` shows the phase. Why: in cycle 7, cloud
  RAM tripled while hacking income stayed flat, because MCP uses 0.2% of it.
- **Gang planner** (merged 2026-11-09, 47b5559; `docs/gang-planner.md`). The advisor keeps a 4h
  minimum cycle for the gang faction (cap 12h). Ascension runs in either mode, at x1.5 and at most one
  per loop. Reputation mode uses the 0.80/0.90 wanted-penalty band.
- Share stays on (A/B recorded 2026-11-05).

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

Cash, not rep, limits each batch now (each aug in a batch costs 1.9x the one before). Backups are
`saves/bitburnerSave_pre-install<N>_BN10run2_<date>.json.gz`.

## Latest check

**2026-11-10 14:15 (2-hourly task): steady, no changes.** BN10, $1.97t, hacking 800, str/def/dex/agi
3369/6919/920/1247 (all past 850), karma -112k, 54 installed, 1 queued (The H4mmer of Daedalus). All
residents running. Player in Algorithms class toward hacking 850, the last Covenant gate (about 15:00).
Measured, 13 samples 13:10-14:10: cash 1.77t/h, hacking exp 2.52b/h (93 levels/h), NiteSec 1.06m rep/h,
MCP avg 684m/s. Trend n/a (cycle 1.9h). Advisor **wait** (gang 4h minimum); agreed. Cycle 7 (5.93h):
NiteSec 13.4m rep, favor +25.9 NiteSec, +19.3 CyberSec. World Daemon: not present.

## Next

1. Cycle 8 (from 12:15): confirm The Covenant invite is accepted once hacking reaches 850 (about
   15:00), and what `sleeve_buyer.js` does with it. The Black Hand donations show in readiness.
   Next install when the advisor and judgement agree (gang 4h minimum ends about 16:15).
2. Push hacking to 850 for The Covenant, then Daedalus and The Red Pill.
3. Gang planner metrics M1–M7 (`docs/gang-planner.md`): M1 and M6 are met. Keep checking the
   others at installs.

## Open questions

None waiting on Ken.
