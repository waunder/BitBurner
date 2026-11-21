#!/usr/bin/env python3
"""Auto install on the Mac Mini (Ken, 2026-11-21): the PC ran auto_install.AutoInstall from
daemon_supervisor.py (Windows-only); this is the same check on its own loop, run by the LaunchAgent
tools/com.bitburner.auto-install.plist. Every pass asks the Remote API daemon for its status and hands
it to AutoInstall.check, which holds unless the advisor has said "install" for 5 minutes, the cycle is
at least an hour old, The Red Pill is not owned and the save backup succeeds (see auto_install.py).

Pause: create tools/autoinstall.pause. Log: runtime/autoinstall_mac.log (also stdout).

    .venv/bin/python3 tools/auto_install_mac.py [--interval 60] [--once]
"""
import argparse
import asyncio
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parent))
from auto_install import AutoInstall  # noqa: E402
from bb_remote import DEFAULT_CONTROL_PORT, _ctl_call  # noqa: E402

LOG = Path(__file__).resolve().parent.parent / "runtime" / "autoinstall_mac.log"


def log(message):
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {message}"
    print(line, flush=True)
    try:
        with LOG.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--interval", type=float, default=60.0)
    ap.add_argument("--control-port", type=int, default=DEFAULT_CONTROL_PORT)
    ap.add_argument("--once", action="store_true", help="one pass, print the decision, exit")
    args = ap.parse_args()
    installer = AutoInstall(log)
    log(f"autoinstall: Mac runner started (every {args.interval:.0f}s)")
    while True:
        try:
            reply = asyncio.run(_ctl_call(args.control_port, {"cmd": "status"}, timeout=5))
            if reply.get("ok"):
                action, reason = installer.check(reply["result"])
                if args.once:
                    log(f"autoinstall: once: {action} {reason}")
            elif args.once:
                log(f"autoinstall: once: daemon status unavailable: {reply}")
        except Exception as e:  # keep the loop alive; launchd restarts on exit anyway
            log(f"autoinstall: pass error: {e!r}")
        if args.once:
            return
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
