#!/usr/bin/env python3
"""Outage watchdog on the Mac (Ken, 2026-11-22: "Yes, install it"; LaunchAgent com.bitburner.watchdog).

outage_watchdog.py (the PC's) judges by three heartbeat files. A 32GB bootstrap runs none of those three,
and a new BitNode keeps the last run's copies, so here the autosave on disk is the judge: an outage is no
resident script on home in two autosaves at least CONFIRM_S apart. Then it runs startup.js, which also
starts a newly entered BitNode.

It only ever runs startup.js. It holds when:
- tools/watchdog.pause exists (scripts stopped on purpose);
- the game is not saving (quit or hung: nothing here may launch or reload it);
- the active profile does not cover the BitNode (profile.py switch is never run unattended);
- it already restarted this run in the last RESTART_GAP_S (something keeps killing scripts).
A command that could not be typed is retried after RETRY_S.

Log runtime/watchdog_mac.log; state tools/watchdog_mac_state.json, whose mtime is the heartbeat.

    .venv/bin/python3 tools/watchdog_mac.py [--interval 30] [--once]
"""
import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import run_page_data as rpd  # noqa: E402
from outage_watchdog import PAUSE, REPO, run_startup  # noqa: E402

STATE = REPO / "tools" / "watchdog_mac_state.json"
LOG = REPO / "runtime" / "watchdog_mac.log"
RESIDENTS = {"mcp_supervisor.js", "capital_bootstrap.js", "capital_manager.js", "mcp.js", "maintenance_steward.js"}
CONFIRM_S = 55
SAVE_LATE_S = 180
RESTART_GAP_S = 2 * 3600
RETRY_S = 300


def active_bitnodes(root=REPO):
    """BitNodes the active profile covers."""
    try:
        profile = json.loads((root / "sync_manifest.json").read_text(encoding="utf-8"))["profile"]
        return set(json.loads((root / "profiles" / profile / "profile.json").read_text(encoding="utf-8"))["bitnodes"])
    except (OSError, ValueError, KeyError, TypeError):
        return set()


def decide(save, now_s, state, paused, bitnodes):
    """(action, reason, new_state); action is restart, hold, wait or ok."""
    state = dict(state)
    saved_s = (save.get("savedAt") or 0) / 1000
    if now_s - saved_s > SAVE_LATE_S:
        state.pop("empty", None)
        return "ok", "game is not saving; nothing to judge", state
    if RESIDENTS & set(save["scripts"]):
        state.pop("empty", None)
        return "ok", "residents running", state
    run = save["nodeResetAt"]
    seen = state.get("empty")
    if not seen or seen["run"] != run:
        seen = state["empty"] = {"run": run, "since_s": saved_s}
    if saved_s - seen["since_s"] < CONFIRM_S:
        return "wait", "no resident script in the autosave; waiting for the next save", state
    if paused:
        return "hold", "no resident script is running, but watchdog.pause is set", state
    if save["node"] not in bitnodes:
        return "hold", f"nothing running in BitNode {save['node']}, which the active profile does not cover", state
    last = state.get("restarted") or {}
    if last.get("run") == run and now_s - last["at_s"] < RESTART_GAP_S:
        return "hold", "scripts died again within 2h of a restart; leaving it for a person", state
    if now_s - state.get("failed_s", 0) < RETRY_S:
        return "hold", "startup could not be run; trying again shortly", state
    return "restart", "no resident script in two autosaves", state


def restarted(state, save, ok, now_s):
    state = dict(state)
    state.pop("empty", None)
    if ok:
        state["restarted"] = {"run": save["nodeResetAt"], "at_s": now_s}
        state.pop("failed_s", None)
    else:
        state["failed_s"] = now_s
    return state


def log(message):
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] watchdog: {message}"
    print(line, flush=True)
    try:
        with LOG.open("a", encoding="utf-8") as out:
            out.write(line + "\n")
    except OSError:
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--interval", type=float, default=30.0)
    ap.add_argument("--once", action="store_true", help="one pass: print the decision, act on nothing")
    args = ap.parse_args()
    try:
        state = json.loads(STATE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        state = {}
    if not args.once:
        log(f"started (every {args.interval:.0f}s)")
    seen_blob, save, said = None, None, None
    while True:
        try:
            found = rpd.newest_blob(rpd.blob_dir())
            if found and found != seen_blob:
                save = rpd.state_from_save(rpd.decode_blob(found[1].read_bytes()))
                seen_blob = found
            now_s = time.time()
            action, reason = "ok", "no autosave found"
            if save:
                action, reason, state = decide(save, now_s, state, PAUSE.exists(), active_bitnodes())
            if args.once:
                print(f"watchdog: once: {action}: {reason}")
                return
            if action == "restart":
                try:
                    ok, out = run_startup()
                except Exception as error:
                    ok, out = False, repr(error)
                state = restarted(state, save, ok, now_s)
                log(f"{reason}; ran startup.js -> {'ok' if ok else 'FAILED'}: {out}")
            elif action in ("hold", "wait") and reason != said:
                log(f"{action.upper()} {reason}")
            said = reason
            state.update(action=action, reason=reason)
            STATE.write_text(json.dumps(state), encoding="utf-8")
        except Exception as error:
            if args.once:
                print(f"watchdog: once: error {error!r}")
                return
            log(f"pass error: {error!r}")
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
