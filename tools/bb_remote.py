#!/usr/bin/env python3
"""
bb_remote.py — direct client for Bitburner's Remote API.

Prototype for cutting Claude's write path into the running game over to a
connection Claude drives itself, instead of depending on the VS Code
extension's file-sync (see docs/remote-api-migration.md for the write-up,
what was validated, and what wasn't).

## Protocol, in one paragraph

Bitburner's Remote API has the roles reversed from what you'd guess: the
GAME dials OUT as a WebSocket *client* to a WebSocket *server* that an
external tool runs. You start the server first, then in-game go to
Options -> Remote API, enter the server's hostname/port, and click
Connect. This script IS that server. Once the game connects, requests
flow as JSON-RPC 2.0 messages
(``{"jsonrpc":"2.0","id":N,"method":...,"params":...}``) and the game
answers with ``{"id":N,"result":...}`` or ``{"id":N,"error":...}``.

Sources (see docs/remote-api-migration.md for the full citation trail):
  - Official protocol spec: bitburner-official/bitburner-src,
    src/Documentation/doc/en/programming/remote_api.md (dev branch)
  - Cross-checked against the request shapes actually built by the
    installed VS Code extension:
    ~/.vscode/extensions/ficocelliguy.bitburner-file-sync-plugin-0.1.5/dist/extension.js
  - Live-confirmed default port (12525) and connection state via the
    game's own Options -> Remote API panel, read over CDP, and via `lsof`
    showing the real TCP connection between the Electron process and the
    VS Code extension's Node host.

## Dependency

Needs the `websockets` package (``pip install websockets`` into whatever
venv runs this — not stdlib, unlike the CDP scripts used elsewhere for
this project). Installed into .venv as part of building this prototype.

## Usage

One-shot subcommands start the server, wait (with a timeout) for the game
to connect, perform one call, print the result as JSON, and exit:

    python3 tools/bb_remote.py push <remote_filename> <local_file> [--server home] [--port N]
    python3 tools/bb_remote.py get <remote_filename> [--server home] [--port N]
    python3 tools/bb_remote.py list [--server home] [--port N]
    python3 tools/bb_remote.py delete <remote_filename> [--server home] [--port N]
    python3 tools/bb_remote.py ram <remote_filename> [--server home] [--port N]
    python3 tools/bb_remote.py servers [--port N]
    python3 tools/bb_remote.py probe [--port N]
        Just try to bind the port and report whether something else (e.g.
        the VS Code extension) already holds it. Does not wait for a game
        connection. Safe to run any time — it only attempts a local bind,
        never touches the game's existing connection.

## Trigger-file replacement (added 2026-08-10)

Two more one-shot subcommands, built specifically to replace
`mcp_restart.txt`/`mcp_dump_request.txt`'s dependence on the VS Code
extension's file-sync — see docs/claude-todo.md priority 1 and
docs/remote-api-diagnosis-log.md for why: two same-day incidents where a
write to one of those files never reached the game because the extension's
sync had silently dropped and doesn't replay on reconnect.

    python3 tools/bb_remote.py restart [--target <hostname>] [--port N]
        Pushes a fresh mcp_restart.txt (timestamp token, optional
        `target=<hostname>` line) directly into the game via `pushFile`,
        then reads it back via `getFile` to confirm the push actually
        landed — synchronous and confirmable, unlike a local disk write
        that silently depends on a background watcher. mcp_supervisor.js's
        existing poll loop is UNCHANGED: it still just watches
        mcp_restart.txt for a content change and runs restart_mcp.js. Only
        the delivery path into the game's filesystem changed.

    python3 tools/bb_remote.py dump <remote_filename> [--lines N] [--port N]
        Fetches a file's content directly via `getFile` and prints it
        (pretty-printed for .json, raw or tailed to the last N lines
        otherwise) — no mcp_dump_request.txt, no tail window, no CDP
        involved. This supersedes the old dump-request/tail-window/CDP
        path for any file readable this way (mcp_status.json,
        mcp_events.txt, mcp_status_log.txt, mcp_target_state.json): that
        path existed only because CDP can't call ns.read() directly, and
        this doesn't go through CDP at all. mcp_supervisor.js's
        mcp_dump_request.txt handling is left in place as a fallback (it
        costs nothing idle), not removed.

Both require the game's Options -> Remote API to be pointed at this
script's port and connected — same one-active-connection-at-a-time
constraint as `push`/`get` (see docs/remote-api-migration.md's
"Coexistence" section). They are NOT meant to replace the VS Code
extension's role for ongoing *source* file sync (mcp.js edits etc.) — that
stays on the extension/port 12525 for now. These two commands are for the
specific, occasional, ad hoc restart/dump actions that were the actual
source of the two dropped-push incidents.

## Daemon + local control channel (recommended over one-shot restart/dump)

`restart`/`dump` above each reconnect to the game from scratch, which
re-triggers the same fragile handshake path every call and gives no
visibility into *why* a connection drops, since the process exits right
after. `daemon` fixes both: one persistent process holds the game
connection open for its whole lifetime and answers a local, loopback-only
control channel that Claude's per-turn Bash calls talk to instead —
no game handshake on the common path.

    python3 tools/bb_remote.py daemon [--port 12526] [--control-port 12527]
        Start once (e.g. via nohup ... & disown, so it survives past a
        single turn/session — see the pattern in
        docs/remote-api-diagnosis-log.md's detached-listener section).
        Binds the game-facing port and waits indefinitely; also binds the
        control port immediately, before the game connects, so ctl-status
        works right away. Holds across drops and reconnects without
        needing to be restarted — every connect/disconnect still logs to
        tools/bb_remote_events.log, same as every other command here.

    python3 tools/bb_remote.py ctl-status [--control-port 12527]
    python3 tools/bb_remote.py ctl-restart [--target <hostname>] [--control-port 12527]
    python3 tools/bb_remote.py ctl-dump <remote_filename> [--lines N] [--control-port 12527]
        Cheap local calls against a running `daemon` — connect to
        127.0.0.1:<control-port>, send one JSON line, get one JSON line
        back, exit. `ctl-restart`/`ctl-dump` do exactly what `restart`/
        `dump` do, just routed through the daemon's already-open game
        connection instead of opening a new one. If the daemon isn't
        running, these fail fast with a clear "could not reach daemon
        control port" error rather than a 60s timeout.

`restart`/`dump` (one-shot) are kept for a single ad hoc call when no
daemon is running. `daemon` + `ctl-*` is the path for routine/repeated use.

## Routine script sync (added 2026-08-10, replaces the VS Code extension)

`daemon` also now pushes every watched live-game script/config file
directly — the piece that was still missing after the trigger-file
replacement above, and the reason the VS Code extension's own sync watcher
could not yet be retired. `WATCHED_FILES` (module-level list, mirrors
`docs/processes.md`'s script map — add a file there in the same commit as
adding a new live script) lists every `mcp.js`/`hacking/`/`scripts/`/
`dnet_*.js`/etc. file that actually loads into the game, deliberately
excluding generated game-output files (`mcp_status.json` etc. — those flow
game-to-disk, pushing them back would be backwards) and non-game local
tooling (`mcp_status_parser.py`, `mcp_logic.test.js`, `.d.ts` files,
`tsconfig.json`).

Two triggers push these files, both routed through the same daemon
connection `restart`/`dump` already use — no new game handshake:

- **Full resync on every game (re)connection.** `RemoteApiServer` now
  supports an `on_connect` hook; `TriggerDaemon` registers one that pushes
  every watched file's *current on-disk content*, unconditionally, the
  moment the game connects — first connect or any reconnect after a drop.
  This is deliberate, not incremental-only: the whole point is that a drop
  (which CLAUDE.md documents as the VS Code extension's core recurring
  flaw, "doesn't replay what it missed on reconnect") must never leave the
  game silently stale. Whatever changed on disk while disconnected lands
  the instant the connection comes back, without needing to know what
  changed.
- **Incremental push while connected**, polled every `SYNC_POLL_S` (2s,
  matching `mcp_supervisor.js`'s own poll interval) — only files whose
  content actually differs from the last successfully pushed content are
  re-pushed, so an idle daemon does not spam `pushFile` every 2 seconds.

Both are logged (`SYNC: ...` lines) to the same `tools/bb_remote_events.log`
as everything else here. `ctl-resync` forces an immediate full pass
on-demand (same logic the connect hook runs); `ctl-push`/`ctl-get` expose
the daemon's already-present generic push/get control-channel handlers as
CLI subcommands, for a one-off file outside the watched set. `daemon
--no-sync` disables all of this and falls back to exactly the
restart/dump-only behavior from before this section, for isolating a
regression.

## Game -> disk pull (added 2026-08-11, closes the other half of the gap)

Everything above is disk -> game only. `mcp_status.json`,
`mcp_status_log.txt`, `mcp_target_state.json`, and `mcp_events.txt`
(`PULL_FILES`) are generated *by the game* and previously had no automated
way back onto local disk — `get`/`dump`/`ctl-get`/`ctl-dump` already called
the live `getFile` RPC but only printed/returned the result, never wrote it
to the matching local path. This mirrors the push-sync design exactly, just
in the opposite direction:

- **Full pull on every game (re)connection.** `TriggerDaemon`'s existing
  `on_game_connected` hook (the same one that runs a full push resync) now
  also fetches every `PULL_FILES` entry via `getFile` and writes it to its
  matching local path, unconditionally. A file the game hasn't created yet
  (e.g. a fresh save with no `mcp_events.txt` written) raises on `getFile`
  the same way a deleted file does (see `selftest`'s
  "get_file on deleted file raises" check) — caught per-file and reported
  as `missing`, not raised, exactly like a missing `WATCHED_FILES` entry is
  handled on the push side.
- **Incremental pull every `PULL_POLL_S` (2s, same cadence as the push
  side's `SYNC_POLL_S`) while connected** — only files whose fetched
  content differs from what was last written locally get re-written, so an
  idle daemon does not rewrite disk every 2 seconds.
- New CLI: `ctl-pull` forces an immediate full pull pass on demand (the
  pull-side analog of `ctl-resync`). `daemon --no-pull` disables this half
  independently of `--no-sync` (push and pull can be toggled separately),
  for isolating a regression to one direction.

Logged as `PULL: ...` lines to the same `tools/bb_remote_events.log`.
**Validated so far only against `selftest`'s in-process mock and a
subprocess `daemon` on scratch ports — not yet against the real game
writing these files while connected.** See `docs/claude-todo.md` for the
exact live-validation status.

Long-lived mode:

    python3 tools/bb_remote.py serve --port 12525
        Start the server, wait for the game to connect, then read
        commands from stdin: push/get/list/delete/ram/defs/servers/save/quit.
        If stdin isn't a real TTY (e.g. launched non-interactively by a
        tool), it does NOT try to read commands — see the 2026-08-10 note
        below — it just holds the connection open and logs state changes
        until --duration elapses (default: forever).

    python3 tools/bb_remote.py watch --port 12526 --duration 180
        Diagnostic mode, no stdin interaction at all: bind, then log every
        connect/disconnect/message the server sees for --duration seconds
        (default 180), including reconnects. Built for actively watching a
        live connect attempt from a tool-driven (non-interactive) context —
        see docs/remote-api-diagnosis-log.md.

Self-test (no live game needed — exercises the request/response plumbing,
including id correlation and error propagation, against an in-process
mock client that answers like the game would):

    python3 tools/bb_remote.py selftest

## Logging (added 2026-08-10)

Every connect, disconnect (with WebSocket close code + reason + how long
the connection lasted), refused second-connection, sent/received message,
and dropped/unparseable message is timestamped and written to stdout AND
appended to a log file — default tools/bb_remote_events.log (gitignored;
override with --log-file, or --log-file '' to disable). This exists
because the previous diagnosis of a connect-then-drop had nothing to look
at afterward: the connection lifecycle code used to log nothing at all, so
even a live failure in front of a human produced no evidence. See
docs/remote-api-diagnosis-log.md for the write-up this was built for, and
the leading hypothesis it was built to catch (a non-interactive `serve`
invocation self-destructing on stdin EOF — see `serve`'s docstring note
above and the code comment at its non-TTY branch).
"""

