/**
 * Shared darknet (ns.dnet) helpers: model-aware password solving, durable
 * credential storage, and neighbour inspection.
 *
 * NOTHING HERE HAS RUN IN BITBURNER. Same standing as dnet_probe.js. The
 * difference from a guess is that every model rule below was read out of the
 * game's own bundle (password generators, charsets, wordlists) rather than
 * inferred from play — see docs/darknet-functions.md for the exact
 * expressions. Reading minified source can still be misread, so treat the
 * first live run as the real test.
 *
 * RAM: this module costs nothing by itself. An importer pays for the ns calls
 * inside whichever exports it actually reaches — candidatesFor and the
 * wordlists are 0GB pure JS, acquireSession adds getServerDetails (0.1GB) +
 * connectToSession (0.05GB) + authenticate (0.4GB), and shipCred adds
 * scp (0.6GB). Import only what you need; the game's own RAM readout is the
 * authority, not this comment.
 */

export const CREDS_FILE = "dnet_creds.txt"
export const SHARD_PREFIX = "dnet_cred_"
export const SHARD_SUFFIX = ".txt"
export const STATUS_FILE = "dnet_status.json"
export const DEPLOYER_SHARD_PREFIX = "dnet_deployer_"
export const DEPLOYER_SHARD_SUFFIX = ".json"

/** Response codes, copied from the game's DarknetResponseCodeType. */
export const CODE = {
  Success: 200,
  DirectConnectionRequired: 351,
  AuthFailure: 401,
  Forbidden: 403,
  NotFound: 404,
  RequestTimeOut: 408,
  NotEnoughCharisma: 451,
  StasisLinkLimitReached: 453,
  NoBlockRAM: 454,
  PhishingFailed: 455,
  ServiceUnavailable: 503,
}

/** Model ids, keyed by the game's internal mechanic name for each. */
export const MODEL = {
  EchoVuln: "DeskMemo_3.1",
  SortedEchoVuln: "PHP 5.4",
  NoPassword: "ZeroLogon",
  Captcha: "CloudBlare(tm)",
  DefaultPassword: "FreshInstall_1.0",
  BufferOverflow: "Pr0verFl0",
  MastermindHint: "DeepGreen",
  TimingAttack: "2G_cellular",
  LargestPrimeFactor: "PrimeTime 2",
  RomanNumeral: "BellaCuore",
  DogNames: "Laika4",
  GuessNumber: "AccountsManager_4.2",
  CommonPasswordDictionary: "TopPass",
  EUCountryDictionary: "EuroZone Free",
  Yesn_t: "NIL",
  BinaryEncodedFeedback: "110100100",
  SpiceLevel: "RateMyPix.Auth",
  ConvertToBase10: "OctantVoxel",
  parsedExpression: "MathML",
  divisibilityTest: "Factori-Os",
  tripleModulo: "BigMo%od",
  globalMaxima: "KingOfTheHill",
  packetSniffer: "OpenWebAccessPoint",
  encryptedPassword: "OrdoXenos",
  labyrinth: "(The Labyrinth)",
}

export const DEFAULT_PASSWORDS = ["admin", "password", "0000", "12345"]
export const DOG_NAMES = ["fido", "spot", "rover", "max"]
export const CACHE_PREFIXES = ["wallet", "secrets", "ledger", "stash", "vault", "bankdata", "do_not_open"]
export const EU_COUNTRIES = [
  "Austria", "Belgium", "Bulgaria", "Croatia", "Republic of Cyprus", "Czech Republic", "Denmark",
  "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia",
  "Lithuania", "Luxembourg", "Malta", "Netherlands", "Poland", "Portugal", "Romania", "Slovakia",
  "Slovenia", "Spain", "Sweden",
]
export const COMMON_PASSWORDS = [
  "123456", "password", "12345678", "qwerty", "123456789", "12345", "1234", "111111", "1234567",
  "dragon", "123123", "baseball", "abc123", "football", "monkey", "letmein", "696969", "shadow",
  "master", "666666", "qwertyuiop", "123321", "mustang", "1234567890", "michael", "654321",
  "superman", "1qaz2wsx", "7777777", "121212", "0", "qazwsx", "123qwe", "trustno1", "jordan",
  "jennifer", "zxcvbnm", "asdfgh", "hunter", "buster", "soccer", "harley", "batman", "andrew",
  "tigger", "sunshine", "iloveyou", "2000", "charlie", "robert", "thomas", "hockey", "ranger",
  "daniel", "starwars", "112233", "george", "computer", "michelle", "jessica", "pepper", "1111",
  "zxcvbn", "555555", "11111111", "131313", "freedom", "777777", "pass", "maggie", "159753",
  "aaaaaa", "ginger", "princess", "joshua", "cheese", "amanda", "summer", "love", "ashley", "6969",
  "nicole", "chelsea", "biteme", "matthew", "access", "yankees", "987654321", "dallas", "austin",
  "thunder", "taylor", "matrix",
]

