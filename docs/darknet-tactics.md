# Darknet tactics

One section per real decision point. `darknet-functions.md` has the API
reference, the model registry, and the status vocabulary (**source** /
**derived** / **speculative** / **untested**) used here too.

**Update 2026-08-12: no longer true that nothing has run.** A fresh
`dnet_deploy.js --once` run from `home` is live right now — see
`darknet-functions.md`'s "Reconciled 2026-08-12" note for the full story and
the confirmed-live model table. Short version: the apparent
discovery-count mismatch that triggered this check (`dnet_probe.js` seeing 1
server, the "Dark Net" UI tab showing 16+) is not a bug — `probe()` is
adjacency-only by design, the UI reads the game's full internal state, and
there is no `ns.dnet` call that does what the UI does. All four solved
password models have now cracked a real server live, zero misses. Sections
below are otherwise unchanged from the pre-live-run analysis; where a
number below was a prediction, it has held up.

---

## 1. Cracking the four models we will actually meet

All 16 nodes observed on the live map are one of four models, and the
difficulty banding in the game's source explains why: difficulty ≤ 2 draws
*only* from `[NoPassword, EchoVuln, DefaultPassword, Captcha]`. **source**
The shallow net has no other models in it. So "3 unknown models" turns out to
be the entire remaining problem for the near term, and all three are solved.

| Model | Count seen | Guesses needed | Where the answer lives |
| --- | --- | --- | --- |
| `FreshInstall_1.0` | 8 | ≤ 4 | fixed wordlist `["admin","password","0000","12345"]` |
| `DeskMemo_3.1` | 3 | 1 | last token of `passwordHint` |
| `ZeroLogon` | 3 | 1 | the empty string |
| `CloudBlare(tm)` | 2 | 1 | `data`, with non-digits stripped |

Derivations and the generator source for each are in
`darknet-functions.md`; the implementation is `candidatesFor()` in
`dnet_lib.js`, which is pure and was round-tripped locally against
reconstructions of the game's own generators. **derived**, **untested in game**.

**Worst case for the whole visible net is ~19 authenticate calls.** There is no
brute-force phase, no dictionary grinding, and no need for `heartbleed` at all
on these four. Plan the first live session around that number, not around a
long cracking campaign.

### Methodology when a fifth model appears

It will, as soon as anything goes deeper than difficulty 2. The ordered
procedure is in `darknet-functions.md` under "Methodology for a genuinely
unknown model" — in short: dump the full details object first (`passwordLength`
and `passwordFormat` bound the problem for free), read `authenticate`'s
undocumented `data` on failures, `heartbleed` with `{peek: true}` before ever
doing a destructive read, and time the calls, because at least one model
(`2G_cellular`) leaks correctness through duration.

The one thing not to do is start guessing before reading
`getServerDetails`. At 0.1GB it is the cheapest call in the API and it
frequently contains the answer outright.

## 2. Instability: the real constraint, and it is not what the tutorial implies

The tutorial says instability is caused by "excessive backdoor-ing". That is
literally true and easy to misread as "be careful how much you authenticate".
The formulas say otherwise. **source** (search `W6)().length`):

```js
// authenticationDurationMultiplier
S = () => {
  const backdoors = backdooredServers().length
  const owned     = darknetServers().filter(s => s.hasAdminRights).length
  const allowance = Math.max(owned / 24, 2)
  return 1.07 ** Math.max(0, backdoors - allowance)
}

// authenticationTimeoutChance
v = () => Math.max(Math.min(0.03 * (backdoors - 2), 0.5), 0)
```

Read those carefully, because the consequences are sharp:

- **Authentication does not cause instability. Backdoors do.** Cracking every
  server on the net costs nothing in instability. You can be as aggressive
  with `authenticate` as you like. **derived**
- **The timeout allowance is 2 backdoors, flat.** Backdoor #3 puts 3% of all
  authentications into the 408 "may or may not have been correct" bucket. It
  is linear from there and **caps at 50% at 19 backdoors** — at which point
  half of every authentication attempt anywhere on the net fails
  non-deterministically.
- **The duration allowance grows with holdings**: `max(owned / 24, 2)`. Own 48
  authenticated servers and the allowance is still only 2; own 72 and it is 3.
  This grows far more slowly than a successful campaign will want to backdoor,
  so the penalty is effectively "backdoors beyond 2, compounding at 1.07 each".
  Ten excess backdoors is ~2× auth time; twenty is ~3.9×; thirty is ~7.6×.
- **`setStasisLink` sets a backdoor** (per the tutorial's own description of
  it). So stasis links spend the backdoor budget too. **derived** — the
  tutorial states the equivalence; I did not confirm in code that a
  stasis-linked server is counted by the same `backdooredServers()` list. If
  a live run shows instability climbing after a stasis link, this is why.

