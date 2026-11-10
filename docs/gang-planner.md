# Gang planner: spec, tasks and acceptance metrics

Branch `gang-planner` (worktree `C:\Users\kenne\BitBurner-gang-planner`). Written 2026-11-09 from two planner
reports (gang-faction strategy; running the gang) and Ken's direction. Deploys at the **next install** of BN10 run 2.
Vocabulary: a **run** is a whole BitNode playthrough; a **cycle** is install to install (AGENTS.md).

## Goal

Make the gang the run's main augmentation engine, for whichever hacking gang the run has (NiteSec, The Black
Hand): grow gang-faction reputation as fast as possible, install on the gang's rep tiers rather than every ~2h,
and stop the player and sleeves earning rep the gang already provides. Nothing here names NiteSec; the gang
faction is read from the game.

## Mechanics this rests on (game source, bitburner-src dev)

- A gang faction sells almost every augmentation (`Faction/FactionHelpers.tsx` getFactionAugmentationsFiltered);
  other factions' unique augs are included at random (BN10 `GangUniqueAugs` 0.25). Choosing "the strongest"
  gang faction gains little; take the first hacking-gang invite (NiteSec or The Black Hand) after karma -54k, and
  never one where rep has been built (creating the gang zeroes it).
- Gang rep = faction_rep mult x respect gained x (1 + favor/100) / 75 (`Gang/formulas/formulas.ts`).
  Donations to the gang faction are refused (`NetscriptFunctions/Singularity.ts`), so cash raises gang rep only
  through gear. An install keeps the gang (respect, exp, gear, wanted), multiplies ascension points by 0.95, resets
  the gang faction's rep to 0 and adds favor (`Prestige.ts`).
- Respect per member = (11 x baseRespect x statWeight x territory x penalty)^E, E = (0.2T + 0.8) x 0.9 in BN10
  (0.746 now); statWeight = 0.8 hack + 0.2 cha - 4 x difficulty. Wanted cleanup speed depends only on how many
  members clean (x(1 - 0.001 x justice) per batch), not their stats. Ethical Hacking beats Vigilante for a
  hacking gang.
- Ascension multiplier = sqrt(points/2000), points = exp - 1000. Ascension wipes exp and ordinary gear (rootkits,
  vehicles) but keeps gang augmentations (BitWire, DataJack, Neuralstimulator); it removes the member's earned
  respect from the gang total, never faction rep.
- Each queued augmentation makes later ones 1.9x dearer. Buying all of a gang faction's ~50 augs needs 4-6
  installs; the top tier needs 1-3.5m rep earned within one cycle.

## Baseline (this cycle, BN10 run 2, from the 14:16 install)

Recorded every 5 minutes in `metrics_log.txt` (gang block since 16:20). At 16:20: NiteSec rep 256k, rate 42.4
rep/s (153k/h) at favor 72 (about 89k/h at zero favor); respect 3.07m, respect gain 200/cycle; wanted 322k,
penalty 0.905; 12 members, ascension mult x17-x26; gear: no rootkits, no gang augs. Player on Tetrads field work
for Bionic Arms (sold by NiteSec, already rep-ready there); sleeves 1 and 2 on Slum Snakes and Tetrads for augs
NiteSec sells. Install hold in STATE.md until NiteSec 550k.

## Tasks

### A. Player-side (coder A): `core/player/augmentation_readiness.js`, `core/player/install_advisor_logic.js`,
`core/player/aug_install_logic.js`, `core/player/player_activity_logic.js`, `profiles/bn10/sleeve/sleeve_logic.js`,
`profiles/bn10/config/player_activity_config.json`, `profiles/bn10/config/run_target.json` (or wherever augWeights lives)

A1. **Gang sells.** Readiness publishes `gangSells` (names the gang faction sells and the player does not own) and
`gangRep`. `repTarget` (player_activity_logic.js ~240) and `factionTargets` (sleeve_logic.js ~78) skip any aug in
`gangSells`. Today readiness.js ~146 drops gang rows from `workCandidates`, so neither can see them. Remove
"Bionic Arms" from `priorityAugs`.

A2. **Gang-tier install advice.** In `advise()` / `installAdvice()`: gang-faction gaps become wait candidates,
timed by the gang's measured rep rate (read `gang_status.json` `observedFactionRepRate`, x3600), not by the summed
player rate. Rules: minimum cycle 4h (the measured rebuild after an install is ~3.8h); cap 12h; advise "wait"
while the next valued gang aug is reachable within the cap and affordable at its position in the batch (1.9
step); otherwise "install". Fix the known flaw that repPerHour sums factions instead of using the aug's own
faction's rate. Keep the old behaviour for non-gang factions.

A3. **Batch stop.** `planPurchases` stops adding augs once the next one's stepped price exceeds about 2 hours of
measured cash income and its value is under a small threshold (parameters, defaults documented). Gang-sold
zero-value augs are still bought in later cycles when cheaper.

A4. **Weights.** Add `hacking_money`, `hacking_grow`, `hacking_chance`, `hacking_speed` to the run target's
`augWeights` (and `augValue` if it filters keys), so ECorp HVMind and ENM DMA stop scoring 0.

### B. Gang (coder B): `core/gang/gang-controller.js`, `core/gang/gang_logic.js`, `core/gang/gang_logic.test.js`,
`profiles/bn10/config/gang_capital_policy.json` (and `core/config/gang_capital_policy.json` defaults)

