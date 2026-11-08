"""Measured rates from the game's metrics time series (metrics_logger.js).

Reads runtime/metrics_log.txt: one JSON sample every 5 minutes. Times print in
Ken's local time, BC time (UTC-7 year-round; BC no longer changes clocks), the same as the PC
clock. Rates are least-squares
slopes over the samples in a window, within one install cycle only.

    python tools/metrics.py pull                      fetch the log via the bb_remote daemon
    python tools/metrics.py summary [--window MIN]    latest values and rates this cycle
    python tools/metrics.py cycles                    one row per install cycle
    python tools/metrics.py trend [--windows N] [--window MIN]
                                                      DECELERATING/STEADY/ACCELERATING over consecutive windows
    python tools/metrics.py rates --from ISO --to ISO [--before MIN]
                                                      experiment window vs the window before it
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
LOG = REPO / "runtime" / "metrics_log.txt"
PACIFIC = timezone(timedelta(hours=-7), "PT")  # BC time, UTC-7 year-round; matches the PC clock
HOUR_MS = 3_600_000
ROLL_MS = 30 * 60_000


# ---------------------------------------------------------------- loading

def parse(text: str) -> list[dict]:
    """Samples sorted by ts; malformed lines and lines without ts are skipped."""
    out = []
    for line in text.splitlines():
        try:
            s = json.loads(line)
        except ValueError:
            continue
        if isinstance(s, dict) and isinstance(s.get("ts"), (int, float)):
            out.append(s)
    return sorted(out, key=lambda s: s["ts"])


def load(path: Path = LOG) -> list[dict]:
    return parse(path.read_text(encoding="utf-8")) if path.exists() else []


def cycles_of(samples: list[dict]) -> list[list[dict]]:
    """Samples grouped by resetAt, in time order (samples without resetAt are dropped)."""
    groups: dict[float, list[dict]] = {}
    for s in samples:
        if s.get("resetAt"):
            groups.setdefault(s["resetAt"], []).append(s)
    return [groups[k] for k in sorted(groups)]


def current_cycle(samples: list[dict]) -> list[dict]:
    """Samples after the latest resetAt."""
    groups = cycles_of(samples)
    return [s for s in groups[-1] if s["ts"] >= s["resetAt"]] if groups else []


# ---------------------------------------------------------------- maths

def get(s: dict, path: str):
    """Dotted lookup: get(s, 'factionRep.NiteSec'). Faction names may contain dots, so split once."""
    head, _, rest = path.partition(".")
    v = s.get(head)
    if rest:
        v = v.get(rest) if isinstance(v, dict) else None
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def slope_per_hour(samples: list[dict], path: str) -> float | None:
    """Least-squares slope of `path` per hour; None with fewer than 2 points."""
    pts = [(s["ts"] / HOUR_MS, get(s, path)) for s in samples]
    pts = [(t, v) for t, v in pts if v is not None]
    if len(pts) < 2:
        return None
    mt = sum(t for t, _ in pts) / len(pts)
    mv = sum(v for _, v in pts) / len(pts)
    den = sum((t - mt) ** 2 for t, _ in pts)
    return None if den == 0 else sum((t - mt) * (v - mv) for t, v in pts) / den


def mean(samples: list[dict], path: str) -> float | None:
    vals = [v for v in (get(s, path) for s in samples) if v is not None]
    return sum(vals) / len(vals) if vals else None


def factions(samples: list[dict]) -> list[str]:
    names: set[str] = set()
    for s in samples:
        names.update((s.get("factionRep") or {}).keys())
    return sorted(names)


def window_rates(samples: list[dict]) -> dict:
    """Rates over a window, restricted to the cycle of its last sample."""
    if not samples:
        return {"n": 0}
    reset = samples[-1].get("resetAt")
    used = [s for s in samples if s.get("resetAt") == reset]
    rep = {f: slope_per_hour(used, f"factionRep.{f}") for f in factions(used)}
    return {
        "n": len(used),
        "crossesInstall": len(used) < len(samples),
        "start": used[0]["ts"], "end": used[-1]["ts"],
        "repPerHour": {f: r for f, r in rep.items() if r is not None},
        "hackExpPerHour": slope_per_hour(used, "exp.hacking"),
        "karmaPerHour": slope_per_hour(used, "karma"),
        "cashPerHour": slope_per_hour(used, "money"),
        "incomePerHour": slope_per_hour(used, "income.total"),
        "hackingPerHour": slope_per_hour(used, "skills.hacking"),
        "mcpRate": mean(used, "mcpRate"),
        "mcpAvgRate": mean(used, "mcpAvgRate"),
        "sharePower": mean(used, "sharePower"),
    }


def best_rep_rate(samples: list[dict], end_index: int) -> float | None:
    """Best faction rep/h over the ROLL_MS window ending at samples[end_index]."""
    end = samples[end_index]["ts"]
    win = [s for s in samples[: end_index + 1] if s["ts"] >= end - ROLL_MS]
    if len(win) < 2 or end - win[0]["ts"] < ROLL_MS * 0.8:
        return None
    rates = [slope_per_hour(win, f"factionRep.{f}") for f in factions(win)]
    rates = [r for r in rates if r is not None]
    return max(rates) if rates else None


def rebuild_hours(prev: list[dict], cur: list[dict]) -> dict:
    """Hours from install until hacking level and best 30-min rep rate regain prev's final values."""
    out = {"hacking": None, "repRate": None, "both": None}
    if not prev or not cur:
        return out
    target_hack = get(prev[-1], "skills.hacking")
    target_rate = best_rep_rate(prev, len(prev) - 1)
    start = cur[0]["resetAt"]
    for i, s in enumerate(cur):
        h = (s["ts"] - start) / HOUR_MS
        if out["hacking"] is None and target_hack is not None and (get(s, "skills.hacking") or 0) >= target_hack:
            out["hacking"] = h
        if out["repRate"] is None and target_rate is not None:
            r = best_rep_rate(cur, i)
            if r is not None and r >= target_rate:
                out["repRate"] = h
    if out["hacking"] is not None and out["repRate"] is not None:
        out["both"] = max(out["hacking"], out["repRate"])
    return out


