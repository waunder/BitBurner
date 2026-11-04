/**
 * Solvers for darknet password models that answer a wrong guess with a clue.
 * Pure: each model is a generator that yields a guess and receives the reply,
 * and only dnet_scout.js pays for the heartbleed call that reads the reply.
 * Rules are from the game bundle (v3.0.1); a plain authenticate hides the clue,
 * but the server logs it. Outside a model's alphabet FILLER never matches.
 */
import { fromRoman } from "./dnet_lib.js"

export const DIGITS = "0123456789"
export const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
const FILLER = "~"
const SMALL_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97]
const LARGE_PRIMES = [1069, 1409, 1471, 1567, 1597, 1601, 1697, 1747, 1801, 1889, 1979, 1999, 2063, 2207, 2371, 2503, 2539, 2693, 2741, 2753, 2801, 2819, 2837, 2909, 2939, 3169, 3389, 3571, 3761, 3881, 4217, 4289, 4547, 4729, 4789, 4877, 4943, 4951, 4957, 5393, 5417, 5419, 5441, 5519, 5527, 5647, 5779, 5881, 6007, 6089, 6133, 6389, 6451, 6469, 6547, 6661, 6719, 6841, 7103, 7549, 7559, 7573, 7691, 7753, 7867, 8053, 8081, 8221, 8329, 8599, 8677, 8761, 8839, 8963, 9103, 9199, 9343, 9467, 9551, 9601, 9739, 9749, 9859]
const MODULI = [32, 31, 29, 27, 25, 23, 19, 17, 13, 11, 7]

function alphabet(d) {
  if (d.passwordFormat === "numeric") return DIGITS
  return d.passwordFormat === "alphabetic" ? LETTERS : DIGITS + LETTERS
}

// NIL marks each position yes or yesn't, so one guess tests a character everywhere still unknown.
function* byPositionMarks(d) {
  const known = Array(d.passwordLength).fill(null)
  for (const char of alphabet(d)) {
    const reply = yield known.map(k => k ?? char).join("")
    String(reply.data).split(",").forEach((mark, i) => { if (mark === "yes") known[i] ??= char })
    if (known.every(k => k !== null)) return yield known.join("")
  }
}

// DeepGreen and RateMyPix.Auth report only how many characters are in place.
function* byExactCount(d, exactOf) {
  const length = d.passwordLength
  const known = Array(length).fill(null)
  const open = () => known.flatMap((k, i) => (k === null ? [i] : []))
  const mask = (char, spots) => Array.from({ length }, (_, i) => (spots.includes(i) ? char : FILLER)).join("")
  for (const char of alphabet(d)) {
    const positions = open()
    if (!positions.length) break
    let count = exactOf(yield mask(char, positions))
    while (count > 0 && positions.length) {
      if (positions.length === count) {
        for (const spot of positions) known[spot] = char
        break
      }
      const spot = positions.shift()
      if (exactOf(yield mask(char, [spot])) > 0) {
        known[spot] = char
        count--
      }
    }
  }
  if (!open().length) yield known.join("")
}

// 2G_cellular logs the index of the first wrong character.
function* byMismatchIndex(d) {
  let prefix = ""
  while (prefix.length < d.passwordLength) {
    const before = prefix.length
    for (const char of alphabet(d)) {
      const guess = (prefix + char).padEnd(d.passwordLength, FILLER)
      const index = Number(/\((-?\d+)\)/.exec(String((yield guess).message))?.[1])
      if (index > before || index === -1) {
        prefix += char
        break
      }
    }
    if (prefix.length === before) return
  }
}

function* bisect(low, high, tooHigh) {
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (tooHigh(yield String(middle))) high = middle - 1
    else low = middle + 1
  }
}

// Factori-Os says whether a number divides the password, so products build up to it.
function* byDivisors(d) {
  let product = 1
  const fits = value => String(value).length <= d.passwordLength
  for (const prime of d.difficulty > 12 ? [...SMALL_PRIMES, ...LARGE_PRIMES] : SMALL_PRIMES) {
    while (fits(product * prime)) {
      if ((yield String(product * prime)).data !== "true") break
      product *= prime
    }
  }
  yield String(product)
}

// BigMo%od: below 33 the reply is simply the password modulo the guess.
function* byResidues(d) {
  let value = 0n
  let modulus = 1n
  const limit = 10n ** BigInt(d.passwordLength)
  for (const size of MODULI) {
    const residue = BigInt((yield String(size)).data)
    const step = BigInt(size)
    while (value % step !== residue) value += modulus
    modulus *= step
    if (modulus >= limit) break
  }
  yield value.toString()
}

// OpenWebAccessPoint hides " host:password " in the noise it logs, up to difficulty 16.
function* bySniffing(d, host) {
  if (d.difficulty > 16) return
  const noise = String((yield FILLER).data)
  const start = noise.indexOf(`${host}:`)
  if (start >= 0) yield noise.slice(start + host.length + 1).split(" ")[0]
}

const PEAK = 10_000
const HILL_DROP = 2_600

