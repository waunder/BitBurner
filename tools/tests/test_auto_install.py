import unittest
from unittest import mock

from helpers import load

A = load("auto_install", "auto_install.py")

NOW = 1_800_000_000.0
RESET_MS = (NOW - 5 * 3600) * 1000


def status(pull_age_ms=5_000, connected=True, now=NOW):
    return {"connected": connected, "last_pull_read_at_ms": now * 1000 - pull_age_ms}


def readiness(verdict="install", age_s=30, reset_ms=RESET_MS, owned=()):
    return {"ok": True, "ts_age_s": age_s, "resetAt": reset_ms, "owned": list(owned),
            "advice": {"verdict": verdict, "reason": "best next adds +12%/h, under the cycle's +45%/h"}}


def decide(r, state=None, now=NOW, paused=False, st=None):
    if r is not None:
        r = {**r, "ts": (now - r.pop("ts_age_s")) * 1000}
    return A.decide(st or status(now=now), r, now, state or {}, paused)


class Confirmation(unittest.TestCase):
    def test_install_needs_the_verdict_held_for_confirm_window(self):
        action, _, state = decide(readiness())
        self.assertEqual(action, "wait")
        self.assertEqual(decide(readiness(), state, NOW + 60)[0], "wait")
        self.assertEqual(decide(readiness(), state, NOW + A.CONFIRM_S)[0], "install")

    def test_a_flicker_resets_confirmation(self):
        _, _, state = decide(readiness())
        _, _, state = decide(readiness("wait"), state, NOW + 120)
        self.assertNotIn("install_seen_s", state)
        self.assertEqual(decide(readiness(), state, NOW + A.CONFIRM_S)[0], "wait")


class Guards(unittest.TestCase):
    seen = {"install_seen_s": NOW - 3600}

    def test_other_verdicts_do_nothing(self):
        for v in ("wait", "build", "unknown"):
            self.assertEqual(decide(readiness(v), self.seen)[0], "ok")

    def test_pause_red_pill_young_cycle_and_hold_window(self):
        self.assertEqual(decide(readiness(), self.seen, paused=True)[0], "hold")
        self.assertEqual(decide(readiness(owned=["The Red Pill"]), self.seen)[0], "hold")
        self.assertEqual(decide(readiness(reset_ms=(NOW - 1800) * 1000), self.seen)[0], "hold")
        self.assertEqual(decide(readiness(), {**self.seen, "hold_until_s": NOW + 60})[0], "hold")

    def test_untrusted_inputs_do_nothing(self):
        self.assertEqual(decide(readiness(), self.seen, st=status(connected=False))[0], "ok")
        self.assertEqual(decide(readiness(), self.seen, st=status(pull_age_ms=10 * 60_000))[0], "ok")
        self.assertEqual(decide(readiness(age_s=A.READINESS_FRESH_S + 1), self.seen)[0], "ok")
        self.assertEqual(decide(None, self.seen)[0], "ok")


class Approval(unittest.TestCase):
    def test_an_unapproved_run_holds_and_drops_confirmation(self):
        r = {**readiness(), "ts": (NOW - 30) * 1000}
        action, reason, state = A.decide(status(), r, NOW, {"install_seen_s": NOW - 3600}, False, None, (False, "not approved"))
        self.assertEqual(action, "hold")
        self.assertIn("not approved", reason)
        self.assertNotIn("install_seen_s", state)

    def test_check_asks_before_installing_and_never_runs_the_command(self):
        import run_approval
        r = {**readiness(), "ts": (NOW - 30) * 1000}
        with mock.patch.object(run_approval, "current", return_value=(False, "not approved")) as asked, \
                mock.patch.object(A, "read_readiness", return_value=r), \
                mock.patch.object(A, "load_state", return_value={"install_seen_s": NOW - 3600}), \
                mock.patch.object(A, "save_state"), mock.patch.object(A, "run_install") as ran:
            self.assertEqual(A.AutoInstall(lambda line: None).check(status(), NOW)[0], "hold")
        asked.assert_called_once_with(RESET_MS)
        ran.assert_not_called()


class AfterTheCommand(unittest.TestCase):
    pending = {"pending": {"started_s": NOW - 120, "resetAt": RESET_MS}}

    def test_new_reset_confirms(self):
        action, _, state = decide(readiness("unknown", reset_ms=NOW * 1000 - 60_000), self.pending)
        self.assertEqual(action, "installed")
        self.assertNotIn("pending", state)
        self.assertEqual(state["last_install_s"], NOW)

    def test_waits_then_fails_and_holds(self):
        self.assertEqual(decide(readiness(), self.pending)[0], "wait")
        action, _, state = decide(readiness(), self.pending, NOW + A.VERIFY_S)
        self.assertEqual(action, "failed")
        self.assertGreater(state["hold_until_s"], NOW + 3600)


class Graft(unittest.TestCase):
    def run_decide(self, graft):
        r = {**readiness(), "ts": (NOW - 30) * 1000}
        return A.decide(status(), r, NOW, {"install_seen_s": NOW - 3600}, False, graft)

    def test_a_running_graft_waits_and_keeps_confirmation(self):
        action, _, state = self.run_decide({"ownsPlayer": True, "ts": (NOW - 60) * 1000})
        self.assertEqual(action, "wait")
        self.assertIn("install_seen_s", state)

    def test_finished_or_stale_graft_status_does_not_block(self):
        self.assertEqual(self.run_decide({"ownsPlayer": False, "ts": NOW * 1000})[0], "install")
        self.assertEqual(self.run_decide({"ownsPlayer": True, "ts": (NOW - A.GRAFT_FRESH_S - 1) * 1000})[0], "install")

    def test_refusal_after_a_long_status_line_is_kept(self):
        with mock.patch.object(A, "_run", return_value=(0, "x" * 5000 + " install refused")):
            self.assertIn("install refused", A.run_install()[1])


class Logging(unittest.TestCase):
    def test_wait_logged_once(self):
        lines = []
        auto = A.AutoInstall(lines.append)
        for _ in range(3):
            auto.note("wait", "confirming")
        auto.note("hold", "paused")
        self.assertEqual(len(lines), 2)


if __name__ == "__main__":
    unittest.main()
