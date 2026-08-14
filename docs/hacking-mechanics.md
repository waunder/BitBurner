# Hacking mechanics knowledge base

Reference for the actual math behind `ns.hack`/`ns.grow`/`ns.weaken` and
everything `mcp.js` decides around them. Companion doc:
`hacking-strategy.md` (analysis of `mcp.js` against this, with concrete
recommendations). This doc is the knowledge base — it grows as more gets
measured or extracted; it does not recommend anything itself.

## Status vocabulary

Same convention as `darknet-functions.md`, because the difference matters
here too:

| Tag | Means |
| --- | --- |
| **source** | Read directly out of the game's own original TypeScript, not a summary of it. See "Where this came from" below — this is a stronger claim than the darknet docs' "source" tag, which read `NetscriptDefinitions.d.ts` or minified bundle code. |
| **derived** | Reasoning on top of a **source** fact, or arithmetic combining two **source** facts. Premise is checkable; the inference could still be wrong. |
| **confirmed live** | Checked against real `mcp_status.json`/telemetry from this repo's own running instance. |
| **open question** | Known unknown, named so it doesn't get silently assumed later. |

## Where this came from

Bitburner is Electron + webpack. `NetscriptDefinitions.d.ts` (already in
this repo) gives function signatures and doc-comment remarks, but for
`ns.hack`/`grow`/`weaken` those remarks don't include the actual formulas —
just behavior descriptions. Grepping the installed app's minified
`dist/*.bundle.js` for known internal function names (`calculateHackingChance`
etc., as this repo already does successfully for darknet's password models)
**failed** — those names don't survive this build's minification, unlike the
string-literal wordlists that made the darknet extraction work.

What did work: `dist/main.bundle.js.map` is shipped alongside the bundle
(`ls dist/*.map` — present, ~7MB) and its JSON has a **`sourcesContent`**
array with the complete original, unminified TypeScript for all 895 source
files, keyed 1:1 against `sources`. This is not reconstructed or
decompiled — it's the literal pre-build source the installed
`Bitburner.app` (Steam build, v3.0.1, confirmed via the app's own
`package.json`) was compiled from. Every formula below was extracted this
way, by locating the source file (`src/Hacking.ts`,
`src/Server/formulas/grow.ts`, `src/Server/ServerHelpers.ts`,
`src/Server/data/Constants.ts`, `src/Netscript/RamCostGenerator.ts`,
`src/Server/Server.ts`) inside that array and reading it directly:

```python
import json
with open("main.bundle.js.map") as f:
    d = json.load(f)
idx = d["sources"].index("webpack:///./src/Hacking.ts")
print(d["sourcesContent"][idx])
```

Path used this session: `~/Library/Application Support/Steam/steamapps/
common/Bitburner/bitburner.app/Contents/Resources/app/dist/
main.bundle.js.map` (macOS Steam install). Re-run the same extraction if
the game updates — a version bump could change any constant below, and
nothing here is pinned to auto-detect that.

**This technique generalizes** — any game mechanic (IPvGO scoring,
darknet-adjacent code, faction rep formulas) can be looked up the same way
instead of reverse-engineered from the minified bundle or guessed. Worth
remembering next time a doc here says "derived" or "speculative" for lack
of a source.

## Core hacking formulas — `src/Hacking.ts` (source)

All four take `(server, person)` — a `Server` object and a `Person`
(player) object, matching what `ns.getServer(target)`/`ns.getPlayer()`
return.

**Hack chance** (`calculateHackingChance`):
```
hackFactor = 1.75
difficultyMult = (100 - hackDifficulty) / 100
skillMult = max(hackFactor * player.hacking, 1)
skillChance = (skillMult - requiredHackingSkill) / skillMult
chance = clamp(skillChance * difficultyMult * player.mults.hacking_chance
               * intelligenceBonus(player.intelligence), 0, 1)
```
Returns 0 outright if the server isn't rooted or `hackDifficulty >= 100`.
Two independent security-reduction levers here: `difficultyMult` scales
chance *linearly* with security, separate from its (larger) effect on time.

**Percent money stolen per thread** (`calculatePercentMoneyHacked`):
```
balanceFactor = 240
difficultyMult = (100 - hackDifficulty) / 100
skillMult = (player.hacking - (requiredHackingSkill - 1)) / player.hacking
percentPerThread = clamp(difficultyMult * skillMult * player.mults.hacking_money
                          * BitNodeMults.ScriptHackMoney / balanceFactor, 0, 1)
```
This is `ns.hackAnalyze(target)` — money stolen scales **linearly** with
thread count up to 100% (`ns.hack` with N threads steals
`min(1, N * percentPerThread)` of current `moneyAvailable`).

**Hack exp per thread** (`calculateHackingExpGain`):
```
baseExpGain = 3
diffFactor = 0.3
expGain = (baseExpGain + baseDifficulty * diffFactor) * player.mults.hacking_exp
          * BitNodeMults.HackExpGain
```
Uses `server.baseDifficulty` (security **at server creation**, frozen), not
current `hackDifficulty` — weakening a target does not reduce its hack XP
value. Multiply by thread count for total.

**Hack time** (`calculateHackingTime`, seconds):
```
difficultyMult = requiredHackingSkill * hackDifficulty
baseDiff = 500; baseSkill = 50; diffFactor = 2.5
skillFactor = (diffFactor * difficultyMult + baseDiff) / (player.hacking + baseSkill)
hackTimeMultiplier = 5
hackingTime = (hackTimeMultiplier * skillFactor)
              / (player.mults.hacking_speed * BitNodeMults.HackingSpeedMultiplier
                 * intelligenceBonus(player.intelligence))
```
**Grow time** = `3.2 * hackTime` exactly (`growTimeMultiplier = 3.2`).
**Weaken time** = `4 * hackTime` exactly (`weakenTimeMultiplier = 4`).
Both ratios are hardcoded constants relative to hack time on the *same*
target/player — confirms `mcp.js`'s own comment (`WEAKEN_PER_HACK_RATIO = 4`,
`WEAKEN_PER_GROW_RATIO = 1.25 = 4/3.2`) is exactly right, not an
approximation.

