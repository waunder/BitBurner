"""What the run page shows, computed without the page, the daemon or any game script.

The autosave on disk is the truth: it is right on a fresh BitNode, after a kill-all and after an install,
when every status file still holds the last run's values. Status files only add reasons and forecasts,
and only while `fresh` says they belong to this cycle and are recent.

Read-only towards the game: the autosave is opened for reading, and DevTools is not used.
"""
import json
import math
import os
import sys
import zlib
from pathlib import Path

WORLD_DAEMON = "w0r1d_d43m0n"
FRESH_MS = 5 * 60_000
SAVE_LATE_MS = 4 * 60_000
INSTALL_PASS_LATE_MS = 5 * 60_000
SAMPLE_EVERY_MS = 110_000
MAX_POINTS = 600


def blob_dir():
    if sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("APPDATA") or Path.home() / ".config")
    return base / "bitburner" / "IndexedDB" / "file__0.indexeddb.blob"


def newest_blob(folder):
    found = []
    for path in folder.rglob("*"):
        try:
            if path.is_file():
                found.append((path.stat().st_mtime_ns, path))
        except OSError:  # the game replaces the blob at every autosave
            continue
    return max(found) if found else None


def decode_blob(raw):
    """Chromium stores the gzip save behind a short serializer header."""
    at = raw.find(b"\x1f\x8b\x08")
    if at < 0:
        raise ValueError("no gzip stream in the autosave")
    stream = zlib.decompressobj(31)
    text = stream.decompress(raw[at:])
    if not stream.eof:
        raise ValueError("autosave is incomplete (being written)")
    return json.loads(text)


def unwrap(value):
    """Undo the game's {ctor, data} wrappers, JSONMap included."""
    if isinstance(value, dict):
        if "ctor" in value and "data" in value:
            data = unwrap(value["data"])
            return dict(data) if value["ctor"] in ("JSONMap", "Map") else data
        return {k: unwrap(v) for k, v in value.items()}
    if isinstance(value, list):
        return [unwrap(v) for v in value]
    return value


def describe_work(work):
    if not work:
        return "Idle"
    kind = work.get("type")
    if kind == "CRIME":
        return work.get("crimeType") or "Crime"
    if kind == "FACTION":
        return f"{work.get('factionName')} ({work.get('factionWorkType')} work)"
    if kind == "CLASS":
        return f"{work.get('classType')} at {work.get('location')}"
    if kind == "GRAFTING":
        return f"Grafting {work.get('augmentation')}"
    if kind == "RECOVERY":
        return "Shock recovery"
    if kind == "COMPANY":
        return f"Working for {work.get('companyName')}"
    return str(kind or "Idle").replace("_", " ").capitalize()


def split_money(sources):
    pairs = [(k, v) for k, v in (sources or {}).items() if k != "total" and isinstance(v, (int, float))]
    return {k: v for k, v in pairs if v > 0}, {k: -v for k, v in pairs if v < 0}


def state_from_save(save):
    """The page's view of one save: small, and free of script text and game files."""
    data = save["data"]
    p = unwrap(json.loads(data["PlayerSave"]))
    servers = json.loads(data["AllServersSave"])
    home = (servers.get("home") or {}).get("data") or {}
    node = p["bitNodeN"]
    earned, spent = split_money(p.get("moneySourceA"))
    run_earned, run_spent = split_money(p.get("moneySourceB"))
    augs = [a["name"] for a in p.get("augmentations", [])]

    factions = []
    saved_factions = json.loads(data.get("FactionsSave") or "{}")
    for name in p.get("factions", []):
        f = unwrap(saved_factions.get(name) or {})
        factions.append({"name": name, "rep": f.get("playerReputation", 0), "favor": f.get("favor", 0)})
    factions.sort(key=lambda f: -f["rep"])

    gang = None
    if p.get("gang"):
        g = p["gang"]
        all_gangs = unwrap(json.loads(data.get("AllGangsSave") or "{}"))
        ours = all_gangs.get(g.get("facName")) or {}
        tasks = {}
        for member in g.get("members", []):
            task = member.get("task") or "Unassigned"
            tasks[task] = tasks.get(task, 0) + 1
        gang = {"faction": g.get("facName"), "members": len(g.get("members", [])), "respect": g.get("respect"),
                "territory": ours.get("territory"), "power": ours.get("power"), "tasks": tasks}

    cloud = [((servers.get(name) or {}).get("data") or {}).get("maxRam", 0) for name in p.get("purchasedServers", [])]
    world = (servers.get(WORLD_DAEMON) or {}).get("data")
    running = [(r.get("data") or {}) for r in home.get("runningScripts", [])]
    return {
        "savedAt": p.get("lastSave"), "node": node, "sfLevel": (p.get("sourceFiles") or {}).get(node, 0),
        "nodeResetAt": p["lastNodeReset"], "resetAt": p["lastAugReset"],
        "money": p["money"], "skills": p["skills"], "karma": p["karma"], "entropy": p.get("entropy", 0),
        "installed": len(augs), "queued": [a["name"] for a in p.get("queuedAugmentations", [])],
        "redPill": "The Red Pill" in augs, "work": describe_work(p.get("currentWork")),
        "sleeves": [{"task": describe_work(s.get("currentWork")), "shock": s.get("shock", 0), "sync": s.get("sync", 0)}
                    for s in p.get("sleeves", [])],
        "factions": factions, "gang": gang,
        "earned": earned, "spent": spent, "runEarned": run_earned, "runSpent": run_spent,
        "homeRam": home.get("maxRam", 0), "cores": home.get("cpuCores", 1),
        "ramUsed": sum((r.get("ramUsage") or 0) * (r.get("threads") or 1) for r in running),
        "cloud": {"count": len(cloud), "ram": sum(cloud)},
        "scripts": sorted({r.get("filename", "").lstrip("/") for r in running}),
        "worldDaemon": {"required": world.get("requiredHackingSkill"), "rooted": bool(world.get("hasAdminRights"))}
        if world else None,
    }