from __future__ import annotations

import argparse
import asyncio
import datetime
import json
import os
import sys
import tempfile
import time
from pathlib import Path

try:
    import websockets
except ImportError:
    print(
        "Missing dependency: websockets. Install with:\n"
        "  pip install websockets",
        file=sys.stderr,
    )
    sys.exit(1)


DEFAULT_PORT = 12525
DEFAULT_SERVER = "home"
CONNECT_TIMEOUT_S = 60
REQUEST_TIMEOUT_S = 15
# websockets' own default max_size (2**20 = 1048576 bytes) killed the whole
# connection outright the moment a single getFile response exceeded it --
# found live 2026-08-11 when mcp_status_log.txt (a PULL_FILES entry that
# grows without bound per CLAUDE.md's own warning on that file) crossed 1MB:
# every reconnect did a full push resync successfully, then died with
# "ConnectionClosedError: sent 1009 (message too big)... exceeds limit of
# 1048576 bytes" the instant the pull loop tried to fetch that one file,
# looping forever (reconnect -> push -> die on pull -> reconnect...) and
# never reaching ipvgo_status.json (later in PULL_FILES) or leaving the
# connection open long enough for any ctl-* command to land. One oversized
# file should fail that one getFile call, not tear down the socket -- see
# the pull loop's own per-file try/except for the *intended* failure mode.
# 20MB is arbitrary headroom, not a tuned number.
WS_MAX_SIZE = 20 * 1024 * 1024
DEFAULT_LOG_FILE = Path(__file__).resolve().parent / "bb_remote_events.log"
DEFAULT_WATCH_DURATION_S = 180.0


# --------------------------------------------------------------------------
# Logging. Added 2026-08-10 while diagnosing a connect-then-drop that left
# no evidence anywhere: the connection lifecycle used to be handled with
# zero print/log statements, so a live disconnect produced literally
# nothing to look at afterward. Every event below goes to stdout AND to a
# file (default tools/bb_remote_events.log), specifically so a killed
# process or a lost terminal scrollback doesn't take the evidence with it
# — see docs/remote-api-diagnosis-log.md.
# --------------------------------------------------------------------------

_log_file_path: Path | None = DEFAULT_LOG_FILE


def _log(msg: str) -> None:
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    if _log_file_path is not None:
        try:
            with open(_log_file_path, "a") as f:
                f.write(line + "\n")
        except OSError as e:
            print(f"[{ts}] (log file write failed: {e})", flush=True)


class JsonRpcError(RuntimeError):
    pass


class RemoteApiServer:
    """WebSocket server the game connects into, plus the JSON-RPC 2.0
    request/response layer on top of that single connection.

    Only one game connection is meaningful at a time (matches the real
    extension's behavior: a second incoming connection while one is live
    gets closed immediately rather than silently multiplexed, so a stale
    second connection can never shadow the live one).
    """

    def __init__(self, port: int = DEFAULT_PORT, host: str = "127.0.0.1"):
        self.port = port
        self.host = host
        self._server = None
        self._client = None
        self._connected_event = asyncio.Event()
        self._next_id = 1
        self._pending: dict[int, asyncio.Future] = {}
        # Set by TriggerDaemon (see "Routine script sync" below) so a fresh
        # game connection — first connect OR a reconnect after a drop — can
        # trigger a full resync pass. Fired via asyncio.create_task, not
        # awaited inline, so a slow/failing hook can never delay accepting
        # the connection itself or block the message-receive loop.
        self._on_connect_hook = None

    @property
    def is_connected(self) -> bool:
        return self._client is not None

    def set_on_connect_hook(self, hook) -> None:
        self._on_connect_hook = hook

    async def start(self):
        self._server = await websockets.serve(
            self._on_connection, self.host, self.port, max_size=WS_MAX_SIZE
        )
        _log(f"LISTENING on {self.host}:{self.port}")

    async def stop(self):
        _log(
            "STOPPING server"
            + (" (a client is still connected — this will drop it)" if self._client is not None else "")
        )
        if self._client is not None:
            await self._client.close()
        if self._server is not None:
            self._server.close()
            await self._server.wait_closed()
        _log("STOPPED server")

    async def _on_connection(self, ws):
        remote = getattr(ws, "remote_address", None)
        request_headers = None
        try:
            request_headers = dict(ws.request.headers) if getattr(ws, "request", None) else None
        except Exception:
            pass
        if self._client is not None:
            _log(f"REFUSED connection from {remote} — another client is already connected")
            await ws.close(reason="Another client is already connected")
            return
        _log(f"CONNECTED from {remote}; headers={request_headers}")
        connect_started = time.monotonic()
        self._client = ws
        self._connected_event.set()
        if self._on_connect_hook is not None:
            asyncio.create_task(self._run_on_connect_hook())
        exc_info = ""
        try:
            async for raw in ws:
                preview = raw if len(raw) <= 500 else raw[:500] + "...(truncated)"
                _log(f"RECV: {preview}")
                self._handle_message(raw)
        except Exception as e:
            exc_info = f" — loop ended on exception {type(e).__name__}: {e}"
        finally:
            duration = time.monotonic() - connect_started
            close_code = getattr(ws, "close_code", None)
            close_reason = getattr(ws, "close_reason", None)
            _log(
                f"DISCONNECTED after {duration:.2f}s "
                f"(close_code={close_code}, close_reason={close_reason!r}){exc_info}"
            )
            if self._client is ws:
                self._client = None
                self._connected_event.clear()
            self._reject_all_pending("Bitburner disconnected")

    def _handle_message(self, raw: str):
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            _log(f"DROPPED: not valid JSON: {raw[:300]!r}")
            return
        if not isinstance(msg, dict):
            _log(f"DROPPED: JSON but not an object: {raw[:300]!r}")
            return
        msg_id = msg.get("id")
        if not isinstance(msg_id, int):
            # Per protocol every response should echo our integer request
            # id. If the game ever sends something else unsolicited (a
            # notification, a handshake message we don't know about) this
            # is exactly where it would previously vanish with no trace —
            # now it's at least logged instead of silently discarded.
            _log(f"DROPPED: message has no integer id (unsolicited?): {raw[:300]!r}")
            return
        fut = self._pending.pop(msg_id, None)
        if fut is None or fut.done():
            _log(f"DROPPED: response for unknown/already-resolved id={msg_id}: {raw[:300]!r}")
            return
        if "error" in msg and msg["error"] is not None:
            err = msg["error"]
            message = err if isinstance(err, str) else json.dumps(err)
            fut.set_exception(JsonRpcError(message))
        else:
            fut.set_result(msg.get("result"))

    async def _run_on_connect_hook(self):
        try:
            await self._on_connect_hook()
        except Exception as e:
            _log(f"ON-CONNECT HOOK ERROR: {type(e).__name__}: {e}")

    def _reject_all_pending(self, reason: str):
        pending, self._pending = self._pending, {}
        if pending:
            _log(f"REJECTING {len(pending)} pending request(s): {reason}")
        for fut in pending.values():
            if not fut.done():
                fut.set_exception(JsonRpcError(reason))

    async def wait_for_connection(self, timeout: float = CONNECT_TIMEOUT_S):
        await asyncio.wait_for(self._connected_event.wait(), timeout=timeout)

    async def request(self, method: str, params=None, timeout: float = REQUEST_TIMEOUT_S):
        if self._client is None:
            raise JsonRpcError("Not connected to Bitburner")
        req_id = self._next_id
        self._next_id += 1
        envelope = {"jsonrpc": "2.0", "id": req_id, "method": method}
        if params is not None:
            envelope["params"] = params
        fut = asyncio.get_event_loop().create_future()
        self._pending[req_id] = fut
        _log(f"SEND: id={req_id} method={method} params={params}")
        await self._client.send(json.dumps(envelope))
        try:
            result = await asyncio.wait_for(fut, timeout=timeout)
            _log(f"OK: id={req_id} method={method}")
            return result
        except asyncio.TimeoutError:
            self._pending.pop(req_id, None)
            _log(f"TIMEOUT: id={req_id} method={method} after {timeout}s with no response")
            raise JsonRpcError(f'Request "{method}" timed out after {timeout}s')
        except JsonRpcError as e:
            _log(f"ERROR: id={req_id} method={method}: {e}")
            raise


