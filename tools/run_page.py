"""Ken's run page: a local web page with live charts of the BitBurner run.

Serves tools/run_page/index.html plus:
  /api/state          this run now: the autosave on disk, plus status files only while they are fresh
  /api/history        this run and the one before it, from metrics_log and the page's own autosave samples
  /api/opportunities  docs/opportunities.md as text
  /api/metrics, /api/live   used only by the old BN6 page (/bn6)

Start: .venv/Scripts/python.exe tools/run_page.py [--port 8790]   then open http://localhost:8790
Read-only: it never writes to the game. Its one output is runtime/run_page_samples.jsonl.
"""
import argparse
import asyncio
import json
import sys
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import bb_remote  # noqa: E402
import run_page_data as rpd  # noqa: E402

PAGE = ROOT / "tools" / "run_page" / "index.html"
METRICS = ROOT / "runtime" / "metrics_log.txt"
LIVE_FILES = ["bladeburner_status.json", "sleeve_status.json", "sleeve_buyer_status.json",
              "augmentation_readiness.json", "gang_status.json", "capital_status.json", "money_status.json",
              "player_activity_status.json", "graft_status.json"]
LIVE_TTL_S = 10
SAMPLES = ROOT / "runtime" / "run_page_samples.jsonl"
PAUSE = ROOT / "tools" / "autoinstall.pause"
INSTALL_STATE = ROOT / "tools" / "autoinstall_state.json"
INSTALL_LOG = ROOT / "runtime" / "autoinstall_mac.log"
STATUS_FILES = {"capital": "capital_status.json", "advisor": "augmentation_readiness.json",
                "player": "player_activity_status.json", "gangControl": "gang_status.json",
                "graft": "graft_status.json"}
SAVE_POLL_S = 20
_save = {"state": None, "error": "not read yet"}
_samples = []
_extras_cache = {"at": 0, "data": None}
_live_cache = {"at": 0, "data": None}
_metrics_cache = {"mtime": None, "rows": None}
BOOT = int(time.time())


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
        # Cumulative spending since install by category, as positive numbers.
        "spent": {k: -v for k, v in income.items() if k != "total" and isinstance(v, (int, float)) and v < 0} or None,
        "installed": row.get("installedCount"), "karma": row.get("karma"),
        "skills": row.get("skills"), "verdict": row.get("verdict"),
        "rank": bb.get("rank"), "stamina": bb.get("stamina"), "action": bb.get("action"), "chaos": bb.get("chaos"),
        "sleeveBest": bb.get("sleeveBest"),
        "sleeves": [s.get("task") for s in (row.get("sleeves") or [])] or None,
        "respect": gang.get("respect") if isinstance(gang, dict) else None,
        "augReady": row.get("augReady"), "sleeveAugs": row.get("sleeveAugs"),
        "factionRep": row.get("factionRep"), "mcpAvgRate": row.get("mcpAvgRate"), "homeRam": row.get("homeRam"),
        "gangMembers": gang.get("members") if isinstance(gang, dict) else None, "work": row.get("work"),
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
                ("ts", "money", "installedCount", "queuedCount", "queued", "resetAt", "advice", "installPlan", "candidate", "factionRep", "gangFaction")}
        events = ctl_get("bladeburner_events.txt") or ""
        data["events"] = events.strip().split("\n")[-40:]
        data["serverTs"] = int(now * 1000)
        _live_cache.update(at=now, data=data)
    return _live_cache["data"]


def load_samples():
    if not SAMPLES.exists():
        return
    for line in SAMPLES.read_text(encoding="utf-8").splitlines():
        try:
            _samples.append(json.loads(line))
        except ValueError:
            continue


def watch_save():
    """Re-read the autosave whenever the game writes one, page open or not, so the history has no holes."""
    seen = None
    while True:
        try:
            found = rpd.newest_blob(rpd.blob_dir())
            if not found:
                _save["error"] = "no autosave found on disk"
            elif found != seen:
                state = rpd.state_from_save(rpd.decode_blob(found[1].read_bytes()))
                seen = found
                _save.update(state=state, error=None)
                sample = rpd.sample_of(state)
                if rpd.wants_sample(_samples[-1] if _samples else None, sample):
                    _samples.append(sample)
                    with SAMPLES.open("a", encoding="utf-8") as out:
                        out.write(json.dumps(sample) + "\n")
        except Exception as error:  # a save mid-write, or the game replaced the blob: try again next pass
            _save["error"] = str(error)
        time.sleep(SAVE_POLL_S)


def extras():
    """Everything that needs the daemon, cached so several open pages cost one read."""
    now = time.time()
    if _extras_cache["data"] is None or now - _extras_cache["at"] > LIVE_TTL_S:
        try:
            reply = asyncio.run(bb_remote._ctl_call(bb_remote.DEFAULT_CONTROL_PORT, {"cmd": "status"}, timeout=5))
            connected = bool(reply.get("ok") and reply["result"].get("connected"))
        except Exception:
            connected = False
        files = {}
        names = {**STATUS_FILES, "target": "run_target.json", "installs": "install_count.json"}
        for key, name in names.items():
            raw = ctl_get(name) if connected else None
            try:
                files[key] = json.loads(raw) if raw else None
            except ValueError:
                files[key] = None
        _extras_cache.update(at=now, data={"connected": connected, "files": files})
    return _extras_cache["data"]


