# Grafting: how it works and how to automate it

Written 2026-11-16 for BN10 run 4. Nothing here is built or run yet; this is research and a coding
schedule. All rules below are from bitburner-src tag **v3.0.1** (the tag exists; the same files on
`dev` were not needed). Base URL for every link:
`https://github.com/bitburner-official/bitburner-src/blob/v3.0.1/src/`.

## 1. How grafting works (plain version)

Grafting buys an augmentation with money and player time instead of faction reputation. It is
open to us because SF10 is owned (`canAccessBitNodeFeature(10)`, `PlayerObjectGeneralMethods.ts`
`canAccessGrafting`), and we are in BN10 anyway.

- **No faction, no rep, no favor, no invite.** Any augmentation that is not "special" and that we
  do not already own or have queued can be grafted, including ones from The Covenant, Illuminati,
  Daedalus, ECorp and so on. Special ones are not graftable: **The Red Pill**, **NeuroFlux
  Governor**, the Bladeburner set (unless in Bladeburners), Stanek's Gift, Shadows of Anarchy, the
  Hyperion/Vangelis/ZOE/INTERLINKED/Orion/Golem/EsperEyewear/EMS-4 group and Big D's Brain
  (`isSpecial: true` in `Augmentation/Augmentations.ts`; filter in `PersonObjects/Grafting/GraftingHelpers.ts`
  `getGraftingAvailableAugs`). Prerequisites still apply (`hasAugmentationPrereqs`, installed or queued
  counts), so Graphene Bionic Spine needs Bionic Spine first.
- **You must stand in New Tokyo** (`Grafting.ts` `graftAugmentation`, throws otherwise). Travel is
  $200k (`Constants.ts` `TravelCost`, `singularity.travelToCity`). Nothing else we do needs a particular
  city except the gym and university (Sector-12), so each graft costs up to two $200k trips.
- **Price** = `baseCost x 3` (`GraftableAugmentation.ts` `cost`; `Constants.ts` `AugmentationGraftingCostMult: 3`).
  It uses the augmentation's *base* cost only. It ignores the BN10 x5 augmentation money multiplier and the
  1.9x ladder for queued augmentations (`AugmentationHelpers.ts` `getAugCost` applies both to faction
  purchases, not to grafts). A faction buy in BN10 costs `base x 5 x 1.9^k` (k = augs already queued),
  so a graft is 40% cheaper than the first faction aug of a batch and far cheaper than the 5th or 6th
  (about 20x to 40x cheaper). The money is taken when the graft starts and is **not refunded** on cancel.
- **Time** = `(3,600,000 ms x log2(max(sum of the aug's non-1 multipliers, 1)) + 1,800,000 ms) / 2`, then divided by the
  intelligence bonus `1 + intelligence^0.8 / 600` (`GraftableAugmentation.ts` `time`,
  `GraftingHelpers.ts` `calculateGraftingTimeWithBonus`, `formulas/intelligence.ts`). An aug with
  one 1.1 multiplier takes about 19 minutes; a 5-to-8-multiplier aug takes 1.5 to 2.2 hours. The
  intelligence bonus applies to progress too (`GraftingWork.ts` `process`). Unfocused work runs at 0.8x
  unless Neuroreceptor Manager is owned (`focusPenalty`, `Constants.ts` `BaseFocusBonus: 0.8`).
  Intelligence also gains a little exp from a finished graft (`GraftingWork.finish`).
- **It is the player's one "work".** `graftAugmentation` calls `Player.startWork(new GraftingWork)`, which
  *cancels whatever the player was doing* (crime, gym, faction work, or an earlier graft, with
  no refund). While it runs the player cannot do anything else, and anything that starts other
  work cancels the graft and loses the money. Sleeves are separate and keep working. Scripts (MCP,
  gang, darknet) are unaffected. `focus` defaults to true (puts the game on the Work page); with
  `false` the graft runs in the background at 0.8x speed.
