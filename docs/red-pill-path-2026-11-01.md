# BN15 Red Pill path and darknet earnings — 2026-11-01

Read from the game bundle (v3.0.1); nothing below has been tried live.

Daedalus does not sell The Red Pill in BN15. It is the fifth labyrinth reward.
The active lab depends on which rewards are **installed**: the check reads
`Player.augmentations`, not the purchase queue.

| Order | Lab | Depth | Charisma | Maze | Reward |
| ---: | --- | ---: | ---: | --- | --- |
| 1 | Normal | 7 | 300 | 20×14, manual | The Broken Wings |
| 2 | Cruel | 12 | 600 | 30×20, manual | The Boots |
| 3 | Merciless | 19 | 1,500 | 40×26 | The Hammer |
| 4 | Uber | 23 | 2,500 | 60×40, offset | The Staff |
| 5 | Eternal | 29 | 3,000 | 60×40, offset | The Red Pill |

Consequences: at least five installs, and charisma is reset by each install while
the requirement rises. The script path is `dnet.authenticate(lab, "go north")`,
one move per call, from a server connected to the lab. Each move reports exits.
`labreport()` and `labradar()` are free but must also run on a connected darknet
server; radar shows a local map. Manual labs also offer a UI; whether scripts can
finish them is unconfirmed. Finishing a lab drops a `the_great_work` cache.
The World Daemon link needs the Red Pill installed.

Earnings evidence: the 2026-09-28 ROI window measured darknet $1.10m/s against
hacking $868m/s, 0.13%, though flagged inconclusive for MCP phase changes.
Charisma rose 12.3/min there with the darknet on. BN5 darknet income was $131m
against $11.09b hacking. Live spread is capped at 2 managers and 2 phish threads
because uncapped managers froze the renderer on 2026-08-30.

Decision: treat the darknet as the progression route, not an income engine.
Build lab telemetry first, then a maze solver, then test a higher cap as a
measured experiment.

## Build status

Built and tested offline: `dnet_lab.js`, `dnet_lab_logic.js` and the crawler hook;
100 simulated mazes pass. Never run against a real labyrinth: charisma is 1, the
darknet is not running yet, and reward handling is read from source only.

The original gap was reach: spread stops one hop from `darkweb`, and
`dnet_crawl.js` cracks only eight shallow models. `dnet_scout.js` now walks deeper
as a single chain using the full solvers.

Live, 2026-11-01 about 14:25 MST: `dnet_root.js` ran at 6.45GB once `mcp_xp.js` was
stopped. The first chain made four hops, from `darkweb` to `bit;flame`, and hit a
dead end. Backtracking was added; the next chain stopped at depth 0 on `112233`.
Its reasons: `echo.citadel.web` too small for the 6.1GB scout, `granny-s&grid` no
longer directly connected, and `hacker$flame` (KingOfTheHill) ran past the 60s
budget at 21 of 94 guesses. No lab has been seen and depth 7 has not been reached.
Backing up to `darkweb` fails because phishing fills that gateway. `dnet_root.js`
now pauses phishing to launch a scout, but the gateway stays too full to back into.
At 14:47 MST a chain stopped at `112233` again when `net@net` moved mid-crack.
Charisma had reached 117 by 14:45 with no training, so darknet logins raise it.
Crawler RAM rose to 7.3GB with the lab hook; check that gateway recrawls still fit.

At 17:21 MST a chain reached depth 2 at `sm4rt_t04ster::grid`, the deepest seen in
BN15, then spent all four tries on hosts `probe()` listed but that were not directly
connected. Scouts now skip those. The scout measures 5.4GB, not 6.1GB.

At 21:32 MST a chain found `th3_l4byr1nth` next to `austin`, four hops after the stasis
anchor went in. Scouts had been losing neighbours mid-crack; the anchor holds position.

At 22:09 MST a script finished the Normal lab (manual labs do accept scripts): 17 moves from `bungo`. The reward lands
as a cache on the lab, and opening it queues the augmentation; it still needs an install. The anchored host at depth 6
kept gaining links, so short chains from it reached lab neighbours twice in five minutes. Each lab link lasted about a minute.

Charisma gap, 23:32 MST: reward stats in the game source add only about 1.06 (Boots) and 1.07 (Hammer) to the level multiplier before
The Red Pill, and level grows with the log of exp, so training alone cannot reach 1,500 or 3,000. Details are in `STATE.md`.

Correction, 2026-11-02: augmentations close that gap. Charisma level multipliers across all factions compound to about x16; `STATE.md` holds the route.
