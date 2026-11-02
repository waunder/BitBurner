# Current BitBurner Handoff

Last refreshed: 2026-11-02 14:19 Pacific, on the PC. Sources: Steam game via
DevTools, Remote API status files.

## Current live state (supersedes everything below)

**Live 14:19 Pacific (game page, save over DevTools, status files):** node 15, hacking 777, charisma 1,024 (exp 52.7m), $2.02t, net $294m/s over 1 minute, karma -456, 16 installed, Boots queued. Bachman invited and `faction_join.js` accepted; the controller moved the player to Bachman hacking work unaided, so the 11:27 fix is now seen working. Stacks 4/4, no new resets.
**Rep:** was 6.5/s and unfocused at 14:14. Now 12.9/s, read twice (14:18, 14:19), with work focused and share on: 2.5k of the 375k, so about 22:20 Pacific if the rate holds; modelled, and it rises slowly with hacking. New `share_deploy.js cloud 8` took 8 cloud servers from `xp_filler.js` (threads 11.97m to 7.42m, so about 38% less hacking exp), leaving the servers held for MCP and stacks. Why 8: above about 2m threads share power barely moves. Rate matches share power about 1.58; `getSharePower` itself not read.
Other faction rep with no work is the game's passive gain, 1% to 10% of the work rate by favor (game source), not a darknet effect. Corporation bribes are not worth it at $1b a rep. Faction hacking work beats field and security here (game formula).
**At 375k, in this order:** `capital_policy.json` reserve 0; raise `charismaTarget` to 1500 in `player_activity_config.json`; back up and validate the save; `run aug_install.js --install`. Charisma 1,500 then needs about 400k exp with Boots, ESI and SmartJaw (modelled). Merciless needs a second crossing, which has never run: lifting past row 16 needs a host of difficulty 13 or more.
Worth deciding then: 472k Bachman rep gets donations next cycle (about 2 more hours, modelled), against a rep cap of 375k now. If `charisma_survey.js` still shows more charisma behind Bachman, the extra hours pay back at each later install.
This was the hourly task's first run on the PC.

**Game is live on the PC, 13:18 Pacific. The Mac copy is stale: do not start it there.** Export imported and hash matched. Connected with a clean full sync: 138 pushed, 29 pulled, none failed or missing. Seen 12:48-13:18: node 15, hacking 755, charisma 988, cash $898b, 16 installed, The B00ts of Perseus queued, install not done, focused Bachman work at 317.5k rep and 18.9 rep/s, reserve $100b. All four stacks batching at full money; the-hub loaded at 15% money and rebuilt by 12:57. Net $288m/s over 1 minute.
Not checked on the PC: running beside Cities: II, `dnet_promote.js` thread count, `dnet_root.js`. `dnet_status.json` and `dnet_roi_current.json` hold old data; `dnet_scout_status.json` is live. This PC pushes over SSH (key `Kens-PC BitBurner`, added 2026-11-02).
**Live 13:32 Pacific (status files):** $1.17t, net $343m/s over 10 minutes, the-hub $155m/s. Scout active at depth 7 (`dnet_scout_status.json`). Player on Bachman until its faction invites.
`tools/daemon_supervisor.py` restarts a dead daemon and reconnects the game; seen working 13:31 after the daemon was stopped on purpose (daemon back in 2s, connected 30s later, full sync clean). It runs hidden from the Windows logon task `BitBurner daemon supervisor` (Ken approved 2026-11-02; `tools/install_supervisor_task.ps1`), which does not start the game after a reboot. The app's hourly `bitburner-bn15-progress` task exists on the PC, saved in Auto mode, and runs only while the Claude app is open. Its first run is not yet seen.
`money_status.json` and the stack and capital status files are not pulled to disk; read them with `ctl-get`. A script restarted between 12:42 and 12:46 could have run a copy with garbled non-ASCII text from the first failed sync; a clean resync replaced the files, and none was seen misbehaving.