**Note on `requiredHackingSkill * hackDifficulty` inside hack time**:
security (`hackDifficulty`) affects *time* multiplicatively alongside
required skill, not additively and not the same way it affects *chance*
(which uses `(100-difficulty)/100`, capped at 100). A target weakened to
its floor is faster to hack **and** more likely to succeed **and** (per
`calculatePercentMoneyHacked` above) yields more money per thread — all
three hacking economics improve together as security drops, there is no
trade-off between them.

## Grow formula — `src/Server/formulas/grow.ts` + `src/Server/ServerHelpers.ts` (source)

Growth is **exponential per thread**, not linear — this is the one place
naive "threads needed = money short / money per thread" reasoning breaks.

```
adjGrowthLog = min(log1p(0.03 / hackDifficulty), ServerMaxGrowthLog)   // ServerBaseGrowthIncr=0.03
serverGrowthPct = (server.serverGrowth / 100) * BitNodeMults.ServerGrowthRate
coreBonus = 1 + (cores - 1) / 16
growthLog(threads) = adjGrowthLog * serverGrowthPct * player.mults.hacking_grow
                      * coreBonus * threads
serverGrowthMultiplier(threads) = exp(growthLog(threads))
```
Then the actual money change (`calculateGrowMoney`):
```
moneyAfter = (moneyAvailable + threads) * serverGrowthMultiplier(threads)
             // capped at moneyMax
```
The `+ threads` before the multiply is a real, if small, **additive** term
(each grow thread adds $1 before the multiplicative growth is applied) —
negligible at scale but means grow is never fully a no-op even on a
$0 server with 0% chance of being "capped at max already".

