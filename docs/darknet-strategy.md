# Darknet strategy

Synthesis and sequencing. Read `darknet-functions.md` for the API and the
model solvers, `darknet-tactics.md` for the per-decision reasoning. This doc
answers: what are we actually trying to get out of the darknet, in what order,
and what has to be true before each step is worth taking.

**Nothing in the darknet set has been run in Bitburner.** The roadmap below is
built to make that the *first* thing that changes.

---

## What we're optimising for

Ranked, with the reasoning, because the ranking is not obvious and two of
these are new categories rather than more of what `mcp.js` already does.

### 1. Stock market access — the one genuinely new income category

`.cache` files "can contain money, experience, programs, or **stock market
access keys**". This player's stock income was **$0** at the last check: not
underperforming, *absent*. There is no TIX API access, so there is no stock
income to improve — the category doesn't exist yet.

That makes darknet-sourced stock access qualitatively different from
everything else here. Every other reward is *more money*, which `mcp.js`
already produces continuously. A stock access key is a *new machine*, and it
compounds independently of hacking level.

It pairs with `promoteStock()` (2GB), which raises a stock's **volatility**
without touching its forecast. Volatility is meaningless to a passive holder
and valuable to an active trader — it widens the swings you trade against. So
the darknet plausibly offers both the entry ticket and an edge on top of it.

**The uncertainty, stated plainly:** I have no evidence about the *drop rate*
of stock access keys, or whether they're gated to deep servers, or whether
what drops is full TIX + 4S access or something partial. The cache reward
table picks a reward type at random from a small set, with `.d.cache` (deep
variant) adding an extra possibility and a BitNode multiplier adding another.
**source** for the mechanism, **unknown** for the specific odds of a stock
key. This is the highest-value hypothesis in the doc and it is
**unvalidated**. Do not restructure anything around it until a cache has
actually been opened and its contents read.

### 2. RAM

The tutorial: "There is a lot of ram on the darknet." `darkweb` alone is 16GB.
Home RAM has been the binding constraint on this project repeatedly — it's why
`mcp_doctor.js` is parked in the backlog and why the HUD scripts are
RAM-budgeted so carefully.

But darknet RAM is **not** a drop-in extension of the worker pool. `exec`
onto a darknet server needs a session plus either a direct connection, a
backdoor, or a stasis link; the network rearranges itself underneath you; and
servers restart and kill their scripts as routine behaviour. It is real
capacity with real strings attached, and the backdoor budget (tactics §2)
means you cannot simply pin it all down.

**Realistic use:** self-contained, restart-tolerant, embarrassingly parallel
work that doesn't care about being killed — `phishingAttack` for charisma and
money, further darknet exploration, `promoteStock`. **Not** a good fit for
`mcp.js`'s weaken/grow/hack batches, which assume stable hosts and coordinated
timing. **derived.**

### 3. Charisma

Not a goal in itself, but the gating stat for the whole system — it hard-gates
`heartbleed`, slows authentication below the server's requirement, and scales
`memoryReallocation`, `induceServerMigration`, `promoteStock`, and
`phishingAttack`. **source** This player has had no reason to train it.

`phishingAttack` builds charisma *and* pays money *and* occasionally drops
caches, and it gets faster as charisma rises. It is the natural idle-load for
darknet RAM and it feeds back into every other darknet capability. See
tactics §5.

### 4. Money and programs from caches

Real, immediate, and the least strategically interesting — it's the same
resource `mcp.js` already generates. Worth collecting when it's free (you're
standing on the server anyway), not worth building a campaign around. Note it
costs karma: `difficulty + 1` per cache. **source**

### Explicitly not a goal

**Deep-net augmentations.** The `.d.ts` mentions "special augmentations in the
deep darknet" that raise the stasis link limit. Interesting, certainly gated
behind far more progress than we have, and entirely **speculative** as a
near-term target. Named here so it isn't rediscovered as a surprise, not
because it should influence anything now.

---

## Roadmap

### Phase 0 — Run `dnet_probe.js`. Nothing else, first.

**This is the next real-world action, and everything below is blocked on it.**

`dnet_probe.js` is committed, syntax-checked, ~2.3GB, and does exactly one
mutating thing: `authenticate("darkweb", "")`. It has been added to
`docs/kensTodo.md`.

Run it **from `home`** — that's where the connection to `darkweb` exists.

What its output settles:

| Question | Why it's load-bearing |
| --- | --- |
| Does `probe()` from home return `["darkweb"]`, or more? | The `.d.ts` example says exactly `["darkweb"]`. If more appears, my model of the entry point is wrong. |
| Does `authenticate("darkweb","")` succeed? | Validates the entire `ZeroLogon` reading, and with it the credibility of every other model rule derived the same way. |
| What are the real field values in `getServerDetails`? | Confirms the `DarknetServerDetails` shape and that `passwordHint`/`data` carry what the generators suggest. |

If `darkweb` authenticates with `""`, the source-reading method is validated
and Phase 1 can proceed with reasonable confidence. **If it fails**, stop —
do not run the deployer. It would mean the model rules are misread, and the
right response is to `heartbleed` `darkweb` and re-derive from observed
behaviour rather than from my reading of the bundle.

