/** Plays each solver against the game's own reply rules, copied from the v3.0.1 bundle. */
import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { DIGITS, LETTERS, feedbackSolver, runSolver } from "./dnet_feedback.js"
import { candidatesFor, evaluateExpression, fromBase, fromRoman, largestPrimeFactor } from "./dnet_lib.js"

const exactly = (pw, guess) => [...pw].filter((c, i) => c === guess[i]).length
const misplaced = (pw, guess) => {
  const a = [...pw].filter((c, i) => c !== guess[i])
  const b = [...guess].filter((c, i) => c !== pw[i])
  return b.filter((c, i) => a.includes(c) && b.slice(0, i).filter(x => x === c).length < a.filter(x => x === c).length).length
}
const replies = {
  NIL: (pw, g) => ({ data: [...g].map((c, i) => (c === pw[i] ? "yes" : "yesn't")).join(",") }),
  DeepGreen: (pw, g) => ({ data: `${exactly(pw, g)},${misplaced(pw, g)}` }),
  "RateMyPix.Auth": (pw, g) => ({ data: `${"🌶️".repeat(exactly(pw, g)) || "0"}/${pw.length}` }),
  "2G_cellular": (pw, g) => ({ message: `Found a mismatch while checking each character (${[...pw].findIndex((c, i) => c !== g[i])})`, data: "Response time: 5ms" }),
  BellaCuore: (pw, g) => ({ data: Number(g) > Number(pw) ? "ALTUS NIMIS" : "PARUM BREVIS" }),
  "AccountsManager_4.2": (pw, g) => ({ data: Number(g) > Number(pw) ? "Lower" : "Higher" }),
  "Factori-Os": (pw, g) => ({ data: Number(pw) % Number(g) ? "false" : "true" }),
  "BigMo%od": (pw, g) => ({ data: String(Number(pw) % Number(g) % ((Number(g) - 1) % 32 + 1)) }),
  OpenWebAccessPoint: (pw, g, host) => ({ data: `noise xyz ${host}:${pw} more noise` }),
}

async function play(details, password, host = "some:host") {
  const seen = []
  const ask = async guess => {
    seen.push(guess)
    if (guess === password) return { success: true }
    return replies[details.modelId](password, guess, host)
  }
  const result = await runSolver(feedbackSolver(details, host), ask, Infinity)
  return { result, seen }
}

const random = (chars, length) => Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
const positive = length => String(10 ** (length - 1) + Math.floor(Math.random() * 9 * 10 ** (length - 1)))

describe("feedback solvers", () => {
  for (const [model, format] of [["NIL", "numeric"], ["NIL", "alphanumeric"], ["DeepGreen", "numeric"], ["DeepGreen", "alphanumeric"],
    ["RateMyPix.Auth", "numeric"], ["2G_cellular", "numeric"], ["2G_cellular", "alphanumeric"]]) {
    test(`${model} finds ${format} passwords`, async () => {
      for (let run = 0; run < 200; run++) {
        const length = 1 + run % 10
        const password = format === "numeric" ? positive(length) : random(DIGITS + LETTERS, length)
        const { result } = await play({ modelId: model, passwordLength: length, passwordFormat: format, difficulty: 10 }, password)
        assert.deepEqual([result.ok, result.password], [true, password])
      }
    })
  }

  test("DeepGreen at difficulty 12 stays within the session budget", async () => {
    let most = 0
    for (let run = 0; run < 500; run++) {
      const { seen } = await play({ modelId: "DeepGreen", passwordLength: 4, passwordFormat: "numeric", difficulty: 12 }, positive(4))
      most = Math.max(most, seen.length)
    }
    assert.ok(most <= 25, `took ${most}`)
  })

  test("BellaCuore bisects the numeral range", async () => {
    const { result, seen } = await play({ modelId: "BellaCuore", data: "XL,CCC", difficulty: 9 }, "123")
    assert.equal(result.password, "123")
    assert.ok(seen.length <= 9)
  })

  test("BellaCuore has no feedback solver below difficulty 8: the numeral is the answer", () => {
    assert.equal(feedbackSolver({ modelId: "BellaCuore", data: "XLII" }, "h"), null)
  })

  test("AccountsManager_4.2 bisects", async () => {
    const { result, seen } = await play({ modelId: "AccountsManager_4.2", difficulty: 12 }, "37")
    assert.equal(result.password, "37")
    assert.ok(seen.length <= 7)
  })

  test("Factori-Os finds products of small and large primes", async () => {
    for (const [value, difficulty] of [[360, 8], [2 * 3 * 3 * 89, 12], [1, 8], [7 * 97 * 1069, 14], [97, 12]]) {
      const password = String(value)
      const { result } = await play({ modelId: "Factori-Os", passwordLength: password.length, difficulty }, password)
      assert.equal(result.password, password)
    }
  })

  test("BigMo%od rebuilds the password from residues", async () => {
    for (const password of ["7", "4242", "98765", "1234567890", "12345678901234"]) {
      const { result, seen } = await play({ modelId: "BigMo%od", passwordLength: password.length, difficulty: 12 }, password)
      assert.equal(result.password, password)
      assert.ok(seen.length <= 12)
    }
  })

  test("OpenWebAccessPoint lifts the password out of the noise", async () => {
    const { result } = await play({ modelId: "OpenWebAccessPoint", passwordLength: 6, difficulty: 10 }, "a1b2c3", "cr@zy:host")
    assert.equal(result.password, "a1b2c3")
    assert.equal(feedbackSolver({ modelId: "OpenWebAccessPoint", difficulty: 17 }, "h").next().done, true)
  })

  test("a model without a solver returns null", () => {
    assert.equal(feedbackSolver({ modelId: "FreshInstall_1.0" }, "h"), null)
    assert.equal(feedbackSolver({ modelId: "KingOfTheHill" }, "h"), null)
  })

  test("runSolver stops on a refusal and on the deadline", async () => {
    const solver = () => feedbackSolver({ modelId: "NIL", passwordLength: 3, passwordFormat: "numeric" }, "h")
    const refused = await runSolver(solver(), async () => ({ stop: { code: 351, message: "moved" } }), Infinity)
    assert.deepEqual([refused.ok, refused.code], [false, 351])
    const late = await runSolver(solver(), async () => ({ data: "" }), 5, () => 10)
    assert.deepEqual([late.ok, late.code], [false, 408])
  })
})

