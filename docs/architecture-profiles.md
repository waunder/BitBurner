# Architecture: shared core, BitNode profiles, and a tidy repo

Status: proposed 2026-11-03, approved in principle by Ken. Build on a branch, cut over at
the next BitNode boundary (BN15 to BN10). Until then the live BN15 game is untouched.

## Why

- Each BitNode needs different scripts and settings: darknet labs in BN15, sleeves in BN10.
  BN15-tuned config would leak into BN10 (`docs/bn10-readiness-audit.md`, "needs Ken").
- The repo root holds 213 files: 130 game scripts, 33 tests, 29 JSON files, game
  telemetry pulled from the game, and old reports. It is hard to tell source from output.
- Ken does not read code. The layout should show what exists and what runs in each node.

## Principles

1. **Repo layout and game layout are separate.** In the game every script stays at its
   current flat path (`mcp.js`, `dnet_lib.js`, `hacking/crawler.js`). Most scripts import
   each other by bare game path, 86 of them, so moving files in the game would mean
   rewriting every import, `ns.run`, `ns.exec` and `ns.scp` list. The repo can be reorganised
   freely because a manifest maps each repo file to its game path.
2. **One core, many profiles.** About 90% of the suite works in any node and is kept once.
   A profile adds only what one BitNode needs: its scripts, its config, and its startup list.
   A fix to the core is made once.
3. **The repo is the truth, the game is a deployment.** At each BitNode start the game
   receives exactly the core plus the active profile, from the repo, and stale files from the
   previous profile are removed.
4. **Test what ships.** Tests run against the same flat file set the game receives.
5. **Generated output never mixes with source.** Telemetry pulled from the game goes to a
   gitignored `runtime/` folder.

## Repo tree

```
core/                 Netscript that runs in every BitNode
  mcp/                scheduler, cloud batches, reputation, XP, stacks
  capital/            capital manager, purchases, stocks
  player/             player activity controller, faction join, augmentations, install
  hud/                consolidated HUD and toggles
  contracts/          coding contracts
  gang/               gang controller and policy
  ipvgo/              IPvGO player
  lib/                shared libraries
  startup/            startup.js, mcp_launch.js, restart_*.js, maintenance steward
  config/             core config defaults (mcp_config.json, reputation_config.json, ...)
profiles/
  bn15/               darknet family (dnet_*), labyrinth tooling, BN15 config
  bn10/               sleeve controller and buyer, BN10 config
  _template/          starting point for a new node
  <name>/profile.json what the profile adds, its config files, startup list, notes
tools/                out-of-game Python and PowerShell (unchanged)
runtime/              gitignored: status, event and log files pulled from the game
saves/                gitignored: validated save backups
docs/                 current guides: AGENTS.md pointer, governance, processes, plans
  archive/            superseded reports and audits, moved from the root and docs/
editor/               NetscriptDefinitions.d.ts, NetscriptGlobals.d.ts, tsconfig.json
```

Tests stay beside the file they test, so the folder shows both. Root keeps only `AGENTS.md`,
`CLAUDE.md`, `README.md`, `STATE.md`, `.gitignore` and the manifest.

## The manifest

`sync_manifest.json` changes from a flat list to a map from game path to repo path, built
from two parts:

- `core/manifest.json`: every core file, e.g. `"mcp.js": "core/mcp/mcp.js"`.
- `profiles/<name>/profile.json`: that profile's files and config, plus `startup` (the
  scripts `startup.js` launches beyond the core) and `extends` (normally `core`).

`tools/profile.py` merges them into the generated `sync_manifest.json` (committed, with a
header naming the active profile). Both sync consumers read that one file:
- `tools/bb_remote.py` (Steam, over the Remote API) uses the map to find each repo file.
- `sync_from_github.js` (browser save) fetches the repo path and writes the game path.

Each pulled telemetry file in `PULL_FILES` is written to `runtime/<game path>`.

## Switching profiles

`tools/profile.py switch bn10` does the following, and runs only at a BitNode boundary:
1. Refuses unless the game reports a BitNode that the profile allows.
2. Backs up and validates the save (`tools/save_export.py`).
3. Writes the merged manifest and records the active profile.
4. Pushes every file over the Remote API, then deletes the previous profile's game files
   that the new manifest does not list. Generated game files are never deleted.
5. Prints a summary and the next command, `run startup.js`.

`tools/profile.py check` compares the game's files with the manifest and lists what is
missing, stale or extra. It changes nothing.

## Tests

`tools/stage.py <profile>` copies the merged file set into `build/<profile>/` with game
paths. `node --test` runs there, so bare game imports resolve as they do in the game, and
more of the suite becomes testable than today. `build/` is gitignored.

## Cutover plan

All work happens on branch `restructure`, cut from `bn10-prep`, and nothing reaches `main`
early.

1. **Build:** the new tree (files moved with `git mv`, so history follows), the two
   manifests, `tools/profile.py`, `tools/stage.py`, and the manifest-map support in
   `bb_remote.py` and `sync_from_github.js`. Update docs and every reference to
   pulled-file paths: `STATE.md` workflows, the hourly task prompt, and `tools/`.
2. **Prove it is identical.** `stage.py bn15` must produce exactly today's game file set,
   byte for byte, compared against the current flat files. That proves the move changed no
   behaviour. Every test passes in `build/bn15` and `build/bn10`.
3. **At the World Daemon:** stop for Ken as always. After he chooses BN10 and the node
   starts: merge `restructure` into `main`, restart the Remote API daemon (it reads the new
   manifest format), `profile.py switch bn10`, `profile.py check`, `run startup.js`. The
   BN10 checklist in `docs/bn10-plan.md` shrinks to these steps.
4. **Roll back if needed.** The old flat layout is the parent commit, and the save backup
   from step 2 of the switch restores the game.

## Risks

- **The daemon runs from the main checkout.** Changing the manifest format needs a daemon
  restart at cutover; the supervisor task restarts it, and a verified full sync must follow.
- **Local tools and prompts read pulled files at the repo root today.** Every reference must
  move to `runtime/`, or STATE refreshes will read stale copies. `grep` for each `PULL_FILES`
  name catches them.
- **Deleting game files.** The switch deletes only files that the previous profile's
  manifest lists, never generated output, and only after a save backup.
- **Size of the move.** About 170 files. History follows `git mv`, and the byte-identical
  check is the safety net.

## Not changing

- In-game paths and every script's imports, run calls, exec calls and scp lists.
- `AGENTS.md` rules, governance, and the save-backup rule.
- `tools/` behaviour, apart from the manifest map and the `runtime/` pull folder.