class BitburnerApi:
    """High-level wrapper: one method per documented RPC call."""

    def __init__(self, rpc: RemoteApiServer, default_server: str = DEFAULT_SERVER):
        self.rpc = rpc
        self.default_server = default_server

    async def push_file(self, filename: str, content: str, server: str | None = None):
        return await self.rpc.request(
            "pushFile",
            {"filename": filename, "content": content, "server": server or self.default_server},
        )

    async def get_file(self, filename: str, server: str | None = None):
        return await self.rpc.request(
            "getFile", {"filename": filename, "server": server or self.default_server}
        )

    async def delete_file(self, filename: str, server: str | None = None):
        return await self.rpc.request(
            "deleteFile", {"filename": filename, "server": server or self.default_server}
        )

    async def get_file_names(self, server: str | None = None):
        return await self.rpc.request("getFileNames", {"server": server or self.default_server})

    async def get_all_files(self, server: str | None = None):
        return await self.rpc.request("getAllFiles", {"server": server or self.default_server})

    async def calculate_ram(self, filename: str, server: str | None = None):
        return await self.rpc.request(
            "calculateRam", {"filename": filename, "server": server or self.default_server}
        )

    async def get_definition_file(self):
        return await self.rpc.request("getDefinitionFile")

    async def get_all_servers(self):
        return await self.rpc.request("getAllServers")

    async def get_save_file(self):
        return await self.rpc.request("getSaveFile")


# --------------------------------------------------------------------------
# CLI plumbing
# --------------------------------------------------------------------------

async def _run_one_shot(port: int, action, raw_output: bool = False, connect_timeout: float = CONNECT_TIMEOUT_S):
    """Start the server, wait for the game, run `action(api)`, stop."""
    rpc = RemoteApiServer(port=port)
    try:
        await rpc.start()
    except OSError as e:
        _log(f"Could not bind 127.0.0.1:{port}: {e}")
        _log(
            "If the VS Code Bitburner extension's sync server is running, "
            "it likely already holds this port — that's the coexistence "
            "conflict documented in docs/remote-api-migration.md."
        )
        return 1
    _log(f"Waiting up to {connect_timeout}s for game connection. In-game: "
         f"Options -> Remote API -> port {port} -> Connect (if not already connected there).")
    try:
        await rpc.wait_for_connection(timeout=connect_timeout)
    except asyncio.TimeoutError:
        _log(f"No game connection within {connect_timeout}s.")
        await rpc.stop()
        return 1
    api = BitburnerApi(rpc)
    try:
        result = await action(api)
        if raw_output:
            print(result)
        else:
            print(json.dumps(result, indent=2))
        return 0
    except JsonRpcError as e:
        _log(f"RPC error: {e}")
        return 1
    finally:
        await rpc.stop()


async def cmd_probe(args):
    rpc = RemoteApiServer(port=args.port)
    try:
        await rpc.start()
    except OSError as e:
        print(json.dumps({"port": args.port, "bindable": False, "error": str(e)}, indent=2))
        return 1
    print(json.dumps({"port": args.port, "bindable": True}, indent=2))
    await rpc.stop()
    return 0


async def cmd_push(args):
    content = Path(args.local_file).read_text()

    async def action(api):
        return await api.push_file(args.remote_filename, content, args.server)

    return await _run_one_shot(args.port, action)


async def cmd_get(args):
    async def action(api):
        return await api.get_file(args.remote_filename, args.server)

    return await _run_one_shot(args.port, action)


async def cmd_list(args):
    async def action(api):
        return await api.get_file_names(args.server)

    return await _run_one_shot(args.port, action)


async def cmd_delete(args):
    async def action(api):
        return await api.delete_file(args.remote_filename, args.server)

    return await _run_one_shot(args.port, action)


async def cmd_ram(args):
    async def action(api):
        return await api.calculate_ram(args.remote_filename, args.server)

    return await _run_one_shot(args.port, action)


async def cmd_servers(args):
    async def action(api):
        return await api.get_all_servers()

    return await _run_one_shot(args.port, action)


# --------------------------------------------------------------------------
# Trigger-file replacement — see the module docstring's "Trigger-file
# replacement" section. `restart` pushes mcp_restart.txt directly instead of
# writing it to local disk and waiting on the VS Code extension's watcher;
# `dump` reads a file's content directly instead of triggering
# mcp_supervisor.js's tail-window render and reading it back over CDP.
# Neither changes mcp_supervisor.js — restart still relies on its poll loop
# noticing the new mcp_restart.txt content and running restart_mcp.js, since
# the Remote API protocol has no "run this script" method, only file
# read/write. Only the delivery path for the restart trigger changed; the
# dump path is bypassed entirely rather than changed.
# --------------------------------------------------------------------------

RESTART_TRIGGER_FILE = "mcp_restart.txt"


async def cmd_restart(args):
    token = str(int(time.time() * 1000))
    lines = [token]
    if args.target:
        lines.append(f"target={args.target}")
    content = "\n".join(lines) + "\n"

    async def action(api):
        push_result = await api.push_file(RESTART_TRIGGER_FILE, content, args.server)
        # Read back immediately to confirm the write actually landed in the
        # game's filesystem — this is the whole point versus a local disk
        # write, which had no way to confirm the extension ever pushed it.
        readback = await api.get_file(RESTART_TRIGGER_FILE, args.server)
        return {
            "pushed_content": content,
            "push_result": push_result,
            "readback": readback,
            "readback_matches": readback.strip() == content.strip(),
            "note": (
                "mcp_supervisor.js's poll loop (POLL_MS=2000ms, unchanged) "
                "should notice this within ~2s and run restart_mcp.js."
            ),
        }

    return await _run_one_shot(args.port, action)


def _format_dump(filename: str, raw: str | None, lines: int | None) -> str:
    """Mirrors mcp_supervisor.js's formatDump — pretty-print whole .json,
    otherwise raw content (or tailed to the last `lines`) — but as a plain
    string for a terminal instead of a tail-window render, since this is
    read directly via getFile with no CDP involved.
    """
    if not raw:
        return f"(empty or does not exist: {filename})"
    if filename.endswith(".json"):
        try:
            return json.dumps(json.loads(raw), indent=2)
        except json.JSONDecodeError as e:
            return f"(invalid JSON: {e})\n\n{raw}"
    if lines:
        all_lines = raw.split("\n")
        if all_lines and all_lines[-1] == "":
            all_lines.pop()
        return "\n".join(all_lines[-lines:])
    return raw


async def cmd_dump(args):
    async def action(api):
        raw = await api.get_file(args.remote_filename, args.server)
        return _format_dump(args.remote_filename, raw, args.lines)

    return await _run_one_shot(args.port, action, raw_output=True)


# --------------------------------------------------------------------------
# Daemon + local control channel (added 2026-08-10, same session as
# `restart`/`dump` above, per Ken's design correction before this was
# considered done).
#
# `restart`/`dump` above each start a fresh RemoteApiServer, wait for a game
# connection, do one thing, and tear the connection down — the same
# connect/disconnect cycle every single call. That's a problem specifically
# because *both* failures that motivated this whole migration (the VS Code
# extension's socket dropping silently with no replay on reconnect, and
# tools/bb_remote.py's own now-fixed connect-then-drop bug) were connection
# *stability* problems, not request/response problems — so re-doing the
# handshake on every action keeps walking back through the exact fragile
# step being engineered around, and a one-shot process that exits right
# after gives no ongoing visibility into a drop; the evidence leaves with
# the process.
#
# The fix: `daemon` is a persistent process, started once, that holds the
# single game-facing RemoteApiServer open for its entire lifetime — reconnect
# instability becomes visible in one long-lived log instead of a fresh
# unknown each call, per CLAUDE.md's "log decisions, not just state"
# discipline. It also runs a second, local-only TCP control server
# (loopback only, plain JSON-lines, one request/response per connection) so
# that a per-turn Bash call — `ctl-restart`, `ctl-dump`, `ctl-status` — talks
# to the *daemon* over a cheap local socket instead of re-handshaking with
# the game. The daemon can't force the game to reconnect after a drop (the
# diagnosis log already established the game does not auto-reconnect
# regardless of the Reconnection-delay field — that needs a human click
# regardless of transport), but it stays listening the whole time so the very
# next Connect click is picked up with no process to (re)start on Claude's
# side, and every connect/disconnect is timestamped in
# tools/bb_remote_events.log for exactly the reason the diagnosis logging was
# added in the first place.
#
# `restart`/`dump` (the one-shot commands above) are kept, not removed —
# useful for a single ad hoc call when no daemon is running — but `daemon` +
# `ctl-*` is the recommended path for routine use from here on; see
# docs/processes.md.
# --------------------------------------------------------------------------

