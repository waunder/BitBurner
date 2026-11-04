# BN10 attack plan

Written 2026-11-03, while BN15 is still running. Rationale and source-verified rules:
`docs/bn10-assessment-2026-11-03.md`. Entering BN10 is Ken's decision, made at the
World Daemon. Until then, nothing here is deployed to the live game.

## Goal

Leave BN10 with SF10.1 and as many permanent Covenant sleeves as cash allows: the first is
$10t, the second $100t. Sleeve memory upgrades also persist. Sleeves then add a parallel
worker for faction rep, karma and money in every later BitNode.

## Phases inside BN10

1. **Rebuild (hours 0 to about 6).** As in every node: crime for cash, TOR, programs,
   MCP. Home starts small and costs 1.5x, cloud servers cost 5x with 60% of the count and
   half the max RAM, and hacking level is x0.35. Expect much slower income than BN15.
2. **Sleeves on from the first hour.** BN10 gives 2 sleeves at once (SF10 level 0, +1 for
   being in BN10, and the base is min(3, ...)). They start at shock 100 and earn nothing, so
   shock recovery comes first (about 18.5 game hours from 100 to 0). Then they work in
   parallel: karma for the gang, rep for the next augmentation, then money.
3. **Augmentations.** Prices are x5 money and x2 rep, so installs are fewer and later.
   `aug_install.js` and the readiness planner already price from the game.
4. **The Covenant.** Join, then buy sleeves and memory when cash allows. Its requirements
   need checking in the source (work package B). Combat stats are x0.4 per level, so expect
   long gym time; sleeves can train too.
5. **World Daemon** (difficulty 2, same as BN15). Stop there for Ken.

## Constraints every package must respect

- **RAM.** Every `ns.sleeve` call costs 4GB, and a script is billed once for each distinct
  function it references. A controller using 6 functions is about 26GB, and early BN10 home
  RAM is small. Keep sleeve scripts lean, and keep pure logic in a separate `*_logic.js` file
  with no `ns` calls so it can be tested and costs nothing.
- **Not live yet.** Do not add new BN10 scripts to `sync_manifest.json`, and do not run
  anything in the Steam game. The live save is BN15. Work stays on your branch; it is
  merged when BN10 starts.
- **House style.** `AGENTS.md` and `docs/processes.md` are the guides. Logic files have
  `*.test.js` tests, run with `node --test *.test.js`, and all of them must pass. Document
  each new script in `docs/processes.md`: start, args, files read and written, failure
  modes. Match existing comment density, which is short "why" comments only.
- **Verify game rules against source, not memory.** Use bitburner-src `dev` (raw files at
  `https://raw.githubusercontent.com/bitburner-official/bitburner-src/dev/<path>`). Quote the
  rule in a comment or the docs when it drives a decision. `NetscriptDefinitions.d.ts` in the
  repo is the API reference.

## Work packages

### A. Sleeve controller

`sleeve_logic.js` (pure), `sleeve_logic.test.js`, `sleeve_controller.js` (thin, lean RAM),
`sleeve_status.json`, and a Sleeves line in the HUD (`hud_consolidated.js`).
Per sleeve, per poll: shock above a threshold means shock recovery. Low sync can mean
synchronize, but only if the source shows that sync matters for the chosen work: rep is not
scaled by sync, while karma and exp are. Otherwise take the highest-value job:
1. Crime for karma while the player's karma is above `crimeKarmaTarget` (-54000, gang).
   Sleeve karma is credited at x sync.
2. Faction work for the faction the player controller is not working, toward the
   readiness planner's next augmentation (`augmentation_readiness.json`). Check in source
   whether two workers may share a faction.
3. Crime for money.
Read `player_activity_status.json` and `augmentation_readiness.json`; do not change the
player's own work. Must idle cleanly, with one status line, when the Sleeve API is
unavailable (BN15 without SF10).

### B. Covenant path and sleeve purchases

Verify The Covenant's invite requirements in source. Add a goal to
`player_activity_logic.js` that trains the missing stats toward those requirements once
installs allow. `faction_join.js` should accept the invite; check that. Add
`sleeve_buyer.js` with pure logic in `sleeve_buyer_logic.js`, BN10 only. It buys a Covenant
sleeve when cash above the `capital_policy.json` reserve covers `getSleeveCost()`, and
memory upgrades after that. It must record cost, expected payoff and the outcome (AGENTS.md
capital rule). Do not touch `sleeve_*` controller files (package A) or
`hud_consolidated.js`.

