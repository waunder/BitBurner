/**
 * `ls` with real glob filters (`*`, `?`) and an optional `-l` long-format
 * listing (category, size, last-modified).
 *
 * The built-in `ls -g/--grep` only does plain substring matching (confirmed
 * against the game's own source, `Terminal/commands/ls.tsx`:
 * `parsedPath.includes(filter)`), so `ls *.msg` matches nothing there — `*`
 * isn't special to it at all — and it has no long-format at all. There's no
 * way to actually replace the built-in `ls`: Netscript has no hook to
 * override or add real terminal commands, only scripts you `run`. The
 * closest thing to a drop-in replacement is `alias ls="run lsf.js"` in the
 * terminal (typed by you, not scriptable) — after that, `ls -l *.js`
 * becomes `run lsf.js -l *.js` automatically.
 *
 * Usage: run lsf.js [pattern] [-l] [-d] [host]
 *   run lsf.js                  — everything on the current server
 *   run lsf.js -l               — everything, long format
 *   run lsf.js -d               — everything, newest-modified first
 *   run lsf.js *.msg            — glob-filtered, current server
 *   run lsf.js *.cct -l n00dles — glob-filtered, long format, specific host
 *   (pattern, -l/--long, and -d/--date may appear in any order; host, if
 *   given, is always the last positional argument)
 *
 * **`-d`, not `-t` — corrected 2026-09-04.** The sort-by-date flag was
 * originally `-t`/`--time`. Ken hit this live: `run lsf.js -t *.js` failed
 * with "Invalid number of threads specified" — Bitburner's own `run`
 * command reserves `-t` for thread count (`run script.js -t <threads>`)
 * and intercepts it before the script ever sees `ns.args`, not a bug in
 * this file. Renamed to `-d`/`--date`, which isn't a reserved `run` flag.
 * Worth remembering for any future flag choice here too — `run`'s other
 * known reserved flag is `--tail`.
 *
 * `-d` sorts newest-modified-first instead of the default alphabetical
 * order, using the same `ns.getFileMetadata(file).mtime` as `-l`'s
 * `modified` column — so it has the exact same two limits: **local host
 * only** (`ns.getFileMetadata` has no remote-host parameter) and only
 * `.txt`/`.json`/`.css`/`.js`/`.jsx`/`.ts`/`.tsx` have a real mtime at all.
 * Asking for `-d` on a remote host prints a one-line note and falls back to
 * alphabetical rather than silently guessing; a file whose extension has no
 * mtime sorts to the end (oldest-last position), alphabetically among
 * itself, rather than being dropped from the listing.
 *
 * **No hyperlinks — corrected 2026-09-04.** An earlier version of this file
 * claimed a clickable-connect-link feature via `ns.ui.createConnectLink`.
 * That function does not exist anywhere in this game's Netscript API —
 * confirmed by grepping the full local `NetscriptDefinitions.d.ts`, which
 * has no `createConnectLink`/`createScriptLink`/any link-creation function
 * on `ns.ui` at all. The feature-detection check silently failed every
 * time, so it always fell back to plain text — the code looked complete but
 * never actually worked, which is exactly what let it ship unnoticed. This
 * matches a finding this repo already made independently on 2026-08-14
 * (`docs/claude-todo.md`): the built-in `ls`'s clickable filenames are
 * privileged `Terminal.printRaw` + React + internal router code with no
 * public `ns` equivalent — not reachable from a Netscript script, full
 * stop. `ns.tprintRaw` does accept an arbitrary `ReactNode` (`React`/
 * `ReactDOM` are exposed as script globals), so a hand-built clickable
 * element is theoretically constructible, but there's no confirmed way for
 * its `onClick` to actually open a script or connect a session after this
 * script has already exited — not attempted here rather than shipped
 * untested a second time.
 *
 * `-l` adds a `[category] size modified` prefix per entry:
 *   [script]    RAM per thread via `ns.getScriptRam` (works cross-host)
 *               (.js/.script/.ns)
 *   [contract]  size/modified always "n/a" — a contract's real detail costs
 *               real RAM per-contract to read; see `cct_inventory.js`.
 *               (.cct)
 *   [program]   size/modified always "n/a"                          (.exe)
 *   [text]      character count via `ns.read().length`               (.txt/
 *               .json/.msg/.lit/anything else)
 * `modified` (all categories) uses `ns.getFileMetadata(file).mtime` — 0GB,
 * confirmed real in `NetscriptDefinitions.d.ts`, but **only for
 * .txt/.json/.css/.js/.jsx/.ts/.tsx**, per the function's own doc comment;
 * every other extension shows "-".
 *
 * Both `ns.read` and `ns.getFileMetadata` take **no host parameter** —
 * confirmed in the type definitions and matching this repo's own
 * 2026-08-12 finding (`docs/claude-todo.md`) that `ns.write`/`ns.read` only
 * ever operate on the calling script's *current* host. So size/modified for
 * `[text]` entries only resolve when listing the host this script is
 * actually running on; a remote host's text files show "n/a (remote)"
 * instead of silently reading the wrong file.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const rawArgs = ns.args.map(String)
  const longFormat = rawArgs.some((a) => a === "-l" || a === "--long")
  const byDate = rawArgs.some((a) => a === "-d" || a === "--date")
  const positional = rawArgs.filter((a) => !["-l", "--long", "-d", "--date"].includes(a))
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

  if (byDate && !isLocal) {
    ns.tprint(`lsf: -d needs the local host (ns.getFileMetadata has no remote-host parameter) — showing alphabetical order instead`)
  }
  if (byDate && isLocal) {
    // Newest first; unavailable mtime (wrong extension, or getFileMetadata
    // throwing) sorts to the end rather than dropping the file, using name
    // as a stable tiebreak both there and among equal timestamps.
    const mtimeOf = (file) => {
      if (!METADATA_EXTENSIONS.test(file)) return -Infinity
      try {
        const ts = ns.getFileMetadata(file).mtime
        return Number.isFinite(ts) ? ts : -Infinity
      } catch {
        return -Infinity
      }
    }
    files.sort((a, b) => mtimeOf(b) - mtimeOf(a) || a.localeCompare(b))
  } else {
    files.sort()
  }

  ns.tprint(`lsf: ${host} (${files.length} match${files.length === 1 ? "" : "es"} for "${pattern}")`)

  for (const file of files) {
    ns.tprint(longFormat ? `${formatEntry(ns, file, host, isLocal)}${file}` : `  ${file}`)
  }
}

// Only .txt/.json/.css/.js/.jsx/.ts/.tsx are valid for ns.getFileMetadata,
// per its own doc comment -- everything else throws.
const METADATA_EXTENSIONS = /\.(txt|json|css|js|jsx|ts|tsx)$/

// One "[category]  size  modified" prefix per -l entry. Every game call is
// guarded -- an unreadable/unexpected file degrades to "n/a"/"-", it never
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

  let modified = "-"
  if (isLocal && METADATA_EXTENSIONS.test(file)) {
    try {
      modified = formatTimestamp(ns.getFileMetadata(file).mtime)
    } catch {
      modified = "-"
    }
  }

  return `${category.padEnd(11)}${size.padEnd(13)}${modified.padEnd(21)}`
}

function formatTimestamp(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "-"
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19)
}

export function autocomplete() {
  return ["-l", "--long", "-d", "--date", "*"]
}
