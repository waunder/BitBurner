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
