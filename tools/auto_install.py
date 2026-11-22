#!/usr/bin/env python3
"""Auto install: when the install advisor's verdict is "install", back up the save
and run aug_install.js --install. Ken's decision 2026-11-19: the verdict is the
trigger (before, a 3-hourly check acted on it, costing ~25% of a cycle's value/h).

Called by daemon_supervisor.py every pass while the game is connected. Reads the
pulled runtime/augmentation_readiness.json (advice.verdict, written by
augmentation_readiness.js in the game).

Guards (any one stops it):
- tools/autoinstall.pause exists.
- the daemon's pulls are stale, or the readiness file is missing, not ok, or
  older than READINESS_FRESH_S.
- the verdict must read "install" continuously for CONFIRM_S (one flicker of the
  advisor is not enough).
- The Red Pill is owned: the endgame (World Daemon) stays with a person.
- the cycle is younger than MIN_CYCLE_S (anti-loop floor).
- the save backup fails: no backup, no install.
- a fresh graft_status.json says a graft is running: wait, before buying anything.
- after a failed install, nothing for FAIL_HOLD_S. Should aug_install.js still refuse
  for a graft, that is a short hold (GRAFT_HOLD_S), not a failure.
Success = the readiness file's resetAt changes within VERIFY_S.
Events go to the supervisor log, prefixed "autoinstall:".
"""
import json
from pathlib import Path
import subprocess
import sys
import time

REPO = Path(__file__).resolve().parent.parent
READINESS = REPO / "runtime" / "augmentation_readiness.json"
GRAFT = REPO / "runtime" / "graft_status.json"
PAUSE = REPO / "tools" / "autoinstall.pause"
STATE = REPO / "tools" / "autoinstall_state.json"
READINESS_FRESH_S = 5 * 60
PULL_FRESH_MS = 3 * 60 * 1000
CONFIRM_S = 5 * 60
MIN_CYCLE_S = 60 * 60
VERIFY_S = 10 * 60
GRAFT_FRESH_S = 3 * 60
FAIL_HOLD_S = 2 * 3600
GRAFT_HOLD_S = 10 * 60
INSTALL_COMMAND = "home; run aug_install.js --install"
ENDGAME_AUG = "The Red Pill"


def read_readiness(path=READINESS):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def decide(status, readiness, now_s, state, paused, graft=None):
    """Return (action, reason, new_state). action: install, installed, failed, hold, wait, ok."""
    state = dict(state)
    if not status.get("connected"):
        return "ok", "game not connected", state
    if now_s * 1000 - (status.get("last_pull_read_at_ms") or 0) > PULL_FRESH_MS:
        return "ok", "daemon pulls are stale", state
    fresh = (readiness and readiness.get("ok") is not False
             and now_s - float(readiness.get("ts") or 0) / 1000 <= READINESS_FRESH_S)
    pending = state.get("pending")
    if pending:
        if fresh and readiness.get("resetAt") != pending["resetAt"]:
            state.pop("pending")
            state["last_install_s"] = now_s
            return "installed", f"install confirmed (resetAt {pending['resetAt']} -> {readiness.get('resetAt')})", state
        if now_s - pending["started_s"] > VERIFY_S:
            state.pop("pending")
            state["hold_until_s"] = now_s + FAIL_HOLD_S
            return "failed", f"no new cycle {VERIFY_S // 60} min after the install command; holding {FAIL_HOLD_S // 3600}h", state
        return "wait", "install in progress", state
    if not fresh:
        state.pop("install_seen_s", None)
        return "ok", "readiness file missing or stale", state
    advice = readiness.get("advice") or {}
    if advice.get("verdict") != "install":
        state.pop("install_seen_s", None)
        return "ok", f"verdict {advice.get('verdict')}", state
    reason = advice.get("reason") or "install"
    if paused:
        return "hold", f"verdict install ({reason}), but autoinstall.pause is set", state
    if ENDGAME_AUG in (readiness.get("owned") or []):
        return "hold", f"verdict install, but {ENDGAME_AUG} is owned: endgame installs stay with a person", state
    if now_s < state.get("hold_until_s", 0):
        return "hold", f"verdict install, holding until {time.strftime('%H:%M', time.localtime(state['hold_until_s']))}", state
    cycle_s = now_s - float(readiness.get("resetAt") or 0) / 1000
    if cycle_s < MIN_CYCLE_S:
        return "hold", f"verdict install, but the cycle is only {int(cycle_s // 60)} min old", state
    seen = state.setdefault("install_seen_s", now_s)
    if now_s - seen < CONFIRM_S:
        return "wait", f"verdict install, confirming ({int(now_s - seen)}s of {CONFIRM_S}s)", state
    if graft and graft.get("ownsPlayer") and now_s - float(graft.get("ts") or 0) / 1000 <= GRAFT_FRESH_S:
        return "wait", "verdict install, waiting for the graft to finish", state
    return "install", reason, state


