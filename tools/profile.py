#!/usr/bin/env python3
"""BitNode profiles: merge core + profile into sync_manifest.json, switch the game, check it.

    python tools/profile.py list
    python tools/profile.py build  <profile> [--out PATH]   # write the merged sync_manifest.json
    python tools/profile.py plan   <profile>                # offline: what a switch would push/delete
    python tools/profile.py switch <profile> --live         # BitNode boundary only; talks to the game
    python tools/profile.py check  [--content]              # compare the game with the manifest; read only

Layout (docs/architecture-profiles.md):
  core/manifest.json            {"files": {game path: repo path}, "config": {game path: repo path}}
  profiles/<name>/profile.json  {"name", "extends", "bitnodes", "files", "config", "startup", "notes"}

Game paths stay flat and exactly as scripts import them; repo paths are free to move.
`build`, `plan` and `list` touch only local files. `switch` and `check` talk to the game
through the running Remote API daemon (control port) and DevTools (save read), so `switch`
refuses to run without `--live`.
"""
from __future__ import annotations

import argparse
import datetime
import gzip
import json
import re
import socket
import sys
from dataclasses import dataclass, field
from pathlib import Path

if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.append(str(Path(__file__).resolve().parent))
from manifest_lib import ManifestFormatError, validate_path  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
MANIFEST_NAME = "sync_manifest.json"
CORE = "core"
CONTROL_PORT = 12527
NAME_RE = re.compile(r"^[a-z0-9][a-z0-9_-]*$")


class ProfileError(Exception):
    """A profile or manifest is malformed or inconsistent."""


# ---------------------------------------------------------------------------
# Pure logic
# ---------------------------------------------------------------------------

@dataclass
class Layer:
    name: str
    files: dict = field(default_factory=dict)
    config: dict = field(default_factory=dict)
    startup: list = field(default_factory=list)
    bitnodes: list = field(default_factory=list)
    extends: list = field(default_factory=list)
    description: str = ""


@dataclass
class Merged:
    profile: str
    chain: list
    files: dict          # game path -> repo path, config included
    startup: list
    bitnodes: list
    overrides: dict      # game path -> (overridden repo path, new repo path)


def _as_path_map(raw, what: str) -> dict:
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise ProfileError(f"{what} must be a map {{game path: repo path}}, got {type(raw).__name__}")
    try:
        for game, repo in raw.items():
            validate_path(game, f"{what} game path")
            validate_path(repo, f"{what} repo path for {game!r}")
    except ManifestFormatError as exc:
        raise ProfileError(str(exc)) from exc
    return dict(raw)


def parse_layer(name: str, data: dict) -> Layer:
    if not isinstance(data, dict):
        raise ProfileError(f"{name}: top level must be an object")
    extends = data.get("extends", [])
    if isinstance(extends, str):
        extends = [extends]
    if not isinstance(extends, list) or not all(isinstance(e, str) for e in extends):
        raise ProfileError(f"{name}: 'extends' must be a name or a list of names")
    startup = data.get("startup", [])
    bitnodes = data.get("bitnodes", [])
    if not isinstance(startup, list) or not isinstance(bitnodes, list):
        raise ProfileError(f"{name}: 'startup' and 'bitnodes' must be lists")
    return Layer(
        name=name,
        files=_as_path_map(data.get("files"), f"{name} files"),
        config=_as_path_map(data.get("config"), f"{name} config"),
        startup=list(startup),
        bitnodes=list(bitnodes),
        extends=extends,
        description=str(data.get("description", "")),
    )


def merge_layers(profile: str, layers: list) -> Merged:
    """Merge layers base-first. Rules:
      - a game path in 'files' may appear in only one layer's files/config as a 'file';
      - 'config' entries may override an earlier layer's 'config' entry (that is the point of
        a profile config), but never an earlier 'files' entry, and never a later 'files' one.
    """
    files: dict = {}
    origin: dict = {}   # game path -> ("files"|"config", layer name)
    overrides: dict = {}
    startup: list = []
    for layer in layers:
        for game, repo in layer.files.items():
            if game in files:
                raise ProfileError(
                    f"game path {game!r} is a file in both {origin[game][1]} ({files[game]}) and {layer.name} ({repo})"
                )
            files[game] = repo
            origin[game] = ("files", layer.name)
        for game, repo in layer.config.items():
            if game in files:
                kind, who = origin[game]
                if kind == "files":
                    raise ProfileError(f"config {game!r} in {layer.name} collides with a file from {who}")
                overrides[game] = (files[game], repo)
            files[game] = repo
            origin[game] = ("config", layer.name)
        for script in layer.startup:
            if script not in startup:
                startup.append(script)
    target = layers[-1]
    return Merged(profile=profile, chain=[l.name for l in layers], files=files, startup=startup,
                  bitnodes=list(target.bitnodes), overrides=overrides)


