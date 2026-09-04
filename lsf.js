/**
 * `ls` with real glob filters (`*`, `?`), an optional `-l` long-format
 * listing, and clickable connect-links.
 *
 * The built-in `ls -g/--grep` only does plain substring matching (confirmed
 * against the game's own source, `Terminal/commands/ls.tsx`:
 * `parsedPath.includes(filter)`), so `ls *.msg` matches nothing there — `*`
 * isn't special to it at all — and it has no long-format at all. There's no
 * way to actually replace the built-in `ls`: Netscript has no hook to
 * override or add real terminal commands, only scripts you `run`. The
 * closest thing to a drop-in replacement is `alias ls="run lsf.js"` in the
 * terminal (typed by you, not scriptable) — after that, `ls -l *.js` becomes
 * `run lsf.js -l *.js` automatically.
 *
 * Usage: run lsf.js [pattern] [-l] [host]
 *   run lsf.js                  — everything on the current server
 *   run lsf.js -l               — everything, long format
 *   run lsf.js *.msg            — glob-filtered, current server
 *   run lsf.js *.cct -l n00dles — glob-filtered, long format, specific host
 *   (pattern and -l/--long may appear in either order; host, if given, is
 *   always the last positional argument)
 *
 * `-l` prefixes each entry with a `[category] size` column:
 *   [script]    RAM per thread, via ns.getScriptRam (.js/.script/.ns)
 *   [contract]  always "n/a" — a contract's type/tries-remaining cost real
 *               RAM to read per contract; use cct_inventory.js for that.
 *   [program]   always "n/a"                                        (.exe)
 *   [text]      character count via ns.read().length — but ONLY when
 *               listing the server this script is actually running on.
 *               ns.read has no remote-host parameter (confirmed in this
 *               repo's own history, docs/claude-todo.md's 2026-08-12 entry:
 *               ns.write/ns.read only ever operate on the calling script's
 *               *current* host), so a remote host's text files show
 *               "n/a (remote)" rather than silently reading the wrong file
 *               or crashing.
 * Not yet live-verified (per CLAUDE.md — nothing here has run in Bitburner
 * yet): ns.getScriptRam's exact behavior for a non-running script file, and
 * whether ns.read() throws vs. returns "" for a script/lit/msg file's own
 * extension boundary cases. Both paths are try/catch-guarded to "n/a"
 * rather than abort the whole listing either way.
 *
 * When AutoLink.exe is available, each line is a clickable terminal link
 * that connects to the server holding it. Plain text remains the fallback.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const rawArgs = ns.args.map(String)
  const longFormat = rawArgs.some((a) => a === "-l" || a === "--long")
  const positional = rawArgs.filter((a) => a !== "-l" && a !== "--long")
  const pattern = positional[0] ?? "*"
  const host = positional[1] ?? ns.getHostname()
  const isLocal = host === ns.getHostname()

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
    const label = longFormat ? `${formatEntry(ns, file, host, isLocal)}${file}` : `  ${file}`
    if (canLink) ns.tprintRaw(ns.ui.createConnectLink(connectPath, label))
    else ns.tprint(label)
  }
}

// One "[category]  size" prefix per file for -l. Every game call is
// guarded -- an unreadable/unexpected file degrades to "n/a", it never
// aborts the rest of the listing.
function formatEntry(ns, file, host, isLocal) {
  let category = "[text]"
  let size = "n/a"

  if (/\.(js|script|ns)$/.test(file)) {
    category = "[script]"
    try {
      const ram = ns.getScriptRam(file, host)
      size = ram > 0 ? `${ram.toFixed(2)}GB` : "n/a"
    } catch {
      size = "n/a"
    }
  } else if (file.endsWith(".cct")) {
    category = "[contract]"
  } else if (file.endsWith(".exe")) {
    category = "[program]"
  } else if (!isLocal) {
    // ns.read has no remote-host parameter -- can't read a file that isn't
    // on the host this script is actually executing on.
    size = "n/a (remote)"
  } else {
    try {
      size = `${ns.read(file).length}c`
    } catch {
      size = "n/a"
    }
  }

  return `${category.padEnd(11)}${size.padEnd(13)}`
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
    const hostAt = path[path.length - 1]
    for (const neighbor of ns.scan(hostAt)) {
      if (seen.has(neighbor)) continue
      const next = [...path, neighbor]
      if (neighbor === target) return next
      seen.add(neighbor)
      queue.push(next)
    }
  }
  return null
}

export function autocomplete() {
  return ["-l", "--long", "*"]
}