/** Junk alphabet the Captcha model interleaves into its hint data. Contains no digits. */
export const CAPTCHA_NOISE = "/[]╬╸.-()*~:;><#\\"

/**
 * Candidate passwords for a server, in the order they should be tried.
 *
 * Pure: takes only the object ns.dnet.getServerDetails returned, so it is
 * unit-testable under `node --test` without the game. Each candidate carries
 * the reason it was proposed, so a failed crack leaves behind the inputs to
 * the decision rather than just the outcome.
 *
 * `exhaustive` is true when the list provably contains the password (given the
 * model rules hold). When false, the list is a best effort and a miss means
 * the model needs live investigation via heartbleed.
 *
 * @param {object} d - result of ns.dnet.getServerDetails(host)
 * @param {number} [bruteForceLimit] - max numeric candidates to enumerate
 * @returns {{model: string, exhaustive: boolean, candidates: {password: string, why: string}[]}}
 */
export function candidatesFor(d, bruteForceLimit = 0) {
  const hint = typeof d.passwordHint === "string" ? d.passwordHint : ""
  const data = typeof d.data === "string" ? d.data : ""
  const out = []
  const add = (password, why) => {
    if (typeof password !== "string") return
    if (out.some((c) => c.password === password)) return
    out.push({ password, why })
  }

  switch (d.modelId) {
    case MODEL.NoPassword:
      add("", "ZeroLogon: password is the empty string")
      return { model: d.modelId, exhaustive: true, candidates: out }

    case MODEL.DefaultPassword:
      for (const p of DEFAULT_PASSWORDS) add(p, "FreshInstall_1.0: factory default list")
      return { model: d.modelId, exhaustive: true, candidates: out }

    case MODEL.EchoVuln: {
      const tail = hint.trim().split(/\s+/).pop()
      if (tail) add(tail, "DeskMemo_3.1: hint ends with the password verbatim")
      return { model: d.modelId, exhaustive: out.length > 0, candidates: out }
    }

    case MODEL.Captcha: {
      const digits = data.replace(/\D/g, "")
      if (digits) add(digits, "CloudBlare(tm): digits of hint data, noise stripped")
      return { model: d.modelId, exhaustive: out.length > 0, candidates: out }
    }

    case MODEL.SortedEchoVuln:
      add(data, "PHP 5.4: sorted form, correct only if password was already sorted")
      break

    case MODEL.DogNames:
      for (const p of DOG_NAMES) add(p, "Laika4: dog-name list")
      return { model: d.modelId, exhaustive: true, candidates: out }

    case MODEL.CommonPasswordDictionary:
      for (const p of COMMON_PASSWORDS) add(p, "TopPass: common-password dictionary")
      return { model: d.modelId, exhaustive: true, candidates: out }

    case MODEL.EUCountryDictionary:
      for (const p of EU_COUNTRIES) add(p, "EuroZone Free: EU country list")
      return { model: d.modelId, exhaustive: true, candidates: out }

    default:
      break
  }

  for (const token of hintTokens(hint)) add(token, "generic: token lifted from passwordHint")
  if (data) add(data, "generic: hint data used verbatim")
  const digits = data.replace(/\D/g, "")
  if (digits && digits !== data) add(digits, "generic: digits of hint data")

  for (const p of numericCandidates(d, bruteForceLimit)) {
    add(p, `generic: numeric enumeration at length ${d.passwordLength}`)
  }

  return { model: d.modelId, exhaustive: false, candidates: out }
}

