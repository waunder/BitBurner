/**
 * Pure R4 audit calculator.
 *
 * This module deliberately does not call ns or ns.formulas. A future live
 * adapter may produce the currentModel/hypotheticalModel metric bundles, but
 * this comparison layer stays deterministic and side-effect free.
 */
import { computeTargetScore, computeTargetEffectiveScore } from "./mcp_logic.js"

const REQUIRED_METRICS = [
  "hackTimeSeconds",
  "hackPercentPerThread",
  "growLogPerThread",
  "maxMoney",
  "hackChance",
  "poolThreads",
  "money",
  "targetMoneyGoal",
  "horizonSeconds",
  "growTimeRatio",
  "hackSecIncrease",
  "growSecIncrease",
  "weakenSecDecrease",
  "weakenPerHackRatio",
  "weakenPerGrowRatio",
]

function finite(value) {
  return typeof value === "number" && Number.isFinite(value)
}

function validateModel(model, label) {
  if (!model || typeof model !== "object") return [`${label} is missing`]
  const errors = []
  for (const key of REQUIRED_METRICS) {
    if (!finite(model[key])) errors.push(`${label}.${key} must be finite`)
  }
  if (model.hackTimeSeconds <= 0) errors.push(`${label}.hackTimeSeconds must be positive`)
  if (model.hackPercentPerThread <= 0) errors.push(`${label}.hackPercentPerThread must be positive`)
  if (model.growLogPerThread <= 0) errors.push(`${label}.growLogPerThread must be positive`)
  if (model.maxMoney < 0) errors.push(`${label}.maxMoney must be non-negative`)
  if (model.money < 0 || model.money > model.maxMoney) errors.push(`${label}.money must be within maxMoney`)
  if (model.hackChance < 0 || model.hackChance > 1) errors.push(`${label}.hackChance must be between 0 and 1`)
  if (model.poolThreads < 0) errors.push(`${label}.poolThreads must be non-negative`)
  if (model.targetMoneyGoal <= 0 || model.targetMoneyGoal > 1) errors.push(`${label}.targetMoneyGoal must be in (0, 1]`)
  if (model.horizonSeconds <= 0) errors.push(`${label}.horizonSeconds must be positive`)
  if (model.growTimeRatio <= 0 || model.weakenSecDecrease <= 0) errors.push(`${label} security/time ratios must be positive`)
  return errors
}

function scoreModel(model) {
  const score = computeTargetScore({
    hackTime: model.hackTimeSeconds,
    hackPercentPerThread: model.hackPercentPerThread,
    growLogPerThread: model.growLogPerThread,
    maxMoney: model.maxMoney,
    hackChance: model.hackChance,
    poolThreads: model.poolThreads,
    growTimeRatio: model.growTimeRatio,
    hackSecIncrease: model.hackSecIncrease,
    growSecIncrease: model.growSecIncrease,
    weakenSecDecrease: model.weakenSecDecrease,
    weakenPerHackRatio: model.weakenPerHackRatio,
    weakenPerGrowRatio: model.weakenPerGrowRatio,
  })
  const effective = computeTargetEffectiveScore({
    score: score.score,
    hackTime: model.hackTimeSeconds,
    growLogPerThread: model.growLogPerThread,
    maxMoney: model.maxMoney,
    money: model.money,
    targetMoneyGoal: model.targetMoneyGoal,
    growThreadsIfAllGrow: model.poolThreads,
    growTimeRatio: model.growTimeRatio,
    horizonSeconds: model.horizonSeconds,
  })
  return {
    rawScore: score.score,
    effectiveScore: effective.effective,
    rampSeconds: effective.rampSeconds,
    components: score,
  }
}

export function auditTargetModels({ target, currentModel, hypotheticalModel }) {
  const errors = [
    ...validateModel(currentModel, "currentModel"),
    ...validateModel(hypotheticalModel, "hypotheticalModel"),
  ]
  if (errors.length > 0) {
    return {
      eligible: false,
      recommendationStatus: "needs-investigation",
      target: target || null,
      errors,
      warnings: [],
      models: null,
    }
  }

  const current = scoreModel(currentModel)
  const hypothetical = scoreModel(hypotheticalModel)
  return {
    eligible: true,
    recommendationStatus: "compare",
    target: target || null,
    errors: [],
    warnings: ["Hypothetical metrics are externally supplied; live formulas provenance is not asserted here."],
    models: {
      current: { state: "current", units: "dollars_per_second", ...current },
      hypothetical: { state: "hypothetical", units: "dollars_per_second", ...hypothetical },
    },
  }
}
