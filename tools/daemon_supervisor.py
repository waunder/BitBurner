#!/usr/bin/env python3
"""Windows keep-alive: restart a dead daemon and reconnect the game over DevTools."""
import argparse
import asyncio
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request

import websocket

from bb_remote import _ctl_call

REPO = Path(__file__).resolve().parent.parent
LOG = REPO / "tools" / "daemon_supervisor.log"
CHECK_S = 30
RECONNECT_GAP_S = 300
DETACHED = 0x00000008 | 0x00000200 | 0x08000000  # detached, new group, no window

# Leaves the page only when the terminal is not being typed in, and returns to focused work.
RECONNECT_JS = """(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const exact = (sel, t) => [...document.querySelectorAll(sel)].filter(e => e.innerText.trim() === t);
  const term = document.getElementById("terminal-input");
  if (term && term.value) return "skipped: terminal in use";
  const sim = exact("button", "Do something else simultaneously")[0];
  if (sim) { sim.click(); await wait(250); }
  const opts = exact("[role=button], .MuiListItem-root, .MuiListItemButton-root", "Options")[0];
  if (!opts) return "no Options item";
  opts.click(); await wait(300);
  const remote = exact("button, [role=button], .MuiListItem-root, .MuiListItemButton-root, [role=tab]", "Remote API")[0];
  if (!remote) return "no Remote API item";
  remote.click(); await wait(300);
  const connect = exact("button", "Connect");
  if (connect.length !== 1) return "found " + connect.length + " Connect buttons";
  connect[0].click(); await wait(500);
  const focus = exact("button", "Focus");
  if (focus.length === 1) { focus[0].click(); await wait(300); }
  return "clicked Connect";
})()"""


def log(message):
    with LOG.open("a", encoding="utf-8") as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {message}\n")


def start_daemon(port, control_port):
    with (REPO / "tools" / "bb_remote_daemon.log").open("ab") as out:
        child = subprocess.Popen(
            [sys.executable, str(REPO / "tools" / "bb_remote.py"), "daemon",
             "--port", str(port), "--control-port", str(control_port)],
            cwd=REPO, stdin=subprocess.DEVNULL, stdout=out, stderr=out, creationflags=DETACHED,
        )
    log(f"started daemon pid {child.pid}")


def reconnect_game():
    try:
        with urllib.request.urlopen("http://127.0.0.1:9222/json", timeout=5) as reply:
            pages = [p for p in json.load(reply) if p.get("type") == "page"]
    except OSError:
        return "game not running"
    if not pages:
        return "no game page"
    ws = websocket.create_connection(pages[0]["webSocketDebuggerUrl"], timeout=15, suppress_origin=True)
    try:
        ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {
            "expression": RECONNECT_JS, "returnByValue": True, "awaitPromise": True}}))
        while True:
            message = json.loads(ws.recv())
            if message.get("id") == 1:
                return message.get("result", {}).get("result", {}).get("value", "no result")
    finally:
        ws.close()


def check(args, last_reconnect):
    reply = asyncio.run(_ctl_call(args.control_port, {"cmd": "status"}, timeout=5))
    if not reply.get("ok"):
        if reply.get("error_code") == "connection_refused":
            start_daemon(args.port, args.control_port)
        else:
            log(f"status unknown: {reply}")
        return last_reconnect
    if reply["result"].get("connected") or time.time() - last_reconnect < RECONNECT_GAP_S:
        return last_reconnect
    outcome = reconnect_game()
    if outcome == "game not running":
        return last_reconnect
    log(f"reconnect: {outcome}")
    return time.time()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=12526)
    parser.add_argument("--control-port", type=int, default=12527)
    args = parser.parse_args()
    os.chdir(REPO)
    log("supervisor started")
    last_reconnect = 0.0
    while True:
        try:
            last_reconnect = check(args, last_reconnect)
        except Exception as exc:  # A bad pass must never end the keep-alive.
            log(f"check failed: {type(exc).__name__}: {exc}")
        time.sleep(CHECK_S)


if __name__ == "__main__":
    sys.exit(main())
