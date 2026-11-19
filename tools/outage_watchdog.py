#!/usr/bin/env python3
"""Outage watchdog: when every game script has stopped, run startup.js once.

Called by daemon_supervisor.py every pass. An outage is when the heartbeat files
of three independent residents (steward, player activity, MCP) are all older than
STALE_MS while the daemon is connected and still pulling files, so the files are
fresh copies of stale game state, not stale copies. One stale resident is not an
outage: the steward restarts those itself.

Guards:
- tools/watchdog.pause exists -> do nothing (create it before a World Daemon,
  a BitNode change, or any time scripts are stopped on purpose).
- at most one restart per RESTART_GAP_S; a second outage inside that gap is
  logged and left for a person (something is killing scripts repeatedly).
- a heartbeat missing or unreadable -> unknown, no action.
- the restart goes through tools/game_terminal.py, which refuses when the
  terminal holds typed text and uses only Runtime.evaluate.
Events go to the supervisor log, prefixed "watchdog:".
"""
import json
from pathlib import Path
import subprocess
import sys
import time

REPO = Path(__file__).resolve().parent.parent
RUNTIME = REPO / "runtime"
PAUSE = REPO / "tools" / "watchdog.pause"
STATE = REPO / "tools" / "watchdog_state.json"
HEARTBEATS = ["maintenance_status.json", "player_activity_status.json", "mcp_status.json"]
STALE_MS = 10 * 60 * 1000
PULL_FRESH_MS = 3 * 60 * 1000
RESTART_GAP_S = 2 * 3600
RESTART_COMMAND = "home; run startup.js"


def heartbeat_ages(now_ms, runtime=RUNTIME, names=HEARTBEATS):
    """Age in ms of each heartbeat's own "ts", or None when missing/unreadable."""
    ages = {}
    for name in names:
        try:
            ts = json.loads((runtime / name).read_text(encoding="utf-8"))["ts"]
            ages[name] = now_ms - float(ts)
        except (OSError, ValueError, KeyError, TypeError):
            ages[name] = None
    return ages


def decide(status, ages, now_s, last_restart_s, paused):
    """Return (action, reason); action is "restart", "hold" or "ok"."""
    if not status.get("connected"):
        return "ok", "game not connected (supervisor reconnects)"
    now_ms = now_s * 1000
    last_pull = status.get("last_pull_read_at_ms") or 0
    if now_ms - last_pull > PULL_FRESH_MS:
        return "ok", "daemon pulls are stale; heartbeats cannot be trusted"
    if any(age is None for age in ages.values()):
        return "ok", "a heartbeat is missing or unreadable"
    if not ages or min(ages.values()) < STALE_MS:
        return "ok", "residents alive"
    minutes = int(min(ages.values()) / 60000)
    if paused:
        return "hold", f"all residents silent {minutes} min, but watchdog.pause is set"
    if now_s - last_restart_s < RESTART_GAP_S:
        return "hold", (f"all residents silent {minutes} min again, within "
                        f"{RESTART_GAP_S // 3600}h of the last restart; leaving it for a person")
    return "restart", f"all residents silent {minutes} min"


def load_last_restart(path=STATE):
    try:
        return float(json.loads(path.read_text(encoding="utf-8"))["last_restart_s"])
    except (OSError, ValueError, KeyError, TypeError):
        return 0.0


def save_last_restart(when_s, path=STATE):
    path.write_text(json.dumps({"last_restart_s": when_s,
                                "last_restart": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(when_s))}),
                    encoding="utf-8")


def run_startup():
    done = subprocess.run(
        [sys.executable, str(REPO / "tools" / "game_terminal.py"), RESTART_COMMAND, "--settle", "4"],
        cwd=REPO, capture_output=True, text=True, timeout=90,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    out = (done.stdout or done.stderr or "").strip().replace("\n", " ")
    return done.returncode == 0, out[:400]


class Watchdog:
    """Logs a hold once per episode, not once per pass."""

    def __init__(self, log):
        self.log = log
        self.last_reason = None

    def check(self, status, now_s=None):
        now_s = time.time() if now_s is None else now_s
        ages = heartbeat_ages(now_s * 1000)
        action, reason = decide(status, ages, now_s, load_last_restart(), PAUSE.exists())
        if action == "restart":
            save_last_restart(now_s)  # before running, so a crash mid-restart cannot loop
            ok, out = run_startup()
            self.log(f"watchdog: {reason}; ran '{RESTART_COMMAND}' -> {'ok' if ok else 'FAILED'}: {out}")
            self.last_reason = None
        elif action == "hold" and self.last_reason != "hold":
            self.log(f"watchdog: HOLD {reason}")
            self.last_reason = "hold"
        elif action == "ok":
            self.last_reason = None
        return action, reason
