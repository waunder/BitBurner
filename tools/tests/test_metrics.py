import json
import tempfile
import unittest
from pathlib import Path

from helpers import load

M = load("bb_metrics", "metrics.py")

MIN = 60_000
HOUR = 60 * MIN
R1 = 1_790_000_000_000  # an install time
R2 = R1 + 10 * HOUR


def sample(ts, reset, hack=100, rep=None, favor=None, installed=20, money=1e9, karma=-100.0, exp=1e6, mcp=5e8):
    return {
        "ts": ts, "resetAt": reset, "money": money, "income": {"total": money},
        "skills": {"hacking": hack, "strength": 10, "defense": 10, "dexterity": 10, "agility": 10, "charisma": 5},
        "exp": {"hacking": exp}, "karma": karma, "city": "Sector-12", "sharePower": 1.46,
        "work": {"type": "FACTION", "faction": "NiteSec"}, "reason": "favor push",
        "factionRep": rep or {}, "favor": favor or {}, "installedCount": installed, "queuedCount": 0,
        "verdict": "build", "mcpRate": mcp, "mcpAvgRate": mcp / 2, "ramMax": 100, "ramUsed": 90, "stale": {},
    }


def series(reset, hours, rep_per_h, hack_start=100, hack_per_h=10, favor=None, installed=20):
    """5-minute samples starting 5 minutes after reset."""
    out = []
    for i in range(1, int(hours * 12) + 1):
        h = i / 12
        out.append(sample(reset + i * 5 * MIN, reset, hack=int(hack_start + hack_per_h * h),
                          rep={"NiteSec": rep_per_h * h, "The.Dot": 1.0}, favor=favor, installed=installed,
                          karma=-100 - 50 * h, exp=1e6 + 2e5 * h, money=1e9 + 3e8 * h))
    return out


class ParseTests(unittest.TestCase):
    def test_skips_bad_lines_and_sorts(self):
        text = "\n".join([json.dumps({"ts": 2}), "not json", json.dumps({"no": "ts"}), json.dumps({"ts": 1}), ""])
        self.assertEqual([s["ts"] for s in M.parse(text)], [1, 2])

    def test_current_cycle_uses_latest_reset(self):
        s = series(R1, 1, 1000) + series(R2, 1, 2000)
        cyc = M.current_cycle(s)
        self.assertTrue(all(x["resetAt"] == R2 for x in cyc))
        self.assertEqual(len(cyc), 12)

    def test_dotted_faction_names(self):
        self.assertEqual(M.get(sample(1, 1, rep={"The.Dot": 3}), "factionRep.The.Dot"), 3)


class RateTests(unittest.TestCase):
    def test_slopes_per_hour(self):
        r = M.window_rates(series(R1, 2, 6000))
        self.assertAlmostEqual(r["repPerHour"]["NiteSec"], 6000, places=3)
        self.assertAlmostEqual(r["karmaPerHour"], -50, places=3)
        self.assertAlmostEqual(r["hackExpPerHour"], 2e5, places=1)
        self.assertAlmostEqual(r["cashPerHour"], 3e8, places=0)
        self.assertFalse(r["crossesInstall"])

    def test_window_drops_earlier_cycle(self):
        r = M.window_rates(series(R1, 1, 9999)[-3:] + series(R2, 1, 1000))
        self.assertTrue(r["crossesInstall"])
        self.assertAlmostEqual(r["repPerHour"]["NiteSec"], 1000, places=3)

    def test_slope_needs_two_points(self):
        self.assertIsNone(M.slope_per_hour([sample(1, 1)], "karma"))
        self.assertIsNone(M.slope_per_hour([], "karma"))

    def test_stale_nulls_are_ignored(self):
        s = series(R1, 1, 1200)
        s[3]["factionRep"] = None
        s[4]["mcpRate"] = None
        r = M.window_rates(s)
        self.assertAlmostEqual(r["repPerHour"]["NiteSec"], 1200, places=3)
        self.assertAlmostEqual(r["mcpRate"], 5e8)


class CycleTests(unittest.TestCase):
    def test_rows_and_rebuild(self):
        prev = series(R1, 10 - 1 / 12, 6000, hack_start=100, hack_per_h=10, favor={"NiteSec": 100.0}, installed=20)
        cur = series(R2, 6, 9000, hack_start=50, hack_per_h=20, favor={"NiteSec": 104.5}, installed=23)
        rows = M.cycle_rows(prev + cur)
        self.assertEqual(len(rows), 2)
        first, second = rows
        self.assertFalse(first["open"])
        self.assertAlmostEqual(first["hours"], 10)
        self.assertEqual(first["installedDelta"], 3)
        self.assertAlmostEqual(first["favorBanked"]["NiteSec"], 4.5)
        self.assertNotIn("The.Dot", first["favorBanked"])
        self.assertAlmostEqual(first["rep"]["NiteSec"], 6000 * (10 - 1 / 12), places=3)
        self.assertEqual(first["rebuild"], {"hacking": None, "repRate": None, "both": None})
        self.assertFalse(first["hasPrev"])
        self.assertTrue(second["open"])
        self.assertIsNone(second["favorBanked"])
        # prev ends at hacking 199; cur reaches 199 when 50 + 20h >= 199 -> first 5-min sample at h >= 7.45: not within 6h
        self.assertIsNone(second["rebuild"]["hacking"])
        # rep rate 9000/h beats 6000/h as soon as a 30-min window exists (about 0.5h)
        self.assertLessEqual(second["rebuild"]["repRate"], 0.6)
        self.assertIsNone(second["rebuild"]["both"])
        self.assertIn("not yet", M.cycles_text(prev + cur))

    def test_rebuild_hacking_found(self):
        prev = series(R1, 2, 6000, hack_start=100, hack_per_h=10)
        cur = series(R2, 6, 9000, hack_start=100, hack_per_h=20)
        rb = M.rebuild_hours(prev, cur)
        # prev ends at hacking int(100 + 10*2) = 120; cur int(100 + 20h) >= 120 at h = 1.0
        self.assertAlmostEqual(rb["hacking"], 1.0)
        self.assertIsNotNone(rb["both"])