// KingOfTheHill answers with the altitude of Gaussian hills, 10,000 m at the password and
// 2,600 m lower per hill away, about 3 widths apart (game source, dev). Far from a hill the
// altitude is tiny but exact, so a parabola through three log-altitudes gives the nearest
// hill's centre and height, and a side hill's height says how far away the peak is.
function* byAltitude(d) {
  const length = d.passwordLength
  if (!(length > 1)) {
    for (const digit of DIGITS) yield digit
    return
  }
  const low = 10 ** (length - 1)
  const high = 10 ** length - 1
  const width = 10 ** (length - 2) + 1
  const inRange = x => Math.min(high, Math.max(low, Math.round(x)))
  const altitudeAt = function* (x) { return Number((yield String(x)).data) }
  const logAltitude = function* (x) { return Math.log(yield* altitudeAt(x)) }
  // Hills four or more away from the peak are below sea level, so fit the size and keep the sign.
  const fitAt = function* (x, step) {
    const middle = Math.min(high - step, Math.max(low + step, Math.round(x)))
    const samples = []
    for (const at of [middle - step, middle, middle + step]) samples.push(yield* altitudeAt(at))
    const sign = Math.sign(samples[1])
    if (!sign || samples.some(value => Math.sign(value) !== sign)) return null
    const [below, at, above] = samples.map(value => Math.log(Math.abs(value)))
    if (![below, at, above].every(Number.isFinite)) return null
    const curve = (above - 2 * at + below) / (2 * step * step)
    const slope = sign * (above - below) / (2 * step)
    if (!(curve < 0)) return { middle, slope }
    return { middle, centre: middle - sign * slope / (2 * curve), height: sign * Math.exp(at - slope * slope / (4 * curve)) }
  }
  const seeds = []
  for (let x = low + 13 * width; x < high; x += 26 * width) seeds.push(x)
  seeds.push(high - 13 * width)
  const tried = new Set()
  const fitted = new Set()
  let x = seeds.shift()
  for (let round = 0; round < 20 && x !== undefined; round++) {
    // A jump that lands where an earlier fit stood would only repeat it.
    if (fitted.has(inRange(x))) {
      x = seeds.shift()
      continue
    }
    fitted.add(inRange(x))
    const fit = yield* fitAt(x, Math.max(1, Math.round(width / 2)))
    if (!fit) {
      x = seeds.shift()
      continue
    }
    if (fit.centre === undefined) {
      x = fit.middle + Math.sign(fit.slope) * 2 * width
      continue
    }
    if (fit.height > PEAK - HILL_DROP / 2) {
      // Within 3% of the password only the main hill counts, so narrow fits converge on it exactly.
      let centre = inRange(fit.centre)
      for (let closer = 0; closer < 4; closer++) {
        const close = yield* fitAt(centre, Math.max(1, Math.round(width / 20)))
        const next = close?.centre === undefined ? centre : inRange(close.centre)
        if (next === centre) break
        centre = next
      }
      for (const guess of [0, 1, -1, 2, -2].map(offset => inRange(centre + offset))) {
        if (!tried.has(guess)) {
          tried.add(guess)
          yield String(guess)
        }
      }
      x = centre + width
      continue
    }
    const reach = 3 * width * Math.max(1, Math.round((PEAK - fit.height) / HILL_DROP))
    // Hill heights jitter, so a peak near either end can be overshot: clamp rather than drop.
    const sides = [...new Set([inRange(fit.centre + reach), inRange(fit.centre - reach)])]
    let best = -Infinity
    x = sides[0]
    for (const side of sides) {
      const altitude = yield* logAltitude(side)
      if (altitude > best) [best, x] = [altitude, side]
    }
  }
}

const SPICE = "\u{1F336}"

/** A generator of guesses for the model, or null when it has no feedback solver. */
export function feedbackSolver(d, host) {
  switch (d.modelId) {
    case "NIL": return byPositionMarks(d)
    case "DeepGreen": return byExactCount(d, reply => Number(String(reply.data).split(",")[0]))
    case "RateMyPix.Auth": return byExactCount(d, reply => String(reply.data).split(SPICE).length - 1)
    case "2G_cellular": return byMismatchIndex(d)
    case "BellaCuore": {
      const [low, high] = String(d.data).split(",")
      return high ? bisect(fromRoman(low), fromRoman(high), reply => String(reply.data).startsWith("ALTUS")) : null
    }
    case "AccountsManager_4.2": return bisect(0, Math.ceil((10 * ((d.difficulty ?? 0) + 3)) / 3), reply => reply.data === "Lower")
    case "Factori-Os": return byDivisors(d)
    case "BigMo%od": return byResidues(d)
    case "OpenWebAccessPoint": return bySniffing(d, host)
    case "KingOfTheHill": return byAltitude(d)
    default: return null
  }
}

/**
 * Plays a solver against ask(guess), which resolves to { success }, { stop } or a
 * reply. Returns the acquireSession shape: ok with the password, or why it failed.
 */
export async function runSolver(solver, ask, deadline, now = Date.now) {
  let tried = 0
  let step = solver.next()
  while (!step.done) {
    if (now() >= deadline) return { ok: false, why: `time budget exceeded after ${tried} guesses`, code: 408, tried }
    const guess = step.value
    const reply = await ask(guess)
    tried++
    if (reply.success) return { ok: true, password: guess, why: "feedback solver", tried }
    if (reply.stop) return { ok: false, why: `stopped on code ${reply.stop.code}: ${reply.stop.message}`, code: reply.stop.code, tried }
    step = solver.next(reply)
  }
  return { ok: false, why: `feedback solver ran out after ${tried} guesses`, code: 401, tried }
}
