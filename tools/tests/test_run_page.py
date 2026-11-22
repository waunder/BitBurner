"""The run page's data: the save is the truth, and stale status files never pass as live."""
import gzip
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import run_page_data as rpd  # noqa: E402

NODE_RESET = 10_000_000


def save(world=None, scripts=("mcp.js",), hacking=10, pill=False):
    player = {"ctor": "PlayerObject", "data": {
        "bitNodeN": 12, "sourceFiles": {"ctor": "JSONMap", "data": [[12, 1]]},
        "lastNodeReset": NODE_RESET, "lastAugReset": NODE_RESET, "lastSave": NODE_RESET + 60_000,
        "money": 500, "karma": -3, "skills": {"hacking": hacking}, "augmentations": [{"name": "NeuroFlux Governor"}] + ([{"name": "The Red Pill"}] if pill else []),
        "currentWork": {"ctor": "CrimeWork", "data": {"type": "CRIME", "crimeType": "Mug"}},
        "moneySourceA": {"ctor": "MoneySourceTracker", "data": {"hacking": 9, "servers": -4, "total": 5}},
    }}
    servers = {"home": {"data": {"maxRam": 64, "runningScripts": [
        {"data": {"filename": s, "ramUsage": 17, "threads": 1}} for s in scripts]}}}
    if world:
        servers[rpd.WORLD_DAEMON] = {"data": {"requiredHackingSkill": world}}
    return {"data": {"PlayerSave": json.dumps(player), "AllServersSave": json.dumps(servers)}}


class RunPage(unittest.TestCase):
    def test_blob_with_header_decodes_and_a_partial_one_is_refused(self):
        raw = b"\xff\x15\xfe" + bytes(19) + gzip.compress(json.dumps({"data": 1}).encode())
        self.assertEqual(rpd.decode_blob(raw), {"data": 1})
        with self.assertRaises(ValueError):
            rpd.decode_blob(raw[:-5])

    def test_state_comes_from_the_save(self):
        s = rpd.state_from_save(save())
        self.assertEqual((s["node"], s["sfLevel"], s["work"], s["earned"], s["spent"], s["ramUsed"]),
                         (12, 1, "Mug", {"hacking": 9}, {"servers": 4}, 17))
        self.assertEqual(rpd.run_number(s, {"run": 1}), 2)  # a target left from run 1 does not win
        self.assertEqual(rpd.daemon_requirement(s, 2), 3122)

    def test_status_from_the_last_cycle_or_too_old_is_not_fresh(self):
        now = NODE_RESET + 600_000
        self.assertFalse(rpd.fresh({"ts": NODE_RESET - 1}, NODE_RESET + 1000, NODE_RESET))
        self.assertFalse(rpd.fresh({"ts": NODE_RESET + 1}, now, NODE_RESET))
        self.assertTrue(rpd.fresh({"ts": now - 1000}, now, NODE_RESET))

    def test_runs_split_where_installed_drops(self):
        rows = [{"ts": t + 1, "resetAt": t, "installed": n} for t, n in
                ((1, 70), (2, 77), (3, 1), (4, 9), (NODE_RESET, 1))]
        current, previous, start = rpd.split_runs(rows, NODE_RESET)
        self.assertEqual(([r["resetAt"] for r in current], [r["resetAt"] for r in previous], start),
                         ([NODE_RESET], [3, 4], 3))

    def test_a_run_starts_even_if_its_first_sample_has_the_last_runs_count(self):
        rows = [{"ts": 2, "resetAt": 1, "installed": 86}, {"ts": 4, "resetAt": 3, "installed": 86},
                {"ts": 5, "resetAt": 3, "installed": 1}]
        self.assertEqual(rpd.split_runs(rows, NODE_RESET)[2], 3)

    def test_a_step_reached_stays_done(self):
        target = {"steps": [{"label": "Cash", "metric": {"kind": "money", "target": 1000}}]}
        s = rpd.state_from_save(save())
        self.assertFalse(rpd.route(s, target, [])[0]["done"])
        self.assertTrue(rpd.route(s, target, [{"money": 2000}])[0]["done"])

    def test_alerts(self):
        now = NODE_RESET + 120_000
        self.assertEqual(rpd.alerts(rpd.state_from_save(save()), now, True, False, now), [])
        titles = lambda s, at=now, paused=False: [a["title"] for a in rpd.alerts(rpd.state_from_save(s), at, True, paused, at)]
        self.assertIn("Nothing is running", titles(save(scripts=())))
        self.assertIn("The World Daemon is ready: your call", titles(save(world=3121, hacking=3200, pill=True)))
        # in the save from minute one, out of reach until The Red Pill: not a call for Ken
        self.assertNotIn("The World Daemon is ready: your call", titles(save(world=3121, hacking=16_000)))
        self.assertIn("The game has stopped saving", titles(save(), at=now + 600_000))
        self.assertIn("Auto install is paused", titles(save(), paused=True))

    def test_delivery_alarms(self):
        now = NODE_RESET + 20 * 60_000
        base = {**rpd.state_from_save(save(scripts=("mcp.js", "capital_manager.js"))), "homeRam": 256}
        rows = [{"ts": now - (19 - i) * 60_000, "earned": {"hacking": i + 1}, "karma": -i} for i in range(20)]
        good = {"ts": now - 60_000}

        def titles(state=base, rows=rows, readiness=good, approval=(True, ""), dog=now, install=None):
            return [a["title"] for a in rpd.delivery_alerts(state, now, rows, readiness, install, approval, dog)]

        self.assertEqual(titles(), [])
        # 2026-11-22 10:26-10:38: 256GB home, scripts running, advisor last read 6 minutes ago
        self.assertIn("The install advisor is blind", titles(readiness={"ts": now - 6 * 60_000}))
        self.assertIn("The install advisor is blind", titles(readiness={"ts": NODE_RESET - 1}))  # the last run's file
        self.assertIn("No money is arriving", titles(rows=[{**r, "earned": {"hacking": 5}} for r in rows]))
        self.assertIn("MCP is not running", titles({**base, "scripts": ["capital_manager.js"]}))
        self.assertIn("Nothing is buying RAM", titles({**base, "scripts": ["mcp.js"]}))
        self.assertIn("Installs need your approval", titles(approval=(False, "not approved")))
        self.assertIn("An install failed", titles(install={"hold_until_s": now / 1000 + 60}))
        self.assertIn("The outage watchdog is not running", titles(dog=now - 240_000))
        self.assertIn("The Red Pill is bought but not installed", titles({**base, "queued": ["The Red Pill"]}))
        self.assertEqual(titles({**base, "homeRam": 32, "scripts": ["capital_bootstrap.js"]}, readiness=None), [])  # bootstrap

    def test_thin_keeps_cycle_edges(self):
        rows = [{"ts": i, "resetAt": i // 333} for i in range(2000)]
        kept = {r["ts"] for r in rpd.thin(rows, 50)}
        self.assertTrue({0, 332, 333, 1999} <= kept)


if __name__ == "__main__":
    unittest.main()