DEFAULT_CONTROL_PORT = 12527
REPO_ROOT = Path(__file__).resolve().parent.parent

# Every file that actually loads into the game, mirrored from
# docs/processes.md's script map. Repo-relative, POSIX separators, no
# leading slash (the leading slash the game's own filesystem wants is added
# at push time — see _remote_name below — matching what the VS Code
# extension's own PathMapper does: `r.startsWith("/")||(r="/"+r)`, read
# directly out of its bundled extension.js).
#
# Deliberately excludes: generated game-output files (mcp_status.json,
# mcp_status_log.txt, mcp_target_state.json, mcp_events.txt, mcp_restart.txt,
# mcp_dump_request.txt — these flow game-to-disk; pushing them back would
# overwrite live game state with a stale local copy), mcp_logic.test.js and
# ipvgo_logic.test.js (node --test files, never loaded by the game),
# mcp_status_parser.py/js (local out-of-game tooling), and
# NetscriptDefinitions.d.ts/NetscriptGlobals.d.ts/tsconfig.json/README.md
# (editor support, not netscript). If a new live script is added to the
# repo, add it here in the same commit — same rule docs/processes.md
# itself follows.
WATCHED_FILES = [
    "mcp.js",
    "mcp_launch.js",
    "mcp_logic.js",
    "mcp_config.json",
    "mcpMulti.js",
    "mcpMulti_logic.js",
    "mcp_multi_config.json",
    "skim_probe.js",
    "mcp_hud.js",
    "mcp_money.js",
    "mcp_xp.js",
    "mcp_stock_trader.js",
    "mcp_stock_trader_logic.js",
    "mcp_stocks.js",
    "mcp_status.js",
    "mcp_supervisor.js",
    "get_stats.js",
    "restart_mcp.js",
    "startup.js",
    "tail_mcp.js",
    "econ_probe.js",
    "dnet_probe.js",
    "dnet_deploy.js",
    "dnet_lib.js",
    "dnet_loot.js",
    "dnet_loot_realloc.js",
    "dnet_realloc.js",
    "dnet_phish.js",
    "dnet_scorecard.js",
    "dnet_hud.js",
    "dnet_crawl.js",
    "dnet_manager.js",
    "dnet_root.js",
    "dnet_loot_all.js",
    "dnet_loot_merge.js",
    "dnet_creds_merge.js",
    "dnet_status_merge.js",
    "dnet_killswarm.js",
    "dnet_ramcheck.js",
    "purchaseServer-8GB.js",
    "purchase_worker_server.js",
    "ipvgo_player.js",
    "ipvgo_logic.js",
    "ipvgo_hud.js",
    "hacking/crawler.js",
    "hacking/worm.js",
    "share_deploy.js",
    "set_objective.js",
    "cct_audit.js",
    "cct_dry_run.js",
    "cct_submit.js",
    "cct_hud.js",
    "cct_watcher.js",
    "maintenance_steward.js",
    "maintenance_logic.js",
    "ops_hud.js",
    "cct_logic.js",
    "automation_review.js",
    "automation_review_logic.js",
    "lsf.js",
    "scripts/copyScripts.js",
    "scripts/copy_scripts.js",
    "scripts/execute.js",
    "scripts/grow.js",
    "scripts/hack.js",
    "scripts/share.js",
    "scripts/weaken.js",
    "scripts/weakenGrowHack.js",
]

SYNC_POLL_S = 2.0  # mirrors mcp_supervisor.js's own POLL_MS

# The other direction: files the game writes that need to land back on
# local disk (see the module docstring's "Game -> disk pull" section).
# Deliberately the same four files WATCHED_FILES's own comment already
# calls out as excluded from the push side for exactly this reason — they
# flow game-to-disk, so pulling them is the correct direction, pushing them
# would be backwards.
PULL_FILES = [
    "mcp_status.json",
    "mcp_status_log.txt",
    "mcp_target_state.json",
    "mcp_events.txt",
    "mcp_multi_status.json",
    "mcp_multi_status_log.txt",
    "mcp_multi_target_state.json",
    "mcp_multi_events.txt",
    "skim_probe.json",
    "dnet_manager_registry.json",
    "mcp_formulas_shadow.txt",
    "ipvgo_status.json",
    "dnet_status.json",
    "mcp_objective_override.txt",
    "cct_inventory.json",
    "cct_dry_run.json",
    "cct_submit_status.json",
    "cct_reward_ledger.json",
    "cct_watch_status.json",
    "cct_queue_status.json",
    "maintenance_status.json",
    "maintenance_launch_status.json",
    "maintenance_history.txt",
    "purchased_worker_status.json",
    "automation_review.json",
    "automation_review.txt",
]

PULL_POLL_S = 2.0  # mirrors SYNC_POLL_S / mcp_supervisor.js's POLL_MS


def _remote_name(relpath: str) -> str:
    return relpath if relpath.startswith("/") else "/" + relpath