- **On completion** the aug is applied at once as *installed* (`applyAugmentation` pushes it to
  `Player.augmentations`, no install reset, no skill or exp reset). So grafts count toward The Covenant's
  "20 installed augmentations" the moment they finish, persist through every later install, and do not
  raise the 1.9x ladder (nothing is queued). They are lost at the next BitNode like any other aug.
- **Entropy.** Each finished graft adds one stack (`GraftingWork.finish`: `Player.entropy += 1`), and
  every player multiplier is multiplied by `0.98^stacks` (`EntropyAccumulation.ts`; cost-type multipliers
  are divided). So each graft costs about **2% of hacking, combat, exp, rep, money rates**, permanently for
  the run (reapplied after every install in `Prestige.ts`; reset on a BitNode change in `prestigeSourceFile`).
  Ten grafts is x0.82. **Nickofolas Congruity Implant** is graftable only (no faction sells it): base $50t,
  so graft $150t, about 15 minutes (it has no multipliers, so the log term is 0). It sets entropy to 0 and
  stops it for good. Not worth it for this run unless entropy has become large and cash is very large.
- **No BitNode multiplier touches grafting** (no `Graft*` entry in `BitNodeMultipliers.ts`). The BN10 x5 and
  x2 augmentation multipliers apply to faction buys only; the BN10 level multipliers (hacking x0.35,
  combat x0.4) still apply to the stats the grafted multipliers raise.
- **API (`NetscriptFunctions/Grafting.ts`, `RamCostGenerator.ts` `grafting`):**

| Function | RAM | Behaviour |
| --- | --- | --- |
| `getAugmentationGraftPrice(name)` | 3.75 | price; throws on a non-graftable name |
| `getAugmentationGraftTime(name)` | 3.75 | ms *before* intelligence and focus; do not use it for the end time |
| `getGraftableAugmentations()` | 5 | names not owned/queued and not special; ignores money and prerequisites |
| `graftAugmentation(name, focus=true)` | 7.5 | `true` if started; `false` for no money, missing prereq or bad name; throws outside New Tokyo or without access |
| `waitForOngoingGrafting()` | 0 | resolves when the graft finishes **or is cancelled**; resolves at once with no work; rejects if the work is not a graft |

Useful neighbours: `singularity.getAugmentationStats(name)` (5GB) returns the multiplier object for **any**
aug, owned or not, so value and time can be computed without a faction offer. `getCurrentWork()` (0.5GB)
reports `type: "GRAFTING"` with `augmentation` and `cyclesWorked`. `getPlayer().entropy` is the stack count.
SF4 is level 3 here, so Singularity RAM is at the base figures.

## 2. What the source suggests about strategy

1. **Grafting is for big single augmentations, not small ones.** Entropy costs a fixed 2% of everything per
   graft, in log terms about 0.097 "v" using run 3's `augWeights` (sum of weights 4.8 x -ln 0.98).
   `augValue` below that is a net loss. Of 97 graftable augs, 49 clear it; hacking +5 to +8% augs (BitWire,
   ENM, DataJack) do not. Buy those from factions, with no entropy.
2. **Cash is cheap relative to a faction buy, time and entropy are the real prices.** A graft takes 0.3 to 2.2
   hours of the one player action slot plus a permanent 2%.
3. **Rep-free access to top augmentations** (computed offline from the v3.0.1 data with the run 3 weights;
   the probe in step G1 must confirm):

| Aug (where it is normally sold) | Graft price | Time | augValue | Notes |
| --- | --- | --- | --- | --- |
| SPTN-97 Gene Modification (Covenant) | $14.6b | 1.8h | 1.04 | all 4 combat x1.75, hacking x1.15, no prereq |
| Graphene Bionic Spine (Fulcrum, ECorp) | $18.0b | 1.6h | 0.75 | combat x1.6; needs Bionic Spine ($0.38b, 1.35h, x1.15) |
| Cordi-ARC Fusion Reactor (MegaCorp) | $15.0b | 2.0h | 0.60 | combat x1.35 |
| Xanipher (NWO) | $12.8b | 2.2h | 0.57 | all stats x1.2 |
| nextSENS Gene Modification (Clarke) | $5.8b | 1.7h | 0.47 | all stats x1.2 incl. hacking: cheapest per point |
| Graphene Bionic Arms / Bone Lacings | $11.3b / $12.8b | 1.2h / 1.1h | 0.49 / 0.43 | x1.85 str+dex / x1.7 str+def |
| QLink (Illuminati) | $75t | 1.9h | 1.37 | the largest hacking aug; no Illuminati invite needed |
| Hydroflame Left Arm (NWO) | $7.5t | 1.0h | 0.41 | strength x2.8 |

   The Red Pill is not graftable, so Daedalus favor and the donation route stay as they are.