def load_state(path=STATE):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save_state(state, path=STATE):
    path.write_text(json.dumps(state), encoding="utf-8")


def _run(args, timeout):
    done = subprocess.run([sys.executable, *args], cwd=REPO, capture_output=True, text=True, timeout=timeout,
                          creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    return done.returncode, ((done.stdout or "") + (done.stderr or "")).strip().replace("\n", " ")


def backup(readiness, now_s):
    name = f"pre-install-auto-{time.strftime('%Y%m%d-%H%M', time.localtime(now_s))}"
    code, out = _run([str(REPO / "tools" / "save_export.py"), "--out", name], 120)
    path = REPO / "saves" / f"{name}.json.gz"
    ok = code == 0 and path.exists() and path.stat().st_size > 100_000
    return ok, name, out[:300]


def run_install():
    code, out = _run([str(REPO / "tools" / "game_terminal.py"), INSTALL_COMMAND, "--settle", "8", "--stay"], 120)
    return code, out  # uncut: the refusal is printed after the long status line


class AutoInstall:
    """Logs each hold or wait once per episode; every install step is logged."""

    def __init__(self, log):
        self.log = log
        self.last = None

    def note(self, action, reason):
        if action != self.last:
            self.log(f"autoinstall: {action.upper()} {reason}")
        self.last = action

    def check(self, status, now_s=None):
        now_s = time.time() if now_s is None else now_s
        readiness = read_readiness()
        action, reason, state = decide(status, readiness, now_s, load_state(), PAUSE.exists(), read_readiness(GRAFT))
        if action == "install":
            ok, name, out = backup(readiness, now_s)
            if not ok:
                state["hold_until_s"] = now_s + FAIL_HOLD_S
                save_state(state)
                self.log(f"autoinstall: FAILED backup {name}, no install, holding 2h: {out}")
                self.last = "failed"
                return "failed", "backup failed"
            self.log(f"autoinstall: verdict install ({reason}); backup saves/{name}.json.gz ok; running '{INSTALL_COMMAND}'")
            code, out = run_install()
            state.pop("install_seen_s", None)
            if "install refused" in out:
                state["hold_until_s"] = now_s + GRAFT_HOLD_S
                self.log(f"autoinstall: HOLD aug_install refused (graft in progress); retry after {GRAFT_HOLD_S // 60} min")
                self.last = "hold"
            else:
                state["pending"] = {"started_s": now_s, "resetAt": readiness.get("resetAt")}
                self.log(f"autoinstall: install command sent (exit {code}): {out[:300]}")
                self.last = "pending"
            save_state(state)
            return action, reason
        save_state(state)
        if action in ("installed", "failed"):
            self.log(f"autoinstall: {action.upper()} {reason}")
            self.last = action
        elif action in ("hold", "wait"):
            self.note(action, reason)
        else:
            self.last = None
        return action, reason