**Mac closed down for the PC move, 12:16 MST. The game is not running anywhere until the PC starts it.** Export taken 12:15:33: node 15, cash $191b (home upgrades took the $2.58t), hacking 749, charisma 982, karma -429, 16 installed, The B00ts of Perseus queued, install still held. File: `saves/bitburnerSave_pc-move_BN15_2026-11-02.json.gz` on the Mac (gitignored, gzip checked, player data parsed), SHA-256 28180fbecce89dcae95848a282e75615cba16052835aed9d261f68925a8426f6, handed to Ken through session Outputs. Mac game quit; `com.bitburner.remote-api-monitor` booted out, daemon stopped; hourly task disabled and to be recreated on the PC. PC prep was still in progress at shutdown. Continue at "On the PC" in `docs/pc-move-2026-11-02.md`, step 6. Import this file, not Steam Cloud. If you are on the Mac, this copy is stale: stop.
**Live 11:32 (status files):** $2.58t, net about $291m/s over 1 minute, the-hub $162m/s, omega-net $59m/s, silver-helix $44m/s, phantasy $21m/s. Reserve $100b. Remote API connected.

**Live 11:24-11:28 (game page, save over DevTools, status files):** node 15, hacking 725, charisma 957 (exp 24.4m), $2.43t, net about $300m/s, Bachman rep 227.6k at 18.35 rep/s as Operations Manager, karma -416. 400k lands about 14:05 MST at that rate. MCP, capital and darknet reporting; 47 `dnet_promote.js` threads. Boots still queued, install held. Hacking exp 43.4e9, so the 1PB cloud kept the rate from 10:33; income is unchanged by it (about $300m/s).
**Fixed a stall that was waiting at the invite:** charisma augmentations only took faction work while charisma was under `charismaTarget` (600), and it is 957. The player would have gone to the cheapest augmentation (Neural Wit at BitRunners) and worked up by price, leaving Enhanced Social Interaction and SmartJaw nearly last. `charismaAugs` now win regardless (deployed, controller restarted 11:27 with new `restart_player.js`, focus restored). The transition itself is unverified until the invite.
`capital_policy.json` (game file): `reserve` $500b to $100b and `homeRamTarget` 262144. Augmentations that matter cost under $100b and $1t/hour arrives, so the old reserve only delayed home RAM, which survives installs. Home steps fire at about $3.26t (about 12:10) and about $6.4t. Modelled, not observed. **Set `reserve` to 0 before the install**, or it stalls the rebuild.
Seen, unexplained: rep rose with no faction work, Tian Di Hui 14.9k at 05:00 to 41.8k, NiteSec 26.2k. Nanofiber Weave is already buyable. Neural Wit needs 4.1k more rep and Magnetism 9.3k: about 45 minutes in all, worth weighing just before the install, after 375k.

**Live 10:24-10:33 (save over DevTools, status files):** node 15, hacking 638, charisma about 915 (exp 15.2m, about 2,700 exp/s), $1.47t, Bachman rep 164.8k at 15.1 rep/s at 10:24, karma -401. MCP, capital and darknet reporting. Cruel lab solved, Boots queued, install held.
**Idle cash turned into hacking XP.** Faction rep rate follows hacking level, and cash was piling up against a need under $100b. `capital_manager.js` refused cloud RAM because MCP used under half of it, so the policy now has `cloudDemandFloor` 0 (`capital_policy.json`, game file). All 25 cloud servers went to 1PB, the game's cap: 401TB to 26.2PB for about $1.38t, 10:27-10:29. `xp_filler.js` threads 85,883 to 11.9m. Hacking exp 1.63e9 at 10:27:56 to 4.88e9 at 10:32:39, about 11m exp/s (about 100x the 2h rate before), hacking 594 to 638 in 5 minutes.
Modelled, not observed: hacking about 790 at the 14:40 invite. Faction rep about 11/s with share against 8.3/s, so the 375k lands about 23:40 tonight rather than 03:30. These servers die on install; only the cash is spent. Home upgrade ($3.16t) still buys itself at $3.66t, about 2 hours at recent income. Effect on income not yet measured; MCP average unchanged after 5 minutes.
**At the invite:** check `faction_join.js` accepted, the player moved to faction hacking work, and start share with `share_deploy.js network 256 128 1000000`; share RAM has to come from the filler. All unverified. `restart_capital.js` restarts the manager and restores focus.

