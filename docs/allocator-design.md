# One spender, one time planner: design study

Written 2026-11-10 (BN10 run 2, cycle 8) in answer to Ken's question. Design only: no live script,
policy file or save was changed. Vocabulary as in `AGENTS.md`: a **run** is a whole BitNode, a
**cycle** is install to install, the **batch** is the set of augmentations bought at an install.

## 1. Summary for Ken (plain language)

**What you asked.** Replace every script's own spending with requests to one spender that decides
what to buy and when; maybe the same for how the player, sleeves and gang spend their time.

**What I recommend: your third option, central valuation.** One tested module values every
candidate purchase on one scale. The scripts that buy things today keep pressing their own buy
buttons, but each kind of purchase has its own switch in one file, `valuation_flags.json`:

- **own**: the script's rule today (the default);
- **shadow**: the script's own rule, with the valuation's verdict logged beside it;
- **valued**: obey the valuation;
- **sweep**: buy only from the cash an install would otherwise wipe;
- **never**: do not buy this kind at all.

So home RAM can obey the valuation while sleeve memory waits for install cash and gang gear keeps
its own rule, and each switch can be flipped back alone. Do not do the time half yet.

- **Value centrally, buy locally.** A small script, the *allocator*, values every pending purchase
  and posts a verdict or allowance ("grant") for each. One process holding every purchase command
  would need roughly 70–90GB of home RAM, which a fresh run (32–64GB home) does not have; this costs
  about 3–5GB.
- **One yardstick.** Every purchase is priced in one unit: how much it shrinks or grows the next
  augmentation batch. Each aug costs 1.9x the one before, so the allocator can compute exactly what
  any purchase takes from the batch. Without that yardstick a queue would only move today's problem.
- **Timing.** First ~1.5h of a cycle: cash rebuilds (cloud RAM, programs). After that it is held for
  the batch; other purchases get money only if they pay it back before the install, or are small
  necessities (TOR, programs, enough home RAM to run the scripts). Lasting purchases (sleeve memory,
  a 5th sleeve, spare home RAM) come from the **install sweep**: cash left after the batch, which the
  install would wipe anyway. When to install stays the agent's judgement.
- **Time.** The conflicts seen so far (gang working past its rep need, player and sleeves working
  rep the gang covers) are fixed by shared facts each controller reads. A central task planner would
  be a big rewrite for little gain; I propose one published "who covers which faction" table instead.

**Why.** Three overspends in two days (cloud RAM $5.1t, home RAM $4.74t, sleeve memory up to ~$210t
avoided at the last minute) had one cause: each script judged "spare cash" alone and could not see
the batch. Today's fixes are caps: they stop the harm but cannot tell a good purchase from a bad one.

**What it costs.** About 5–6 agent sessions over three to four installs, one small resident script,
and at least a cycle of shadow (watch and log) before anything obeys. Nothing needs your action.
Every switch is reversible from the game terminal.

**Order of work.** Built the way the gang planner was: own branches, proven against measured
targets, folded into main at an install. (1) A spending ledger, for a baseline. (2) A watch-only
allocator that logs what it would have allowed beside what was bought; it changes nothing, so it
goes live early. (3) The switch file and the install sweep, deployed at an install; then each
purchase kind moves to `valued` or `sweep` on its own evidence. (4) Later, the time table. Details in
section 7; Ken's answers in section 11.

## 2. What spends today

| Spender | Kinds it buys | Lost at install? | Today's rule |
|---|---|---|---|
| `capital_manager.js` | tor, programs, home_ram, cloud_ram | cloud yes; others no | demand floors, `lateCycleLimit` on home |
| `sleeve_buyer.js` (bn10) | sleeve_augs, covenant_sleeve, sleeve_memory | augs yes | `lateCycleLimit`: augs 0 late, others 1% of cash |
| `gang-controller.js` | gang_gear, gang_augs | no | money mode 30-min payback in 1% of cash; rep mode rootkits ≤1%; augs `gangAugCashFraction` (bn10 0.3) |
| `aug_install.js` | donations, the batch, neuroflux, home_ram/home_cores | batch installs | priority augs reserved; runs only at install |
| player controller, `faction_join.js` | class fees, travel | n/a | negligible; not flagged |
| `mcp_stock_trader.js` | stock positions | no | own policy; check whether it runs in BN10 (R0) |

