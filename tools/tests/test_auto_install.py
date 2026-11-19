import unittest

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
