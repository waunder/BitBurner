/**
 * Small per-panel position memory for Netscript tail windows.
 * Window position is saved under a panel-specific JSON filename so panels do
 * not overwrite one another's layout.
 */
function positionFile(scriptName) {
  const name = String(scriptName).replace(/^\//, "").replace(/\.js$/, "")
  return `tail_position_${name}.json`
}

function usablePosition(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y)
}

export function loadTailPosition(ns, scriptName, fallback = {}) {
  let saved = null
  try {
    saved = JSON.parse(ns.read(positionFile(scriptName)))
  } catch { /* first launch or invalid saved data */ }
  return {
    x: fallback.x ?? (usablePosition(saved) ? saved.x : undefined),
    y: fallback.y ?? (usablePosition(saved) ? saved.y : undefined),
  }
}

export async function saveTailPosition(ns, scriptName) {
  const tail = ns.self()?.tailProperties
  if (!usablePosition(tail)) return false
  await ns.write(positionFile(scriptName), JSON.stringify({ x: tail.x, y: tail.y }), "w")
  return true
}

/** Save the old live panel's latest position before its process is closed. */
export async function capturePriorTailPosition(ns, scriptName) {
  const normalized = String(scriptName).replace(/^\//, "")
  for (const process of ns.ps(ns.getHostname())) {
    if (process.pid === ns.pid || process.filename.replace(/^\//, "") !== normalized) continue
    const tail = ns.getRunningScript(process.pid)?.tailProperties
    if (!usablePosition(tail)) continue
    const position = { x: tail.x, y: tail.y }
    await ns.write(positionFile(normalized), JSON.stringify(position), "w")
    return position
  }
  return loadTailPosition(ns, normalized)
}