`dnet_probe.js` does not currently print `passwordLength`, `passwordFormat`,
`depth`, `difficulty`, `blockedRam`, or `isStationary`, all of which the
detail object carries and all of which matter. I have deliberately not edited
it (it's out of scope for this task, and it may already have been run). If it
hasn't been run yet, adding those fields to its print line — or running
`dnet_deploy.js --once --quiet=false` instead, whose `describe()` dumps every
field — is a strictly better use of the same click.

### Phase 1 — Establish `darkweb` as the beachhead

Only after Phase 0 succeeds.

1. `run dnet_deploy.js --once` **from home**. One pass, no loop: it cracks
   `darkweb`, ships the credential to `home`, copies itself and `dnet_lib.js`
   over, and starts a copy there. Reading the output before letting anything
   loop is the point of `--once`.
2. Read `PASS {...}` and the per-neighbour `describe()` lines. **This is the
   first real map of the darknet's edges** — the canvas-rendered UI can't give
   it, and `probe()` from a deployed script is the only source.
3. `run dnet_creds_merge.js` on home to confirm the credential store round-trips.

**What to check before going further:** how many neighbours `darkweb` actually
has, their models, their `maxRam` and `blockedRam`, and whether the RAM on
`darkweb` comfortably holds the deployer.

### Phase 2 — Spread across the shallow net

Once one hop works, the same mechanism works outward. Let `dnet_deploy.js`
loop (no `--once`); it waits on `nextMutation()` and re-probes as the network
changes.

Expected total cost to take the visible net: **~19 authenticate calls**
(tactics §1). There is no brute-force phase.

Watch, each pass:

- `getDarknetInstability()` — free, and the early-warning signal that the
  backdoor budget has been overspent. `authenticationTimeoutChance` above ~0.1
  is the alarm.
- Which servers keep disappearing. A server that restarts repeatedly is not
  a place to build.
- Cumulative `blockedRam` across held servers — that's the real usable-RAM
  number, and it's larger than `maxRam` suggests.

**Do not backdoor anything in this phase.** Persisted passwords plus
`connectToSession` give session access at any distance for 0.05GB and zero
instability cost. Backdoors are for `exec` reach and terminal access, and the
budget is ~2 before the timeout penalty starts (tactics §2).

### Phase 3 — Loot, and find out whether the stock hypothesis is real

Run `dnet_loot.js` on held servers. It frees blocked RAM (gated on the free
`getBlockedRam` check) and opens `.cache` files, reporting karma spent.

**This is where the central hypothesis gets tested.** Read what the caches
actually contain. If a stock market access key appears, that reframes the
whole effort and the next question becomes how to farm caches deliberately —
including `phishingAttack` as a cache source. If several caches yield only
money and experience, the darknet is a RAM-and-charisma play with a money
side-effect, and it should be prioritised accordingly — well below `mcp.js`.

Also check `ns.ls(host, ".data.txt")` on everything held. Data files carry
credentials and password lists (**source** — one generator writes 15 entries
from the common-password dictionary into one), which is the intended path into
servers whose model needs a dictionary.

### Phase 4 — Deeper, and only then the expensive tools

Gated on Phase 3, and on charisma from phishing.

- Deeper servers mean new models. Add solvers to `candidatesFor()` one at a
  time, driven by a `modelId` actually observed in a probe — not speculatively.
  The generic fallback path plus a full `describe()` dump is the discovery
  tool.
- `setStasisLink` becomes relevant once there's a specific junction or island
  beachhead worth 12GB and a slot. Check `getStasisLinkLimit()` first — 0GB,
  and **we still don't know what the limit is for this player**, which could
  make the whole question moot.
- `induceServerMigration` for disconnected islands, deliberately, once the
  topology is understood well enough to know where you're pushing something.

---

## Where this genuinely might be wrong

Kept explicit rather than buried, because most of this doc rests on reading
minified source rather than on play.

1. **The stock-access-key payoff is unvalidated.** It's the reason the darknet
   ranks above other uses of attention, and it rests on one phrase in the
   tutorial plus a reward table I read but whose odds I don't know. If caches
   don't drop stock keys at a useful rate, the priority ordering in this doc
   is wrong.
2. **Every model rule is source-read, not observed.** I reconstructed the
   generators locally and confirmed the decoders invert them — but that proves
   the decoder matches *my reading*, not that my reading is right. Phase 0
   is designed to test exactly this on the simplest possible case.
3. **Topology is entirely unknown.** Every prioritisation is a policy over
   fields, not a plan over a map. The first `probe()` from `darkweb` could
   change the shape of Phase 2 completely — for instance if `darkweb` has one
   neighbour rather than eight.
4. **The instability/stasis-link coupling is derived, not confirmed.** The
   tutorial says a stasis link sets a backdoor; I did not verify that the
   instability formula's backdoor list counts stasis-linked servers. If it
   doesn't, stasis links are meaningfully cheaper than tactics §2 assumes.
5. **RAM estimates are arithmetic, not measurements.** Bitburner's static
   analyser also charges for ns calls reachable through imports, and
   `dnet_deploy.js` imports `dnet_lib.js`. The in-game figure is the authority
   and may exceed the ~4.6GB estimate.
6. **`labreport` / `labradar` are unknown.** Free to call, defined failure
   shape, no idea what they're for. Worth one zero-cost experiment from a deep
   server; not worth theorising about.

## Relationship to the rest of the project

The darknet is **additive, not a replacement**. `mcp.js` remains the income
engine and none of this touches it. The darknet set is self-contained:
`dnet_probe.js`, `dnet_lib.js`, `dnet_deploy.js`, `dnet_loot.js`,
`dnet_creds_merge.js`, sharing only `home` as a credential sink.

Deliberately **not** integrated with `mcp_supervisor.js` or `startup.js`.
Nothing here should be auto-started until it has demonstrably worked by hand —
the darknet mutates, kills scripts, and rewards a careful first look, and this
project's own history is emphatic that a restart cycle is also an
evidence-destruction cycle. When it does become always-on, the supervisor is
the right home for it, and `dnet_creds.txt` should be added to the download
pattern in `docs/kensTodo.md` so its contents can be read outside the game.
