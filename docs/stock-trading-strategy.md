# Stock market strategy

Synthesis and sequencing for *this specific situation*: WSE + TIX access
already bought, no 4S data (either variant), trading held to manual/
read-only pending Ken's explicit approval to automate. Read
`stock-trading-mechanics.md` first for the API and the price-formation
mechanics this reasons over; style follows `darknet-strategy.md`.

## Where things stand right now

From the task brief and this session's live `mcp_stocks.js` confirmation:

- **WSE Account**: owned ($200m spent).
- **TIX API Access**: owned ($5b spent).
- **4S Market Data (UI)**: not owned ($1b).
- **4S Market Data TIX API**: not owned ($25b) — deliberately deferred, per
  Ken directly.
- **Positions**: one, bought manually through the in-game UI. Everything
  else in this doc assumes trading stays manual until further notice.
- **Net worth**: `mcp_status.json` (2026-08-09, post-augmentation-install)
  shows **~$70.2m** cash and ~$22,240/s income from `mcp.js` alone
  (**confirmed live**, this player, this session — not a general estimate).
  That income figure is *pure `mcp.js` hack/grow/weaken farming* at
  hacking level 260 on a rooted pool that tops out around 128GB hosts; it
  will move substantially as hacking level, rooted pool, and RAM change, so
  treat it as a snapshot, not a growth curve to extrapolate linearly.

**The standing rule, restated because it governs everything below:** stock
trading stays read-only until Ken explicitly approves capital deployment.
`mcp_stocks.js` never calls a trading function and nothing here proposes
changing that. This document is about **what to buy for data access**, which
is a spending decision Ken can act on manually through the UI regardless of
whether scripted trading is ever turned on — the two questions (buy 4S? /
automate trading?) are independent and this doc keeps them that way.

---

## What "no 4S" actually costs you

Per the mechanics doc, `getForecast()`/`getVolatility()` are not smoothed or
processed signals — they are direct reads of the exact numbers
(`otlkMag`+`b`, `mv`) that already deterministically drive each tick's
coin-flip. Without them, the best available substitute (a community-standard
EMA over observed up/down ticks) is chasing a target that itself has a ~45%
chance of fully inverting every ~7.5 minutes. That's not "somewhat worse
than 4S" — it's structurally handicapped against the mechanic's own churn
rate, not just noisier.

Concretely, for someone at Ken's current position (one manual buy, no
script involvement, no urgency): **trading without 4S right now means
picking a stock on gut feel / the in-game UI's own price chart, holding it,
and eating the $100k commission + spread on entry and exit regardless of
outcome.** That's a fine way to hold a long-term position in a company Ken
likes the look of, and a bad way to try to actively trade — there is no
practical way to *systematically* beat the spread+commission drag without
either a forecast signal (4S) or a very long observation window per stock
(the EMA approach), and the latter still isn't available to a human clicking
the UI, only to a script — which is exactly the thing that's on hold.

**This is the actual near-term implication: manual trading without 4S is
closer to picking a stock and holding it than to active trading.** That's
not a criticism of the one position already taken — it's a framing for not
expecting more from casual manual trades than "own a bit of a company," and
for not reading much signal into short-term price moves on that position.

---

## The 4S decision is two decisions, not one

This is the load-bearing point of this document, and it's easy to miss
because both purchases share the "4S Market Data" name: **the $1b UI tier
and the $25b TIX API tier are functionally unrelated purchases that happen
to share a data source.** Per the mechanics doc, `purchase4SMarketData()`
(UI) and `purchase4SMarketDataTixApi()` (scripts) each unlock forecast/
volatility for exactly one consumer — the in-game UI, or `ns.stock.*` —
and neither purchase moves the other any closer.

That means the relevant question for Ken right now isn't "is 4S worth
$25b" — it's two separate, much more tractable questions:

### Is the $1b UI tier worth it, for manual trading?

This is the one that actually matters near-term, because manual trading
is the *only* mode currently in play (automation is on hold). $1b buys
Ken — clicking through the in-game Stock Market UI himself — the same
forecast and volatility numbers a script would get, with no code involved
at all. If Ken wants his one manual position (or future ones) to be
more than a coin flip, this is the direct, cheap way to get there, and it
doesn't touch or depend on the automation question in any way.

**Not worth it yet at $70.2m net worth** — $1b is roughly 14× current net
worth. Buying it now would consume the entire hacking-farm runway several
times over for a data feed that only pays off if Ken is actively watching
the UI and trading on it by hand afterward. Worth it once net worth clears
it comfortably enough that spending $1b still leaves real trading capital
and doesn't set the farm back meaningfully — a reasonable rule of thumb:
**once net worth is comfortably above ~$10b**, so $1b is under ~10% of net
worth and there's a real stake left over to act on the signal with. Below
that, the $1b is better spent on more hacking RAM/servers, which compounds
the income that eventually pays for everything else including this.

