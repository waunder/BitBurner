"""Alarm forwarding of tools/notify.py: settle, repeat, cleared, page down, hourly cap."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import notify as N  # noqa: E402

BAD = {"level": "bad", "title": "MCP is not running", "text": "The main earner is down."}
YOU = {"level": "you", "title": "The World Daemon is ready", "text": "Finish it in a session."}


class Forwarding(unittest.TestCase):
    def test_bad_alarm_waits_to_settle_then_sends_once(self):
        out, s = N.plan([BAD], True, 0, {})
        self.assertEqual(out, [])
        out, s = N.plan([BAD], True, N.SETTLE_S - 1, s)
        self.assertEqual(out, [])
        out, s = N.plan([BAD], True, N.SETTLE_S, s)
        self.assertEqual([m[0] for m in out], ["MCP is not running"])
        out, s = N.plan([BAD], True, N.SETTLE_S + 60, s)
        self.assertEqual(out, [])

    def test_flapping_alarm_never_sends(self):
        s = {}
        for t in range(0, 1000, 60):
            out, s = N.plan([BAD] if t % 120 == 0 else [], True, t, s)
            self.assertEqual(out, [])

    def test_waiting_on_ken_sends_at_once_with_high_priority(self):
        out, _ = N.plan([YOU], True, 0, {})
        self.assertEqual(out, [("The World Daemon is ready", "Finish it in a session.", 1)])

    def test_repeats_while_it_lasts_and_says_cleared(self):
        _, s = N.plan([YOU], True, 0, {})
        out, s = N.plan([YOU], True, N.REPEAT_S, s)
        self.assertEqual(len(out), 1)
        out, s = N.plan([], True, N.REPEAT_S + 30, s)
        self.assertEqual(out, [("Cleared: The World Daemon is ready", "", -1)])
        out, s = N.plan([], True, N.REPEAT_S + 60, s)
        self.assertEqual(out, [])

    def test_unsent_alarm_clears_quietly(self):
        _, s = N.plan([BAD], True, 0, {})
        out, _ = N.plan([], True, 30, s)
        self.assertEqual(out, [])

    def test_page_down_alerts_after_ten_minutes_and_keeps_other_alarms(self):
        _, s = N.plan([YOU], True, 0, {})
        out, s = N.plan([], False, 60, s)
        self.assertEqual(out, [])
        out, s = N.plan([], False, 60 + N.PAGE_DOWN_S, s)
        self.assertEqual([m[0] for m in out], ["The run page is not answering"])
        self.assertIn("The World Daemon is ready", s["seen"])  # not "cleared" just because it could not be read
        out, s = N.plan([YOU], True, 60 + N.PAGE_DOWN_S + 30, s)
        self.assertEqual([m[0] for m in out], ["Cleared: The run page is not answering"])

    def test_hourly_cap(self):
        many = [{"level": "you", "title": f"t{i}", "text": ""} for i in range(N.HOURLY_CAP + 3)]
        out, s = N.plan(many, True, 0, {})
        self.assertEqual(len(out), N.HOURLY_CAP)
        self.assertIn("3 more held", out[-1][1])
        out, _ = N.plan([], True, 60, s)
        self.assertEqual(out, [])  # cap is full; cleared notes wait too

    def test_no_keys_means_no_send(self):
        old = N.KEYS
        try:
            N.KEYS = Path("/nonexistent/pushover.json")
            self.assertEqual(N.send("x")[0], False)
        finally:
            N.KEYS = old


if __name__ == "__main__":
    unittest.main()