**Threads needed to reach a target amount** is not a closed form — the
game solves it via Newton-Raphson (`numCycleForGrowthCorrected` in
`ServerHelpers.ts`, the function behind `ns.growthAnalyze`/
`formulas.hacking.growThreads`). Worth knowing this exists as an exact
game function rather than an approximation to reimplement — `mcp.js`
currently doesn't call it at all (see `hacking-strategy.md`).

**Security cost of growing is not linear in threads either**: `grow`
increases security by `2 * ServerFortifyAmount` (see below) **per
completed growth cycle**, and the number of growth cycles consumed by N
threads is itself computed via `numCycleForGrowthCorrected`, capped at
`min(usedCycles, threads)` — so security cost saturates as the server
approaches `moneyMax` (each additional thread does less multiplicative
work once already near the cap, hence fewer effective "cycles").

## Security mechanics — `src/Server/data/Constants.ts` + `ServerHelpers.ts` (source)

```
ServerFortifyAmount = 0.002   // hack: +0.002 security per thread per completed hack
                               // grow: +0.004 security per *growth cycle* (2x hack's rate)
ServerWeakenAmount  = 0.05    // weaken: -0.05 security per thread per completed weaken,
                               // before core bonus
coreBonus(cores) = 1 + (cores - 1) / 16
weakenEffect(threads, cores) = 0.05 * threads * coreBonus(cores) * BitNodeMults.ServerWeakenRate
```
Matches `mcp.js`'s own `HACK_SEC_INCREASE = 0.002`, `GROW_SEC_INCREASE =
0.004`, `WEAKEN_SEC_DECREASE = 0.05` constants exactly — **confirmed
correct against source**, not just self-consistent.

**Minimum security floor**, from `Server.ts`'s constructor:
```
minDifficulty = clamp(round(baseDifficulty / 3), 1, 100)
```
Set once at server creation from the server's *starting* security, not
recomputed later. `capDifficulty()` (called by both `fortify()` and
`weaken()`) clamps `hackDifficulty` into `[minDifficulty, 100]` on every
change — so weaken threads that would drop security below the floor simply
waste their effect below that point; there's a hard wall, not diminishing
returns.

**No passive security decay.** `Server`'s `fortify()`/`weaken()` are the
only two places `hackDifficulty` changes; nothing in `Server.ts` or
`ServerHelpers.ts` reduces it over real time on its own. A target left
completely alone stays at whatever security it was last at, indefinitely.
(This confirms an assumption `mcp.js` already makes implicitly — worth
having it as **source** rather than assumed.)

**`moneyMax` formula**, also from `Server.ts`'s constructor:
```
moneyMax = 25 * baseMoneyParam * BitNodeMults.ServerMaxMoney
```
with a **soft cap above $10T**: `changeMaximumMoney` (called when
BitNode/augmentation multipliers apply) compounds sub-linearly past that
point via `1 + (n-1)/log(aboveCap)/log(8)`. Not relevant at this project's
current money scale but worth knowing the cap exists and isn't a hard wall.

## RAM costs — `src/Netscript/RamCostGenerator.ts` (source)

```
Base (script baseline)  = 1.6 GB
hack()                  = 0.1 GB
grow()                  = 0.15 GB
weaken()                = 0.15 GB
hackAnalyze()/Chance()/growthAnalyze()/weakenAnalyze() = 1.0 GB each
scan()                  = 0.2 GB
scp()                   = 0.6 GB
exec()                  = 1.3 GB
share()                 = 2.4 GB (from NetscriptDefinitions.d.ts remark, not yet cross-checked against this file)
```
So a worker script's total footprint = `1.6 + (0.1 | 0.15 | 0.15)` for
hack/grow/weaken respectively = **1.70 / 1.75 / 1.75 GB** — matches
`mcp.js`'s own "~1.75GB" comment and the live `ramInfo` values read every
tick via `ns.getScriptRam`. **Confirmed correct against source.**

## Derived metrics — money-per-thread-second

Combining the above (derived, not a separate game function): expected
$/thread/second from continuously re-hacking a target held at some
security/money level:

```
$ per hack thread per second = (moneyAvailable * percentMoneyHacked(target)) / hackTime(target)
```

Both `percentMoneyHacked` and `hackTime` improve as security drops toward
the floor (see the hack-time note above), and `hackTime` is the *only* one
of the three action times that scales directly with player hacking skill
in the denominator (`player.hacking + baseSkill`) — so **all three actions
get cheaper in wall-clock time as hacking skill rises**, at the fixed 4x/
3.2x ratios to each other. This means the RAM-cost-per-thread of
hack/grow/weaken never changes, but the *rate* of completed cycles per
minute rises with hacking level — a fixed thread allocation becomes
strictly more productive over time on the same target, with no code change
required. Relevant to `hacking-strategy.md`'s discussion of redeploy
cadence and target hold times.

## Live telemetry — confirmed live 2026-08-13

Pulled from this repo's own running `mcp.js` instance (`mcp_status.json`),
not simulated:

- Player: hacking skill **853**, ~$7B cash, hack chance reads **100%**
  against the current target (security low enough that `calculateHackingChance`
  saturates at the 1.0 clamp).
- Current target `silver-helix`: `moneyPct` 0.3% (just adopted/drained),
  security 13.7 vs. cap 6 (`SECURITY_CAP` config) → `needWeaken` 75 threads
  network-wide. `hackTimeS` 19.4s / `growTimeS` 62.0s / `weakenTimeS` 77.5s
  — ratios 3.20x and 4.00x exactly, matching the source constants above to
  the observable precision.
- 37 worker hosts, network RAM utilization **98.3%** (1734/1764 GB).

**A real, reproducible bug found via this data, not inferred**: summing
actual deployed threads across all 37 workers this tick gives **172 weaken
threads running**, while `needWeaken` (the live, freshly-recomputed
requirement) is **75** — and the event log shows `weakenBudgetNonNegative`
firing every single tick during this phase (570 occurrences and counting,
`remaining: -97, required: 75` — 172 − 75 = 97 exactly). Root cause,
confirmed by reading `allocateThreads`/`hostNeedsRedeploy` in `mcp.js`:
weaken threads deployed on an earlier tick (when security — and therefore
`needWeaken` — was much higher) are never scaled back down as security
drops, because `hostNeedsRedeploy` only forces a redeploy on a *type*
mismatch (hack running during a weaken plan, or nothing running at all),
not on a *quantity* mismatch. The already-running threads still count
against the newly-shrunk budget in `allocateThreads`'s no-redeploy branch,
driving `remaining` negative every tick until the phase ends naturally.
This is the first live root-cause for the `weakenBudgetNonNegative`
invariant this project has flagged (unexplained) since 2026-08-10 — see
`hacking-strategy.md` for what to do about it; this doc only records what
was found.

## Additional source facts — confirmed 2026-08-13, while writing `hacking-strategy.md`

Extracted the same way (source map `sourcesContent`), filling in several of
the open questions below:

- **`hack()`'s exact implementation** — `src/Netscript/NetscriptHelpers.tsx`'s
  `hack()` function, not just the `calculatePercentMoneyHacked` formula above:
  `moneyDrained = server.moneyAvailable * percentHacked * threads` (confirms
  money stolen is linear in threads, clamped to `moneyAvailable` — not
  exponential). Security fortify on a successful hack is
  `ServerFortifyAmount * Math.min(threads, Math.ceil(1/percentHacked))` — so
  hack threads deployed past the 100%-drain point cost RAM but add **no
  extra security**, confirmed by the same cap appearing independently in
  `hackAnalyzeSecurity`'s implementation. **A failed hack fortifies nothing.**
  And: `if (moneyDrained === 0) expGainedOnSuccess = expGainedOnFailure` —
  hacking a server sitting at exactly $0 yields the same reduced XP as a
  failed hack (`expGainedOnFailure = expGainedOnSuccess / 4`, i.e. **25%**).
  This means hack XP is independent of *how much* money is stolen, but
  **not** independent of whether the server balance is exactly zero —
  narrower than "XP is money-independent," which is the premise `mcp.js`'s
  own OBJECTIVE comment and this project's XP-mode design were built on.
- **`grow()`/`weaken()` XP** — `src/NetscriptFunctions.ts`: both grant
  `calculateHackingExpGain(server, Player) * threads`, the **same
  per-thread XP formula as a successful hack**. XP is not a hack-only
  reward.
- **`growthAnalyze(host, mult, cores)` = `numCycleForGrowth(server, mult,
  cores)` = `Math.log(mult) / calculateServerGrowthLog(server, 1, Player,
  cores)`** (`src/NetscriptFunctions.ts` → `src/Server/ServerHelpers.ts`) —
  confirmed exact, using the real live `Player` object (every multiplier
  included), not a mock. Consequence: `k` (this doc's per-thread growth log
  constant) is recoverable **exactly**, live, in-game, for 1 GB and without
  Formulas.exe, as `Math.LN2 / ns.growthAnalyze(target, 2)`. This is the
  fact that makes several of `hacking-strategy.md`'s recommendations not
  need Formulas.exe at all.
- **Every `ns.formulas.*` function costs 0 GB** (`src/Netscript/
  RamCostGenerator.ts` — the entire `formulas` tree, `hacking`/
  `reputation`/`skills`/`hacknetNodes`/`hacknetServers`/`gang`/`work`
  subtrees, is all-zero). Formulas.exe is a **program** prerequisite only,
  never a RAM cost — the "RAM cost" framing in this doc's first draft was
  wrong to even ask the question that way.
- **`share()` = 2.4 GB, `getSharePower()` = 0.2 GB** — cross-checked
  directly against `RamCostGenerator.ts` (`share: 2.4, getSharePower: 0.2`
  in the `ns` cost map). Confirms the `.d.ts` remark this doc originally
  relied on; no longer just "unverified against the RAM-cost file directly."
- **`Server.ts`'s `moneyMax`/`minDifficulty` formulas cross-checked against
  real data**: `src/Server/data/servers.ts`'s static per-host table plus
  live readings confirm `silver-helix` (`baseDifficulty` 30 → `minDifficulty`
  10) and `max-hardware` (base 15 → min 5) both match `round(base/3)`
  exactly. The static table is therefore usable for offline whole-network
  modelling without a live `ns.getServer` call per host.

## Open questions

- **BitNode multipliers** (`currentNodeMults.*` — `ScriptHackMoney`,
  `HackingSpeedMultiplier`, `ServerGrowthRate`, `ServerWeakenRate`,
  `HackExpGain`, `hacking_grow`, etc.) scale nearly every formula above but
  still weren't looked up per-BitNode — `src/BitNode/BitNodeMultipliers.ts`
  has the real per-node table if this ever needs pinning down exactly.
  `hacking-strategy.md` backed several of these out of live telemetry
  instead (e.g. `mults.hacking_money ≈ 2.15`, `mults.hacking_grow` still
  fully open and assumed 1.0) — see that doc's §1.2 for the calibration and
  how much of the dollar-figure modelling depends on it.
- **`formulas.hacking.growThreads`** (the exact Newton-Raphson solver) is a
  real in-game function, confirmed 0 GB (see above) but still gated on
  owning Formulas.exe — ownership on this save is still **not checked**
  (`ns.fileExists("Formulas.exe", "home")` would settle it in one read).
  `hacking-strategy.md` §3.1 argues it isn't actually needed for the
  continuous-loop farming this repo does, precisely because of the
  `growthAnalyze` fact above — worth reading before assuming Formulas.exe
  ownership matters here.
- **Passive server growth**: confirmed no passive security decay exists;
  did *not* separately verify whether `moneyAvailable` has any passive
  regeneration outside of `grow()` calls (nothing found in `Server.ts`
  suggests it does — money is server state that only `hack`/`grow` touch —
  but this wasn't traced as thoroughly as security was).