**Live 09:25-09:47 (game page, save read over DevTools, status files):** node 15, hacking 583, charisma 854, $1.8t, net about $316m/s, Bachman rep 125.8k at 14.25 rep/s, on track for the 400k invite about 14:40 MST. Karma -386.
**Charisma exp is now 1,256/s, was about 190/s** (two saves 180s apart, 09:36-09:39; exp 7.54m to 7.77m). Save showed only 5 `dnet_promote.js` threads and they gave nearly all charisma exp, about 35 exp/s a thread. The solved Cruel lab is rooted with 128GB free, so `dnet_lab.js` now fills it: 31 threads, seen in the save. It dies with the next install because Cruel leaves the network; other hosts held 1,186GB free at 09:27, mostly unrooted.
Why it matters: exp resets on install, so this only adds company rep now (rate moved 13.9 to 14.25 with charisma and hacking, roughly in step with charisma). The lasting lesson is for after each install: exp rate adds 32 ln(k) to the level term, so many threads cut the rebuild. Bundle below ESI and SmartJaw noted: Nanofiber, Magnetism, Neural Wit, DermaForce add about x1.17; TITN-41 (25k, Silhouette), Golden Tongue and SoA Beauty need factions not reached.
After a solve, chains now start at `darkweb` to spread promoters; riders exit so their scouts stop keeping the status fresh. Live 09:46: spread worked, save shows 52 threads on 7 hosts (5 new since 09:43) and 1,572 exp/s over 120s, with the 31 on the lab. Promoters on ordinary hosts may die in mutations; lasting count not yet seen. Not tried after an install.

**Live 08:24-08:29 (game page, status files, one-shot probe):** node 15, hacking 568, charisma 836, $2.07t before spending, net about $281m/s over 10 minutes, Bachman rep 62.6k as Business Manager at 14.1 rep/s focused. MCP, capital and darknet all reporting; karma -370. Cruel lab reads solved, Boots queued, still held. Invite estimate: 200k rep (Operations Manager, 15.8/s) in about 2.7h, 400k about 3.5h later, so about 14:45 MST.
Faction rep after that is about 5.6/s at hacking 568, about 8.3/s with share, from rates seen earlier and not measured on Bachman: 375k is about 12.5 hours, so the charisma install lands about 03:30 on 2026-11-03. Rep, not cash, limits this: about $1t/hour arrives against rep that needs under $100b of augmentations for the two that matter.
Donations do not help yet: `getFavorToDonate` is 150. Favor: NiteSec 36, Tian Di Hui 18, Black Hand 13. 150 is about 472k total rep (fit: 25,500 x (1.02^favor - 1)). Earning 472k rather than 375k at Bachman would unlock donations there from the next cycle, about 1.5 more hours; decide then. Bachman company favor would gain 63 from rep so far; not enough to justify installing, because rep and charisma both reset.
Spent idle cash: `capital_policy.json` now has `homeRamTarget` 131072 and `reserve` $500b (game file, gitignored). Home went 8.19TB to 65.5TB for $1.42t at 08:27, which survives installs. Next step costs about $3.16t and will buy itself once cash passes about $3.66t. Effect on income not yet measured.
Running a one-shot while focused: click "Do something else simultaneously", then the Terminal sidebar item; end the script with `ns.singularity.setFocus(true)` to restore the rep rate.

**Live 07:29 (game page, status files):** node 15, hacking 547, charisma 826, $1.07t, net $244m/s over 10 minutes, Bachman rep 17.8k as Business Analyst. Bachman work is now focused (`focusWork`): 12.0 rep/s seen on the page, against 80% of that unfocused. The controller refocuses hourly, so the Steam game shows the work page, not the terminal, and `#terminal-input` is missing. Click "Do something else simultaneously" to get the terminal for up to an hour. Invite at this rate, rising with promotions: about 15:00 MST, not observed.
Checked and ruled out, 07:25: the `b-and-a` backdoor needs hacking 1,061. No early install: Boots, Nanofiber and 13 NeuroFlux give about x1.27, which needs about 1e8 charisma exp for 1,500. Rehearsing the row 16 crossing is not possible yet: migrations cap at the lab row minus 1, and the active lab stays Cruel until The Boots is installed. Infiltration pays well (Storm Technologies 8.7k rep a run, difficulty 3.48, above about 3.5 is barred) but the game fails any untrusted key event, so scripting it would mean defeating its automation check; not done. By hand it stays open to Ken for the 375k faction rep, and it gives no company rep.

**Live 07:15 (game):** `ops_hud.js` rewritten and deployed: automation health, player decision, next lab goal, attention list; its version string lives in `mcp_launch.js` too. `omega-net` and `silver-helix` show 2 stack resets each, cause unknown: the runner kept no reason. No more in a 2-minute sample at 07:16, money and security at ideal. New runs record `lastReset`; running stacks do not until restarted. ZB Leadership would add about 35 charisma exp/s (`formulas.work`, assumes per-tick gains) on 197/s passive, read 07:09: not worth leaving Bachman.

