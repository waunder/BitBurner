#!/usr/bin/env python3
"""Finish this BitNode and enter the next: docs/finish-procedure.md as one command.

    .venv/bin/python3 tools/finish_node.py --next 12            # preflight only: says what it would do, changes nothing
    .venv/bin/python3 tools/finish_node.py --next 12 --go       # back up, finish, enter, start, approve installs

The real game (DevTools 9222, daemon control 12527) is refused until the procedure says READY. A disposable copy runs
with --copy and its own ports, from a cloned tree, so every file this writes lands in that clone.

Steps after preflight: pause the watchdog, back up the save (decoded and checked), push tools/finish_node.js, run it,
read the result from the save only, remove the script, switch profile if the new node needs it, start it, add the
run's install approval quoting Ken's handover, unpause. It never restores a backup: that overwrites the save, which
is Ken's (docs/finish-procedure.md says how).
"""
from __future__ import annotations

import argparse
import datetime
import gzip
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
REPO = TOOLS.parent
sys.path.insert(0, str(TOOLS))

REAL_CDP, REAL_CONTROL = 9222, 12527
PROCEDURE = REPO / "docs" / "finish-procedure.md"
ROUTE = REPO / "docs" / "route.md"
SCRIPT = TOOLS / "finish_node.js"
GAME_SCRIPT = "finish_node.js"
STATUS_FILE = "finish_node.json"
APPROVALS = TOOLS / "install_approvals.json"
PAUSE = TOOLS / "watchdog.pause"
LOG = REPO / "runtime" / "finish_node.log"
RESIDENTS = {"mcp_supervisor.js", "capital_bootstrap.js", "capital_manager.js", "mcp.js", "maintenance_steward.js"}
HANDOVER = ("I have almost completely following your guidance for our path through the bitnodes. I am content to hand "
            "that to you completely. For completion of this game, its in your hands")
ENTRY_WAIT_S = 180
RESIDENT_WAIT_S = 180


# ---------------------------------------------------------------------------------------------------------------
# Pure decisions (tools/tests/test_finish_node.py)
# ---------------------------------------------------------------------------------------------------------------

def route_nodes(text):
    """BitNodes in the route table of docs/route.md, in order."""
    return [int(m.group(1)) for m in re.finditer(r"^\| *\d+ *\| *(\d+) *\|", text, re.M)]


def procedure_ready(text):
    return bool(re.search(r"^\*\*Status: READY\b", text, re.M))


def sf_levels(save):
    raw = json.loads(save["data"]["PlayerSave"])["data"].get("sourceFiles") or {}
    pairs = raw.get("data", []) if isinstance(raw, dict) and raw.get("ctor") else raw.items() if isinstance(raw, dict) else raw
    return {int(k): int(v) for k, v in pairs}


def profile_for(node, profiles, active):
    """The profile to run `node` with: the active one if it covers it, else the only other that does."""
    if node in profiles.get(active, ()):
        return active
    others = sorted(name for name, nodes in profiles.items() if node in nodes)
    return others[0] if len(others) == 1 else None


def preflight(*, state, nxt, route, ready, copy, ports, profiles, active, script_in_manifest):
    """(refusals, plan). `state` is run_page_data.state_from_save of the save read just now."""
    refusals = []
    if copy:
        if ports[0] == REAL_CDP or ports[1] == REAL_CONTROL:
            refusals.append("--copy with the real game's ports")
    else:
        if ports != (REAL_CDP, REAL_CONTROL):
            refusals.append("the real game uses DevTools 9222 and control 12527; anything else needs --copy")
        if not ready:
            refusals.append("docs/finish-procedure.md does not say READY: stop at the World Daemon and tell Ken")
    if nxt not in route:
        refusals.append(f"BitNode {nxt} is not on docs/route.md ({route})")
    if not state["redPill"]:
        refusals.append("The Red Pill is not installed")
    world = state.get("worldDaemon") or {}
    if world.get("required") is None or state["skills"]["hacking"] < world["required"]:
        refusals.append(f"hacking {state['skills']['hacking']} is below the World Daemon's {world.get('required')}")
    if str(state.get("work", "")).startswith("Grafting"):
        refusals.append("a graft is running")
    profile = profile_for(nxt, profiles, active)
    if profile is None:
        refusals.append(f"no single profile covers BitNode {nxt}")
    if script_in_manifest:
        refusals.append(f"{GAME_SCRIPT} is in the manifest; it must stay outside it")
    switch = profile is not None and profile != active
    plan = {"from": state["node"], "next": nxt, "profile": profile, "switch": switch,
            # A startup.js callback in a node the active profile does not cover starts the wrong profile at once.
            "callback": "none" if switch else "startup.js", "resetAt": state["nodeResetAt"]}
    return refusals, plan


def backup_matches(state, backup_state):
    problems = []
    for key in ("node", "nodeResetAt"):
        if backup_state.get(key) != state.get(key):
            problems.append(f"backup {key} {backup_state.get(key)} != {state.get(key)}")
    if not backup_state.get("redPill"):
        problems.append("backup has no Red Pill")
    return problems