def cycle_rows(samples: list[dict]) -> list[dict]:
    groups = cycles_of(samples)
    rows = []
    for i, cyc in enumerate(groups):
        nxt = groups[i + 1] if i + 1 < len(groups) else None
        first, last = cyc[0], cyc[-1]
        start = first["resetAt"]
        end = nxt[0]["resetAt"] if nxt else last["ts"]
        rep = {f: v for f in factions(cyc) if (v := get(last, f"factionRep.{f}")) is not None}
        favor = None
        if nxt:
            favor = {}
            for f in sorted(set(first.get("favor") or {}) | set(nxt[0].get("favor") or {})):
                a, b = get(first, f"favor.{f}"), get(nxt[0], f"favor.{f}")
                if a is not None and b is not None and b - a > 0.005:
                    favor[f] = b - a
        inst = None
        if nxt and get(nxt[0], "installedCount") is not None and get(first, "installedCount") is not None:
            inst = get(nxt[0], "installedCount") - get(first, "installedCount")
        rows.append({
            "start": start, "hours": (end - start) / HOUR_MS, "open": nxt is None,
            "coverage": (last["ts"] - first["ts"]) / max(end - start, 1),
            "rebuild": rebuild_hours(groups[i - 1] if i else [], cyc),
            "hasPrev": i > 0,
            "rep": rep, "favorBanked": favor, "installedDelta": inst,
        })
    return rows


# ---------------------------------------------------------------- trend

TREND_PCT = 10.0


def work_faction(samples: list[dict]) -> tuple[str | None, bool]:
    """The window's most-sampled work faction, and whether the work faction changed within it."""
    names = [(s.get("work") or {}).get("faction") for s in samples]
    named = [n for n in names if n]
    if not named:
        return None, len(set(names)) > 1
    top = max(set(named), key=named.count)
    return top, len(set(names)) > 1