def curve(reset, hours, rate, faction=lambda h: "NiteSec"):
    """5-minute samples where every gain runs at rate(h) per hour (rep for faction(h))."""
    out, acc, rep = [], 0.0, {}
    for i in range(1, int(hours * 12) + 1):
        h = i / 12
        r = rate(h) / 12
        acc += r
        fac = faction(h)
        rep[fac] = rep.get(fac, 0.0) + r
        s = sample(reset + i * 5 * MIN, reset, hack=100 + int(acc / 1000), rep=dict(rep),
                   money=1e9 + acc * 1e5, exp=1e6 + acc * 100, mcp=rate(h) * 1e4)
        s["work"] = {"type": "FACTION", "faction": fac}
        out.append(s)
    return out


class TrendTests(unittest.TestCase):
    def test_decelerating(self):
        t = M.trend(curve(R1, 3.5, lambda h: 10000 * 0.7 ** int(h)))
        for name in ("cash/h", "MCP", "hackExp/h", "rep work", "rep best"):
            self.assertEqual(t["metrics"][name]["flag"], "DECELERATING", name)
        self.assertEqual(t["metrics"]["lvl/h"]["flag"], "context")
        self.assertEqual(t["metrics"]["rep work"]["faction"], "NiteSec")
        line = M.trend_line(t)
        self.assertIn("rep work NiteSec", line)
        self.assertIn("DECELERATING", line)
        self.assertEqual(line.count("\n"), 0)

    def test_steady_and_accelerating(self):
        self.assertEqual(M.trend(curve(R1, 3.5, lambda h: 10000))["metrics"]["cash/h"]["flag"], "STEADY")
        # one drop then flat is not two drops in a row
        t = M.trend(curve(R1, 3.5, lambda h: 10000 if h <= 1.5 else 5000))
        self.assertNotEqual(t["metrics"]["cash/h"]["flag"], "DECELERATING")
        self.assertEqual(M.trend(curve(R1, 3.5, lambda h: 10000 * 1.5 ** int(h)))["metrics"]["MCP"]["flag"], "ACCELERATING")

    def test_faction_switch_is_not_a_slowdown(self):
        fac = lambda h: "NiteSec" if h <= 2.1 else "The Black Hand"
        t = M.trend(curve(R1, 3.5, lambda h: 10000 * 0.7 ** int(h), faction=fac))
        self.assertEqual(t["metrics"]["rep work"]["flag"], "SWITCH")
        self.assertEqual(t["metrics"]["rep work"]["faction"], "The Black Hand")
        self.assertEqual(t["metrics"]["rep best"]["flag"], "SWITCH")
        self.assertEqual(t["metrics"]["cash/h"]["flag"], "DECELERATING")

    def test_reset_uses_only_current_cycle(self):
        old = curve(R1, 9.9, lambda h: 50000)
        new = curve(R2, 2.5, lambda h: 10000)
        t = M.trend(old + new)
        self.assertIsNone(t["windows"][0])  # the first window would reach back past the install
        self.assertEqual(t["metrics"]["cash/h"]["flag"], "n/a")
        self.assertAlmostEqual(t["metrics"]["rep work"]["values"][-1], 10000, places=3)
        self.assertEqual(M.trend_line(M.trend([])), "trend: no samples since the latest install")


class TextTests(unittest.TestCase):
    def test_summary_and_rates_render(self):
        s = series(R1, 2, 6000)
        text = M.summary_text(s, 60, now_ms=s[-1]["ts"] + MIN)
        self.assertIn("NiteSec 6k", text)
        self.assertIn("age 1 min", text)
        self.assertEqual(M.summary_text([], 60), "metrics: no samples since the latest install")
        out = M.rates_text(s, R1 + HOUR, R1 + 2 * HOUR, None)
        self.assertIn("before:", out)
        self.assertIn("after:", out)
        self.assertNotIn("before:", M.rates_text(s, R1 + HOUR, R1 + 2 * HOUR, 0))

    def test_parse_time_defaults_to_pacific(self):
        self.assertEqual(M.parse_time("2026-11-05T17:30"), M.parse_time("2026-11-06T00:30+00:00"))
        self.assertEqual(M.pt(M.parse_time("2026-11-05T17:30")), "2026-11-05 17:30 PT")

    def test_load_missing_file(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(M.load(Path(d) / "none.txt"), [])


if __name__ == "__main__":
    unittest.main()
