/** Pure planning for stack_batch.js. No ns calls, no side effects. */
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