def repo_path_collisions(files: dict) -> list:
    """Two game paths backed by one repo file is allowed only deliberately; report them."""
    seen: dict = {}
    for game, repo in files.items():
        seen.setdefault(repo, []).append(game)
    return sorted((repo, games) for repo, games in seen.items() if len(games) > 1)


def build_manifest(merged: Merged) -> dict:
    files = {MANIFEST_NAME: MANIFEST_NAME}
    files.update(merged.files)
    return {
        "_comment": (
            f"GENERATED by `python tools/profile.py build {merged.profile}` - do not edit by hand. "
            f"Active profile: {merged.profile} (layers: {' + '.join(merged.chain)}). "
            "Map of game path -> repo path: the game path is where the file lands in the game (flat, "
            "as scripts import it), the repo path is where it lives in this checkout. Consumed by "
            "tools/bb_remote.py (Steam, Remote API) and sync_from_github.js (browser). "
            "Edit core/manifest.json or profiles/<name>/profile.json instead, then rebuild. "
            "Never listed: tests (*.test.js, staged by tools/stage.py), generated telemetry "
            "(pulled to runtime/), override triggers, and files under core/dev."
        ),
        "profile": merged.profile,
        "layers": merged.chain,
        # startup.js launches these after its core list.
        "startup": merged.startup,
        "files": files,
    }


def render_manifest(manifest: dict) -> str:
    return json.dumps(manifest, indent=2) + "\n"


def previous_game_paths(data) -> set:
    """Game paths listed by an existing manifest, in either the map form or the old list form."""
    files = data.get("files") if isinstance(data, dict) else None
    if isinstance(files, dict):
        return set(files)
    if isinstance(files, list):
        return set(files)
    return set()


def plan_switch(previous: set, new_files: dict) -> dict:
    """Push everything in the new manifest; delete only what the previous manifest listed and the new
    one does not. Never deletes by pattern, so generated game files are never touched."""
    new_paths = set(new_files)
    return {
        "push": sorted(new_paths),
        "delete": sorted(previous - new_paths),
        "keep_unlisted": "files the previous manifest never listed (generated output) are not touched",
    }


def node_allowed(bitnodes: list, node) -> bool:
    return bool(bitnodes) and node in bitnodes


def classify_game_files(game_names, active: set, other_profiles: dict) -> dict:
    """Compare the game's file names with the manifest.

    missing: listed by the active manifest, absent in the game.
    stale:   present in the game and listed only by a different profile (left over from a switch).
    extra:   present in the game, listed by no manifest. Scripts are reported by name; other files
             (json/txt telemetry and runtime state) are only counted, since the game generates them.
    """
    game = {n.lstrip("/") for n in game_names}
    stale_owner = {}
    for name, paths in other_profiles.items():
        for p in paths:
            if p not in active:
                stale_owner.setdefault(p, name)
    missing = sorted(active - game)
    stale = sorted((p, stale_owner[p]) for p in game if p in stale_owner and p not in active)
    unknown = [p for p in game if p not in active and p not in stale_owner]
    extra_scripts = sorted(p for p in unknown if p.endswith(".js"))
    extra_other = sorted(p for p in unknown if not p.endswith(".js"))
    return {"missing": missing, "stale": stale, "extra_scripts": extra_scripts, "extra_other_count": len(extra_other)}


IMPORT_RE = re.compile(r"""(?:import|export)[^;\n]*?from\s*["']([^"']+)["']""")


