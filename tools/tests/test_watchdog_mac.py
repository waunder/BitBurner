import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import run_approval as R  # noqa: E402
import watchdog_mac as W  # noqa: E402

NOW = 1_800_000_000.0


def save(scripts=(), age_s=10, node=12, run=1):
    return {"savedAt": (NOW - age_s) * 1000, "scripts": list(scripts), "node": node, "nodeResetAt": run}


def confirmed(run=1, **more):
    return {"empty": {"run": run, "since_s": NOW - 70}, **more}


def decide(s, state=None, paused=False):
    return W.decide(s, NOW, state or {}, paused, {12})[0]


class Watchdog(unittest.TestCase):
    def test_a_32gb_bootstrap_is_not_an_outage(self):
        # the four scripts that fit on a fresh home: none is a PC-watchdog heartbeat
        four = ["mcp_supervisor.js", "hacking/crawler.js", "capital_bootstrap.js", "early_crime.js"]
        self.assertEqual(decide(save(four), confirmed()), "ok")

    def test_needs_two_saves(self):
        action, _, state = W.decide(save(), NOW, {}, False, {12})
        self.assertEqual(action, "wait")
        self.assertEqual(W.decide(save(), NOW, state, False, {12})[0], "wait")  # the same save again
        self.assertEqual(W.decide({**save(), "savedAt": (NOW + 55) * 1000}, NOW + 60, state, False, {12})[0], "restart")

    def test_workers_alone_are_an_outage(self):
        self.assertEqual(decide(save(["scripts/weaken.js"]), confirmed()), "restart")

    def test_holds(self):
        self.assertEqual(decide(save(), confirmed(), paused=True), "hold")
        self.assertEqual(decide(save(node=11), confirmed()), "hold")
        self.assertEqual(decide(save(), confirmed(restarted={"run": 1, "at_s": NOW - 3600})), "hold")
        self.assertEqual(decide(save(), confirmed(failed_s=NOW - 60)), "hold")

    def test_a_new_run_starts_even_soon_after_a_restart(self):
        self.assertEqual(decide(save(run=2), confirmed(run=2, restarted={"run": 1, "at_s": NOW - 600})), "restart")
        self.assertEqual(decide(save(run=2), confirmed(run=1)), "wait")  # confirmation does not cross runs

    def test_a_game_that_is_not_saving_is_left_alone(self):
        self.assertEqual(decide(save(age_s=900), confirmed()), "ok")

    def test_a_failed_command_does_not_use_up_the_restart(self):
        state = W.restarted({}, save(), False, NOW - 400)
        self.assertEqual(decide(save(), {**state, **confirmed()}), "restart")


class Approval(unittest.TestCase):
    def test_runs(self):
        state = lambda node=12, sf=1, at=5: {"node": node, "sfLevel": sf, "nodeResetAt": at}
        self.assertTrue(R.approved(state(), [{"node": 12, "run": 2, "nodeResetAt": 5}])[0])
        self.assertFalse(R.approved(state(at=6), [{"node": 12, "run": 2, "nodeResetAt": 5}])[0])
        self.assertFalse(R.approved(state(sf=2), [{"node": 12, "run": 2}])[0])
        self.assertTrue(R.approved(state(sf=2), [{"node": 12, "run": 3}])[0])  # approved before entry
        self.assertFalse(R.approved(state(node=10, sf=3), [{"node": 10, "run": 4}])[0])  # maxed: needs the stamp
        self.assertFalse(R.approved(state(), [])[0])


if __name__ == "__main__":
    unittest.main()