class TriggerDaemon:
    """Owns the long-lived game-facing RemoteApiServer and answers local
    control-channel requests against it. One JSON object per line in, one
    JSON object per line out, one request per connection (simplest thing
    that works for infrequent, low-concurrency calls from Claude's own Bash
    tool — no need for persistent client connections or multiplexing).

    Also owns the routine watched-file sync (see the module docstring's
    "Routine script sync" section): a full push of every WATCHED_FILES entry
    on every game (re)connection, plus an incremental push of only-changed
    files while connected. `watched_files`/`repo_root` are constructor
    params (not just the module globals) specifically so tests can point
    this at a small temp fixture instead of the real repo tree.

    **`repo_root=None` (the production default) is resolved fresh via
    `Path.cwd()` on every single file read/write, never cached** — see
    `_resolve_repo_root`. This was a real incident, not a hypothetical:
    2026-08-11, moving this repo's directory while a `daemon` process kept
    running left it holding `REPO_ROOT = Path(__file__).resolve().parent.parent`,
    a value frozen at import time from the *old* location. The OS updates a
    running process's cwd across a rename (confirmed via `lsof -d cwd`), but
    a Python `Path` computed once from `__file__` does not — so every watched
    file read failed with `FileNotFoundError`, silently, rate-limited to one
    quiet log line each (see `_missing_warned`) in a gitignored file nobody
    was tailing. Sync had been fully broken for roughly two hours before it
    was noticed, purely by accident, while pushing an unrelated config
    change. `repo_root` can still be pinned to a fixed `Path` explicitly
    (what the test fixtures below do) for cases that intentionally want a
    directory other than cwd, or want fixed behavior across a test's own
    chdir/rename gymnastics.
    """

    def __init__(
        self,
        rpc: RemoteApiServer,
        server: str = DEFAULT_SERVER,
        sync_enabled: bool = True,
        watched_files: list[str] | None = None,
        repo_root: Path | None = None,
        pull_enabled: bool = True,
        pull_files: list[str] | None = None,
    ):
        self.rpc = rpc
        self.api = BitburnerApi(rpc, default_server=server)
        self.started_at = time.monotonic()
        self.sync_enabled = sync_enabled
        self.watched_files = watched_files if watched_files is not None else WATCHED_FILES
        # None means "resolve dynamically" -- see _resolve_repo_root and the
        # class docstring for why this must not be resolved once and cached.
        self._repo_root_override = repo_root
        # relpath -> content last successfully pushed. Drives the
        # incremental poll's diff; a full resync ignores this (pushes
        # everything unconditionally) but still refreshes it afterward.
        self._last_pushed: dict[str, str] = {}
        self._missing_warned: set[str] = set()
        # Loud, non-rate-limited alarm state: true only when an entire full
        # pass came back with every single watched/pull file missing at
        # once -- the "code's own intention" (repo_root points at a real
        # tree containing these files) being violated wholesale, as opposed
        # to one file legitimately having been deleted. Surfaced via
        # _do_status so it's impossible to miss without tailing a log file,
        # per CLAUDE.md's "route failures through the invariant system, not
        # a print statement" rule -- this is that rule applied to the
        # Python/tooling side, not just mcp.js.
        self.sync_root_alarm: str | None = None
        self.pull_root_alarm: str | None = None
        # Pull side (game -> disk), mirrors the push side's bookkeeping
        # exactly: relpath -> content last successfully written to local
        # disk, drives the incremental pull's diff.
        self.pull_enabled = pull_enabled
        self.pull_files = pull_files if pull_files is not None else PULL_FILES
        self._last_pulled: dict[str, str] = {}
        self._pull_missing_warned: set[str] = set()
        if sync_enabled or pull_enabled:
            rpc.set_on_connect_hook(self.on_game_connected)

    def _resolve_repo_root(self) -> Path:
        """Fresh every call, deliberately -- see the class docstring's
        2026-08-11 incident note. `Path.cwd()` reflects a live process's
        current working directory even across a directory rename; a value
        computed once from `__file__` or cached in `__init__` does not.
        """
        return self._repo_root_override if self._repo_root_override is not None else Path.cwd()

    def _read_watched(self, relpath: str) -> str | None:
        try:
            return (self._resolve_repo_root() / relpath).read_text()
        except FileNotFoundError:
            if relpath not in self._missing_warned:
                _log(f"SYNC: watched file missing on disk, skipping: {relpath}")
                self._missing_warned.add(relpath)
            return None
        except OSError as e:
            _log(f"SYNC: could not read {relpath}: {e}")
            return None

    async def _resync(self, full: bool) -> dict:
        """Push every watched file (full=True) or only those whose on-disk
        content differs from what was last successfully pushed (full=False).
        Returns a summary dict; always safe to call even while disconnected
        (push_file will just raise, which is caught per-file below) though
        callers should generally guard on rpc.is_connected first.
        """
        pushed, failed, missing = [], [], []
        for relpath in self.watched_files:
            content = self._read_watched(relpath)
            if content is None:
                missing.append(relpath)
                continue
            if not full and self._last_pushed.get(relpath) == content:
                continue
            try:
                await self.api.push_file(_remote_name(relpath), content)
                self._last_pushed[relpath] = content
                pushed.append(relpath)
            except JsonRpcError as e:
                failed.append(relpath)
                _log(f"SYNC: push failed for {relpath}: {e}")
        if self.watched_files and len(missing) == len(self.watched_files):
            self.sync_root_alarm = (
                f"all {len(missing)} watched files missing under "
                f"repo_root={self._resolve_repo_root()} -- this almost always means the "
                f"daemon's working directory moved out from under it, not that every "
                f"file was deleted. See TriggerDaemon's docstring."
            )
            _log(f"SYNC: CRITICAL — {self.sync_root_alarm}")
        else:
            self.sync_root_alarm = None
        if full or pushed or failed:
            kind = "full resync" if full else "incremental sync"
            _log(
                f"SYNC: {kind} done — pushed {len(pushed)}, failed {len(failed)}, "
                f"missing {len(missing)}"
                + (f" pushed={pushed}" if pushed and len(pushed) <= 12 else "")
            )
        return {"pushed": pushed, "failed": failed, "missing": missing}

    async def on_game_connected(self):
        """Registered as RemoteApiServer's on_connect hook. Fires on first
        connect AND every reconnect after a drop — see the module
        docstring's "Routine script sync" section for why a full (not
        incremental) push here is the whole point. Runs the pull-side full
        pass right after, for the exact same reason in the other
        direction: a drop must not leave stale telemetry on disk either.
        """
        if self.sync_enabled:
            _log("SYNC: game (re)connected — running full resync pass of all watched files")
            await self._resync(full=True)
        if self.pull_enabled:
            _log("PULL: game (re)connected — running full pull pass of all telemetry files")
            await self._pull(full=True)

    async def sync_poll_loop(self):
        """Runs for the daemon's whole lifetime as a background task.
        Cancelled (via task.cancel()) when the daemon shuts down.
        """
        while True:
            await asyncio.sleep(SYNC_POLL_S)
            if not self.sync_enabled or not self.rpc.is_connected:
                continue
            try:
                await self._resync(full=False)
            except Exception as e:
                _log(f"SYNC: poll loop error: {type(e).__name__}: {e}")

    async def _pull(self, full: bool) -> dict:
        """Game -> disk counterpart to `_resync`. Fetches every
        `pull_files` entry via `getFile` and writes it to its matching
        local path (full=True) or only the ones whose fetched content
        differs from what was last written (full=False). A remote file
        that doesn't exist yet (getFile raises, same as a deleted file —
        see selftest's "get_file on deleted file raises" check) is
        skipped-and-reported via `missing`, never raised, mirroring exactly
        how `_resync` treats a watched file that's missing on disk.
        """
        pulled, failed, missing = [], [], []
        for relpath in self.pull_files:
            try:
                content = await self.api.get_file(_remote_name(relpath))
            except JsonRpcError:
                missing.append(relpath)
                if relpath not in self._pull_missing_warned:
                    _log(f"PULL: remote file not found (yet), skipping: {relpath}")
                    self._pull_missing_warned.add(relpath)
                continue
            self._pull_missing_warned.discard(relpath)
            if not full and self._last_pulled.get(relpath) == content:
                continue
            try:
                (self._resolve_repo_root() / relpath).write_text(content)
                self._last_pulled[relpath] = content
                pulled.append(relpath)
            except OSError as e:
                failed.append(relpath)
                _log(f"PULL: write failed for {relpath}: {e}")
        # Unlike _resync's "missing" (a local-read problem, so all-missing
        # signals a bad repo_root), pull's "missing" means the *remote* file
        # doesn't exist on the game side yet -- not a repo_root symptom. A
        # bad repo_root shows up here as "failed" (the local write raising)
        # instead, so that's what gets the all-of-them alarm check.
        attempted = len(self.pull_files) - len(missing)
        if attempted > 0 and len(failed) == attempted:
            self.pull_root_alarm = (
                f"every pull write failed under repo_root={self._resolve_repo_root()} -- "
                f"this almost always means the daemon's working directory moved out from "
                f"under it, not that every write independently broke. See TriggerDaemon's "
                f"docstring."
            )
            _log(f"PULL: CRITICAL — {self.pull_root_alarm}")
        else:
            self.pull_root_alarm = None
        if full or pulled or failed:
            kind = "full pull" if full else "incremental pull"
            _log(
                f"PULL: {kind} done — pulled {len(pulled)}, failed {len(failed)}, "
                f"missing {len(missing)}"
                + (f" pulled={pulled}" if pulled and len(pulled) <= 12 else "")
            )
        return {"pulled": pulled, "failed": failed, "missing": missing}

    async def pull_poll_loop(self):
        """Pull-side counterpart to `sync_poll_loop`, same shape and same
        cadence family (`PULL_POLL_S`, separately configurable from
        `SYNC_POLL_S` even though both default to 2.0). Runs for the
        daemon's whole lifetime as a background task; cancelled on
        shutdown.
        """
        while True:
            await asyncio.sleep(PULL_POLL_S)
            if not self.pull_enabled or not self.rpc.is_connected:
                continue
            try:
                await self._pull(full=False)
            except Exception as e:
                _log(f"PULL: poll loop error: {type(e).__name__}: {e}")

    async def _do_restart(self, target):
        token = str(int(time.time() * 1000))
        lines = [token]
        if target:
            lines.append(f"target={target}")
        content = "\n".join(lines) + "\n"
        push_result = await self.api.push_file(RESTART_TRIGGER_FILE, content)
        readback = await self.api.get_file(RESTART_TRIGGER_FILE)
        return {
            "pushed_content": content,
            "push_result": push_result,
            "readback_matches": readback.strip() == content.strip(),
            "note": "mcp_supervisor.js's poll loop (POLL_MS=2000ms) should notice this within ~2s.",
        }

    async def _do_dump(self, filename, lines):
        raw = await self.api.get_file(filename)
        return _format_dump(filename, raw, lines)

    async def _do_status(self):
        return {
            "connected": self.rpc.is_connected,
            "daemon_uptime_s": round(time.monotonic() - self.started_at, 1),
            "repo_root": str(self._resolve_repo_root()),
            "sync_enabled": self.sync_enabled,
            "watched_files": len(self.watched_files),
            "files_synced_this_connection": len(self._last_pushed),
            "sync_root_alarm": self.sync_root_alarm,
            "pull_enabled": self.pull_enabled,
            "pull_files": len(self.pull_files),
            "files_pulled_this_connection": len(self._last_pulled),
            "pull_root_alarm": self.pull_root_alarm,
        }

    async def handle_control_connection(self, reader, writer):
        peer = writer.get_extra_info("peername")
        try:
            raw = await asyncio.wait_for(reader.readline(), timeout=10)
        except asyncio.TimeoutError:
            writer.close()
            return
        if not raw:
            writer.close()
            return
        try:
            req = json.loads(raw.decode())
        except json.JSONDecodeError as e:
            await self._respond(writer, {"ok": False, "error": f"bad JSON: {e}"})
            return
        cmd = req.get("cmd")
        _log(f"CTL: {peer} -> {cmd} {req}")
        try:
            if cmd == "status":
                result = await self._do_status()
            elif cmd == "restart":
                result = await self._do_restart(req.get("target"))
            elif cmd == "dump":
                result = await self._do_dump(req["file"], req.get("lines"))
            elif cmd == "push":
                result = await self.api.push_file(req["file"], req["content"], req.get("server"))
            elif cmd == "get":
                result = await self.api.get_file(req["file"], req.get("server"))
            elif cmd == "resync":
                result = await self._resync(full=True)
            elif cmd == "pull":
                result = await self._pull(full=True)
            else:
                raise ValueError(f"unknown cmd: {cmd!r}")
            await self._respond(writer, {"ok": True, "result": result})
        except JsonRpcError as e:
            await self._respond(writer, {"ok": False, "error": str(e)})
        except Exception as e:
            await self._respond(writer, {"ok": False, "error": f"{type(e).__name__}: {e}"})

    async def _respond(self, writer, obj):
        try:
            writer.write((json.dumps(obj) + "\n").encode())
            await writer.drain()
        finally:
            writer.close()