def unresolved_imports(sources: dict, game_paths: set) -> list:
    """sources: {game path: script text}. Returns (importer, wanted) for relative/bare imports that no
    shipped game path satisfies. Imports resolve against the importer's folder, then the game root."""
    out = []
    for game, text in sorted(sources.items()):
        if not game.endswith(".js"):
            continue
        folder = game.rsplit("/", 1)[0] + "/" if "/" in game else ""
        for m in IMPORT_RE.finditer(text):
            spec = m.group(1)
            if spec.startswith("@") or not (spec.endswith(".js") or spec.endswith(".json")):
                continue
            if spec.startswith("/"):
                cands = [spec[1:]]
            elif spec.startswith("./"):
                cands = [folder + spec[2:], spec[2:]]
            else:
                cands = [spec]
            if not any(c in game_paths for c in cands):
                out.append((game, spec))
    return out


def test_files_for(repo_path: str, siblings: list) -> list:
    """Tests that belong to a repo file: <stem>.test.js and <stem>_*.test.js in the same folder."""
    if not repo_path.endswith(".js") or repo_path.endswith(".test.js"):
        return []
    folder, _, name = repo_path.rpartition("/")
    stem = name[:-3]
    found = []
    for sib in siblings:
        sib_folder, _, sib_name = sib.rpartition("/")
        if sib_folder != folder or not sib_name.endswith(".test.js"):
            continue
        tstem = sib_name[: -len(".test.js")]
        if tstem == stem or tstem.startswith(stem + "_"):
            found.append(sib)
    return sorted(found)


# ---------------------------------------------------------------------------
# Disk loading
# ---------------------------------------------------------------------------

def _load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ProfileError(f"missing {path}") from exc
    except ValueError as exc:
        raise ProfileError(f"{path} is not valid JSON: {exc}") from exc


def list_profiles(root: Path = REPO_ROOT) -> list:
    base = root / "profiles"
    if not base.is_dir():
        return []
    return sorted(p.name for p in base.iterdir() if p.is_dir() and not p.name.startswith("_")
                  and (p / "profile.json").is_file())


def load_layer(root: Path, name: str) -> Layer:
    if name == CORE:
        return parse_layer(CORE, _load_json(root / "core" / "manifest.json"))
    if not NAME_RE.match(name):
        raise ProfileError(f"profile name {name!r} must match {NAME_RE.pattern}")
    data = _load_json(root / "profiles" / name / "profile.json")
    layer = parse_layer(name, data)
    if data.get("name", name) != name:
        raise ProfileError(f"profiles/{name}/profile.json says name {data.get('name')!r}")
    return layer


def resolve(root: Path, profile: str) -> Merged:
    if profile.startswith("_"):
        raise ProfileError(f"{profile!r} is a template, not a profile")
    order: list = []

    def visit(name: str, trail: tuple):
        if name in trail:
            raise ProfileError("extends cycle: " + " -> ".join(trail + (name,)))
        layer = load_layer(root, name)
        for parent in layer.extends:
            visit(parent, trail + (name,))
        if all(l.name != name for l in order):
            order.append(layer)

    visit(profile, ())
    if order[0].name != CORE:
        # Every profile builds on core, even if 'extends' was left out.
        order.insert(0, load_layer(root, CORE))
    merged = merge_layers(profile, order)
    return merged


def missing_repo_files(root: Path, merged: Merged) -> list:
    return sorted((g, r) for g, r in merged.files.items() if not (root / r).is_file())


def read_sources(root: Path, merged: Merged) -> dict:
    out = {}
    for game, repo in merged.files.items():
        if game.endswith(".js"):
            try:
                out[game] = (root / repo).read_text(encoding="utf-8")
            except OSError:
                pass
    return out


def active_profile(root: Path = REPO_ROOT):
    try:
        return _load_json(root / MANIFEST_NAME).get("profile")
    except ProfileError:
        return None


def other_profile_paths(root: Path, merged: Merged) -> dict:
    out = {}
    for name in list_profiles(root):
        if name == merged.profile:
            continue
        try:
            out[name] = set(resolve(root, name).files) | {MANIFEST_NAME}
        except ProfileError:
            continue
    return out


# ---------------------------------------------------------------------------
# Game access (live): control channel to the Remote API daemon, DevTools save read
# ---------------------------------------------------------------------------

