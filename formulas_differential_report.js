import { auditTargetModels } from "./formulas_logic.js"

const base = {
  hackTimeSeconds: 10,
  hackPercentPerThread: 0.01,
  growLogPerThread: 0.001,
  maxMoney: 1e6,
  hackChance: 0.9,
  poolThreads: 100,
  money: 1e6,
  targetMoneyGoal: 0.95,
  horizonSeconds: 3600,
  growTimeRatio: 3.2,
  hackSecIncrease: 0.002,
  growSecIncrease: 0.004,
  weakenSecDecrease: 0.05,
  weakenPerHackRatio: 1,
  weakenPerGrowRatio: 1,
}

const fixtures = [
  { id: "ready-baseline", current: {}, hypothetical: { hackTimeSeconds: 8 } },
  { id: "floor-state", current: {}, hypothetical: { hackTimeSeconds: 9, growLogPerThread: 0.0012 } },
  { id: "drained-ramp", current: { money: 1000 }, hypothetical: { money: 1000, hackTimeSeconds: 9 } },
]

for (const fixture of fixtures) {
  const result = auditTargetModels({
    target: fixture.id,
    currentModel: { ...base, ...fixture.current },
    hypotheticalModel: { ...base, ...fixture.hypothetical },
  })
  if (!result.eligible) throw new Error(`${fixture.id}: ${result.errors.join(", ")}`)
  const current = result.models.current
  const hypothetical = result.models.hypothetical
  console.log(JSON.stringify({
    fixtureId: fixture.id,
    currentRaw: current.rawScore,
    hypotheticalRaw: hypothetical.rawScore,
    currentEffective: current.effectiveScore,
    hypotheticalEffective: hypothetical.effectiveScore,
    rawDeltaPct: ((hypothetical.rawScore / current.rawScore) - 1) * 100,
    effectiveDeltaPct: ((hypothetical.effectiveScore / current.effectiveScore) - 1) * 100,
    classification: "needs-senior-review",
  }))
}