/** Bare words and quoted spans in a hint, longest first — cheap generic guesses. */
export function hintTokens(hint) {
  const quoted = [...String(hint).matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2])
  const words = String(hint).split(/\s+/).filter(Boolean)
  return [...new Set([...quoted, ...words])].sort((a, b) => b.length - a.length)
}

/**
 * Numeric passwords of the reported length, capped at `limit` candidates.
 *
 * The game builds numeric passwords with Number(digits).toString(), which
 * strips leading zeros, so a length-N password (N > 1) always starts 1-9.
 */
export function numericCandidates(d, limit) {
  if (!limit || d.passwordFormat !== "numeric") return []
  const len = d.passwordLength
  if (!Number.isInteger(len) || len < 1 || len > 9) return []
  const lo = len === 1 ? 0 : 10 ** (len - 1)
  const hi = 10 ** len - 1
  if (hi - lo + 1 > limit) return []
  const out = []
  for (let i = lo; i <= hi; i++) out.push(String(i))
  return out
}

/**
 * Filename-safe shard name for a host, under an arbitrary prefix/suffix.
 * Darknet hostnames contain :, %, @, emoji — every shard family (credential,
 * loot, and 2026-08-12's deployer heartbeat) needs the same escaping, so it
 * lives here once rather than each caller inventing its own. Defaults match
 * the original credential-shard naming so every existing caller is
 * unaffected. `dnet_loot.js`/`dnet_loot_realloc.js` still build their own
 * shard name with raw `dnet_loot_${host}.json` string interpolation instead
 * of this — a latent bug on a host with `:`/`%`/`@`/emoji in its name, flagged
 * but out of scope to fix here.
 */
export function shardName(host, prefix = SHARD_PREFIX, suffix = SHARD_SUFFIX) {
  let safe = ""
  for (const ch of String(host)) {
    safe += /[A-Za-z0-9_-]/.test(ch) ? ch : "x" + ch.codePointAt(0).toString(16)
  }
  return `${prefix}${safe.slice(0, 80)}${suffix}`
}

/** Parse the credential store. Tolerates a missing or truncated file. */
export function parseCreds(text) {
  const creds = {}
  for (const line of String(text || "").split("\n")) {
    if (!line.trim()) continue
    try {
      const rec = JSON.parse(line)
      if (rec && typeof rec.host === "string" && typeof rec.password === "string") {
        const prev = creds[rec.host]
        if (!prev || (rec.at ?? 0) >= (prev.at ?? 0)) creds[rec.host] = rec
      }
    } catch {
      // A half-written line from a killed script is expected; skip it.
    }
  }
  return creds
}

export function readCreds(ns, file = CREDS_FILE) {
  return parseCreds(ns.read(file))
}

/**
 * Append a credential locally and mirror it to home as a per-host shard.
 *
 * Shards exist so that many roaming agents can persist findings concurrently
 * without clobbering one shared file; dnet_creds_merge.js folds them into
 * CREDS_FILE on home. scp to home needs no session (home is a normal server).
 */
export function recordCred(ns, host, password, model) {
  const rec = JSON.stringify({ host, password, model: model ?? "", at: Date.now() })
  ns.write(CREDS_FILE, rec + "\n", "a")
  const shard = shardName(host)
  ns.write(shard, rec + "\n", "w")
  return shard
}

/**
 * Best-effort scp of any locally-written shard file to a destination
 * (default home). No session needed — home is a normal server. This is the
 * one primitive credential shards, loot shards, and (2026-08-12) deployer
 * heartbeat shards all share: each family only differs in how its filename
 * is generated (shardName above), never in how the file gets to home. Safe
 * by construction as long as the filename is unique per host — many
 * concurrent scp's landing on home never collide with each other because
 * they're different files, unlike a raw `ns.scp(STATUS_FILE, "home")` of a
 * single shared filename would be (see mergeStatus's doc comment for why
 * that exact mistake used to erase this file's other sections).
 */
