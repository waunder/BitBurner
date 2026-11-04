#!/usr/bin/env python3
"""Stage a profile's merged file set at game paths, so tests run on what the game receives.

    python tools/stage.py bn15            # writes build/bn15/
    cd build/bn15 && node --test          # bare game imports resolve as they do in the game

Copies every file in the merged manifest to build/<profile>/<game path>, plus the tests that sit
beside each copied script (tests are not in the manifest and never ship). Writes the merged
sync_manifest.json too. `build/` is gitignored output; it is wiped and rebuilt each run.
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

import importlib.util

_TOOLS = Path(__file__).resolve().parent
if str(_TOOLS) not in sys.path:
    sys.path.append(_TOOLS.as_posix())  # appended, so the stdlib `profile` module is not shadowed


def _load_profiles():
    """tools/profile.py under another module name: `profile` is also a stdlib module."""
    if "bb_profile" in sys.modules:
        return sys.modules["bb_profile"]
    spec = importlib.util.spec_from_file_location("bb_profile", _TOOLS / "profile.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["bb_profile"] = mod
    spec.loader.exec_module(mod)
    return mod


profiles = _load_profiles()

REPO_ROOT = profiles.REPO_ROOT


def plan_stage(root: Path, merged: "profiles.Merged", all_repo_files: list) -> dict:
    """Return {game path: repo path} for the shipped set plus {game path of test: repo test}."""
    copies = dict(profiles.build_manifest(merged)["files"])
    tests = {}
    for game, repo in merged.files.items():
        for test_repo in profiles.test_files_for(repo, all_repo_files):
            test_game = (game.rpartition("/")[0] + "/" if "/" in game else "") + test_repo.rpartition("/")[2]
            tests[test_game] = test_repo
    clash = set(copies) & set(tests)
    if clash:
        raise profiles.ProfileError(f"test file names collide with shipped files: {sorted(clash)}")
    return {"copies": copies, "tests": tests}


def list_repo_tests(root: Path) -> list:
    out = []
    for base in ("core", "profiles"):
        for p in (root / base).rglob("*.test.js"):
            out.append(p.relative_to(root).as_posix())
    return sorted(out)


def stage(root: Path, profile: str, out_dir: Path | None = None) -> dict:
    merged = profiles.resolve(root, profile)
    problems = profiles.missing_repo_files(root, merged)
    if problems:
        raise profiles.ProfileError(f"repo files missing: {problems[:5]}")
    plan = plan_stage(root, merged, list_repo_tests(root))
    build_root = (root / "build").resolve()
    target = (out_dir or build_root / profile).resolve()
    if build_root not in target.parents and target != build_root:
        raise profiles.ProfileError(f"refusing to wipe {target}: not under {build_root}")
    if target.exists():
        shutil.rmtree(target)
    manifest_text = profiles.render_manifest(profiles.build_manifest(merged))
    for game, repo in {**plan["copies"], **plan["tests"]}.items():
        dest = target / game
        dest.parent.mkdir(parents=True, exist_ok=True)
        if game == profiles.MANIFEST_NAME:
            dest.write_text(manifest_text, encoding="utf-8", newline="")
        else:
            shutil.copyfile(root / repo, dest)  # bytes, so line endings are never rewritten
    return {"target": target, "files": len(plan["copies"]), "tests": len(plan["tests"])}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("profile")
    ap.add_argument("--root", default=str(REPO_ROOT), help=argparse.SUPPRESS)
    args = ap.parse_args(argv)
    try:
        result = stage(Path(args.root), args.profile)
    except profiles.ProfileError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(f"staged {result['files']} files and {result['tests']} tests into {result['target']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