B1. **Fix `withEquipment`** (gang-controller.js ~69): it adds the gear multiplier to the stat level; it must
multiply the member's stat multiplier (project the stat with the item applied). Every projected gear gain is ~0
today.

B2. **Gear in reputation mode.** Score items by projected respect gain per dollar. Buy every hacking rootkit
(NUKE, Soulstealer, Hmap Node, Demon, Jack the Ripper) and the cha vehicles for every trained member whenever the
item costs <= 1% of cash; rebuy straight after an ascension. Skip ordinary gear for a member whose next ascension
ratio is within 0.05 of the threshold. Gang augmentations (Neuralstimulator > DataJack > BitWire, by respect per $)
from a separate budget, policy field `gangAugCashFraction` (default 0.05; BN10 0.3, because cash sits near $20b while capital_manager spends, and a $6.4b Neuralstimulator would otherwise need $128b on hand). Money
mode keeps its payback rule.

B3. **Wanted band.** Policy `reputationCleanupEnter` 0.97, `reputationCleanupExit` 0.985. Ascension penalty floor
in reputation mode = enter - 0.02. (A computed band from the marginal trade is a later step.)

B4. **Ascension.** `C.ascendAt` 1.5 -> 1.25; at least 90 s between ascensions.

B5. **Status (read-only).** `gang_status.json` adds gear counts (rootkits and gang augs owned per member, totals),
ascension count this cycle, our territory power and the strongest rival's power. No territory action.

## Acceptance metrics (measured in the first cycle after the install, against the baseline)

| # | Metric | Pass |
|---|---|---|
| M1 | Gang rep/h at zero favor: rate / (1 + favor/100), from metrics gang block, hours 1-4 after install vs baseline 89k/h | >= +40% (planners: gear +40-50%, band +6-8%, ascension +3-5%) |
| M2 | Wanted penalty, mean over the cycle | >= 0.96, cleanup mode < 15% of samples |
| M3 | Every trained member owns all 5 rootkits | within 10 min of install and of each ascension |
| M4 | Gang augs bought | Neuralstimulator on >= 6 members within 3h |
| M5 | Player and sleeve faction work on gang-sold augs | none (activity and sleeve status reasons) |
| M6 | Advisor | says "wait" while a valued gang aug is within 12h; no install advice before 4h; next cycle reaches >= 1.5m gang rep |
| M7 | No regression | all tests pass; cash rate within 10% of baseline; no script errors in 3h |

Expected at deploy (not a fault): at 16:26 seven members were already past x1.25 (x1.28-x1.48), so the new
controller ascends about seven in a row, at least 90 s apart, each followed by a rootkit rebuy. Only one
ascension was logged 16:20-16:26 under the x1.5 rule (...4767 x1.50 at 16:19; multipliers now x16.7-x28.8).
The new scripts start after the install, so no ascension lands just before it (the install cuts ascension
points by 5%).

## Deploy

At NiteSec >= 550k this cycle: merge `gang-planner` into main, push changed scripts (daemon sync), restart
gang-controller, augmentation_readiness, player and sleeve controllers, then run the install per STATE (backup
first). Remove the STATE install hold in the same commit as A2. Record results in STATE and here.

## Review notes (2026-11-09, before merge)

- Coder A left the advisor's cash rate unwired (money only). Wired from `gang_status.json`
  `capital.observedCashRate` (fresh within 10 min); falls back to money only.
- BN10 `gangAugCashFraction` raised 0.05 -> 0.3 (see B2). `planReputationGear` keeps a running balance.
- Not covered by tests: the controller wiring (gear loop, ascension cooldown, status fields). Watch the first
  minutes after deploy: `gang_status.json` `equipment.boughtItems`, `gearTotals`, `ascensionCount`.
- A3's batch stop is in `planPurchases` but `aug_install.js` still calls it with defaults (unchanged behaviour).
- 563 tests pass in the staged bn10 copy.

## Deployed 2026-11-09 18:15 (install 3, BN10 run 2)

Merged 47b5559; install at 18:15 with NiteSec 617k (4 augs + 2 NeuroFlux; cash ran out). Favor after: 171, so the
M1 zero-favor rate is the measured rate / 2.71. First check 18:18: wanted recovery under the 0.97/0.985 band (penalty
0.953 rising), 12/60 rootkits, advisor "wait" for the 4h minimum. Results go here.

Check 2026-11-09 20:15 (2-hourly task, cycle 1.9h): penalty 0.989, not in cleanup (M2 on track); 60/60 rootkits
(M3 met); 36 gang augs bought (M4 met if Neuralstimulator is among them, not checked per item); 20 ascensions, last
x1.25 at 20:14. NiteSec rep 1.35m; measured 870k/h (12 samples 19:15-20:10), so M1 about 321k/h at zero favor vs
89k/h baseline (+260%). Cash 41.6b/h measured. Advisor "wait" for the 4h minimum (M6 on track).

Install 4, 2026-11-09 22:17 (2-hourly task, cycle 4.0h): NiteSec rep earned this cycle 3.5m (M6's >= 1.5m met);
measured 1.16m/h in the last hour (12 samples 21:15-22:10), about 428k/h at zero favor (M1 met). Advisor "wait" only
for the 4h minimum, never early (M6 met). Cash, not rep, limited the batch: 3 augs for $80b. NiteSec favor 171 ->
about 258 after the install.
