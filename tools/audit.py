"""Audit every *_status.json in the game: flag scripts that are stale, idle, failing or exited.

Asks "what should be happening that isn't?" rather than "is the money going up?". Prompted by
2026-11-16: sleeve_buyer.js had exited at every start of BN6 ("not BitNode 10") for two days and
nothing read its status, so no sleeve augmentation was ever bought.

Usage: .venv/Scripts/python.exe tools/audit.py [--all] [--stale-min 15]
Prints one line per flagged status file (and every file with --all). Exit 0 always; read-only.
"""
import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PY = sys.executable
# Status files that are written once or rarely by design: never flagged as stale.
ONE_SHOT = {"maintenance_launch_status.json", "sync_from_github_status.json", "aug_install_status.json",
            "dnet_restart_status.json", "tail_position_gang-status.json"}
# Words in idle/reason/error fields that mean "not doing its job".
BAD = re.compile(r"not BitNode|unavailable|exit|refused|error|failed|cannot|stopped|disabled", re.I)


def ctl(*args, timeout=30):
    out = subprocess.run([PY, str(ROOT / "tools" / "bb_remote.py"), *args], capture_output=True, text=True,
                         encoding="utf-8", timeout=timeout).stdout
    return json.loads(out)


def status_files():
    out = subprocess.run([PY, str(ROOT / "tools" / "game_terminal.py"), "home; ls --grep _status.json", "--settle", "2"],
                         capture_output=True, text=True, encoding="utf-8", timeout=60).stdout
    try:
        out = "\n".join(json.loads(out).get("output", []))
    except Exception:
        pass
    names = set(re.findall(r"(?<![\w\-])[\w\-]+_status\.json", out))
    return sorted(names)


def running_scripts():
    out = subprocess.run([PY, str(ROOT / "tools" / "game_terminal.py"), "home; ps", "--settle", "2"],
                         capture_output=True, text=True, encoding="utf-8", timeout=60).stdout
    try:
        out = "\n".join(json.loads(out).get("output", []))
    except Exception:
        pass
    return {m.split("/")[-1] for m in re.findall(r"\) ([\w\-/.]+\.js)", out)}


def findings(name, data, now, stale_min, running):
    flags = []
    ts = data.get("ts") if isinstance(data, dict) else None
    # Stale only matters when the writer is running: a running script that stopped writing is a fault.
    # Files left by finished or event-driven scripts are not (their last write is their last event).
    writer = name.replace("_status.json", ".js")
    if isinstance(ts, (int, float)) and name not in ONE_SHOT and writer in running:
        age = (now - ts) / 60000
        if age > stale_min:
            flags.append(f"stale {age:.0f}m")
    if not isinstance(data, dict):
        return flags
    if data.get("ok") is False:
        flags.append("ok:false")
    for key in ("idle", "error", "lastError", "reason", "available"):
        value = data.get(key)
        if key == "available" and value is False:
            flags.append("unavailable")
        elif isinstance(value, str) and value and (key in ("idle", "error", "lastError") or BAD.search(value)):
            flags.append(f"{key}: {value[:90]}")
    # Per-row errors (sleeve_status rows, for example).
    for list_key in ("sleeves", "members", "rows"):
        for row in data.get(list_key, []) if isinstance(data.get(list_key), list) else []:
            if isinstance(row, dict) and row.get("error"):
                flags.append(f"{list_key}[{row.get('index', '?')}] {str(row['error'])[:70]}")
    return flags


def allocation_findings(money, manager, gap=0.5):
    """Result checks across scripts: RAM earning far less per TB than another use of it.

    Prompted by 2026-11-18: MCP made $0.2-0.7m/s per TB on ~21TB while stacks made $1-5m/s, and
    silver-helix (est $55m/s) sat unstacked under a 60% fleet share. Every file was healthy, so
    the per-file checks above said nothing; Ken spotted it from the money panel.
    """
    flags = []
    yields = {y.get("label"): y.get("value") for y in (money or {}).get("yields", []) if isinstance(y.get("value"), (int, float))}
    mcp = yields.pop("MCP targets", None)
    if mcp is not None and yields:
        low = min(yields.values())
        if mcp < gap * low:
            flags.append(f"MCP earns ${mcp / 1e6:.2f}m/s per TB, under {gap:.0%} of the weakest stack (${low / 1e6:.2f}m/s): give stacks more of the fleet?")
    planned = {p.get("target") for p in (manager or {}).get("plan", [])}
    floor = mcp if mcp is not None else 0
    for est in (manager or {}).get("estimates", []):
        if est.get("target") not in planned and est.get("perTB", 0) > 2 * floor and est.get("perSec", 0) > 0:
            flags.append(f"{est['target']} not stacked: est ${est['perSec'] / 1e6:.1f}m/s at ${est['perTB'] / 1e6:.2f}m/s per TB, needs {est.get('ramNeeded', 0) / 1024:.0f}TB")
            break
    return flags


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--all", action="store_true", help="print healthy files too")
    parser.add_argument("--stale-min", type=float, default=15)
    args = parser.parse_args()
    now = time.time() * 1000
    names = status_files()
    running = running_scripts()
    if not names:
        print("audit: could not list status files (game terminal unreachable?)")
        return
    flagged = 0
    for name in names:
        try:
            raw = ctl("ctl-get", name)
            data = json.loads(raw["result"]) if raw.get("ok") else None
        except Exception as error:
            print(f"?  {name}: unreadable ({error})")
            flagged += 1
            continue
        flags = findings(name, data, now, args.stale_min, running) if data is not None else ["missing"]
        if flags:
            flagged += 1
            print(f"!  {name}: " + "; ".join(flags))
        elif args.all:
            print(f"ok {name}")
    print(f"audit: {flagged} of {len(names)} status files flagged")
    loaded = {}
    for name in ("money_status.json", "stack_manager_status.json"):
        try:
            raw = ctl("ctl-get", name)
            loaded[name] = json.loads(raw["result"]) if raw.get("ok") else None
        except Exception:
            loaded[name] = None
    results = allocation_findings(loaded["money_status.json"], loaded["stack_manager_status.json"])
    for line in results:
        print(f"$  {line}")
    print(f"audit: {len(results)} allocation findings")


if __name__ == "__main__":
    main()
