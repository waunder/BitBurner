# Opportunities and flaws

Running list kept by Claude on its own initiative (Ken, 2026-11-16: "exercise initiative in searching
for flaws and opportunities"). Newest first. Each entry: finding, evidence, expected gain, status.
The 2-hourly check reviews this once per cycle (first run after an install).

## Bigger ideas (2026-11-16, Ken: "I want to see your imagination at work")

- **Optimize, don't threshold.** Replace bladeburner.js's fixed bars (0.8 odds, rest at 55% stamina) with
  expected rank per second: chance x rank gain / time, minus what a failure costs (stamina, HP, chaos).
  The controller already measures every input. Let the data pick the bar.
- **One currency for the whole run.** Value money, sleeve time, stamina and skill points in "rank-hours
  to Daedalus". Then sleeves on money crime vs contracts, sleeve augs vs RAM, and install timing are all
  the same question. Builds on the BN10 shadow allocator (docs/allocator-design.md).
- **Sleeves as a portfolio.** Assign all seven together (best total), not one at a time: e.g. one sleeve
  on Diplomacy keeps chaos down so the others' odds rise; one infiltrates to refill counts the rest use.
- **Run experiments, not guesses.** Alternate a policy by the hour (stamina band A, then B) and let
  metrics decide. docs/experiments.md exists; automate the switching and the verdict.
- **Self-calibration.** Log estimated odds vs actual successes per action; if the game's estimate is
  biased, correct for it.
- **Plan backwards from Daedalus.** The black op chain has fixed rank gates; model the route (skills such
  as Overclock that shorten action time, city population, count refills) and show the ETA as a curve,
  not one number.
- **A run page for Ken.** A live chart of rank, odds and cycles he can glance at instead of the HUD.

## Open

- **Gang gear choice for a combat gang.** Since equipment buying came on (2026-11-16 08:10) the controller also
  buys rootkits (hacking gear) for Slum Snakes, whose members do combat tasks. Cheap (1% cap) but likely
  wasted; weight gear by the stats the members' tasks use. Status: to fix.
- **Territory.** Gang power 1 vs strongest rival 1874; territory flat at 14%. Once gear lifts power, turn on
  territory clashes (policy `territoryEnabled`) when win chance is high. Status: watch power.
- **Cash has few uses in BN6.** Augmentations are rep-limited ($14.5b spare after ready augs). Outlets: gang
  gear (now on), sleeve augs (next install), home RAM. Server spending (~$90b/cycle) roughly equals the
  hacking+darknet income it produces, so it pays its way. Status: answered 2026-11-16; revisit with the
  one-currency model.
- **Sleeves idle on contracts for lack of counts.** By 08:00 every sleeve had 92%+ contract odds, but only
  one sleeve may run each contract and Tracking was down to 1 count, so three sleeves did faction work and
  one crime. More infiltrators would refill counts for more contract sleeves. Part of "sleeves as a team".
- **Install cadence in BN6.** Installs keep Bladeburner rank and skills, so the usual cost of an install
  is lower here; more frequent installs may compound stat multipliers faster. Evidence needed: rank/h
  before and after each install (`metrics.py cycles` once rank is logged). Status: to measure.
- **Bladeburner skill value model.** Points went to Reaper, Evasive System and Cyber's Edge as well as the
  weighted skills; check the value-per-point weights against measured success-chance gains. Status: to review.
- **Stamina rest thresholds (0.55 / 0.95).** Unmeasured share of time spent in the regeneration chamber;
  a narrower band or Training while low might earn more. Status: to measure.

## Done

- 2026-11-16 **Gang bought no equipment all run.** BN6 had no gang_capital_policy.json, so the core default
  (BN2-era "stop gang equipment purchases") applied. Added a BN6 policy; buying started at once.
- 2026-11-16 **Half the player's Bladeburner time on Diplomacy.** Assassination pushed chaos past 50; now moves
  to a calm city instead (f1bb959). **Black ops stalled** under a 0.9 bar: lowered to 0.6; Typhoon and Zero
  succeeded at 0.68 and 0.72 within minutes.
- 2026-11-16 **Sleeve augmentations never bought in BN6** (Ken's question). sleeve_buyer.js exited outside
  BN10. Fixed f4d8ecd; then per-sleeve batches, combat list, contract-odds priority (cbb0d37). Measure
  sleeve odds and rank/h next cycle against this one (baseline: no sleeve augs).
- 2026-11-16 **Bladeburner rank and sleeve tasks now in metrics_logger** (8a1aba9); the run page charts them.
- 2026-11-16 **Nothing read script status files.** tools/audit.py added (b916843) and put in the 2-hourly check.
- 2026-11-16 **Two crawler.js copies running.** crawler.js now replaces older copies (5b226f2).