async def cmd_daemon(args):
    rpc = RemoteApiServer(port=args.port)
    try:
        await rpc.start()
    except OSError as e:
        _log(f"Could not bind game-facing port 127.0.0.1:{args.port}: {e}")
        return 1

    sync_enabled = not args.no_sync
    pull_enabled = not args.no_pull
    daemon = TriggerDaemon(rpc, server=args.server, sync_enabled=sync_enabled, pull_enabled=pull_enabled)
    try:
        control_server = await asyncio.start_server(
            daemon.handle_control_connection, "127.0.0.1", args.control_port
        )
    except OSError as e:
        _log(f"Could not bind control port 127.0.0.1:{args.control_port}: {e}")
        await rpc.stop()
        return 1

    sync_task = None
    if sync_enabled:
        sync_task = asyncio.create_task(daemon.sync_poll_loop())
        _log(
            f"SYNC: enabled — watching {len(daemon.watched_files)} files under "
            f"{daemon._resolve_repo_root()}. Full resync on every game (re)connect; "
            f"incremental push every {SYNC_POLL_S}s while connected."
        )
    else:
        _log("SYNC: disabled (--no-sync) — restart/dump/ctl-* only, same as before this feature.")

    pull_task = None
    if pull_enabled:
        pull_task = asyncio.create_task(daemon.pull_poll_loop())
        _log(
            f"PULL: enabled — pulling {len(daemon.pull_files)} telemetry files "
            f"into {daemon._resolve_repo_root()}. Full pull on every game (re)connect; "
            f"incremental pull every {PULL_POLL_S}s while connected."
        )
    else:
        _log("PULL: disabled (--no-pull) — telemetry files stay whatever they were on disk.")

    _log(
        f"DAEMON running: game-facing port {args.port} (Options -> Remote API "
        f"-> port {args.port} -> Connect), control port {args.control_port} "
        f"(loopback only). Holds the connection open indefinitely and "
        f"survives drops/reconnects without restarting. Use `ctl-status` / "
        f"`ctl-restart` / `ctl-dump` / `ctl-push` / `ctl-get` / `ctl-resync` / "
        f"`ctl-pull` against --control-port {args.control_port} instead of "
        f"one-shot commands while this is running."
    )
    try:
        async with control_server:
            await control_server.serve_forever()
    finally:
        if sync_task is not None:
            sync_task.cancel()
        if pull_task is not None:
            pull_task.cancel()
    return 0


async def _ctl_call(control_port: int, req: dict, timeout: float = 15.0) -> dict:
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection("127.0.0.1", control_port), timeout=5
        )
    except (ConnectionRefusedError, OSError, asyncio.TimeoutError) as e:
        return {
            "ok": False,
            "error": (
                f"could not reach daemon control port 127.0.0.1:{control_port}: {e}. "
                f"Is `bb_remote.py daemon --control-port {control_port}` running?"
            ),
        }
    try:
        writer.write((json.dumps(req) + "\n").encode())
        await writer.drain()
        raw = await asyncio.wait_for(reader.readline(), timeout=timeout)
        if not raw:
            return {"ok": False, "error": "daemon closed the connection with no response"}
        return json.loads(raw.decode())
    except asyncio.TimeoutError:
        return {"ok": False, "error": f"daemon did not respond within {timeout}s"}
    finally:
        writer.close()


async def cmd_ctl_status(args):
    result = await _ctl_call(args.control_port, {"cmd": "status"})
    print(json.dumps(result, indent=2))
    return 0 if result.get("ok") else 1


async def cmd_ctl_restart(args):
    result = await _ctl_call(args.control_port, {"cmd": "restart", "target": args.target})
    print(json.dumps(result, indent=2))
    return 0 if result.get("ok") else 1


async def cmd_ctl_dump(args):
    result = await _ctl_call(args.control_port, {"cmd": "dump", "file": args.remote_filename, "lines": args.lines})
    if result.get("ok"):
        print(result["result"])
        return 0
    print(json.dumps(result, indent=2))
    return 1


async def cmd_ctl_push(args):
    content = Path(args.local_file).read_text()
    result = await _ctl_call(
        args.control_port, {"cmd": "push", "file": args.remote_filename, "content": content}
    )
    print(json.dumps(result, indent=2))
    return 0 if result.get("ok") else 1


async def cmd_ctl_get(args):
    result = await _ctl_call(args.control_port, {"cmd": "get", "file": args.remote_filename})
    print(json.dumps(result, indent=2))
    return 0 if result.get("ok") else 1


async def cmd_ctl_resync(args):
    result = await _ctl_call(args.control_port, {"cmd": "resync"}, timeout=30.0)
    print(json.dumps(result, indent=2))
    return 0 if result.get("ok") else 1


async def cmd_ctl_pull(args):
    result = await _ctl_call(args.control_port, {"cmd": "pull"}, timeout=30.0)
    print(json.dumps(result, indent=2))
    return 0 if result.get("ok") else 1


async def cmd_serve(args):
    rpc = RemoteApiServer(port=args.port)
    try:
        await rpc.start()
    except OSError as e:
        _log(f"Could not bind 127.0.0.1:{args.port}: {e}")
        return 1
    _log(f"Waiting for game connection. In-game: Options -> Remote API -> "
         f"port {args.port} -> Connect.")
    await rpc.wait_for_connection(timeout=None)

    # 2026-08-10: found while diagnosing a connect-then-drop that a
    # non-interactive invocation of `serve` (no controlling TTY on stdin —
    # exactly what a scripted/tool-driven launch looks like) makes
    # `sys.stdin.readline()` return '' immediately, which the old code
    # below treated identically to `quit` and tore the live connection
    # down within the same tick it was accepted. That's a near-exact match
    # for the reported symptom, so: only read interactive commands from a
    # real TTY. Otherwise fall into a silent watch loop that just holds
    # the connection open and logs state changes, same as `watch` mode.
    if not sys.stdin.isatty():
        _log(
            "stdin is not a TTY (non-interactive invocation) — NOT reading "
            "commands from it, since an immediate EOF here used to silently "
            "tear down the connection. Holding the connection open and "
            "logging state changes instead; use `watch` explicitly for this "
            "behavior with a bounded --duration, or run `serve` from a real "
            "terminal to get the interactive command prompt."
        )
        await _hold_and_log(rpc, duration=args.duration)
        return 0

    print("Game connected. Commands: push <remote> <local> | get <remote> | "
          "list | delete <remote> | ram <remote> | defs | servers | save | quit")
    api = BitburnerApi(rpc, default_server=args.server)
    loop = asyncio.get_event_loop()
    while True:
        line = await loop.run_in_executor(None, sys.stdin.readline)
        if not line:
            _log("stdin EOF in interactive mode — treating as `quit`.")
            break
        parts = line.strip().split(maxsplit=2)
        if not parts:
            continue
        cmd, rest = parts[0], parts[1:]
        try:
            if cmd == "quit":
                break
            elif cmd == "push" and len(rest) == 2:
                content = Path(rest[1]).read_text()
                result = await api.push_file(rest[0], content)
            elif cmd == "get" and len(rest) == 1:
                result = await api.get_file(rest[0])
            elif cmd == "list":
                result = await api.get_file_names()
            elif cmd == "delete" and len(rest) == 1:
                result = await api.delete_file(rest[0])
            elif cmd == "ram" and len(rest) == 1:
                result = await api.calculate_ram(rest[0])
            elif cmd == "defs":
                result = await api.get_definition_file()
            elif cmd == "servers":
                result = await api.get_all_servers()
            elif cmd == "save":
                result = await api.get_save_file()
            else:
                print(f"unrecognized command: {line.strip()}")
                continue
            print(json.dumps(result, indent=2)[:2000])
        except JsonRpcError as e:
            print(f"RPC error: {e}")
    await rpc.stop()
    return 0


async def _hold_and_log(rpc: RemoteApiServer, duration: float | None):
    """Idle for up to `duration` seconds (None = forever), doing nothing
    but periodic heartbeats — all the actual connect/disconnect/message
    logging happens inside RemoteApiServer itself, so this just bounds how
    long the process stays alive and proves (via the heartbeat lines) that
    it didn't silently die.
    """
    start = time.monotonic()
    tick = 0
    while duration is None or (time.monotonic() - start) < duration:
        await asyncio.sleep(5)
        tick += 1
        _log(f"heartbeat #{tick}: connected={rpc.is_connected}")
    _log(f"hold duration ({duration}s) elapsed, stopping.")
    await rpc.stop()


async def cmd_watch(args):
    """Dedicated diagnostic mode: bind, then just sit and log every
    connect/disconnect the server sees for up to --duration seconds,
    reconnects included. No stdin interaction at all — built specifically
    so a tool-driven (non-TTY) invocation can watch a live connect attempt
    in real time without the stdin-EOF hazard `serve` had.
    """
    rpc = RemoteApiServer(port=args.port)
    try:
        await rpc.start()
    except OSError as e:
        _log(f"Could not bind 127.0.0.1:{args.port}: {e}")
        return 1
    _log(
        f"WATCH mode: listening on 127.0.0.1:{args.port} for up to {args.duration}s. "
        f"In-game: Options -> Remote API -> port {args.port} -> Connect. "
        f"Every connect/disconnect/message will be logged below and in {_log_file_path}."
    )
    await _hold_and_log(rpc, duration=args.duration)
    return 0


# --------------------------------------------------------------------------
# Self-test — validates the request/response plumbing without a live game,
# using an in-process mock client that answers the way the real game does
# per the official protocol spec.
# --------------------------------------------------------------------------

async def _mock_game_client(uri: str, files: dict):
    async with websockets.connect(uri) as ws:
        async for raw in ws:
            msg = json.loads(raw)
            method = msg.get("method")
            params = msg.get("params") or {}
            req_id = msg["id"]
            try:
                if method == "pushFile":
                    files[params["filename"]] = params["content"]
                    result = "OK"
                elif method == "getFile":
                    if params["filename"] not in files:
                        raise KeyError(params["filename"])
                    result = files[params["filename"]]
                elif method == "getFileNames":
                    result = sorted(files.keys())
                elif method == "deleteFile":
                    if params["filename"] not in files:
                        raise KeyError(params["filename"])
                    del files[params["filename"]]
                    result = "OK"
                elif method == "getAllFiles":
                    result = [{"filename": k, "content": v} for k, v in files.items()]
                else:
                    raise NotImplementedError(method)
                await ws.send(json.dumps({"jsonrpc": "2.0", "id": req_id, "result": result}))
            except Exception as e:
                await ws.send(json.dumps({"jsonrpc": "2.0", "id": req_id, "error": str(e)}))