def ctl_call(port: int, req: dict, timeout: float = 30.0) -> dict:
    with socket.create_connection(("127.0.0.1", port), timeout=5) as s:
        s.settimeout(timeout)
        s.sendall((json.dumps(req) + "\n").encode())
        buf = b""
        while not buf.endswith(b"\n"):
            chunk = s.recv(1 << 16)
            if not chunk:
                break
            buf += chunk
    if not buf:
        raise ProfileError("daemon closed the connection with no response")
    return json.loads(buf.decode())


def ctl_ok(port: int, req: dict, timeout: float = 30.0):
    res = ctl_call(port, req, timeout)
    if not res.get("ok"):
        raise ProfileError(f"daemon refused {req.get('cmd')}: {res.get('error')}")
    return res["result"]


def read_save_summary():
    """Return (raw bytes, summary dict) from the live save over DevTools. Read only."""
    import save_export
    raw = save_export.read_raw()
    return raw, save_export.summary(save_export.decode(raw))


def backup_save(root: Path, profile: str, raw: bytes) -> Path:
    import save_export
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    path = root / "saves" / f"pre-switch-{profile}-{stamp}.json.gz"
    path.parent.mkdir(exist_ok=True)
    path.write_bytes(raw if raw[:2] == b"\x1f\x8b" else gzip.compress(raw))
    save_export.summary(save_export.decode(path.read_bytes()))  # validates by decoding the file we wrote
    return path


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def _print_warnings(root: Path, merged: Merged) -> int:
    problems = 0
    for game, repo in missing_repo_files(root, merged):
        print(f"ERROR repo file missing for {game}: {repo}")
        problems += 1
    for repo, games in repo_path_collisions(merged.files):
        print(f"WARN  {repo} backs several game paths: {', '.join(games)}")
    for game, spec in unresolved_imports(read_sources(root, merged), set(merged.files)):
        print(f"WARN  {game} imports {spec}, which this profile does not ship")
    return problems


def cmd_list(args) -> int:
    root = Path(args.root)
    active = active_profile(root)
    for name in list_profiles(root):
        layer = load_layer(root, name)
        mark = "*" if name == active else " "
        print(f"{mark} {name:8} bitnodes={layer.bitnodes} files={len(layer.files)} startup={layer.startup}  {layer.description}")
    return 0


def cmd_build(args) -> int:
    root = Path(args.root)
    merged = resolve(root, args.profile)
    problems = _print_warnings(root, merged)
    if problems:
        print(f"refusing to write the manifest: {problems} problem(s)")
        return 1
    out = Path(args.out) if args.out else root / MANIFEST_NAME
    out.write_text(render_manifest(build_manifest(merged)), encoding="utf-8")
    print(f"wrote {out} for profile {merged.profile}: {len(merged.files) + 1} files (layers: {' + '.join(merged.chain)})")
    if merged.overrides:
        for game, (old, new) in sorted(merged.overrides.items()):
            print(f"  config override {game}: {old} -> {new}")
    return 0


def cmd_plan(args) -> int:
    root = Path(args.root)
    merged = resolve(root, args.profile)
    try:
        previous = previous_game_paths(_load_json(root / MANIFEST_NAME))
    except ProfileError:
        previous = set()
    plan = plan_switch(previous, build_manifest(merged)["files"])
    print(f"profile {merged.profile}: would push {len(plan['push'])} files, delete {len(plan['delete'])} stale files")
    for p in plan["delete"]:
        print(f"  delete {p}")
    print(f"  startup beyond core: {merged.startup}")
    return 0


