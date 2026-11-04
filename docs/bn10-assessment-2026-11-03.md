# BN10 as the next BitNode — assessment, 2026-11-03

Question from Ken: is BN10 worth taking after BN15 as an early investment for long-term gain?
Rules below are from the game source (bitburner-src `dev`: `src/BitNode/BitNode.tsx`,
`src/PersonObjects/Sleeve/*`, `src/NetscriptFunctions/Sleeve.ts`) unless marked otherwise.
Nothing here is decided: entering a BitNode is Ken's call.

## Recommendation

Yes, BN10 next, taken as a deliberate slow investment. Source-File 10 is the only option
open to us that adds permanent capacity rather than a few percent: every later BitNode
gets an extra body that earns faction rep, karma and money in parallel with the player.
The cost is one slow, expensive node. Plan it around buying Covenant sleeves, which also
persist.

## What BN10 costs (multipliers, case 10)

| Area | BN10 | BN15 for reference |
| --- | --- | --- |
| Hacking level | 0.35 | 0.6 |
| Combat and charisma level | 0.4 | 1 |
| Script hack money | 0.5 | 1 |
| Cloud servers: cost / limit / max RAM | 5 / 0.6 / 0.5 | 1 / 1 / 1 |
| Home RAM cost | 1.5 | 1 |
| Augmentations: money / rep | 5 / 2 | 3 / 1 |
| Crime, company, hacknet, contract money | 0.5 | 1 |
| Darknet money | 0.4 | — |
| World Daemon difficulty | 2 | 2 |

Server money, faction work rep and the Daedalus requirement stay at default. Our MCP
income is hit twice: half the money per hack, and roughly a sixth of the cloud capacity
per dollar with lower caps. Expect the node to take several times longer than BN15. That
is a judgement, not a measurement.

## What it gives

- **Source-File 10:** each level grants one sleeve in every later BitNode, plus the Sleeve
  and Grafting APIs outside BN10. Base sleeves are `min(3, SF10 level + (in BN10 ? 1 : 0))`,
  so we would have 2 while in BN10 and 1 afterwards at SF10.1.
- **Covenant sleeves:** up to 5 more, bought only inside BN10 from The Covenant, and
  "a permanent effect". Prices are $10t, $100t, $1q, $10q and $100q. The first one, and
  probably the second, is realistic late in BN10. Entry to The Covenant, verified 2026-11-04
  in `src/Faction/FactionInfo.tsx` (see `docs/bn10-plan.md`, package B): 20 installed
  augmentations, $75b, hacking 850 and all four combat stats 850, which is a large gym
  grind at the 0.4 level multiplier.
- **Sleeve memory** (up to 100, bought in BN10) survives resets and sets the sync a sleeve
  restarts at.
- **Grafting:** augmentations without faction rep, at a time cost.

## How sleeves pay off for our automation

- **Faction rep goes to the player in full**, scaled only by the sleeve's shock: each
  recovered sleeve is another faction worker. Rep was the limit on every BN15 install.
- **Crime karma counts for the player**, scaled by sync. Our gang needs -54,000 karma and
  we are at about -6,500, so sleeves on crime shorten that.
- **Money from sleeve work goes 100% to the player.** Exp shared with the player is scaled by sync.

The catch is shock. A new or reset sleeve starts at shock 100, which earns nothing.
Recovery work takes about 28 hours of game time from 100 to 0 at intelligence bonus 1, and
it resets on every BitNode change. Sync starts at the sleeve's memory value. So the first
day of each node is mostly recovery, and the payoff grows with node length and with SF10 level.

## Alternatives checked

- **BN9 (hacknet servers):** server money 0.01, script money 0.1, cloud servers 0, hack exp
  0.05. This is the worst possible fit for MCP. Not recommended.
- **BN15 again:** the fastest node, with tooling that now works end to end; what SF15.2 adds
  is not yet checked.
- **BN2 again for intelligence:** not needed. Intelligence already accrues in every node
  through SF5, though that is from memory of the source, not checked.

## Not verified

- RAM cost of `ns.sleeve` calls.
- Whether SF10 alone opens the Sleeve API outside BN10 (`canAccessBitNodeFeature(10)`).
  The code points that way, but that is inferred.
- Whether an augmentation install resets sleeve shock, or only a BitNode reset.
- ~~The Covenant's join requirements~~ verified 2026-11-04, see `docs/bn10-plan.md`.