**The management rule that falls out:** treat backdoors as a hard budget of
about 2–4, spend them only on servers whose *position* you need permanently,
and reach for `connectToSession` + a persisted password everywhere else. A
stored credential gives you remote session access with **zero** instability
cost; a backdoor gives you remote `exec` and terminal access and taxes every
future authentication on the entire network. Those are very different prices
for overlapping benefits.

Log `getDarknetInstability()` (0GB) on every deployer pass. It is free, and
`authenticationTimeoutChance` climbing above ~0.1 is the signal that the
backdoor budget has been overspent — a decision input that is otherwise
invisible until crack times mysteriously balloon.

## 3. When `setStasisLink` is worth 12GB and a limited slot

Costs: 12GB RAM in the calling script — by far the most expensive call in the
API — plus one of a hard global maximum (`getStasisLinkLimit()`, 0GB to
check), plus a backdoor's worth of instability. **source** for the RAM and the
limit, **derived** for the instability coupling.

Benefits: the server cannot move, restart, or go offline; and it becomes
reachable for `connectToSession`, `exec`, and terminal connection from any
distance.

Because 12GB will not fit on a cramped darknet server, the practical pattern
is a **dedicated single-purpose script** that does nothing but
`setStasisLink()` and exit — not a flag on the deployer, which would inflate
the deployer's footprint everywhere it runs for a call it makes once. Not
written yet; write it when there is a specific server to spend a slot on.

**Worth a slot:**

- A **junction** — a server with many connections that sits between your
  entrenched area and somewhere you want to keep reaching. Cannot be
  identified until `probe()` maps real topology.
- A **beachhead in a disconnected island.** The tutorial notes the net has
  disconnected components reachable only by riding a moving server. Arriving
  somewhere unreachable and *not* pinning it means losing it when it drifts.
  This is the strongest case: the alternative isn't inconvenience, it's
  permanent loss of access.
- A **large-RAM server** you intend to use as a compute base, where a restart
  would kill a meaningful workload.

**Not worth a slot:**

- `darkweb`. Already `isStationary: true` in its constructor. **source** It
  cannot move or go offline, so a link there buys nothing.
- Any other server with `isStationary: true` — the field is in
  `getServerDetails`, check it before spending.
- A server you only need to *read* or re-enter. A persisted password plus
  `connectToSession` gets you a session at any distance for 0.05GB and no
  instability. Stasis is for when you need `exec` or terminal reach, or need
  the server to stop moving.

**Check `getStasisLinkLimit()` and `getStasisLinkedServers()` first.** Both
0GB. Neither has been read live yet, so **the actual limit for this player is
unknown** — it may well be small enough that the entire question is "which one
server", not "which four".

## 4. Which of the ~16 (now ~31 and climbing) to target first

**Update 2026-08-12:** the "16" in this heading was already stale before
this update — the live "Dark Net" UI tab read ~31 named servers minutes
later in the same session, several names from the original 16 gone
(`terminal.oasis`, `facebucks`, `neon.tech`, `granny-s@neo^systems`,
`tetr4d5`) and many new ones present. The net is not a fixed-size list to
memorize; it mutates on its own schedule regardless of anyone's action, per
`nextMutation()`'s own documented behavior. Treat every count in this
document as a snapshot, not a spec.

