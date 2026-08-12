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

/** Filename-safe shard name for a host. Darknet hostnames contain :, %, @, emoji. */
export function shardName(host) {
  let safe = ""
  for (const ch of String(host)) {
    safe += /[A-Za-z0-9_-]/.test(ch) ? ch : "x" + ch.codePointAt(0).toString(16)
  }
  return `${SHARD_PREFIX}${safe.slice(0, 80)}${SHARD_SUFFIX}`
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

export function shipCred(ns, shard, destination = "home") {
  try {
    return ns.scp(shard, destination)
  } catch (err) {
    ns.print(`WARN shipCred ${shard} -> ${destination}: ${err}`)
    return false
  }
}

/**
 * Update one top-level section of the shared status file without clobbering
 * sections another script (or another roaming instance) wrote.
 *
 * Two different scripts write into STATUS_FILE (dnet_deploy.js's own
 * heartbeat, dnet_creds_merge.js's merged totals), and many concurrent
 * dnet_deploy.js instances may each hold a session on this file's target
 * host. A blind `ns.write(file, ..., "w")` would let whichever writer runs
 * last erase every other section. Read-merge-write at the JSON-object level
 * keeps each writer's own key intact; last-writer-wins only within a single
 * section, which is the correct behavior for a liveness heartbeat.
 *
 * Not safe against two writers racing on the exact same section within the
 * same tick (no lock exists), but that only happens if two dnet_deploy.js
 * instances are both mid-write to the same host's file in the same instant,
 * which the 5s+ mutation floor between passes makes very unlikely. Good
 * enough for a dashboard heartbeat; not a durability guarantee.
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
 * Best-effort mirror of the status file to home, same pattern as shipCred.
 * A no-op (and harmless) when already running on home.
 */
export function shipStatus(ns, destination = "home", file = STATUS_FILE) {
  if (ns.getHostname() === destination) return true
  try {
    return ns.scp(file, destination)
  } catch (err) {
    ns.print(`WARN shipStatus ${file} -> ${destination}: ${err}`)
    return false
  }
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
  const details = ns.dnet.getServerDetails(host)

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