def entered(before_state, before_sf, after_state, after_sf, nxt, started_ms):
    """(done, why). Read from the save only: the game never reports success."""
    if after_state["node"] != nxt or after_state["nodeResetAt"] < started_ms - 5000:
        return False, f"save still shows BitNode {after_state['node']} from {after_state['nodeResetAt']}"
    old = before_state["node"]
    gained = after_sf.get(old, 0) - before_sf.get(old, 0)
    capped = old != 12 and before_sf.get(old, 0) >= 3
    if gained != 1 and not capped:
        return False, f"entered BitNode {nxt} but Source-File {old} went {before_sf.get(old, 0)} -> {after_sf.get(old, 0)}"
    return True, f"entered BitNode {nxt}; Source-File {old}.{after_sf.get(old, 0)}"


def approval_entry(node, run, reset_at, today):
    return {"node": node, "run": run, "nodeResetAt": reset_at, "ken": HANDOVER,
            "date": today, "by": "tools/finish_node.py under the handover of 2026-11-22 (AGENTS.md)"}


# ---------------------------------------------------------------------------------------------------------------
# The game
# ---------------------------------------------------------------------------------------------------------------

def log(message):
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] finish: {message}"
    print(line, flush=True)
    try:
        LOG.parent.mkdir(exist_ok=True)
        with LOG.open("a", encoding="utf-8") as out:
            out.write(line + "\n")
    except OSError:
        pass


class Game:
    def __init__(self, cdp, control):
        self.cdp, self.control = cdp, control
        os.environ["BB_CDP_PORT"] = str(cdp)

    def raw_save(self):
        import save_export
        return save_export.read_raw(self.cdp)

    def state(self):
        import run_page_data as rpd
        import save_export
        save = save_export.decode(self.raw_save())
        return rpd.state_from_save(save), sf_levels(save), save

    def ctl(self, req, timeout=30):
        """One request to the Remote API daemon's control channel (as tools/profile.py ctl_call)."""
        import socket
        with socket.create_connection(("127.0.0.1", self.control), timeout=5) as conn:
            conn.settimeout(timeout)
            conn.sendall((json.dumps(req) + "\n").encode())
            buf = b""
            while not buf.endswith(b"\n"):
                chunk = conn.recv(1 << 16)
                if not chunk:
                    break
                buf += chunk
        return json.loads(buf.decode()) if buf else {"ok": False, "error": "daemon closed the connection"}

    def terminal(self, command, settle=4):
        done = subprocess.run([sys.executable, str(TOOLS / "game_terminal.py"), command, "--port", str(self.cdp),
                               "--settle", str(settle)], capture_output=True, text=True, timeout=120)
        return done.returncode == 0, (done.stdout + done.stderr).strip()


def write_backup(raw, node):
    import run_page_data as rpd
    import save_export
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    path = REPO / "saves" / f"pre-finish-bn{node}-{stamp}.json.gz"
    path.parent.mkdir(exist_ok=True)
    path.write_bytes(raw if raw[:2] == b"\x1f\x8b" else gzip.compress(raw))
    return path, rpd.state_from_save(save_export.decode(path.read_bytes()))


def profiles_now():
    out = {}
    for path in sorted((REPO / "profiles").glob("*/profile.json")):
        try:
            out[path.parent.name] = set(json.loads(path.read_text(encoding="utf-8"))["bitnodes"])
        except (OSError, ValueError, KeyError, TypeError):
            continue
    return out


def manifest():
    return json.loads((REPO / "sync_manifest.json").read_text(encoding="utf-8"))


def profile_tests(profile):
    """The profile builds and its tests pass (staged into build/<profile>)."""
    py = sys.executable
    for cmd, cwd in (([py, str(TOOLS / "profile.py"), "build", profile, "--out", str(REPO / "runtime" / f"finish-{profile}-manifest.json")], REPO),
                     ([py, str(TOOLS / "stage.py"), profile], REPO),
                     (["node", "--test"], REPO / "build" / profile)):
        done = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=900)
        if done.returncode != 0:
            return False, f"{' '.join(cmd[1:3])}: " + (done.stdout + done.stderr).strip()[-400:]
    return True, "builds and passes its tests"