def flag(values: list[float | None], switches: list[bool] | None = None, pct: float = TREND_PCT) -> tuple[str, list[float | None]]:
    """DECELERATING / ACCELERATING when the last two window-to-window changes both
    fall / rise by more than pct; SWITCH when either comparison spans a faction switch."""
    changes: list[float | None] = []
    for i in range(1, len(values)):
        a, b = values[i - 1], values[i]
        if switches and (switches[i - 1] or switches[i]):
            changes.append(None)
        elif a is None or b is None or a == 0:
            changes.append(None)
        else:
            changes.append((b - a) / abs(a) * 100)
    last = changes[-2:]
    if switches and any(switches[-3:]):
        return "SWITCH", changes
    if len(last) < 2 or any(c is None for c in last):
        return "n/a", changes
    if all(c < -pct for c in last):
        return "DECELERATING", changes
    if all(c > pct for c in last):
        return "ACCELERATING", changes
    return "STEADY", changes


def trend(samples: list[dict], windows: int = 3, window_min: float = 60) -> dict:
    """Consecutive windows ending at the latest sample, this cycle only."""
    cyc = current_cycle(samples)
    if not cyc:
        return {"windows": [], "metrics": {}}
    span = window_min * 60_000
    end = cyc[-1]["ts"]
    wins = []
    for k in range(windows, 0, -1):
        lo, hi = end - k * span, end - (k - 1) * span
        w = [s for s in cyc if lo < s["ts"] <= hi]
        wins.append(w if len(w) >= 2 and lo >= cyc[0]["resetAt"] else [])
    metrics: dict[str, dict] = {}

    def plain(name, fn, judged=True):
        vals = [fn(w) if w else None for w in wins]
        f, ch = flag(vals) if judged else ("context", flag(vals)[1])
        metrics[name] = {"values": vals, "changes": ch, "flag": f}

    plain("cash/h", lambda w: slope_per_hour(w, "money"))
    plain("MCP", lambda w: mean(w, "mcpRate"))
    plain("hackExp/h", lambda w: slope_per_hour(w, "exp.hacking"))
    plain("lvl/h", lambda w: slope_per_hour(w, "skills.hacking"), judged=False)

    # Work faction: rep only grows for the faction worked, so compare same-faction windows.
    work = [work_faction(w) if w else (None, False) for w in wins]
    vals, sw = [], []
    for i, (fac, changed) in enumerate(work):
        vals.append(slope_per_hour(wins[i], f"factionRep.{fac}") if fac else None)
        sw.append(changed or (i > 0 and fac is not None and work[i - 1][0] is not None and fac != work[i - 1][0]))
    f, ch = flag(vals, sw)
    metrics["rep work"] = {"values": vals, "changes": ch, "flag": f, "faction": work[-1][0], "switches": sw}

    best, bvals, bsw = [], [], []
    for i, w in enumerate(wins):
        rates = {fac: r for fac in factions(w) if (r := slope_per_hour(w, f"factionRep.{fac}")) is not None} if w else {}
        top = max(rates, key=rates.get) if rates else None
        best.append(top)
        bvals.append(rates.get(top) if top else None)
        bsw.append(i > 0 and top is not None and best[i - 1] is not None and top != best[i - 1])
    f, ch = flag(bvals, bsw)
    metrics["rep best"] = {"values": bvals, "changes": ch, "flag": f, "faction": best[-1], "switches": bsw}
    return {"windows": [(w[0]["ts"], w[-1]["ts"]) if w else None for w in wins], "windowMin": window_min, "metrics": metrics}


def trend_line(t: dict) -> str:
    if not t["metrics"]:
        return "trend: no samples since the latest install"
    parts = []
    per_h = 60 / t["windowMin"]
    for name, m in t["metrics"].items():
        label = f"{name} {m['faction']}" if m.get("faction") else name
        vals = ">".join(num(v) for v in m["values"])
        ch = ",".join("--" if c is None else f"{c * per_h:+.0f}%" for c in m["changes"])
        parts.append(f"{label} {vals} ({ch}/h) {m['flag']}")
    return f"trend {len(t['windows'])}x{t['windowMin']:g}m: " + " | ".join(parts)


