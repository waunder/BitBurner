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

## Build status (branch `restructure`, 2026-11-04)

Built, not merged, not run against the game. `core/manifest.json`, `profiles/{bn15,bn10,_template}/profile.json`,
`tools/profile.py` (`list`, `build`, `plan`, `switch --live`, `check`), `tools/stage.py` and the map-form
reads in `tools/bb_remote.py`, `core/startup/sync_from_github.js` and `core/startup/startup_browser.js` are in.
`sync_manifest.json` is committed as the bn15 build. Proof: `build/bn15` is byte-identical to the
pre-move tree for every shipped file except `sync_manifest.json`, the two sync scripts (they read the map)
and one added file, `formulas_logic.js` (below). Tests: 465 pass in `build/bn15`, 384 in `build/bn10`;
`bn15` plus the 27 sleeve tests equals the 492 on `bn10-prep`.

Additions beyond the plan, all small:
- `tools/manifest_lib.py`: the one manifest reader, shared by the daemon, `profile.py` and the tests. The old list
  form raises `ManifestFormatError` with a regenerate instruction instead of syncing nothing.
- `bb_remote.py` gains `ctl-list` and `ctl-delete` (used by `profile.py check` and `switch`) and reports
  `manifest_format: "map"` in `ctl-status`; `switch` refuses a daemon that does not.
- `profile.py plan <profile>` previews a switch offline. `extends` may be a list, so a profile can build on
  another profile as well as core (for example bn10 on bn15, see below).
- Python tests: `tools/tests/` (`python -m unittest discover -s tools/tests`).

## Placement decisions

Rule used: core if any BitNode needs it, profile only if a BitNode can run without it; unsure means core.

- **Whole darknet family to `profiles/bn15/dnet/`:** every `dnet_*` script and test, plus
  `restart_dnet_root.js`. Judgement call: the darknet needs the SF15.1 grant, which BN10 will have, and
  `docs/bn10-plan.md` leaves "darknet early in BN10?" to Ken. Core scripts that name `dnet_*` files
  (`mcp_launch.js`, `restart_mcp.js`, `capital_manager.js`, `mcp_xp.js`, `ops_hud.js`,
  `hud_consolidated.js`, `automation_review.js`) only start them on request or read their JSON, so with the
  files absent they print "failed to start" or show "unavailable". To run the darknet in BN10, add `bn15`
  to bn10's `extends` (that also brings bn15's tuned `player_activity_config.json`; override it again in bn10's `config`).
- **`startup.js` stays core and unchanged,** so it still launches `dnet_root.js`. A profile's `startup` field
  records what the profile adds beyond core (bn15 `dnet_root.js`, bn10 `sleeve_controller.js`) but no script reads it
  yet. In BN10 the launch prints one failure for `dnet_root.js`, and `sleeve_controller.js` is started by hand.
  Making `startup.js` read the list is a behaviour change, deliberately left for after the cutover.
- **`player_activity_config.json` is split.** `profiles/bn15/config/` holds the current BN15-tuned file (moved with `git mv`,
  byte-identical to today's). `core/config/` holds a new neutral default for every other node:
  `charismaTarget` 0, no `companyTarget`, `priorityAugs` and `charismaAugs` empty, as `docs/bn10-readiness-audit.md` item 13 suggests
  (clearing `charismaAugs` is my addition: those augmentations only exist to feed the darknet labs). `covenantTarget` stays false.
- **`formulas_logic.js` added to the core manifest.** `mcp.js` imports it but the old manifest never listed it, so a fresh node would
  fail to load `mcp.js`. This is the one change to the shipped file set. Its test now runs too.
- **Other core files by folder:** `core/mcp` (scheduler, cloud batches, reputation, XP, stacks, share, `progression_guidance_logic.js`
  imported by `mcp_xp.js`), `core/capital` (capital, purchases, `money*`, stock trader), `core/player`, `core/hud` (all panels, including
  `mcp_hud`, `mcp_money`, `mcp_stocks`, `get_stats`, `crime_returns`), `core/lib` (`tail_geometry.js`, imported by 16 scripts, and `lsf.js`),
  `core/contracts`, `core/gang`, `core/ipvgo` (IPvGO is unsure for BN10, so core), `core/startup`, `core/maintenance`
  (steward, automation review, keepalive), `core/hacking` (`hacking/*` and `The-Cave.js`), `core/scripts` (the `scripts/*` workers).
  `core/maintenance`, `core/hacking`, `core/scripts` and `core/dev` are folders the plan did not name.
- **`core/dev/` is never shipped:** diagnostics that were never in the manifest (`formulas_*` probes and shadows, `mcp_formulas_shadow.js`,
  `cloud_reputation_quote.js`, `crime_sort.js`). Two darknet ones, `dnet_canary_phase2.js` and `dnet_reset_creds.js`, sit in `profiles/bn15/dev/`.
- **Tools:** the BN15-only `dnet_map.py` and the two `dnet_canary_test*.sh` moved to `profiles/bn15/tools/` (paths fixed; `dnet_map.py` writes
  its route to `runtime/`). `mcp_status_parser.py` and `.js` moved to `tools/` and read `runtime/mcp_status.json`.
- **`BN2-roadmap.txt`:** it is a game file (the manifest lists it), so only its repo path moved, to `docs/archive/`; its game path is unchanged.
- **Tests** sit beside the file they test and are staged by name (`<stem>.test.js` and `<stem>_*.test.js`). Of the 35 test files,
  27 are core, 6 are darknet and 2 are sleeve.
- **Editor files:** `editor/tsconfig.json` now includes `core/` and `profiles/` and resolves bare imports against `build/bn15/`.
- **`hourly-task-prompt.txt`:** not in this repo at all. The hourly task's prompt lives in
  `~/.claude/scheduled-tasks/bitburner-bn15-progress/SKILL.md`, names no pulled file, and was not touched.
- **Not touched:** two references that were already dead before the move (`purchaseServer-8GB.js` runs `early-hack-template.js`;
  `hud_consolidated.js` runs `hud_click_monitor.js`; neither file is in any manifest).

## Decisions needed at cutover

1. Darknet in BN10 or not (above). Default as built: not.
2. Whether to make `startup.js` read the profile's `startup` list, or keep launching by hand in BN10.
3. The daemon must be restarted before `switch` (the running one cannot read the map form).

### Added 2026-11-03 at review

- **Profile startup lists are live.** `tools/profile.py build` writes the profile's `startup` list
  into `sync_manifest.json`. `startup.js` launches its core list, then that list. `dnet_root.js`
  left the core list and is now bn15's startup entry, so the bn15 launch order is unchanged.
- **bn10 extends bn15.** The Red Pill can come from the 4th darknet lab in BN10, so the darknet
  family ships there too. `profiles/bn10/config/player_activity_config.json` (the neutral default)
  overrides bn15's BN15-tuned config. The bn10 startup list is `dnet_root.js`, then
  `sleeve_controller.js`.