def sample_of(state):
    """One history point, in the same shape as a compacted metrics_log row."""
    return {"ts": state["savedAt"], "resetAt": state["resetAt"], "money": state["money"],
            "skills": {"hacking": state["skills"].get("hacking")}, "karma": state["karma"],
            "installed": state["installed"], "earned": state["earned"], "spent": state["spent"]}


def wants_sample(last, sample):
    return (not last or sample["resetAt"] != last["resetAt"] or sample["ts"] - last["ts"] >= SAMPLE_EVERY_MS)


def fresh(status, now_ms, reset_at):
    """A status file counts only if it was written in this cycle and recently."""
    ts = (status or {}).get("ts") if isinstance(status, dict) else None
    return isinstance(ts, (int, float)) and ts >= reset_at and now_ms - ts <= FRESH_MS


def run_number(state, target):
    configured = (target or {}).get("run")
    return max(state["sfLevel"] + 1, configured if isinstance(configured, int) else 0)


def daemon_requirement(state, run):
    if state["worldDaemon"]:
        return math.ceil(state["worldDaemon"]["required"])
    # BitNode-12's WorldDaemonDifficulty is 1.02^run; elsewhere it is known once the server exists.
    return math.ceil(3000 * 1.02 ** run) if state["node"] == 12 else None


def route(state, target, rows):
    """run_target.json's steps against the run. A step once reached stays done (installs reset money and levels)."""
    live = {"karma": state["karma"], "installed": state["installed"], "money": state["money"],
            "hacking": state["skills"].get("hacking", 0)}
    seen = [live] + [{"karma": r.get("karma"), "installed": r.get("installed"), "money": r.get("money"),
                      "hacking": (r.get("skills") or {}).get("hacking")} for r in rows]

    def met(point, metric):
        have, need = point.get(metric.get("kind")), metric.get("target")
        if have is None or need is None:
            return False
        return have <= need if need < 0 else have >= need

    joined = {f["name"] for f in state["factions"]}
    world = state["worldDaemon"]
    ready = bool(world and live["hacking"] >= world["required"])
    out = []
    for step in (target or {}).get("steps", []):
        label = step.get("label", "")
        metrics = step.get("metrics") or ([step["metric"]] if step.get("metric") else [])
        done = bool(metrics) and any(all(met(point, m) for m in metrics) for point in seen)
        if label.startswith("Gang") and state["gang"]:
            done = True
        if label.startswith("Daedalus") and "Daedalus" in joined:
            done = True
        if label.startswith("The Red Pill"):
            done = state["redPill"] and ready
        out.append({"label": label, "done": done, "metrics": [
            {"kind": m.get("kind"), "target": m.get("target"), "have": live.get(m.get("kind"))} for m in metrics]})
    return out


def alerts(state, now_ms, connected, paused, install_pass_ms):
    """What is wrong or waits on Ken, most serious first."""
    out = []
    def add(level, title, text):
        out.append({"level": level, "title": title, "text": text})

    late = now_ms - (state["savedAt"] or 0)
    if late > SAVE_LATE_MS:
        add("bad", "The game has stopped saving", f"Last autosave {int(late // 60_000)} min ago. Every number below is that old.")
    if not state["scripts"]:
        add("bad", "Nothing is running", "No script is running on home, so the run is not progressing.")
    world = state["worldDaemon"]
    # The server is in the save from the start of every run; it is reachable only with The Red Pill.
    if world and state["redPill"] and state["skills"].get("hacking", 0) >= world["required"]:
        add("you", "The World Daemon is ready: your call", "The agent will not root or destroy it, or choose the next BitNode.")
    if not connected:
        add("bad", "The Remote API is disconnected", "Scripts can't be updated and status files can't be read. The numbers from the save are still good.")
    if not state["redPill"]:
        if paused:
            add("you", "Auto install is paused", "No augmentation install happens until the pause is lifted.")
        elif install_pass_ms is None or now_ms - install_pass_ms > INSTALL_PASS_LATE_MS:
            add("bad", "Auto install is not running", "Its last pass was over 5 minutes ago.")
    return out


def split_runs(rows, node_reset):
    """(this run, the run before it) from rows of either source. A run begins where installed augs drop."""
    current, cycles = [], {}
    for row in rows:
        ts, reset = row.get("ts"), row.get("resetAt")
        if ts is None or not reset:
            continue
        if reset >= node_reset:
            current.append(row)
        else:
            cycles.setdefault(reset, []).append(row)
    start, before = None, None
    for reset in sorted(cycles):
        counts = [r["installed"] for r in cycles[reset] if r.get("installed") is not None]
        if start is None or (counts and before is not None and max(counts) < before):
            start = reset
        if counts:
            before = max(counts)
    previous = [r for reset, group in cycles.items() if start is not None and reset >= start for r in group]
    by_time = lambda r: r["ts"]
    return sorted(current, key=by_time), sorted(previous, key=by_time), start


def thin(rows, limit=MAX_POINTS):
    """At most about `limit` rows, always keeping each cycle's first and last."""
    if len(rows) <= limit:
        return rows
    step = len(rows) / limit
    keep = {int(i * step) for i in range(limit)} | {len(rows) - 1}
    for i in range(1, len(rows)):
        if rows[i].get("resetAt") != rows[i - 1].get("resetAt"):
            keep |= {i - 1, i}
    return [rows[i] for i in sorted(keep)]