# ---------------------------------------------------------------- formatting

def pt(ms: float) -> str:
    return datetime.fromtimestamp(ms / 1000, PACIFIC).strftime("%Y-%m-%d %H:%M PT")


def parse_time(text: str) -> float:
    """ISO time in ms; a time without an offset is Pacific."""
    d = datetime.fromisoformat(text)
    if d.tzinfo is None:
        d = d.replace(tzinfo=PACIFIC)
    return d.timestamp() * 1000


def num(v: float | None, digits: int = 3) -> str:
    if v is None:
        return "--"
    a = abs(v)
    for div, suf in ((1e15, "q"), (1e12, "t"), (1e9, "b"), (1e6, "m"), (1e3, "k")):
        if a >= div:
            return f"{v / div:.{digits}g}{suf}"
    return f"{v:.{digits}g}"


def hours(v: float | None, known: bool = True) -> str:
    if not known:
        return "n/a"
    return "not yet" if v is None else f"{v:.2f}h"


def rates_lines(r: dict, label: str) -> list[str]:
    if not r.get("n"):
        return [f"{label}: no samples"]
    head = f"{label}: {pt(r['start'])} .. {pt(r['end'])}, {r['n']} samples"
    if r["crossesInstall"]:
        head += " (crosses an install: earlier cycle dropped)"
    rep = ", ".join(f"{f} {num(v)}" for f, v in sorted(r["repPerHour"].items(), key=lambda kv: -kv[1]) if abs(v) >= 1)
    return [
        head,
        f"  rep/h: {rep or 'none'}",
        f"  hackExp/h {num(r['hackExpPerHour'])}  hacking lvl/h {num(r['hackingPerHour'])}  karma/h {num(r['karmaPerHour'])}",
        f"  cash/h {num(r['cashPerHour'])}  income/h {num(r['incomePerHour'])}  MCP rate {num(r['mcpRate'])}/s avg {num(r['mcpAvgRate'])}/s  share {num(r['sharePower'])}",
    ]


def summary_text(samples: list[dict], window_min: float, now_ms: float | None = None) -> str:
    cyc = current_cycle(samples)
    if not cyc:
        return "metrics: no samples since the latest install"
    last = cyc[-1]
    now_ms = now_ms if now_ms is not None else datetime.now(timezone.utc).timestamp() * 1000
    sk = last.get("skills") or {}
    work = last.get("work") or {}
    where = work.get("faction") or work.get("company") or work.get("detail") or ""
    lines = [
        f"latest {pt(last['ts'])} (age {(now_ms - last['ts']) / 60000:.0f} min), cycle since {pt(last['resetAt'])}"
        f" ({(last['ts'] - last['resetAt']) / HOUR_MS:.1f}h), {len(cyc)} samples",
        f"  money {num(get(last, 'money'))}  hacking {sk.get('hacking')}  str/def/dex/agi {sk.get('strength')}/{sk.get('defense')}/"
        f"{sk.get('dexterity')}/{sk.get('agility')}  cha {sk.get('charisma')}  karma {num(get(last, 'karma'))}  {last.get('city')}",
        f"  work {work.get('type', 'none')} {where}: {last.get('reason') or '--'}",
        f"  installed {last.get('installedCount')} queued {last.get('queuedCount')} verdict {last.get('verdict')}"
        f"  share {num(get(last, 'sharePower'))}  RAM {num(get(last, 'ramUsed'))}/{num(get(last, 'ramMax'))} GB",
    ]
    if last.get("stale"):
        lines.append(f"  stale sources (age s): {json.dumps(last['stale'])}")
    win = [s for s in cyc if s["ts"] >= last["ts"] - window_min * 60_000]
    lines += rates_lines(window_rates(win), f"rates over last {window_min:g} min")
    lines.append(trend_line(trend(samples)))
    return "\n".join(lines)


