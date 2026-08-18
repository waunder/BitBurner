# Moving off the VS Code extension's file sync

> **Historical plan status, 2026-08-15 (updated 2026-08-18):** the Remote API
> daemon now provides routine watched-source push and generated-artifact
> pull, with reconnect resync and local self-tests passing. Prototype-era
> "not live" language below is chronology; current status lives in
> `STATE.md`, and the watched/pulled file sets are
> `tools/bb_remote.py::WATCHED_FILES`/`PULL_FILES` directly.

Research + prototype for the decision made 2026-08-09 (see
`docs/kensTodo.md` and the session memory it was logged from): stop
depending on the Bitburner VS Code extension's file-sync for pushing files
into the running game, and build a connection Claude drives itself —
confirmable request/response instead of fire-and-forget, and reconnects
Claude can detect and retry instead of a channel that silently drops for an
unknown number of minutes. Two dead-push incidents the same day
(`mcp_dump_request.txt`, then `mcp_restart.txt` — see `docs/kensTodo.md`)
are why this was prioritized. Style and status vocabulary follow
`stock-trading-mechanics.md`.

## Status vocabulary

| Tag | Means |
| --- | --- |
| **source** | Read directly out of the extension's own bundled code or the game's own bundle. |
| **official doc** | The upstream project's own published protocol spec. |
| **confirmed live** | Actually observed against the live, running game or the live extension this session — not just read from source. |
| **derived** | Reasoning built on a **source**/**official doc**/**confirmed live** fact; the premise is checkable, the inference could still be wrong. |

## The headline finding

