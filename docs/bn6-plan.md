# BN6 plan (Bladeburners), prepared 2026-11-14

Ken chose BN6 on 2026-11-14 while BN10 run 3 waited at the World Daemon. This note is the pre-entry design:
what carries over, what we expect, and what to measure first. The Bladeburner controller itself is designed
**after** entry, from live measurements (the Bladeburner API cannot be called outside BN6/7 without SF7).
Anything marked *guess* is to be confirmed or thrown out on day one.

## The code package

- `profiles/bn6/` extends `core`, `bn15` (darknet, available everywhere with SF15.1) and the new shared
  `sleeves` layer (sleeves exist in every node once SF10 is owned).
- `profiles/sleeves/` was split out of `bn10` on 2026-11-14. The bn10 manifest changed only in repo paths;
  game paths and the startup order (`dnet_root.js`, `sleeve_controller.js`, `sleeve_buyer.js`, `allocator.js`)
  are unchanged. 604 tests pass in both `build/bn10` and `build/bn6`.
- bn6 config: `run_target.json` (route below) and `player_activity_config.json` (core neutral, with
  `physicalTarget` 100 for the Bladeburner join and `covenantTarget` false).
- `profiles/bn6/bladeburner/` is empty. The controller lands there once written, and is then added to
  `files` and `startup` in `profiles/bn6/profile.json`.
- `allocator.js` (shadow) is left out of bn6 startup until home RAM allows it.

## Route (guess)

1. Usual rebuild: MCP, cloud RAM, crawler, contracts, darknet.
2. Train all four combat stats to 100, then join the Bladeburner division (`joinBladeburnerDivision`).
3. Slum Snakes gang via karma, as in BN10 (SF2 allows gangs outside BN2). Our combat-gang tooling carries over.
4. Bladeburner rank: Training and Field Analysis early, then Tracking/Bounty Hunter/Retirement contracts,
   then operations (Investigation, Undercover, Sting, Raid, Stealth Retirement, Assassination), and black ops as
   rank allows (21 of them, Operation Typhoon to Operation Daedalus).
5. Installs by judgement as in BN10, weighted toward combat (`augWeights` in `run_target.json`). The Bladeburners
   faction sells its own augmentations; they likely become the main batch once rank opens them.
6. **Stop rule:** Operation Daedalus ends the BitNode (and, as far as I know, needs The Red Pill). The agent
   stops before attempting it, backs up, and notifies Ken, exactly as at a World Daemon. The World Daemon
   route also stays guarded (crawler, worm and backdoor skip it).

## What carries over and what needs a look

| Area | BN6 status |
|---|---|
| MCP, capital manager, crawler, contracts, IPvGO, HUD, metrics | Run as-is. Money multipliers will differ, so read them first. |
| Darknet (`bn15`) | Runs as-is (SF15.1). |
| Sleeves (`sleeves` layer) | Run as-is. Expect fewer sleeves than BN10 (BN10 adds its own); count them on entry. Sleeves can do Bladeburner work (`setToBladeburnerAction`: Training, Field Analysis, Recruitment, Diplomacy, Hyperbolic Regeneration, Take on contracts, Infiltrate Synthoids, Support main sleeve). A sleeve split between gang karma and Bladeburner is a day-one decision. |
| Gang (`gang_create`, controller) | Runs as-is once karma reaches -54k. |
| `player_activity_controller` | **Conflict.** Bladeburner actions are player actions. Without The Shadow's Simulacrum (installed in BN10, wiped by the node change) the player cannot work and do Bladeburner at once. The controller needs to yield once Bladeburner starts, e.g. by reading a status file the Bladeburner controller writes, or by `override: "manual"`. Decide on entry. |
| Install advisor and readiness | Run as-is; weights come from bn6 `run_target.json`. Bladeburner rank is a new progress metric worth adding to `metrics_logger`. |
| `capital_policy.json` (game-only) | BN10-tuned; review after the multipliers are read. |

## Bladeburner controller sketch (to be confirmed live)

- **RAM is the first constraint.** Most `ns.bladeburner` calls cost 4GB each (29 of them; a few cost 0 to 2GB,
  one 10GB and one 15GB). A single all-in-one controller could need 40GB+ while home RAM starts small. Options:
  a small early controller (start action, read stamina and odds) and a fuller one later, or helper scripts that
  write JSON as MCP's surveys do. Measure with `mem` on entry.
- **Loop:** pick the action with the best rank (or money) per second whose low-end success chance is above a
  bar, keep stamina above about half of max (Hyperbolic Regeneration or Training when low), lower chaos with
  Diplomacy, and move city when population estimates or chaos favour another city.
- **Success odds are a range.** `getActionEstimatedSuccessChance` returns low and high; Field Analysis
  narrows the range. Use the low end until the range is narrow.
- **Skills:** spend skill points on a priority list (Blade's Intuition, Cloak, Short-Circuit, Digital
  Observer, Reaper, Evasive System, Overclock, Hyperdrive, ...), as a config file, so the order can change
  without code edits.
- **Black ops:** attempt the next one (`getNextBlackOp`) once rank allows and the low-end chance clears the bar.
  Never attempt Operation Daedalus (stop rule above).
- **Status file:** `bladeburner_status.json` for the HUD, metrics and STATE refreshes, in `runtime/` once pulled.

## Day-one measurements

1. BitNode multipliers (`ns.getBitNodeMultipliers`, available with SF5): hacking money, server growth, combat
   and Bladeburner rank and skill gain. They decide how much weight MCP versus Bladeburner gets.
2. Sleeve count and starting state.
3. `mem` of each Bladeburner call we plan to use, against home RAM.
4. After joining: action times, success ranges, stamina use per action, rank per action. Then design the
   controller.
5. Whether gang karma or Bladeburner gets the player and sleeves first.

## Entry checklist

1. Ken decides on destroying the daemon (done in principle: BN6 chosen 2026-11-14). Backup first (save export).
2. Destroy the World Daemon, choose BN6 in the BitVerse; read its description and modifiers on screen.
3. `python tools/profile.py switch bn6 --live` (refuses unless the game reports BitNode 6), `profile.py check`,
   then `run startup.js`.
4. Day-one measurements above, then design and write the Bladeburner controller and the
   `player_activity_controller` handoff.
5. New `STATE.md` objective, a run-1 install table, and update the scheduled task prompt (it names BN10).
