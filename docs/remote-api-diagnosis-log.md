# Remote API connect-then-drop diagnosis log

Working log for resuming the port-12526 connect-then-drop investigation
(`docs/claude-todo.md` Priority 1, item 1). **Append every concrete finding
here the moment it's learned, then commit.** The previous attempt at this
diagnosis lost everything because nothing was written to disk before the
session ended — do not repeat that. This file is terse and dated, not a
polished report; see `docs/remote-api-migration.md` for the protocol
write-up and status vocabulary (source / official doc / confirmed live /
derived) this log reuses.

---

## 2026-08-10

**Starting state.** `tools/bb_remote.py` has exactly one commit
(`e8a6794`). Nothing from the lost diagnosis session survived anywhere —
confirmed via `git log -- tools/bb_remote.py` (one commit) and
`git branch -a` / `git log --oneline -20` (no orphaned diagnosis commits on
any branch, including the two worktree branches that were merged into main
2026-08-10 per `claude-todo.md`'s loose ends).

**Current live state, checked via CDP read-only navigation (Options ->
Remote API), confirmed live:** Status is **Offline** right now — the VS
Code extension's own WebSocket server is still listening on port 12525
(`lsof` shows `Code Helper` PID 11327 LISTEN on 127.0.0.1:12525) but the
game is not currently connected to it (Hostname `localhost`, Port `12525`,
Reconnection delay `0`, "Use wss" unchecked — same config
`remote-api-migration.md` recorded before). Port 12526 has nothing
listening right now (`lsof -iTCP:12526` empty). This means testing on
12526 today is even lower-risk than originally planned: the extension
isn't even holding a live game connection at the moment, so there's
nothing to disturb by moving the game's Connect target temporarily.

**Read `tools/bb_remote.py` in full — found the logging gap the task asked
about.** Confirmed: it is exactly as quiet as the task brief suspected.

- `RemoteApiServer._on_connection` (lines ~132-147): on connect, sets
  `self._client`/`self._connected_event` with **zero logging** — no print,
  no log line, nothing marks the moment a game connection is accepted.
  On disconnect (the `finally` block), same: clears state and rejects
  pending futures, again **zero logging** — no close code, no reason, no
  timestamp, nothing distinguishes a clean close from an error from a
  ping-timeout. This is the actual root cause of "root cause completely
  unknown" — the script was structurally incapable of recording the
  disconnect event even while it was happening live in front of Ken.
- `cmd_serve` (lines ~335-384): after `wait_for_connection` succeeds it
  prints "Game connected." once, then goes straight into
  `sys.stdin.readline()` in a loop. **If the game disconnects while sitting
  at that prompt, nothing is printed at all** — the loop just keeps
  blocking on stdin with no indication anything changed. Combined with the
  point below, this is a strong candidate for what actually happened last
  session.

**Hypothesis A (leading candidate): stdin EOF killed the server, not the
game.** `cmd_serve`'s command loop does
`line = await loop.run_in_executor(None, sys.stdin.readline)` and then
`if not line: break` — i.e. an EOF on stdin (empty read) silently exits the
loop, falls through to `await rpc.stop()`, which force-closes the live
WebSocket connection to the game. If `serve` was ever invoked in a context
where stdin is not an interactive TTY (e.g. run via a tool harness's
non-interactive subprocess, redirected from `/dev/null`, or a backgrounded
job with no controlling terminal), `readline()` returns `''` immediately —
not after a keypress, immediately — and the script would tear down the
connection within the same tick it was accepted. This would look *exactly*
like "connects, then drops back to offline within seconds, before any real
file operation happened," entirely on the tool side, with the game itself
doing nothing wrong. **Not yet confirmed** — no way to check what stdin
looked like in the lost session — but it is the single most mechanically
precise match to the reported symptom found so far, and it's a real bug
regardless (any non-interactive invocation of `serve` is landmined).

**Hypothesis B: background process death from session churn.** The task
brief for this diagnosis states the previous attempt spanned "several
resumed conversation turns" and lost everything. If a previous instance
started `serve` as a background process and the underlying harness process
was itself torn down/restarted between resumes (matching the "resumed
several times" framing), any child process it owned — including a
backgrounded `bb_remote.py serve` — would die with it, closing the
listening socket and dropping the game's connection. This would also
present as "connects, then drops within seconds" if the resume/interrupt
happened shortly after Ken clicked Connect. Not distinguishable from
Hypothesis A from evidence available now; both point at the tool-side
process/lifecycle rather than the game or the protocol.

**Hypothesis C: WebSocket ping/pong keepalive mismatch.** Read the
installed VS Code extension's own connection-management class
(`~/.vscode/extensions/ficocelliguy.bitburner-file-sync-plugin-0.1.5/dist/extension.js`,
**source**) in full around its `startPingLoop`/`markStale`/`pongTimeoutTimer`
logic: the extension pings its connected client every 15s
(`pingIntervalMs` default `15000`) and marks the connection "stale" if no
pong arrives within 5s of that (`pongTimeoutMs` default `5000`) — this is
the extension's own added liveness tracking on top of the base protocol,
not something the official doc mandates. `tools/bb_remote.py` doesn't
replicate this and doesn't need to for base protocol correctness — the
`websockets` library (v15.0.1, confirmed installed in `.venv`) answers
WebSocket-protocol-level ping frames automatically and transparently; a
browser/Electron `WebSocket` client does the same on its side without
exposing it to JS. **Ruled down, not up**: even if relevant, the shortest
timers here are 15s+5s=20s, which doesn't match "within seconds." Keeping
this noted rather than discarded in case the timing observation
("seconds") turns out to have been an underestimate.

**Hypothesis D: handler-signature version mismatch — checked, ruled out.**
Older `websockets` releases (<10) called connection handlers as
`handler(websocket, path)`; `tools/bb_remote.py`'s handler
(`_on_connection(self, ws)`) only takes one argument, which would raise
`TypeError` immediately on every connection if paired with an old library
version — a very plausible connect-then-instant-drop mechanism. Checked
directly: `.venv`'s installed `websockets` is **15.0.1** (confirmed via
`python3 -c "import websockets; print(websockets.__version__)"` inside the
repo's `.venv`), which is the current single-argument-handler API. Ruled
out as the cause on this machine — but worth remembering the shape of this
bug class since it would have looked identical to the reported symptom.

**Hypothesis E: game-side handshake requirement — not yet checked.** Not
yet confirmed either way whether the game's own Remote API client (as
opposed to the extension, which is a separate piece of code) sends any
unsolicited first message or expects a specific first response before it
considers the connection "real" and flips Status to Online-and-staying.
`tools/bb_remote.py`'s `_handle_message` silently discards any message
without an integer `id` (line ~156-158: `if not isinstance(msg_id, int):
return`), so if the game *does* send something on connect that isn't a
JSON-RPC response shape, it would be silently swallowed with no log line
— another instance of the same logging gap. No independent source (game
bundle) was read yet to check this; the official doc and the extension
source don't show the extension itself sending anything unsolicited to the
game on connect, only the reverse (extension/tool always initiates
requests). Lower confidence than A/B but not eliminated.

**Plan before the next live test:** fix the logging gap (timestamped
connect/disconnect/error events, close code + reason, written to both
stdout and a file so a killed process doesn't take the evidence with it),
fix `cmd_serve`'s stdin-EOF-tears-down-connection bug so a non-interactive
invocation can't self-sabotage, and add a bounded retry/watch loop that
doesn't require any interactive input at all — this is what a Claude-run
Bash-tool invocation actually needs, since it has no real TTY. Recording
this plan now, before implementing it, per the task's explicit instruction
not to wait until "done" to write things down.

**Implemented the logging.** `RemoteApiServer._on_connection` now logs, for
every connection: `CONNECTED from <addr>; headers=...` on open,
`DISCONNECTED after N.NNs (close_code=..., close_reason=...)` on close
(plus the exception type/message if the receive loop ended on one),
`REFUSED` for a second simultaneous connection attempt, and every
send/recv/timeout/dropped-message at the RPC layer. All of it goes to
stdout and appends to `tools/bb_remote_events.log` (gitignored, path
overridable with `--log-file`), specifically so a process that dies
mid-session doesn't take the evidence with it. Verified working by running
`selftest` — real `CONNECTED`/`SEND`/`RECV`/`OK`/`DISCONNECTED` lines came
out for every step, all seven checks still pass.

**Fixed the stdin-EOF bug in `cmd_serve`**, and — critically — **confirmed
it live against the actual pre-fix code, not just reasoned about it.**
Extracted the original committed version (`git show
e8a6794:tools/bb_remote.py`) to `/tmp/bb_remote_original.py` and ran it as
`serve --port 21217 < /dev/null` (stdin from `/dev/null`, exactly what a
non-interactive/tool-driven launch looks like — no controlling TTY) with a
real `websockets` client connecting to it. Result, timestamped from the
client's own clock:

```
t+0.02s: client connected
t+1.02s: ping FAILED (ConnectionClosedOK: received 1000 (OK); then sent 1000 (OK)) -- connection is dead
server process GONE (confirmed via kill -0 on the server PID, within 1-2s of connect)
```

The server's own stdout showed only `Listening...` then `Game connected.`
— nothing else, no error, because the old code has no logging on the path
that killed it. This is **hypothesis A, now confirmed live** (not merely
plausible): `sys.stdin.readline()` on a non-TTY stdin returns `''`
immediately, `cmd_serve` treats that identically to typing `quit`, breaks
the loop, and calls `rpc.stop()`, which force-closes the just-accepted
game connection within about a second of it being accepted — a clean
`1000` (normal) close on the wire, not a crash, not a timeout, not
anything the game did wrong. **This is very likely what happened in the
lost session**: however `bb_remote.py serve` was invoked back then, if it
ran the way any Bash-tool-driven invocation runs (no controlling terminal
attached to stdin), this bug alone fully explains "connects, then drops
back to offline within seconds, before any real file operation happened."
Hypothesis B (background process death from session churn) is no longer
needed to explain the symptom, though it may still be worth hardening
against separately since it's a real risk for long-lived background runs.

**Fix verified working**: re-ran the same client-connects-then-idles
pattern against the *patched* `tools/bb_remote.py serve --duration 8
< /dev/null`, and this time the connection survived the full 6-second
client-side sleep, with the log showing the non-TTY branch was taken
(`stdin is not a TTY ... NOT reading commands from it`), a heartbeat while
connected, then a clean disconnect only when the *client* voluntarily
closed — the server no longer tears down the connection on its own. Full
transcript:

```
[...] LISTENING on 127.0.0.1:21214
[...] CONNECTED from ('127.0.0.1', 55700); headers={...}
[...] stdin is not a TTY (non-interactive invocation) — NOT reading commands from it, ...
[...] heartbeat #1: connected=True
[...] DISCONNECTED after 6.00s (close_code=1000, close_reason='')
[...] heartbeat #2: connected=False
[...] hold duration (8.0s) elapsed, stopping.
```

**New `watch` subcommand added** (`python3 tools/bb_remote.py watch --port
12526 --duration 180`): binds, then just logs every connect/disconnect it
sees for up to `--duration` seconds (default 180), no stdin interaction at
all, safe to run repeatedly as reconnects happen. This is what should be
used for the live test with Ken, instead of `serve`, since it has no
stdin-related failure mode at all by construction.

**What's still open, going into the live test:** hypotheses C
(ping/pong — read the extension's own heartbeat code, timers are 15s+5s,
too slow to explain "within seconds," kept as a fallback not the leading
theory), D (websockets handler-signature mismatch — checked, installed
version is 15.0.1, ruled out on this machine), and E (an unsolicited
game-side handshake message the old code silently discarded — now would
be logged as `DROPPED: message has no integer id` if it happens, so the
next live test will surface it if it's real) are unresolved but now
instrumented: if any of them is *also* in play, the next live test against
port 12526 will show it in the log instead of nothing.

**Not yet done / next steps for whoever resumes this:** run `watch`
against port 12526 during an actual Ken-supervised Connect click and read
`tools/bb_remote_events.log` afterward; if the connection now holds, do
the real `push`/`get`/`delete` round trip that's the actual bar in
`docs/claude-todo.md`; if it still drops, the log will show close_code/
close_reason/exception which narrows hypotheses C/E immediately instead of
starting over.

**Same day, first live attempt: self-inflicted failure, caught and fixed
before it could confuse anything.** Started `watch` as `tools/bb_remote.py
watch --port 12526 --duration 180` — this ordering (options after the
subcommand) is a mistake: `--port`/`--server`/`--log-file` were only
defined on the top-level parser, so argparse rejected `--port 12526` as
"unrecognized arguments" and the process exited immediately, before ever
binding to a port or writing a single log line. Ken clicked Connect on
12526 during this window and, correctly, saw it fail — nothing was
listening. `tools/bb_remote_events.log` didn't even exist afterward,
confirming the process never got far enough to log anything.

Fixed by adding `_normalize_argv()` in `tools/bb_remote.py`, which
reorders recognized global flags to the front before argparse ever parses
them, so `--port`/`--server`/`--log-file` now work in any position. First
attempt at this fix used argparse's `parents=` mechanism to duplicate the
options onto every subparser — **tested this and it was actively wrong**:
confirmed by reading cpython's `argparse.py` (`_SubParsersAction.__call__`)
directly, a subparser always parses its remaining tokens into a *fresh*
namespace using its own defaults, then unconditionally overwrites every
matching key on the parent namespace — so `--port 21218 watch` would
silently reparse `port` back to the default (12525) the moment `watch`'s
own (unset) `--port` got merged in. That's worse than the original bug: a
loud "unrecognized arguments" error became a silent wrong value. Confirmed
via direct testing (`build_parser().parse_args(...)` printing the parsed
namespace) before shipping either version. The `_normalize_argv` approach
avoids the whole class of problem by keeping the options declared in
exactly one place and reordering argv text before argparse sees it —
verified both `--port 21221 --log-file ... watch --duration 1` and `watch
--port 21219 --log-file ... --duration 1` now parse identically, and
`selftest` still passes all seven checks after the change.

A second, correctly-invoked `watch --port 12526 --duration 180` (this
time with `--port` in front, which was always going to work, plus the
argv-normalization fix applied so either order works from now on) is
running now, started 2026-08-10 11:38:10, listening confirmed via `lsof`.
Waiting on Ken to click Connect again.

**That second window (11:38:10–11:41:10) ran the full 180s and captured
zero connection attempts** — 36 heartbeats, `connected=False` throughout,
no `CONNECTED`/`REFUSED`/error line at all. Checked the game's own Options
→ Remote API panel afterward via CDP (read-only navigation, no state
changed): `Status: Offline`, but the Port field already reads `12526` —
so Ken did change the port at some point, just not necessarily inside this
specific 180s window. Most likely explanation: the relay through the
coordinator ("ask him to click again") took longer than the 3-minute
window to reach him, so he simply hadn't clicked yet by the time it
elapsed — not a new failure mode. Can't confirm this from logs alone
though; noting it as the leading explanation, not a fact.

Also worth flagging as a real gap, not yet fixed: `RemoteApiServer`'s
`_on_connection` only fires *after* the `websockets` library completes the
WebSocket handshake at the protocol level. If the game's Connect attempt
were rejected before that (bad headers, TLS/`wss` mismatch, anything at
the raw-HTTP-upgrade stage), our handler would never run and nothing would
log — same class of silent gap as the original bug, just one layer lower.
Not instrumented yet because nothing so far has pointed at it being the
actual cause, but worth adding lower-level handshake-rejection logging via
`websockets.serve(..., process_request=...)` or similar if the next
window also comes up empty despite Ken confirming he actually clicked
during it.

Started a third `watch --port 12526 --duration 180` at 2026-08-10 11:42:23
(log cleared first so each window's file is self-contained), listening
confirmed via `lsof`. This is the window to check next.