**Status 2026-11-04: implemented on branch, not live.** Verified in bitburner-src `dev`:

- Invite rule, `src/Faction/FactionInfo.tsx`, `FactionName.TheCovenant`:
  `inviteReqs: [haveAugmentations(20), haveMoney(75e9), haveSkill("hacking", 850), haveCombatSkills(850)]`.
  `haveAugmentations(n)` in `src/Faction/FactionJoinCondition.ts` tests `p.augmentations.length >= n`:
  installed only, queued ones do not count. `haveCombatSkills(n)` is every one of strength,
  defense, dexterity and agility at least `n`. The faction name string is "The Covenant"
  (`src/Faction/Enums.ts`). A rumor (not an invite) shows in BN10 at 10 augs, $35b, 425/425.
- `faction_join.js` joins every invite except the six city factions, so a Covenant invite is
  accepted unchanged; no fix was needed.
- `src/PersonObjects/Sleeve/SleeveCovenantPurchases.tsx`: `purchaseSleeve` needs BN10,
  Covenant membership, fewer than 5 bought and cash >= `getSleeveCost`; cost is
  `10^bought * 10e12`. `purchaseSleeveMemoryUpgrade` needs BN10, membership, memory + n <= 100;
  n points cost `1e12 * sum(1.02^(memory-1+i))`. Both return `{ success, message }`.
  `src/NetscriptFunctions/Sleeve.ts`: `purchaseSleeve` and `upgradeMemory` throw outside BN10
  (`checkBitNodeRequirement`); `getSleeveCost` and `getSleeve` need only Sleeve API access.
- Built: `covenantTarget` goal in `player_activity_logic.js` (off by default, BN10 only),
  `sleeve_buyer.js` and `sleeve_buyer_logic.js`. See `docs/processes.md`.
- Not verified: the RAM cost of each `ns.sleeve` call (taken as 4GB per the brief), and
  whether `ns.getPlayer().factions` lists The Covenant immediately after `joinFaction`.

### C. BN10 readiness audit of the existing suite

Read-through plus small fixes, with tests, for anything that assumes BN15:
- Darknet scripts (`dnet_root.js` and its family) must idle cleanly if the darknet is
  absent or restricted outside BN15 with SF15.1. Check in source what SF15.1 grants elsewhere.
- `startup.js` and `mcp_launch.js` must bring up on a fresh 8GB home in a sensible order
  with 1.5x home RAM cost.
- `capital_manager.js` and `capital_logic.js` with 5x cloud cost, 0.6 limit and 0.5 max RAM.
- `aug_install.js` and its planner with x5 money and x2 rep, including donation thresholds.
- `player_activity_logic.js` defaults (`charismaTarget` and the labyrinth gates are BN15-only).
Write findings to `docs/bn10-readiness-audit.md`. Each must be marked fixed, safe as is, or
needs Ken. Do not touch `player_activity_logic.js` beyond config defaults (package B owns
its logic), and do not touch `hud_consolidated.js`.

Later, not yet assigned: grafting automation, and Bladeburner (sleeves can do it, but it
needs Bladeburner, which BN10 does not give).

## Status, 2026-11-03

Packages A, B and C are built by subagents, reviewed, and merged on branch `bn10-prep`
(492 tests pass). The branch is not merged to `main`, because `main` syncs to the live BN15
game. Details: package reports in `docs/processes.md`, audit in `docs/bn10-readiness-audit.md`.

## Checklist at BN10 start

Do these after Ken has chosen BN10, the World Daemon is destroyed, and the game is in BN10:

1. Merge `bn10-prep` into `main`. Add `sleeve_controller.js`, `sleeve_logic.js`,
   `sleeve_buyer.js` and `sleeve_buyer_logic.js` to `sync_manifest.json` in the same commit.
2. `player_activity_config.json` is BN15-tuned (audit, needs Ken): set `charismaTarget` 0,
   drop `companyTarget`, clear `priorityAugs`. Set `covenantTarget` true once installs near 20.
3. `capital_policy.json` (a game file): set `reserve` and `homeRamTarget` once BN10 income is
   known. Raise `reserve` toward $10t when the first Covenant sleeve is near, because
   `capital_manager.js` spends the same cash.
4. Start `sleeve_controller.js` in the first hour, for 2 sleeves on shock recovery. It needs
   about 26GB, so start it once home has room. Start `sleeve_buyer.js` after joining The Covenant.
5. Darknet: the Red Pill still comes from the 4th lab in BN10. Decide early with
   `dnet_roi.js` whether that beats Daedalus at hacking x0.35.
