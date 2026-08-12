# Darknet function library

Reference for `ns.dnet.*` and the helpers this repo now carries for it.
Companion docs: `darknet-tactics.md` (per-decision reasoning),
`darknet-strategy.md` (sequencing and what we're optimising for).

## Status vocabulary

Used on every claim below, because the difference matters here more than
usual:

| Tag | Means |
| --- | --- |
| **source** | Read out of the game's own files — `NetscriptDefinitions.d.ts` in this repo, or the installed bundle. Not observed in play, but not a guess either. |
| **derived** | My reasoning on top of a **source** fact. The premise is checkable; the inference is mine and could be wrong. |
| **speculative** | A guess. Called out as one. |
| **untested** | No live run. **Every script in this repo's darknet set is untested**, without exception. |

**Update 2026-08-12: no longer true.** `dnet_deploy.js` has now run live on
`home` (fresh `--once` invocation, still active — see the reconciliation note
right below and `darknet-tactics.md` §1) and has cracked servers under all
four solved models with zero failures. The line above is kept as the
document's original standing assumption; treat every **untested** tag below
as superseded wherever this session's live results say otherwise (flagged
inline). The one thing that had been confirmed live before this session was
the `darkweb` entry point (see below).

## Reconciled 2026-08-12: why `probe()` and the "Dark Net" UI tab disagree on server count

Real discrepancy, now resolved by reading the full `Darknet` interface in
`NetscriptDefinitions.d.ts` end to end (all ~20 methods, not just the subset
this doc originally covered) and cross-checking against a live
`dnet_deploy.js --once` run. **source** + **confirmed live**:

- `probe()`'s own doc comment: *"Returns a list of all darknet servers
  connected to the script's current server. For example, if called from a
  script running on `home`, it will return `["darkweb"]`."* A fresh
  `dnet_probe.js` run from `home` returned exactly `["darkweb"]` — matching
  the doc's own example precisely, not a bug and not a narrower-than-expected
  result. `probe()` is deliberately **adjacency-only from wherever the
  calling script's process actually lives**, not a network-wide enumeration.
- **There is no `ns.dnet` function that returns "every darknet server."**
  Confirmed by reading the entire `Darknet` interface: `authenticate`,
  `connectToSession`, `heartbleed`, `openCache`, `probe`, `setStasisLink`,
  `getStasisLinkLimit`, `getStasisLinkedServers`, `getServerDetails`,
  `induceServerMigration`, `unleashStormSeed`, `isDarknetServer`,
  `memoryReallocation`, `getBlockedRam`, `getDepth`, `promoteStock`,
  `phishingAttack`, `getDarknetInstability`, `nextMutation`,
  `getServerRequiredCharismaLevel`. None enumerates the whole net. The
  game's internal `darknetServers()` (referenced in the instability formula,
  `darknet-tactics.md` §2) clearly does exist and clearly feeds the
  in-game "Dark Net" UI tab directly — but it is **not exposed to
  Netscript**, by design, the same way the tutorial frames discovery as
  something you're "supposed to experiment" your way into.
- **So the UI tab and the scripting API are reading from different
  privilege levels, not disagreeing about reality.** The UI, being part of
  the game's own renderer, can show the full known map (however large that
  actually is at any instant); a script is deliberately restricted to
  "what's adjacent to wherever I'm actually running," and the only way to
  see more is to physically get a session running further out (exactly
  `dnet_deploy.js`'s whole design — copy itself onto each cracked host and
  call `probe()` again from there).
- **The network is also genuinely growing/churning in real time**,
  independent of the above. The UI tab read twice in this session, minutes
  apart, went from ~16 named servers to ~31, with several names dropping out
  entirely (`terminal.oasis`, `facebucks`, `neon.tech`, `granny-s@neo^systems`,
  `tetr4d5` — all present in the first read, absent in the second) and many
  new ones appearing. This matches `nextMutation()`'s own documented
  behavior ("servers go offline... new servers appear") to the letter — it
  is not a counting error on either side, it's the darknet actually mutating
  while both reads happened. **confirmed live.**

