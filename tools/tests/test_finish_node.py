"""Preflight refusals and result reading of tools/finish_node.py (docs/finish-procedure.md, box 2)."""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import finish_node as F  # noqa: E402

PROFILES = {"bn12": {12}, "bn10": {10}, "bn6": {6, 7}, "bn15": {15}}


def state(**over):
    s = {"node": 12, "nodeResetAt": 1000, "sfLevel": 2, "redPill": True, "skills": {"hacking": 3200},
         "worldDaemon": {"required": 3122, "rooted": False}, "work": "Homicide", "scripts": []}
    s.update(over)
    return s


def check(**over):
    args = dict(state=state(), nxt=12, route=[12, 11, 7, 14, 3, 8, 9, 13], ready=True, copy=False,
                ports=(9222, 12527), profiles=PROFILES, active="bn12", script_in_manifest=False)
    args.update(over)
    return F.preflight(**args)


class Preflight(unittest.TestCase):
    def test_all_clear_same_profile_uses_startup_callback(self):
        refusals, plan = check()
        self.assertEqual(refusals, [])
        self.assertEqual((plan["profile"], plan["switch"], plan["callback"]), ("bn12", False, "startup.js"))

    def test_other_profile_switches_and_has_no_callback(self):
        refusals, plan = check(nxt=7)
        self.assertEqual(refusals, [])
        self.assertEqual((plan["profile"], plan["switch"], plan["callback"]), ("bn6", True, "none"))

    def test_route(self):
        self.assertIn("not on docs/route.md", " ".join(check(nxt=10)[0]))

    def test_pill(self):
        self.assertIn("Red Pill", " ".join(check(state=state(redPill=False))[0]))

    def test_hacking(self):
        self.assertIn("below", " ".join(check(state=state(skills={"hacking": 3121}))[0]))
        self.assertIn("below", " ".join(check(state=state(worldDaemon=None))[0]))

    def test_graft(self):
        self.assertIn("graft", " ".join(check(state=state(work="Grafting nickofolas Congruity Implant"))[0]))

    def test_profile(self):
        self.assertIn("no single profile", " ".join(check(nxt=11)[0]))

    def test_not_ready_refuses_the_real_game(self):
        self.assertIn("READY", " ".join(check(ready=False)[0]))

    def test_copy_may_rehearse_before_ready_but_never_on_real_ports(self):
        self.assertEqual(check(ready=False, copy=True, ports=(9333, 12627))[0], [])
        self.assertIn("real game's ports", " ".join(check(copy=True, ports=(9222, 12627))[0]))
        self.assertIn("real game's ports", " ".join(check(copy=True, ports=(9333, 12527))[0]))
        self.assertIn("needs --copy", " ".join(check(ports=(9333, 12627))[0]))

    def test_script_must_stay_outside_the_manifest(self):
        self.assertIn("manifest", " ".join(check(script_in_manifest=True)[0]))


class Documents(unittest.TestCase):
    def test_route_table_reads_the_real_route(self):
        nodes = F.route_nodes(F.ROUTE.read_text(encoding="utf-8"))
        self.assertEqual(nodes[:3], [12, 11, 7])
        self.assertEqual(len(nodes), 8)

    def test_ready_flag(self):
        self.assertFalse(F.procedure_ready("**Status: NOT READY for the real game.**"))
        self.assertTrue(F.procedure_ready("**Status: READY** since ..."))

    def test_script_is_outside_every_manifest(self):
        root = F.REPO
        for path in [root / "core" / "manifest.json", *root.glob("profiles/*/profile.json"), root / "sync_manifest.json"]:
            self.assertNotIn("finish_node", path.read_text(encoding="utf-8"), path)


class Result(unittest.TestCase):
    def test_entered(self):
        after = state(node=11, nodeResetAt=50_000, sfLevel=0)
        self.assertTrue(F.entered(state(), {12: 2}, after, {12: 3}, 11, 49_000)[0])

    def test_not_entered_when_node_or_stamp_unchanged(self):
        self.assertFalse(F.entered(state(), {12: 2}, state(), {12: 2}, 12, 49_000)[0])
        self.assertFalse(F.entered(state(), {12: 2}, state(node=11, nodeResetAt=1000), {12: 3}, 11, 49_000)[0])

    def test_source_file_must_rise_unless_maxed(self):
        self.assertFalse(F.entered(state(), {12: 2}, state(nodeResetAt=50_000), {12: 2}, 12, 49_000)[0])
        old = state(node=10)
        self.assertTrue(F.entered(old, {10: 3}, state(node=11, nodeResetAt=50_000), {10: 3}, 11, 49_000)[0])

    def test_backup_must_match(self):
        self.assertEqual(F.backup_matches(state(), state()), [])
        self.assertTrue(F.backup_matches(state(), state(nodeResetAt=999)))
        self.assertTrue(F.backup_matches(state(), state(redPill=False)))

    def test_sf_levels_from_save_map(self):
        save = {"data": {"PlayerSave": json.dumps({"data": {"sourceFiles": {"ctor": "JSONMap", "data": [[12, 2], [1, 2]]}}})}}
        self.assertEqual(F.sf_levels(save), {12: 2, 1: 2})

    def test_approval_quotes_the_handover(self):
        entry = F.approval_entry(11, 1, 123, "2026-11-23")
        self.assertIn("its in your hands", entry["ken"])
        self.assertEqual((entry["node"], entry["run"], entry["nodeResetAt"]), (11, 1, 123))


if __name__ == "__main__":
    unittest.main()
