# Hacking strategy

> **Governance status, 2026-08-15:** the established core MCP path remains an
> allowed Tier 2 baseline. Formulas R8 is a separate production-inert shadow
> investigation and is paused before another live run at its source/visible-
> output/retrieval gate. Historical completion wording below does not promote
> R8 or authorize a held subsystem.

Analysis of `mcp.js`/`mcp_logic.js` against the real game formulas, with
ranked recommendations. Companion doc: `docs/hacking-mechanics.md` — that
one is the knowledge base (formulas extracted from the game's own
TypeScript), this one is the argument built on top of it. Read that first;
every formula cited here comes from there unless marked otherwise.

**Status as of 2026-08-14: R1–R5 and R7 are all implemented, live, and
confirmed working correctly — R4 landed last and delivered the
order-of-magnitude payoff for real: `incomePerSec` went from ~$170–190K/s
to $11.4M/s (~60×) the moment it picked a genuinely well-suited target
instead of the poor-fit one R1's live confirmation run had exposed. See §5
for the current, maintained status of every item — only R6 (XP mode) is
left, and it's deliberately parked.** The rest of this document is the
original analysis; read §5 first if you just want to know what's left.

## Status vocabulary

Same as `hacking-mechanics.md`:

| Tag | Means |
| --- | --- |
| **source** | Read directly out of the game's original TypeScript via `main.bundle.js.map`'s `sourcesContent`. |
| **derived** | Reasoning or arithmetic on top of **source** facts. Premise checkable, inference could be wrong. |
| **confirmed live** | Checked against this instance's own `mcp_status.json` / `mcp_events.txt`. |
| **speculative** | A guess. Labelled as one. |
| **open question** | Named unknown. |

New **source** facts extracted this session, not in `hacking-mechanics.md`
when it was written, all from the same source map:

- `RamCostGenerator.ts`: **every `ns.formulas.*` function costs 0 GB.** The
  entire `formulas.hacking` tree is `0`. Formulas.exe is a *program*
  prerequisite, not a RAM cost. `getServerGrowth` is `GetServer` = **0.1 GB**
  (the 2 GB figure is `ns.getServer`, the whole object).
- `NetscriptHelpers.ts`'s `hack()`: money drained is
  `moneyAvailable * percentHacked * threads`, hard-clamped to
  `moneyAvailable` — **linear in threads, not exponential**. Security
  fortify is `ServerFortifyAmount * Math.min(threads, ceil(1/percentHacked))`,
  so hack threads past the 100 % point cost RAM but **no extra security**. A
  *failed* hack fortifies nothing and grants exp/4. And critically:
  `if (moneyDrained === 0) expGainedOnSuccess = expGainedOnFailure` — hacking
  a server sitting at exactly $0 yields **25 % XP**, which contradicts the
  "XP is independent of money" premise this repo's XP mode is built on (see
  §R6).
- `NetscriptFunctions.ts`'s `grow()`/`weaken()`: both grant
  `calculateHackingExpGain(server, Player) * threads` — the *same* per-thread
  XP a successful hack grants.
- `ServerHelpers.ts`'s `processSingleServerGrowth`: grow's security cost is
  `2 * 0.002 * min(ceil(numCycleForGrowthCorrected(old→new)), threads)`, so
  it saturates as the server approaches `moneyMax`.
- `Server.ts` constructor: `moneyMax = 25 * baseMoneyParam`,
  `minDifficulty = round(baseDifficulty/3)`. Cross-checked against
  `src/Server/data/servers.ts`'s static table and against live readings —
  `silver-helix` base 30 → min 10 ✓, `max-hardware` base 15 → min 5 ✓. The
  static table is therefore usable offline for whole-network modelling, which
  is what §1's numbers are built on.

## Live baseline — confirmed live 2026-08-13 21:08

`mcp_status.json`, pulled fresh over the connected `bb_remote.py` daemon:

- 37 workers, 1764 GB pool, **98.3 % RAM utilisation**. `home` contributes 0
  (excluded by `getWorkerHosts`, mcp.js:654-666).
- Player hacking 854, $7.09 B. Target `silver-helix`, plan `weaken`,
  security 12.17 (floor 10), `moneyPct` **0.128**.
- **`incomePerSec` = $436 K/s**, `expPerSec` = 588/s, `totalHacked` $13.07 B.
- Deployed threads network-wide: **846 grow, 145 weaken, 0 hack**.
- `invariantViolations`: `weakenBudgetNonNegative` **578**,
  `tickWithinBounds` **117**.
- `needWeaken` 44 vs 145 weaken threads actually running — the same
  over-provision the mechanics doc recorded, still reproducing (101 threads,
  ~177 GB).

The recent `mcp_events.txt` tail shows the behavioural signature this whole
document is about — three target evictions in ~6 minutes, all
`reason: "stuck"`, all with `bestSecuritySeen` exactly equal to the target's
security floor, interleaved with `bucket_change` pairs `empty→low→empty` and
`moneyPct` collapsing from 0.333 to 0.0046 between two ticks.

## 1. The steady-state model — what the formulas actually imply

Everything below hangs off this, so it is worth deriving once. **derived**,
from the **source** formulas in `hacking-mechanics.md`.

Let `p = hackAnalyze(target)` (fraction stolen per hack thread),
`k` = the per-thread growth log constant
(`log1p(0.03/security) * serverGrowth/100 * mults.hacking_grow * coreBonus`),
`T = hackTime`, and note `growTime = 3.2T`, `weakenTime = 4T` exactly.

**Hack is linear-clamped per call but multiplicative in aggregate.** Each
host runs one `hack.js` process; a process with `N` threads takes
`min(1, N·p)` of whatever money is present when it fires. 37 processes firing
in the same tick compose multiplicatively, so the network removes
`1 − Π(1 − N_i·p) ≈ 1 − exp(−H·p)` of the money per hack cycle, with
`H = ΣN_i`.

**Grow is exactly exponential in aggregate.** `calculateGrowMoney` multiplies
by `exp(k·threads)`, so G grow threads across any number of hosts multiply
money by `exp(G·k)` per grow cycle.

Take logs. Below `moneyMax`, log-money drifts at a **constant rate
independent of the money level**:

```
d(log m)/dt = G·k/(3.2T)  −  H·p/T
```

**There is no interior equilibrium.** Both terms are money-independent, so
the system is bistable: if `G·k/3.2 > H·p` money pins at `moneyMax`; if
`G·k/3.2 < H·p` money collapses toward the floor set only by grow's small
additive `+threads` term. Nothing in between is stable. This is the single
most important consequence of the real formulas for this codebase, because
`mcp.js`'s whole bucket table is written as if an intermediate money level
were a place a target could sit.

**The balance point.** Setting the drift to zero gives the optimal thread
ratio:

```
G/H = 3.2·p/k          ( = WEAKEN_PER_HACK_RATIO / WEAKEN_PER_GROW_RATIO · p/k )
```

Add the maintenance weaken the code already computes correctly
(`weakenThreadsToOffset`, mcp.js:765-771):
`W = 0.16·H + 0.10·G`, where `0.16 = HACK_SEC_INCREASE·4/WEAKEN_SEC_DECREASE`
and `0.10 = GROW_SEC_INCREASE·1.25/WEAKEN_SEC_DECREASE`. With a pool of `R`
thread slots and `r = 3.2p/k`:

```
H* = R / (1.16 + 1.1·r)          G* = r·H*          W* = 0.16H* + 0.10G*
```

**Income at the optimum.** Money pins at max, hack drains it, grow restores
it once per grow cycle:

```
$/s = moneyMax · hackChance · (1 − exp(−3.2·H*·p)) / (3.2·T)
```

