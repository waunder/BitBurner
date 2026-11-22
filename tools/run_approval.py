#!/usr/bin/env python3
"""Has Ken approved installs for the run the game is in? (hands-off test, 2026-11-22)

The answer used to depend on someone creating tools/autoinstall.pause at each new BitNode. Now auto install
asks here before every install and holds in any run not listed in tools/install_approvals.json.

    .venv/bin/python3 tools/run_approval.py      prints the current run's answer
"""
import json
from pathlib import Path

import run_page_data as rpd

APPROVALS = Path(__file__).resolve().parent / "install_approvals.json"
MAX_SF_LEVEL = 3


def load(path=APPROVALS):
    try:
        return json.loads(path.read_text(encoding="utf-8"))["approved"]
    except (OSError, ValueError, KeyError, TypeError):
        return []


def approved(state, entries):
    """(ok, reason) for a run_page_data state. An entry given before entry has no nodeResetAt."""
    node, run = state["node"], state["sfLevel"] + 1
    repeats = node != 12 and state["sfLevel"] >= MAX_SF_LEVEL  # the run number no longer moves
    for entry in entries:
        if entry.get("node") != node or entry.get("run") != run:
            continue
        stamp = entry.get("nodeResetAt")
        if stamp == state["nodeResetAt"] or (stamp is None and not repeats):
            return True, f"BitNode {node} run {run} is approved"
    return False, f"installs are not approved for BitNode {node} run {run}"


def current(reset_at=None, entries=None):
    """Fails closed. `reset_at` must match the save's, so an old save cannot vouch for a new run."""
    try:
        found = rpd.newest_blob(rpd.blob_dir())
        if not found:
            return False, "no autosave on disk to tell which run this is"
        state = rpd.state_from_save(rpd.decode_blob(found[1].read_bytes()))
    except Exception as error:
        return False, f"cannot read the run from the autosave: {error}"
    if reset_at is not None and state["resetAt"] != reset_at:
        return False, "the autosave has not caught up with this cycle"
    return approved(state, load() if entries is None else entries)


if __name__ == "__main__":
    print(current())
