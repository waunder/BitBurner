# Gang territory trial (2026-11-19, BN10 run 4)

**Question (Ken):** hacking swamps every other income late in a cycle, so can territory give an
early or mid-cycle advantage?

**Game rules (read from the game's source, 2026-11-19):**
- The gang survives augmentation installs (`Prestige.ts`): territory and power carry through every
  cycle of the BitNode. They reset only with a new BitNode.
- Respect gain per task is multiplied by `max(0.005, (territory*100)^t / 100)` (t = the task's
  territory.respect, 1-2), all raised to `(0.2*territory + 0.8)`. Money is the same with t = 1. So going
  from 14% to 50% territory multiplies respect gain about 3.5x (t=1) to 12x (t=2) before the exponent.
- Gang faction rep (Slum Snakes, which sells almost every aug we buy) comes from respect and restarts
  at 0 each install. Early in a cycle it gates the batch; late in a cycle it covers every aug.
- Power gain per territory update = `0.015 * territory * sum(member power)`, where member power = the six
  stats / 95, counting only members on Territory Warfare. NPC gangs gain at most ~0.85 per update
  from the multiplicative roll, plus a small additive one.
- Clash win chance = our power / (ours + theirs). Territory moves only in clashes, which our
  controller enables only at >= 90% odds (`territoryEnabled` true and the odds gates).

**Setup:** `territoryTrial` in `profiles/bn10/config/gang_capital_policy.json`: the 4 lowest respect
earners on Territory Warfare until 10:03, clashes off; they don't ascend during the trial. It ends by
itself (the controller ignores an expired trial).

**Baseline 07:03:** power 1, the only rival with territory at 7,887, territory 14.29%, respect
9,139/s, gang money $25.1m/s (12 members on Human Trafficking). Cohort power (sum of the 4 members'
power) 10,621.

**To measure at the end:** power gained per hour vs the rival's gain, hence hours to a 9:1 power lead
(90% odds); respect and money given up (gang rates vs baseline, `metrics.py`); whether an install
during the trial reset member stats (cohortPower in `gang_status.json` `territory.trial`).

## Result (read 2026-11-19 ~11:55)

- **Power:** ours 1 -> ~12,775 in the 3h trial (about 4,300/h with 4 members); the rival 7,887 -> ~9,270
  (about +300/h). Clash odds 58% (ours / (ours + theirs)). Power kept after the trial ended (no decay seen).
- **Cost:** gang respect rate about 1,400/s during the trial vs about 2,100/s after (4 of 12 members off
  respect work, so about a third). Late in a cycle that is cheap: Slum Snakes rep was 7.3m against 750k
  for the dearest aug. Gang money is tiny next to total income (cash rate ~$276b/s).
- **Install during the trial:** none happened, so not measured.
- **Why not clash at 58%:** each lost clash costs territory, and members on Territory Warfare can die in
  clashes (a death costs 5%+ of respect plus that member's gear); the lowest member combat stat is 11.

## Power build 2 (from 2026-11-19 11:53, Ken asked whether the odds were reasonable)

6 lowest respect earners on Territory Warfare for 12h (to 23:53), clashes still off. Cohort power 26,386 at
start, so expect several thousand power an hour. The 90% gates need about 9:1 (~84k vs the rival's ~9.3k).
When they pass: set `territoryEnabled` true with the stop-loss from docs/gang-all-in-strategy-2026-10-25.md.