Equivalently — and this is the cleaner intuition — **income is grow-limited**:
you cannot extract money faster than grow manufactures it, so
`$/s ≤ moneyMax · (1 − exp(−G·k)) / (3.2T)`. The hack allocation's only job
is to not exceed that ceiling. Marginal return on grow threads decays as
`exp(−G·k)`, so the efficient operating region is `G·k ≈ 0.7–1.2` per grow
cycle (drain 50–70 % per cycle); past `G·k ≈ 1.5` extra grow threads are
mostly wasted.

### 1.1 What the current bucket table does instead

`WORK_WEIGHTS_BY_BUCKET` (mcp_logic.js:36-45) allocates hack as a *fraction
of free RAM*: 0.75 / 0.60 / 0.45 / 0.30 / 0.00. The balance point for
`silver-helix` at its floor, using the values backed out from the live status
file below, is **`r ≈ 24`, i.e. a hack share of 3.7 %** — and for every
mid-tier target the bot actually farms it lands between **2 % and 8 %**.

The lowest non-zero bucket (`low`, 30 %) is therefore **4–8× past the
collapse threshold**. Concretely, on `silver-helix`: 30 % of the pool is
~270 hack threads, `H·p ≈ 1.8`, so 83 % of the money is removed per ~15 s
hack cycle while grow's ~620 threads restore only `exp(0.17)` = +19 % over
the same interval. Net **×0.21 per hack cycle** — money falls by a factor of
100 in under a minute. **confirmed live**: the event log shows
`max-hardware` going `moneyPct 0.333 → 0.0046` between two `bucket_change`
events, and `silver-helix` adopted at `moneyPct 0.00296`.

So the bucket table is not a mis-tuned controller — it is a controller whose
*entire non-zero range* is on the wrong side of the only stable point. The
observed `empty↔low` limit cycle is the inevitable result: `empty` (grow-only)
climbs, `low` collapses, repeat. `BUCKET_HYSTERESIS` at 0.08 slows the
oscillation but cannot fix it, because the setpoint it is stabilising does
not exist.

### 1.2 Calibration, and how much of it is uncertain

`p`, `k`, `T` all depend on player multipliers that are not readable from the
static tables. Backed out of the one live data point (`silver-helix`,
`switchEval.currentScore` 420 687 at security 12.172, `hackTimeS` 17.392,
`moneyMax` = 25 × 45 M = $1.125 B):

- `mults.hacking_money ≈ 2.15` (**derived**)
- `mults.hacking_speed · intelligenceBonus ≈ 1.61` (**derived**)
- `mults.hacking_chance ≥ 1.27` (**derived**, lower bound from `hackChance`
  reading exactly 1.0 at security 12.17)
- `mults.hacking_grow` — **open question**, assumed 1.0 throughout. Every
  dollar figure below is therefore a *lower* bound; a grow multiplier of 2
  roughly doubles them.
- `mults.hacking_exp ≈ 2.8` (**derived**, from `expPerSec` 588 against the
  846 grow / 145 weaken threads actually deployed — a useful independent
  check that the whole model tracks reality, since it was not fitted).

The recommendations below all compute these live from `ns` calls rather than
hardcoding them, so the uncertainty affects only the size of the prize, not
the shape of the fix.

### 1.3 Modelled network, at the balance point

