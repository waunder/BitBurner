import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from helpers import REPO, profile as P, stage as S
import manifest_lib as M


def layer(name, files=None, config=None, startup=None, bitnodes=None, extends=None):
    return P.Layer(name=name, files=files or {}, config=config or {}, startup=startup or [],
                   bitnodes=bitnodes or [], extends=extends or [])


class ManifestLibTests(unittest.TestCase):
    def test_map_form_parses(self):
        self.assertEqual(M.parse_manifest_map({"files": {"a.js": "core/a.js"}}), {"a.js": "core/a.js"})

    def test_old_list_form_is_a_clear_error_not_empty(self):
        with self.assertRaises(M.ManifestFormatError) as cm:
            M.parse_manifest_map({"files": ["a.js", "b.js"]})
        self.assertIn("old list form", str(cm.exception))
        self.assertIsInstance(cm.exception, ValueError)  # bb_remote's reload catches ValueError

    def test_rejects_traversal_and_absolute_and_backslash(self):
        for bad in ("../x.js", "/x.js", "a\\b.js", ""):
            with self.assertRaises(M.ManifestFormatError):
                M.parse_manifest_map({"files": {"ok.js": bad}})
            with self.assertRaises(M.ManifestFormatError):
                M.parse_manifest_map({"files": {bad: "ok.js"}})

    def test_missing_files_key(self):
        with self.assertRaises(M.ManifestFormatError):
            M.parse_manifest_map({"nope": 1})


class MergeTests(unittest.TestCase):
    def test_merge_core_and_profile(self):
        core = layer("core", files={"a.js": "core/a.js"}, config={"c.json": "core/config/c.json"})
        prof = layer("p", files={"b.js": "profiles/p/b.js"}, startup=["b.js"], bitnodes=[7])
        m = P.merge_layers("p", [core, prof])
        self.assertEqual(m.files, {"a.js": "core/a.js", "c.json": "core/config/c.json", "b.js": "profiles/p/b.js"})
        self.assertEqual(m.startup, ["b.js"])
        self.assertEqual(m.bitnodes, [7])
        self.assertEqual(m.chain, ["core", "p"])

    def test_profile_config_overrides_core_config(self):
        core = layer("core", config={"c.json": "core/config/c.json"})
        prof = layer("p", config={"c.json": "profiles/p/config/c.json"})
        m = P.merge_layers("p", [core, prof])
        self.assertEqual(m.files["c.json"], "profiles/p/config/c.json")
        self.assertEqual(m.overrides, {"c.json": ("core/config/c.json", "profiles/p/config/c.json")})

    def test_file_collision_is_an_error(self):
        core = layer("core", files={"a.js": "core/a.js"})
        prof = layer("p", files={"a.js": "profiles/p/a.js"})
        with self.assertRaises(P.ProfileError):
            P.merge_layers("p", [core, prof])

    def test_config_may_not_override_a_core_file(self):
        core = layer("core", files={"a.js": "core/a.js"})
        prof = layer("p", config={"a.js": "profiles/p/a.js"})
        with self.assertRaises(P.ProfileError):
            P.merge_layers("p", [core, prof])

    def test_repo_path_collisions_reported(self):
        self.assertEqual(P.repo_path_collisions({"a.js": "x.js", "b.js": "x.js", "c.js": "y.js"}), [("x.js", ["a.js", "b.js"])])

    def test_build_manifest_header_and_self_entry(self):
        m = P.merge_layers("p", [layer("core", files={"a.js": "core/a.js"}), layer("p")])
        out = P.build_manifest(m)
        self.assertEqual(out["profile"], "p")
        self.assertIn("Active profile: p", out["_comment"])
        self.assertEqual(out["files"]["sync_manifest.json"], "sync_manifest.json")
        self.assertEqual(list(out["files"])[0], "sync_manifest.json")
        self.assertEqual(M.parse_manifest_map(json.loads(P.render_manifest(out))), out["files"])