Topology is unknown by static inspection — it's drawn on a canvas, so DOM
inspection got the node list but not the edges — but as of 2026-08-12 this is
no longer purely theoretical: `dnet_deploy.js`, once it has a session on a
server, calls `probe()` *from* that server and learns its real neighbours,
which is exactly how it has autonomously cracked 12+ servers across several
hops from `home` already (see `darknet-functions.md`'s deployer section).
The policy below still applies to anything not yet reached; `probe()` from a
live script remains the only way to learn the edges for certain.

**Ordering policy, cheapest and most certain first:**

1. **`darkweb`, always.** It's the entry point, it's `ZeroLogon`/empty
   password, it's stationary, and it has 16GB — enough for the ~4.6GB deployer
   several times over. It is also the same physical server as the regular
   network's `darkweb`, already rooted and reachable by ordinary `ns.scan`,
   which is what makes it the bridge from the normal network into the darknet
   at all.
2. **Whatever `probe()` returns from `darkweb`** — by definition depth 0, and
   every depth-0 server is connected to `darkweb`. **source** (a network
   invariant check in the bundle asserts exactly this). These are the only
   servers we can reach at all until something is deployed.
3. Among those, **`ZeroLogon` and `DeskMemo_3.1` before `CloudBlare(tm)`
   before `FreshInstall_1.0`** — one guess, one guess, one guess, up to four
   guesses. A marginal ordering given the numbers involved, but free.
4. **Prefer high `maxRam` and non-zero `blockedRam`.** RAM is the scarce
   resource for spreading, and `blockedRam` is RAM you can unlock with
   `memoryReallocation` — a server with a lot of it is a large server in
   disguise. `getBlockedRam` is 0GB, so this costs nothing to sort on.
5. **Prefer `isStationary: true`** for anything you plan to build on. A fixed
   server is one you don't have to re-find.
6. **Deprioritise high `requiredCharismaSkill`.** Charisma below the
   requirement doesn't block authentication but does slow it, and it *does*
   block `heartbleed` outright. **source**

**On the named nodes:** `megacorp-security` and `helios_labs` read as
story/high-value by name, and `chongqing` matches the real-world location that
sells darknet access. All **speculative** — names are flavour and the game
gives no indication they carry mechanical weight. Do not let a suggestive
hostname outrank `blockedRam` and model difficulty, which are measurable.

Two of the observed hostnames — `football` and `666666` — are entries in the
game's common-password dictionary. Almost certainly the hostname generator
drawing from a shared wordlist rather than anything meaningful, but it is a
cheap thing to notice if a `TopPass` server ever turns up nearby.

## 5. Charisma

Charisma is the darknet's hidden stat, and this player has had no reason to
train it. It affects, all **source**:

- Authentication duration (below the server's `requiredCharismaSkill` is
  slower; the `.d.ts` warns that deep servers may make it "impossible").
- `heartbleed` — hard-gated. You cannot scrape logs from a server whose
  required charisma exceeds yours. This is the one hard wall.
- `memoryReallocation` yield, `induceServerMigration` effect, `promoteStock`
  effect, and `phishingAttack` success rate and payout.

`phishingAttack` is the bootstrap: it *builds* charisma while also paying out
money and occasionally caches, and its duration shortens as charisma rises
(`max(400/(400 + charisma) × 10000, 200)` ms — 10s at zero charisma, floored
at 0.2s). **source** It can only run from a script on a darknet server, so it
is something to do *with* the net once established, not before.

That makes phishing the natural idle-load for otherwise-unused darknet RAM:
it converts spare capacity into the exact stat that unlocks the deeper net.
Not implemented yet — deliberately, until the deployer has proven it can hold
territory.

## 6. Things to avoid

- **`unleashStormSeed()`** — wipes and replaces much of the darknet. Manual
  only, never in a loop. See `darknet-functions.md`.
- **`induceServerMigration()`** — 4GB, and it moves a server that your own
  scripts may be standing next to, breaking your own connections. Legitimate
  for reaching disconnected islands, but it is a deliberate tool with a
  blast radius, not something to run opportunistically.
- **Destructive `heartbleed`.** Default behaviour **removes** the log lines it
  returns. Use `{peek: true}` unless you specifically want them consumed.
- **Backdooring past ~4 servers** without checking
  `getDarknetInstability()` — see section 2.
- **Treating a 408 as a wrong password** — see `darknet-functions.md`. This is
  the single most likely way for a correct cracker to silently fail.

## 7. Loot RAM-fit: which capability to drop when the full script doesn't fit

Added 2026-08-12, Phase 3b. `dnet_loot.js` does two independent things —
`openCache` (2GB) and `memoryReallocation` (1GB, via `getBlockedRam`-gated
`freeBlockedRam`) — and the live 2026-08-12 checkpoint found a real host
(`darkweb`, later corroborated by a second host, `meg4c0rp`, showing 100% of
its loot attempts skipped for the same reason) where the *whole* 5.55GB
script didn't fit in free RAM. The question this section answers: if a host
can only afford one of the two capabilities, which one should it get?

**RAM says memoryReallocation.** Dropping `openCache` saves 2GB; dropping
`memoryReallocation` only saves 1GB. A RAM-freeing-only variant is cheaper
by construction, so it clears more of the RAM-constrained population than a
cache-only variant would, full stop — this isn't a judgment call, it's
arithmetic against the RAM table in `darknet-functions.md`.

**Value also says memoryReallocation, independently.** `darknet-strategy.md`
§2 (RAM) and §4 (money/caches) already rank these two rewards without this
RAM-fit question in mind: `blockedRam` recovery is durable capacity on a
server (RAM is "the scarce resource for spreading" per §4 of this doc, and
a server with a lot of blocked RAM is "a large server in disguise"), while
cache contents are money and occasional programs — explicitly ranked
**"the least strategically interesting"** payout in the whole system,
because `mcp.js` already generates that resource by other means. So the
cheaper capability to keep also happens to be the more valuable one to
keep. When those two arguments agree, there isn't much of a decision left
to make.

**What this doesn't solve:** a host whose free RAM is below the leaner
script's own floor (~3.35GB) still gets nothing — see
`darknet-functions.md`'s Phase 3b section for why `darkweb` specifically
(observed at 1.6GB free) is very likely still in this bucket, and why no
further RAM-diet on the loot script's side can rescue a host that tight; a
script with the 1.6GB Bitburner base cost and zero further calls is already
close to that ceiling. The fallback narrows the population that gets a flat
skip; it does not eliminate the possibility of one.
