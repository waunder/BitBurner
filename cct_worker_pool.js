/**
 * Select and briefly reclaim a safe remote host for finite contract work.
 * Purchased cloud servers are preferred, but an augmentation reset removes
 * them. Rooted ordinary hosts are a safe fallback when they contain only MCP
 * action loops; MCP replaces those loops on its next allocation tick.
 */
const ACTION_SCRIPTS = new Set(["scripts/hack.js", "scripts/grow.js", "scripts/weaken.js"])

function allServers(ns) {
  const seen = new Set(["home"])
  const queue = ["home"]
  for (let i = 0; i < queue.length; i++) {
    for (const next of ns.scan(queue[i])) {
      if (seen.has(next)) continue
      seen.add(next)
      queue.push(next)
    }
  }
  return queue
}

function isActionProcess(proc) {
  return ACTION_SCRIPTS.has(String(proc.filename).replace(/^\//, ""))
}

/** Return a preferred, rooted non-home host that can safely be preempted. */
export function selectContractWorker(ns, requiredRam) {
  const cloud = new Set(ns.cloud.getServerNames())
  const hosts = [...cloud, ...allServers(ns).filter((host) => !cloud.has(host))]
  const candidates = hosts
    .filter((host) => host !== "home" && ns.hasRootAccess(host) && ns.getServerMaxRam(host) >= requiredRam)
    .map((host) => {
      const processes = ns.ps(host)
      const blockers = processes.filter((proc) => !isActionProcess(proc))
      return {
        host,
        cloud: cloud.has(host),
        maxRam: ns.getServerMaxRam(host),
        freeRam: ns.getServerMaxRam(host) - ns.getServerUsedRam(host),
        blockers,
      }
    })
    .filter((candidate) => candidate.blockers.length === 0)
    .sort((a, b) => Number(b.cloud) - Number(a.cloud) || b.freeRam - a.freeRam || b.maxRam - a.maxRam || a.host.localeCompare(b.host))
  return candidates[0] || null
}

/** Kill MCP action loops only; never kill an unrelated controller or worker. */
export async function prepareContractWorker(ns, candidate, requiredRam) {
  if (!candidate) return { ok: false, reason: "no safe rooted worker" }
  const blockers = ns.ps(candidate.host).filter((proc) => !isActionProcess(proc))
  if (blockers.length) return { ok: false, reason: `worker has non-MCP process: ${blockers[0].filename}` }
  for (const proc of ns.ps(candidate.host)) if (isActionProcess(proc)) ns.kill(proc.pid)
  const deadline = Date.now() + 2000
  while (Date.now() < deadline && ns.getServerMaxRam(candidate.host) - ns.getServerUsedRam(candidate.host) < requiredRam) await ns.sleep(50)
  const freeRam = ns.getServerMaxRam(candidate.host) - ns.getServerUsedRam(candidate.host)
  return freeRam >= requiredRam
    ? { ok: true, worker: candidate.host, source: candidate.cloud ? "cloud" : "rooted-fallback", freeRam }
    : { ok: false, reason: `worker RAM did not clear (${freeRam.toFixed(1)}/${requiredRam.toFixed(1)}GB)` }
}