class SwitchLogicTests(unittest.TestCase):
    def test_plan_deletes_only_previous_leftovers(self):
        plan = P.plan_switch({"a.js", "dnet_x.js", "sync_manifest.json"}, {"a.js": "r", "sleeve.js": "r", "sync_manifest.json": "s"})
        self.assertEqual(plan["delete"], ["dnet_x.js"])
        self.assertEqual(plan["push"], ["a.js", "sleeve.js", "sync_manifest.json"])

    def test_plan_with_no_previous_manifest_deletes_nothing(self):
        self.assertEqual(P.plan_switch(set(), {"a.js": "r"})["delete"], [])

    def test_previous_paths_read_both_forms(self):
        self.assertEqual(P.previous_game_paths({"files": ["a.js"]}), {"a.js"})
        self.assertEqual(P.previous_game_paths({"files": {"a.js": "x"}}), {"a.js"})
        self.assertEqual(P.previous_game_paths({}), set())

    def test_node_allowed(self):
        self.assertTrue(P.node_allowed([10], 10))
        self.assertFalse(P.node_allowed([10], 15))
        self.assertFalse(P.node_allowed([], 10))
        self.assertFalse(P.node_allowed([10], None))

    def test_switch_refuses_without_live_and_touches_nothing(self):
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            rc = P.main(["switch", "bn10"])
        self.assertEqual(rc, 2)
        self.assertIn("--live", err.getvalue())

    def test_switch_refuses_template(self):
        with tempfile.TemporaryDirectory() as tmp:
            args = P.build_parser().parse_args(["--root", tmp, "switch", "_template"])
            # Without --live it refuses before it even loads anything.
            self.assertEqual(P.cmd_switch(args), 2)

    def test_classify_game_files(self):
        active = {"a.js", "b.js", "sync_manifest.json"}
        others = {"bn15": {"a.js", "dnet_x.js"}}
        r = P.classify_game_files(["/a.js", "dnet_x.js", "stray.js", "status.json", "n.txt"], active, others)
        self.assertEqual(r["missing"], ["b.js", "sync_manifest.json"])
        self.assertEqual(r["stale"], [("dnet_x.js", "bn15")])
        self.assertEqual(r["extra_scripts"], ["stray.js"])
        self.assertEqual(r["extra_other_count"], 2)


class StaticAnalysisTests(unittest.TestCase):
    def test_unresolved_imports(self):
        src = {"a.js": 'import { x } from "./b.js"\nimport y from "c.js"\nimport "@ns"\nimport z from "./gone.js"\n',
               "sub/d.js": 'import { q } from "./e.js"\nimport { r } from "b.js"\n'}
        paths = {"a.js", "b.js", "c.js", "sub/d.js", "sub/e.js"}
        self.assertEqual(P.unresolved_imports(src, paths), [("a.js", "./gone.js")])

    def test_test_files_for(self):
        sibs = ["core/mcp/mcp_logic.test.js", "core/mcp/mcp_cloud.test.js", "core/mcp/mcp_reputation_max.test.js",
                "core/hud/mcp_logic.test.js", "core/mcp/other.test.js"]
        self.assertEqual(P.test_files_for("core/mcp/mcp_logic.js", sibs), ["core/mcp/mcp_logic.test.js"])
        self.assertEqual(P.test_files_for("core/mcp/mcp.js", sibs),
                         ["core/mcp/mcp_cloud.test.js", "core/mcp/mcp_logic.test.js", "core/mcp/mcp_reputation_max.test.js"])
        self.assertEqual(P.test_files_for("core/mcp/mcp_logic.test.js", sibs), [])
        self.assertEqual(P.test_files_for("core/config/x.json", sibs), [])