def wait_for(game, test, seconds, every=5):
    end = time.time() + seconds
    last = None
    while time.time() < end:
        try:
            last = game.state()
            if test(*last):
                return True, last
        except Exception as error:  # the save can be mid-write
            log(f"save read failed, retrying: {error}")
        time.sleep(every)
    return False, last


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--next", type=int, required=True, dest="nxt")
    ap.add_argument("--go", action="store_true", help="act; without it, preflight only")
    ap.add_argument("--copy", action="store_true", help="a disposable copy on its own ports (rehearsal)")
    ap.add_argument("--cdp-port", type=int, default=REAL_CDP)
    ap.add_argument("--control-port", type=int, default=REAL_CONTROL)
    ap.add_argument("--skip-tests", action="store_true", help="copy only: the profile tests were run already")
    args = ap.parse_args(argv)
    if args.skip_tests and not args.copy:
        ap.error("--skip-tests is for a copy only")

    game = Game(args.cdp_port, args.control_port)
    state, sf_before, _ = game.state()
    active = manifest().get("profile")
    refusals, plan = preflight(
        state=state, nxt=args.nxt, route=route_nodes(ROUTE.read_text(encoding="utf-8")),
        ready=procedure_ready(PROCEDURE.read_text(encoding="utf-8")), copy=args.copy,
        ports=(args.cdp_port, args.control_port), profiles=profiles_now(), active=active,
        script_in_manifest=GAME_SCRIPT in manifest().get("files", {}))
    if plan["profile"] and not refusals and not args.skip_tests:
        ok, why = profile_tests(plan["profile"])
        log(f"profile {plan['profile']}: {why}")
        if not ok:
            refusals.append(f"profile {plan['profile']} fails: {why}")
    log(f"plan {json.dumps(plan)}")
    if refusals:
        for why in refusals:
            log(f"REFUSED: {why}")
        return 2
    if not args.go:
        log("preflight passed; nothing changed (add --go to act)")
        return 0

    PAUSE.write_text("finish_node.py: finishing a BitNode\n", encoding="utf-8")
    try:
        return act(game, args, state, sf_before, plan)
    finally:
        PAUSE.unlink(missing_ok=True)


def act(game, args, state, sf_before, plan):
    path, backup_state = write_backup(game.raw_save(), state["node"])
    problems = backup_matches(state, backup_state)
    if problems:
        log(f"REFUSED: backup {path.name} does not match: {problems}")
        return 2
    log(f"backup {path.name} decoded: BitNode {backup_state['node']}, run stamp {backup_state['nodeResetAt']}, pill installed")

    res = game.ctl({"cmd": "push", "file": "/" + GAME_SCRIPT, "content": SCRIPT.read_text(encoding="utf-8")})
    if not res.get("ok"):
        log(f"STOP: could not push {GAME_SCRIPT}: {res.get('error')}")
        return 1
    started_ms = time.time() * 1000
    cb = plan["callback"]
    ok, out = game.terminal(f'home; run {GAME_SCRIPT} {args.nxt} {cb} {plan["resetAt"]}')
    log(f"ran {GAME_SCRIPT} {args.nxt} callback={cb}: {'typed' if ok else 'NOT typed'}")

    done, last = wait_for(game, lambda s, sf, _save: entered(state, sf_before, s, sf, args.nxt, started_ms)[0], ENTRY_WAIT_S)
    why = entered(state, sf_before, last[0], last[1], args.nxt, started_ms)[1] if last else "no save read"
    if not done:
        res = game.ctl({"cmd": "get", "file": "/" + STATUS_FILE})
        log(f"STOP: not finished after {ENTRY_WAIT_S}s: {why}; script said {res.get('result') if res.get('ok') else res}")
        cleanup(game)
        log(f"the save is unchanged unless the line above says otherwise; backup {path.name}")
        return 1
    new_state = last[0]
    log(f"DONE: {why}, run stamp {new_state['nodeResetAt']}")
    cleanup(game)

    if plan["switch"]:
        env = dict(os.environ, BB_CDP_PORT=str(args.cdp_port))
        done_ = subprocess.run([sys.executable, str(TOOLS / "profile.py"), "switch", plan["profile"], "--live",
                                "--control-port", str(args.control_port)], capture_output=True, text=True, env=env, timeout=600)
        log(f"profile switch to {plan['profile']}: exit {done_.returncode}: {(done_.stdout + done_.stderr).strip()[-300:]}")
        if done_.returncode != 0:
            log("STOP: entered the new BitNode but the profile did not switch; nothing is running there")
            return 1
        ok, out = game.terminal("home; run startup.js")
        log(f"run startup.js: {'typed' if ok else 'NOT typed'}")

    run = new_state["sfLevel"] + 1
    approvals = json.loads(APPROVALS.read_text(encoding="utf-8"))
    entry = approval_entry(new_state["node"], run, new_state["nodeResetAt"], datetime.date.today().isoformat())
    approvals["approved"].append(entry)
    APPROVALS.write_text(json.dumps(approvals, indent=2) + "\n", encoding="utf-8")
    log(f"installs approved for BitNode {entry['node']} run {run} (handover)")

    up, last = wait_for(game, lambda s, _sf, _save: bool(RESIDENTS & set(s["scripts"])) and s["node"] == args.nxt, RESIDENT_WAIT_S, 10)
    log(f"residents {'running' if up else 'NOT running'} in BitNode {args.nxt}: {sorted(last[0]['scripts']) if last else '?'}")
    return 0 if up else 1


def cleanup(game):
    res = game.ctl({"cmd": "delete", "file": "/" + GAME_SCRIPT})
    if not res.get("ok"):
        ok, _ = game.terminal(f"home; rm {GAME_SCRIPT}")
        log(f"removed {GAME_SCRIPT} by terminal: {ok}")
    else:
        log(f"removed {GAME_SCRIPT}")


if __name__ == "__main__":
    sys.exit(main())