**Bottom line: `dnet_probe.js` and `dnet_lib.js` are not broken.** The
discovery-count "mismatch" was always the expected, documented shape of the
API — Phase 0 of `darknet-strategy.md` literally predicted this exact
outcome as the success case ("Does `probe()` from home return `["darkweb"]`,
or more? ... If more appears, my model of the entry point is wrong.") and
it did not appear. No code change needed here.

### Where the facts came from

Two sources, both local and both re-checkable:

- `/Users/kth/Documents/BitBurner/NetscriptDefinitions.d.ts` — full JSDoc for
  the whole `Darknet` interface, including RAM costs. This is the easy read
  and should be the first stop for anything below.
- The installed bundle:
  `/Users/kth/Library/Application Support/Steam/steamapps/common/Bitburner/bitburner.app/Contents/Resources/app/dist/main.bundle.js`
  Minified, one enormous line, so `grep -o` with a wide window will blow up on
  backtracking. Use a small Python helper that does `data.find(needle)` and
  slices bytes around the hit. Search strings that work today:
  `m={authenticate:` (the dnet RAM cost table), `EchoVuln:"DeskMemo_3.1"` (the
  model registry), `Type the numbers to prove you are human` (the password
  generators), `2299(e,t,n)` (the wordlists), `W6)().length` (the instability
  formulas), `d.TR[Math.floor` (cache file naming).

Byte offsets are version-specific and will drift; the search strings are the
durable handle.

---

## RAM costs

All confirmed against the game's own cost table (`m={authenticate:.4,…}`),
with the symbolic entries resolved from the shared table in module `458105`
(`Base:1.6, Scan:.2, Exec:1.3, Scp:.6, GetServer:.1, CycleTiming:0`). **source**

| Function | RAM | Notes |
| --- | --- | --- |
| `getStasisLinkLimit` | 0 | |
| `getStasisLinkedServers` | 0 | |
| `getBlockedRam` | 0 | Read-only counterpart to `memoryReallocation`. |
| `getDarknetInstability` | 0 | |
| `nextMutation` | 0 | Table says `CycleTiming`, which resolves to `0`. |
| `labreport` | 0 | |
| `labradar` | 0 | |
| `connectToSession` | 0.05 | Synchronous. The cheap way to hold a password. |
| `getServerDetails` | 0.1 | `GetServer` |
| `getDepth` | 0.1 | `GetServer` |
| `isDarknetServer` | 0.1 | `GetServer`. Does **not** require DarkscapeNavigator.exe. |
| `getServerRequiredCharismaLevel` | 0.1 | `GetServer` |
| `unleashStormSeed` | 0.1 | Cheap in RAM, expensive in consequences. Synchronous, not a promise. |
| `probe` | 0.2 | `Scan` |
| `authenticate` | 0.4 | |
| `heartbleed` | 0.6 | |
| `memoryReallocation` | 1 | |
| `getServer` | 2 | |
| `openCache` | 2 | |
| `promoteStock` | 2 | |
| `phishingAttack` | 2 | |
| `induceServerMigration` | 4 | |
| `setStasisLink` | 12 | Also globally limited. See tactics. |

Non-dnet costs the scripts below depend on, same table: script base `1.6`,
`scp 0.6`, `exec 1.3`, `ls 0.2`, `ps 0.2`, `fileExists 0.1`, `getHostname 0.05`,
`getServerMaxRam 0.05`, `getServerUsedRam 0.05`, `read/write/sleep/toast/
getScriptName 0`.

---

## What `getServerDetails` actually returns

The tutorial undersells this badly. The real shape (**source**,
`NetscriptDefinitions.d.ts` `DarknetServerDetails`):

```
isConnectedToCurrentServer  boolean
hasSession                  boolean
modelId                     string   // "Similar models have similar vulnerabilities"
passwordHint                string   // static reminder text
data                        string   // structured payload from the hint, if any
logTrafficInterval          number   // seconds between the server's own log writes
passwordLength              number
passwordFormat              "numeric" | "alphabetic" | "alphanumeric" | "ASCII" | "unicode"
blockedRam                  number
difficulty                  number   // tied to original depth
depth                       number
requiredCharismaSkill       number
isStationary                boolean  // true for fixed/story servers
isOnline                    boolean  // added on the returned object
```

`passwordLength` + `passwordFormat` together make brute-force cost
*calculable* rather than a shot in the dark, and `data` is where several models
hand you the answer in lightly obfuscated form. A 0.1GB call returning all of
that is the best value in the whole API.

An offline server returns a dummy: `modelId: ""`, `passwordLength: -1`,
`depth: -1`, `logTrafficInterval: -1`, `passwordFormat: "numeric"`. **source**
So `isOnline === false` is the check, but `passwordLength === -1` is a useful
belt-and-braces guard.

## Response codes

**source** — `DarknetResponseCodeType`, plus the error prose above it.

| Code | Name | Meaning for a cracker |
| --- | --- | --- |
| 200 | Success | |
| 351 | DirectConnectionRequired | Topology moved, or wrong hostname. Re-probe. |
| 401 | AuthFailure | Password genuinely wrong. |
| 403 | Forbidden | |
| 404 | NotFound | A required resource (e.g. an `.exe`) isn't on this server. |
| **408** | **RequestTimeOut** | **"the password may or may not have been correct"** |
| 451 | NotEnoughCharisma | |
| 453 | StasisLinkLimitReached | |
| 454 | NoBlockRAM | Nothing left to reallocate. A stop signal, not a failure. |
| 455 | PhishingFailed | |
| 503 | ServiceUnavailable | Server is offline. |

**408 is the trap in this API.** In the `authenticate` implementation the
instability timeout is rolled *after* the attempt resolves —
`if (Math.random() < timeoutChance) return RequestTimeOut` sits after the
`netscriptDelay`, downstream of the correctness check. **source** A correct
password can therefore return 408. Any cracker that treats "not success" as
"wrong password" will silently discard the right answer and then exhaust its
candidate list. Retry 408 with the *same* password; only 401 removes a
candidate.

---

## The model registry

The `.d.ts` says the model list is "intentionally undocumented — you are
supposed to experiment and discover the models." It is nonetheless a plain
object literal in the bundle, and **its keys are the mechanic names**.
**source** (search `EchoVuln:"DeskMemo_3.1"`):

| Mechanic (key) | `modelId` | Observed live? |
| --- | --- | --- |
| NoPassword | `ZeroLogon` | yes |
| DefaultPassword | `FreshInstall_1.0` | yes |
| EchoVuln | `DeskMemo_3.1` | yes |
| Captcha | `CloudBlare(tm)` | yes |
| SortedEchoVuln | `PHP 5.4` | |
| BufferOverflow | `Pr0verFl0` | |
| MastermindHint | `DeepGreen` | |
| TimingAttack | `2G_cellular` | |
| LargestPrimeFactor | `PrimeTime 2` | |
| RomanNumeral | `BellaCuore` | |
| DogNames | `Laika4` | |
| GuessNumber | `AccountsManager_4.2` | |
| CommonPasswordDictionary | `TopPass` | |
| EUCountryDictionary | `EuroZone Free` | |
| Yesn_t | `NIL` | |
| BinaryEncodedFeedback | `110100100` | |
| SpiceLevel | `RateMyPix.Auth` | |
| ConvertToBase10 | `OctantVoxel` | |
| parsedExpression | `MathML` | |
| divisibilityTest | `Factori-Os` | |
| tripleModulo | `BigMo%od` | |
| globalMaxima | `KingOfTheHill` | |
| packetSniffer | `OpenWebAccessPoint` | |
| encryptedPassword | `OrdoXenos` | |
| labyrinth | `(The Labyrinth)` | |

A caveat worth stating plainly: **this is a spoiler the game deliberately
withheld.** If the point of the darknet for Ken is the puzzle, the tactics doc
is the one to read and this table is the one to skip. It is recorded because
the alternative — burning live authenticate attempts to rediscover it — costs
real in-game time, and because the whole premise of this repo is verifying
against source rather than guessing.

### Difficulty gating

Model selection is banded by difficulty (**source**, same module as the
generators). Difficulty ≤ 2 draws only from
`[NoPassword, EchoVuln, DefaultPassword, Captcha]`. Higher bands drop
`NoPassword` and progressively add the harder families.

This independently corroborates the live DOM observation: all 16 nodes seen on
the map were exactly those four models. The shallow net is the easy band, and
the four models we can already solve are the *complete* set for it. **derived**

### Password construction

Every generated password comes from one helper (**source**, search
`W=(e,t=!1)=>`):

```js
W = (length, wide = false) => {
  const charset = "0123456789" + (wide ? "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ" : "")
  // ...pick `clamp(length, 1, 50)` characters...
  return wide ? r : Number(r).toString()
}
```

Two consequences worth holding onto:

- **Default is digits only.** The `wide` flag is what produces alphanumerics,
  and it is only set for the harder models.
- `Number(r).toString()` **strips leading zeros**, so a numeric password of
  reported length N > 1 always starts 1–9. Enumeration should run
  `10^(N-1) … 10^N − 1`, not `0 … 10^N − 1`. **derived**

Max password length is 50 (`i=50` in module `136305`). **source**

---

## (a) Password-cracking dispatch

Implemented in `dnet_lib.js` as `candidatesFor(details, bruteForceLimit)`.
It is **pure** — it takes only the `getServerDetails` result and returns
candidates — which makes it the first thing in this repo that is genuinely
unit-testable under `node --test` without the game, one of the open items in
`process-backlog.md`.

It returns `{ model, exhaustive, candidates: [{ password, why }] }`. The `why`
string exists so a failed crack leaves behind the reasoning that produced each
attempt, not just the fact that it failed — the standing rule in `CLAUDE.md`.
`exhaustive: true` means the list provably contains the password *if the model
rule holds*, which is exactly the assumption a live run tests.

### The four models we can actually solve

All four are **source** for the rule, **derived** for the solver, and as of
2026-08-12 **confirmed live** — every one of them has now cracked a real
server on the live darknet with zero failures, via a fresh `dnet_deploy.js
--once` run on `home` (results read back through `tools/bb_remote.py`'s
`ctl-get`, since the shards land on `home` the moment a crack lands):

| Model | Confirmed host(s) | Password |
| --- | --- | --- |
| `ZeroLogon` | `darksys`, `apex^solutions` | `""` |
| `CloudBlare(tm)` | `EZ_BAKE_OVEN`, `apex_industries`, `apexoasis`, `ultra$blade`, `bachman_&_associates` | e.g. `49137`, `375`, `9051`, `62566`, `4636` |
| `FreshInstall_1.0` | `church_of_the_machine_god`, `blade.systems` | `admin`, `12345` |
| `DeskMemo_3.1` | `rho_construction`, `ten_noen`, `skrowt3n@thgil` | `588`, `265`, `65` |

Twelve cracks, zero misses, across all four solved models — the strongest
possible validation of `candidatesFor()` short of running it against every
server in the shallow net. **The `data`/`hint` decoders described below were
read correctly.**

**`ZeroLogon` (NoPassword)** — password is `""`.
Generator: `h(0, [""], [...hints...], NoPassword)`. Confirmed twice over: the
`darkweb` node is constructed literally as
`{ password: "", modelId: NoPassword, staticPasswordHint: "There is no password", isStationary: true, maxRam: 16 }`,
which matches the live in-game observation exactly, including the 16GB.

```js
add("", "ZeroLogon: password is the empty string")
```

**`FreshInstall_1.0` (DefaultPassword)** — four candidates, total.
Generator draws from wordlist `HC = ["admin", "password", "0000", "12345"]`.
This is the majority model among the 16 observed nodes, and it is a
four-guess crack.

```js
for (const p of ["admin", "password", "0000", "12345"]) add(p, "factory default list")
```

**`DeskMemo_3.1` (EchoVuln)** — the hint *is* the password.
Generator:

```js
u = e => {
  const prefixes = ["The password is","The PIN is","Remember to use","It's set to","The key is","The secret is"]
  const n = W(3)                                   // numeric, ≤3 digits
  return { modelId: EchoVuln, password: n, staticPasswordHint: `${prefix} ${n}` }
}
```

So the password is the last whitespace-delimited token of `passwordHint`.
Note `data` is *not* populated for this model — parse the hint, not the data.
One guess.

```js
const tail = details.passwordHint.trim().split(/\s+/).pop()
```

**`CloudBlare(tm)` (Captcha)** — the password is in `data`, behind noise.
Generator:

```js
g = e => {
  const t = W(e / 2 + 3)                           // numeric
  const n = t.split("").map((c, i) => i >= t.length - 1 ? c : c + b()).join("")
  return { modelId: Captcha, password: t, staticPasswordHint: "Type the numbers to prove you are human", passwordHintData: n }
}
b = () => /* 1–3 chars drawn from */ "/[]╬╸.-()*~:;><#\\"
```

The noise alphabet contains **no digits**, and the password is digits-only, so
stripping non-digits from `data` recovers it exactly. One guess.

```js
const digits = details.data.replace(/\D/g, "")
```

I verified this one end-to-end locally by reconstructing the generator in Node
and round-tripping it through `candidatesFor` — `"8/╬3[╸0].5"` → `"8305"`.
That proves the *decoder* against the *generator as I read it*; it does not
prove I read the generator correctly. Live run still required.

### The other models — documented stubs

`candidatesFor` handles `Laika4`, `TopPass` and `EuroZone Free` from their
wordlists (all **source**), and `PHP 5.4` partially — its `data` holds the
sorted characters, so the password is some permutation of `data`, and only the
already-sorted case is a one-shot.

Everything else falls through to a generic path: tokens lifted from
`passwordHint` (quoted spans first, then longest words), `data` verbatim, the
digits of `data`, and finally bounded numeric enumeration when
`passwordFormat === "numeric"` and the candidate count fits under
`bruteForceLimit`.

**TODO, to be solved live, not guessed:** the hint strings in the generators
describe each remaining puzzle in the clear (`"The password is the largest
prime factor of N"`, `"the password is the base R number X in base 10"`,
`"XOR mask encrypted password: …"` with the mask in `data`, `"Warning:
password buffer is N bytes"`, and so on). Each is a small deterministic
computation over `passwordHint`/`data`. They are *not* implemented here
because none of those models has been seen on this player's net yet, and
writing eight untested solvers for servers that may not exist is exactly the
gold-plating this project avoids. Add each one when a real server with that
`modelId` shows up in a probe.

### Methodology for a genuinely unknown model

If a `modelId` appears that isn't in the table above — a new game version, or a
model the registry read missed — the discovery loop is:

1. **Log the whole `getServerDetails` object.** `describe()` in `dnet_lib.js`
   dumps every field including `passwordHint` and `data` JSON-quoted. Most
   models put the answer, or its shape, in one of those two strings.
2. **Read `passwordLength` and `passwordFormat` before guessing.** They bound
   the search absolutely and cost 0.1GB.
3. **`heartbleed` after a failed attempt** — but with `{ peek: true }` the
   first time. The default **removes** the log lines it returns, which is
   destructive and unrecoverable. **source** Also note logs accumulate on their
   own every `logTrafficInterval` seconds, so a quiet server is worth
   revisiting rather than hammering.
4. **Read `authenticate`'s undocumented `data` property.** The `.d.ts` says
   its type is "intentionally undocumented — you are supposed to experiment
   and discover the content". In the implementation, the rich
   `{ message, data }` form is only returned for *some* servers (gated behind a
   predicate I did not fully resolve); everything else gets a generic
   `AuthFailure` message. **source** for the gate existing, **speculative** for
   which models pass it. Log `data` on every failed attempt — it costs nothing
   and it is the game's own designated feedback channel.
5. **Watch the wall-clock duration of `authenticate`.** For `2G_cellular` the
   duration is a function of how many characters you got right —
   `formulas.dnet.getAuthenticateTime` takes an explicit
   `correctCharactersInPassword` parameter, and the implementation adds a
   `50 × correctChars` term. **source** That is a literal timing side channel,
   and it generalises: time the calls, because for at least one model the
   timing *is* the oracle.
6. **Look for data files.** Darknet servers carry `.data.txt` files
   (`DataFileSuffix: ".data.txt"`). **source** One generator path writes a file
   containing 15 consecutive entries sliced out of the common-password
   dictionary — that is the tutorial's "lists of commonly re-used passwords"
   made concrete. Check `ns.ls(host, ".data.txt")` on every server you land on.

---

## (b) Durable password storage

The tutorial names the problem: "How can passwords be preserved so that they
are not lost if the script holding them is killed?" On the darknet that's not
hypothetical — servers restart and kill their scripts as a routine mutation.

**Design, in `dnet_lib.js` + `dnet_creds_merge.js`:**

- Records are JSON-lines: `{host, password, model, at}`. Line-delimited so a
  script killed mid-write truncates one line rather than corrupting the file;
  `parseCreds` skips unparseable lines by design. Extension is `.txt`, not
  `.jsonl` — `ns.write` rejects `.jsonl` outright, which cost this project a
  full day once (`CLAUDE.md`).
- **Per-host shards, not one shared file.** Each agent writes
  `dnet_cred_<host>.txt` and `scp`s it to `home`. Many roaming agents appending
  to a single file would clobber each other; sharding by host makes concurrent
  writes conflict-free without any locking. **derived**
- `scp` *to* `home` needs no session — home is an ordinary server, and the
  `.d.ts` notes the source server has no darknet requirements. **source**
  That's what makes home a viable sink from anywhere on the net.
- `dnet_creds_merge.js` runs on home, folds shards into `dnet_creds.txt`,
  newest-per-host wins, and optionally prunes.
- Hostnames are hostile to filenames — the live net has `meta:inc`,
  `crypto@net`, `cryptic%systems`, `n07_a_🅱️o7`. `shardName()` escapes every
  non-`[A-Za-z0-9_-]` character to `x<codepoint-hex>` and caps the length.

**Why this matters more than it looks:** a stored password turns a
multi-second `authenticate` (0.4GB, duration inflated by instability, and with
a real chance of a 408) into a `connectToSession` (0.05GB, synchronous, no
roll). Persisted credentials are the single largest efficiency lever in the
whole system. **derived**

## (c) Roaming deployer

`dnet_deploy.js`. Over the tutorial's example, it adds:

| Tutorial gap | What `dnet_deploy.js` does |
| --- | --- |
| Re-authenticates every loop | Tries `connectToSession` with a stored password first |
| Treats any non-success as failure | Retries 408 with the same password; only 401 drops a candidate |
| Loses passwords on death | Shards to `home` the moment a crack lands |
| Can't tell "restarted" from "wrong" | A stored password returning 401 means the server restarted with a new one, so the stale credential is dropped and the host re-cracked |
| Fixed `sleep(5000)` poll | `await ns.dnet.nextMutation()` (0GB) with a 5s floor so a mutation burst can't spin it |
| Ships only itself | Ships `dnet_lib.js` and `dnet_creds.txt` too, so a child starts already knowing what its parent knew |

Failure modes are printed with the inputs to the decision, not just the
outcome — `FAIL <host> model=… why=… code=… tried=… timeouts=… exhaustive=…`.

Estimated RAM ~4.6GB. `darkweb` has 16GB, so the entry point is comfortable;
deeper servers may not be, which is what `memoryReallocation` is for.

**Recovery after mass script death** is the deliberate design centre: kill
everything, run `dnet_creds_merge.js` on home, re-run `dnet_deploy.js` from
home, and every previously-cracked server is re-entered via
`connectToSession` at 0.05GB with no authentication delay at all.

**Bug found live 2026-08-12, not yet fixed:** `spread()`'s
`ns.exec(self, target, { preventDuplicates: true })` passes no `...args`, so
every child copy runs with `flags.once === false` regardless of how the
*parent* was invoked. **source** — confirmed against `exec`'s signature,
`exec(script, host, threadOrOptions?, ...args)`, in `NetscriptDefinitions.d.ts`.
Concretely: `run dnet_deploy.js --once` on `home` still does exactly one pass
*on home*, but the moment it spreads onto `darkweb`, that copy (and every
copy it spreads in turn) loops forever, waiting on `nextMutation()` between
passes. **Observed live**: a single `--once` invocation cascaded into an
autonomous, indefinitely-running crawl that cracked 12+ servers across the
shallow net within minutes, with no further input. This means `--once` only
ever limits the *first* process's pass count, not the network-wide spread —
Phase 2 of `darknet-strategy.md` ("let it loop, no `--once`") turns out to
already be what happens by default, one hop in, whether or not it was asked
for.

**Assessed as low-risk, not fixed yet:** the deployer never calls
`setStasisLink` or anything backdoor-adjacent, and `darknet-tactics.md` §2
established that `authenticate` itself carries **zero** instability cost —
only backdoors do. So the unplanned autonomous spread is doing exactly the
harmless, valuable work Phase 2 wanted (mapping and cracking the shallow
net), just without the deliberate go/no-go `darknet-strategy.md` describes.
Worth a one-line fix (`ns.exec(self, target, { preventDuplicates: true },
...(flags.once ? ["--once"] : []))`) if a truly-bounded single pass is ever
needed for testing, but not urgent — the current live behavior is safe and
is exactly what the actual roadmap wants next anyway.

## (d) Safe secondary actions

`dnet_loot.js`, run on a darknet server. Covers exactly two things and
deliberately no more.

**`memoryReallocation`, gated on `getBlockedRam`.** `getBlockedRam` is 0GB and
`memoryReallocation` is 1GB and takes in-game time, so the check is free and
the call is not. The loop re-checks before every call, stops on code 454
(`NoBlockRAM`), and — importantly — stops if a call *succeeds* but frees
nothing, rather than spinning forever. Fully clearing blocked RAM often leaves
a `.cache` behind, per the tutorial.

**`openCache`.** Files are named `<prefix>_<3 digits>.cache`, with `.d.cache`
marking the richer deep-net variant, prefixes drawn from
`["wallet","secrets","ledger","stash","vault","bankdata","do_not_open"]`.
**source** `ns.ls(host, ".cache")` matches both variants.

**The cost the tutorial never mentions: `openCache` charges karma.** The
implementation does `player.karma -= (difficulty + 1)` and reports it back as
`CacheResult.karmaLoss` (negative). **source** Small on shallow servers,
scaling with difficulty, and karma only moves one way. `dnet_loot.js` sums and
reports it per run so the cost is visible rather than silent.

Explicitly **not** in this script: `setStasisLink` (12GB and a hard global
limit — see tactics), `induceServerMigration` (moves the network under your
own scripts), `phishingAttack` (2GB, wanted the loot script to stay small
enough for a cramped server), `promoteStock` (belongs with the stock strategy,
not with looting), and `unleashStormSeed`.

`dnet_loot.js` writes its own report as a per-host shard
(`dnet_loot_<host>.json`, same sharding reasoning as the credential shards)
and ships it to home; `dnet_loot_merge.js` folds these into `dnet_status.json`'s
`"loot"` section (total karma spent, RAM freed, caches opened, per-host
breakdown), same relationship `dnet_creds_merge.js` has to credential shards.

### Phase 3 (2026-08-12): why a standalone batch pass doesn't work, and the two RAM-fit bugs found getting the inline version live

`dnet_loot_all.js` runs `dnet_loot.js` against every host in the merged
`dnet_creds.txt`, one at a time from home, using `connectToSession` (a
stored password works at any distance, zero instability cost — tactics §2).
Run live against 103 known hosts: **0 looted.** 48/103 came back "no
session" — `connectToSession` itself works fine (confirmed on the one host
that was online), the failure is `ServiceUnavailable`/503 because
`getServerDetails(host).isOnline` is false. **confirmed live.** Most
previously-cracked servers simply aren't online anymore by the time a
*later, separate* pass comes back to check — `nextMutation`'s own
documented behavior ("servers go offline... in many cases permanent") means
"cracked once" and "online now" are different facts, and only the second
one matters for looting. The other 7/103 were reported as "maxRam too
small" — see bug 1 below for why that number is unreliable.