4. **Grafting breaks the Covenant chicken-and-egg.** The invite needs 20 installed augs, $75b, hacking 850 and
   all four combat stats 850 (`FactionInfo.tsx`; recorded in `docs/bn10-plan.md`). Level is
   `mult x (32 ln(exp + 534.6) - 200)` and the BN10 combat level multiplier is 0.4. Hitting 850 needs an
   aug-multiplier product of roughly 4.6 to 6.8 (exp 1e9 to 1e7, arithmetic from that formula). Five no-prereq
   grafts (SPTN-97, Cordi-ARC, nextSENS, Xanipher, plus Bionic Spine and Graphene Bionic Spine, or
   Neotra/Photosynthetic Cells) reach it for about $50 to 70b and about 9 to 11 hours, and they count as installed
   immediately. This is the main reason to build the feature.
5. **Graft before you grind.** Gym exp is converted to levels at the current multiplier. Raising the multiplier
   first makes every later gym hour worth more, and a graft does not reset exp (an install does).

## 3. Where grafting fits this run

Run shape from run 3 (`docs/check-log.md`, BN10 run 3): about 12 hours to the gang, installs every 6 to 10 hours,
cash about $1.8b/h in the first cycle and $200t by day 3, Covenant joined on day 2.

| Stage | Cash and RAM | Grafting policy |
| --- | --- | --- |
| 0. Rebuild, hours 0 to ~6 | 32GB home, $ millions | None. Run the probe once if RAM allows (a few GB). |
| 1. Karma to -54k, gang created (to ~hour 12) | gang not yet earning | **No grafts** unless the karma delay is under 0.25h (the player's crime share of karma is small next to 7 sleeves) and the net value beats the alternative. In practice none. |
| 2. First installs, gang-faction augs (days 1 to 2) | $5b to $1t | Allow only grafts that beat the faction price at the end of the batch and clear the entropy bar. Expect 0 to 2. Combat grafts (Bionic Spine, Targeting) if the Covenant gate is behind. |
| 3. Covenant gate (850/850/20/$75b) | $15b+ for the set | **Main use.** Graft combat and all-stat augs first (SPTN-97, Cordi-ARC, nextSENS, Xanipher), then gym, then join. |
| 4. Covenant joined, Daedalus favor, sleeves | $100t+ | Only augs worth more than their entropy and time: QLink, Hydroflame. Cash is no object, time is. After the gate, drop the combat weights (run_target.json `augWeights` 0.4 to ~0.1). |
| 5. World Daemon | | Nothing. |

**Valuing a graft.** Reuse `augValue(stats, augWeights)` from `install_advisor_logic.js` with the same
`run_target.json` weights, so grafts and faction augs are on one scale (the "v" the allocator uses).

- `netV = augValue(stats) - entropyV`, with `entropyV = (sum of weights) x -ln(0.98)` per stack (0 once
  Congruity is owned). Skip when `netV <= minNetValue` (default 0.05).
- Player time: `rateV = netV / hours`. Compare with the best alternative, which is the advisor's
  `advice.next.rate` (v per hour of the next faction rep target) from `augmentation_readiness.json`.
  Graft when `rateV > alternativeRate`, or when there is no alternative (player on `hold`).
- Cheaper elsewhere: skip if a faction we can already reach sells it with rep ready, at a stepped price under the graft
  price (readiness `offers`: `price x 1.9^batchSize`), or if it is already in the install plan.
- Karma phase: `karmaDelayHours = hours x playerKarmaShare`, where the share is the player's measured karma/h over total
  karma/h (the probe step records both). Block in stage 1 when above `maxKarmaDelayHours`.

**Competing for time.** Crime (karma and cash), gym, university and faction work all use the same slot as grafting.
The grafter starts only at a safe point: no karma need (or small delay), no pending "cash short" crime, and no
fresh gym session within the cooldown. Faction work for Daedalus favor is the real rival late; the rate comparison
above handles it.

**Competing for cash.** A graft is a lasting purchase with an immediate return, and an install wipes nothing it
buys. In allocator terms add a purchase kind `graft_augs` (class "lasting", not in `WIPED`). Late in a cycle it is granted when the
price comes out of `freeCash`, or when its `valueV` exceeds `costInV` (the batch value lost). That needs one new
request field, `valueV`, next to `cashReturn` in `valuePurchase`. Until the allocator runs live, the grafter
caps itself: price <= `maxPriceFractionOfCash` (default 0.25) of current cash, and, late in a cycle, only from cash above the install
plan cost (`augmentation_readiness.json` `installPlan.cost`, the same rule as the gang's `reserveInstallPlan`).

## 4. Design

**Files (names are proposals; all `ns` calls stay out of the logic file).**

| File | Where | Purpose | Static RAM (ns functions charged) |
| --- | --- | --- | --- |
| `graft_logic.js` + `graft_logic.test.js` | `core/player/` | pure: time, price, entropy, `netValue`, eligibility, ranking, `planGraft`, `installBlocked` | 0 (the file itself adds no ns names) |
| `graft_probe.js` | `profiles/bn10/` (dev) | read-only live check, chunked by `--stage` | 6.6 (list), 6.6 (stats), 9.1 (price+time), about 2.1 (player readout) |
| `graft_scan.js` | `profiles/bn10/` | builds `graft_catalog.json`: names, base price, multipliers, prereqs; run once per cycle, then exits | `getGraftableAugmentations` 5 + `getAugmentationStats` 5 + `getAugmentationPrereq` 5 + base 1.6, so run it in two chunks (`--stage list`, `--stage stats`) on 32GB |
| `graft_controller.js` | `profiles/bn10/` (not in startup at first) | thin loop: read files, decide, travel, graft, wait, log | about 13.5GB: base 1.6 + `graftAugmentation` 7.5 + `travelToCity` 2 + `getPlayer` 0.5 + `getCurrentWork` 0.5 + `run` 1 + focus 0.2; `waitForOngoingGrafting` is 0 |
| `graft_config.json` | `profiles/bn10/config/` | policy keys, default `enabled: true, dry: true` | game file |
| `graft_status.json`, `graft_log.txt`, `graft_catalog.json` | game | outputs | |

Per the RAM-by-name note, keep identifiers in `graft_logic.js` away from ns function names (`run`, `exec`, `read`,
`write`, `scan`, `kill`, `share`, `hack`, `grow`): use `hours`, `netV`, `stack`, `name`. The probe and controller
confirm their RAM with `ns.getScriptRam` printed once.

**Why the controller reads files and does no valuation.** Valuation needs `getAugmentationStats` (5GB),
`getOwnedAugmentations` (5GB) and prices. `augmentation_readiness.js` already holds owned names and offers;
the scanner holds stats. The controller reads `graft_catalog.json`, `augmentation_readiness.json`,
`gang_status.json`, `player_activity_status.json`, `run_target.json`, `graft_config.json` and applies `planGraft`.

**Status file** `graft_status.json`: `ts`, `ok`, `mode` (dry/live/idle), `ownsPlayer` (true only while a graft runs), `aug`,
`startedAt`, `etaMs`, `price`, `entropy`, `decision` (the best candidate with `netV`, `hours`, `rateV`, `alternativeRate`,
`reasons` for each gate), `blocked` (why not now). Rewritten every 30 seconds while a graft runs
(`Promise.race([waitForOngoingGrafting(), sleep(30s)])` as a heartbeat) and every 60 seconds otherwise.

**Config keys** (`graft_config.json`): `enabled`, `dry`, `allow` / `block` (name lists), `maxPriceFractionOfCash` 0.25,
`reserveInstallPlan` true, `maxEntropy` 6 (stacks; hard stop, then only Congruity), `minNetValue` 0.05, `maxGraftHours` 2.5,
`maxKarmaDelayHours` 0.25, `allowDuringKarma` false, `focus` false first then true after step G7, `cooldownMs` 600000
(between a finished graft and the next), `minHomeRam`, `stage` (name, for logs).

**Handover to and from `player_activity_controller.js`.** It already treats a fresh `bladeburner_status.json`
with `ownsPlayer` as an external owner and holds. Do the same for `graft_status.json` (fresh within 2 minutes), plus a
second guard that does not depend on the file: if `getCurrentWork().type === "GRAFTING"`, hold, because `alreadyDoing`
today would not recognise a graft and the cooldown could start crime and cancel it. On completion the grafter sets
`ownsPlayer: false` and clears its status; the controller's next 60-second poll starts the right activity (it already
travels to the gym or university city when needed). The grafter never calls other work functions.

**Install interlock.** `aug_install.js --install` ends in `prestigeAugmentation`, which cancels work with no refund. Add a
pure `installBlocked(graftStatus, now)` in `graft_logic.js`; `aug_install.js` refuses `--install` (but still buys) while it
is true, and the grafter does not start a graft if the advisor says "install now" or the install is within the graft's
duration. Cheapest of the three guards is the 0.5GB `getCurrentWork` check in `aug_install.js`: add only if the file
check proves unreliable.

**Safety.**
- Never graft in stage 1 unless the karma delay is under the cap; the gang is the run's gate.
- Hard caps: `maxEntropy`, `maxPriceFractionOfCash`, one graft at a time, no second `graftAugmentation` call while
  `getCurrentWork()` is a graft (it would cancel it).
- Dry mode logs the decision it would make for at least one full cycle before the first live graft.
- Kill switch: `graft_config.json` `enabled: false` stops new grafts; an in-flight one is left to finish.
- Never touch an unfinished graft; if the controller restarts mid-graft it reads `getCurrentWork()` and resumes waiting.
- Verify success afterwards from `augmentation_readiness.json` `owned` (force `augmentation_readiness.js --once`),
  not from the return value alone, and log `entropy` from `getPlayer()`.

**Metrics** (`graft_log.txt`, one JSON line per event, trimmed with the existing `trimLog`): start and finish with `aug`, price, predicted
and actual hours, focus, money before/after, entropy before/after, `netV`, `rateV`, `alternativeRate`, karma/h and player
share, free cash and installPlan cost, outcome (done/cancelled/refused) and reason. Per graft, the measured effect:
hacking level, MCP $/s and combat levels 30 minutes before and after, so payback (`price / delta income`) is on record,
per the capital rule in `AGENTS.md`. Spend lands in `getMoneySources().sinceInstall.augmentations`, which the allocator's
unattributed-spend check does not watch yet; add it. Also record the share of player hours spent grafting.

## 5. Coding schedule

Every code step: write the test first, then `.venv\Scripts\python.exe tools\stage.py bn10`, then `node --test` in
`build\bn10`; all existing tests must still pass. "Live" steps need the game and a supervised window. Steps G2 to G4
need no game at all and can be written while the run proceeds.

| # | Step | Done looks like | Run stage / ready by |
| --- | --- | --- | --- |
| G1 | **Read-only probe**: `graft_probe.js --stage list|stats|price|time|player`. Writes `graft_probe.json`: the graftable list; for 8 sample augs (SPTN-97, nextSENS, Bionic Spine, BitWire, Neuregen, Targeting I, CombatRib3, QLink) the graft price, graft time, `getAugmentationStats`, `getAugmentationPrereq`; player `city`, `entropy`, intelligence, factions; measured karma/h split between player and sleeves. Does not call `graftAugmentation`. | One JSON file; price equals 3 x base for all samples; time equals the formula; list matches the 97-name offline list; RAM printed per chunk. Delete the script after (lesson 8). | Hour 1 to 6 of the run, whenever 7 to 10GB is free |
| G2 | `graft_logic.js` pure: `graftPrice`, `graftTimeMs(mults, intelligence)`, `entropyFactor(stacks)`, `entropyValue(weights)`, `netValue`. Tests pin QLink 1.93h, SPTN-97 1.76h, Congruity 15 min, the 0.097 threshold, int bonus at 0/100/1000. | Tests green; matches G1 numbers to rounding. | Offline, before G1 results are in; adjust after |
| G3 | `graft_scan.js` + `buildCatalog(list, stats, prereqs)` in logic. Writes `graft_catalog.json` (name, base, graftPrice, hours, stats, prereqs, special excluded). Tests use a 15-aug fixture from the source. | Catalog has 90+ rows live; `graft_logic` ranks SPTN-97 first among no-prereq combat augs. | Day 1 (home RAM 64GB+, or two chunks on 32GB) |
| G4 | `planGraft({...})` and `installBlocked` in logic. Gates in order: enabled, API/city/money, prereqs, entropy cap, price cap, install-plan reserve, karma delay, cheaper-in-faction, rate vs alternative, cooldown. Tests: one per gate (including "no graft in stage 1", "queued ladder does not change graft price", "prereq chain picks Bionic Spine before Graphene Bionic Spine"). | Each refusal returns a named reason; a good candidate returns the aug with its numbers. | Offline, before the gang exists |
| G5 | `graft_controller.js` in **dry** mode: reads files, writes `graft_status.json` and `graft_log.txt` with the decision, never travels or grafts. Not in `startup`. Add to `profiles/bn10/profile.json`, rebuild the manifest, document in `docs/processes.md`. | Runs at about 13.5GB with a one-line status; decisions look sensible against what the player is doing, for one full cycle. | Day 1 to 2, once home RAM is 64GB+ |
| G6 | Handover and interlock: the `externalOwner` and `GRAFTING` hold in `player_activity_controller.js`/`player_activity_logic.js`; `installBlocked` in `aug_install.js`. Tests for hold, for a stale status file (ignored after 2 minutes), and for the install refusal. | Tests green; with a hand-written fresh `graft_status.json` the controller reports "player owned by graft_controller.js". | Before G7 |
| G7 | **First live graft, supervised.** Set `dry: false`, `allow: ["Bionic Spine"]` or the first net-positive cheap aug, `focus: false`. Measure: predicted vs actual hours, price charged, entropy 0 to 1, city trip, player activity restored within 2 polls, the aug in `getOwnedAugmentations`, installed count up by one. Repeat once with `focus: true` to see whether the Work page blocks `tools/game_terminal.py`. | One logged round trip, all of the above recorded; no cancelled work. | Stage 2 or 3, with $1b+ spare |
| G8 | Allocator shadow: add kind `graft_augs` to `KINDS` (lasting), `valueV` in `valuePurchase`, `COUNTER_OF` for the `augmentations` counter, and read `graft_status.json` for pending verdicts. Tests in `valuation_logic.test.js`. | `spend_grants.json` shows a verdict for the pending graft; flag `shadow` only. | With the allocator already running |
| G9 | Metrics and display: `metrics.py` `PURCHASE_SOURCES`, `run_page.py` `LIVE_FILES`, `PULL_FILES` in `tools/bb_remote.py`, one HUD or run-page line. | Graft rows appear in the ledger; effect-after numbers logged. | After G7 |
| G10 | **Stage policy on.** Combat set before the Covenant gate (stage 3): `allow` the five-aug set, raise `maxPriceFractionOfCash` if needed, put `graft_controller.js` in the bn10 `startup` list. After the join, switch `augWeights` combat to ~0.1 and let QLink and the rest compete on rate. | Covenant gate met with grafts counted in the 20, with the combat gym hours lower than run 3's. | Stage 3 |

**Measurement plan.** For each cycle, compare with run 3's baseline (`docs/check-log.md`): hours from combat 30 to 850, hours to
the Covenant join, cash/h and MCP $/s before and after each graft (payback), entropy stacks and the % loss they imply, player hours
by activity (grafting versus crime, gym, faction work, from `player_activity_status.json` history), and installs avoided or shrunk.
A graft "paid" if its measured income/rep/time gain beat 0.097 v of entropy plus its cash and hours; otherwise tighten `minNetValue`.

## G1 results (live, 2026-11-16 22:50, BN10 run 4)

Three read-only scripts (7.2, 11.7 and 11.7GB; one combined script was 27.2GB, so keep probes split). Raw output:
`runtime/graft_probe_g1.json`.
- **Prices confirmed:** graft price = 0.6 x `getAugmentationBasePrice` for all 8 samples. In BN10 that function already
  includes the x5 BitNode multiplier, so this is 3 x the raw base, as the source says. SPTN-97 $14.6b, nextSENS $5.8b,
  Bionic Spine $0.38b, QLink $75t.
- **Correction 1, time:** `getAugmentationGraftTime` already includes the intelligence bonus (it returned the formula /1.09,
  and intelligence is 146, so 1 + 146^0.8/600 = 1.09). Use it as the time before the focus penalty only.
- **Correction 2, name:** the entropy cure is **"violet Congruity Implant"** in v3.0.1, not "Nickofolas Congruity Implant".
- 98 graftable (offline list said 97); entropy 0; intelligence 146; `getAugmentationPrereq` works for an aug no faction offers
  us (Combat Rib III -> Combat Rib II, Combat Rib I); `getAugmentationStats` likewise.

## 6. Open questions and risks

Not confirmed from source or not yet checked live:

1. **Focus and the UI.** `focus: true` sends the game to the Work page. The existing controller already focuses hourly
   (`focusWork`), so it is probably tolerated, but I could not confirm that `tools/game_terminal.py` still works then. Step G7 tests it.
2. **Whether unfocused grafting progresses while the window is hidden or throttled.** Source is per game cycle, so a
   throttled window could slow it. Not checked; compare predicted and actual in G7.
3. **(Settled by G1: both work.)** `getAugmentationBasePrice` and `getAugmentationPrereq` for non-offered augs. `getAugmentationStats` checks no ownership (confirmed),
   and I did not read the other two; the probe settles it.
4. **(Settled by G1: 146, bonus 1.09.)** Intelligence magnitude. The bonus is `1 + int^0.8/600`; our intelligence is unknown here (about 1.07x at 100, 1.42x at 1000).
   The probe reads it.
5. **Entropy scale of the value estimate.** I priced entropy with the weighted keys only (sum 4.8). It really hits every
   multiplier, including crime, company and work money, and cost multipliers; those are outside our weights, so the true
   cost is a bit higher. A first graft in G7 measures the real income and rep change.
6. **Run 4's weights.** `augWeights` in `run_target.json` are run 3's; the table values in section 2 use them. Review them for run 4
   (a 0.4 combat weight is right only until the Covenant gate).
7. **Cancel hazards outside our scripts.** I checked `player_activity_controller.js`, `aug_install.js` and the install path. Other scripts
   that call work functions (`bladeburner.js`, anything in `profiles/` or `core/dev/`) were not audited; grep for `commitCrime`,
   `workFor`, `gymWorkout`, `universityCourse`, `stopAction` before G7.
8. **Cancelled graft loses all the money.** Any bug in the handover costs up to the full graft price. Hence dry mode, one graft at a time, and the interlock.
9. **Does a graft reset karma, sleeves or shock?** Source shows no reset (`GraftingWork.finish` applies the aug only). I did not check sleeve code for an
   augmentation-count effect; the bn10 assessment also left "does an install reset sleeve shock" open.
10. **Offline/timeskip behaviour and `waitForOngoingGrafting` after a game reload.** A saved graft resumes from the save; untested.
11. **The $200k trips.** `Player.travel` is simple, but whether travelling cancels or pauses work was not read; the grafter travels before starting, so it does not matter for grafts.
12. **Price and time table.** Computed offline by parsing `Augmentations.ts` at v3.0.1, not by the game. If the Steam build 3162fd2 differs from tag
    v3.0.1 in any aug's data, the probe will show it.
