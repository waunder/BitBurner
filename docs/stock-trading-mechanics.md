# Stock market mechanics

> **Governance status, 2026-08-15:** this remains the read-only mechanics
> reference. Contrary to older “no capital calls exist” wording below, an
> untracked `mcp_stock_trader.js` artifact now contains buy/sell calls and is
> quarantined; no sync, run, commit for promotion, or capital deployment is
> authorized.

Reference for `ns.stock.*` and how Bitburner's World Stock Exchange actually
works underneath the API. Companion doc: `stock-trading-strategy.md`
(sequencing and what's worth buying, for this player specifically). Style and
status vocabulary follow `darknet-functions.md`.

## Status vocabulary

| Tag | Means |
| --- | --- |
| **source** | Read out of the game's own files — `NetscriptDefinitions.d.ts` in this repo, or the installed bundle. Not observed in play, but not a guess either. |
| **derived** | Reasoning on top of a **source** fact. The premise is checkable; the inference could be wrong. |
| **confirmed live** | Actually observed running in this player's game (via `mcp_stocks.js` or an event log), not just read from source. |
| **speculative** | A guess, called out as one. |
| **community** | From public Bitburner community documentation/discussion, not this repo's own source read. Used only to corroborate, never as the sole basis for a claim. |

### Where the facts came from

Two local sources, both re-checkable:

- `/Users/kth/Documents/BitBurner/NetscriptDefinitions.d.ts` — full JSDoc for
  the `Stock` interface (search `export interface Stock`, line 1258 as of
  this writing) and its supporting types (`StockMarketConstants`,
  `StockOrder`, `PositionType`, `OrderType`). Gives every function's
  signature, RAM cost, and behavioural description, but not the actual
  numeric constants (commission amount, purchase costs) — those are typed
  `number` with no literal value in the `.d.ts`.
- The installed bundle:
  `/Users/kth/Library/Application Support/Steam/steamapps/common/Bitburner/bitburner.app/Contents/Resources/app/dist/main.bundle.js`
  Minified, one enormous line — same file the darknet docs used, same
  caveat: byte offsets drift between game versions, search strings are the
  durable handle. Strings that work today: `WseAccountCost:` (the constants
  literal, module `518123`), `cycleForecast` / `getAbsoluteForecast` (the
  `Stock` class, module `362983`), `function T(e=1)` (the per-tick price
  update loop, module `889735`), `getForecast:e=>t=>` (the NS function
  implementation and its 4S gate, module boundary near offset 1561878),
  `prestigeAugmentation` (module `681302`ish — the reset-on-augmentation-
  install function), `installAugmentations` (the in-game UI copy listing
  what an install resets).

Also used once: `WebFetch` against the upstream project's own published
`bitburner.stock.md` API doc (GitHub, `bitburner-official/bitburner-src`,
`dev` branch) to cross-check the `.d.ts` reading, and one `WebSearch` for
community-documented "no 4S" trading approaches, cited inline where used —
**community** tag, corroboration only.

One thing worth flagging up front: **nothing in this document has been
exercised through a live trade.** `mcp_stocks.js` has confirmed the read-only
surface (`hasWseAccount`, `hasTixApiAccess`, `has4SDataTixApi`, `getSymbols`,
`getPrice`, `getPosition`) works as described, live, in this player's game
(2026-08-09). The trading functions (`buyStock` etc.) are read from source
only, and per the standing rule in `CLAUDE.md`/`process-backlog.md`, nothing
in this repo calls them without Ken's explicit go-ahead.

---

## Access tiers

Four separate purchases gate the stock market, each independently priced and
independently persistent. **source**, exact literal from module `518123`:

```js
{msPerStockUpdate:6e3, msPerStockUpdateMin:4e3, TicksPerCycle:75,
 WseAccountCost:2e8, TixApiCost:5e9, MarketData4SCost:1e9,
 MarketDataTixApi4SCost:25e9, StockMarketCommission:1e5}
```

| Purchase | Function | Cost | Unlocks |
| --- | --- | --- | --- |
| WSE Account | `purchaseWseAccount()` | $200m | Trading via the in-game **UI**. Not required for scripts. |
| TIX API Access | `purchaseTixApi()` | $5b | Trading via **`ns.stock.*`** — everything except `getForecast`/`getVolatility`. |
| 4S Market Data (UI) | `purchase4SMarketData()` | $1b | Forecast/volatility numbers in the **UI only**. Unrelated to scripts. |
| 4S Market Data TIX API | `purchase4SMarketDataTixApi()` | $25b | `getForecast()`/`getVolatility()` from **scripts**. |

**The UI and script paths are fully independent** — the `.d.ts` says this
explicitly for both 4S functions ("this feature only unlocks access... in
the Stock Market UI" / "...via NS APIs") and for the base pair ("if you want
to perform actions via NS APIs, you need... TIX API access, not this
[WSE] account"). A player can have full UI access and zero script access, or
the reverse. **This is the load-bearing fact for the strategy doc**: the $1b
UI-only 4S tier and the $25b scripted 4S tier are not a bundle — buying one
does not get you closer to the other, and they serve different purposes
(manual trading in the UI vs. a script reading the same signal).

**Ken's current access, per this session's live `mcp_stocks.js` output and
the task brief:** WSE yes, TIX yes, 4S (either variant) no. Both trading
functions and every non-4S read function are therefore live and callable
from a script right now — only `getForecast`/`getVolatility` throw.

### What resets when

**source**, from diffing two functions in the player-prestige module: one
(the augmentation-install reset — the function chain ending in
`this.reapplyAllAugmentations(...)`) resets skills, money, jobs, city,
scripts-off-home, and — per the game's own in-UI copy on the Augmentations
page (`"Installing your Augmentations resets most of your progress,
including: ... - Stocks"`) — stock **positions**. It does **not** assign to
`hasWseAccount`, `hasTixApiAccess`, `has4SData`, or `has4SDataTixApi`
anywhere in its body.

A second, separate function — the BitNode-destroy reset, invoked when
starting a new BitNode rather than installing an augmentation — explicitly
does: `this.hasWseAccount=!1,this.hasTixApiAccess=!1,this.has4SData=!1,
this.has4SDataTixApi=!1` alongside `this.gang=null`, `this.corporation=null`,
`this.augmentations=[]`.

So: **augmentation installs wipe your stock positions but not your
WSE/TIX/4S access flags. Only destroying the current BitNode clears the
access flags.** This matches what `docs/processes.md`'s `mcp_stocks.js`
section already asserted from an earlier source read (line ~482), and is
independently re-derived here. It also matches this session's live
observation: WSE/TIX access still `yes/yes` post-install, with 0 positions.

**Practical consequence:** there is no "use it or lose it" pressure on a
WSE/TIX/4S purchase from augmentation installs — the money spent on access
survives every install. Only open *positions* need to be closed before an
install (see the strategy doc).

---

## Function reference

RAM costs **source**, from the same symbolic table the darknet doc used
(module with `GetStock:2,BuySellStock:2.5,...`) plus the explicit
`hasWseAccount:.05,hasTixApiAccess:.05,has4SData:.05,has4SDataTixApi:.05`
entries found alongside it. All match the `.d.ts` `@remarks RAM cost`
annotations exactly — cross-checked, not just read once.

| Function | RAM | Gate | Notes |
| --- | --- | --- | --- |
| `getConstants()` | 0 | none | Returns the literal table above via `structuredClone`. |
| `hasWseAccount()` / `hasTixApiAccess()` / `has4SData()` / `has4SDataTixApi()` | 0.05 each | none | Read the four flags directly. |
| `getBonusTime()` | 0 | none | Accumulated offline/inactive time; updates run faster while it's nonzero. |
| `nextUpdate()` | 0 | none | `await`s the next tick, resolves to `6000` (ms of game-time processed, not wall time). |
| `getSymbols()` | 2 | WSE+TIX | All tradable symbols. |
| `getPrice()` / `getOrganization()` / `getAskPrice()` / `getBidPrice()` / `getPosition()` / `getMaxShares()` / `getPurchaseCost()` / `getSaleGain()` | 2 each | WSE+TIX | Reads. `getPrice()` is the bid/ask average. |
| `buyStock()` / `sellStock()` | 2.5 each | WSE+TIX | Market orders, long positions. |
| `buyShort()` / `sellShort()` | 2.5 each | WSE+TIX **and** (BitNode 8 or SF8 level ≥ 2) | See below — this gate is separate from and in addition to TIX access. |
| `placeOrder()` / `cancelOrder()` / `getOrders()` | 2.5 each | WSE+TIX **and** (BitNode 8 or SF8 level ≥ 3) for place/cancel; `getOrders` only needs WSE+TIX | Limit and stop orders. |
| `getVolatility()` / `getForecast()` | 2.5 each | **4S Market Data TIX API specifically** | Throw `"You don't have 4S Market Data TIX API Access!"` otherwise — confirmed by the literal guard `if(!r.ai.has4SDataTixApi)throw ...` at the top of both implementations. `has4SData` (the UI flag) does **not** satisfy this check; this is the exact bug `mcp_stocks.js` hit and fixed (`docs/processes.md` line ~472). |
| `purchase4SMarketData()` / `purchase4SMarketDataTixApi()` / `purchaseWseAccount()` / `purchaseTixApi()` | 2.5 each | none (money-gated instead) | Each returns `true` if already owned, so idempotent to call. |

### Shorting and limit/stop orders — likely unavailable to Ken right now

**source** for the gate:

```js
// buyShort / sellShort:
if (8 !== bitNodeN && activeSourceFileLvl(8) <= 1)
  throw "You must either be in BitNode-8 or you must have Source-File 8 Level 2."

// placeOrder / cancelOrder:
if (8 !== bitNodeN && activeSourceFileLvl(8) <= 2)
  throw "You must either be in BitNode-8 or you must have Source-File 8 Level 3."
```

Source-File 8 is only granted by *destroying* BitNode 8 at least once; it
cannot be earned from within BitNode 1. **derived**, not directly checked
in-game (nothing in this repo can read `ns.getResetInfo()` or a source-file
list without running a script): this repo's save file is named
`bitburnerSave_1786302674_BN1x1.json.gz` (`saves/`). Bitburner's own save
naming convention is `BN<current bitnode>x<times that bitnode has been
completed>` — `BN1x1` reads as "BitNode 1, first pass, not yet destroyed
once." If that reading is right, Ken currently holds **zero Source Files of
any kind**, which would mean `buyShort`/`sellShort`/`placeOrder`/
`cancelOrder` all throw regardless of TIX access, independent of money.
Flagged as **derived** because the inference chain (filename convention →
SF count) is standard community knowledge but this repo has never actually
called `ns.getResetInfo()` to confirm it for this save. Worth a one-line
check (`ns.tprint(JSON.stringify(ns.getResetInfo()))`, near-zero RAM) the
next time a script runs, since it settles this outright.

This doesn't affect the read-only functions or plain long-position
buy/sell — those work in every BitNode with just TIX access.

---

## How price actually moves

**source**, from the per-tick update loop (module `889735`, function bound
to `ns.stock.nextUpdate()`'s resolution and the passive background clock).

### The tick

A "tick" happens roughly every `msPerStockUpdate` = 6000ms of real time
(4000ms minimum during bonus/offline time — `msPerStockUpdateMin`). Each
tick, for every stock independently:

1. **One shared random draw** `n = Math.random()` is taken *per tick, not
   per stock* — the magnitude-of-move draw is correlated across all stocks
   in the same tick, though each stock's own `mv` (volatility) and
   `otlkMag`/`b` (its own trend state) scale and gate it independently.
2. **Magnitude**: `r = n * mv * NF(symbol) / 100`, where `mv` is the stock's
   static volatility stat (randomized once per stock at game start, in the
   ranges seen in the stock-definition table — e.g. E-Corp `mv: 40–50`,
   FourSigma `mv: 100–110`) and `NF(symbol)` is `1` by default. `NF` is
   `1 - e^(-0.001·promo) + 2·(1 - e^(-0.00015·promo)) + 1`, where `promo` is
   the darknet `promoteStock()` accumulator for that symbol (see
   `darknet-functions.md` §(d)) — **this is the confirmed mechanism** behind
   that doc's claim that `promoteStock` "raises volatility without touching
   forecast": it feeds `NF`, which only appears in the magnitude term `r`,
   never in the direction-probability term below. Decays by ×0.4 every
   `TicksPerCycle` ticks if unrefreshed.
3. **Direction probability**: `i = (50 + otlkMag) / 100` if the stock is
   currently "bull" (`b === true`), or `(50 - otlkMag) / 100` if "bear".
   `otlkMag` is clamped to `[0, 50]`, so `i` ranges `[0.5, 1.0]` bull or
   `[0.0, 0.5]` bear — a stock is never exactly a coin flip except at
   `otlkMag = 0`, and never *more* than fully deterministic (`i` tops out at
   1.0, bottoms at 0.0). This is exactly what `getForecast()` returns
   (below) — the direction probability is not a derived signal, it *is* the
   literal per-tick coin-flip weight.
4. A second random draw `s = Math.random()` decides the move: `s < i` →
   price multiplies by `(1 + r)` (up); otherwise price *divides* by
   `(1 + r)` (down, not `× (1 - r)` — this makes down-moves slightly smaller
   in absolute terms than up-moves of the same `r`, and keeps price
   strictly positive).
5. **Hard cap**: if price reaches a per-stock cap (randomized once,
   1000×–25000× the initial price), that tick's `i` is forced to `0.1` and
   `b` forced to `false` — a soft ceiling, not a hard block; the stock can
   still occasionally tick up but is heavily biased down until it falls
   back under the cap. Irrelevant at realistic price levels.
6. **Forecast drift**: after the price moves, `otlkMag` itself gets nudged
   by `c = otlkMag * r` (boosted 10× if `otlkMag ≤ 1`, so small trends don't
   get permanently stuck near zero), via `cycleForecast(c)` — which itself
   has a *further* random component (see below). This is why a trend, once
   established, tends to reinforce rather than instantly reverse — but it's
   probabilistic reinforcement, not guaranteed.
7. **Regime flip**: independent of the above, every `TicksPerCycle` = 75
   ticks (≈7.5 minutes of real time at the normal 6s tick), each stock has a
   flat **45% chance** of a full flip: `b = !b` plus
   `otlkMagForecast = 100 - otlkMagForecast`. This is the mechanism behind
   "stocks trend, then eventually reverse" — the reversal is a real,
   scheduled coin-flip event, not just drift.

### Two forecast variables, not one

The `Stock` class carries both `otlkMag`/`b` (the *ground-truth* trend that
directly drives the direction probability above) and a separate
`otlkMagForecast` (a slower-moving anchor). `cycleForecast()` — the function
that nudges the ground truth after every price move — is itself biased by
how far `otlkMagForecast` has drifted from the current ground-truth absolute
forecast (`getForecastIncreaseChance()`): the further apart they are, the
more likely the ground truth moves *toward* the anchor. Practically: the
"trend within a trend" has genuine short-term momentum layered on top of the
75-tick regime-flip schedule, not just white noise. This is **source**-read
but its outside-of-price-mechanics *purpose* (a hidden slower-moving anchor)
isn't documented anywhere in the `.d.ts` or the tutorial — logged here as
the most speculative-feeling part of an otherwise literal read, flagged as
such rather than asserted with more confidence than it deserves.

### `getForecast()` / `getVolatility()` — literal reads, not derived numbers

**source**, the actual NS-function bodies:

```js
getVolatility: (sym) => stock.mv * NF(sym) / 100
getForecast:   (sym) => (stock.b ? 50 + stock.otlkMag : 50 - stock.otlkMag) / 100
```

Both are exactly the per-tick formulas above, exposed directly — 4S data
isn't a smoothed or lagged indicator layered on top of the mechanic, it's a
direct read of the two hidden numbers (`mv`, `otlkMag`+`b`) that already
govern the tick. Once you have it, you know the true current coin-flip
weight and the true current maximum per-tick move size, with no estimation
error at all (until the next regime flip or forecast-drift step changes
them, which 4S also sees immediately on the next read).

### Commission, spread, and "large transactions influencing price"

**source**:

- **Commission**: flat `$100,000` (`StockMarketCommission = 1e5`) per
  transaction, buy or sell, long or short — not a percentage. Charged inside
  `getPurchaseCost`/`getSaleGain`, so `ns.stock.buyStock()`'s effective cost
  already includes it; there's no separate deduction to account for.
- **Spread**: `getAskPrice() = price × (1 + spreadPerc/100)`,
  `getBidPrice() = price × (1 - spreadPerc/100)`, with `spreadPerc` a static
  per-stock stat (roughly 1–10 in the ranges seen). `getPrice()` is the
  simple average of the two, so a round-trip (buy at ask, sell at bid) costs
  the full spread even at an unchanged mid-price, on top of two $100k
  commissions.
- **"Large transactions influencing price"** (the `.d.ts` docstring on
  `getPurchaseCost`/`getSaleGain`) is **not** slippage on the trade itself —
  the ask/bid spread is fixed regardless of order size. It's a *forecast*
  nudge: each stock has a `shareTxForMovement` threshold (per-stock, ranges
  around 30k–90k shares in the data seen); once cumulative volume you've
  traded crosses it, `otlkMag` and `otlkMagForecast` get nudged by a small
  fixed amount (`0.006` base, scaled by how many thresholds were crossed and
  by `mv/100`). A single retail-sized trade is normally far below the
  threshold and has no effect; sustained heavy trading in one symbol can
  measurably move its own forecast over time. This is a real, if small, feedback
  loop a fully-automated trader would need to account for — not relevant
  to a human placing occasional manual trades.

### No market-wide event system found

Nothing in the portion of the bundle read for this doc suggests a scripted
market-wide crash/boom/news-event system (the kind some other idle games
have). Movement appears to be entirely the per-stock random walk described
above, no shared "market sentiment" variable beyond the shared magnitude
draw `n` in step 1. **Not a confident negative** — the search was targeted
at the stock-market module specifically and didn't exhaustively scan
corporation-related code (a player-owned corporation's own stock, if ever
relevant, is a different mechanic entirely and out of scope here).

---

## Trading without 4S data

Confirmed possible and confirmed *done by other players*, per public
community discussion (**community**, via `WebSearch` this session, general
Bitburner subreddit/forum consensus — not this repo's source read): the
standard technique is an exponential moving average over observed up/down
ticks, e.g. seed each symbol's estimate at `0.5`, then on every tick where
`newPrice > oldPrice`, `estimate = estimate*0.99 + 1*0.01`, else
`estimate = estimate*0.99 + 0*0.01`. This converges toward the same number
`getForecast()` would give directly — but slowly, and with two real
handicaps this source read explains precisely:

- **It's chasing a moving target.** The 45%-per-75-tick regime flip (see
  above) means the "true" forecast a naive EMA is trying to track can
  invert entirely roughly every 7.5 minutes on average. An EMA with a
  0.99 decay constant needs on the order of 50–100 ticks (5–10 minutes) to
  converge meaningfully — comparable to or slower than the regime's own
  half-life. A 4S-equipped reader sees the *exact* current state
  instantaneous every tick; an EMA-equipped one is perpetually lagging
  behind a target that itself keeps moving.
- **Volatility has no cheap proxy at all.** `getVolatility()`'s formula
  (`mv * NF / 100`) depends on a static per-stock stat with no public
  in-game readout anywhere outside the 4S call — the closest a script can
  get without it is empirically tracking the observed max tick-to-tick
  percentage swing, which is a lagging, noisy estimate of a number that (in
  the base case, `NF=1`) doesn't even change over time.

So "blind" is not literally blind — price and position are always visible,
and a trend can be inferred, slowly and noisily — but it is a meaningfully
worse signal than 4S provides, not a rounding error. See the strategy doc
for what that's worth in dollar terms.

---

## Open questions / not verified here

1. **Ken's actual Source File count.** The `BN1x1` filename read (no SF8) is
   **derived**, not confirmed by an in-game call. Cheap to settle
   (`ns.getResetInfo()`, near-zero RAM) whenever a script next runs.
2. **The `otlkMagForecast` anchor's actual game-design purpose.** Read
   faithfully from the tick math but never cross-referenced against any
   in-game documentation of what it represents narratively — flagged
   **speculative** above, not asserted with more confidence than warranted.
3. **Corporation-owned stock**, if Ken ever starts a corporation, is a
   different code path not reviewed for this doc.
4. **Nothing here has been exercised by a live trade** in this player's
   game. Every mechanic above is a **source** read of the formulas that
   *would* execute; none of `buyStock`/`sellStock`/`buyShort`/`sellShort`/
   `placeOrder`/`cancelOrder` has actually been called, per the standing
   read-only rule.
