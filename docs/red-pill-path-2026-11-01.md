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

Blocking gap: spread is one hop from `darkweb`, because managers and child
crawlers run `--no-spread`, so a depth 7 lab is out of reach. `dnet_crawl.js` also
cracks only eight shallow password models. Next: a single-process scout that
walks deeper without leaving residents, using the full solvers in `dnet_lib.js`.
Crawler RAM rose to 7.3GB with this hook; check that gateway recrawls still fit.