export function shipShard(ns, shard, destination = "home") {
  try {
    return ns.scp(shard, destination)
  } catch (err) {
    ns.print(`WARN shipShard ${shard} -> ${destination}: ${err}`)
    return false
  }
}

export function shipCred(ns, shard, destination = "home") {
  return shipShard(ns, shard, destination)
}

/**
 * Write this instance's deployer heartbeat to a uniquely-named local shard
 * and return the shard name — does NOT ship it anywhere (caller decides,
 * same read/write split as recordCred/shipCred for credentials).
 *
 * Added 2026-08-12 to fix a real bug: dnet_deploy.js used to call
 * mergeStatus(ns, "deployer", ...) locally (safe — single host, single
 * file) and then shipStatus(ns), which did a raw `ns.scp(STATUS_FILE,
 * "home")` of the *entire* status file. Every roaming instance's own local
 * dnet_status.json only ever has a "deployer" key (only home ever runs
 * dnet_creds_merge.js/dnet_loot_merge.js), so whichever instance's scp
 * landed on home last overwrote home's whole file, silently erasing the
 * "credsMerge"/"loot" sections other scripts had written there. `ns.write`/
 * `ns.read` only ever operate on the calling script's *current* host —
 * there is no remote-host write — so there was never a way to merge into
 * home's copy directly from a remote instance; `scp` was always a raw file
 * copy, never a merge. Full mechanism: docs/darknet-functions.md's
 * 2026-08-12 "status-file clobbering" section.
 *
 * The fix is the same shape credentials and loot already use: give every
 * instance's heartbeat a unique filename (shardName with the
 * DEPLOYER_SHARD_PREFIX/SUFFIX family) so concurrent scp's to home can
 * never collide, then fold shards into dnet_status.json's "deployer"
 * section from a script that only ever runs on home (dnet_status_merge.js)
 * — see that file for the freshest-shard-wins design decision.
 */
export function writeDeployerShard(ns, host, patch) {
  const shard = shardName(host, DEPLOYER_SHARD_PREFIX, DEPLOYER_SHARD_SUFFIX)
  ns.write(shard, JSON.stringify({ ts: Date.now(), ...patch }, null, 2), "w")
  return shard
}

/**
 * Pick the freshest of a set of deployer shards by their own `ts` field.
 * Pure: no ns calls, so the "which heartbeat wins" policy is unit-testable
 * without the game, same as chooseLootMode. Ties broken by input order
 * (first wins) — collisions are extremely unlikely (independent instances'
 * wall-clock heartbeats) and harmless either way since this picks a display
 * heartbeat, not something durability-critical.
 *
 * @param {{file: string, rec: {ts: number}}[]} shards
 * @returns {{file: string, rec: {ts: number}} | null}
 */
export function pickFreshestShard(shards) {
  if (!shards.length) return null
  return shards.reduce((best, cur) => (cur.rec.ts > best.rec.ts ? cur : best))
}

/**
 * Update one top-level section of the shared status file without clobbering
 * sections another script wrote.
 *
 * As of 2026-08-12, every caller of this function runs on `home` only:
 * dnet_creds_merge.js ("credsMerge"), dnet_loot_merge.js ("loot"), and
 * dnet_status_merge.js ("deployer"). `ns.write`/`ns.read` only ever operate
 * on the calling script's *current* host — there is no remote-host write —
 * so mergeStatus was never actually usable for a roaming instance to update
 * home's copy directly; it only ever did the right thing when called on
 * home about home's own file. (dnet_deploy.js used to call this on the
 * *remote* host and then `scp` the whole file to home — a raw copy, not a
 * merge, which is what clobbered the other sections; see
 * writeDeployerShard's doc comment and docs/darknet-functions.md's
 * 2026-08-12 "status-file clobbering" section.) A blind
 * `ns.write(file, ..., "w")` would let whichever writer runs last erase
 * every other section; read-merge-write at the JSON-object level keeps each
 * writer's own key intact, with last-writer-wins only within a single
 * section.
 *
 * Not safe against two writers racing on the exact same section within the
 * same tick (no lock exists), but with every caller now home-only and
 * merge scripts run by hand, that window is effectively closed. Good enough
 * for a dashboard heartbeat; not a durability guarantee.
 *
 * @param {NS} ns
 * @param {string} section - top-level key to set, e.g. "deployer" or "credsMerge"
 * @param {object} patch - value to assign at that key (ts is added automatically if absent)
 * @param {string} [file]
 */
