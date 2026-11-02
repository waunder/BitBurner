/** Pure planning for stack_batch.js and stack_manager.js. No ns calls, no side effects. */
export const JOB_RAM = 2.0

/** Delays so jobs land hack, weaken, grow, weaken, each gapMs apart. */
export function landingDelays({ hackMs, growMs, weakenMs }, gapMs) {
  return {
    hack: Math.max(0, weakenMs - gapMs - hackMs),
    hackWeaken: 0,
    grow: Math.max(0, weakenMs + gapMs - growMs),
    growWeaken: 2 * gapMs,
  }
}

/** Threads for one batch; the weakens cancel exactly what hack and grow add. */
export function batchThreads({ hackPercent, growThreadsNeeded, hackSecurity, growSecurity, weakenPower, hackFraction }) {
  const hack = Math.max(1, Math.floor(hackFraction / hackPercent))
  const grow = Math.ceil(growThreadsNeeded * 1.1)
  return {
    hack, grow,
    hackWeaken: Math.ceil(hackSecurity * hack / weakenPower) + 1,
    growWeaken: Math.ceil(growSecurity * grow / weakenPower) + 1,
  }
}

export function batchRam(threads) {
  return (threads.hack + threads.grow + threads.hackWeaken + threads.growWeaken) * JOB_RAM
}

/** Drift past these limits means batches landed out of order: stop and re-prepare. */
export function isHealthy({ money, maxMoney, security, minSecurity }) {
  return money >= maxMoney * 0.5 && security <= minSecurity + 5
}

export function isPrepared({ money, maxMoney, security, minSecurity }) {
  return money >= maxMoney * 0.95 && security <= minSecurity + 0.5
}

/** RAM of jobs still running, given [{endsAt, ram}]. */
export function inFlightRam(batches, now) {
  return batches.filter(b => b.endsAt > now).reduce((sum, b) => sum + b.ram, 0)
}

/** Preparation threads that fit one host, keeping their proportion. */
export function fitPrep(grow, weaken, freeRam) {
  const scale = Math.min(1, freeRam / (Math.max(1, grow + weaken) * JOB_RAM))
  return { grow: Math.floor(grow * scale), weaken: Math.floor(weaken * scale) }
}

/** What a stack on a prepared target earns at full speed, and the RAM that holds. */
export function estimateStack({ target, maxMoney, hackPercent, chance, weakenMs, threads, hackFraction = 0.1, spacingMs = 2000 }) {
  const ram = batchRam(threads)
  const perSec = hackPercent * threads.hack * maxMoney * chance / (spacingMs / 1000)
  const ramNeeded = ram * weakenMs / spacingMs
  return { target, ram, perSec, ramNeeded, perTB: perSec / (ramNeeded / 1024) }
}

/**
 * Picks stacks and their RAM budgets. Best income per TB goes first, skipping
 * targets far below the best on income or yield. Running stacks are never
 * dropped, and take any room they lack before a new one starts. The first
 * stack may start short of its full need, so a small fleet still gets one.
 */
export function planStacks(estimates, running, capacity, { maxStacks = 4, minIncomeShare = 0.15, minYieldShare = 0.25, minBudgetBatches = 20 } = {}) {
  const byTarget = new Map(estimates.map(e => [e.target, e]))
  const plan = running.map(r => ({ ...r }))
  let room = capacity - plan.reduce((sum, r) => sum + r.ramBudget, 0)
  for (const r of plan) {
    const add = Math.min(Math.max(0, room), Math.max(0, (byTarget.get(r.target)?.ramNeeded ?? 0) - r.ramBudget))
    r.ramBudget += add
    room -= add
  }
  const bestIncome = Math.max(0, ...estimates.map(e => e.perSec)), bestYield = Math.max(0, ...estimates.map(e => e.perTB))
  const taken = new Set(plan.map(r => r.target))
  const pool = estimates.filter(e => !taken.has(e.target) && e.perSec >= bestIncome * minIncomeShare && e.perTB >= bestYield * minYieldShare)
    .sort((a, b) => b.perTB - a.perTB)
  for (const e of pool) {
    if (plan.length >= maxStacks) break
    const budget = e.ramNeeded <= room ? e.ramNeeded : plan.length ? 0 : room
    if (budget < e.ram * minBudgetBatches) continue
    plan.push({ target: e.target, ramBudget: budget, added: true })
    room -= budget
  }
  return plan
}