**A direct connection works and is built.** `tools/bb_remote.py` implements
the real protocol correctly — verified against an in-process mock that
speaks exactly like the game does, all seven checks pass (see "What was
validated" below). It has **not** been round-tripped against the live
Bitburner process, because doing that safely requires one thing only Ken can
do: see "What's blocking full validation" below. That's the one item this
research surfaces for `docs/kensTodo.md`.

---

## How the Remote API actually works

The mental model in the task brief going in — "the game exposes a
WebSocket server, we connect to it as a client" — is backwards. It's the
opposite:

**The game is the WebSocket *client*. An external tool runs the WebSocket
*server*, and the game dials out to it.** You start the tool first; then
in-game, under Options → Remote API, you type that tool's hostname and
port and press **Connect**. This is exactly what the VS Code extension is:
a thin WebSocket server plus a JSON-RPC client wrapper around the resulting
socket. `tools/bb_remote.py` is a second implementation of that same
server role.

**Source for this:**
- **official doc** —
  [`bitburner-src/.../programming/remote_api.md`](https://github.com/bitburner-official/bitburner-src/blob/dev/src/Documentation/doc/en/programming/remote_api.md)
  (`dev` branch, fetched this session): *"Bitburner can connect to a
  WebSocket server, and then that server can read and write Bitburner data
  via some APIs... In Bitburner, Options -> Remote API. Set 'hostname' and
  'port', then press 'Connect'."*
- **source** — the installed extension's own code,
  `~/.vscode/extensions/ficocelliguy.bitburner-file-sync-plugin-0.1.5/dist/extension.js`:
  its connection object does `new WebSocketServer({port, host:
  "127.0.0.1"})` (a `ws`-package server constructor) and its `.on("connection", ...)`
  handler is what fires when the game dials in — there is no outbound
  `connect()` call to the game anywhere in the file.
- **confirmed live** — `lsof -nP -iTCP:12525` this session, while the
  extension's sync was actively in use for this repo:
  ```
  Code\x20H 8263  kth  LISTEN   127.0.0.1:12525
  bitburner 3155  kth  ESTABLISHED  127.0.0.1:51071 -> 127.0.0.1:12525
  ```
  The VS Code helper process (`Code Helper`, running the extension) is the
  listener; the Bitburner Electron process holds the outbound leg. This
  matches the source reading exactly and rules out the reverse.

### Where "is it enabled, what port" came from

Step 1 of the task asked whether this could be determined via CDP alone.
It could, cleanly — no config-file spelunking needed. From the CDP session
already open to the game (port 9222, per `CLAUDE.md`), a simulated click
(`element.click()` via `Runtime.evaluate`, no `Input` domain needed) on the
**Options** nav item, then on the **Remote API** sub-tab, rendered this into
`document.body.innerText`:

```
Remote API
These settings control the Remote API for Bitburner. This is typically
used to write scripts using an external text editor and then upload files
to the home server.
Status: Online
Hostname:  Port:  Reconnection delay:  Use wss
Connect
```

Reading the actual `<input>` elements' `.value` gave the exact configured
values: **hostname `localhost`, port `12525`, reconnection delay `0`, "use
wss" unchecked (plain `ws://`, not `wss://`)**. **Status: Online** confirms
the game is, right now, actively connected — matching the `lsof` output
above. No config file on disk was needed or consulted; this makes the
"what would a human need to check" fallback moot for this specific
question — nothing was needed from Ken to answer it.

---

## The protocol

**official doc** (same source as above) confirmed word-for-word against
**source** (the request-building code in the installed extension). All
requests/responses are JSON-RPC-2.0-shaped:

```json
// request
{"jsonrpc": "2.0", "id": 7, "method": "pushFile", "params": {...}}
// success
{"jsonrpc": "2.0", "id": 7, "result": ...}
// error
{"jsonrpc": "2.0", "id": 7, "error": "..." }
```

The extension's own RPC dispatcher (`class tt` in `extension.js`) confirms
this isn't just documentation — it's what's actually sent: a `nextId`
counter, a `Map` of pending requests keyed by that id, a per-request
timeout (10s in the extension), and `handleMessage` resolving/rejecting by
matching `id`. `tools/bb_remote.py`'s `RemoteApiServer` class is a direct
reimplementation of that same pattern (Python `asyncio.Future`s keyed by
id instead of a JS `Map` + callbacks).

### Methods

The official doc lists eleven; the installed extension only calls seven of
them (no need for `getFileMetadata`, `getAllFileMetadata`, `getSaveFile`,
`getAllServers` for a plain sync workflow). `tools/bb_remote.py` implements
all seven the extension uses, plus `getAllServers` and `getSaveFile` since
they're documented and cheap to add.

| Method | Params | Returns | Used by the extension? |
| --- | --- | --- | --- |
| `pushFile` | `filename, content, server` | `"OK"` | yes — this is what "Pushed: X" in the extension's log means |
| `getFile` | `filename, server` | file content (string) | yes |
| `deleteFile` | `filename, server` | `"OK"` | yes |
| `getFileNames` | `server` | `string[]` | yes |
| `getAllFiles` | `server` | `{filename, content}[]` | yes |
| `calculateRam` | `filename, server` | number | yes |
| `getDefinitionFile` | (none) | string (the `.d.ts`) | yes — this is "Download Type Definitions" |
| `getFileMetadata` | `filename, server` | `{filename, atime, btime, mtime}` | no |
| `getAllFileMetadata` | `server` | array of the above | no |
| `getSaveFile` | (none) | `{identifier, binary, save}` | no |
| `getAllServers` | (none) | `{hostname, hasAdminRights, purchasedByPlayer}[]` | no |

`server` defaults to `"home"` in both the extension and `tools/bb_remote.py`.

---

## What was validated this session

1. **Protocol correctness, via self-test** (`python3 tools/bb_remote.py
   selftest`) — starts the real `RemoteApiServer`, connects an in-process
   mock "game" client that answers exactly per the official spec above, and
   round-trips through the real client code (not a shortcut): push → get →
   list → delete → get-after-delete (expects an error) → three concurrent
   pushes/gets to check request-id correlation doesn't cross wires under
   concurrency. **All seven checks passed.** This is **confirmed live**
   against the *plumbing*, not against the actual Bitburner process — see
   below for why.

2. **Port-conflict / coexistence, against the real live extension**
   (task step 4): `python3 tools/bb_remote.py --port 12525 probe` while the
   VS Code extension's sync was live and connected → immediate
   `[Errno 48] address already in use`. **Confirmed: the two cannot run
   simultaneously on the same port.** This isn't a bug to fix — only one
   process can hold a TCP listener on a given port, and the game only
   maintains a single outbound Remote API connection at a time (one
   Hostname/Port/Connect control in Options, one `Status: Online/Offline`
   indicator — no evidence anywhere in the game bundle of multiple
   concurrent Remote API connections). Coexistence would require either a
   different port (see below) or the extension's server not running.

3. **The prototype server binds and runs standalone** on an unused port:
   `python3 tools/bb_remote.py --port 12526 probe` → `{"bindable": true}`,
   with zero effect on the extension's connection (`lsof` re-checked
   immediately after: the extension's `ESTABLISHED` connection on 12525 was
   untouched).

4. **The Options page read itself** (above) is a form of live validation —
   it's the game's own UI confirming Remote API is on, connected, and on
   the expected port, entirely via CDP with no filesystem or config-file
   involvement.

## What's blocking full validation

**Not validated: an actual round trip against the live Bitburner process**
(the game itself answering a `pushFile`/`getFile` sent by
`tools/bb_remote.py`, with a real file landing in-game). Here's precisely
why, and what closes the gap:

The game holds exactly one outbound Remote API connection, and it's
currently pointed at the extension's server on port 12525. Getting the real
game to talk to `tools/bb_remote.py` instead requires **one of**:

- **Ken (or Claude, with explicit sign-off) clicks Options → Remote API →
  changes the port field to an unused one (e.g. `12526`, matching what was
  probe-tested above) → Connect** — this drops the extension's current
  connection and reconnects to the new server. Reversible in the same way
  (change the port back to `12525`, click Connect again) — the extension's
  own server keeps listening the whole time, so reconnecting back is a
  single click, not a VS Code restart.
- **Or Ken closes VS Code / stops the extension's sync server** (command
  palette → "Bitburner: Stop Sync Server", or just closing the editor),
  freeing port 12525 itself for `tools/bb_remote.py` to bind directly with
  no port change needed in-game at all.