export function mergeStatus(ns, section, patch, file = STATUS_FILE) {
  let current = {}
  try {
    const raw = ns.read(file)
    if (raw) current = JSON.parse(raw)
  } catch (err) {
    ns.print(`WARN mergeStatus: couldn't parse existing ${file}, overwriting: ${err}`)
  }
  current[section] = { ts: Date.now(), ...patch }
  ns.write(file, JSON.stringify(current, null, 2), "w")
  return current
}

/**
 * Get a session on a connected neighbour, cheapest path first.
 *
 * connectToSession is 0.05GB and synchronous, so a known password costs
 * essentially nothing; authenticate is 0.4GB and takes in-game seconds that
 * scale with instability, so it is the fallback.
 *
 * RequestTimeOut is treated as "unknown", never as "wrong password" — the game
 * rolls the instability timeout after the attempt resolves, so a correct
 * password can still come back 408. Counting that as a failure is how a
 * cracker silently skips the right answer.
 *
 * @returns {Promise<{ok: boolean, password?: string, why?: string, code?: number,
 *   tried: number, timeouts: number, exhaustive?: boolean}>}
 */
export async function acquireSession(ns, host, known, opts = {}) {
  const retries = opts.timeoutRetries ?? 2
  const bruteForceLimit = opts.bruteForceLimit ?? 0

  // getServerDetails throws (not a return-value error) on a host string
  // that isn't a real darknet server -- confirmed live 2026-08-12: a
  // corrupted dnet_creds.txt entry with host "6969" (a plausible numeric
  // *password* value, per numericCandidates' doc comment above -- exact
  // corruption mechanism not fully root-caused, a concurrent-write race
  // across many roaming dnet_deploy.js instances appending to the same
  // file is the leading theory, not confirmed) crashed dnet_killswarm.js
  // with an uncaught RUNTIME ERROR. Every caller of acquireSession reads
  // its host list from dnet_creds.txt (plus ns.dnet.probe(), which only
  // ever returns real hosts) -- a single bad line should never be able to
  // take the whole script down, so this is caught here once rather than
  // trusted to every call site.
  let details
  try {
    details = ns.dnet.getServerDetails(host)
  } catch (err) {
    return { ok: false, why: "invalid host", code: CODE.NotFound, tried: 0, timeouts: 0, error: String(err) }
  }

  if (!details.isOnline) return { ok: false, why: "offline", code: CODE.ServiceUnavailable, tried: 0, timeouts: 0 }
  if (details.hasSession) return { ok: true, password: known?.password, why: "already had a session", tried: 0, timeouts: 0 }

  if (known && typeof known.password === "string") {
    const r = ns.dnet.connectToSession(host, known.password)
    if (r.success) return { ok: true, password: known.password, why: "reused stored password", tried: 0, timeouts: 0 }
  }

  if (!details.isConnectedToCurrentServer) {
    return { ok: false, why: "not directly connected", code: CODE.DirectConnectionRequired, tried: 0, timeouts: 0 }
  }

  const plan = candidatesFor(details, bruteForceLimit)
  let tried = 0
  let timeouts = 0

  for (const cand of plan.candidates) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await ns.dnet.authenticate(host, cand.password)
      tried++
      if (res.success) {
        return { ok: true, password: cand.password, why: cand.why, code: res.code, tried, timeouts, exhaustive: plan.exhaustive }
      }
      if (res.code === CODE.RequestTimeOut) {
        timeouts++
        continue
      }
      if (res.code === CODE.AuthFailure) break
      return { ok: false, why: `stopped on code ${res.code}: ${res.message}`, code: res.code, tried, timeouts, exhaustive: plan.exhaustive }
    }
  }

  return {
    ok: false,
    why: plan.candidates.length ? `all ${plan.candidates.length} candidates rejected` : `no candidate rule for model ${plan.model}`,
    code: CODE.AuthFailure,
    tried,
    timeouts,
    exhaustive: plan.exhaustive,
  }
}