**Cruel lab solved, 2026-11-02 06:52 MST. `The B00ts of Perseus` is queued, read directly with `getOwnedAugmentations(true)`. Not installed.**
**Live 06:58 (game, status files):** node 15, hacking 529, charisma 821 (exp 5.1m at 06:51, mult 2.523), $602b, capital income about $167m/s, Remote API connected. Links: `quantum%matrix:1932` (depth 11) and `apex_sanctuary` (7).
Why chains stalled at 7: game source never places a host in rows 8, 16 or 24, and links join only adjacent rows. New `dnet_lift.js` moves a neighbour with `induceServerMigration`, and scripts on it survive. First live lift, 06:43-06:48: `quantum%matrix:1932` went from 7 to 11, `quantum-security` (difficulty 5) fell to 3. The rider's scout linked the host and started the walker; about 3.5 minutes from 06:49 to solved. `dnet_root.js` had two copies running; it now has one (pid 36295).
**Decision: hold the install.** Merciless (depth 19, charisma 1,500) needs about x1.84 level multiplier at today's exp; 1,500 on the current multiplier needs about 2.7e9 exp. Enhanced Social Interaction x1.6 plus The Boots and NeuroFlux covers it. Rep resets on install, so earning it now saves one rebuild. Installing now would carry only The Boots, Nanofiber Weave, Synaptic Enhancement and NeuroFlux. Corporate factions have `keepOnInstall` in the source: they should stay joined after an install, not yet seen live.
Player now works at Bachman & Associates (Business), which also sells SmartJaw x1.5. Live 06:57-06:58: 758 to 1,534 rep, 8.1 rep/s as intern, unfocused. Promotions apply automatically. The faction invites at 400k company rep (about 10 hours at modelled job rates, 300k with a backdoor on its server, not tried), then both augmentations need 375k faction rep (over 10 hours at faction rates seen so far). `faction_join.js` should accept it, and `charismaAugs` already lists both. Unverified: invite, join, faction work, promotions.
**Next:** if a much shorter route to x1.84 appears, take it. When Enhanced Social Interaction is affordable in rep: back up the save, `run aug_install.js --install`. Merciless needs a second crossing, at row 16; lift range is difficulty + 4 and the lab links from row 18.

**Live 05:00-06:07 MST (game, status files):** node 15, hacking 472, **charisma 735, past the Cruel gate of 600**, $134.8b at 05:00, capital income about $88m/s, Tian Di Hui rep 14.9k at 4.8/s. All managers running. Do not install until The Boots is queued: the gate needs charisma at solve time, and it resets.
Blocker was reach. Game source: only hosts at depth 11 link to the lab, and the Dark Net page shows only 3 past the deepest admin host, so "nothing at 12" on the page proves nothing. The one link sat on `travel_agency:8314`, depth 0, with 4GB free, too small for a scout, so chains restarted from a full `darkweb`.
Fixed and deployed 06:00: scouts use every link from `getStasisLinkLimit()`, chains and the walker start at the deepest, and charisma workers are killed when they alone block a link or hop. Seen live by 06:07: second link on `zenith-net` (depth 1) beside the first, chains reaching depth 5 and retrying from there. Not yet seen: a link deeper than 1, depth 11, or the Cruel lab.

**Second install done, 2026-11-02 03:26 MST.** Before it (03:25): hacking 399, charisma 426 (exp 526k), $68b, Tian Di Hui rep about 11k, karma -260. Installed Speech Processor, S.N.A, Nuoptimal, ADR-V1, Speech Enhancement, Neurotrainer I, Wired Reflexes and 6 NeuroFlux levels. Charisma mult 1.748 to 2.523, exp mult 1.544 to 2.177. Backup: `saves/bitburnerSave_pre-install2_BN15_2026-11-02.save`, validated (gitignored).
Why now: 600 needed about 8.9m exp at the old mult (exp was rising about 170/s) and needs about 442k at the new one. About $67b was left unspent: `--install` bought no home upgrade, so the cheaper of RAM and cores evidently costs over that (home 8.19TB, cores 2). Costs not read.
**Live 03:27:50 MST (game, status files):** node 15, hacking 1, charisma 178 (exp 3,339, about 36 exp/s from 03:26:41 to 03:27:50 with no training), $1.8k, MCP preparing n00dles and foodnstuff. Status 03:27:34: scout at depth 3, chain running. At 03:28:29 `money.js` showed $562k and crime income $19k/s, matching the Deal Drugs estimate of $20k/s; charisma 216 (03:28:28).
Fixed this run: while short of cash the player chose crime by karma rate, which picked Homicide at 1.5%; it now picks by money rate. `capital_policy.json` reserve is 0 on game and disk, because $600m would have stopped the rebuild. Raise it only when saving for an install.
**Next:** Cruel lab: depth 12, charisma 600, reward The Boots. The Dark Net page at 03:25 listed 46 hosts to depth 9, none at 12, and no lab on it. The labs need charisma at solve time, so solve before the next install. Merciless (1,500) needs about x1.85 more level multiplier: Enhanced Social Interaction x1.6 or SmartJaw x1.5 at 375k corporate rep.

