/** The stack_status_<target>.json files stack_batch.js writes, newest per target. */
export const FRESH_MS = 120000
export const LEGACY_BUDGET_GB = 40960

/** Set freshMs to Infinity to include stacks that have stopped. */
export function readStacks(ns, freshMs = FRESH_MS) {
  const now = Date.now(), stacks = new Map()
  for (const file of ns.ls("home", "stack_status")) {
    if (!file.endsWith(".json")) continue
    let stack = null
    try { stack = JSON.parse(ns.read(file)) } catch { continue /* partial write */ }
    if (!stack?.target || now - stack.ts >= freshMs) continue
    if (!(stacks.get(stack.target)?.ts > stack.ts)) stacks.set(stack.target, stack)
  }
  return [...stacks.values()]
}