/**
 * Reclaim blocked RAM on the calling script's current server, checking
 * getBlockedRam (0GB) before and after each 1GB memoryReallocation call so a
 * call that had nothing to reclaim, or that frees nothing, terminates the
 * loop instead of spinning or paying for calls with nothing to gain.
 *
 * Moved here 2026-08-12 from dnet_loot.js so it can be shared with
 * dnet_loot_realloc.js (the RAM-only lean variant for hosts too
 * RAM-constrained to also fit openCache -- see that file and
 * dnet_deploy.js's lootDeploy()) without the two scripts drifting out of
 * sync on the actual reallocation loop.
 *
 * @param {NS} ns
 * @param {string} host - for the log line only; the call always targets the
 *   current server (memoryReallocation has no target argument)
 * @param {number} maxCalls
 * @returns {Promise<{before: number, after: number, calls: number, why: string}>}
 */
export async function freeBlockedRam(ns, host, maxCalls) {
  const before = ns.dnet.getBlockedRam()
  if (before <= 0) return { before, after: before, calls: 0, why: "nothing blocked" }

  let calls = 0
  let why = "hit call cap"
  while (calls < maxCalls) {
    const remaining = ns.dnet.getBlockedRam()
    if (remaining <= 0) {
      why = "fully reclaimed"
      break
    }

    const res = await ns.dnet.memoryReallocation()
    calls++

    if (!res.success) {
      why = res.code === CODE.NoBlockRAM ? "fully reclaimed" : `stopped on code ${res.code}: ${res.message}`
      break
    }

    if (ns.dnet.getBlockedRam() >= remaining) {
      why = "call freed nothing; stopping rather than spinning"
      break
    }
  }

  const after = ns.dnet.getBlockedRam()
  ns.print(`REALLOC ${host} before=${before} after=${after} calls=${calls} why=${why}`)
  return { before, after, calls, why }
}

/**
 * Which loot script variant fits a target's free RAM, cheapest useful
 * action first. Pure: takes plain numbers (read live by the caller via
 * ns.getScriptRam/ns.getServerMaxRam/ns.getServerUsedRam -- the game's own
 * readout is the authority, never a hardcoded constant here), so it is
 * unit-testable without the game.
 *
 * Policy encoded: prefer "full" whenever it fits (strictly more work done
 * for the same host); fall back to "realloc" -- memoryReallocation only, no
 * openCache -- when the full script doesn't fit but the leaner one does,
 * rather than the old flat skip. `null` means neither fits; the caller
 * skips and reports why, same as before.
 *
 * Realloc was chosen as the fallback capability over cache-only for two
 * reasons, not just because it happens to be cheaper (see
 * docs/darknet-tactics.md for the fuller argument): it drops openCache
 * (2GB, the single largest line item after the 1.6GB base) rather than
 * memoryReallocation (1GB), so it reaches more RAM-constrained hosts; and
 * darknet-strategy.md's own RAM section ranks blockedRam recovery as more
 * durably useful than cache contents (mostly money/karma-cost, "least
 * strategically interesting" per that doc), so the cheaper fallback is also
 * the higher-value one to keep.
 *
 * @param {number} freeRam
 * @param {number} fullRam
 * @param {number} reallocRam
 * @returns {"full"|"realloc"|null}
 */
export function chooseLootMode(freeRam, fullRam, reallocRam) {
  if (freeRam >= fullRam) return "full"
  if (freeRam >= reallocRam) return "realloc"
  return null
}

/** One-line summary of a neighbour, for logs that need the decision inputs. */
export function describe(details, host) {
  return (
    `${host} model=${details.modelId} online=${details.isOnline} conn=${details.isConnectedToCurrentServer} ` +
    `session=${details.hasSession} len=${details.passwordLength} fmt=${details.passwordFormat} ` +
    `depth=${details.depth} diff=${details.difficulty} cha=${details.requiredCharismaSkill} ` +
    `blocked=${details.blockedRam} static=${details.isStationary} hint=${JSON.stringify(details.passwordHint)} ` +
    `data=${JSON.stringify(details.data)}`
  )
}