**First install done, 2026-11-02 about 01:22 MST.** Hacking 376, charisma 329, $259b, NiteSec rep about 17k before it. Installed The Broken Wings
(`The W1ngs of Icarus`), 7 NiteSec augmentations and 8 NeuroFlux levels. 9 installed in all, so at least four more cycles. Leftover cash bought home RAM to
8.19TB, cores 2, which survived. Backup: `saves/bitburnerSave_pre-install1_BN15_2026-11-02.save`, validated (gitignored).

Rebuild found the player idle for about 30 minutes at hacking 1: `charismaTarget` 600 asked for Leadership with $1.6k, and `bestKarmaCrime` never returned a crime
because the game reports karma as positive. Fixed: under `minTrainingCash` ($10m default) the player does crime, chosen correctly (live: Deal Drugs). MCP now schedules on home
less 512GB, and `xp_filler.js` takes up to half of home. Live at 01:57 (game, status files): home 54% used, hacking 7, charisma 123 and rising without training, $2.6k, targets n00dles and foodnstuff.
Cash growth from home RAM not yet observed. Next lab is Cruel: depth 12, charisma 600. Faction rep and cloud servers are gone; `faction_join.js` skips city factions.
The Remote API dropped at about 00:20 (1006) and was reconnected from Options at 00:51; the game kept running.

**Live 02:03 MST (game, status files):** node 15, hacking 233, charisma 171 (mult 1.748, exp 7,852, +13.4 exp/s with no training), CyberSec joined, cash $640k, income about $12.5k/s and rising.
**Charisma route, replaces the risk note below** (`charisma_survey.js`, read 02:00; level = 1.1 x mult x (32 ln(exp+534.6) - 200)): 600 needs about 8e6 exp at today's mult, about 7 days at the current rate. Speech Processor (x1.2, 7.5k rep) plus
Speech Enhancement (x1.1, 2.5k rep), both at Tian Di Hui, lower that to about 830k exp once installed. Corporate augmentations reach far past 3,000: every level multiplier together is about x16, for example Enhanced Social Interaction x1.6 and SmartJaw x1.5 at 375k rep. Exp resets on install, so
plan an early install 2 as soon as the Tian Di Hui augmentations are bought, not waiting for the Cruel lab. Leadership would otherwise have blocked all rep work until charisma 600; `charismaAugs` in the player config now goes first, and `faction_join.js` travels to Chongqing for the invite at hacking 50, $1.5m (deployed 02:01).
Neither has fired yet: cash is under $1.5m because `capital_manager.js` keeps spending it. If cash stays low next run, reserve it with `reserve` in `capital_policy.json`.

## State before the install

The live save is **BitNode 15**, entered 2026-11-01 about 13:48 MST with
`ns.singularity.b1tflum3(15, "startup.js")`, on Ken's delegated choice of node.
BN5 gave no reward because SF5 was at its cap of 3. Owned: SF 1.2, 2.1, 4.3, 5.3.
The BN5 run ended at hacking 461, $9.1b and 67.6TB; a validated backup is
`saves/bitburnerSave_pre-flume_BN5x3_2026-11-01.save` (gitignored).

BN15 multipliers: hacking level and speed 0.6, server max money 0.8, starting
money 0.5, security 1.5, augmentations 3× cost, Daedalus needs 20 augmentations,
World Daemon difficulty 2. Script hack money is 1, against 0.15 in BN5. The Red
Pill is the fifth labyrinth reward and needs at least five installs and charisma
3,000 (`docs/red-pill-path-2026-11-01.md`). Gangs need -54,000 karma, and
karma reset to 0.

`capital_bootstrap.js` hands over to `capital_manager.js` when it fits. The
manager buys TOR, programs, home RAM and cloud RAM, then starts managers that did
not fit at startup. `player_activity_config.json` is on auto with physical
training off; player is on Shoplift. Ken gave full approval on 2026-11-01 to
finish BN15 with any changes, including purchases and installs. Choosing the
next BitNode still needs him. Why BN15, and the numbers: `docs/bitnode-choice-2026-11-01.md`.

