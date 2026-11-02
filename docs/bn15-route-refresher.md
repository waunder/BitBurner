# BN15 route refresher

Ken's plain-language summary, from the 2026-11-01 discussion. Numbers come from reading
the game's code (`docs/red-pill-path-2026-11-01.md`); no labyrinth has been reached yet.

## Where does The Red Pill come from?

Not Daedalus. In other BitNodes you join Daedalus, earn reputation and buy it. In BN15
it is the fifth darknet labyrinth reward. Each reward must be installed before the next
lab opens, so it takes at least five installs.

| Lab | Depth | Charisma | Reward |
| ---: | ---: | ---: | --- |
| 1 | 7 | 300 | The Broken Wings |
| 2 | 12 | 600 | The Boots |
| 3 | 19 | 1,500 | The Hammer |
| 4 | 23 | 2,500 | The Staff |
| 5 | 29 | 3,000 | The Red Pill |

After installing The Red Pill, hack `w0r1d_daemon`. Its difficulty is doubled in BN15.
Choosing the next BitNode after that needs Ken.

## What matters, and when?

| Thing | Role |
| --- | --- |
| Darknet scouts | The critical path and the current bottleneck: labs start at depth 7. |
| Charisma | Gates every lab and resets on each install. Matters most for the late labs. |
| Hacking | Needed most at the end, for `w0r1d_daemon`. Also unlocks richer targets. Resets on install. |
| Money and batches | Useful, but not what is blocking progress. |
| Factions and augmentations | Optional boosts; not required for The Red Pill. |
| Fighting stats | Irrelevant to this route as far as we know; they only serve crime and gangs. |
| Karma and gang | Not on this route. Karma survives installs, so crime can wait for spare player time. |

## Why is hacking level slow?

Two reasons. BN15 cuts hacking level by 40%, and XP needed grows exponentially: at level
355, another 50 levels takes about 6.3 times the total XP.
