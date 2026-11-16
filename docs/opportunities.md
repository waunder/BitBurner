# Opportunities and flaws

Running list kept by Claude on its own initiative (Ken, 2026-11-16: "exercise initiative in searching
for flaws and opportunities"). Newest first. Each entry: finding, evidence, expected gain, status.
The 2-hourly check reviews this once per cycle (first run after an install).

## 2026-11-16 15:15 check

- **More infiltrators while counts are low.** Evidence: counts 8-20, start bar 20; 3 of 7 sleeves on Homicide for money, 1 on Speakers rep for a value-0 aug. Gain: ~1.4x count refill (sqrt law), more sleeve contracts and player ops. Status: shipped (game-only `maxInfiltrators` 4), measure rank/h and counts next run. Next idea: let sleeve 0 drop value-0 faction targets.
- **Cash near the node end.** Evidence: capital manager buys cloud at ~$16b/h late in the cycle (B1 82.8%); no further install planned before Daedalus (~4h). Gain: if Daedalus odds are low at rank 400k, a last install of Bladeburner augs (BLADE-51b, ORION-MKIV, GOLEM Serum, Vangelis, Hyperion, EsperTech; Bladeburners rep 922k covers all) needs ~$30b+ with price escalation. Status: open; Ken's end-of-node call. Consider pausing cloud buys once rank passes ~350k.
- **Advisor blind to the node end.** Evidence: verdict install with 3 augs while Daedalus is ~4h away. Gain: avoids a reset that costs ~2h of stats near the finish. Status: open (judgement covers it this time).

## Sequence (2026-11-16 08:30)

One build at a time; each lands, gets measured, then the next starts. Quick fixes found on the way go in
at once. Measurement-only items run in parallel because they need no code.

1. **Sleeves as a team** (now): more infiltrators to refill contract counts, so all seven sleeves can work
   contracts; joint assignment. Biggest immediate rank gain: ~3 idle-for-rank sleeves.
2. **Gang gear matched to combat** (small, next): stop buying rootkits for Slum Snakes.
3. **Daedalus route model** on the run page: black-op gates, rank curve, finish date.
4. **Optimizer**: expected rank/s with failure costs; replace the remaining fixed bars.
5. **Experiments** that run themselves (stamina band first).
6. **One currency**: rank-hours to Daedalus for money, sleeve time, installs.

Measuring alongside (no code): city-hop and black-op effect on rank/h; the next install's dip and recovery;
first sleeve augmentation batches; gang power after gear.

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

- **Install 4 cost no rank/h; installs are cheap in BN6** (2026-11-16 13:15, cycle review). Rank (metrics log):
  41.7k at 10:50, 48.8k at 11:20, 69.6k at 12:20, 103.7k at 13:15. Rank/h was ~8.8k/h over 08:20-10:50 and is
  36k/h now (bladeburner_status, 1h window). Strength fell 492 -> 259 at the install and was back to 444 in two
  hours; Assassination stayed at 0.98-1.00 odds. Rank/h rises with rank itself (skill points: Blade's Intuition
  95, Cloak 91; ops and black ops unlocking), so the dip the 09:15 plan feared did not show. Expected gain:
  shorter cycles once a worthwhile batch is affordable, so combat and Bladeburner augs compound sooner.
  Status: weigh at each install decision; no code.
- **Interim install plan is dearest-first, not by value** (2026-11-16 13:15). With $0.94b and empty
  `priorityAugs`, `installPlan` is FocusWire ($900m, value 0.06) + Neural Wit Amplifier (value 0), while Bionic
  Spine ($125m, 0.56), Combat Rib I ($24m, 0.19), Augmented Targeting II, Neurotrainer II/III, Bionic Legs
  ($375m, 0.47) are rep-ready. The gang's gear cap reserves `installPlan.cost`, so it guards the wrong batch.
  A long `priorityAugs` list is not a fix: `planPurchases` picks nothing when the whole list cannot be reserved,
  which empties the plan and lifts the gang cap. Fix: order picks by value per cost (or value, then price),
  keeping the 1.9 step and prerequisites, with tests. Expected gain: a better interim batch and a correct gang
  reserve. Status: open; needs a tested change to `aug_install_logic.js` (it also drives real installs).
- **Checked and rejected: late-cycle cloud RAM loses money** (2026-11-16 13:15). Cycle 3 spent $90.1b on cloud
  and earned $127.5b hacking; buying stopped at 07:50 at 52k GB. Net positive, so `lateCloudDemandFloor` stays 0.5.

- **Leftover sleeves on money crime** (2026-11-16 11:15). With 3 contract types (one sleeve each) and at most 2
  infiltrators, 2-3 sleeves fall to Mug; at 11:15 Tracking (13 < 20) idled a third. Options: a third infiltrator
  (refill grows as sqrt(n): +22%, and op counts feed the player's Assassination), Diplomacy when city chaos rises,
  or sleeve Training for black-op odds. Evidence needed: Mug $/h per sleeve vs value of counts. Status: open;
  measure after the post-install cycle review.
- **Sleeve buyer logs `name` as missing for aug purchases** (11:04-11:11 entries show no name). Minor, logging only.
  Status: to fix when next in sleeve_buyer.

- **Sleeves idle ~90 s after an install**: the controller assigned faction work from the pre-install readiness file
  (factions not yet rejoined) and the game threw. Self-heals when readiness refreshes; a membership guard would
  close it. Minor. Status: to fix when next in sleeve code.

- **Gang gear choice for a combat gang.** Since equipment buying came on (2026-11-16 08:10) the controller also
  buys rootkits (hacking gear) for Slum Snakes, whose members do combat tasks. Cheap (1% cap) but likely
  wasted; weight gear by the stats the members' tasks use. Status: to fix.
- **Territory.** Gang power 1 vs strongest rival 1874; territory flat at 14%. Once gear lifts power, turn on
  territory clashes (policy `territoryEnabled`) when win chance is high. Status: watch power.
- **Gang spending vs the install batch** (2026-11-16 09:15). Gang expenses $26b in the hour after equipment buying
  came on (respect 48k -> 579k, Slum Snakes rep/h 35.7k). Cash $11.2b vs a $13.5b batch plan. Gang augs persist
  through installs, so not wasted, but they now set the batch size. Decide before the install whether to pause
  gang buying for the last hour of a cycle. Status: to weigh at the install.
- **Cash sets the size of each install batch** (corrected 2026-11-16, Ken). The next augmentation waits on rep,
  but the batch is cash-limited: at 09:00 the install plan cost $13.5b (4 augs) against $9.9b cash, and all
  22 offered would cost ~$96t because each purchase raises later prices. The money panel's "spare" is only
  cash left after the rep-ready augs. So every outlet (gang gear 1%/item, sleeve augs ~$0.7b/cycle, servers)
  competes with batch size; servers roughly pay for themselves. Status: weigh in the one-currency model.
- **Sleeves idle on contracts for lack of counts.** (2026-11-16 09:17: a near-empty contract no longer holds a sleeve idle; leftover spare sleeves infiltrate, up to 2. Measure Retirement/Bounty Hunter counts and rank/h over the next hours.) By 08:00 every sleeve had 92%+ contract odds, but only
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

- 2026-11-16 **Gang spent $59b in cycle 18, 6x the install batch, for zero territory power.** Gear does not raise
  power (only Territory Warfare does). Gang gear now spends only cash above the install plan (`reserveInstallPlan`),
  gang augs 5% of cash, a combat gang buys rootkits only on respect gain (ed99b83).

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