`dnet_root.js` and `dnet_scout.js` are running live; the maze solver has not run live. Scheduled task `bitburner-bn15-progress` is enabled and runs hourly (confirmed 2026-11-01). Pause backup: hacking
182, $13.8m: `saves/bitburnerSave_pause_BN15_2026-11-01.save` (gitignored).

Stacked-batch trial on `omega-net`, 22:03 to 23:15 MST (`stack_status.json`): 341 batches, no resets,
$18.3b stolen, about $53.6m per batch, money and security held at ideal. It averaged $4.3m/s against
MCP's projected $1.4m/s for this target. At the intended one batch per 2s (seen live 23:15) that is
about $27m/s, not yet sustained. Launches nearly stopped while the Remote API was down, 22:14 to
23:00. Unproven guess: the game window is throttled when idle, which may also cause the repeated
1006 drops. `avgRate` and `incomePerSec` in MCP status understate income; compare `totalHacked`.

Live 21:03 MST (game): hacking 294, charisma 281, about $1.8b, 25 cloud servers at
639TB, home 512GB, Algorithms running. The game never paused; only the Remote API
was down from about 17:26 to 20:56, which Ken reopened. NiteSec joined; Sector-12 is
left for a deliberate choice. MCP used under 4% of cloud RAM (25TB), so `xp_filler.js`
now puts the idle part into hacking XP: 9.25m XP in 137s, about 67k/s against 810/s.
`capital_manager.js` stops cloud buying while MCP fills under 50%. MCP runs only on
cloud servers; the filler also fills rooted hosts (about 492GB). The daemon rereads
`sync_manifest.json` each pass. Unknown: whether the filler lowers MCP income, which
read 0 at 21:03 between harvests and averaged $2.7m/s; compare before keeping it.

Live 21:32 MST (status files): `th3_l4byr1nth` seen from `austin`; `dnet_lab.js` stopped on charisma
297/300 and has not walked the maze. Best scout depth is 6 (`byte:web`), up from 2, and that host
holds the stasis link, applied live, so chains now start there (`dnet_anchor.js`). At 21:44 `byte:web` had no neighbours, so a dead end there now starts one chain from `darkweb`. Keep the link on one
deep host; limit is 1 until Broken Wings. Money $12.4b, MCP $3.1m/s average, hacking XP 68k/s.
Leadership is ahead of hacking gates up to `charismaTarget` 600, at ZB in Volhaven (live 21:42 MST).
In scripts never name a variable `attempt`: the RAM check bills 10GB.
Three runs of this task overlapped at 21:06-21:18 and edited the same files. Before editing, run
`git status` and check no other BN15 session is running.

Live 22:03 MST (status files): the maze solver walked for the first time, from `digital:hydr0_tech`, 5 rooms
at about 5s each with 1 thread, then the link dropped after about a minute and it waited (expected). Charisma
307, hacking 357, money $23.6b. `dnet_lab.js` now waits for lab links and keeps its pid position; `dnet_root.js`
keeps one on the stasis host (`byte:web`) and scouts give it all free threads.

**Live 22:09 MST: first labyrinth solved** from `bungo`, 17 moves, 2 threads, about 4s a move. `dnet_loot.js` opened the
cache and The Broken Wings is queued, listed in game as `The W1ngs of Icarus` (read 22:11 with `getOwnedAugmentations`).
Installed 0. Hacking 364, charisma 315, money $32.7b, factions NiteSec and The Black Hand, karma -188.
Next: buy every augmentation rep allows (nothing automates this; capital_manager never touches augmentations), back up
the save, then install. Not installed yet because $32b is idle and only rep limits what the first install carries: hold for
faction rep no more than about two hours. Before the install set `charismaTarget` to 600 in `player_activity_config.json`.

**Live 23:22 MST (game, status files):** node 15, hacking 369, charisma 317, money about $75b at about $53m/s over two
minutes, NiteSec rep 6,828, Black Hand 1,892, karma -188. Remote API dropped at about 22:15 and was reconnected from
Options at 23:15; the game kept running. Player now works for NiteSec: new `repBeforeGates` config puts rep ahead of hack
gates, restarted live. Rep 2.24/s, 2.59/s with 64 share threads on home (`share_deploy.js balanced`, running). NiteSec
jumped 4,508 to 6,204 and Black Hand 211 to 1,881 within a minute around 23:17, cause unknown.
**Install plan:** rep only reaches about 14,000 by 00:10, which is the agreed limit, so install then. Steps: back up the save, set
`charismaTarget` 600, `run aug_install.js --install` (new; buys dearest first, then NeuroFlux, restarts `startup.js`; only
`--dry` has run live, planning BitWire alone at 6,800 rep). Install loses cloud servers; rebuild is expected. Home RAM and cores
survive (game source: only the BitNode reset clears them), so `--install` now spends leftover cash on them last; that part has not run live.

