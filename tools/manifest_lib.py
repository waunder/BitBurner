"""Shared reader for the generated sync_manifest.json (game path -> repo path).

Kept dependency-free and import-safe so bb_remote.py (the Remote API daemon),
profile.py and stage.py all read the manifest the same way, and so unit tests can
import it without touching the game.
"""
from __future__ import annotations

import json
from pathlib import Path

POSIX_BAD = ("\\", "..")


class ManifestFormatError(ValueError):
    """The manifest is not the game-path -> repo-path map this code needs."""


OLD_FORM_HELP = (
    "sync_manifest.json is in the old list form ({\"files\": [..]}). The profile layout needs the "
    "map form ({\"files\": {\"<game path>\": \"<repo path>\"}}). Regenerate it with "
    "`python tools/profile.py build <profile>` (or merge the restructure branch's manifest)."
)


def validate_path(path: str, what: str) -> None:
    """Reject paths that could escape the repo or the game root."""
    if not isinstance(path, str) or not path:
        raise ManifestFormatError(f"{what} must be a non-empty string, got {path!r}")
    if path.startswith("/") or any(bad in path for bad in POSIX_BAD):
        raise ManifestFormatError(f"{what} {path!r} must be relative, POSIX, with no '..'")


def parse_manifest_map(data) -> dict[str, str]:
    """Return {game path: repo path} from parsed manifest JSON, or raise a clear error."""
    if not isinstance(data, dict) or "files" not in data:
        raise ManifestFormatError("manifest has no 'files' key")
    files = data["files"]
    if isinstance(files, list):
        raise ManifestFormatError(OLD_FORM_HELP)
    if not isinstance(files, dict):
        raise ManifestFormatError(f"manifest 'files' must be a map, got {type(files).__name__}")
    for game, repo in files.items():
        validate_path(game, "game path")
        validate_path(repo, f"repo path for {game!r}")
    return dict(files)


def load_manifest_map(path) -> dict[str, str]:
    with open(Path(path), encoding="utf-8") as f:
        return parse_manifest_map(json.load(f))