def cycles_text(samples: list[dict]) -> str:
    rows = cycle_rows(samples)
    if not rows:
        return "metrics: no samples"
    out = []
    for r in rows:
        rb = r["rebuild"]
        status = "open" if r["open"] else "closed"
        out.append(
            f"{pt(r['start'])}  {r['hours']:.2f}h {status}, logged {r['coverage'] * 100:.0f}%  installed +"
            f"{'--' if r['installedDelta'] is None else r['installedDelta']}  rebuild hacking {hours(rb['hacking'], r['hasPrev'])}"
            f" repRate {hours(rb['repRate'], r['hasPrev'])} both {hours(rb['both'], r['hasPrev'])}"
        )
        rep = ", ".join(f"{f} {num(v)}" for f, v in sorted(r["rep"].items(), key=lambda kv: -kv[1]) if v >= 1)
        out.append(f"  rep earned: {rep or 'none'}")
        if r["favorBanked"] is None:
            out.append("  favor banked: pending (cycle open)")
        else:
            fav = ", ".join(f"{f} +{v:.1f}" for f, v in sorted(r["favorBanked"].items(), key=lambda kv: -kv[1]))
            out.append(f"  favor banked: {fav or 'none'}")
    return "\n".join(out)


def rates_text(samples: list[dict], start: float, end: float, before_min: float | None) -> str:
    after = [s for s in samples if start <= s["ts"] <= end]
    lines = rates_lines(window_rates(after), "after")
    span = (end - start) if before_min is None else before_min * 60_000
    if span > 0:
        before = [s for s in samples if start - span <= s["ts"] < start]
        lines = rates_lines(window_rates(before), "before") + lines
    return "\n".join(lines)


# ---------------------------------------------------------------- commands

def pull(path: Path = LOG) -> int:
    cmd = [sys.executable, str(REPO / "tools" / "bb_remote.py"), "ctl-get", "metrics_log.txt"]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    try:
        result = json.loads(proc.stdout)
    except ValueError:
        print(f"pull failed: {proc.stdout.strip() or proc.stderr.strip()}", file=sys.stderr)
        return 1
    if not result.get("ok") or not isinstance(result.get("result"), str):
        print(f"pull failed: {result.get('error') or result}", file=sys.stderr)
        return 1
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(result["result"].encode("utf-8"))
    samples = parse(result["result"])
    tail = f", latest {pt(samples[-1]['ts'])}" if samples else ""
    print(f"pulled {len(samples)} samples to {path.relative_to(REPO)}{tail}")
    return 0


def main(argv: list[str] | None = None) -> int:
    # Controller reasons carry arrows; a piped Windows console is cp1252.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--log", type=Path, default=LOG)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("pull")
    sp = sub.add_parser("summary")
    sp.add_argument("--window", type=float, default=60, help="minutes (default 60)")
    sub.add_parser("cycles")
    sp = sub.add_parser("trend")
    sp.add_argument("--windows", type=int, default=3)
    sp.add_argument("--window", type=float, default=60, help="minutes per window (default 60)")
    sp = sub.add_parser("rates")
    sp.add_argument("--from", dest="start", required=True, help="ISO time; no offset means Pacific")
    sp.add_argument("--to", dest="end", required=True)
    sp.add_argument("--before", type=float, default=None, help="baseline minutes before --from (default: same length; 0: none)")
    args = p.parse_args(argv)
    if args.cmd == "pull":
        return pull(args.log)
    samples = load(args.log)
    if args.cmd == "summary":
        print(summary_text(samples, args.window))
    elif args.cmd == "cycles":
        print(cycles_text(samples))
    elif args.cmd == "trend":
        print(trend_line(trend(samples, args.windows, args.window)))
    else:
        print(rates_text(samples, parse_time(args.start), parse_time(args.end), args.before))
    return 0


if __name__ == "__main__":
    sys.exit(main())
