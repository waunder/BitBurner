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


def spend_sample(ts, reset, servers=0.0, sleeves=None, hacking=0.0, money=1e12, home=None, batch=None):
    income = {"hacking": hacking, "servers": -servers, "total": hacking - servers}
    if sleeves is not None:
        income["sleeves"] = -sleeves
    s = {"ts": ts, "resetAt": reset, "money": money, "income": income, "mcpAvgRate": 1e8}
    if home is not None:
        s["homeRam"] = home
    if batch is not None:
        s["batchAverage"] = batch
    return s


class SpendTests(unittest.TestCase):
    def test_early_late_split_and_b1(self):
        # 1t of servers in the first 1.5h, 2t more by 3h; 10t earned, 4t of it after 1.5h.
        cyc = [spend_sample(R1 + 30 * MIN, R1, servers=0.5e12, hacking=3e12),
               spend_sample(R1 + 85 * MIN, R1, servers=1e12, hacking=6e12),
               spend_sample(R1 + 3 * HOUR, R1, servers=3e12, hacking=10e12, batch=0.3)]
        r = M.cycle_spend(cyc)
        self.assertEqual(r["categories"]["servers"], {"early": 1e12, "late": 2e12, "total": 3e12})
        self.assertIsNone(r["categories"]["sleeves"])  # not logged by the older logger
        self.assertAlmostEqual(r["lateEarn"], 4e12)
        self.assertAlmostEqual(r["b1"], 0.5)
        self.assertEqual(r["b3"], 0.3)
        self.assertTrue(r["open"])
        self.assertFalse(r["earlyUnknown"])

    def test_home_step_is_told_from_cloud_by_home_ram(self):
        # Replays 2026-11-10 14:53: home 64TB -> 131TB for $4.74t, after a cloud step.
        cyc = [spend_sample(R1 + 2 * HOUR, R1, servers=3.39e12, home=65536, money=4e12),
               spend_sample(R1 + 2 * HOUR + 5 * MIN, R1, servers=3.64e12, home=65536, money=4e12),
               spend_sample(R1 + 2 * HOUR + 10 * MIN, R1, servers=8.38e12, home=131072, money=4e12)]
        r = M.cycle_spend(cyc)
        self.assertAlmostEqual(r["homeCloud"]["home"], 4.74e12)
        self.assertAlmostEqual(r["homeCloud"]["cloud"], 0.25e12)
        late = [st for st in r["steps"] if st["phase"] == "late"]
        self.assertEqual([st["category"] for st in late], ["cloud", "home"])

    def test_without_home_ram_steps_stay_servers(self):
        cyc = [spend_sample(R1 + 2 * HOUR, R1, servers=0), spend_sample(R1 + 2 * HOUR + 5 * MIN, R1, servers=5e12)]
        r = M.cycle_spend(cyc)
        self.assertIsNone(r["homeCloud"])
        self.assertEqual(r["steps"][0]["category"], "servers")

    def test_small_spends_are_not_steps(self):
        cyc = [spend_sample(R1 + 2 * HOUR, R1, servers=0, money=1e12),
               spend_sample(R1 + 2 * HOUR + 5 * MIN, R1, servers=5e9, money=1e12)]  # 0.5% of cash
        self.assertEqual(M.cycle_spend(cyc)["steps"], [])

    def test_log_starting_after_the_early_phase_is_flagged(self):
        r = M.cycle_spend([spend_sample(R1 + 5 * HOUR, R1, servers=1e12)])
        self.assertTrue(r["earlyUnknown"])
        self.assertEqual(r["categories"]["servers"]["late"], 1e12)

    def test_batch_cost_steps_by_1_9_and_adds_donations(self):
        status = {"plan": [["A", "NiteSec", 100.0], ["B", "NiteSec", 50.0], ["C", "NiteSec", 10.0]],
                  "bought": ["A", "C"], "donations": [{"faction": "X", "amount": 7.0}]}
        self.assertAlmostEqual(M.batch_cost(status), 100 + 10 * 1.9 + 7)

    def test_install_7_batch_cost_matches_its_cash(self):
        # aug_install_status.json of 2026-11-10 12:15: $2.711t covered 9 augs.
        plan = [["PC Direct-Neural Interface Optimization Submodule", "NiteSec", 42750000000], ["Neuralstimulator", "NiteSec", 28500000000],
                ["Neotra", "NiteSec", 27312500000], ["HyperSight Corneal Implant", "NiteSec", 26125000000], ["SmartJaw", "NiteSec", 26125000000],
                ["Photosynthetic Cells", "NiteSec", 26125000000], ["Embedded Netburner Module Core Implant", "NiteSec", 23750000000],
                ["CRTX42-AA Gene Modification", "NiteSec", 2137500000], ["Combat Rib I", "NiteSec", 225625000]]
        status = {"ts": R2, "money": 2711432869600.28, "plan": plan, "bought": [p[0] for p in plan], "installed": True}
        cost = M.batch_cost(status)
        self.assertLess(cost, status["money"])
        self.assertLess(status["money"] - cost, 0.01 * status["money"])

    def test_archive_dedupes_purchases_and_installs(self):
        status = {"purchases": [{"ts": 1, "ok": True, "kind": "home", "cost": 5.0}, {"ts": 2, "ok": False, "kind": "cloud", "cost": 3.0}]}
        first = M.archive_records([], "capital_status.json", status, now_ms=10)
        self.assertEqual([r["type"] for r in first], ["purchase", "pull"])
        again = M.archive_records(first, "capital_status.json", status, now_ms=20)
        self.assertEqual([r["type"] for r in again], ["pull"])
        sleeve = {"purchases": [{"ts": 3, "kind": "memory", "cost": 9.0, "outcome": {"ok": True}}]}
        self.assertEqual(M.archive_records([], "sleeve_buyer_status.json", sleeve, 10)[0]["source"], "sleeve")
        inst = {"ts": 5, "installed": True, "money": 10.0, "plan": [["A", "F", 4.0]], "bought": ["A"]}
        rec = M.archive_records([], "aug_install_status.json", inst, 10)
        self.assertEqual(rec[0]["batchCost"], 4.0)
        self.assertEqual(M.archive_records(rec, "aug_install_status.json", inst, 20), [])
        self.assertEqual(M.archive_records([], "aug_install_status.json", {**inst, "installed": False}, 10), [])

    def test_a_full_purchase_list_newer_than_the_last_pull_is_a_gap(self):
        full = {"purchases": [{"ts": 100 + i, "ok": True, "cost": 1.0} for i in range(50)]}
        history = [{"type": "pull", "source": "capital", "ts": 50}]
        self.assertTrue(M.archive_records(history, "capital_status.json", full, 200)[-1]["gap"])
        history = [{"type": "pull", "source": "capital", "ts": 120}]
        self.assertFalse(M.archive_records(history, "capital_status.json", full, 200)[-1]["gap"])

    def test_unattributed_needs_archive_coverage(self):
        cyc = [spend_sample(R1 + 2 * HOUR, R1, servers=0), spend_sample(R1 + 3 * HOUR, R1, servers=6e12)]
        self.assertIsNone(M.cycle_spend(cyc, history=[])["unattributed"]["servers"])
        history = [{"type": "pull", "source": "capital", "ts": R1 - MIN, "gap": False},
                   {"type": "pull", "source": "capital", "ts": R1 + 3 * HOUR, "gap": False},
                   {"type": "purchase", "source": "capital", "ts": R1 + 2 * HOUR + MIN, "cost": 4.74e12}]
        r = M.cycle_spend(cyc, history=history)
        self.assertAlmostEqual(r["unattributed"]["servers"], 1.26e12)  # e.g. a manual purchase
        history[1]["gap"] = True
        self.assertIsNone(M.cycle_spend(cyc, history=history)["unattributed"]["servers"])

    def test_closed_cycle_takes_its_install_record(self):
        cyc = [spend_sample(R1 + HOUR, R1), spend_sample(R2 - 4 * MIN, R1)]
        history = [{"type": "install", "ts": R2 - MIN, "money": 10e12, "batchCost": 9e12, "bought": 5}]
        r = M.cycle_spend(cyc, next_reset=R2, history=history)
        self.assertAlmostEqual(r["install"]["leftAfterBatch"], 1e12)
        self.assertIsNone(M.cycle_spend(cyc, next_reset=None, history=history)["install"])

    def test_rows_and_text(self):
        samples = [spend_sample(R1 + HOUR, R1, servers=1e12), spend_sample(R2 + HOUR, R2, servers=2e12, sleeves=3e9)]
        rows = M.spend_rows(samples)
        self.assertEqual(len(rows), 2)
        self.assertFalse(rows[0]["open"])
        text = M.spend_text(rows)
        self.assertIn("servers 1t", text)
        self.assertIn("sleeves 3b", text)
        self.assertIn("B2: no aug_install record", text)

    def test_pull_spend_appends_once(self):
        files = {"capital_status.json": json.dumps({"purchases": [{"ts": 1, "ok": True, "kind": "home", "cost": 5.0}]}),
                 "aug_install_status.json": "not json"}
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "spend_history.jsonl"
            M.pull_spend(path, now_ms=10, fetch=files.get)
            M.pull_spend(path, now_ms=20, fetch=files.get)
            recs = M.read_history(path)
        self.assertEqual(sum(1 for r in recs if r["type"] == "purchase"), 1)
        self.assertEqual(sum(1 for r in recs if r["type"] == "pull"), 2)


if __name__ == "__main__":
    unittest.main()
