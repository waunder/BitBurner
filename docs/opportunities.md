# Opportunities and flaws

Running list kept by Claude on its own initiative (Ken, 2026-11-16: "exercise initiative in searching
for flaws and opportunities"). Newest first. Each entry: finding, evidence, expected gain, status.
The 2-hourly check reviews this once per cycle (first run after an install).

## 2026-11-18 03:15 check (BN10 run 4)

- **By-value install plan was always empty.** Evidence: `installPlan` [] at $1.95b with Neurotrainer III ($0.65b, 0.128), Combat Rib I and others rep-ready; readiness called `planPurchases(..., { byValue })` before `advise()` set `value` on the candidates, and `selectByValue` skips offers without one. Knock-on: gang `reserveInstallPlan` reserved $0, so gang gear took $1.95b of this cycle's late earnings (B1 49%); advisor saw batchValue 0. Gain: the batch keeps its cash (~$1-2b per cycle), aug_install's `planByValue` path buys a real batch, and the advisor judges a real batch. Status: shipped 03:17 (`augValuer` in augmentation_readiness.js); live plan 5 augs $1.73b, value 0.27; gang cashBudget $19.6m. Closes "Gang reserve reads an empty plan" below.
- **Advisor ignores cash-limited gains.** Evidence: it says install at 0.27 because the next rep-gated aug (Bionic Arms) is slow, but Bionic Legs (0.188, $1.875b) is rep-ready and only cash-gated; ~2h of cash lifts the batch to ~0.45. Gain: better install timing in cash-limited cycles. Status: open; judged by hand each run; a fix would add "value per hour of waiting for cash" from cash/h and the by-value plan at projected cash.

## 2026-11-18 01:15 check (BN10 run 4, cycle review after install 2)

- **No sleeve augmentation bought in cycle 3.** Evidence: `sleeve_buyer_status.json` last purchase ~19:02 (cycle 2); in cycle 3's early phase (23:16-00:46) capital_manager made 50 buys for $338m (48 cloud upgrades, ~$7m each), so cash never reached a sleeve batch (a non-fresh sleeve needs its 3 cheapest, ~$25m, at batch share 0.5 = ~$50m). Cycle 2 bought 21 augs for $148m. Gain: every sleeve's stat multipliers for the whole cycle (5 sleeves on Mug for money, 2 on faction rep) for ~$150m that would otherwise be ~20 cloud upgrades. Status: shipped 01:40 (`sleeveAugHold` in sleeve_buyer_logic.js, published as `augHold`; `sleeveAugHoldFrom`/`holdsCloudFor` in capital_logic.js; capital_manager saves on cloud buys under the hold; cap `sleeveAugHoldMax` $150m, 0 off; 2 tests, 656/656). Live: both restarted, late phase so hold 0. Check after install 3: sleeve purchases in the first 1.5h.
- **Gang reserve reads an empty plan.** Evidence: with `planByValue`, `installPlan` is empty at $450m (nothing affordable yet), so the gang's `reserveInstallPlan` reserves $0; the allocator meanwhile projects a $15.3b batch (ABN + INFRARET) at ~9.9h. Gang gear spent $79m in 48 buys this cycle, so small so far. Gain: keeps the batch cash if gear prices climb. Status: closed 2026-11-18 03:17: cause was the empty by-value plan (values set after planning); fixed.
- **Cycle comparison.** Cycle 3 at 1.9h: Slum Snakes rep 589k (300k/h measured, favor 127 banked at install 2) vs 284k in all of cycle 2 (5.6h). Cash/h 120m measured (MCP rebuilding, hacking 125). Rep is far ahead of cash; Slum Snakes augs are cash-gated.

## 2026-11-17 23:15 check (BN10 run 4, install 2)

- **Install plan chosen by value (open item "Interim install plan is dearest-first").** Evidence at 23:14: `installPlan` ADR-V2 + SmartSonar, value 0.14 for $3.46b, while Bionic Spine, Nanofiber Weave, Neurotrainer II and NutriGen were rep-ready for 0.54 at $2.71b (installed by hand via `priorityAugs`). The gang reserves `installPlan.cost`, so it also guarded the wrong batch. Change: `selectByValue` + `planPurchases(..., { byValue })` in aug_install_logic.js (greedy on value added per extra ladder cost, prerequisites kept, value 0 never added); readiness uses it when `planByValue` is true (bn10 config); aug_install.js buys the readiness plan when `priorityAugs` is empty, falling back to the plain plan if that is empty. Replayed on the 23:14 offers: $0.9b 0.37 (was 0.20), $2b 0.49 (0.07), $3.48b 0.53 (0.14), $8b 0.68 (0.14). Status: shipped 23:25, 654/654; not yet seen choosing a live batch (cash $3m after the install). Revert: `planByValue` false.
- **Gang absorbs all cash above the plan.** Net cash/h fell to 31.9m in the last hour while income was 478m/h: gang gear spent $5.53b this cycle (B1 60%). With the plan now chosen by value it may be smaller, which lets the gang spend more. Question for next cycles: is that gear worth it against a larger batch? Watch `metrics.py spend` B1 and gang rep/h; status open.

## 2026-11-17 21:15 check (BN10 run 4, cycle 2 at 3.5h)

- **Home RAM refused while a resident waited (Spending review item b).** The necessity rule saw demand only; a waiting resident that does not fit in free home RAM (after MCP's and the advisor's holds) can leave demand under the 0.5 floor. Gain: no resident left down for want of a home step the late cap allows. Status: shipped 21:17 (`blockedResidents` in capital_logic.js; capital_manager publishes `homeBlocked` and treats it as need, still under the late-cycle limit; allocator verdicts and grants treat it as necessity; 2 tests; 651/651). Live: `homeBlocked` [] (nothing waiting), demand 0.57. Home RAM stays `own` in valuation_flags until a blocked case shows up in the shadow log.
- **Gang money mode is not worth it now.** Evidence: `gang_status.json` 21:15 `projectedMoneyRate` 592 (at most ~$2-11m/h however the unit reads) against cash/h 1.4b (measured, 24 samples); gang rep 25.7k/h. Gain of switching: under 1% of cash. Status: closed; the gang stays on reputation (auto) toward Slum Snakes augs.
- **Gang gear attribution confirmed.** `allocator_shadow_log.txt` has `source: gang` rows (gang_gear: grant/sweep with cost and free cash) since 19:18. Gang gear now buys only above the install plan (cash $2.62b vs plan $2.61b). Next allocator step: move gang gear to "valued" after a cycle of rows.

## 2026-11-17 19:15 check (BN10 run 4, cycle review after install 1)

- **Gang rep is no longer the limit; cash is.** Evidence: Slum Snakes rep 18.2k/h (`metrics.py summary --window 90`, 18 samples) and 29.2k earned in the first 1.5h of cycle 2, against 849 in the whole 19.9h cycle 1 (`metrics.py cycles`); 11 members on Terrorism. Cash/h 19.1m (same window; MCP rebuilding after the install), cycle 1 averaged 241m/h. Slum Snakes augs start at $1.25b each (x5 BN10, x1.9 ladder). Gang objective `auto` stays on reputation until rep covers all 3.5m, about 7 days at this rate. Gain: switching the gang to money once rep covers the next affordable batch could add a large share of cash/h (the gang's money rate is unmeasured in BN10 so far). Status: open; next check compare `projectedMoneyRate` with cash/h once MCP has rebuilt, then consider a rep-vs-cash balance rule in place of the 3.5m bar.
- **Gang purchases were invisible to the allocator between its passes.** Evidence: `newPurchases` read only `equipment.boughtItems` from the latest gang update; the gang updates every ~2 s, the allocator far less often, so most gear buys showed up as "unattributed" ($2.79b of gang spend in cycle 1, `metrics.py spend`). Gain: gang spend judged per purchase, the step before moving gang gear to "valued". Status: shipped 19:18 (`purchases` log of the latest 100 in `gang_status.json`; `newPurchases` reads it; test added; gang-controller.js and allocator.js restarted). Next: confirm attributed gang rows in `allocator_shadow_log.txt`.
- **Six sleeves on Shoplift after the install.** Evidence: `sleeve_status.json` 19:16, sleeves 1-6 "crime for money: no unclaimed faction rep target"; sleeve stats reset at the install, so Mug's odds fell below Shoplift's money/s. Gain: small (sleeve crime money is minor). Status: watch; expect Mug as stats return. The sleeve buyer did buy 21 augs ($148m) in the early phase.
- **aug_install.js paid 2.4GB for a variable named `share`.** Status: shipped (renamed `cashShare`; 52.65GB -> 50.25GB).

## 2026-11-17 13:15 check (BN10 run 4, hour 15.5)

- **Grafting is cash-gated, not code-gated, for now.** Evidence: `graft_catalog.json` 13:17, 98 rows; the best no-prereq combat grafts cost $9.75b-$14.6b (SPTN-97 $14.6b, 0.58 net/h) against $2.54b cash and 378m/h (24 samples). Gain: SPTN-97 is +75% to every combat stat toward the Covenant's 850, so worth the first graft once cash allows after the batch. Status: G3 done; G5 dry run next, so the controller's verdicts are reviewed before cash is there.
- **Recruit hold confirmed.** Evidence: 9 members at 13:18; hold released (next recruit 78k), ascension resumed. Status: done.

## 2026-11-17 11:15 check (BN10 run 4, hour 13.5)

- **Gang ascensions eat the respect that recruits need.** Evidence: respect 7.05k (09:15) -> 7.30k (11:14), net ~+125/h, while gross gain is 0.208/cycle (~3.75k/h); 4 ascensions in that window (16 -> 20), each deducting ~1.7k. The 9th recruit needs 15.6k (thresholds 5^(members-2): 10th 78k, 11th 391k), so with an ascension at x1.25 about every 30 min the gang stayed at 8 members. Gain: 9th member about 13:30 instead of never (+1/8 respect and money throughput until install); ascensions resume once the next recruit is over 3h away (10th at 78k is ~19h). Status: shipped 11:18 (`recruitHoldHours` 3 in bn10 gang policy, `recruitHoldsAscension` in gang_logic.js, test added, 645/645 pass); `gang_status.json` 11:18 `recruitHold` true. Measure next run: members 9, respect/h, ascensions resumed. The Train Combat A/B (07:15 entry) stays open behind this.
- **First-cycle sleeve augs: decided not to open the window this cycle.** Evidence: sleeve shock 0 at 11:14 (all 7); `sleeve_buyer_status.json` wants 70 augs, $1.27b; cash $1.74b at 318m/h (24 samples); the first install is cash-limited (advisor: 8 augs ready by rep, ~$4.25b at 09:15; verdict wait, HemoRecirculator in 47m). BN10 installs wipe sleeve augs; 5 sleeves run Mug for money (odds already 1.0), 2 run faction rep. Gain of buying: unmeasured sleeve rep/money uplift for one cycle. Cost: ~4h of cash, so the install (which resets the price ladder and banks favor) slides by about 4h. Status: declined this cycle; buy by the early-cycle rule right after the first install. Revisit if the first install is still >10h away at 15:15.

## 2026-11-17 07:15 check (BN10 run 4, hour 9.5)

- **Gang faction rep is ~44/h against 3.5m needed.** Evidence: `gang_status.json` 07:16 respect 3.3k, gain 0.149/cycle, faction rep 56 (rep = respect/75), 7 of 8 members on Mug People at combat ~38, 11 ascensions at x1.25. Gain: the gang faction sells most augs; at this rate it never gets there without member growth. Status: open; 09:15 reading respect 7.05k (~1.9k/h), faction rep 158 (~58/h). Next: compare respect/h over the next two checks; if it stays under ~10k/h, A/B more members on Train Combat (stats feed every later respect task) before respect tasks.
- **MCP home-reserve fix confirmed.** Evidence: MCP 3x60m 764>9.22k>105k/s, 57k/s now (24 samples). Status: done.

## 2026-11-17 05:15 check (BN10 run 4, hour 7.5)

- **MCP's cloud path reserved a fixed 512GB of home, so a 512GB home gave it nothing.** Evidence: `mcp_status.json` 05:18 `capacity-wait`, rate 0, home 232GB free but `availableRam` 4.5GB on every waiting target; MCP 3x60m trend 10.3k>6.19k>764/s; `HOME_WORKER_RESERVE_GB=512` in `mcp_cloud.js` (set for BN15's PB home). Gain: about 100-200GB more batch RAM on home (MCP's main pool in early BN10, no cloud servers), and home RAM buys now feed MCP. Status: shipped 05:20 (`homeWorkerReserve`: quarter of home, 64GB floor, 512GB cap; test added). After restart, 104GB of jobs on home, phase harvest. Measure MCP rate next run.
- **gang_create.js durable start** (from 03:15) is still open; the gang now exists, so it matters again only in the next node.

## 2026-11-17 03:15 check (BN10 run 4, hour 5.5)

- **gang_create.js is not started on a fresh-node bootstrap.** Evidence: game `ps` 03:15 had every resident but gang_create.js; it is only in `startup.js`'s list, and capital_manager starts MANAGERS plus the profile startup list. Karma -35k, gang due ~05:25. Gain: gang created on time instead of whenever a session notices. Status: started by hand 03:16. Durable fix (open): have capital_manager launch gang_create.js while karma > -54k and no gang (it exits by itself once the controller runs, so a plain MANAGERS entry would relaunch it every pass), or add it to the bn10 profile startup list with a guard.

## 2026-11-17 01:15 check (BN10 run 4, hour 3.5)

- **First cycle of a node is already "late", so sleeve augs would wait for the first install.** Evidence: `capital_status.json` and `sleeve_buyer_status.json` `cyclePhase` late at hour 3.4 with 0 installed (`earlyCycleHours` 1.5 counts from node entry); sleeve buyer `limits.wiped` 0. Sleeve shock 18.3, falling ~1.9/h, so sleeves can buy augs in ~9-10h, likely before the first install (advisor: nothing until Wired Reflexes in 7.5h, gang at ~06:00). Gain: lesson 6 says sleeve augs early pay well (BN6: 7 sleeves x 6 augs for $0.71b, odds held); sleeve Homicide odds are 0.25 now. Status: open; check before shock hits 0 (~10:00) and, if no install is near, let the first cycle count as early until the first install or until the batch exists.
- **Karma rate measured.** Evidence: karma/h -7.67k (23 samples, 120 min) with `karmaFirst`; karma -1.8k -> -17.1k in 2h. Gain: gang at about 06:00 PC clock. Status: shipped last run, working.

## 2026-11-16 23:15 check (BN10 run 4, hour 1.5)

- **Player did rep work while gang karma waited.** Evidence: player on Slum Snakes field work for Wired Reflexes ($12.5m, value 0.04) at karma -1.8k; karma crime is the last fallback in `choosePlayerActivity`; player Homicide odds 0.52 (~1.85k karma/h, ~$21m/h). Gain: roughly +30-40% karma rate toward -54k, so the gang (main money and rep loop) arrives hours sooner. Status: shipped (`karmaFirst` config flag, BN10 only; test added). Measure karma/h next run.
- **game_terminal.py returns no output once the terminal hits its line cap.** Evidence: `ok:true, output:[]` for every command; `audit.py` reported "terminal unreachable"; `clear` fixed it. Gain: checks stop misreading the game as down. Status: open; small fix is to diff by last line, or clear when the line count does not grow.
- **sleeve_buyer and sleeve_controller do not fit on 128GB.** Evidence: 9.5GB free; sleeves have no augs in their cheap early window (lesson 6). Gain: sleeve Homicide odds ~0.2 rise with combat augs. Status: waits on home 256GB ($151m, capital_manager saving).

## 2026-11-16 17:15 check

- **Black-op bar too timid once rank is no longer the limit.** Evidence: rank 468k vs Centurion's 300k; low-end odds 0.41-0.48 under the 0.6 bar, so the controller farmed Assassination for ~45 min instead. Gain: the remaining black ops (Centurion, Vindictus) clear in about 20 min each instead of waiting on skill points. Status: shipped (game-only `blackOpMinChance` 0.35); check the event log for SUCCESS/failed and HP.
- **Bladeburner success augs for the final op.** Evidence: Daedalus odds 0.36-0.42; Bladeburners rep 2.6m opens every Bladeburner aug, cash $12.7b. Gain: higher Daedalus odds if Ken wants them before ending. Status: for Ken at the end call (install costs ~2h of stats).

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

- **Darknet push (Ken, 2026-11-17: "see how far you can push darknet's contribution").** Live on the PC since 13:35. Stage 1:
  gateway recrawls spread one level (3 managers). Stage 2 (14:13): spread levels (`MAX_SPREAD_LEVEL` 2), manager cap 16 after
  16 ran under a cap of 8 with the renderer at <=19% of one core. Fixes on the way: one root and one manager per host (the
  capital_manager restart raced hand restarts), recrawls pass the generation, the registry counts every heartbeating manager
  (15 at 15:10). Darknet $/h: ~35m before; ~350m over 14:05-15:05 (hacking 393m); 500m/h peak. CPU log runtime/cpu_watch.csv.
  **Next stage (for the 2-hourly check):** after one steady hour at 16, raise `MAX_SPREAD_LEVEL` to 3 to reach deeper,
  higher-RAM, better-paying hosts; then the cap to 24. Each stage: compare darknet $/h over an hour and the renderer peak;
  step back if the renderer passes ~60% of a core or the Remote API slows past 3 s.

- **Darknet review (Ken, 2026-11-17: "always an earnings disappointment").** Source (v3.0.1 `src/DarkNet/effects/phishing.ts`,
  `cacheFiles.ts`, `labyrinth.ts`, `BitNode.tsx`): money = direct phishing hits (x threads, x (0.1 + 0.05 x depth), x charisma,
  x BitNode `DarknetMoneyMultiplier`) plus money caches (global 3-min cooldown, ~1 in 4-5 caches is money). Node multiplier:
  1.0 in BN1/2/6/7/11/14/15, 0.7 BN5, **0.4 BN10**/BN3/BN4, 0.1 BN13, 0.05 BN9, 0 BN8. SF15.2: auth 20% faster, charisma boosts
  salary/rep; SF15.3: cache money x1.5. No node or SF makes it a main engine. **Our structural miss:** the only live manager is on
  `darkweb` (depth 0: payout factor 0.1 vs up to 2.1 at depth 40; 8.5GB free = 2 phish threads), so `MAX_PHISH_THREADS` 2 is not
  the binding cap; deep, high-RAM hosts (RAM 16 x 2^floor(difficulty/6) GB) earn nothing. **Labyrinth blocked on charisma**: found
  at depth 6 (`dnet_lab_status.json`: needs 300, player 144). Labs give The W1ngs of Icarus, Boots, Hammer, Staff, Law, Sword
  (charisma, darknet money up to ~2x combined); cha gates 300/600/1500/2500/3000/3500; the Red Pill from a later lab.
  Decision 2026-11-17: **not now in BN10** (0.4x money; Leadership would pull the player off install rep; `charismaTarget` stays 0).
  Revisit (a) after the Covenant gate, with `charismaTarget` 300 for the first lab, and (b) in a 1.0x node: a supervised
  experiment placing one manager on the deepest high-RAM host with RAM-sized phish threads (the freeze-sensitive dial is manager
  count and fan-out, not threads). Status: parked with a plan.

- **Spending review (Ken, 2026-11-17: "different bitnodes, different spend").** Income vs spend per cycle ($b):
  BN6 c2 hacking 43.9 / servers 46.9; c3 9.2 / 11.7; c4 130.7 / 90.1 (+ gang 62.1); c5 210.8 / **317.2**. Cloud RAM lost money
  in BN6 (hacking x0.35, server money x0.2): ~$466b of servers for ~$395b of hacking. BN10 run 3 servers $7.5t returned
  $1.5q+ of hacking. The shadow allocator judged both right: BN6 c5 it refused $276b of cloud RAM ("returns 0.000 v"),
  BN10 run 3 it granted all $41.7t. **Done 2026-11-17:** cloud RAM obeys the allocator (R2 wired into capital_manager via
  `grantFor`; game-only `valuation_flags.json` cloud_ram "valued"; set "own" to undo). Still open in the allocator:
  (a) gang spending is "unattributed" (98 passes, $12.7b in BN6 c5): gang-controller's purchases are not recorded where
  the allocator reads them, so gang spend is never judged; (b) home RAM refused as "zero-value" ($477m) while residents
  waited for RAM: the necessity rule misses unstarted scripts (fixed 2026-11-17 21:17: `homeBlocked`). (a) fixed 19:18 (`purchases` log). Next kinds to move to "valued": gang gear, then home RAM.

- **Early-crime chooser for fresh BitNodes** (Ken, 2026-11-16). player_activity_controller.js (36.8GB) cannot fit on a
  32GB fresh home, so BN10 run 4 sat ~50 min on Shoplift (str/def 1; Shoplift trains only dex/agi; karma 0.05/s).
  Build a ~12-16GB one-shot loop (getCrimeChance 5GB, commitCrime 5GB, sleeve setToCommitCrime 4GB) that steps player
  and sleeves Shoplift -> Mug -> Homicide by money and karma per second, and exits when the controllers fit.
  Gain: karma (the gang gate) an hour or so sooner per fresh BitNode. Status: to build before the next BitNode.

- **Install 4 cost no rank/h; installs are cheap in BN6** (2026-11-16 13:15, cycle review). Rank (metrics log):
  41.7k at 10:50, 48.8k at 11:20, 69.6k at 12:20, 103.7k at 13:15. Rank/h was ~8.8k/h over 08:20-10:50 and is
  36k/h now (bladeburner_status, 1h window). Strength fell 492 -> 259 at the install and was back to 444 in two
  hours; Assassination stayed at 0.98-1.00 odds. Rank/h rises with rank itself (skill points: Blade's Intuition
  95, Cloak 91; ops and black ops unlocking), so the dip the 09:15 plan feared did not show. Expected gain:
  shorter cycles once a worthwhile batch is affordable, so combat and Bladeburner augs compound sooner.
  Status: weigh at each install decision; no code.
- **Interim install plan is dearest-first, not by value** (2026-11-16 13:15; shipped 2026-11-17 23:25 as `planByValue`, see that check). With $0.94b and empty
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