def mtime_ms(path):
    try:
        return path.stat().st_mtime * 1000
    except OSError:
        return None


def last_installs(node_reset):
    """Auto install's confirmed installs in this run, newest last."""
    if not INSTALL_LOG.exists():
        return []
    since = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(node_reset / 1000))
    out = []
    for line in INSTALL_LOG.read_text(encoding="utf-8").splitlines():
        if "autoinstall: INSTALLED" in line and line[1:20] >= since:
            out.append(line[1:20])
    return out


def run_history(state):
    return rpd.split_runs(metrics_rows() + list(_samples), state["nodeResetAt"])


def page_state():
    state = _save["state"]
    if state is None:
        return {"error": _save["error"]}
    now_ms = time.time() * 1000
    ext = extras()
    files = ext["files"]
    status = {k: files.get(k) if rpd.fresh(files.get(k), now_ms, state["resetAt"]) else None for k in STATUS_FILES}

    def pick(key, *fields):
        return {f: status[key].get(f) for f in fields} if status[key] else None

    run = rpd.run_number(state, files.get("target"))
    counts = files.get("installs") or {}
    current, _, _ = run_history(state)
    installs = max(counts.get("installs", 0) if counts.get("run") == state["nodeResetAt"] else 0,
                   len({r["resetAt"] for r in current} - {state["nodeResetAt"]}))
    paused = PAUSE.exists()
    player = pick("player", "reason", "decision")
    return {
        **state, "serverTs": now_ms, "run": run, "cycle": installs + 1,
        "daemonRequired": rpd.daemon_requirement(state, run),
        "route": rpd.route(state, files.get("target"), current),
        "alerts": rpd.alerts(state, now_ms, ext["connected"], paused, mtime_ms(INSTALL_STATE)),
        "capital": pick("capital", "action", "incomePerSec", "homeBlocked"),
        "advisor": pick("advisor", "advice", "installPlan"),
        "playerReason": ((player.get("decision") or {}).get("reason") or player.get("reason")) if player else None,
        "gangMode": (status["gangControl"] or {}).get("mode"),
        "graft": pick("graft", "note", "grafting", "blocked"),
        "autoInstall": {"paused": paused, "installs": last_installs(state["nodeResetAt"])},
    }


def page_history():
    state = _save["state"]
    if state is None:
        return {"error": _save["error"]}
    current, previous, started = run_history(state)
    fields = ("ts", "resetAt", "money", "karma", "installed", "earned", "spent")

    def slim(rows, keep):
        return [{**{k: r.get(k) for k in keep}, "hacking": (r.get("skills") or {}).get("hacking"),
                 "earnedTotal": sum((r.get("earned") or {}).values())} for r in rows]

    if not current or current[-1]["ts"] < state["savedAt"]:
        current = current + [rpd.sample_of(state)]
    return {"current": slim(rpd.thin(current), fields),
            "previous": slim(rpd.thin(previous), fields[:5]), "previousStart": started}


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
            elif path in ("/bn6", "/bn6.html"):  # the BN6 run 1 page, kept for a return to BN6/BN7
                self._send(200, (PAGE.parent / "bn6.html").read_bytes(), "text/html; charset=utf-8")
            elif path == "/api/quit" and self.client_address[0] == "127.0.0.1":
                # A newly started copy asks the old one to stop, so only one ever serves the port.
                self._send(200, "bye", "text/plain")
                threading.Thread(target=self.server.shutdown, daemon=True).start()
            elif path == "/api/version":
                # Changes when the server restarts or the page file changes; open pages reload on a change.
                self._send(200, json.dumps({"version": f"{BOOT}-{PAGE.stat().st_mtime_ns}"}), "application/json")
            elif path == "/api/metrics":
                self._send(200, json.dumps(metrics_rows()), "application/json")
            elif path == "/api/live":
                self._send(200, json.dumps(live()), "application/json")
            elif path == "/api/state":
                self._send(200, json.dumps(page_state()), "application/json")
            elif path == "/api/history":
                self._send(200, json.dumps(page_history()), "application/json")
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
    # 0.0.0.0 so Ken can open it from the MacBook over Tailscale or the home LAN (addresses: docs/governance.md).
    # The page is read-only: it never writes to the game.
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()
    # Windows lets two servers share a port (SO_REUSEADDR), and the older one kept answering with a stale
    # page. Bind exclusively, and if a copy is already running, ask it to quit and take over.
    class Server(ThreadingHTTPServer):
        # On macOS and Linux this only skips TIME_WAIT (restarts took 30 s without it). Windows must stay exclusive.
        allow_reuse_address = sys.platform != "win32"

        def server_bind(self):
            import socket
            if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            super().server_bind()

    server = None
    for _ in range(20):
        try:
            server = Server((args.host, args.port), Handler)
            break
        except OSError:
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{args.port}/api/quit", timeout=3).read()
            except Exception:
                pass
            time.sleep(0.5)
    if server is None:
        sys.exit(f"port {args.port} is held by something that would not quit")
    load_samples()
    threading.Thread(target=watch_save, daemon=True).start()
    print(f"run page on http://localhost:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
