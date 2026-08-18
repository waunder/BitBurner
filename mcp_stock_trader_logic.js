export const DEFAULT_CAP_FRACTION = 0.10
export const CAP_STEP = 0.01
export const MIN_CAP_FRACTION = 0.01
export const MAX_CAP_FRACTION = 0.10
export const COMMISSION = 100000

export function clampCap(capFraction) {
  const value = Number(capFraction)
  if (!Number.isFinite(value)) return DEFAULT_CAP_FRACTION
  return Number(Math.min(MAX_CAP_FRACTION, Math.max(MIN_CAP_FRACTION, value)).toFixed(4))
}

export function nextCapAfterClose(capFraction, netProfit) {
  const current = clampCap(capFraction)
  if (netProfit > 0) return clampCap(current + CAP_STEP)
  if (netProfit < 0) return clampCap(current - CAP_STEP)
  return current
}

export function entryCost({ shares, averagePrice, recordedCost }) {
  if (Number.isFinite(recordedCost) && recordedCost > 0) return recordedCost
  return Math.max(0, Number(shares) || 0) * Math.max(0, Number(averagePrice) || 0) + COMMISSION
}

export function remainingAllocation({ cash, liquidationValue, capFraction }) {
  const equity = Math.max(0, Number(cash) || 0) + Math.max(0, Number(liquidationValue) || 0)
  const allowed = equity * clampCap(capFraction)
  return { equity, allowed, remaining: Math.max(0, allowed - Math.max(0, Number(liquidationValue) || 0)) }
}