Four spenders read the same "cash above `reserve`". None knows the batch's price. The batch is
planned by `planPurchases` (`core/player/aug_install_logic.js`) and valued by the install advisor
(`core/player/install_advisor_logic.js`), but only at install time.

## 3. Recommendation

**Adopt Ken's third option for money: central valuation, local execution, a switch per purchase
kind. Defer it for time.**

| | Do nothing | Single queue, one spender | Central valuation (recommended) |
|---|---|---|---|
| Ranks a home step against one more aug | no; caps only say "not now" | yes | yes |
| Extra home RAM | 0 | 70–90GB resident | 3–5GB |
| Early run, 32–64GB home | works | cannot run; needs a fallback anyway | publisher starts when it fits; kinds stay `own` until then |
| Change size | none | rewrite four purchase paths; move gang rebuys and the batch into it | one flag lookup per purchase kind |
| Rollout | n/a | all or nothing | per kind, and back |
| Failure | n/a | dead spender = nothing bought | dead publisher = today's rules |
| Known risk | next spender repeats the incidents; caps also block good buys | big bang on a live run | one valuation error is shared by every kind set to `valued` (section 4) |

Doing nothing is defensible for the rest of BN10 run 2: the caps stop all three incidents. But they
are blunt, must be remembered for every new spender, and cannot say yes to a good purchase. The
single queue ranks no better than central valuation at far higher RAM and change cost. Ken's
reasoning holds: an imperfect central valuation, checked in shadow, beats four scripts each valuing
on their own rules, because its errors show in one log and are fixed in one place.