### Is the $25b TIX API tier worth it?

Only relevant once scripted trading is actually authorized — `getForecast`/
`getVolatility` from a script are worthless sitting next to a read-only
panel that (by design, per the standing rule) never acts on them.
`mcp_stocks.js`'s "watchlist locked (buy 4S)" line would light up the moment
this is bought regardless of whether anything trades on it, which is a nice
verification step but not a reason to buy it early.

**Sequencing recommendation: don't buy this until both of the following are
true simultaneously** — (a) net worth is high enough that $25b is a small,
comfortable fraction of it (same logic as above, scaled up — call it
net worth north of a few hundred billion, so $25b is a single-digit-percent
allocation, not a bet-the-farm one), **and** (b) Ken has actually decided he
wants scripted trading and said so explicitly. Buying the data before
deciding to automate just leaves $25b sitting idle behind a locked door in
`mcp_stocks.js`'s watchlist; buying it after deciding to automate means the
watchlist activates the same session automation gets approved, no code
changes needed (confirmed in `mcp_stocks.js`'s own header comment — it was
built to make exactly this transition free).

**Do not let "we already have $1b-tier access" pull the $25b tier forward.**
They don't share a signal path (per the mechanics doc, they're independent
purchases against independent consumers), so having bought the cheap one
buys zero progress toward affording or justifying the expensive one.

---

## Recommendation summary

| Purchase | Cost | Worth it when | Why not yet |
| --- | --- | --- | --- |
| 4S Market Data (UI) | $1b | Net worth comfortably clears ~$10b, so it's a minor allocation with trading capital left over | At $70.2m it's ~14× net worth — would gut the farm for a feed with no capital left to act on |
| 4S Market Data TIX API | $25b | Net worth in the hundreds of billions **and** Ken has explicitly approved scripted trading | Same net-worth-fraction logic as above, scaled to $25b — and it's dead weight without automation regardless of money |

Neither purchase is urgent. Both are strictly optional relative to
continuing to grow `mcp.js`'s income and rooted pool, which is what will
actually move net worth into the range where either becomes a rounding
error rather than a real bet. **Nothing here should pull attention away
from the farming loop to chase either tier early.**

---

## One live risk worth a standing habit: positions and augmentation installs

Per the mechanics doc's source-confirmed reset behavior: **augmentation
installs wipe stock positions but not WSE/TIX/4S access.** There is no
reason to ever hold a position into an install — the position is destroyed
either way, and selling first at least realizes whatever gain or loss was
sitting in it rather than having it vanish silently. `darknet-strategy.md`
flagged this as a "real future gotcha, not hypothetical" back when Ken was
holding 7 queued augmentations; it already happened once (the 2026-08-09
install, confirmed in `docs/processes.md` — 0 positions immediately after,
exactly as expected). Worth carrying forward as a standing habit for every
future install, manual position or not: **check `mcp_stocks.js` for open
positions before confirming an augmentation install, and close them first
if there are any.** This costs nothing to remember since the panel is
already built and (per `docs/kensTodo.md`) already confirmed running.

---

## Where this genuinely might be wrong

1. **The net-worth-fraction thresholds (~$10b, "hundreds of billions") are a
   judgment call, not derived from game data.** There's no source-grounded
   "correct" fraction of net worth to spend on a data feed — this is
   ordinary risk-sizing reasoning (don't let one purchase set back your
   primary income engine noticeably) applied to numbers that are otherwise
   solid (**source**, the $1b/$25b costs themselves). If Ken's risk
   tolerance or plans differ, the thresholds should move, not the
   underlying cost numbers.
2. **The $70.2m/~$22k-per-second snapshot is one data point taken
   post-reset, early in the recovery climb.** `mcp.js`'s income is not flat
   — it scales with hacking level and rooted pool, both of which are
   actively growing (see `docs/process-backlog.md`). Whatever net worth
   trajectory this implies should be re-checked against a fresher
   `mcp_status.json` before treating either threshold as close or far.
3. **Whether manual trading without 4S is "worth doing at all" is a
   framing choice, not a settled fact.** The mechanics doc establishes that
   it's structurally worse than 4S-informed trading; it does not establish
   that it loses money on average — a stock bought and held through a bull
   regime can still profit even from a coin-flip entry. The "closer to
   holding than trading" framing above is this doc's editorial read of that
   fact, not a proof.
4. **No live BitNode/Source-File check has been run.** The recommendation
   sequencing doesn't depend on whether shorting/limit-orders are available
   (see the mechanics doc's SF8 gate) — this doc only discusses forecast/
   volatility access and plain long positions — but if Ken ever wants to
   short, that gate is a real, separate blocker independent of money, worth
   settling with `ns.getResetInfo()` before assuming it's just a cost
   question.