**Bug 1, in `dnet_loot_all.js`, not fixed (kept as manual/one-off tool,
out of scope for the Phase 3 change):** its RAM-fit check reads
`ns.dnet.getServerDetails(host).maxRam`. `DarknetServerDetails` has no
`maxRam` field — checked against the full interface in
`NetscriptDefinitions.d.ts` (see the "What `getServerDetails` actually
returns" section above); `maxRam` lives on the general `Server` object from
`ns.getServer`/`ns.getServerMaxRam` instead. The read is always
`undefined`, `?? 0` makes it always `0`, so the check fails for *every* host
that reaches it regardless of that host's real RAM. **source** for the
missing field, **derived** for the consequence. The "7 too little RAM" from
the live run may not reflect those hosts' actual capacity at all.

**The fix, in `dnet_deploy.js` instead of a separate batch script:** loot
right when a session is freshly confirmed — `acquireSession` just succeeded
means the target is online *right now* — by scp+exec'ing `dnet_loot.js`
onto every neighbour, in the same place `dnet_deploy.js` already scp+execs
itself (`spread()`). This sidesteps the staleness problem entirely: there is
no "later" pass to go stale before.

**Bug 2, in the new inline path, found live and fixed:** the first version
of this check used `ns.getServerMaxRam(target)` alone — *total* RAM, correct
field this time, but not *free* RAM. Live test against `darkweb`:
`dnet_loot.js` and `dnet_lib.js` landed there fine (scp succeeded, confirmed
by reading the files directly off the `darkweb` host via the Remote API's
`getFile`), but `exec` silently returned pid 0 and `dnet_loot.js` never ran
— no shard, no error, no signal beyond the silent `pid === 0`. **confirmed
live.** Root cause: `darkweb`'s 16GB is mostly consumed by the already-running,
long-lived `dnet_deploy.js` swarm occupant sitting there since Phase 2 — total
RAM looked sufficient, free RAM wasn't. Fixed to check
`getServerMaxRam(target) - getServerUsedRam(target)`, the same free-RAM
pattern `mcp.js` already uses for the regular network. A hand-built mock
test (`getServerUsedRam` returning a large value for a "busy" host) was
added specifically to catch a regression back to the total-RAM-only version.

**Why `darkweb` itself may stay un-looted for a while, and that's expected,
not broken:** `darkweb` can only be reached by a *fresh* (new-code)
`dnet_deploy.js` instance launched from `home` — the existing swarm's
already-spread copies are running the pre-loot code and will never gain
`lootDeploy` without a restart (Bitburner does not hot-reload). A fresh
instance's very first hop is `darkweb`, and as long as the old occupant is
still squatting there consuming most of its RAM, the free-RAM check will
correctly keep reporting `why: "ram"` for it. This is now a *visible,
diagnosable* state (`LOOT-SKIP darkweb why=ram` printed, and
`dnet_status.json`'s `deployer.thisPass.lootSkipped.ram` incremented)
instead of the old silent, uncategorized failure. Getting real network-wide
loot numbers past this point needs either natural attrition (mutations
eventually restart/kill old-code occupants) or a deliberate kill-and-restart
of the swarm so fresh code can take their place — not done as part of this
change, since it means briefly interrupting an otherwise healthy,
continuously-productive process.

## `unleashStormSeed` — do not automate

0.1GB, synchronous, executes `STORM_SEED.exe` if present on the current
server. The game's own doc: *"that exe file creates a webstorm that can cause
catastrophic damage to the darknet. Run at your own risk."* The dev-menu UI
labels the same action *"Start a violent 'webstorm,' which will wipe out much
of the dark net and replace it."* **source**

Treat as a deliberate, manual, single-purpose reset button. It must never
appear in a loop, a dispatch table, or a "try everything" fallback. No script
in this repo calls it.

## `labreport` / `labradar` — unknown

0GB each. `Promise<Result<any>>`. Their entire documentation is one line of
flavour text: *"Not all who wander are lost."* and *"There is more than meets
the eye."*

Partial **source**: `labreport`'s implementation reads a `lab` off some game
state and, when it is absent, returns `{ success: false, message: "You feel
lost..." }`. So there is a "lab" concept somewhere on the net that these
relate to, and calling `labreport` when you haven't found it is harmless and
returns a recognisable sentinel string.

Beyond that: **unknown.** Not guessing at their purpose. They are free to call
and return a defined failure shape, so calling `labreport()` once from a deep
server and logging the result is a zero-cost experiment worth running — but
what it means is undetermined.