**Live 23:32 MST (game, status files):** $96b+, hacking 371, charisma 319 (exp 190k), NiteSec rep 7,490 (read 23:29). Hacking XP is lost
on install, so until then 99,172 share threads run across cloud and rooted hosts (`share_deploy.js network 256 128 100000`), share power
1.466 against about 1.17 before; expected rep about 3.3/s, not yet measured. `xp_filler.js` was restarted and fills only what is left. Stack
held afterwards: 52 batches in 116s, about $57m/s, money 100%, no resets. Install after 00:10 as planned; the share threads die with it.

**Live 23:58 Pacific (`money.js`, new, replaces `mcp_money.js` at startup):** cash $191b, net $63.6m/s: `omega-net` $60.4m/s, other hacking $3.2m/s. Per TB of RAM the stack
earns $3.69m/s against MCP's $102k/s. Four augmentations are ready for $2.53b; all 12 on offer cost about $726b, so rep limits now and cash could limit a big buy. `mcp_money.js` is still running until
the next startup. Launch stalls (7 batches in 148s at 23:56; 2 in 30s at 00:04 with 40,920GB in flight) are the 40TB `ramBudget`, not `xp_filler.js`: launches burst at one per 2s, stop at the budget, then resume as batches land. Stack average 23:41-00:03 was $38.6m/s, so $60m/s is the burst peak; the 10-minute figure at 00:06 was $26.1m/s, and yield $657k/TB against MCP $287k/TB, not the 36x of the first 1-minute sample. Default budget is now 64TB, needing a new stack run; the running stack keeps 40TB. `xp_filler.js` holds 64TB of whole cloud servers while a stack runs.
Modelled targets at hacking 373, one batch per 2s (survey 00:06, not run live): the-hub $116m/s 143TB, omega-net $57m/s 59TB, silver-helix $45m/s 58TB, phantasy $23m/s 17TB. `stack_batch.js` handles one target: status file, port and MCP skip would need per-target versions.
MCP's `totalHacked` and `avgRate` come from the game's whole `hacking` total, so they include the stack; `stack_status.json` `perSec` averages from 22:03 and reads low.

**Superseded by the 02:03 route above.** Fit to live values: level = (32 ln(exp+535) - 200) × 1.1 × mult, mult 1.5376 now (the 1.1 is inferred).
At mult 1.75, roughly what the lab rewards give, 1,500 needs about 2e13 exp and 3,000 is out of reach; exp is 190k after 10 hours. The route needs
charisma-multiplier augmentations (for example Speech Processor) well before the Merciless lab. Not yet priced or planned.

Scout moving the link beside the lab returned false
at 22:03, reason unknown (likely under 14.2GB free). The Dark Net page holds the full topology (read by
`tools/dnet_map.py`), but links reshuffle about every minute, so a long route goes stale; the anchor works better.
Charisma target is now 300: it resets on install, and the 600 lab needs Broken Wings installed. Raise it after
that install. Player is on Algorithms at Rothman (live 22:00). Capital manager is idle with $23b while MCP fills
under 50%; money has no use until faction rep or the install. Sector-12 and Volhaven invites are still open.

DevTools runs on 127.0.0.1:9222 through the Steam launch option.

## Earlier snapshot, 2026-11-01 10:45 MST

The save was reset by an augmentation install on 2026-10-31 20:18 local (4
installed, none queued, no factions, no gang). Everything from "Current
objectives" down predates that reset and is history until revalidated.
At 2026-11-01 10:45 MST: Remote API connected with full sync; hacking 284,
money about $466m after contracts; 17 rooted workers, 524GB, no cloud servers;
MCP on money in finite cloud mode, target phantasy; player activity on manual
override, doing Larceny. `gang-controller.js` failed in `startup.js` for RAM
(39GB needed, 23GB free on home); harmless while there is no gang.

