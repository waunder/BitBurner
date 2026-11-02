#!/usr/bin/env python3
"""Export the live save over DevTools, validate it, and print a summary.

    .venv\\Scripts\\python.exe tools\\save_export.py            # summary only
    .venv\\Scripts\\python.exe tools\\save_export.py --out NAME  # also write saves/NAME.json.gz

Reads the 'save' key of IndexedDB database 'bitburnerSave' at 127.0.0.1:9222.
Read only: nothing in the game changes.
"""
import argparse
import base64
import gzip
import json
import pathlib
import sys
import urllib.request

import websocket

READ_SAVE = """
new Promise((resolve, reject) => {
  const open = indexedDB.open('bitburnerSave');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const get = open.result.transaction('savestring').objectStore('savestring').get('save');
    get.onerror = () => reject(get.error);
    get.onsuccess = () => {
      const v = get.result;
      if (typeof v === 'string') return resolve(JSON.stringify({text: v}));
      const bytes = v instanceof Uint8Array ? v : new Uint8Array(v);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      resolve(JSON.stringify({b64: btoa(bin)}));
    };
  };
})
"""


def read_raw():
    tabs = json.load(urllib.request.urlopen("http://127.0.0.1:9222/json"))
    page = next(t for t in tabs if t["type"] == "page")
    ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=60, suppress_origin=True)
    try:
        ws.send(json.dumps({"id": 1, "method": "Runtime.evaluate",
                            "params": {"expression": READ_SAVE, "awaitPromise": True, "returnByValue": True}}))
        while True:
            msg = json.loads(ws.recv())
            if msg.get("id") == 1:
                break
    finally:
        ws.close()
    if "exceptionDetails" in msg["result"]:
        sys.exit(f"save read failed: {msg['result']['exceptionDetails']}")
    data = json.loads(msg["result"]["result"]["value"])
    if "b64" in data:
        return base64.b64decode(data["b64"])
    text = data["text"]
    try:
        return base64.b64decode(text, validate=True)
    except ValueError:
        return text.encode("utf-8")


def decode(raw):
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8"))


def summary(save):
    p = json.loads(save["data"]["PlayerSave"])["data"]
    exp = p.get("exp", {})
    skills = p.get("skills", {})
    return {
        "node": p.get("bitNodeN"),
        "money": p.get("money"),
        "hacking": skills.get("hacking"),
        "charisma": skills.get("charisma"),
        "hackingExp": exp.get("hacking"),
        "charismaExp": exp.get("charisma"),
        "karma": p.get("karma"),
        "installed": len(p.get("augmentations", [])),
        "queued": [a.get("name") for a in p.get("queuedAugmentations", [])],
        "factions": p.get("factions"),
        "work": p.get("currentWork", {}).get("data") if isinstance(p.get("currentWork"), dict) else None,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="base name; writes saves/<name>.json.gz")
    args = ap.parse_args()
    raw = read_raw()
    info = summary(decode(raw))
    if args.out:
        path = pathlib.Path(__file__).resolve().parent.parent / "saves" / f"{args.out}.json.gz"
        path.write_bytes(raw if raw[:2] == b"\x1f\x8b" else gzip.compress(raw))
        info["file"] = str(path)
        info["bytes"] = path.stat().st_size
        summary(decode(path.read_bytes()))
    print(json.dumps(info, indent=1, default=str))


if __name__ == "__main__":
    main()