async def run_selftest():
    port = 21212  # arbitrary port unlikely to collide with the real 12525
    rpc = RemoteApiServer(port=port)
    await rpc.start()
    files: dict = {}
    mock_task = asyncio.create_task(_mock_game_client(f"ws://127.0.0.1:{port}", files))
    await rpc.wait_for_connection(timeout=5)
    api = BitburnerApi(rpc)

    checks = []

    r = await api.push_file("selftest.txt", "hello world", server="home")
    checks.append(("push_file returns OK", r == "OK"))

    r = await api.get_file("selftest.txt", server="home")
    checks.append(("get_file round-trips content", r == "hello world"))

    r = await api.get_file_names(server="home")
    checks.append(("get_file_names lists pushed file", "selftest.txt" in r))

    r = await api.delete_file("selftest.txt", server="home")
    checks.append(("delete_file returns OK", r == "OK"))

    try:
        await api.get_file("selftest.txt", server="home")
        checks.append(("get_file on deleted file raises", False))
    except JsonRpcError:
        checks.append(("get_file on deleted file raises", True))

    # Concurrent requests: id correlation must not cross wires.
    results = await asyncio.gather(
        api.push_file("a.txt", "A", server="home"),
        api.push_file("b.txt", "B", server="home"),
        api.push_file("c.txt", "C", server="home"),
    )
    checks.append(("concurrent pushes all OK", all(r == "OK" for r in results)))
    a, b, c = await asyncio.gather(
        api.get_file("a.txt", server="home"),
        api.get_file("b.txt", server="home"),
        api.get_file("c.txt", server="home"),
    )
    checks.append(("concurrent gets don't cross ids", (a, b, c) == ("A", "B", "C")))

    # -- TriggerDaemon routine sync (added 2026-08-10, see the module
    # docstring's "Routine script sync" section) — exercised against a small
    # temp-directory fixture, not the real repo, so this stays isolated and
    # fast. Reuses the same mock game connection/`files` dict above.
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        (tmp_path / "a.js").write_text("console.log('a')")
        (tmp_path / "sub").mkdir()
        (tmp_path / "sub" / "b.js").write_text("console.log('b')")
        watched = ["a.js", "sub/b.js", "missing.js"]

        # Pull-side fixture (added 2026-08-11, see the module docstring's
        # "Game -> disk pull" section): seed the mock game's `files` dict
        # directly, simulating content the game already generated, for two
        # of three configured pull files; the third stays absent to
        # exercise the missing-remote-file path.
        files["/status.json"] = '{"ok": true}'
        files["/events.txt"] = "line1\nline2\n"
        pull_files = ["status.json", "events.txt", "missing_remote.txt"]

        daemon = TriggerDaemon(rpc, watched_files=watched, repo_root=tmp_path, pull_files=pull_files)

        # Simulate what fires automatically on every game (re)connect —
        # on_game_connected() is exactly RemoteApiServer's on_connect hook.
        await daemon.on_game_connected()
        checks.append(("on_game_connected pushed the present watched files", sorted(daemon._last_pushed.keys()) == ["a.js", "sub/b.js"]))
        checks.append(("on_game_connected also pulled the present telemetry files", sorted(daemon._last_pulled.keys()) == ["events.txt", "status.json"]))
        checks.append((
            "on_game_connected's pull wrote correct content to the matching local path",
            (tmp_path / "status.json").read_text() == '{"ok": true}'
            and (tmp_path / "events.txt").read_text() == "line1\nline2\n",
        ))

        # Direct full resync (what ctl-resync / the "resync" control cmd
        # calls): pushes both real files again, reports the missing one,
        # doesn't raise.
        result1 = await daemon._resync(full=True)
        checks.append((
            "full resync pushes all present watched files",
            sorted(result1["pushed"]) == ["a.js", "sub/b.js"],
        ))
        checks.append(("full resync reports the missing file, doesn't raise", result1["missing"] == ["missing.js"]))
        checks.append(("full resync pushed content under the leading-slash remote name", files.get("/a.js") == "console.log('a')" and files.get("/sub/b.js") == "console.log('b')"))

        # Incremental pass with nothing changed on disk: no-op.
        result2 = await daemon._resync(full=False)
        checks.append(("incremental sync is a no-op when nothing changed", result2["pushed"] == [] and result2["failed"] == []))

        # Change one file on disk; incremental pass should push only that one.
        (tmp_path / "a.js").write_text("console.log('a v2')")
        result3 = await daemon._resync(full=False)
        checks.append(("incremental sync pushes only the changed file", result3["pushed"] == ["a.js"]))
        checks.append(("changed content actually landed", files.get("/a.js") == "console.log('a v2')"))

        # Direct full pull (what ctl-pull / the "pull" control cmd calls):
        # fetches both present remote files again, reports the missing one
        # (a getFile error on a file the game hasn't created yet) without
        # raising — same skip-and-report contract as the push side's
        # missing-on-disk case, just in the other direction.
        pull_result1 = await daemon._pull(full=True)
        checks.append((
            "full pull fetches all present remote telemetry files",
            sorted(pull_result1["pulled"]) == ["events.txt", "status.json"],
        ))
        checks.append(("full pull reports the missing remote file, doesn't raise", pull_result1["missing"] == ["missing_remote.txt"]))

        # Incremental pull with nothing changed on the game side: no-op.
        pull_result2 = await daemon._pull(full=False)
        checks.append(("incremental pull is a no-op when remote content is unchanged", pull_result2["pulled"] == [] and pull_result2["failed"] == []))

        # Change remote content (simulating the game rewriting the file);
        # incremental pull should fetch and write only that one.
        files["/status.json"] = '{"ok": true, "tick": 2}'
        pull_result3 = await daemon._pull(full=False)
        checks.append(("incremental pull fetches only the changed remote file", pull_result3["pulled"] == ["status.json"]))
        checks.append(("changed remote content landed on local disk", (tmp_path / "status.json").read_text() == '{"ok": true, "tick": 2}'))
        checks.append(("unchanged remote file's local copy is untouched", (tmp_path / "events.txt").read_text() == "line1\nline2\n"))

        # Control-channel status reports both directions.
        ctl_result = await daemon._do_status()
        checks.append(("status reports sync_enabled + watched count", ctl_result["sync_enabled"] is True and ctl_result["watched_files"] == 3))
        checks.append(("status reports pull_enabled + pull_files count", ctl_result["pull_enabled"] is True and ctl_result["pull_files"] == 3))

    # -- Repo-root resolution regression (added 2026-08-11 after the real
    # incident described in TriggerDaemon's docstring: moving this repo's
    # directory while a `daemon` process kept running silently broke every
    # watched-file read for hours). Faithfully reproduces the incident
    # in-process: renaming a real directory out from under the *current*
    # process, the same thing `mv` does to a long-running one, and checking
    # that dynamic (repo_root=None) resolution survives it while a pinned
    # root reproduces the original bug and trips the loud alarm.
    with tempfile.TemporaryDirectory() as outer:
        old_dir = Path(outer) / "old_location"
        old_dir.mkdir()
        (old_dir / "watched.js").write_text("console.log('v1')")
        watched2 = ["watched.js"]

        prior_cwd = os.getcwd()
        os.chdir(old_dir)
        try:
            dynamic_daemon = TriggerDaemon(rpc, watched_files=watched2, pull_enabled=False)
            result_before = await dynamic_daemon._resync(full=True)
            checks.append((
                "dynamic repo_root resolves against cwd before any move",
                result_before["missing"] == [] and result_before["pushed"] == ["watched.js"],
            ))

            # A second daemon pinned to the pre-move path, to reproduce the
            # actual bug for contrast -- this is exactly what the frozen
            # module-level REPO_ROOT used to do.
            stale_daemon = TriggerDaemon(rpc, watched_files=watched2, repo_root=old_dir, pull_enabled=False)

            new_dir = Path(outer) / "new_location"
            old_dir.rename(new_dir)
            # No explicit chdir after the rename -- os.getcwd() is expected
            # to reflect it automatically (kernel tracks cwd by inode, not
            # by path string), exactly like the live daemon's cwd tracked
            # `mv` in the real incident. If this assumption is ever wrong
            # on some platform, this check itself is what should catch it.
            checks.append((
                "this process's cwd followed the rename, unassisted",
                Path(os.getcwd()).resolve() == new_dir.resolve(),
            ))

            result_dynamic_after = await dynamic_daemon._resync(full=True)
            checks.append((
                "dynamic repo_root survives a live directory rename with no restart",
                result_dynamic_after["missing"] == [] and result_dynamic_after["pushed"] == ["watched.js"],
            ))
            checks.append(("dynamic daemon has no alarm after surviving the rename", dynamic_daemon.sync_root_alarm is None))

            result_stale_after = await stale_daemon._resync(full=True)
            checks.append((
                "pinned (stale) repo_root reproduces the original incident",
                result_stale_after["missing"] == ["watched.js"],
            ))
            checks.append((
                "stale repo_root trips the loud alarm instead of failing silently",
                stale_daemon.sync_root_alarm is not None and str(old_dir) in stale_daemon.sync_root_alarm,
            ))
            status_while_alarmed = await stale_daemon._do_status()
            checks.append(("the alarm is visible via ctl-status, not just a log line", status_while_alarmed["sync_root_alarm"] is not None))

            # Alarm is a live read of the current pass, not sticky: pointing
            # the same daemon back at a real root clears it on the next call.
            stale_daemon._repo_root_override = new_dir
            result_recovered = await stale_daemon._resync(full=True)
            checks.append(("alarm clears once repo_root is healthy again", result_recovered["missing"] == [] and stale_daemon.sync_root_alarm is None))
        finally:
            os.chdir(prior_cwd)

    # -- Pull-side counterpart: every write failing (not "missing", since
    # missing means the remote file doesn't exist -- see _pull's comment)
    # under a bad repo_root should trip pull_root_alarm the same way.
    files["/only_pull_target.txt"] = "remote content"
    broken_pull_daemon = TriggerDaemon(
        rpc, sync_enabled=False, pull_files=["only_pull_target.txt"],
        repo_root=Path("/definitely/does/not/exist/anywhere"),
    )
    pull_result_broken = await broken_pull_daemon._pull(full=True)
    checks.append(("pull write failure under a bad repo_root is reported as failed, not raised", pull_result_broken["failed"] == ["only_pull_target.txt"]))
    checks.append((
        "all-writes-failed trips pull_root_alarm",
        broken_pull_daemon.pull_root_alarm is not None and "does/not/exist" in broken_pull_daemon.pull_root_alarm,
    ))

    await rpc.stop()
    mock_task.cancel()

    ok = True
    for name, passed in checks:
        print(f"{'PASS' if passed else 'FAIL'}: {name}")
        ok = ok and passed
    return 0 if ok else 1


