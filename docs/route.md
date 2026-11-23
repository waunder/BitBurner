# Route to completing this game

Chosen by the agent under Ken's handover of 2026-11-22. Completing the game here means every BitNode finished at
least once. Maxing every Source-File would be 28 runs from 2026-11-22 (BN12 excluded) and is not the target.
Owned 2026-11-22: SF 1.2, 2.1, 4.3, 5.3, 6.1, 10.3, 12.1, 15.1. Never finished: 3, 7, 8, 9, 11, 13, 14.

| Order | BitNode | Runs | Why here | Engine we lack |
|---|---|---|---|---|
| 1 | 12 | run 2, then run 3 | preparation, then the hands-off test | none |
| 2 | 11 | 3 | cheaper augmentation batches for everything after; portability exam | economy at 1% server money (profile bn11 built 2026-11-22) |
| 3 | 7 | 1 | Bladeburner engine exists (bn6) | a Bladeburner finish in the finish tool (profile bn7 built 2026-11-22) |
| 4 | 14 | 1 | IPvGO player exists | reputation at 20%; hacking 15000 at level x0.4 (profile bn14 built 2026-11-22) |
| 5 | 3 | 1 | expected to fall to gang and hacking | a profile; corporation only if that proves false |
| 6 | 8 | 1 | stock trading is the only income; donations open at favor 0 | a proven stock engine (mcp_stock_trader.js is a start) |
| 7 | 9 | 1 | no cloud servers, hacking income 10%, exp 5% | Hacknet servers |
| 8 | 13 | 1 | hardest: hacking level 25%, exp 10%, gang softcap 0.3 | Stanek's Gift |

11 runs from here, counting the current one. Revisit after each; give Ken the reason with any change.

## After it: the full play-through

A new game from BitNode 1, scripted as soon as possible, the agent hands-on only as long as necessary. It runs as a
separate game. It never replaces, deletes or overwrites this save (the handover does not cover that).

## Progress

- 2026-11-22: profile bn11 built from bn12 (tests 696 pass; finish tool plans BN12 to BN11 as a profile switch).
  Not yet: an earning plan for 1% server money and a rehearsal from a fresh BN11 start in a disposable copy.
- 2026-11-22: stock engine built for BN11 (and BN8): copy rehearsal from $1t +47% in 29 min; installs refuse while
  shares are held and the engine sells within one update. On in bn11, off elsewhere. Not yet: a fresh-BN11 copy run.
- 2026-11-22 (check-in): profile bn7 built from bn12 plus profiles/bn6/bladeburner (unchanged). BN7 numbers from the
  game bundle: as BN6 but augmentations x3, script hack money 0.5, Bladeburner rank x0.6, skill cost x2. Tested: builds,
  staged copy 725 of 725 pass, finish_node preflight plans BN12 -> BN7 as a bn7 switch. Not yet: Operation Daedalus as a
  finish in docs/finish-procedure.md and tools/finish_node.py (World Daemon only today), a fresh-BN7 copy rehearsal,
  and skill weights at x2 skill cost.
- 2026-11-22 21:20 (check-in): profile bn14 built from bn12 plus core ipvgo_player.js at startup. BN14 numbers from the game
  bundle: Go power x4, hacking level x0.4, speed x0.3, script hack money 0.3, crime success x0.4, combat x0.5, augs x1.5, faction
  and company work rep x0.2, World Daemon x5 (hacking 15000). faction_rep aug weight 0.5 -> 0.8. Tested: builds, staged copy
  711 of 711 pass, finish_node preflight plans BN12 -> BN14 as a bn14 switch. Not yet: whether hacking 15000 is reachable in
  reasonable time (likely the long pole; may move BN14 later in the order), karma pace at x0.4 crime success, the IPvGO
  opponent for x4 power, a fresh-BN14 copy rehearsal.
