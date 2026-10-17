#!/usr/bin/env python3
"""Idempotent local daemon recovery; never confuse a game drop with process death."""
import argparse
import asyncio
import fcntl
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time

from bb_remote import _ctl_call

REPO = Path(__file__).resolve().parent.parent


def port_is_free(port):
    # Match asyncio's POSIX server behavior: SO_REUSEADDR permits reuse of
    # connections left in TIME_WAIT by a stopped daemon. It does not grant
    # SO_REUSEPORT sharing. Test listen too, because some kernels permit two
    # reusable binds but reject the second listener. An active listener or a
    # sandbox denial therefore still blocks a spawn. The real daemon binds
    # again under the recovery lock and fails safely if another owner wins.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("127.0.0.1", port))
        sock.listen(1)


def emit(value):
    print(json.dumps(value), flush=True)


def status_result(reply):
    if not reply.get("ok"):
        return reply
    status = reply.get("result", {})
    connected = status.get("connected")
    degraded = connected and (status.get("sync_root_alarm") or status.get("pull_root_alarm")
                              or (status.get("last_sync_pass") or {}).get("failed")
                              or (status.get("last_pull_pass") or {}).get("failed"))
    state = "sync_degraded" if degraded else ("connected" if connected else "game_disconnected")
    return {
        "ok": True,
        "state": state,
        "action": "none",
        "result": status,
        **({"next": "Steam Options > Remote API: use the configured game port (default 12526) at 127.0.0.1, plain WebSocket, then click Connect. A listener cannot initiate the game connection."}
           if not status.get("connected") else {}),
    }


async def check(args):
    reply = await _ctl_call(args.control_port, {"cmd": "status"}, timeout=5)
    if reply.get("ok"):
        return status_result(reply)
    if reply.get("error_code") != "connection_refused":
        return {**reply, "action": "none", "state": "health_unknown"}
    if not args.ensure:
        return {**reply, "action": "none", "state": "daemon_missing"}
    lock_path = REPO / "tools" / ".remote_api_recovery.lock"
    # flock is released by the kernel after crashes; no stale PID can block it.
    with lock_path.open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return {"ok": False, "state": "recovery_in_progress", "action": "none"}
        reply = await _ctl_call(args.control_port, {"cmd": "status"}, timeout=5)
        if reply.get("ok"):
            return status_result(reply)
        if reply.get("error_code") != "connection_refused":
            return {**reply, "action": "none", "state": "health_unknown"}
        try:
            port_is_free(args.port)
            port_is_free(args.control_port)
        except OSError as exc:
            return {"ok": False, "state": "listener_or_permission_conflict", "action": "none", "error": str(exc)}
        # Use this interpreter (the shell wrapper selects the repository venv),
        # absolute script path and detached session; never stdin or an ephemeral
        # terminal as the process owner. launchd remains the durable supervisor.
        with (REPO / "tools" / "bb_remote_daemon.log").open("ab") as log:
            child = subprocess.Popen(
                [sys.executable, str(REPO / "tools" / "bb_remote.py"), "daemon",
                 "--port", str(args.port), "--control-port", str(args.control_port)],
                cwd=REPO, stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                start_new_session=True,
            )
        for _ in range(10):
            await asyncio.sleep(0.5)
            reply = await _ctl_call(args.control_port, {"cmd": "status"}, timeout=5)
            if reply.get("ok"):
                return {**status_result(reply), "action": "started", "spawned_pid": child.pid}
            if child.poll() is not None:
                break
        return {"ok": False, "state": "start_failed", "action": "start_attempted",
                "spawned_pid": child.pid, "error": "Inspect tools/bb_remote_daemon.log; no existing process was killed."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=int(os.environ.get("DAEMON_PORT", "12526")))
    parser.add_argument("--control-port", type=int, default=int(os.environ.get("CONTROL_PORT", "12527")))
    parser.add_argument("--ensure", action="store_true", help="Start a missing daemon only when both ports are free")
    parser.add_argument("--daemon", action="store_true", help="Check every 60 seconds; launchd is preferred")
    parser.add_argument("--resync", action="store_true", help="Push every watched file over the existing connection, without restarting")
    args = parser.parse_args()
    previous = None
    while True:
        result = asyncio.run(check(args))
        if args.resync and result.get("state") == "connected":
            reply = asyncio.run(_ctl_call(args.control_port, {"cmd": "resync"}, timeout=120))
            summary = reply.get("result", {})
            complete = (reply.get("ok") is True and bool(summary.get("pushed"))
                        and not summary.get("failed") and not summary.get("missing"))
            result = {"ok": complete, "state": "synced" if complete else "sync_failed", "sync": reply}
        # Uptime/freshness changing is normal, not an alert every minute.
        signature = (result.get("ok"), result.get("state"), result.get("action"), result.get("error"))
        if signature != previous or not args.daemon:
            emit(result)
        previous = signature
        if not args.daemon:
            return 0 if result.get("ok") and result.get("state") in ("connected", "synced") else 2
        time.sleep(60)


if __name__ == "__main__":
    sys.exit(main())