# --------------------------------------------------------------------------

_GLOBAL_OPTS_WITH_VALUE = ("--port", "--server", "--log-file", "--control-port")


def _normalize_argv(argv: list[str]) -> list[str]:
    """Let --port/--server/--log-file appear anywhere on the command line,
    not just before the subcommand.

    Added 2026-08-10 after this exact ordering mistake bit a live
    diagnosis session: ``watch --port 12526 --duration 180`` (port AFTER
    the subcommand) failed argparse's "unrecognized arguments" check
    because these three were only defined on the top-level parser, so the
    watcher never actually started while Ken was clicking Connect — it
    just silently wasn't listening. The obvious fix (defining the same
    three options on every subparser too, via ``parents=``) was tried and
    is actively wrong: argparse's ``_SubParsersAction.__call__`` parses
    the subcommand's remaining tokens into a *brand new* namespace with
    the subparser's own defaults, then unconditionally overwrites the
    parent namespace with every key from it — so a value given *before*
    the subcommand gets silently clobbered back to the default the
    instant the same option is merely declared again on the subparser.
    Confirmed by reading cpython's argparse.py directly, not guessed.
    Silently reverting to the wrong port is worse than the loud error this
    replaces, so: normalize the argv ourselves before argparse ever sees
    it, and keep the options declared in exactly one place (top-level
    only, as originally written).
    """
    global_part: list[str] = []
    rest: list[str] = []
    i = 0
    while i < len(argv):
        tok = argv[i]
        matched = False
        for opt in _GLOBAL_OPTS_WITH_VALUE:
            if tok == opt:
                if i + 1 < len(argv):
                    global_part.extend([tok, argv[i + 1]])
                    i += 2
                else:
                    global_part.append(tok)
                    i += 1
                matched = True
                break
            if tok.startswith(opt + "="):
                global_part.append(tok)
                i += 1
                matched = True
                break
        if not matched:
            rest.append(tok)
            i += 1
    return global_part + rest


def build_parser():
    p = argparse.ArgumentParser(description="Direct client for Bitburner's Remote API.")
    p.add_argument("--port", type=int, default=DEFAULT_PORT)
    p.add_argument("--server", default=DEFAULT_SERVER, help="Target in-game server name")
    p.add_argument(
        "--log-file",
        default=str(DEFAULT_LOG_FILE),
        help=(
            "Path to append timestamped connection/event logs to (in addition to stdout). "
            f"Default: {DEFAULT_LOG_FILE}. Pass an empty string to disable file logging."
        ),
    )
    p.add_argument(
        "--control-port", type=int, default=DEFAULT_CONTROL_PORT,
        help=(
            f"Loopback-only port for the daemon's local control channel "
            f"(`daemon` binds it, `ctl-*` connects to it). Default: {DEFAULT_CONTROL_PORT}."
        ),
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("probe")
    sub.add_parser("selftest")
    sub.add_parser("servers")
    sub.add_parser("list")

    sp = sub.add_parser("serve")
    sp.add_argument(
        "--duration", type=float, default=None,
        help="Only used when stdin isn't a TTY: hold the connection open and log for this "
             "many seconds, then exit. Default: forever.",
    )

    sp = sub.add_parser(
        "watch",
        help="Diagnostic mode: bind and log every connect/disconnect for --duration seconds, "
             "no stdin interaction. Built for tool-driven live tests.",
    )
    sp.add_argument("--duration", type=float, default=DEFAULT_WATCH_DURATION_S)

    sp = sub.add_parser("push")
    sp.add_argument("remote_filename")
    sp.add_argument("local_file")

    sp = sub.add_parser("get")
    sp.add_argument("remote_filename")

    sp = sub.add_parser("delete")
    sp.add_argument("remote_filename")

    sp = sub.add_parser("ram")
    sp.add_argument("remote_filename")

    sp = sub.add_parser(
        "restart",
        help=(
            "Trigger an mcp.js restart via the direct connection: pushes a "
            "fresh mcp_restart.txt straight into the game via pushFile and "
            "confirms via getFile, instead of writing the local file and "
            "waiting on the VS Code extension's sync watcher."
        ),
    )
    sp.add_argument("--target", default=None, help="hostname to pin, passed as target=<hostname> to restart_mcp.js")

    sp = sub.add_parser(
        "dump",
        help=(
            "Fetch a file's content directly via getFile and print it "
            "(pretty JSON, or raw/tailed text) — no tail window, no CDP."
        ),
    )
    sp.add_argument("remote_filename")
    sp.add_argument("--lines", type=int, default=None, help="Tail to the last N lines (non-JSON only); default: show everything")

    sp = sub.add_parser(
        "daemon",
        help=(
            "Persistent process: holds the game-facing Remote API connection "
            "open indefinitely, serves a local control channel (see "
            "--control-port) for ctl-status/ctl-restart/ctl-dump/ctl-push/"
            "ctl-get/ctl-resync/ctl-pull, and (unless --no-sync/--no-pull) "
            "pushes every WATCHED_FILES entry and pulls every PULL_FILES "
            "entry on every game (re)connect plus incrementally while "
            "connected. Recommended over one-shot commands for routine use — "
            "see the module docstring's Daemon, Routine script sync, and "
            "Game -> disk pull sections."
        ),
    )
    sp.add_argument(
        "--no-sync", action="store_true",
        help="Disable the watched-file push/resync loop; daemon still serves restart/dump/ctl-* as before this feature existed.",
    )
    sp.add_argument(
        "--no-pull", action="store_true",
        help="Disable the telemetry-file pull loop (mcp_status.json etc.); toggled independently of --no-sync.",
    )

    sub.add_parser("ctl-status", help="Ask a running `daemon` whether the game is connected (and sync/pull state), via the local control channel.")

    sp = sub.add_parser("ctl-restart", help="Ask a running `daemon` to push a fresh mcp_restart.txt, via the local control channel (no game handshake per call).")
    sp.add_argument("--target", default=None, help="hostname to pin, passed as target=<hostname> to restart_mcp.js")

    sp = sub.add_parser("ctl-dump", help="Ask a running `daemon` to fetch a file, via the local control channel (no game handshake per call).")
    sp.add_argument("remote_filename")
    sp.add_argument("--lines", type=int, default=None, help="Tail to the last N lines (non-JSON only); default: show everything")

    sp = sub.add_parser("ctl-push", help="Ask a running `daemon` to push one file (any path, not just WATCHED_FILES) via pushFile, via the local control channel.")
    sp.add_argument("remote_filename")
    sp.add_argument("local_file")

    sp = sub.add_parser("ctl-get", help="Ask a running `daemon` to fetch one file via getFile, via the local control channel (same as ctl-dump but no pretty-printing/tailing).")
    sp.add_argument("remote_filename")

    sub.add_parser("ctl-resync", help="Ask a running `daemon` to immediately push the full current on-disk content of every watched file — the same pass that runs automatically on every game (re)connect.")

    sub.add_parser("ctl-pull", help="Ask a running `daemon` to immediately fetch every PULL_FILES entry (mcp_status.json etc.) and write it to disk — the pull-side analog of ctl-resync, same pass that runs automatically on every game (re)connect.")

    return p


def main():
    global _log_file_path
    args = build_parser().parse_args(_normalize_argv(sys.argv[1:]))
    _log_file_path = Path(args.log_file) if args.log_file else None
    dispatch = {
        "probe": cmd_probe,
        "push": cmd_push,
        "get": cmd_get,
        "list": cmd_list,
        "delete": cmd_delete,
        "ram": cmd_ram,
        "servers": cmd_servers,
        "serve": cmd_serve,
        "watch": cmd_watch,
        "restart": cmd_restart,
        "dump": cmd_dump,
        "daemon": cmd_daemon,
        "ctl-status": cmd_ctl_status,
        "ctl-restart": cmd_ctl_restart,
        "ctl-dump": cmd_ctl_dump,
        "ctl-push": cmd_ctl_push,
        "ctl-get": cmd_ctl_get,
        "ctl-resync": cmd_ctl_resync,
        "ctl-pull": cmd_ctl_pull,
        "selftest": lambda _args: run_selftest(),
    }
    code = asyncio.run(dispatch[args.cmd](args))
    sys.exit(code or 0)


if __name__ == "__main__":
    main()