def cmd_switch(args) -> int:
    if not args.live:
        print("refusing: `switch` changes the live game. Run it only at a BitNode boundary, with --live.\n"
              "Offline preview: python tools/profile.py plan " + args.profile, file=sys.stderr)
        return 2
    root = Path(args.root)
    merged = resolve(root, args.profile)
    if _print_warnings(root, merged):
        print("refusing: fix the problems above first")
        return 1
    manifest = build_manifest(merged)

    # Daemon must understand the map manifest and the list/delete operations.
    status = ctl_ok(args.control_port, {"cmd": "status"})
    if not status.get("connected"):
        print("refusing: the game is not connected to the Remote API daemon")
        return 1
    if status.get("manifest_format") != "map":
        print("refusing: the running daemon predates the manifest map format; restart it from this checkout first")
        return 1

    # 1. BitNode check.
    raw, info = read_save_summary()
    if not node_allowed(merged.bitnodes, info.get("node")):
        print(f"refusing: the game is in BitNode {info.get('node')}, profile {merged.profile} allows {merged.bitnodes}")
        return 1
    # 2. Backup and validate the save.
    backup = backup_save(root, merged.profile, raw)
    print(f"save backed up and validated: {backup}")
    # 3. Manifest and active profile.
    manifest_path = root / MANIFEST_NAME
    try:
        previous = previous_game_paths(_load_json(manifest_path))
    except ProfileError:
        previous = set()
    manifest_path.write_text(render_manifest(manifest), encoding="utf-8")
    # 4. Push everything, then delete only the previous manifest's leftovers.
    plan = plan_switch(previous, manifest["files"])
    failed = []
    for game, repo in manifest["files"].items():
        content = (root / repo).read_text(encoding="utf-8")
        res = ctl_call(args.control_port, {"cmd": "push", "file": "/" + game, "content": content})
        if not res.get("ok"):
            failed.append((game, res.get("error")))
    if failed:
        print(f"push failed for {len(failed)} file(s); nothing deleted:")
        for game, err in failed:
            print(f"  {game}: {err}")
        return 1
    deleted = []
    for game in plan["delete"]:
        ctl_ok(args.control_port, {"cmd": "delete", "file": "/" + game})
        deleted.append(game)
    # 5. Summary.
    print(f"profile {merged.profile} active: pushed {len(plan['push'])}, deleted {len(deleted)}")
    for g in deleted:
        print(f"  deleted {g}")
    print("next: `run startup.js` in the game, then `python tools/profile.py check`")
    return 0


def cmd_check(args) -> int:
    root = Path(args.root)
    profile = args.profile or active_profile(root)
    if not profile:
        print("no active profile recorded in sync_manifest.json; pass a profile name")
        return 1
    merged = resolve(root, profile)
    active = set(build_manifest(merged)["files"])
    names = ctl_ok(args.control_port, {"cmd": "list"})
    names = names if isinstance(names, list) else []
    report = classify_game_files(names, active, other_profile_paths(root, merged))
    differs = []
    if args.content:
        for game, repo in sorted(build_manifest(merged)["files"].items()):
            if game in report["missing"]:
                continue
            res = ctl_call(args.control_port, {"cmd": "get", "file": "/" + game})
            if not res.get("ok") or res.get("result") != (root / repo).read_text(encoding="utf-8"):
                differs.append(game)
    print(f"profile {profile}: {len(active)} files in manifest, {len(names)} files in game")
    print(f"missing ({len(report['missing'])}):")
    for p in report["missing"]:
        print(f"  {p}")
    print(f"stale, from another profile ({len(report['stale'])}):")
    for p, owner in report["stale"]:
        print(f"  {p}  (listed by {owner})")
    print(f"extra scripts, in no manifest ({len(report['extra_scripts'])}):")
    for p in report["extra_scripts"]:
        print(f"  {p}")
    print(f"other unlisted files (generated output, not listed): {report['extra_other_count']}")
    if args.content:
        print(f"content differs from repo ({len(differs)}):")
        for p in differs:
            print(f"  {p}")
    clean = not (report["missing"] or report["stale"] or differs)
    print("OK" if clean else "NOT CLEAN")
    return 0 if clean else 1


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=str(REPO_ROOT), help=argparse.SUPPRESS)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    p = sub.add_parser("build")
    p.add_argument("profile")
    p.add_argument("--out", help="write here instead of sync_manifest.json")
    p = sub.add_parser("plan")
    p.add_argument("profile")
    p = sub.add_parser("switch")
    p.add_argument("profile")
    p.add_argument("--live", action="store_true", help="required: acknowledges this changes the live game")
    p.add_argument("--control-port", type=int, default=CONTROL_PORT)
    p = sub.add_parser("check")
    p.add_argument("profile", nargs="?")
    p.add_argument("--content", action="store_true", help="also compare file bytes (one get per file)")
    p.add_argument("--control-port", type=int, default=CONTROL_PORT)
    return ap


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    handler = {"list": cmd_list, "build": cmd_build, "plan": cmd_plan, "switch": cmd_switch, "check": cmd_check}[args.cmd]
    try:
        return handler(args)
    except ProfileError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