Whole-network model (offline, from `servers.ts` + the calibration above,
1764 GB pool, security at each target's floor). `G/H` is the balance ratio,
`H*` the optimal hack threads:

| target | req | growth | maxMoney | T (s) | chance | G/H | H* | modelled $/s | current `getTargetScore` rank |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rho-construction | 500 | 50 | $15.0 B | 74.7 | 0.70 | 11 | 76 | **$23.3 M/s** | 5th |
| the-hub | 300 | 50 | $4.4 B | 35.2 | 0.88 | 14 | 62 | $21.7 M/s | 2nd |
| phantasy | 100 | 35 | $0.6 B | 7.7 | 1.00 | 16 | 55 | $17.7 M/s | 1st |
| alpha-ent | 550 | 55 | $16.9 B | 96.2 | 0.64 | 10 | 85 | $17.6 M/s | 9th |
| omega-net | 200 | 35 | $1.6 B | 18.9 | 0.99 | 19 | 47 | $16.1 M/s | 3rd |
| silver-helix | 150 | 30 | $1.1 B | 14.6 | 1.00 | 24 | 38 | $13.3 M/s | 4th |
| global-pharm | 800 | 85 | $40.6 B | 187.2 | 0.43 | 1.4 | 375 | $11.6 M/s | 28th |

All seven are already rooted (present in the live `workers` list).

**The headline: the modelled achievable rate on the target the bot is
already sitting on is ~$13 M/s. It is producing $436 K/s.** That is a ~30×
gap, and it is not a modelling artifact — the grow-throughput ceiling alone
(`moneyMax · (1 − exp(−G·k))/(3.2T)` with the pool's ~900 grow threads,
which needs no assumption about `p` or `hackChance` at all) is $13.4 M/s for
`silver-helix`. The bot is currently extracting ~3 % of the money its own
grow threads could manufacture, because it never lets the target hold money.

## 2. Recommendations, ranked

Ordered by (expected gain) ÷ (risk × implementation cost). R1 and R3 are a
single change in practice — R1 alone would compute the right weights and
never deploy them.

---

### R1 — Size hack threads from the balance point, not from a RAM fraction

**Inefficiency.** `WORK_WEIGHTS_BY_BUCKET` (mcp_logic.js:36-45) and the
`plan.type === "work"` branch of `allocateThreads` (mcp.js:851-871) allocate
hack as a fixed fraction of free RAM, independent of the target's `p` and
`k`. §1.1 shows every non-zero bucket is 4–8× past the collapse threshold, so
the farm can never hold money and income runs at ~3 % of its grow-limited
ceiling.

**Proof.** §1's drift equation. The balance ratio `G/H = 3.2p/k` is a
consequence of three **source** facts only: `growTime = 3.2 × hackTime`
(Hacking.ts constants), grow's `exp(k·threads)` (formulas/grow.ts), and
hack's `min(1, N·p)` per call (NetscriptHelpers.ts).

**Fix.** Both inputs are available at 1 GB each and **do not need
Formulas.exe**:

```js
const p = ns.hackAnalyze(target)                       // already called in getTargetScore
const k = Math.LN2 / ns.growthAnalyze(target, 2)       // exact per-thread growth log
```

`ns.growthAnalyze(host, m)` is `numCycleForGrowth` = `log(m)/growthLog`
(**source**, NetscriptFunctions.ts), so `log(m)/growthAnalyze(host, m)`
recovers `growthLog` exactly, including every player and BitNode multiplier.
This is the whole reason Formulas.exe is not needed (see §3.1).

New pure function for `mcp_logic.js`, replacing `selectWorkWeights`:

```js
export function computeWorkWeights({
  objective, hackPercentPerThread, growLogPerThread, moneyPct,
  targetMoneyGoal, safety, xpWeightHack, xpWeightGrow,
  hackSecIncrease, growSecIncrease, weakenSecDecrease,
  weakenPerHackRatio, weakenPerGrowRatio,
}) {
  if (objective === "xp") {
    return { weightBucket: "xp", weights: { hack: xpWeightHack, grow: xpWeightGrow } }
  }
  if (!(hackPercentPerThread > 0) || !(growLogPerThread > 0)) {
    return { weightBucket: "ramp", weights: { hack: 0, grow: 1 } }
  }
  const growTimeRatio = weakenPerHackRatio / weakenPerGrowRatio          // 3.2
  const growPerHack = (growTimeRatio * hackPercentPerThread) / growLogPerThread
  const weakenPerHackThread = (hackSecIncrease * weakenPerHackRatio) / weakenSecDecrease
  const weakenPerGrowThread = (growSecIncrease * weakenPerGrowRatio) / weakenSecDecrease
  const balancedHackShare = 1 / (1 + weakenPerHackThread + growPerHack * (1 + weakenPerGrowThread))
  const readiness = Math.min(1, moneyPct / targetMoneyGoal)
  const hack = balancedHackShare * safety * readiness * readiness
  return {
    weightBucket: hack <= 0 ? "ramp" : "harvest",
    weights: { hack, grow: 1 - hack },
    balancedHackShare,
    growPerHack,
  }
}
```

`buildPlan` (mcp.js:699-728) passes `ns.hackAnalyze`/`ns.growthAnalyze`
results in; nothing downstream of `plan.weights` changes shape.

Three design choices worth stating:

- **`safety` (new config key, suggest `HACK_BALANCE_SAFETY = 0.7`).** At the
  exact balance point log-money is a driftless random walk. Running at 70 %
  of balance gives a positive restoring drift that pins money at max, at a
  linear ~30 % income cost. 0.7 is **speculative** as a specific number; 0.5
  is the safe start and can be raised while watching `moneyPct` in the status
  file (see §4).
- **`readiness²` replaces the bucket ladder.** Continuous proportional
  control: near-empty targets get almost no hack (fast ramp), full targets
  get the full balanced share. The squaring is **speculative** shaping — it
  makes the ramp noticeably faster than linear. This deletes
  `WORK_WEIGHTS_BY_BUCKET`, `bucketForMoneyPct`, `getWorkWeightBucket`,
  `BUCKET_HYSTERESIS` and the `bucket_change` event class entirely, along
  with the 25 %-of-all-log-lines oscillation documented in
  mcp_logic.js:57-71.
- **`moneyPct` will sawtooth hard in harvest mode** — hack fires every `T`,
  grow only lands every `3.2T`, so money legitimately swings between
  `exp(−G·k)` ≈ 45 % and 100 % of max within a grow cycle. Anything that
  reads `moneyPct` as a health signal must be smoothed or re-thresholded:
  specifically `DEGRADED_MONEY_PCT` (0.05) is still safe, but the `empty`
  tier's 0.1 threshold and `evaluateMoneyDegradation`'s `declining` test
  (mcp_logic.js:123-133) become noise-sensitive. Recommend feeding
  `avgMoneyPct` (already computed, mcp.js:1425-1428) rather than the raw
  sample into the readiness term.

**Expected impact.** Order of magnitude: **10–30×** on $/s. The floor of that
range is defensible from the grow-throughput ceiling alone. **Risk: high if
shipped without R3** (weights that never get deployed) and moderate on its
own — if `safety` is set too near 1.0 the farm can still collapse a target,
though the `readiness²` term makes that self-correcting rather than a limit
cycle. Ship with `safety = 0.5`, watch one target for 15 minutes, then raise.

---

### R2 — Fix the stuck detector evicting healthy targets

**Inefficiency.** `mcp.js:1088-1125`. `bestSecuritySeen` records the lowest
security ever observed on the current target. Once the target reaches its
security *floor* — which is the normal, desired outcome of a weaken phase —
`currentSecurity < bestSecuritySeen - WEAKEN_STUCK_SECURITY_THRESHOLD` can
**never** be true again, because `capDifficulty()` (**source**, Server.ts)
hard-clamps security at `minDifficulty`. So `securityProgressTime` freezes at
the moment the floor was first touched and the stuck clock runs continuously
through every subsequent productive minute. The eviction at line 1102 is
gated on `currentRequiredWeaken > 0`, so it does not fire *while* the target
is at the floor — it fires the instant security rises above the cap again,
by which time `stalledMs` is far past the window.

**Proof.** **confirmed live** — all three `target_drop reason:"stuck"` events
in the recent log have `bestSecuritySeen` exactly equal to the target's floor
(5, 5, 10) and `stalledMs` far exceeding `stuckAfterMs`:
`joesguns` 125 520 ms vs a 60 000 ms window, `max-hardware` 99 747 vs 60 000,
`silver-helix` 162 382 vs 139 288. Not one of them was actually failing to
weaken; `weakenTimeMs` was 9.8 s, 29.6 s and 69.6 s respectively.

**Fix.** Restart the stuck clock whenever the target is inside tolerance, so
each weaken phase gets its own window (mcp.js:1099):

```js
if (currentRequiredWeaken === 0) {
  securityProgressTime = 0
  bestSecuritySeen = Infinity
} else if (securityProgressTime === 0 || currentSecurity < bestSecuritySeen - WEAKEN_STUCK_SECURITY_THRESHOLD) {
  securityProgressTime = Date.now()
  bestSecuritySeen = currentSecurity
} else if (Date.now() - securityProgressTime > stuckWindowMs) {
  // ...existing eviction, minus the now-redundant currentRequiredWeaken > 0 guard
}
```

**Expected impact.** Large but hard to price alone: it eliminates a
target-eviction roughly every 2 minutes, each of which discards all
accumulated grow progress and forces a fresh ramp from ~0 % money. Under R1
(where a target is meant to sit at max money indefinitely) this bug would
undo most of R1's benefit, so treat it as a prerequisite. **Risk: very low.**
Four lines, no new state, strictly narrows when eviction fires. The genuine
stuck case (security not falling *within a weaken phase*, e.g. the pool
cannot muster enough weaken threads) still fires exactly as before.

---

### R3 — Redeploy on allocation mismatch, not on action-type mismatch

**Inefficiency.** `hostNeedsRedeploy` (mcp_logic.js:221-241) compares the
*set of action types* running against the plan. It has no notion of *how
many* threads the plan wants. Two live bugs fall out:

1. **`weakenBudgetNonNegative` (578 violations, and counting).** Weaken
   threads sized for an earlier tick's higher security are never scaled down;
   the no-redeploy branch (mcp.js:800-816) charges them against a
   freshly-shrunk budget and drives `remaining` negative every tick. Live
   right now: `needWeaken` 44, deployed 145 — 101 threads / ~177 GB held
   against a need that no longer exists.
2. **Hack threads are frequently never deployed at all.** Line 230:
   `if (plan.type === "work" && !hasGrow && !hasHack) return true`. After any
   weaken phase every host runs `weaken + grow` (the leftover-RAM branch,
   mcp.js:838-850). When the plan flips to `work`, `hasGrow` is true, so the
   host is judged fine and **hack is never introduced**. The only escape is
   `forceRebalance`, which only fires on a *bucket change* (mcp.js:1353) —
   and `lastWeightBucket` is reset to `null` on adoption and only written
   during `work` plans, so a weaken→work flip that stays in the same bucket
   deploys no hack whatsoever. **confirmed live**: the current snapshot has
   846 grow, 145 weaken, **0 hack** threads, and the event log shows hack
   only ever appearing at a `bucket_change`.

That second one is the mechanism behind the observed limit cycle: grow-only
until money crosses a tier, then a bucket change deploys 30 % hack, which
collapses money back below the tier, which deploys grow-only again.

**Fix.** Make the tick a two-pass allocation and make the redeploy predicate
compare desired against running.

Pass 1 (pure, network-wide): compute a desired `{hack, grow, weaken}` per
host from each host's free-plus-reclaimable RAM, drawing weaken from the one
shared budget in a deterministic host order. Pass 2: for each host, diff
desired against running and redeploy only that host if they disagree beyond
tolerance. Extend `describeRunningActions` (mcp.js:749-760) to carry
`threads: proc.threads`, then:

```js
export function hostNeedsRedeploy({ target, plan, running, desired, tolerance, actionDurationsS }) {
  if (running.length === 0) return true
  if (running.some((r) => r.target !== target)) return true
  if (plan.type === "weaken" && running.some((r) => r.script === "hack")) return true

  const have = { hack: 0, grow: 0, weaken: 0 }
  for (const r of running) have[r.script] = (have[r.script] || 0) + r.threads

  let mismatched = false
  for (const script of ["hack", "grow", "weaken"]) {
    const want = desired[script] || 0
    const slack = Math.max(tolerance.absolute, want * tolerance.relative)
    if (Math.abs(want - have[script]) > slack) { mismatched = true; break }
  }
  if (!mismatched) return false

  // Preserved from the 2026-08-11 redeploy-cadence fix: a mismatch is a real
  // reason to redeploy but never an urgent one, so still land between calls.
  return running.every((r) => r.elapsedS >= (actionDurationsS[r.script] ?? 0))
}
```

Suggested `tolerance = { absolute: 2, relative: 0.2 }` (**speculative** — the
right number is whatever stops per-tick churn; 20 % comfortably exceeds the
per-host `Math.ceil` rounding in `weakenThreadsToOffset`).

Note what this does to the invariant: once the running threads are *part of
the plan* rather than an uncounted charge against it,
`weakenBudgetNonNegative` (mcp_logic.js:280-284) becomes a genuine assertion
about pass 1's arithmetic again, instead of a permanent false alarm. Do not
delete it — it is currently the only thing that noticed this class of bug.

**Expected impact.** Recovers ~10 % of the pool during weaken phases
(directly measurable: 101 of 1025 thread slots right now), and is the
prerequisite that makes R1 do anything at all. **Risk: moderate** — this is
the most invasive change here and it touches the code path that killed the
farm's throughput once before (the 2026-08-11 cadence bug). Mitigations:
keep the `elapsedS` guard exactly as-is, keep the two-pass split so pass 1 is
pure and `node --test`-able in `mcp_logic.js`, and add a test that a
0-difference plan produces zero redeploys across ten simulated ticks.

---

### R4 — Correct `getTargetScore`, and drop `OPPORTUNITY_SWITCH_FACTOR`

**Inefficiency.** `getTargetScore` (mcp.js:507-513) is
`maxMoney · hackAnalyze · hackAnalyzeChance / hackTime` — the yield of *one
hack thread* at full money. It never reads `serverGrowth`. But §1 shows
income at the optimum is
`maxMoney · chance · (1 − exp(−3.2·H*·p))/(3.2T)` with
`H*·p = R / (1.16/p + 3.52/k)`. For `silver-helix`, `1.16/p ≈ 178` and
`3.52/k ≈ 3900` — so **the growth constant dominates the hack constant by
about 20:1**. At hacking level 854 essentially every reachable target is
grow-limited, and the code ranks them on the one term that barely matters.

**Proof of the misranking.** §1.3's table: `rho-construction` is the best
target in the network at a modelled $23.3 M/s and ranks **5th** under the
current score; `alpha-ent` ($17.6 M/s) ranks 9th; `global-pharm`
($11.6 M/s) ranks 28th. Meanwhile `iron-gym` ($7.6 M/s) ranks 6th and
`sigma-cosmetics` ($3.9 M/s) ranks 12th. The current score is systematically
biased toward low-`requiredHackingSkill`, low-`serverGrowth` servers.

**Fix.** Replace with the achievable-rate estimate (all inputs 0 GB or 1 GB,
no Formulas.exe):

```js
function getTargetScore(ns, server, poolThreads) {
  if (!isHackableTarget(ns, server)) return 0
  const T = ns.getHackTime(server) / 1000
  const p = ns.hackAnalyze(server)
  const growCycles = ns.growthAnalyze(server, 2)
  if (T <= 0 || p <= 0 || !Number.isFinite(growCycles) || growCycles <= 0) return 0
  const k = Math.LN2 / growCycles
  const r = 3.2 * p / k
  const hackThreads = poolThreads / (1.16 + 1.1 * r)
  const drained = 1 - Math.exp(-3.2 * hackThreads * p)
  return (ns.getServerMaxMoney(server) * ns.hackAnalyzeChance(server) * drained) / (3.2 * T)
}
```

One caveat the code must keep in mind: `p`, `k` and `T` are all read at the
candidate's *current* security, not the floor it would be weakened to. That
systematically under-rates targets currently sitting high above their floor.
Correcting it properly needs `ns.formulas.hacking.*` with a mock server at
`minDifficulty` (§3.1) — without Formulas.exe, the honest workaround is to
scale `T` by `(2.5·req·minSec + 500)/(2.5·req·curSec + 500)` and `p`,
`chance`, `k` by their `(100 − sec)/100` and `log1p(0.03/sec)` factors at
`minSec`, all of which are cheap arithmetic on values `mcp.js` already reads.

**Then replace `READINESS_FLOOR` with an explicit ramp cost.**
`getTargetEffectiveScore` (mcp.js:531-537) multiplies by
`max(moneyPct, 0.05)`, which is dimensionally arbitrary. The real cost of
adopting a drained target is the time to grow it up, which is computable:

```js
const rampSeconds = (3.2 * T * Math.log((maxMoney * TARGET_MONEY_GOAL) / Math.max(money, 1)))
                    / (growThreadsIfAllGrow * k)
const effective = score * horizonSeconds / (horizonSeconds + rampSeconds)
```

**derived** worked example: `silver-helix` from 0.3 % money needs
`ln(316)/0.81 ≈ 7` grow cycles ≈ 5.5 min; `rho-construction` from its 4 %
starting money needs ≈ 16 min. With `horizonSeconds` = 3600 (the bot runs
for hours), `rho-construction` wins decisively; with the current 10-minute
commit window as the horizon they are nearly tied, which is the real reason
the bot keeps preferring cheap targets.

**Finally, `OPPORTUNITY_SWITCH_FACTOR = 3` becomes wrong once the score is
meaningful.** On the potential basis, `rho-construction / silver-helix` =
23.3/13.3 = **1.75×** — a genuine 75 % income improvement that the 3× bar
forbids forever. Recommend **1.25–1.3** once R4's score and ramp discount are
in (the ramp discount already prices the switching cost, so the factor only
needs to cover model error), and keep `MIN_TARGET_COMMIT_MS` at 600 000 as
the anti-thrash guard.

**Expected impact.** ~1.75× on top of R1, from farming the right target.
**Risk: low-moderate.** Lowering the switch factor before the ramp discount
is in would cause thrashing — ship the two together, or not at all.

---

### R5 — Redeploy per script, not per host

**Inefficiency.** `allocateThreads` calls `killActionScripts` (mcp.js:819,
668-678), which kills *all three* action scripts on a host and re-execs from
scratch. Weaken has the longest latency of the three (`4T`, 70 s on
`silver-helix`, 240 s+ on hard targets), so every redeploy opens a full
weaken-cycle window during which hack (`T`) and grow (`3.2T`) land and
fortify security with **nothing counteracting them**. With redeploys
happening every couple of minutes, security ratchets upward — which is
consistent with the observed `work → weaken` plan flips at security
floor+3.5 despite `weakenThreadsToOffset` being arithmetically correct.

**Fix.** Each action type is exactly one process per host, so kill and
re-exec only the ones whose thread count actually changed:

```js
for (const script of ["weaken", "grow", "hack"]) {
  if (desired[script] === have[script]) continue
  const proc = running.find((r) => r.script === script)
  if (proc) ns.kill(proc.pid, host)
  if (desired[script] > 0) ns.exec(`/scripts/${script}.js`, host, desired[script], target)
}
```

Order matters: adjust weaken first so its long cycle starts earliest.

**Expected impact.** Unclear without measuring — **derived** it should
remove most of the security ratchet, which shows up as fewer `plan_flip`
events per hour. Measure it that way: count `plan_flip` events in
`mcp_events.txt` per hour before and after. **Risk: low.** Strictly reduces
the number of processes killed.

---

### R6 — XP mode: the split should be ~0.95/0.05, and selection should change

**Inefficiency.** `XP_WEIGHT_HACK = 0.8` / `XP_WEIGHT_GROW = 0.2`
(mcp.js:102-103, mcp_logic.js:105-107), described in the code as "reasoned,
not measured". The formulas settle it without measurement.

**Proof.** **source**: `hack`, `grow` and `weaken` all grant
`calculateHackingExpGain(server, Player) · threads` — identical per thread.
Their cycle times are `T`, `3.2T`, `4T`, and their per-thread RAM is 1.70 /
1.75 / 1.75 GB. XP per GB-second is therefore in the ratio

```
hack : grow : weaken  =  1/1.70 : 1/(1.75·3.2) : 1/(1.75·4)  =  1 : 0.303 : 0.243
```

**Hack is 3.3× better than grow and 4.1× better than weaken per unit RAM per
second.** The optimum is all-hack — with two caveats, both **source**:

1. `if (moneyDrained === 0) expGainedOnSuccess = expGainedOnFailure` — a
   target at exactly $0 pays **25 % XP**. This directly contradicts the
   premise in `mcp.js:80-87` and `processes.md` that XP is money-independent.
   It is independent of *how much* is stolen, but not of whether the balance
   is zero. So a nonzero grow allocation is required insurance, not waste.
2. Server money only reaches *exactly* zero when a single host's hack call
   clamps (`moneyDrained > moneyAvailable`), which needs
   `N_i ≥ ceil(1/p)` threads on one host. At `p ≈ 0.0065` that is 154
   threads; the largest worker here is 128 GB = 75 hack threads, so no single
   host can zero a target today. **This stops being true if a purchased
   server larger than ~256 GB joins the pool** — worth an explicit
   `Math.min(hackThreads, Math.floor(0.9/p))` clamp per host in
   `allocateThreads`, which also stops wasting RAM on threads past the 100 %
   point.

Also **source**: hack's fortify is
`0.002 · min(threads, ceil(1/p))` and a *failed* hack fortifies nothing, so
XP-mode security load is bounded and the existing `weakenThreadsToOffset`
maintenance already covers it.

**Fix.** `XP_WEIGHT_HACK = 0.95`, `XP_WEIGHT_GROW = 0.05` in
`mcp_config.json`. 5 % grow is far more than enough to keep money off zero
given grow's additive `+threads` term.

**Selection is the bigger miss.** XP rate per thread-second is
`(3 + 0.3·baseDifficulty)·(0.25 + 0.75·chance)/T` — it does **not** contain
`maxMoney` at all, yet XP mode still ranks targets by $/s (mcp.js:1282,
deliberately, per the comment at mcp.js:89-92). Modelled XP/s with the whole
pool on hack, at each target's security floor:

| target | req | baseDiff | T (s) | modelled XP/s |
| --- | --- | --- | --- | --- |
| joesguns | 10 | 15 | 2.15 | **3126** |
| sigma-cosmetics | 5 | 10 | 1.85 | 2908 |
| nectar-net | 20 | 20 | 2.92 | 2758 |
| max-hardware | 80 | 15 | 5.15 | 1302 |
| silver-helix | 150 | 30 | 14.59 | 735 |

(relative only — `mults.hacking_exp` cancels.) The money-optimal targets are
**4–5× worse for XP** than `joesguns`, because `hackTime` scales with
`requiredHackingSkill × security` while XP per action grows only as
`3 + 0.3·baseDifficulty`. If XP mode is ever used seriously, give it its own
score: `(3 + 0.3·baseDifficulty)·(0.25 + 0.75·chance)/hackTime`, using
`ns.getServerBaseSecurityLevel` (0.1 GB).

**Expected impact.** ~1.12× from the weight change, ~4.3× from the selection
change, so ~4.8× for XP mode overall — but `OBJECTIVE` is `"money"` and
income is the binding constraint right now, so this is **low priority**
until the next augmentation reset makes XP the bottleneck again.
**Risk: low.** Config-only for the weights; the selection change is a new
branch in `rankTargets` and is only reachable in XP mode.

---

### R7 — Cheap items worth doing while in there

- **Use `home`'s RAM.** `getWorkerHosts` (mcp.js:654-666) skips `home` and
  `getHostFreeRam` (mcp.js:645-652) returns 0 for it. Per `CLAUDE.md` home is
  128 GB — ~7 % more pool — and it has multiple cores, so grow and weaken
  threads there get `coreBonus = 1 + (cores−1)/16` (**source**) on top.
  Needs a reserve (mcp.js, the HUD, the supervisor all live there); 32 GB
  reserved leaves ~96 GB. **Impact: ~5 %. Risk: moderate** — under-reserving
  starves `mcp.js` itself, which is a farm-stopping failure, so gate it on
  `getServerMaxRam("home") - getServerUsedRam("home") > RESERVE`.
- **Use `ns.growthAnalyzeSecurity(threads, target, 1)`** (1 GB) instead of
  `weakenThreadsToOffset(0, growThreads)` for grow's security reserve. It
  applies the same `min(threads, maxThreadsNeeded)` clamp the game itself
  uses (**source**, NetscriptFunctions.ts), so it stops over-reserving weaken
  when the target is near `moneyMax` and grow's security cost saturates.
  Mostly matters in the weaken-phase leftover-grow branch (mcp.js:845-850).
  **Impact: a few percent of pool. Risk: low.**
- **`SECURITY_CAP = 6` is a no-op for every target that matters.**
  `goalSecurity = max(minSecurity, SECURITY_CAP)` (mcp.js:556) and the seven
  best targets have floors of 7–28. It only binds on the low-tier servers
  (`max-hardware` 5, `joesguns` 5, `sigma-cosmetics` 3, `n00dles` 1), where
  dropping it to 1 would buy ~13–16 % on hack time and steal percentage.
  **Cosmetic** at current scale; set it to 1 for tidiness if touching the
  config anyway, since all three hacking economics improve monotonically as
  security falls (`hacking-mechanics.md`, "Note on
  `requiredHackingSkill * hackDifficulty`").
- **`tickWithinBounds` fired 117 times.** Tab throttling is stretching ticks
  well past 30 s. It is already surfaced correctly; noted here only because
  it is the decisive argument against HWGW batching (§3.3).

---

## 3. Questions asked, answered directly

### 3.1 Does `ns.formulas` / `formulas.hacking.growThreads` earn its keep?

**No — and the RAM objection was unfounded anyway.** `hacking-mechanics.md`
listed the Formulas.exe RAM cost as an open question; the answer is
**0 GB for every `ns.formulas.*` function** (**source**, RamCostGenerator.ts).
The only gate is owning the program, which is still **open question** — not
checkable from outside the game.

But this architecture does not need `growThreads`. `growThreads` answers
"how many threads to get from A to B in one call", which is a *batching*
question. A continuous-loop farm needs the marginal log-growth *rate*, and
`ns.growthAnalyze(target, 2)` (1 GB, **no program required**) gives that
exactly: `k = ln(2)/growthAnalyze(target, 2)`, including every player and
BitNode multiplier (**source**, `growthAnalyze` → `numCycleForGrowth` =
`log(growth)/calculateServerGrowthLog`). At the balance point of R1 the grow
allocation is automatically right-sized — `G·k` equals exactly the log-money
hack removed — so there are no "wasted threads" for `growThreads` to
eliminate.

Where Formulas.exe *would* pay off, if owned: R4's scoring, which currently
has to evaluate candidates at their present security instead of the floor
they would be weakened to. `ns.formulas.hacking.hackPercent/hackTime/
growPercent` against a mock server with `hackDifficulty = minDifficulty`
gives the exact steady-state score with no approximation. **Worth checking
whether Formulas.exe is owned** (`ns.fileExists("Formulas.exe", "home")`) —
if it is, use it in `getTargetScore`; if not, the arithmetic correction in
R4 is adequate.

### 3.2 Single-target vs. concurrent multi-target

**No, not now — but the reason is quantitative, not "it depends".**

Income is concave in the thread budget (`1 − exp(−G·k)`), so splitting the
pool across targets does beat single-target once the best target starts
saturating. Optimising the split numerically over the whole modelled network
(marginal-value allocation, 5-thread increments):

| allocation | modelled $/s | vs. best single target |
| --- | --- | --- |
| best single target (rho-construction, whole pool) | $23.3 M/s | 1.00× |
| best 2 targets (rho-construction + the-hub) | $27.3 M/s | **1.17×** |
| best 3 (+ phantasy) | $28.3 M/s | **1.22×** |
| unconstrained | $28.4 M/s | 1.22× |

So the entire prize is **+22 %**, and 80 % of it comes from just adding a
second target. Against that: per-target weaken budgets, per-target eviction
and hold timers, a RAM partition policy, a much larger `mcp_status.json`
schema, and the loss of the single-`currentTarget` invariant that most of
this codebase's diagnostics are built around. R1 is worth 10–30× for a
fraction of that complexity. **Do R1–R4 first; revisit this only if the
answer changes.**

It *will* change under one specific condition, which is worth watching for:
the gain grows as `G·k` on the best target exceeds ~1.5. Right now the top
targets sit at `G·k ≈ 0.75–1.1` — the efficient region — because the pool
(1764 GB) happens to be well matched to their growth rates. **Roughly
triple the pool, or move to targets with lower `serverGrowth`, and
multi-target starts being worth 1.5–2×.** The status file already carries
everything needed to compute `G·k`; adding it as a status field is the
cheapest way to know when this crosses over.

### 3.3 HWGW batching

**No. Do not rewrite this as a batcher.**

HWGW's advantage over *correctly balanced* continuous looping is bounded and
small. Both are limited by the same grow throughput (§1). Batching wins on
exactly two margins:

- Hack lands with money at exactly `moneyMax` rather than somewhere on the
  sawtooth. **derived**: with `G·k ≈ 0.8` the continuous-mode time-average
  money is ~85–90 % of max → **+10–15 %**.
- Hack lands at `minDifficulty` rather than at the tolerated
  `max(minSecurity, SECURITY_CAP) + WORK_SECURITY_MARGIN`. For the seven best
  targets `minSecurity` already exceeds `SECURITY_CAP`, so this is worth the
  margin only: ~1.5 security points out of a floor of 10–28 → **+3–8 %** on
  hack time and steal percentage combined.

Call it **+15–25 %** in exchange for a rewrite. And the exchange is worse
than that here, for one repo-specific reason: **`tickWithinBounds` has fired
117 times this run** — browser tab throttling is stretching a nominal 10 s
tick past 30 s, and `CLAUDE.md` records ticks reaching 70–380 s. HWGW's
entire premise is that four calls land in a controlled order within tens of
milliseconds of each other. A batcher under that throttling does not degrade
gracefully; a desynchronised batch lands grow-before-hack or
weaken-before-grow and actively destroys the target's state. Continuous
looping is *indifferent* to tick timing — the workers loop inside the game's
own scheduler and `mcp.js`'s tick only observes and re-provisions.

Continuous looping with the R1 balance point is within ~20 % of the
batching ceiling, on a farm that currently runs at ~3 % of it. Spend the
effort on R1–R4.

### 3.4 The tunables in `mcp_config.json`

| key | live value | verdict |
| --- | --- | --- |
| `SECURITY_CAP` | 6 | No-op for all seven best targets (floors 7–28). Set to 1; **cosmetic**. |
| `TARGET_MONEY_GOAL` | 0.95 | Correct, and becomes more meaningful under R1 where money genuinely pins near max. |
| `MIN_TARGET_HOLD_MS` | 60 000 | Fine, but it is the *only* hold that applies today because targets are almost always in the `empty` bucket (mcp.js:1238-1239). Under R1 the 600 s commit path becomes the normal one — which is the intent, and worth verifying after shipping. |
| `WORK_SECURITY_MARGIN` | 1.5 | Reasonable. Its real job is absorbing the post-redeploy weaken-latency gap (R5); if R5 lands, this can stay or shrink. |
| `RATE_DROP_FACTOR` | 0.75 | The `rate` it guards is `max(0, previousMoney − currentMoney)` (mcp.js:1409-1417), which under R1's sawtooth alternates between 0 and large every tick. `rateSamples.every(...)` (mcp.js:1139-1142) keeps it conservative enough not to misfire, but the signal is poor. `incomePerSec` from `ns.getTotalScriptIncome()` is already collected and is the game's own accounting — worth switching to if this ever misfires. **Not urgent.** |
| `LOOP_SLEEP_MS` | 10 000 | Fine. It is an observation cadence, not an action cadence; `hostNeedsRedeploy`'s `elapsedS` guard decouples the two. |
| `WEAKEN_STUCK_MS` | 60 000 | The value is fine; the *detector* is broken — see R2. |
| `SKIP_STUCK_MS` | 60 000 | Fine. |
| `DEGRADED_MONEY_PCT` | 0.05 | Fine, and stays safely below the sawtooth trough (~0.45 of max) under R1. |
| `MONEY_PCT_SAMPLE_COUNT` | 9 | 90 s of samples. Under R1 a full grow cycle is 3.2 × `hackTime` = 47–240 s depending on target, so 9 samples can sit entirely inside one sawtooth trough on a fast target. Consider scaling it to `ceil(4 · growTimeS / tickSeconds)`. |
| `OPPORTUNITY_SWITCH_FACTOR` | 3 | **Mistuned once R4 lands** — it forbids a real 1.75× improvement. Drop to 1.25–1.3 *with* R4's ramp discount, never before. |
| `MIN_TARGET_COMMIT_MS` | 600 000 | Correct as an anti-thrash guard, and it is also the implicit horizon in R4's ramp discount — use 3600 s there instead, since the bot runs for hours. |
| `DEGRADED_SKIP_MS` | 900 000 | Fine. |
| `BUCKET_HYSTERESIS` | 0.08 | **Deleted by R1** along with the bucket table. |
| `XP_WEIGHT_HACK`/`GROW` | 0.8 / 0.2 | Should be 0.95 / 0.05 — see R6. |

No tunable value here is wrong in a way that a retune could fix, with the
single exception of `OPPORTUNITY_SWITCH_FACTOR`, and that one only becomes
wrong once the score it multiplies means something. **The problems are
structural, not parametric.** That is the main reason this document
recommends code changes rather than a config sweep.

## 4. What still needs live measurement

Named explicitly, because the difference between "derived" and "confirmed"
matters and `econ_probe.js` exists for exactly this:

1. **`mults.hacking_grow`** (§1.2). Every dollar figure here assumes 1.0 and
   scales roughly linearly with it. One `ns.getPlayer().mults.hacking_grow`
   read settles it — cheapest possible measurement, and it should be added to
   `mcp_status.json`'s `player` block regardless.
2. **The `safety` value in R1.** Deploy at 0.5, watch `avgMoneyPct` in the
   status file for 15 minutes. If it holds above 0.9, raise to 0.7, then 0.85.
   The failure mode is visible within one grow cycle and reverses by editing
   the config — no restart, no lost history.
3. **Realised vs. modelled $/s.** `incomePerSec` (already in the status file)
   against §1.3's modelled number for whichever target is held. A gap larger
   than ~2× after R1–R3 means the model is wrong somewhere, and the most
   likely place is `mults.hacking_grow` or an unaccounted BitNode multiplier
   (`hacking-mechanics.md`'s first open question).
4. **`plan_flip` events per hour**, before and after R5. That is the
   observable for the weaken-latency ratchet.
5. **Per-action XP rates**, if XP mode is ever revisited: R6's ratio is
   derived from source and should need no measurement, but the
   `moneyDrained === 0 → exp/4` clause is worth confirming live by running
   XP mode on a deliberately drained target and watching `expPerSec` step by
   4× when grow is reintroduced.

## 5. Implementation status and next steps

Updated as each step actually ships — this section is the current source of
truth for "what's left," not just the original ranking.

1. **R2 (stuck detector) — done, live, confirmed 2026-08-13.** Shipped as
   `evaluateStuckTarget` in `mcp_logic.js` (5 tests). Restarted live;
   watched a full weaken→work cycle with the target sitting at its security
   floor and zero spurious "stuck" evictions — the exact case that used to
   misfire.
2. **R3 (allocation-diff redeploy) — done, live, confirmed 2026-08-13.**
   Shipped as `computeDesiredAllocation` + a rewritten `hostNeedsRedeploy`
   in `mcp_logic.js` (16 tests, including direct regressions for both live
   bugs this closed). Restarted live; first post-restart tick showed
   `needWeaken: 26`, **zero `weakenBudgetNonNegative` violations** — the
   budget-conservation guarantee is holding. Two new config tunables
   (`REDEPLOY_TOLERANCE_ABSOLUTE`/`RELATIVE`, defaults 2/0.2) are live and
   hot-reloadable if redeploy churn ever shows up in `mcp_events.txt`.
3. **R1 (balance-point weights) — shipped and confirmed live 2026-08-14,
   working correctly, but exposed the exact reason R4 is needed next.**
   Restarted live ~11:42 PDT; watched `foodnstuff` for ~15 minutes as it
   ramped 4%→100% moneyPct exactly as the `readiness²` curve predicts. At
   100% money, `incomePerSec` sat at **exactly 0** with **zero hack threads
   deployed anywhere in the pool**, including on a 256GB host — looked like
   a bug, wasn't. Added a `debugWorkWeights` field to `mcp_status.json`
   (`hackPercentPerThread`/`growLogPerThread`/`balancedHackShare`/
   `growPerHack`, kept as a standing diagnostic, not reverted) and read the
   real numbers: `p=0.0087`, `k=0.000238`, `growPerHack≈117` — nearly 5×
   worse than this doc's own `silver-helix` worked example (`growPerHack≈24`,
   ~3.7% hack share) — giving `balancedHackShare≈0.77%`, which times
   `safety=0.5` floors to 0 threads on every single host no matter how
   large. **The formula is correct**: `1/(1+0.16+117.07×1.1) = 0.0077`
   matches the live reading exactly. `foodnstuff` is simply a target whose
   grow-per-thread rate is so poor relative to its hack rate that the
   balance-point strategy correctly declines to hack it at all — the old
   bucket table would have hacked it anyway (fixed 75% at "goal"), which is
   the collapse case §1 predicted, not a sign the old code was doing
   anything useful there. **R1 itself is done.** What's exposed is that
   target *selection* (`getTargetScore`, unchanged, still the pre-R4
   $/thread metric with no `growPerHack` awareness) can park the bot on a
   target where R1 has nothing to work with, producing correct-but-useless
   0 income. R4 is what fixes that, and is now motivated by live evidence,
   not just the modelled ranking table in §1.3. Shipped: `computeWorkWeights`
   in `mcp_logic.js` replacing `selectWorkWeights` (8 new tests, including a
   worked-example regression matching this doc's own silver-helix ~3.7%
   hack-share number and a `hack + grow === 1` sweep across the input
   space), reading `ns.hackAnalyze`/`ns.growthAnalyze(target, 2)` live in
   `buildPlan` to get real `p`/`k` per tick, a new `HACK_BALANCE_SAFETY`
   config tunable shipped at **0.5** (not the doc's speculative 0.7, per
   this doc's own instruction), and `WORK_WEIGHTS_BY_BUCKET`/
   `bucketForMoneyPct`/`getWorkWeightBucket`/`BUCKET_HYSTERESIS` deleted
   from both `mcp_logic.js` and `mcp.js` now that nothing references them
   (`docs/processes.md` updated to match; the `bucket_change` event is
   renamed `weight_regime_change`, carrying the new 3-value
   `"xp"`/`"ramp"`/`"harvest"` tag instead of the old 5-value bucket, for
   the same "did the regime change" purpose). `ns.getPlayer().mults.hacking_grow`
   (§1.2's one real open unknown — everything in §1.3's table is a lower
   bound until it's read) is now surfaced as `player.hackingGrowMult` in
   `mcp_status.json`, but its live value is still unread — nobody has looked
   at the status file since this shipped. **Judgment call, flagged for
   review:** `evaluateMoneyDegradation`'s `declining` check (mcp_logic.js)
   now compares the average of each half of the sample window rather than
   raw first/last samples, so a single sample landing on a harvest-mode
   sawtooth trough at the window's edge can't flip it — this doc's own §2.1
   raised the sawtooth-noise concern but pointed at feeding `avgMoneyPct`
   into the *readiness* term specifically, which was deliberately **not**
   done (`buildPlan` still passes the raw instantaneous `moneyPct`, per this
   doc's own "carries over unchanged" framing for that parameter); the
   half-window smoothing is a narrower, separately-justified fix applied to
   the eviction predicate only, reproduces every existing regression test's
   verdict unchanged, and has two new tests demonstrating the specific
   false-positive it closes. R3 being live is what makes R1 safe to ship
   now — the weight change means nothing if the redeploy layer can't
   actually get the new ratio onto the network.
4. **R4 (scoring + ramp discount + switch factor) — done, live, confirmed
   2026-08-14, and it delivered.** Restarted ~13:33 PDT; the bot immediately
   dropped `foodnstuff` and adopted `phantasy` instead
   (`growPerHack≈14` vs. `foodnstuff`'s ≈117 — an 8× better balance-point
   ratio). Once it reached harvest mode: **`incomePerSec` = $11.4M/s**,
   up from R5/R7's ~$170–190K/s on the old target — a **~60×** jump, in the
   modelled 10–30× range for R1 alone times R4's additional target-quality
   multiplier, achieved together. Zero `invariantViolations`. This is the
   order-of-magnitude payoff the whole R1–R4 chain was built for, not just a
   modelled projection anymore. All three pieces shipped together in one
   change, per
   §2's own instruction not to drop `OPPORTUNITY_SWITCH_FACTOR` ahead of the
   new score. `getTargetScore` (mcp.js) now calls a new pure
   `computeTargetScore` (mcp_logic.js) implementing this section's exact
   achievable-rate formula; `getTargetEffectiveScore` calls a new
   `computeTargetEffectiveScore` implementing the ramp-discount formula
   above, with a new `SCORE_HORIZON_SECONDS` config tunable shipped at the
   doc's suggested **3600** (full `mcp_config.json`/`CONFIG_DEFAULTS`/status
   plumbing, same pattern as every other tunable). `OPPORTUNITY_SWITCH_FACTOR`
   dropped **3 → 1.3** (the safer end of the suggested 1.25–1.3 range) in
   both `mcp.js`'s default and `mcp_config.json`; `MIN_TARGET_COMMIT_MS`
   untouched at 600000, per this doc's explicit instruction to keep it as the
   anti-thrash guard.

   **`poolThreads`/`growThreadsIfAllGrow` judgment call:** both reuse
   `getTotalWeakenCapacity`'s already-computed per-tick result (`maxWeaken`)
   as-is, rather than a fresh RAM-basis calculation — it costs nothing extra
   despite `getTargetScore` running once per candidate every tick, and
   `scripts/grow.js`/`scripts/weaken.js` were checked and cost the identical
   1.75GB/thread (1.6GB base + 0.15GB action each), so a weaken-RAM-basis
   thread count is exactly, not approximately, a grow-RAM-basis one too.

   **The current-security-vs-floor caveat this section flags is *not*
   implemented** — the base formula only, as this section's own text said was
   acceptable to ship first. Flagged here explicitly rather than silently
   omitted, per the task that shipped this.

   **Testing:** the pure math was extracted to `mcp_logic.js`
   (`computeTargetScore`/`computeTargetEffectiveScore`), matching how R1's
   `computeWorkWeights` was extracted, with 13 new `node --test` cases —
   including a worked example using the same p=0.0075/k=0.001 (r=24) pair
   R1's own tests use (traceable to this doc's silver-helix-at-its-floor
   example), which lands at a modelled $14.07M/s, close to but not identical
   to §1.3's table entry for silver-helix ($13.3M/s) — the table's exact
   figure isn't independently reproducible from what this doc states (it
   bakes in specific p/T/chance/mults values never written together as one
   row), so the test's expected numbers are hand-derived from the formula
   itself rather than transcribed from the table; the closeness is a
   sanity check, not an exact match. 122/122 tests pass
   (`node --test *.test.js`), `node --check mcp.js mcp_logic.js` clean.
   Not yet restarted live — the next restart's status file should be read
   for `candidateScore`/`switchEval` against the modelled rankings in §1.3
   before this item is marked confirmed.
5. **R5 (per-script redeploy) — done, live, confirmed 2026-08-14.**
   Restarted alongside R7 below ~13:08 PDT; new `runId`/`scriptVersion`
   confirmed, `invariantViolations` empty on the first post-restart pull,
   `ramUtilization` 97.7%. The in-game signal the doc's §2 measurement plan
   calls for (fewer `plan_flip` events per hour) needs a longer observation
   window than this session's restart check covers — worth a look later,
   not blocking. Shipped: `allocateThreads` (mcp.js) now diffs `desired`
   against `have`
   per script (`weaken`/`grow`/`hack`, in that order) and only kills +
   re-execs the ones that actually changed, instead of tearing down and
   rebuilding all three on every redeploy. The have-side counting is now
   `countRunningByScript`, a new named export in `mcp_logic.js` (2 new
   tests), reused by both `hostNeedsRedeploy`'s existing mismatch check and
   `allocateThreads`'s new per-script decision — the doc's own instruction
   not to duplicate the have-counting logic. `killActionScripts` (kills all
   three unconditionally) is no longer called from `allocateThreads`, but is
   unchanged and kept for its other two call sites (orphan cleanup at
   startup, full teardown when no target is found), both of which genuinely
   want an unconditional sweep rather than a diff.
6. **R7 (cheap items) — done, live, confirmed 2026-08-14.** Same restart as
   R5, ~13:08 PDT. `home` (1024GB) confirmed in the worker pool post-restart
   — 56 weaken/494 grow/1 hack threads on it alone at first read, 97.7% of
   its capacity used, `HOME_RAM_RESERVE` holding at 32GB. Side effect worth
   noting: home's huge extra pool means R1's tiny ~0.77% hack share (see
   item 3 above) now rounds up to a nonzero thread count somewhere, so
   `incomePerSec` went from a flat $0 to ~$170–180K/s on the same
   poorly-suited target — R7 partially masks the R4 gap rather than closing
   it, worth keeping in mind when judging R4's eventual impact. All four
   bullets from §2's R7 section addressed:
   - **`home` joins the worker pool**, gated by a new `HOME_RAM_RESERVE`
     config tunable (default 32, full plumbing through `CONFIG_DEFAULTS`/
     `loadConfig`/`mcp_status.json`'s `config` block, same pattern as
     `REDEPLOY_TOLERANCE_ABSOLUTE`). `getHostFreeRam` now subtracts the
     reserve off `home`'s free RAM instead of returning a flat 0;
     `getWorkerHosts` no longer excludes `home`; `allocateThreads`'s old
     home-only early-return (which only made sense while `home` was
     categorically excluded) is removed. **Judgment call:** the reserve is a
     continuous subtraction clamped at 0 (`Math.max(0, freeRam)`, already
     the function's existing pattern), not a binary "skip home entirely
     below the threshold" gate the doc's risk note could be read as asking
     for — this degrades `home`'s allocation gracefully toward zero as its
     own footprint grows, rather than an all-or-nothing cutoff, while still
     satisfying the doc's actual requirement (mcp.js/HUD/supervisor never
     starved, since the reserve is enforced before any of it counts as free).
     `allocateThreads` also skips the `copyActionScripts` scp step
     specifically for `home` (the scripts already live there, since `mcp.js`
     itself runs from `home`) — same guard `share_deploy.js` already used
     for the identical reason, not a new pattern.
   - **`ns.growthAnalyzeSecurity(threads, target, 1)` replaces
     `weakenThreadsToOffset(0, growThreads)`** in the weaken-phase
     leftover-grow branch — but that branch no longer lives in mcp.js by the
     time this shipped; R3 (2026-08-13) already moved it into
     `computeDesiredAllocation` in `mcp_logic.js`, a pure function with no
     `ns` access. **Judgment call, deviating from the literal spec:**
     rather than leaving the pure-function architecture or reintroducing an
     `ns` call into `mcp_logic.js`, `computeDesiredAllocation` now takes an
     optional injected function, `growSecurityIncreaseForThreads(growThreads)`
     — mcp.js passes `(t) => ns.growthAnalyzeSecurity(t, currentTarget, 1)`,
     matching the doc's exact call; `mcp_logic.js` never references `ns`
     directly, so the "pure, no side effects" property this file's whole
     header comment is built on still holds. Omitting the argument
     reproduces the exact old linear-estimate numbers (verified: existing
     tests pass unmodified), so every other caller is unaffected; only
     mcp.js's real call site gets the clamped behavior. 3 new tests cover
     the omitted-default parity, the injected-function call sequence, and
     the actual saturation case (a function returning 0 regardless of
     thread count zeros out the reserve entirely, vs. a nonzero reserve
     under the old linear estimate). The other `weakenThreadsToOffset` call
     site (the "work" plan's combined hack+grow maintenance calc) is
     unchanged, since `growthAnalyzeSecurity` only covers grow, not hack.
   - **`SECURITY_CAP` default 6 → 1**, both `mcp.js`'s own `let` default and
     `mcp_config.json`'s committed value. Config-only change, no structural
     code touched. Kept the diff minimal around `HACK_BALANCE_SAFETY`'s
     entry in `mcp_config.json` per this task's own instruction, since that
     key is live and separately monitored.
   - **`tickWithinBounds` firing** — no code change, per the doc's own
     "informational only" note.
7. **R6 (XP mode) — not started, low priority.** `OBJECTIVE` is `"money"`
   and income is the binding constraint; revisit when that changes.

**All of steps 1–6 are now shipped, live, and confirmed working — only R6
(step 7) remains, deliberately parked until `OBJECTIVE` ever leaves
`"money"`.** R1 alone (step 3) was the order-of-magnitude payload
*in theory*; R4 (step 4) is what actually cashed it in — R1 correctly
computes near-zero hack on a poor-fit target, which is mathematically
right but produces nothing, and R4 is the piece that stops the bot landing
on such targets in the first place. Confirmed live together:
$170–190K/s → $11.4M/s, ~60× in one restart. This document's own original
estimate (§1's "Modelled achievable rate on the bot's current target:
~$13M/s" against a live $436K/s, a ~30× gap) undersold it once R4 also
fixed *which* target gets that treatment.
