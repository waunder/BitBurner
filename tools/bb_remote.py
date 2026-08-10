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
import sys
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

    @property
    def is_connected(self) -> bool:
        return self._client is not None

    async def start(self):
        self._server = await websockets.serve(
            self._on_connection, self.host, self.port
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

async def _run_one_shot(port: int, action):
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
    _log(f"Waiting up to {CONNECT_TIMEOUT_S}s for game connection. In-game: "
         f"Options -> Remote API -> port {port} -> Connect (if not already connected there).")
    try:
        await rpc.wait_for_connection(timeout=CONNECT_TIMEOUT_S)
    except asyncio.TimeoutError:
        _log(f"No game connection within {CONNECT_TIMEOUT_S}s.")
        await rpc.stop()
        return 1
    api = BitburnerApi(rpc)
    try:
        result = await action(api)
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

    await rpc.stop()
    mock_task.cancel()

    ok = True
    for name, passed in checks:
        print(f"{'PASS' if passed else 'FAIL'}: {name}")
        ok = ok and passed
    return 0 if ok else 1


# --------------------------------------------------------------------------

_GLOBAL_OPTS_WITH_VALUE = ("--port", "--server", "--log-file")


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
        "selftest": lambda _args: run_selftest(),
    }
    code = asyncio.run(dispatch[args.cmd](args))
    sys.exit(code or 0)


if __name__ == "__main__":
    main()