describe("answers in the hint data", () => {
  const first = d => candidatesFor(d).candidates[0]?.password
  test("roman numerals", () => {
    assert.equal(fromRoman("MCMXCIV"), 1994)
    assert.equal(fromRoman("nulla"), 0)
    assert.equal(first({ modelId: "BellaCuore", data: "CDXLIV" }), "444")
    assert.equal(first({ modelId: "BellaCuore", data: "X,L" }), undefined)
  })
  test("largest prime factor", () => {
    assert.equal(largestPrimeFactor(9859 * 2 * 3 * 97), 9859)
    assert.equal(first({ modelId: "PrimeTime 2", data: String(1069 * 5) }), "1069")
  })
  test("base conversion, whole and fractional base", () => {
    assert.equal(fromBase("16,FF"), 255)
    assert.equal(first({ modelId: "OctantVoxel", data: "8,777" }), "511")
    // The game's encoder for 100 in base 2.5.
    let digits = ""
    let rest = 100
    for (let power = Math.floor(Math.log(100) / Math.log(2.5)); rest >= 1e-4 || power >= 0; power--) {
      if (power === -1) digits += "."
      const digit = Math.floor(rest / 2.5 ** power)
      digits += digit
      rest -= digit * 2.5 ** power
    }
    assert.equal(first({ modelId: "OctantVoxel", data: `2.5,${digits}` }), "100")
  })
  test("expressions, with disguised operators and bait", () => {
    assert.equal(evaluateExpression("2 + 3 * ( 4 - 1 )"), 11)
    assert.equal(evaluateExpression("8 ÷ 4 ➖ 3 ҳ 2 ➕ 1"), -3)
    assert.equal(evaluateExpression("( 10 - 12 ) * 3"), -6)
    assert.equal(evaluateExpression("(ns.exit(),1 + 2) * 2"), 6)
    assert.equal(evaluateExpression('1 + 2 , !globalThis.pwn3d && (globalThis.pwn3d=true) , ns.exit()'), 3)
    assert.equal(first({ modelId: "MathML", data: "7 / 2" }), "3.5")
  })
  test("binary bytes and XOR masks", () => {
    assert.equal(first({ modelId: "110100100", data: "01100001 00110001" }), "a1")
    const password = "aB3"
    const masks = [5, 17, 30]
    const sealed = [...password].map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ masks[i])).join("")
    assert.equal(first({ modelId: "OrdoXenos", data: `${sealed};${masks.map(m => m.toString(2).padStart(8, "0")).join(" ")}` }), password)
  })
})