Both pending `Largest Rectangle in a Matrix` contracts were accepted ($16.7m,
$50m) with the new solver; the queue is idle. Contract work now uses free RAM
beside finite cohorts, so cloud mode no longer starves it. The pending
post-install resilience edits are committed. All 347 tests pass.

## Current objectives

Gang focus is the reversible `cash` objective; no territory acquisition is
being pursued. At 17:29:07 PDT the live controller reported all 12 members on
Money Laundering, projected gang money rate about $3.47m/s, Black Hand rep
1,337,477, wanted level 60,947, wanted penalty 0.9974, and no territory
warfare/clash. The cash objective suppresses combat training and Territory
Warfare power building while preserving wanted cleanup and recruitment
priorities. The override had reverted to `money`; it was reset to `cash` and
the next controller report confirmed all members reassigned. Switch to
`money` only to resume territory training/power behavior, or `reputation` for
faction respect. The 2.5m Black Hand Red Pill gate remains a future objective
for this BitNode 2 run. Refresh MCP status before relying on its current
objective or rate.

Remote API monitor was connected at 17:28:55 PDT; a fresh full sync completed
with 104 source files and no sync failures. Its telemetry pull returned 21/29
files on this connection. The cash-mode code is deployed; only the persistent
objective override needed reapplying. No augmentation purchase or install was
performed in this turn.

The five-minute wanted-level heartbeat remains active. It should alert if
wanted reaches 100k while rising, rises by 10% or 10k between reads, or stays
above 50k without declining. Latest live wanted level is 60,947; its rate is
about +0.0475 per gang cycle and cleanup is currently off because the wanted
penalty is above the controller's 99.5% entry threshold.

See `AGENTS.md` for standing authority and the augmentation-install approval
boundary.

At 00:38 PDT on 2026-10-27, after deploying and restarting widened cleanup hysteresis (enter 0.998, exit 0.999), telemetry showed mode=wanted-recovery, cash objective, cleanup active, wanted 61,039.65 with actual -6.6859/cycle and projected -6.6793/cycle, penalty 0.995344, gang respect 13.0488m, and faction reputation 1.3823m. Recovery is live and reducing wanted; keep the controller unchanged while the rate remains negative.

At 01:33 PDT on 2026-10-27, Steam UI showed wanted 17,574.83 falling at -6.45225/sec, penalty 0.11%, gang respect 15.67104m, faction reputation 1.652m, with Ethical Hacking active. Recovery is healthy after the hysteresis widening.

## Prior wanted-monitoring snapshots

These earlier observations are retained for incident evidence; the current
live level and cash objective are recorded above.

Remote API `gang_status.json` at 16:22 PDT reports wanted 66,680 and rising
at +0.0895/cycle, with wanted penalty 0.9907. The controller is in
`territory-training` with `cleanupMode=false` despite the wanted level being
above 50k. This is a material regression from the prior recovery window and
is recorded in `docs/gang-monitoring-2026-10-26.md`; inspect the transition
guard before changing behavior.

After the bounded threshold change and controller restart, the 16:36 PDT
readback showed wanted 57,403 and falling at -6.16/cycle, cleanup active with
one cleaner, projected rate -6.16/cycle, and penalty improved to 0.99244. The
change is retained pending continued decline.

At 16:41 PDT wanted crossed below 50k to 48,824 and continued falling at
-5.30/cycle; cleanup remained active and penalty improved to 0.99371.
At 20:36 PDT, after reconnect, wanted had risen back above 50k to 50,281 at
+0.112/cycle with cleanup off and penalty 0.99507. This is a fresh regression
requiring a bounded review of the cleanup exit threshold.

At 22:06 PDT on 2026-10-28, Remote API reconnected and completed full sync/pull (104 pushed, 29 pulled), but `gang_status.json` remained stale with embedded timestamp 2026-10-27 20:25 PDT and unchanged cash-mode telemetry (wanted 20,700.23, projected/actual rate +0.055/cycle, penalty 0.99917, cleanup false). Treat this as a controller telemetry-freshness/watchdog fault: connection health is restored, but current gang trend and controller liveness are not yet verified. Do not infer present wanted behavior from this stale file.

At 22:54 PDT on 2026-10-28, after reconnecting Steam Remote API, I started `gang-controller.js` from the in-game terminal (PID 317). It exited immediately with `gang v2: no gang`. This confirms the old `gang_status.json` snapshot (wanted 20.7k, cash mode) is historical from a prior gang and must not be used as live state. Current save has no gang, so gang wanted level, penalty, respect, faction reputation, recovery allocation, and controller objective are presently inapplicable.
