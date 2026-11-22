#!/usr/bin/env python3
"""Alerts to Ken's iPhone by Pushover (Ken, 2026-11-22: "Let's do each step, including the iphone notification").

    .venv/bin/python3 tools/notify.py --setup            # asks for the two keys, stores them, sends a test
    .venv/bin/python3 tools/notify.py "one line"         # send one message (check-ins use this)
    .venv/bin/python3 tools/notify.py --alarms           # one forwarding pass over the run page's alarms

Keys live in ~/.config/bitburner/pushover.json (mode 600), never in this public repo. Messages carry game status
only. The outage watchdog (tools/watchdog_mac.py) runs the forwarding pass every 30 s, so no new service is needed:
an alarm is sent once it has lasted SETTLE_S, again every REPEAT_S while it lasts, and a short "cleared" when it
goes. At most HOURLY_CAP messages an hour. Log runtime/notify.log; state runtime/notify_state.json.
"""
from __future__ import annotations

import argparse
import getpass
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
KEYS = Path.home() / ".config" / "bitburner" / "pushover.json"
STATE = REPO / "runtime" / "notify_state.json"
LOG = REPO / "runtime" / "notify.log"
RUN_PAGE = "http://127.0.0.1:8790/api/state"
API = "https://api.pushover.net/1/messages.json"
SETTLE_S = 180
REPEAT_S = 6 * 3600
PAGE_DOWN_S = 600
HOURLY_CAP = 8


def log(message):
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] notify: {message}"
    print(line, flush=True)
    try:
        LOG.parent.mkdir(exist_ok=True)
        with LOG.open("a", encoding="utf-8") as out:
            out.write(line + "\n")
    except OSError:
        pass


def keys():
    try:
        data = json.loads(KEYS.read_text(encoding="utf-8"))
        return data["token"], data["user"]
    except (OSError, ValueError, KeyError, TypeError):
        return None


def send(message, title="Bitburner", priority=0):
    """(ok, detail). Never raises."""
    found = keys()
    if not found:
        return False, f"no keys at {KEYS}"
    token, user = found
    body = urllib.parse.urlencode({"token": token, "user": user, "title": title, "message": message[:1000],
                                   "priority": priority}).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(API, data=body), timeout=15) as reply:
            data = json.loads(reply.read().decode())
        return data.get("status") == 1, "sent" if data.get("status") == 1 else str(data)[:200]
    except Exception as error:  # network, HTTP 4xx with a reason
        detail = getattr(error, "read", lambda: b"")()
        return False, f"{error!r} {detail[:200]!r}"


# ---------------------------------------------------------------------------------------------------------------
# Forwarding (pure part: tools/tests/test_notify.py)
# ---------------------------------------------------------------------------------------------------------------

def plan(alerts, page_ok, now_s, state):
    """(messages, new_state). messages: [(title, text, priority)]. alerts: the run page's [{level, title, text}]."""
    state = {"seen": dict(state.get("seen", {})), "sent": list(state.get("sent", [])),
             "page_down_since": state.get("page_down_since")}
    out = []
    if not page_ok:  # the other alarms stay as they were: unknown is not cleared
        since = state["page_down_since"] = state["page_down_since"] or now_s
        alerts_now = {"The run page is not answering": {"level": "bad", "text": "No alarm can be read from it.",
                                                        "settled": True}} if now_s - since >= PAGE_DOWN_S else {}
    else:
        state["page_down_since"] = None
        alerts_now = {a["title"]: a for a in alerts}
    seen = state["seen"]
    for title, alert in alerts_now.items():
        entry = seen.get(title) or {"first_s": now_s, "sent_s": None}
        wait = 0 if alert["level"] == "you" or alert.get("settled") else SETTLE_S
        due = entry["sent_s"] is None and now_s - entry["first_s"] >= wait
        again = entry["sent_s"] is not None and now_s - entry["sent_s"] >= REPEAT_S
        if due or again:
            out.append((title, alert.get("text", ""), 1 if alert["level"] == "you" else 0))
            entry = dict(entry, sent_s=now_s)
        seen[title] = entry
    if page_ok:
        for title in [t for t in seen if t not in alerts_now]:
            if seen[title].get("sent_s") is not None:
                out.append(("Cleared: " + title, "", -1))
            del seen[title]
    hour = [t for t in state["sent"] if now_s - t < 3600]
    room = max(0, HOURLY_CAP - len(hour))
    if len(out) > room:
        dropped = len(out) - room
        out = out[:room]
        if out:
            out[-1] = (out[-1][0], out[-1][1] + f" ({dropped} more held: hourly cap)", out[-1][2])
    state["sent"] = hour + [now_s] * len(out)
    return out, state


def read_page():
    try:
        with urllib.request.urlopen(RUN_PAGE, timeout=10) as reply:
            return True, json.loads(reply.read().decode()).get("alerts") or []
    except Exception:
        return False, []


def alarm_pass(now_s=None):
    """One forwarding pass. Never raises. Does nothing until the keys exist."""
    if not keys():
        return
    try:
        state = json.loads(STATE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        state = {}
    try:
        ok, alerts = read_page()
        messages, state = plan(alerts, ok, now_s or time.time(), state)
        for title, text, priority in messages:
            sent, detail = send(text or title, title=title, priority=priority)
            log(f"{'sent' if sent else 'NOT sent'} [{priority}] {title}: {detail}")
        STATE.write_text(json.dumps(state), encoding="utf-8")
    except Exception as error:
        log(f"pass error: {error!r}")


def setup():
    print("Pushover keys, from pushover.net. They are stored only on this Mac, in", KEYS)
    user = getpass.getpass("Your User Key (input hidden): ").strip()
    token = getpass.getpass("The application's API Token (input hidden): ").strip()
    if not (user and token):
        sys.exit("both keys are needed; nothing stored")
    KEYS.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(KEYS, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as out:
        json.dump({"token": token, "user": user}, out)
    ok, detail = send("Alerts from the Bitburner farm will arrive here.", title="Bitburner: test")
    print("test message", "sent: check your iPhone" if ok else f"FAILED: {detail}")
    sys.exit(0 if ok else 1)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("message", nargs="?")
    ap.add_argument("--setup", action="store_true")
    ap.add_argument("--alarms", action="store_true")
    ap.add_argument("--priority", type=int, default=0)
    args = ap.parse_args()
    if args.setup:
        setup()
    elif args.alarms:
        alarm_pass()
    elif args.message:
        ok, detail = send(args.message, priority=args.priority)
        log(f"{'sent' if ok else 'NOT sent'}: {args.message[:120]}: {detail}")
        sys.exit(0 if ok else 1)
    else:
        ap.error("a message, --setup or --alarms")


if __name__ == "__main__":
    main()
