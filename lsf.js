/**
 * `ls` with real glob filters (`*`, `?`) — the built-in `ls -g/--grep` only
 * does plain substring matching (confirmed against the game's own source,
 * `Terminal/commands/ls.tsx`: `parsedPath.includes(filter)`), so `ls *.msg`
 * matches nothing there; it needs an anchored glob to mean "ends in .msg".
 *
 * Usage: run lsf.js <pattern> [host]
 *   run lsf.js *.msg          — current server
 *   run lsf.js *.cct n00dles  — a specific server
 *   run lsf.js *              — everything (same as plain `ls`)
 *
 * When AutoLink.exe is available, each filename is a clickable terminal link
 * that connects to the server holding it. Plain text remains the fallback.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const pattern = ns.args[0]
  if (typeof pattern !== "string" || pattern === "") {
    ns.tprint("lsf: usage: run lsf.js <pattern> [host]  (e.g. run lsf.js *.msg)")
    return
  }
  const host = typeof ns.args[1] === "string" ? ns.args[1] : ns.getHostname()

  // Escape every regex special character except the two glob wildcards,
  // then translate those: * -> "any run of characters", ? -> "any one
  // character". Anchored full-string match, so *.msg means "ends in .msg",
  // not "contains .msg anywhere" the way the built-in ls -g does.
  const regexSource =
    "^" +
    pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") +
    "$"
  const regex = new RegExp(regexSource)

  const files = ns.ls(host).filter((name) => regex.test(name))
  if (files.length === 0) {
    ns.tprint(`lsf: no files on ${host} matching "${pattern}"`)
    return
  }
  files.sort()
  ns.tprint(`lsf: ${host} (${files.length} match${files.length === 1 ? "" : "es"} for "${pattern}")`)
  const connectPath = findPath(ns, ns.getHostname(), host)
  const canLink =
    connectPath !== null &&
    ns.fileExists("AutoLink.exe", "home") &&
    ns.ui &&
    typeof ns.ui.createConnectLink === "function" &&
    typeof ns.tprintRaw === "function"

  for (const file of files) {
    if (canLink) ns.tprintRaw(ns.ui.createConnectLink(connectPath, `  ${file}`))
    else ns.tprint(`  ${file}`)
  }
}

// createConnectLink needs the full route from the terminal's current server,
// not merely the destination hostname. The network is small and lsf is a
// one-shot utility, so a BFS is the clearest reliable route builder.
function findPath(ns, start, target) {
  if (start === target) return []
  const queue = [[start]]
  const seen = new Set([start])
  while (queue.length) {
    const path = queue.shift()
    const host = path[path.length - 1]
    for (const neighbor of ns.scan(host)) {
      if (seen.has(neighbor)) continue
      const next = [...path, neighbor]
      if (neighbor === target) return next
      seen.add(neighbor)
      queue.push(next)
    }
  }
  return null
}
