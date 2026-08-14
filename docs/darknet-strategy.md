# Darknet strategy

Synthesis and sequencing. Read `darknet-functions.md` for the API and the
model solvers, `darknet-tactics.md` for the per-decision reasoning. This doc
answers: what are we actually trying to get out of the darknet, in what order,
and what has to be true before each step is worth taking.

**Update 2026-08-12: Phases 0-2 are now live and working.** `dnet_probe.js`
confirmed the entry-point model exactly as predicted (`["darkweb"]`, nothing
more — see the "Reconciled" note in `darknet-functions.md` for why the
"Dark Net" UI tab showing far more than that is expected, not a
contradiction). A fresh `dnet_deploy.js --once` run from `home` is live and,
due to a found-but-low-risk bug in `spread()` (child copies don't inherit
`--once` — see `darknet-functions.md`'s deployer section), has already
cascaded into exactly the autonomous Phase-2 crawl this roadmap describes:
12+ servers cracked across all four solved password models, zero failures,
credentials shipped to `home` as shards. **Recommended next concrete step:
run `dnet_creds_merge.js` on `home` now** to fold those shards into
`dnet_creds.txt` — they exist only as loose per-host shards right now, and
merging is what makes the "recovery after mass script death" design
actually pay off if anything kills the running copies. Do **not** run
anything that backdoors or `setStasisLink`s a server yet — nothing has hit a
point in this net that clearly justifies spending 1 of the ~2-4 backdoor
budget (tactics §2/§3), and the crawl itself costs zero instability. The
paragraphs below are the original pre-live-run plan, kept as-is; where they
predicted a number, it held.

**Update 2026-08-14 (Codex branch, awaiting live restart): turn the shallow
net into a charisma engine.** Live state has reached 586 historical
credentials across seven models with pristine instability (1× duration,
0% timeout), but the merged scoreboard is stale and sampled crawler shards
have stopped advancing. Source inspection also shows this save is confined
to the shallow/basic darknet (observed maximum difficulty 4); deep labs and
their stasis-limit augmentations are not a reachable optimization target in
the current state. The highest-value reachable loop is therefore:

1. authenticate a directly-connected neighbour;
2. launch a temporary, multi-thread `dnet_realloc.js` on the crawler, aimed at
   that neighbour, before resident scripts consume capacity;
3. preserve the self-replicating crawl and one-shot cache loot;
4. fill remaining RAM with a lean multi-thread `phishingAttack()` loop.

That loop is implemented on the Codex branch as temporary multi-thread
`dnet_realloc.js`, new `dnet_phish.js`, once-per-process neighbour
preparation, cache-success handoff markers, and immutable cumulative
loot-event telemetry. It does not use
backdoors, stasis, migration, stock promotion, or Storm Seed. Phishing is the
correct idle load because it builds charisma on every attempt (even failures),
and charisma shortens later phishing/reallocation/authentication work while
also improving phishing success and payout. Live validation requires a clean
swarm restart because Bitburner does not hot-reload.

**Live correction after the first restart:** the game's own
`getScriptRam()` reports the full crawler at 15GB, not the hand-estimated
~4.9GB. On a 16GB node it left exactly 1GB, explaining the scorecard's RAM
skips and preventing every intended co-located worker. The replacement
architecture keeps that controller on `home`: remote nodes use a transient
lean `dnet_crawl.js`, then hand their released RAM to `dnet_manager.js` for
loot/phishing and a clean 90-second recrawl cycle. The measured RAM costs and
resulting phish capacity are emitted in each transient crawler heartbeat; do
not treat this redesign as confirmed until those live fields appear.

The same pass also closes three bounded authentication gaps already relevant
to this shallow save: all unique PHP 5.4 permutations through length three,
the exact AccountsManager difficulty range, and Pr0verFl0's one-shot overflow
payload. Feedback-dependent models remain deliberately outside the roaming
crawler until a separate charisma-gated heartbleed solver can correlate logs
and retry 408 timeouts safely.

---

## What we're optimising for

Ranked, with the reasoning, because the ranking is not obvious and two of
these are new categories rather than more of what `mcp.js` already does.

### 1. Stock market access — corrected: not darknet-exclusive, so this is weaker than originally written

**Update, from Ken directly, after this doc's first draft:** the World Stock
Exchange sells WSE Account access, TIX API access, and 4S Market Data
directly — no darknet involvement. The original framing below ("the one path
to a category that doesn't exist yet") was wrong on that specific point, and
it was the load-bearing claim for ranking the darknet first. Correcting it
rather than quietly editing it away, since the reasoning error is itself
informative: I inferred "no TIX access" meant "no path to TIX access" without
checking whether a direct purchase existed. It did.

**What this changes:** direct purchase is a *known, certain, immediate* way
to open the stock-trading category — at this player's current money (multiple
billions), the WSE/TIX/4S purchase cost is very likely trivial, versus a
darknet path whose payoff was already flagged as unvalidated (drop rate
unknown, whether it's gated to deep servers unknown, whether the drop is full
or partial access unknown). If the goal is *access to the category*, buying
it directly dominates waiting on an unvalidated random drop. That was true
before this correction too — it just wasn't visible, because the doc never
considered the direct path existed.

**What darknet involvement still adds, if pursued anyway:** `.cache` files
can still drop stock-relevant rewards (money, possibly further access-adjacent
items — the reward table wasn't fully characterized), and `promoteStock()`
(2GB) raises a stock's *volatility* without touching its forecast — valuable
to an active trader regardless of how the underlying TIX/4S access was
obtained. So darknet work isn't worthless to a stock strategy even once
direct purchase is in hand; it's just no longer the *gate*, only a possible
*edge* on top of access already bought outright.

**One thing worth flagging plainly, unrelated to the darknet:** the game's
own warning is that installing augmentations resets all stock *positions*
(not the WSE/TIX/4S access itself, which persists). Ken is currently holding
7 purchased-but-uninstalled augmentations. If stock trading starts before
those get installed, positions need to be sold first — a real future gotcha,
not a hypothetical one, worth a `kensTodo.md`-style reminder once trading
actually starts.

**Still unvalidated, independent of the above correction:** the darknet
`.cache` drop rate and reward distribution. **source** for the mechanism
(a small reward table, `.d.cache` and a BitNode multiplier both widening it),
**unknown** for the specific odds. Don't restructure anything around it until
a cache has actually been opened and read — that part of the original caution
still holds, it just no longer justifies ranking the darknet *first*.

### 2. RAM

**Update 2026-08-09: home is now 128GB, ~100GB free** (was 20GB when this
project's RAM-scarcity habits — the careful HUD budgeting, `mcp_doctor.js`
parked in the backlog — were established). Those habits stay good practice,
but the *urgency* behind "home RAM has been the binding constraint
repeatedly" is gone; this section's original framing assumed a scarcity that
no longer holds at home. Darknet RAM is still worth having for the reasons
below — it's real, separate capacity — just not because home is currently
tight.

The tutorial: "There is a lot of ram on the darknet." `darkweb` alone is 16GB.

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

### Phase 0 — Run `dnet_probe.js`. Nothing else, first. **DONE 2026-08-12.**

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

### Phase 1 — Establish `darkweb` as the beachhead. **DONE 2026-08-12.**

Only after Phase 0 succeeds. `darkweb` was cracked (`""`, `ZeroLogon`, as
predicted) and the deployer spread from it. `dnet_creds_merge.js` (step 3)
has **not** been run yet — see the top-of-file update.

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

### Phase 3 — Loot, and find out whether the stock hypothesis is real. **Ken-approved 2026-08-12.**

Run `dnet_loot.js` on held servers. It frees blocked RAM (gated on the free
`getBlockedRam` check) and opens `.cache` files, reporting karma spent.

**Update 2026-08-12: a standalone batch pass doesn't work, so this is now
inline in `dnet_deploy.js` instead.** `dnet_loot_all.js` (loot every
previously-cracked host from home, one at a time) was tried live first and
came back 0/103 looted — most previously-cracked servers are simply offline
again by the time a later, separate pass comes back to them (`nextMutation`
churns the net continuously; being cracked once doesn't mean still online
later). The one moment a server is *known* online is the instant a session
is freshly established on it, so `dnet_deploy.js` now scp+execs
`dnet_loot.js` right there, in the same place it already scp+execs itself —
see `docs/darknet-functions.md`'s "Phase 3" section for the two RAM-fit bugs
found and fixed getting this live (one in `dnet_loot_all.js`, not fixed
there since it's kept only as a manual/one-off tool now; one in the new
inline path itself, fixed). `dnet_loot_all.js`/`dnet_loot_merge.js` are
kept for manual one-off use, not replaced.

**Lower-stakes than originally written** — see the update at the top of §1.
Reading what caches actually contain is still worth doing, but a stock key
appearing here would now be a nice-to-have layered on access already bought
directly, not the discovery that reframes the whole effort. If several caches
yield only money and experience, the darknet is a RAM-and-charisma play with
a money side-effect, and it should be prioritised accordingly — well below
`mcp.js`, same conclusion as before, just no longer contingent on this
specific hypothesis.

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

1. **Superseded, not just unvalidated — read the update at the top of §1
   first.** This item originally said the stock-access-key payoff was the
   reason the darknet ranks above other uses of attention. That reasoning
   depended on believing TIX/4S access had no other path, which was wrong:
   it's a direct WSE purchase, unrelated to the darknet, and at this
   player's money almost certainly affordable outright. The darknet's stock
   angle is now at most an *edge* (`promoteStock`, possible cache drops) on
   top of access bought directly, not the *gate* to the category. Whatever
   priority ordering in this doc leaned on "the darknet is the only path to
   a new income category" needs to be re-read with that gone.
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