Against Ken's original wording: the "queue" is each spender's existing status file (its pending
purchase, cost and value inputs), not a new transport; "precisely one spender" becomes precisely one
valuation; prioritising and timing stay central (sections 4 and 6); time is deferred (section 8).
In `valued` mode a script's spending rule is replaced, not stacked. Two checks stay local because the
valuation cannot see them fresh: game legality (affordability, eligibility, a sleeve at shock 0) and
moment-to-moment state (the gang's rebuy right after an ascension).

The September rewrite plan (`docs/rewrite-plan-consolidated.md`, line 84: "a single budget/reservation
view" for cash) is **not live**: its only commit is 4ee272c of 2026-09-07, its separate repository and
save were never created, and the live code has moved on. This design delivers that line's intent in
the live code. Mark the rewrite plan superseded for cash budgeting, and dormant overall, when R1 lands.

## 4. The common value unit

**Unit: batch value**, written *v*: the install advisor's weighted sum of log multiplier gains, with
weights from `run_target.json` `augWeights` (`augValue`). It already ranks augs against each other and
against time ("+37%/h").

**What a dollar costs, in v.** Late in a cycle a dollar spent elsewhere is missing from the batch:

- `C` = projected cash at the expected install = cash + measured cash/h (`metrics_log`) x hours to it.
  Expected install: the later of the advisor's minimum (gang 4h) and its "wait for X" time, capped at
  12h; the agent can override.
- `B(C)` = value of the batch `planPurchases` buys with `C`, from readiness's rep-ready offers plus
  those forecast ready by then.
- **Cost** of spending `d` now = `B(C) − B(C − d)`. With the 1.9 step this is lumpy: $1t may cost
  nothing (it comes out of leftover that cannot buy the next aug) or a whole aug. The 1% cap cannot see that.

**What a purchase is worth, in v:**

| Class | Kinds | Valued as |
|---|---|---|
| **Necessity** | tor, programs, home_ram below the floor or with demand, gang recruits | Granted up to `necessityMax` (6.4). |
| **Cash return** | cloud_ram, gang_gear in money mode | Dollars `r` returned before the install; worth `B(C − d + r) − B(C)`. Cloud: MCP income per GB from utilisation and `metrics_log` (cycle 7: about zero past 0.2% use). Gear: the game formula the controller uses now. |
| **Lasting, non-cash** | sleeve_memory, covenant_sleeve, gang_gear in rep mode, gang_augs, spare home_ram | Gang rep gear: hours saved reaching the next gang aug x the advisor's v/h. Sleeves and memory: `sleeveShare` x income, an **assumption**. Unmeasured lasting value never takes batch cash; it competes in the sweep. |
| **Batch-side** | donations, neuroflux | Part of `B(C)` itself, as `aug_install` plans today. |

### Today's rules become valuation inputs

| Today's logic | Becomes |
|---|---|
| `install_advisor_logic.js`: `augValue`, `augWeights`, `gangAdvice`, `withDonations` | **The core**: v, the expected install time, the batch's forecast offers. |
| `planPurchases`, `donationPlan`, priority augs (`aug_install_logic.js`) | `B(C)`; every cost is computed from it. Priority augs stay reserved. |
| `lateCycleLimit` (`capital_logic.js`) | Its phase cutoff is an input; its 0%/1% caps stay the `own` rule and the fallback on a stale grant. |
| `cloudDemandFloorFor`, `ramUtilization` | Cloud's cash-return estimate: below the floor, return 0. |
| Home demand test (`homeDemandFloor`, `homeRamFloor`) | Classes a home step: necessity if below the floor or in demand, else lasting with value 0. |
| Gang money payback (30 min) | Cash return `r` for money-mode gear; the 1% slice is replaced by the grant. |
| `cheapGearQualifies`, `planReputationGear`, `gangAugCashFraction` | Respect per $ → rep/h → v. `gangAugCashFraction` becomes an output (the gang's grant). |
| `payoff` (`sleeveShare` 0.25) in `sleeve_buyer_logic.js` | Lasting value for sleeves and memory, flagged as an assumption. |
| Sleeve-aug karma gate | Stays a local guard (it costs sleeve time, which is not yet valued). |

### Where the valuation is weakest (what to watch)

1. **Gates are not multipliers.** `augValue` scores The Red Pill, the Covenant's $75b, Daedalus's
   150 favor and the hacking gates at 0. Run-target gates must be overrides that outrank v, or the
   valuation would starve the purchases that finish the run. The most important rule to test.
2. **Projected cash depends on install timing,** the agent's call. Watch S4 (forecast accuracy).
3. **Lumpy cost.** A small forecast error can flip "costs nothing" to "costs an aug". Use a margin
   and hysteresis; watch verdict flips in the log.
4. **Lasting value is a guess**: sleeve output, spare home RAM, value in later cycles.
5. **The weights are judgement.** A wrong `augWeights` entry misprices every `valued` kind at once.
6. **Rep forecasts** are thin in the first hour after an install.
7. **Time is harder than money.** Karma, gate training and sleeve sync have no v value yet.

## 5. Who executes, and the flags file

**One executor** would hold every purchase call (singularity TOR, programs, home RAM, augs,
donations, install; cloud; sleeve purchases and memory; gang gear): roughly 70–90GB resident with
the reads each decision needs, impossible on an early home, and it would have to absorb the gang's
post-ascension rebuys and the backed-up install batch. Rejected.

**Central valuation (recommended).** Pure module `core/capital/valuation_logic.js`. The allocator
runs it each pass over every pending purchase (read from the spenders' status files and cash) and
writes `spend_grants.json`. About 3–5GB. Spender scripts keep their structure: before a purchase,
each looks up **the kind of that purchase** in the flags file and acts by its mode.

### `valuation_flags.json`

Game-side, keyed by purchase kind:

```
{"run": 1762000000000, "kinds": {"tor":"valued","programs":"valued","home_ram":"valued","home_cores":"own","cloud_ram":"shadow",
 "sleeve_augs":"own","sleeve_memory":"sweep","covenant_sleeve":"sweep",
 "gang_gear":"own","gang_augs":"own","neuroflux":"own","donations":"own"}}
```

(An example of a later state, not the starting one; section 7 gives the rollout.)

| Mode | Mid-cycle, in the owning script | In the install sweep (`aug_install.js`) |
|---|---|---|
| `own` (default) | today's rule | as today (home RAM and cores only) |
| `shadow` | today's rule; log the verdict beside it | as today; log what the sweep ranking would buy |
| `valued` | buy only within the grant | competes for leftover by value |
| `sweep` | never bought mid-cycle | competes for leftover by value |
| `never` | never bought | never bought |

- **Kinds and owners.** capital_manager checks `tor`, `programs`, `home_ram`, `cloud_ram`;
  sleeve_buyer checks `sleeve_augs`, `sleeve_memory`, `covenant_sleeve` separately; gang-controller
  checks `gang_gear`, `gang_augs`; aug_install checks `donations`, `neuroflux`, `home_ram`,
  `home_cores` and runs the sweep. The batch itself has no key: it is what every other kind serves,
  and install timing is the agent's.
- **Defaults.** A missing file, missing key, unreadable file, unknown value or a run stamp from another
  run (section 9) means `own`. One pure
  reader, `flagFor(text, kind)`, is shared by every spender and tested for each case.
- **Checked values.** `sweep` is refused for kinds an install wipes (`cloud_ram`, `sleeve_augs`):
  sweep cash would buy something the install destroys. `never` on a necessity (`tor`, `programs`) is
  allowed but the setter warns, since it can stall progress.
- **Read every pass**, as `capital_manager` reads `capital_policy.json`, so a flip takes effect
  without a restart. `aug_install.js` reads it when it runs.
- **Game-only**, like `capital_policy.json`: not in `sync_manifest.json`, so a sync never overwrites
  a live flip. The checked-in default is every kind `own`; documented in `docs/processes.md`.
- **Setter:** `set_valuation_mode.js`, in the style of `set_gang_objective.js`.
  `run set_valuation_mode.js home_ram valued` sets one kind; `all own` is the emergency reset; no
  arguments prints each kind's flag beside the mode its spender last reported. It rejects unknown
  kinds and refused values, writes, reads back and confirms.
- **Reported mode, per kind.** Each spender's status gains
  `valuation: {grantAge, kinds: {home_ram: {flag, used, reason}, cloud_ram: {...}}}`. `used` differs
  from `flag` when the grant is stale or missing (`used: "own"`, `reason: "fallback: grants 7m old"`).
  The 2-hourly check reads `used`.
- **Time keys** (`player_time`, `sleeve_time`, `gang_time`) can join this file if section 8 is ever
  built; they are not in it now.

**Valuation settings stay in `capital_policy.json`.** `earlyCycleHours`, `lateSpendFraction`,
`homeDemandFloor`, the cloud floors and `reserve` are read by the `own` rules and by the valuation
alike, so one copy serves both. Valuation-only settings (`necessityMax`, verdict margin, the 12h
horizon cap, gate overrides) go in a `valuation` block there. The flags file holds switches only, so a
flip never changes tuning and the setter cannot clobber a tuned number.

### `spend_grants.json`

Rewritten every pass (60s), keyed by kind:

```
{ ts, ttlSec: 300, flags: <as read>, phase: "early" | "late",
  cash, projectedCash, expectedInstallHours, batchReserve, marginalAug: {name, steppedPrice, value},
  grants: { home_ram: {max, reason}, cloud_ram: {...}, gang_gear: {...}, ... },
  sweepPlan: [ {kind, item, cost, valueV} ],          // what the sweep would buy at today's cash
  refused: [ {kind, cost, valueV, costV, reason} ] }
```

Grants never sum above `cash − batchReserve`; buyers recheck cash before buying. `refused` is the
evidence: what was asked for and why it lost.

## 6. Timing

**Phases.** Early (first `earlyCycleHours`, 1.5h): no batch reserve; rebuild first. Late: reserve
covers `B(C)`; other kinds are granted only if their v-gain beats their v-cost, or are necessities.
`lateCycleLimit` stays in `capital_logic.js` as the `own` rule and the stale-grant fallback.

**Install timing.** The allocator never installs or asks for one. It adds two numbers to the agent's
judgement: the batch at today's cash, and what the next $X of cash would add. That answers "is waiting
for more cash worth it?", which the advisor today answers only for rep.

**The install sweep.** An install resets cash; whatever the batch cannot use is lost unless spent.
`aug_install.js --install` already spends the leftover on home RAM and cores. It now ranks every kind
flagged `sweep` or `valued` by stated value (sleeve memory, a Covenant sleeve, gang augs and gear,
home RAM and cores) and buys down the list. Sweep cash costs nothing, so unmeasured value is good
enough to rank by. The sweep runs inside the existing install step (save backup, agent's go-ahead) and
needs the sleeve and gang purchase calls only for that one-shot run; on a small home it skips what
does not fit. Its order is visible beforehand in `spend_grants.json` `sweepPlan` and in
`aug_install.js --dry`.

**Necessities and starvation.** TOR, programs, home RAM below `homeRamFloor` or under demand, and gang
recruits are granted whenever cost ≤ `necessityMax` (e.g. the larger of 2% of cash and $1b), and are
logged. Anything larger wins on value like any other purchase.

## 7. Rollout while BN10 run 2 is live

The gang planner's model: build on a branch of its own (never this design branch, never `main`
directly), prove it against named metrics with a baseline, fold it into `main` at an install, check
it live straight after (gang-planner: 47b5559, install 3, M1–M7). Every step has pure logic with
`node --test` in the staged build (`python tools/stage.py bn10`, then `node --test` in `build/bn10`)
and a status file. One exception to "merge at an install": the shadow allocator is read-only and must
watch the live game, so it merges early as its own step (R1).

### R0. Spending ledger: baseline (branch `allocator-ledger`, built 2026-11-10, commit 2541f1e)

- **Builds:** the game's own money counters (`getMoneySources().sinceInstall`) are the source of
  truth, since the scripts' purchase lists keep 50 entries and reset on restart (capital_status was
  empty on 2026-11-10 after the 15:13 restart). `metrics_logger.js` now also records the spending
  categories (sleeves, gang_expenses, other, class, ...), home RAM size and the advisor's batch value.
  `tools/metrics.py spend` reports per cycle: spend by category early/late, servers split home/cloud by
  home RAM, the largest late steps, B1 and B3. `metrics.py pull` archives `aug_install_status.json`,
  `capital_status.json` and `sleeve_buyer_status.json` into `runtime/spend_history.jsonl` for B2
  (cash left after the batch) and unattributed spending (counter minus the scripts' records).
- **Proven:** from the existing log alone, cycle 7 (06:20-12:15) shows servers $7t ($5.46t late,
  the cloud tripling) and cycle 8 a single late $4.74t servers step at 14:55, the home step. Still to
  show once deployed: sleeves and gang_expenses non-zero when those scripts buy, a home step labelled
  `home`, and B2 and B3 filled for the next install.
- **Merge point:** any time; the logger change is read-only (no new RAM: `getServerMaxRam` was
  already used). Merge to `main`, sync, restart `metrics_logger.js`. Live check: the next sample has
  `income.sleeves`, `homeRam` and `batchAverage`; `metrics.py pull` writes the history file.
  Whether `mcp_stock_trader.js` or darknet spends in BN10 is answered by the `stock` and `other`
  counters once logged.
- **Baseline** (cycles 7-8 for servers now; the rest from the first cycle after the merge): B1 late
  spend outside the batch and necessities, % of late earnings (cycle 7: 70%, cycle 8 so far 59%); B2
  cash left at install; B3 batch value per cycle hour; B4 cash/h, MCP rate, gang rep/h at zero favor.

### R1. Shadow allocator: early read-only merge (branch `allocator-shadow`, 2–2.5 sessions)

- **Builds:** `valuation_logic.js` (pure: `projectedCash`, `batchValue`, `costInV`, per-kind valuation,
  `chooseGrants`, `sweepPlan`, `grantFor`, `flagFor`) and `allocator.js`, writing `spend_grants.json`.
  Spenders are **not** edited (every kind effectively `own`). The allocator reads their purchases and
  pending choices and appends one line per purchase to `allocator_shadow_log.txt`: kind, item, cost,
  phase, verdict, v-cost, v-gain, reason. Started by `startup.js` after capital_manager; in
  `core/manifest.json`; `docs/processes.md` entry.
- **Tests:** the three incidents replay as refusals (cycle 7 late cloud; the 14:53 home step;
  Covenant memory late, placed in the sweep plan). Necessities always granted. Run-target gates (Red
  Pill, Covenant $75b, Daedalus donations) outrank v. Advisor "build" gives reserve 0. Stale readiness
  gives no grants. `flagFor` defaults and refused values.
- **Merge point:** `main` once tests pass, preferably just before an install so the shadow covers a
  whole cycle. Live check within 10 minutes: `allocator.js` in `ps` near its tested RAM; grants under
  2 minutes old; phase matches `capital_status.json` `cyclePhase`; spenders unchanged; a shadow line
  for each purchase since start.
- **Proven when** (at least one full cycle, judged before R2 merges):

| # | Metric | Target |
|---|---|---|
| S1 | Health: grants age < 2 min | ≥ 99% of checks; RAM ≤ 5GB; no script errors |
| S2 | Coverage: every ledger purchase has a shadow line | 100% |
| S3 | Disagreements, per kind: each refused purchase with its measured outcome (cloud utilisation after; `homeDemand` after; sleeve/gang status after) | every refusal that proved wrong is explained and fixed before that kind leaves `shadow` |
| S4 | Forecast: projected cash at install vs actual; projected batch vs bought; sweep plan vs leftover | cash ±25%; batch within 1 aug |
| S5 | No behaviour change | ledger purchases identical in kind to baseline rules; tests pass |

### R2. Flags, sweep, then kinds one at a time (branch `allocator-control`, 2–2.5 sessions)

- **Builds:** `valuation_flags.json` (checked-in default all `own`) and `set_valuation_mode.js`; the
  per-kind lookup and per-kind status in capital_manager, sleeve_buyer, gang-controller and
  aug_install; the install sweep in `aug_install_logic.js`. Branched from `main` after R1, so it
  carries the shadow's fixes.
- **Proven before merge:** S1–S5 over at least one cycle; tests for every mode of every kind,
  fallback, refused values and the sweep's ranking; `aug_install.js --dry` on the live game shows a
  sensible sweep plan.
- **Merge point:** the first install after R1's proof, merged and synced just before
  `aug_install.js --install`. Starting flags: every kind `shadow`, except `sleeve_memory` and
  `covenant_sleeve` at `sweep` (Ken, section 11) and `neuroflux`, `donations` at `own`.
  Live checks: within 10 minutes every resident restarted, each status reports `used` per kind as
  set, grants phase early; `aug_install_status.json` lists the sweep's buys. At 1.5h: phase late,
  `batchReserve` set, refusals logged per kind. In the first cycle, stop `allocator.js` for 10 minutes
  and confirm every kind not `own` reports `fallback` and follows `lateCycleLimit`, then restart it.
- **Then, one kind at a time, by `set_valuation_mode.js`** (no merge), each when its own S3 lines have
  been clean for a cycle: `home_ram` and `cloud_ram` first (two of the three incidents), then
  `gang_augs` and `gang_gear`, then `sleeve_augs`, then `tor` and `programs`. `donations` and
  `neuroflux` stay `own` unless the shadow shows a reason. A kind whose metrics slip goes back to
  `shadow` or `own` the same way.
- **Acceptance metrics** (first full cycle after each switch, against R0's baseline):

| # | Metric | Target |
|---|---|---|
| C1 | Late-cycle spend outside the batch and necessities, % of late income (B1) | ≤ 5% |
| C2 | Cash wiped at install (B2) | < 1% of pre-install cash |
| C3 | Batch value per cycle hour (B3) | ≥ baseline average, read over two cycles |
| C4 | Necessities | granted within one pass, 100% |
| C5 | No regression (B4) | cash/h, MCP rate, gang rep/h within 10%; tests pass; no errors in 3h |
| C6 | Fallback | the 10-minute stop shows `fallback` for every non-`own` kind; nothing above `lateCycleLimit` |

### R3. Time assignments (branch `allocator-assignments`, 0.5 session)

Readiness publishes `assignments` (section 8); player and sleeve controllers cite it. Proven: T1 no
faction worked by two actors unless listed as shared; T2 no player or sleeve work on gang-sold augs
(as gang-planner M5), over one cycle. Merge at any install after R2 has held for a cycle; live check:
`assignments` fresh, controller reasons name it.

Total about 5–6 sessions over three to four installs. Headline measure: C3, batch value per cycle
hour, with C1 and C2 beside it.

## 8. Time allocation

| Conflict seen | When | Fixed by |
|---|---|---|
| Gang worked rep ~2h past its need | cycle 6 overnight | gang objective `auto` reading `gangRepNeeded` (667d2ab) |
| Player and sleeves earned rep for augs the gang faction sells | cycles 2–3 | readiness `gangSells` (gang planner A1) |
| Sleeve aug purchases zeroed sleeve exp while karma was still needed | 2026-11-08 ~23:00 | sleeve_buyer waits on the karma gate |
| Two sleeves, or a sleeve and the player, on one faction | BN10 start | one sleeve per faction; player's faction last |
| Install 7 lost dexterity 830 of 850 mid-training | 2026-11-10 12:15 | judged acceptable: hacking bound the Covenant gate |

Each was fixed by publishing a fact (a need, a covered-aug list, a gate) that each controller reads;
none needed a planner assigning tasks. Task choice (gym vs Algorithms, which crime, which gang task)
rests on game formulas each controller already holds. So: no central time planner now. A planner
setting each actor's objective from `run_target.json` would duplicate about 800 lines of tested
controller logic for conflicts already solved. Instead:

1. Readiness publishes one `assignments` block: for each faction with a valued rep gap, who covers
   it (gang, player, sleeve n) and the gap left, so overlaps show in one file.
2. A purchase that costs an actor's time (sleeve augs zeroing exp) states that cost in its request.
3. Revisit if a conflict appears that a published fact cannot fix, or in a BitNode with more actors
   (Bladeburner, corporation). Time kinds would then join `valuation_flags.json` with the same modes.

## 9. Start of a run and fallbacks

**Before the allocator fits.** A new run starts with little cash and a 32–64GB home. Spending then
is exactly today's: `capital_bootstrap.js` (5.6GB) raises home RAM until `capital_manager.js` (17GB)
fits, then hands over, and `capital_manager` buys TOR, programs and home RAM to `homeRamFloor` on its
own rules. Those purchases are safe without any valuation: each is small, lasting, and unlocks
everything after it. The allocator starts only once home fits it beside the residents
(`capital_manager`'s start list), so it never competes with them for RAM.

**`valued` and `sweep` fall back to `own`** whenever the verdict is missing or stale. A grant file
counts as stale when any of these holds: it is missing or unreadable; its `ts` is older than `ttlSec`
(300s, five allocator passes); its `ts` is before `getResetInfo().lastAugReset` (written last cycle);
or its run stamp differs from the current run (below). In each case the kind uses its `own` rule and
reports `used: "own"` with the reason. So a fresh run behaves exactly as today until the allocator is
up, and a dead allocator mid-run returns every kind to today's rules within five minutes. `never` is
the one mode that needs no allocator: it is obeyed even when grants are stale. The install sweep
needs no allocator either: `aug_install.js` computes its ranking itself from the same pure module.

**Manual purchases stay allowed.** Grants are recomputed each pass from actual cash, so a manual buy
only lowers the next grants. The ledger lists it as **unattributed** (a cash drop no script
recorded). Nothing reverses it, retries around it or flags it as a fault.

**Flags reset at a new run; they carry over between installs.** The flags are run-level choices
(what this run's valuation is trusted with), so they should survive installs. They should not
survive into a new BitNode, where the valuation has not been shadowed against that run's economy
(different multipliers, no gang, different gates). The flags file therefore carries a run stamp,
`{"run": <getResetInfo().lastNodeReset>, "kinds": {...}}`; `flagFor` treats a file whose stamp does
not match the current run as all `own`, and the setter writes the current stamp. This works whether or
not the game keeps the file across a BitNode reset, and it is the safer choice: the worst case is a
new run on today's rules, which is how every run so far has started. Choosing flags for the new run
is part of the BitNode cutover (`docs/architecture-profiles.md`), done after its own shadow cycle.

## 10. Failure modes

| Failure | Behaviour |
|---|---|
| Allocator stale or dead | Section 9: every `valued`/`sweep` kind uses `own` and reports `fallback`; the steward restarts the allocator. |
| Valuation wrong | Shadow first; per-kind switch; `refused` with reasons; `set_valuation_mode.js <kind> own` undoes one kind, `all own` all. |
| Remote API outage | Allocator and spenders run in game on game files; only the agent's view goes stale. |
| Small necessities starved | Necessity class, granted below `necessityMax`; tested in R1. |
| Reserve held forever | Only while `B(C) > 0` and an install is expected within 12h; advisor "build" sets it to 0. |
| Two buyers race | Grants sum below `cash − batchReserve`; buyers recheck cash; refused buys are retried as today. |
| Install while a grant is open | The grant's `ts` predates `lastAugReset`, so it is stale; the new cycle starts early. |

## 11. Ken's answers (2026-11-10) and how each is checked

Ken: "Generally, yes to all questions, and we evaluate whether those were the right answer." Each
answer below names the measurement that would show it was wrong; the 2-hourly check reads them at
installs once the relevant step is live.

| # | Decision | Shows it was wrong |
|---|---|---|
| 1 | Central valuation, one switch per purchase kind; `home_ram` and `cloud_ram` move to `valued` first. | C5: cash/h or MCP rate more than 10% below baseline in the first 1.5h of a cycle (rebuild starved); or S3: refused cloud/home buys followed within a pass or two by utilisation or `homeDemand` above the floor (the RAM was needed). |
| 2 | `sleeve_memory` and `covenant_sleeve` at `sweep`. | Sleeve memory unchanged over three installs while measured sleeve output per memory point (rep and exp per sleeve hour, `sleeve_status.json`) says a memory step would have paid back within one cycle; or C2 shows sweep cash routinely too small to buy anything. |
| 3 | No central time planner; readiness publishes an `assignments` table. | T1/T2 violations in R3, or a new time conflict the table cannot fix (e.g. an actor more than 30 minutes on rep that `assignments` lists as covered). |
| 4 | Manual purchases stay allowed; no hard "never buy TOR" until the run-start defaults are proven. | Unattributed spend in the ledger above about 5% of a cycle's income, or early-run time to TOR and the programs longer than the previous run's (the defaults are not doing the job). |

Ken on question 4: "I buy by hand less and less as scripts become more capable. But we have to think
about new runs where we start with little money, little memory." Section 9 is the answer: a new run
starts on today's rules with every kind `own`, and nothing the valuation does can stop early TOR,
programs or home RAM.