class RealRepoTests(unittest.TestCase):
    """The committed layout resolves, and the committed manifest is exactly the bn15 build."""

    def test_every_profile_resolves_with_all_repo_files_present(self):
        for name in P.list_profiles(REPO):
            m = P.resolve(REPO, name)
            self.assertEqual(P.missing_repo_files(REPO, m), [], name)
            self.assertEqual(P.unresolved_imports(P.read_sources(REPO, m), set(m.files)), [], name)

    def test_template_is_not_buildable(self):
        with self.assertRaises(P.ProfileError):
            P.resolve(REPO, "_template")

    def test_committed_manifest_equals_fresh_default_profile_build(self):
        committed = json.loads((REPO / "sync_manifest.json").read_text(encoding="utf-8"))
        fresh = P.build_manifest(P.resolve(REPO, committed["profile"]))
        self.assertEqual(committed, fresh)

    def test_bn10_is_bn15_plus_sleeves(self):
        # bn10 extends bn15 for the darknet (Red Pill from the 4th lab), adding sleeves and the shadow allocator.
        a, b = P.resolve(REPO, "bn15"), P.resolve(REPO, "bn10")
        self.assertTrue(set(a.files) <= set(b.files))
        self.assertTrue(all(g.startswith("sleeve_") for g in set(b.files) - set(a.files)))
        self.assertEqual(b.startup, ["dnet_root.js", "sleeve_controller.js", "sleeve_buyer.js", "allocator.js"])

    def test_game_paths_keep_flat_and_special_subpaths(self):
        files = P.resolve(REPO, "bn15").files
        for p in ("mcp.js", "hacking/crawler.js", "scripts/hack.js", "dnet_lib.js", "player_activity_config.json"):
            self.assertIn(p, files)
        self.assertEqual(files["player_activity_config.json"], "profiles/bn15/config/player_activity_config.json")
        self.assertEqual(P.resolve(REPO, "bn10").files["player_activity_config.json"], "profiles/bn10/config/player_activity_config.json")


class StageTests(unittest.TestCase):
    def _fixture(self, root: Path):
        (root / "core" / "mcp").mkdir(parents=True)
        (root / "core" / "mcp" / "m.js").write_text("export const m = 1\n", newline="")
        (root / "core" / "mcp" / "m.test.js").write_text("// test\n")
        (root / "core" / "mcp" / "m_extra.test.js").write_text("// test2\n")
        (root / "core" / "hacking").mkdir()
        (root / "core" / "hacking" / "c.js").write_text("export {}\r\n", newline="")
        (root / "core" / "manifest.json").write_text(json.dumps(
            {"files": {"m.js": "core/mcp/m.js", "hacking/c.js": "core/hacking/c.js"}, "config": {}}))
        (root / "profiles" / "p").mkdir(parents=True)
        (root / "profiles" / "p" / "profile.json").write_text(json.dumps({"name": "p", "extends": ["core"], "bitnodes": [1]}))

    def test_stage_copies_files_and_tests_at_game_paths(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._fixture(root)
            result = S.stage(root, "p")
            out = root / "build" / "p"
            self.assertEqual(result["tests"], 2)
            self.assertEqual((out / "m.js").read_bytes(), b"export const m = 1\n")
            self.assertEqual((out / "hacking" / "c.js").read_bytes(), b"export {}\r\n")  # line endings untouched
            self.assertTrue((out / "m.test.js").exists() and (out / "m_extra.test.js").exists())
            manifest = json.loads((out / "sync_manifest.json").read_text())
            self.assertEqual(manifest["profile"], "p")

    def test_stage_wipes_only_under_build(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._fixture(root)
            with self.assertRaises(P.ProfileError):
                S.stage(root, "p", out_dir=root / "core")
            self.assertTrue((root / "core" / "manifest.json").exists())

    def test_stage_fails_on_missing_repo_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self._fixture(root)
            (root / "core" / "hacking" / "c.js").unlink()
            with self.assertRaises(P.ProfileError):
                S.stage(root, "p")


if __name__ == "__main__":
    unittest.main()
