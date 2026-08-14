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
  for (const file of files) ns.tprint(`  ${file}`)
}