The task this doc reports on was explicit: *do not touch the existing
extension's sync setup*. Both options above require a live change to the
game's current connection, however briefly — that's exactly the boundary
this session stayed on the safe side of. It is a **one-time, ~30-second,
fully reversible action**, not a structural blocker: once it happens once
(with Ken watching, so a genuine problem is caught immediately), the
self-test above gives high confidence the live round trip will simply work,
since the same code already round-trips correctly against a spec-accurate
mock.

**Recommended next step:** a short supervised session where Ken either
(a) points the game at port 12526 momentarily so `tools/bb_remote.py push`
can write one real throwaway test file into `home` and `get`/`delete` it
back out, confirmed via a terminal `cat`-equivalent or tail-window dump over
CDP, then reconnects Options back to `12525` — or (b) closes VS Code for a
few minutes to free `12525` directly. Either closes the one remaining gap
between "protocol implemented and self-tested" and "proven against the real
game."

---

## Coexistence, concretely

| Scenario | Result |
| --- | --- |
| Both trying to bind port 12525 at once | Second one fails immediately (`EADDRINUSE`) — **confirmed live** |
| `tools/bb_remote.py` on a different port (e.g. 12526) while the extension holds 12525 | Both processes run fine simultaneously — **confirmed live** — but the *game* can only be dialed into one of them at a time, so this doesn't give simultaneous dual-write, just the ability to have the second server ready and waiting for the one-time reconnect above |
| Cutover without closing VS Code | Possible — point Options at a different port, leave the extension's own server running idle in the background (it just won't have a game connection anymore) |
| Cutover fully replacing the extension | Requires Ken to stop the extension's sync server or close VS Code, then `tools/bb_remote.py` can use port 12525 itself and nothing in-game needs to change (same hostname/port Ken already has saved) |

---

## The prototype: `tools/bb_remote.py`

Standalone script, `websockets`-based (installed into the repo's `.venv`
this session — not stdlib, unlike the CDP scripts elsewhere in this
project). Implements:

- `RemoteApiServer` — the WebSocket server + JSON-RPC 2.0 request/response
  layer (id correlation, per-request timeout, single-connection semantics
  matching the extension's own "refuse a second connection while one is
  live" behavior).
- `BitburnerApi` — one method per documented RPC call.
- A CLI: one-shot subcommands (`push`, `get`, `list`, `delete`, `ram`,
  `servers`, `probe`) that start the server, wait for the game to connect,
  perform one call, print JSON, exit; a `serve` subcommand for a
  long-lived interactive session; `selftest` for the mock-client
  validation described above.

This is **not** the production replacement for `mcp_restart.txt`/
`mcp_dump_request.txt` — that's deliberately out of scope for this task
(per the brief) and is future work once the live round trip above is
confirmed. This is the validated foundation it would be built on.

Usage:

```
python3 tools/bb_remote.py selftest
python3 tools/bb_remote.py --port 12525 probe
python3 tools/bb_remote.py push mcp_selftest_probe.txt /path/to/local/file.txt --server home
python3 tools/bb_remote.py get mcp_selftest_probe.txt
python3 tools/bb_remote.py serve
```

Requires `pip install websockets` in whatever Python environment runs it
(already done in this repo's `.venv` as part of this session).

---

## Open questions / not verified here

1. **The live round trip itself** — see "What's blocking full validation"
   above. This is the load-bearing unknown; everything else in this doc is
   either official documentation, direct source reading, or validated
   against a spec-accurate mock, but a spec-accurate mock is still not the
   real Electron process.
2. **`getFileMetadata` / `getAllFileMetadata` / `getSaveFile` /
   `getAllServers`** are implemented in `tools/bb_remote.py` per the
   official doc but the extension never exercises them, so they have no
   cross-check from a second independent source the way the other seven
   methods do.
3. **Reconnection behavior** — whether `tools/bb_remote.py` needs its own
   retry/backoff logic for a dropped game connection (the whole point of
   this migration) hasn't been exercised, since no live connection has been
   established yet to drop. `RemoteApiServer` currently clears its
   connected-state on disconnect and would need a caller to notice and
   re-`wait_for_connection`; the one-shot CLI commands don't currently loop
   on that. Worth hardening once the live round trip is in hand and an
   actual drop can be observed and reacted to.
4. **`wss://`** ("Use wss" checkbox in Options) was seen unchecked and
   untested — `tools/bb_remote.py` only implements plain `ws://`, matching
   the current live configuration.
