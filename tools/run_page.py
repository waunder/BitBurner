"""Ken's run page: a local web page with live charts of the BitBurner run.

Serves tools/run_page/index.html plus three JSON endpoints:
  /api/metrics        compact rows from runtime/metrics_log.txt (5-minute samples, pulled by the daemon)
  /api/live           live status files read through the Remote API daemon (bladeburner, sleeves, buyer,
                      readiness, gang) and the tail of bladeburner_events.txt
  /api/opportunities  docs/opportunities.md as text

Start: .venv/Scripts/python.exe tools/run_page.py [--port 8790]   then open http://localhost:8790
Read-only: it never writes to the game.
"""
import argparse
import asyncio
import json
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import bb_remote  # noqa: E402

PAGE = ROOT / "tools" / "run_page" / "index.html"
METRICS = ROOT / "runtime" / "metrics_log.txt"
LIVE_FILES = ["bladeburner_status.json", "sleeve_status.json", "sleeve_buyer_status.json",
              "augmentation_readiness.json", "gang_status.json", "capital_status.json", "money_status.json"]
LIVE_TTL_S = 10
_live_cache = {"at": 0, "data": None}
_metrics_cache = {"mtime": None, "rows": None}


def ctl_get(name):
    try:
        res = asyncio.run(bb_remote._ctl_call(bb_remote.DEFAULT_CONTROL_PORT, {"cmd": "get", "file": name}, timeout=10))
        return res.get("result") if res.get("ok") else None
    except Exception:
        return None


def compact(row):
    """Only what the page draws: keeps the payload small."""
    income = row.get("income") or {}
    bb = row.get("bladeburner") or {}
    gang = row.get("gang") or {}
    return {
        "ts": row.get("ts"), "resetAt": row.get("resetAt"), "money": row.get("money"),
        # Cumulative earnings since install by source (expenses left out); the page differentiates them.
        "earned": {k: v for k, v in income.items() if k != "total" and isinstance(v, (int, float)) and v > 0} or None,
        "installed": row.get("installedCount"), "karma": row.get("karma"),
        "skills": row.get("skills"), "verdict": row.get("verdict"),
        "rank": bb.get("rank"), "stamina": bb.get("stamina"), "action": bb.get("action"), "chaos": bb.get("chaos"),
        "sleeveBest": bb.get("sleeveBest"),
        "sleeves": [s.get("task") for s in (row.get("sleeves") or [])] or None,
        "respect": gang.get("respect") if isinstance(gang, dict) else None,
        "augReady": row.get("augReady"), "sleeveAugs": row.get("sleeveAugs"),
    }


def metrics_rows():
    try:
        mtime = METRICS.stat().st_mtime
    except OSError:
        return []
    if _metrics_cache["mtime"] != mtime:
        rows = []
        for line in METRICS.read_text(encoding="utf-8").splitlines():
            if line.startswith("{"):
                try:
                    rows.append(compact(json.loads(line)))
                except Exception:
                    pass
        _metrics_cache.update(mtime=mtime, rows=rows)
    return _metrics_cache["rows"]


def live():
    now = time.time()
    if _live_cache["data"] is None or now - _live_cache["at"] > LIVE_TTL_S:
        data = {}
        for name in LIVE_FILES:
            raw = ctl_get(name)
            try:
                data[name.replace("_status.json", "").replace(".json", "")] = json.loads(raw) if raw else None
            except Exception:
                data[name] = None
        readiness = data.get("augmentation_readiness")
        if isinstance(readiness, dict):  # trim the large offer lists
            data["augmentation_readiness"] = {k: readiness.get(k) for k in
                ("ts", "money", "installedCount", "queuedCount", "queued", "resetAt", "advice", "installPlan", "candidate")}
        events = ctl_get("bladeburner_events.txt") or ""
        data["events"] = events.strip().split("\n")[-40:]
        data["serverTs"] = int(now * 1000)
        _live_cache.update(at=now, data=data)
    return _live_cache["data"]


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype):
        payload = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        path = self.path.split("?")[0]
        try:
            if path in ("/", "/index.html"):
                self._send(200, PAGE.read_bytes(), "text/html; charset=utf-8")
            elif path == "/api/metrics":
                self._send(200, json.dumps(metrics_rows()), "application/json")
            elif path == "/api/live":
                self._send(200, json.dumps(live()), "application/json")
            elif path == "/api/opportunities":
                self._send(200, (ROOT / "docs" / "opportunities.md").read_text(encoding="utf-8"), "text/plain; charset=utf-8")
            else:
                self._send(404, "not found", "text/plain")
        except Exception as error:  # never crash the server on one bad request
            self._send(500, f"error: {error}", "text/plain")

    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--port", type=int, default=8790)
    # 0.0.0.0 so Ken can open it from the MacBook over Tailscale (http://100.125.241.4:8790) or the home LAN.
    # The page is read-only: it never writes to the game.
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"run page on http://localhost:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
