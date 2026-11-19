import json
import tempfile
import unittest
from pathlib import Path

from helpers import load

W = load("outage_watchdog", "outage_watchdog.py")

NOW = 1_800_000_000.0
MIN = 60_000


def status(pull_age_ms=5_000, connected=True):
    return {"connected": connected, "last_pull_read_at_ms": NOW * 1000 - pull_age_ms}


def ages(minutes):
    return {name: m * MIN for name, m in zip(W.HEARTBEATS, minutes)}


class Decide(unittest.TestCase):
    def test_restarts_when_all_residents_silent(self):
        # 2026-11-18 21:00:55: Kill All Scripts stopped everything; found 75 min later.
        action, reason = W.decide(status(), ages([12, 15, 11]), NOW, 0.0, False)
        self.assertEqual(action, "restart")
        self.assertIn("11 min", reason)

    def test_one_live_resident_is_not_an_outage(self):
        self.assertEqual(W.decide(status(), ages([30, 30, 1]), NOW, 0.0, False)[0], "ok")

    def test_pause_file_holds(self):
        self.assertEqual(W.decide(status(), ages([20, 20, 20]), NOW, 0.0, True)[0], "hold")

    def test_second_outage_within_gap_holds(self):
        action, _ = W.decide(status(), ages([20, 20, 20]), NOW, NOW - 3600, False)
        self.assertEqual(action, "hold")
        self.assertEqual(W.decide(status(), ages([20, 20, 20]), NOW, NOW - 3 * 3600, False)[0], "restart")

    def test_untrusted_inputs_do_nothing(self):
        stale = ages([20, 20, 20])
        self.assertEqual(W.decide(status(connected=False), stale, NOW, 0.0, False)[0], "ok")
        self.assertEqual(W.decide(status(pull_age_ms=10 * MIN), stale, NOW, 0.0, False)[0], "ok")
        stale[W.HEARTBEATS[0]] = None
        self.assertEqual(W.decide(status(), stale, NOW, 0.0, False)[0], "ok")


class Files(unittest.TestCase):
    def test_heartbeat_ages_reads_ts_and_tolerates_bad_files(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            (d / "a.json").write_text(json.dumps({"ts": NOW * 1000 - 5 * MIN}))
            (d / "b.json").write_text("{half")
            got = W.heartbeat_ages(NOW * 1000, d, ["a.json", "b.json", "c.json"])
        self.assertEqual(got, {"a.json": 5 * MIN, "b.json": None, "c.json": None})

    def test_last_restart_round_trip(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "s.json"
            self.assertEqual(W.load_last_restart(p), 0.0)
            W.save_last_restart(NOW, p)
            self.assertEqual(W.load_last_restart(p), NOW)


class HoldLogging(unittest.TestCase):
    def test_hold_logged_once_per_episode(self):
        lines = []
        dog = W.Watchdog(lines.append)
        orig = W.decide, W.heartbeat_ages, W.load_last_restart
        try:
            W.heartbeat_ages = lambda now_ms: {}
            W.load_last_restart = lambda: 0.0
            for minutes in (11, 12, 13):
                W.decide = lambda *a, m=minutes: ("hold", f"silent {m} min")
                dog.check(status(), NOW)
            W.decide = lambda *a: ("ok", "residents alive")
            dog.check(status(), NOW)
            W.decide = lambda *a: ("hold", "silent 11 min")
            dog.check(status(), NOW)
        finally:
            W.decide, W.heartbeat_ages, W.load_last_restart = orig
        self.assertEqual(len(lines), 2)


if __name__ == "__main__":
    unittest.main()
