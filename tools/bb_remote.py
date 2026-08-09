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

Self-test (no live game needed — exercises the request/response plumbing,
including id correlation and error propagation, against an in-process
mock client that answers like the game would):

    python3 tools/bb_remote.py selftest
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
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

    async def stop(self):
        if self._client is not None:
            await self._client.close()
        if self._server is not None:
            self._server.close()
            await self._server.wait_closed()

    async def _on_connection(self, ws):
        if self._client is not None:
            # Mirrors the extension: refuse a second connection rather
            # than silently replacing the live one.
            await ws.close(reason="Another client is already connected")
            return
        self._client = ws
        self._connected_event.set()
        try:
            async for raw in ws:
                self._handle_message(raw)
        finally:
            if self._client is ws:
                self._client = None
                self._connected_event.clear()
            self._reject_all_pending("Bitburner disconnected")

    def _handle_message(self, raw: str):
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            return
        if not isinstance(msg, dict):
            return
        msg_id = msg.get("id")
        if not isinstance(msg_id, int):
            return
        fut = self._pending.pop(msg_id, None)
        if fut is None or fut.done():
            return
        if "error" in msg and msg["error"] is not None:
            err = msg["error"]
            message = err if isinstance(err, str) else json.dumps(err)
            fut.set_exception(JsonRpcError(message))
        else:
            fut.set_result(msg.get("result"))

    def _reject_all_pending(self, reason: str):
        pending, self._pending = self._pending, {}
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
        await self._client.send(json.dumps(envelope))
        try:
            return await asyncio.wait_for(fut, timeout=timeout)
        except asyncio.TimeoutError:
            self._pending.pop(req_id, None)
            raise JsonRpcError(f'Request "{method}" timed out after {timeout}s')


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
        print(f"Could not bind 127.0.0.1:{port}: {e}", file=sys.stderr)
        print(
            "If the VS Code Bitburner extension's sync server is running, "
            "it likely already holds this port — that's the coexistence "
            "conflict documented in docs/remote-api-migration.md.",
            file=sys.stderr,
        )
        return 1
    print(f"Listening on 127.0.0.1:{port}. In-game: Options -> Remote API -> "
          f"port {port} -> Connect (if not already connected there).")
    try:
        await rpc.wait_for_connection(timeout=CONNECT_TIMEOUT_S)
    except asyncio.TimeoutError:
        print(f"No game connection within {CONNECT_TIMEOUT_S}s.", file=sys.stderr)
        await rpc.stop()
        return 1
    print("Game connected.")
    api = BitburnerApi(rpc)
    try:
        result = await action(api)
        print(json.dumps(result, indent=2))
        return 0
    except JsonRpcError as e:
        print(f"RPC error: {e}", file=sys.stderr)
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
        print(f"Could not bind 127.0.0.1:{args.port}: {e}", file=sys.stderr)
        return 1
    print(f"Listening on 127.0.0.1:{args.port}. In-game: Options -> Remote API -> "
          f"port {args.port} -> Connect.")
    await rpc.wait_for_connection(timeout=None)
    print("Game connected. Commands: push <remote> <local> | get <remote> | "
          "list | delete <remote> | ram <remote> | defs | servers | save | quit")
    api = BitburnerApi(rpc, default_server=args.server)
    loop = asyncio.get_event_loop()
    while True:
        line = await loop.run_in_executor(None, sys.stdin.readline)
        if not line:
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

def build_parser():
    p = argparse.ArgumentParser(description="Direct client for Bitburner's Remote API.")
    p.add_argument("--port", type=int, default=DEFAULT_PORT)
    p.add_argument("--server", default=DEFAULT_SERVER, help="Target in-game server name")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("probe")
    sub.add_parser("selftest")
    sub.add_parser("servers")
    sub.add_parser("list")
    sp = sub.add_parser("serve")

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
    args = build_parser().parse_args()
    dispatch = {
        "probe": cmd_probe,
        "push": cmd_push,
        "get": cmd_get,
        "list": cmd_list,
        "delete": cmd_delete,
        "ram": cmd_ram,
        "servers": cmd_servers,
        "serve": cmd_serve,
        "selftest": lambda _args: run_selftest(),
    }
    code = asyncio.run(dispatch[args.cmd](args))
    sys.exit(code or 0)


if __name__ == "__main__":
    main()
