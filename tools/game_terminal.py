#!/usr/bin/env python3
"""Run one command in the game's terminal over DevTools and print what it wrote.

    .venv\\Scripts\\python.exe tools\\game_terminal.py "run restart_player.js"
    .venv\\Scripts\\python.exe tools\\game_terminal.py --port 9333 "ls"    # disposable browser game

Uses only Runtime.evaluate: the command is typed and Enter is dispatched from page
JavaScript, which the terminal accepts. Never use the Input domain on the Steam game:
on 2026-11-03 an Input.dispatchKeyEvent with "text": null failed parameter
deserialization, which Electron 41.4.0 turns into a fatal browser-process crash
(CrBrowserMain, V8FatalErrorCallback). Chromium answers the same message with
-32602 "Invalid parameters", so any malformed CDP message is a crash risk here:
every message is built by `cdp_message`, which refuses None and unknown methods.

Leaves focused work only when needed, refuses if the terminal holds typed text,
and returns to focused work afterwards unless --stay.
"""
import argparse
import json
import sys
import time
import urllib.request

import websocket

ALLOWED = {"Runtime.evaluate"}

TYPE_AND_ENTER = """(async (cmd) => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const exact = (sel, t) => [...document.querySelectorAll(sel)].filter(e => e.innerText.trim() === t);
  let term = document.getElementById("terminal-input");
  let leftWork = false;
  if (!term) {
    const sim = exact("button", "Do something else simultaneously")[0];
    if (sim) { sim.click(); leftWork = true; await wait(300); }
    const item = exact("[role=button], .MuiListItem-root, .MuiListItemButton-root", "Terminal")[0];
    if (!item) return { ok: false, error: "no Terminal item in the sidebar" };
    item.click(); await wait(400);
    term = document.getElementById("terminal-input");
  }
  if (!term) return { ok: false, error: "no terminal input" };
  if (term.value) return { ok: false, error: "terminal holds typed text: " + term.value };
  const lines = () => [...document.querySelectorAll("#terminal li")].map(e => e.innerText);
  const before = lines().length;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  set.call(term, cmd);
  term.dispatchEvent(new Event("input", { bubbles: true }));
  await wait(100);
  term.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }));
  await wait(%(settle_ms)d);
  return { ok: term.value === "", leftWork, output: lines().slice(before) };
})(%(cmd)s)"""

REFOCUS = """(async () => {
  const focus = [...document.querySelectorAll("button")].filter(e => e.innerText.trim() === "Focus");
  if (focus.length !== 1) return "no single Focus button (" + focus.length + ")";
  focus[0].click();
  return "refocused";
})()"""


def cdp_message(msg_id, method, params):
    """The only way a message is built. A None anywhere is refused before it is sent."""
    if method not in ALLOWED:
        raise ValueError(f"method {method} is not allowed")

    def check(value, path):
        if value is None:
            raise ValueError(f"{path} is None")
        if isinstance(value, dict):
            for k, v in value.items():
                check(v, f"{path}.{k}")

    check(params, "params")
    return json.dumps({"id": msg_id, "method": method, "params": params})


def evaluate(ws, msg_id, expression):
    ws.send(cdp_message(msg_id, "Runtime.evaluate", {"expression": expression, "awaitPromise": True, "returnByValue": True}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get("id") == msg_id:
            break
    if "error" in msg:
        sys.exit(f"DevTools refused the call: {msg['error']}")
    result = msg["result"]
    if "exceptionDetails" in result:
        sys.exit(f"page script failed: {result['exceptionDetails'].get('text')}")
    return result["result"].get("value")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("command", help="terminal command, e.g. 'run restart_player.js'")
    ap.add_argument("--port", type=int, default=9222)
    ap.add_argument("--settle", type=float, default=1.5, help="seconds to wait for output")
    ap.add_argument("--stay", action="store_true", help="do not return to focused work")
    args = ap.parse_args()

    pages = json.load(urllib.request.urlopen(f"http://127.0.0.1:{args.port}/json", timeout=5))
    page = next((p for p in pages if p.get("type") == "page" and "Bitburner" in p.get("title", "")), None)
    if not page:
        sys.exit(f"no Bitburner page on port {args.port}")
    ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=30, suppress_origin=True)
    try:
        js = TYPE_AND_ENTER % {"cmd": json.dumps(args.command), "settle_ms": int(args.settle * 1000)}
        result = evaluate(ws, 1, js)
        if result.get("leftWork") and not args.stay:
            time.sleep(0.2)
            result["refocus"] = evaluate(ws, 2, REFOCUS)
    finally:
        ws.close()
    print(json.dumps(result, indent=1))
    sys.exit(0 if result.get("ok") else 1)


if __name__ == "__main__":
    main()
