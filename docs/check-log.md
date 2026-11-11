# BitBurner check log

Detailed entries from the 2-hourly task and from Ken sessions, newest first. `STATE.md` holds only
the current handoff; this file is the running record behind it. Read it when you need a past
measurement or decision, not at every session start.

Entries before 2026-11-10 (BN10 run 1, BN15, earlier) are in
`docs/archive/state-2026-11-10/STATE-full.md`, the full STATE.md as it stood on 2026-11-10.

## BN10 run 2

**2026-11-11 01:15 Pacific, 2-hourly task, BN10 run 2: The Red Pill queued (bought by hand about 01:12); third unplanned install at 23:48 (85 -> 86); no install by me.** Not a stand-aside run (session list: nothing running; Ken's session idle since 19:53). Live (metrics sample 01:15, readiness 01:14, game `ps` 01:15): BN10, $604t, hacking 3223, str/def/dex/agi 20850/31501/3159/6908, cha 15397, karma -117k, 86 installed, 1 queued (The Red Pill). All 20 residents running at PIDs 2-24 (again a `startup.js` callback pattern), player on Daedalus hacking work (`favorTarget` Daedalus). **What happened:** samples 23:40 and 23:45 show 85 installed, 1 queued (bought about 23:35-23:40; the ledger shows only -$3.5b and -$41b augmentation spend those windows), $155t; `resetAt` 23:48:52; 23:55 86 installed, 0 queued. Daedalus had 129k rep at the reset, which banked favor 183.3 (past the 150 needed to donate). Then between the 01:10 and 01:15 samples The Red Pill appeared in the queue: money unchanged except income, `augmentations` spend 0, no donation, Daedalus rep 1.29m -> 1.41m at its normal rate. Only `core/player/aug_install.js` calls `purchaseAugmentation` or `installAugmentations` in the repo, and its status is still install 9's (19:17). So a person, most likely Ken playing directly, bought it, and probably did the three installs (each is a sensible manual step toward Daedalus favor). I ran `clear` in the game terminal at 01:15 before `ps`, which would have erased any terminal trace; the player stayed on Daedalus work. **Decision: do not install now.** The advisor says **wait** ("gang cycle minimum: 2.6h more", a stale reason; plan QLink via an $795b Illuminati donation at favor 172, batch value 1.37 vs cycle average 0.95). Installing The Red Pill is the plan's next step and is approved, but someone appears to be acting in the game this minute; racing them risks a double install or cutting off their purchases. Next run installs it with a backup if it is still queued and nothing new has happened in the last 15 minutes. Measured, 12 samples 00:20-01:15: rep/h NiteSec 2.41m, Daedalus 1.2m, BitRunners 375k, The Black Hand 345k, Tian Di Hui 328k, Tetrads 325k, CyberSec 314k, Slum Snakes 309k, Illuminati 301k, The Syndicate 280k, The Covenant 222k; hacking exp 20.2b/h (275 levels/h), karma -474/h, cash 554t/h, MCP rate 213b/s average 96.1b/s, share 1.55. Trend: `cash/h -->-->554t n/a | MCP -->-->213b n/a | hackExp/h -->-->20.2b n/a | lvl/h -->-->275 context | rep work Daedalus -->-->1.2m n/a | rep best NiteSec -->-->2.41m n/a` (cycle 1.4h). `metrics.py cycles`: cycle 12 (23:00-23:48, 0.81h, rebuild hacking 0.41h): rep earned NiteSec 1.65m, BitRunners 157k, The Black Hand 147k, Tian Di Hui 137k, Illuminati 129k, CyberSec 129k, Slum Snakes 128k, Tetrads 126k, Daedalus 112k, The Syndicate 104k, The Covenant 64.2k; favor banked none tracked (Daedalus 145.3 -> 183.3 by readiness). `metrics.py pull` failed again ("chunk exceed the limit"); the daemon's own pull kept `runtime/metrics_log.txt` current. Run target: Red Pill step relabelled "queued, install it", pushed. World Daemon: not present (The Red Pill queued, not installed). Share A/B: recorded 2026-11-05.

**2026-11-10 23:15 Pacific, 2-hourly task, BN10 run 2: second unplanned install, at 23:00 (84 -> 85), cause unknown; no changes made.** Not a stand-aside run (no session running; Ken's session idle since 19:53, Codex app open but its log shows only idle polling, nothing about the game). Live (metrics sample 23:15, readiness 23:13, game `ps` 23:18): BN10, $49.8b, hacking 2013, str/def/dex/agi 11693/17666/2641/3874 at 23:15 (agi 45 at 23:05), cha 10169, karma -116k, 85 installed, 0 queued. All 20 residents running at PIDs 2-24; PID 1, which has exited, fits a `startup.js` callback after an install. MCP status 1s old, target fulcrumtech. **What happened:** samples 22:55 $546t, 84 installed, 0 queued, player on Illuminati hacking work ("needs +3.3m rep for QLink"); 23:00:00 $39.1t, 1 queued, income ledger `augmentations` -$549t (so one augmentation for about $549t was bought between 22:55 and 23:00); `resetAt` 23:00:07; 23:05 85 installed, 0 queued, $3b. `aug_install_status.json` (ctl-get) is still install 9's record (19:17), and that script writes it before installing. Nothing in `core/` or `profiles/` other than `aug_install.js` calls `installAugmentations` or launches `aug_install.js`; no HUD has an install button. Game-only leftovers checked: `operator_purchase_augmentations.js` buys but never installs; `install_full_money.js` and `qlink_observe.js` do not touch augmentations. Which augmentation was bought is not visible from the files I have (the readiness owned list does not mark order, and QLink is not owned). No backup preceded it. Cost: Daedalus rep 364k banked as favor about 145.3 (not 150); Illuminati and Covenant rep reset. Same pattern as 21:20 (single item, no record, reset with a startup callback). Measured, 3 samples 23:05-23:15 (new cycle, 0.25h): rep/h NiteSec 2.25m, The Black Hand 135k, BitRunners 121k, Tian Di Hui 104k, CyberSec 99.4k, Slum Snakes 97.5k; hacking exp 1.05b/h (1.87k levels/h), karma -533/h, cash 281b/h, MCP rate 174m/s avg 380m/s, share 1.39. Trend: `cash/h -->-->-- n/a | MCP -->-->-- n/a | hackExp/h -->-->-- n/a | rep work n/a | rep best n/a` (cycle 0.25h). `metrics.py cycles`, cycle 11 (21:20-23:00, 1.66h, rebuild hacking not reached, rep rate 0.49h): rep earned NiteSec 3.25m, Illuminati 493k, Daedalus 364k, BitRunners 288k, The Black Hand 259k, Tian Di Hui 243k, Tetrads 235k, CyberSec 228k, Slum Snakes 222k, The Syndicate 183k, The Covenant 61.8k; favor banked Slum Snakes +16.0, Tian Di Hui +11.5, NiteSec +3.2 (Daedalus 144.6 -> 145.3). Advisor 23:13: **build** ("nothing to install; value lies in factions not yet joined"). Decision: **agree, no install**; the cycle is 15 minutes old. Player in gym (dex/agi) toward Daedalus's combat 1500 (agi is the gap), `favorTarget` Daedalus. `metrics.py pull` failed again ("chunk exceed the limit"); the daemon's own pull kept `runtime/metrics_log.txt` current. World Daemon: not present (no Red Pill). Run target unchanged. Share A/B: recorded 2026-11-05.

**2026-11-10 21:15 Pacific, 2-hourly task, BN10 run 2: unplanned install at 21:20 (83 -> 84), cause unknown.** Not a stand-aside run (no session running; Ken's session idle since 19:53). Live at 21:15 (metrics sample 21:10, readiness 21:15, game `ps` 21:16): BN10, $331t, hacking 2215, str/def/dex/agi 16398/24775/1807/5953, karma -115k, 83 installed, 1 queued (The L4w of Bayes, a darknet reward). **Daedalus joined** this cycle (all combat past 1500); the player was on Daedalus hacking work under `favorTarget` Daedalus, rep 387k, favor gain pending 142.5 of the 150 needed to donate (462.5k rep). Every resident running (19 plus gang-controller). Measured, 12 samples 20:15 to 21:10: rep/h NiteSec 1.76m, Daedalus 261k, BitRunners 212k, The Black Hand 186k, Tian Di Hui 170k, Tetrads 168k, CyberSec 155k, Slum Snakes 149k, The Syndicate 92.6k, Illuminati 45.2k, The Covenant 17.1k; hacking exp 15b/h (127 levels/h), karma -362/h, cash 346t/h, MCP rate 122b/s average 79b/s, share 1.55. Trend: `cash/h -->-->346t n/a | MCP -->-->122b n/a | hackExp/h -->-->15b n/a | lvl/h -->-->127 context | rep work Daedalus -->-->261k n/a | rep best NiteSec -->-->1.76m n/a` (cycle 1.9h, one window). Advisor 21:15: **wait** ("gang cycle minimum: 2.0h more"; next QLink 81.7h). Decision: **wait about 15 minutes**, differs only in reason: Daedalus would reach 462.5k rep (favor 150) about 21:31, then install so the next cycle donates for The Red Pill's 5m rep (run 1's route). `metrics.py pull` failed again ("chunk is longer than limit"); the daemon's own pull kept `runtime/metrics_log.txt` current.

**What happened instead:** between the 21:20 and 21:25 samples the game reset (`resetAt` 21:20:29). Samples: 21:20 $365t, 83 installed, 1 queued, Daedalus 413k; 21:25 $1.2b, 84 installed, 0 queued, hacking 1311, no Daedalus. Only the queued L4w of Bayes was installed; $365t went unspent. `aug_install.js` did not do it: `aug_install_status.json` (read from the game with `ctl-get`) is still install 9's record from 19:17, and that script writes its status before installing. Nothing else in `core/` or `profiles/` calls `installAugmentations`. Residents came back at PIDs 2-24 (game `ps` 21:34), which looks like a `startup.js` callback, so the cause is unknown; the game's Install button or a manual `installAugmentations` call would fit. No session was running. I had cleared the game terminal at 21:16 and 21:33, so any terminal trace is gone. No save backup preceded it. Cost: $365t (about an hour's income) and roughly 12 minutes of Daedalus rep: favor banked about 144.6 (413k rep), not 150. `metrics.py cycles`: cycle 9 (16:15-19:17, 3.04h, rebuild hacking 0.25h, rep rate 0.50h): rep earned NiteSec 5.31m, BitRunners 309k, The Black Hand 241k, Tian Di Hui 158k, Tetrads 153k, CyberSec 140k, Slum Snakes 128k, The Syndicate 47k, The Covenant 6.82k; favor banked NiteSec +6.3. Cycle 10 (19:17-21:20, 2.05h, rebuild hacking 0.13h, rep rate 0.46h): rep earned NiteSec 3.7m, Daedalus 413k, BitRunners 370k, The Black Hand 324k, Tian Di Hui 298k, Tetrads 287k, CyberSec 272k, Slum Snakes 259k, The Syndicate 158k, Illuminati 72.8k, The Covenant 27.3k; favor banked (tracked) Slum Snakes +29.0, NiteSec +3.9 (Daedalus not tracked on a first join; about +144.6 by the formula).

**Next:** rejoin Daedalus (combat 1500 all, or hacking 2500; at 21:30 dex 1347, agi 36, hacking 1378; last cycle got there inside 2h). At favor about 144.6, Daedalus needs about 50k more rep (rate x2.45 from favor) for favor 150; `favorTarget` Daedalus sends the player there. Then install with a backup, rejoin, `aug_install.js` donates for 5m rep and buys The Red Pill, install. Run target's Red Pill label updated and pushed. World Daemon: not present (no Red Pill). Share A/B: already recorded 2026-11-05.

**BN10 run 2, install 9 ran 2026-11-10 19:17 Pacific, 2-hourly task: 17 bought + 2 NeuroFlux, 65 -> 83 installed.** Not a stand-aside run (no session running; Ken's session idle since 18:31, allocator-design worktree since 16:42). Before (metrics sample 19:10, readiness 19:14, game `ps` after): BN10, $36.8t (19:10) to $40.5t (19:17), hacking 1314, str/def/dex/agi 5602/10457/1009/2185, cha 8082, karma -114k, 65 installed, 1 queued (The St4ff of Asclepius). Covenant member (rep 6.8k). Player in Rothman's Algorithms class (H1316 -> 1345 for fulcrumassets). `metrics.py pull` failed ("chunk is longer than limit" from the daemon), but the daemon's own pull kept `runtime/metrics_log.txt` current (19:15), so the summary is fresh. Measured, 12 samples 18:15 to 19:10: rep/h NiteSec 1.34m, The Black Hand 68.9k, BitRunners 65.5k, Tian Di Hui 62.5k, Tetrads 61.7k, CyberSec 54.7k, Slum Snakes 51.5k, The Syndicate 18.9k, The Covenant 2.92k; hacking exp 9.95b/h (44.2 levels/h), karma -538/h, cash 26.8t/h, MCP rate 11.3b/s average 4.4b/s, share 1.56. Trend: `cash/h -->9.43t>26.8t n/a | MCP -->3.18b>11.3b n/a | hackExp/h -->9.89b>9.95b n/a | lvl/h -->113>44.2 context | rep work n/a | rep best NiteSec -->1.3m>1.34m n/a` (cycle 2.9h, two windows). Nothing decelerating. Advisor at 19:14: **wait**, reason "gang cycle minimum: 1.0h more before an install (min 4h)"; batch value 1.89 vs cycle average 0.63; next none; cashLimited none. Decision: **install now, differs from the advisor**. The 4h minimum was set because the measured rebuild was about 3.8h (`docs/gang-planner.md` A2); the last four rebuilds took 0.25-0.82h. Its purpose, gang rep for NiteSec's augs, was met: gang rep 5.3m against `gangRepNeeded` 1.5m. Nothing was left to wait for (advice `next` null, no aug gaining rep), the batch was 3x the cycle average, and cash ($40t, 9x the plan) was no longer the limit. Waiting for the next check (21:15) would have cost 2h of the new cycle. Daedalus check: dex 1009/1500 is the only combat stat short (gym needs about 2.8m dex exp at roughly 150k/h measured 16:35-16:50, so about 15h); hacking 2500 needs about 1.6e17 exp at multiplier 2.34, out of reach. Each install's dex multiplier cuts the gym time sharply (exp needed falls exponentially with the multiplier). `capital_manager.js` killed 19:16. Backup `saves/bitburnerSave_pre-install9_BN10run2_2026-11-10.json.gz` (gzip and player parsed: node 10, 65 augs, 1 queued, 6 sleeves, $40t, no Red Pill; SHA-256 ce18f27560c63d7db1145eef5f16c3dc023cb0c961d55f0d7517575b8ed2acbc). `aug_install.js --install` at 19:17 ($40.5t) donated $547b to BitRunners and bought Graphene Bionic Legs Upgrade, BitRunners Neurolink, Cranial Signal Processors Gen IV and Gen V, The Black Hand, ADR-V2 Pheromone Gene, DataJack, Bionic Arms, BrachiBlades, Graphene BrachiBlades Upgrade, Artificial Synaptic Potentiation, SmartSonar Implant, Combat Rib II and III, Neurotrainer II, Augmented Targeting II, LuminCloaking-V2 Skin Implant, then 2 NeuroFlux; home 128TB, cores 3 -> 4 (the rest of the cash). After: game `ps` shows every resident (17 plus gang-controller, cct_watcher, allocator.js); readiness 19:18 shows **83 installed**, 0 queued, $92.7m, advisor wait. Cycle 9 for the allocator R1 judgement ran 3.0h (16:15-19:17). `metrics.py cycles` for cycle 9 left for the next run, once a new-cycle sample exists. Run target unchanged. World Daemon: not present (no Red Pill).

**2026-11-10 17:15 Pacific, 2-hourly task, BN10 run 2: steady, no changes.** Not a stand-aside run (no session
running; Ken's session and the allocator-design worktree idle since 16:42). Live (metrics sample 17:10, readiness
17:13, game `ps` 17:14): BN10, $513b, hacking 1143, str/def/dex/agi 4042/7546/878/1577, cha 7379, karma -113k, 65
installed, 1 queued (The St4ff of Asclepius). Every resident running (17 plus gang-controller, cct_watcher and
`allocator.js`). **The Covenant rejoined** this cycle (rep 738, favor 0.98). Player in Rothman's Algorithms class
(H1140 -> 1178 for a megacorp). capital_manager in the early phase: upgraded mcp-worker-2..6 to 512TB at $271b each
(16:48-17:14), as designed for the first 1.5h. Measured, 11 samples 16:20 to 17:10: rep/h NiteSec 2.1m (gang),
BitRunners 134k, The Black Hand 128k, Tetrads 44.3k, Tian Di Hui 41.7k, Slum Snakes 37k, CyberSec 36.5k, The Syndicate
13.5k, The Covenant 2.25k; hacking exp 2.62b/h (429 levels/h), karma -370/h, cash 556b/h, MCP rate 1.75b/s average
713m/s, share 1.44. Trend: `n/a` on every series (cycle 0.9h old). Advisor: **wait** ("gang cycle minimum: 3.0h more";
batch value 1.31 vs average 1.34; plan 9 augs from NiteSec and The Black Hand for $503b incl. a $36.5b Black Hand
donation; BitRunners Neurolink cash-limited). Decision: **wait, agree**: the cycle is under 1h. `metrics.py cycles`,
cycle 8 (12:15-16:15, 3.99h closed, rebuild hacking 0.82h): rep earned NiteSec 7.22m, BitRunners 424k, The Black Hand
217k, Tian Di Hui 121k, Tetrads 114k, CyberSec 97k, Slum Snakes 81.2k, The Syndicate 19.6k; favor banked CyberSec
+23.1, Tian Di Hui +14.3, NiteSec +9.9. Run target unchanged. World Daemon: not present (The Red Pill neither owned nor
queued). Share A/B: already recorded 2026-11-05.

**Shadow allocator live (allocator R1) (2026-11-10 16:40 PC clock, Ken session).** Ken: merge now so it watches cycle 9 (install 8 ran 16:15). Reviewed `allocator-shadow` (924f82a): no purchase calls, writes only its own log and status, line endings clean; 600 node tests and the Python tests pass in a detached copy, and on main after merge (245363b). It also fixes `test_bn10_is_bn15_plus_sleeves`, which failed on main once sleeve_buyer joined startup. Started `allocator.js` 16:41: **5.45GB**, over its 5GB S1 target by the 1GB the game's RAM checker charges for the field name `run` (status key and `valuation_flags.json` stamp); rename in R2. Live checks 16:42-16:44: grants 21s old, phase early matches `capital_status.json`, every kind `own` (spenders unchanged), shadow log has 5 lines for capital_manager's cloud upgrades (mcp-worker-4..7, $25.5b each), all `grant`: early phase, rebuild. Readiness runs as a one-shot, so its new `offers` field needs no restart. Judged over cycle 9 on S1-S5 before R2.

**BN10 run 2, install 8 ran 2026-11-10 16:15 Pacific, 2-hourly task: 10 bought + 3 NeuroFlux, 54 -> 65 installed.**
Not a stand-aside run (no session running; Ken's session and the allocator-design worktree idle since 15:54). Before
(metrics sample 16:05, readiness 16:13, game `ps` 16:08): BN10, $4.99t (16:05) to $5.67t (16:15), hacking 852,
str/def/dex/agi 3919/8048/1000/1402, cha 3304, karma -113k, 54 installed, 1 queued (The H4mmer of Daedalus). Every
resident running (17 plus gang-controller and cct_watcher, capital_manager and sleeve_buyer restarted 15:20). **The
Covenant joined** between the 15:55 and 16:00 samples (rep 296 by 16:07). `sleeve_buyer_status.json` 16:06: member,
late phase, limits lasting $51.5b, wiped 0, action save ("memory upgrade not yet affordable"); 5th sleeve costs $100q.
Player on BitRunners hacking work for Neural Accelerator. Measured, 12 samples 15:10 to 16:05: rep/h NiteSec 1.12m,
BitRunners 112k, The Black Hand 39.3k, Tian Di Hui 35.7k, Tetrads 34.4k, CyberSec 29.8k, Slum Snakes 24.6k, The
Syndicate 6.68k, The Covenant 1.21k; hacking exp 2.74b/h (20.9 levels/h), karma -435/h, cash 4.29t/h, MCP rate 997m/s
average 901m/s, share 1.53. Trend: `cash/h 1.55t>-1.55t>4.29t STEADY | MCP 1.08b>938m>997m STEADY | hackExp/h
2.5b>2.65b>2.74b STEADY | lvl/h 97.3>33.8>20.9 context | rep work BitRunners SWITCH | rep best NiteSec
1.06m>1.1m>1.12m STEADY`. Nothing decelerating (the -1.55t cash window was the $4.74t home RAM buy at 14:53).
Advisor at 16:13: **wait**, reason "gang cycle minimum: 2m more before an install (min 4h)"; next aug BitRunners
Neurolink, rep gap 1.33m, 6.4h, rate 0.036/h against cycle average 0.249/h; batch value 0.99; cashLimited none.
Decision: **install, agree once the minimum passed (16:15)**. Neural Accelerator had just become rep-ready, the next
gain was 6.4h away, and cash-limited batches grow by about one aug per 2h of income ($9t+ for the next x1.9 step), not
worth holding the cycle. Lost: Covenant membership (hacking must reach 850 again), dex/agi progress toward Daedalus's
combat 1500. `capital_manager.js` killed 16:14. Backup `saves/bitburnerSave_pre-install8_BN10run2_2026-11-10.json.gz`
(gzip and player parsed: node 10, 54 augs, 1 queued, 6 sleeves, $5.63t, no Red Pill; SHA-256
13af5a3eb7aaa7dc041c764a844c0b961a0e5f8e123d472776425cc537f56738). `aug_install.js --install` at 16:15 ($5.67t) bought
Embedded Netburner Module Core V2 Upgrade, Embedded Netburner Module Core V3 Upgrade, Glibness Enhancement, PCMatrix,
Neural Accelerator (BitRunners), Enhanced Myelin Sheathing, Enhanced Social Interaction Implant, Social Dynamics
Processor, Synfibril Muscle, Bionic Legs, then 3 NeuroFlux; no donations; home 128TB, cores 3. After: startup.js
"18 started, 0 failed", gang-controller started; readiness 16:15:38 shows **65 installed**, 0 queued, $133m, advisor
wait. Run target: steps 1-4 marked done (Covenant label notes rejoin after each install), pushed. `metrics.py cycles`
for cycle 8 left for the next run. World Daemon: not present (no Red Pill). Share A/B: already recorded 2026-11-05.

**Spending ledger live (allocator R0) (2026-11-10 16:15 PC clock, Ken session).** Ken approved the allocator design (`docs/allocator-design.md`: central valuation, scripts still buy, one setting per purchase kind in `valuation_flags.json`) and its answers. Branch `allocator-ledger` (0c3bf99, line endings fixed) merged to main (bd6aa68), design doc added (604df4a). 575 node tests and 29 metrics tests pass. `metrics_logger.js` restarted about 16:12; the 16:15 sample carries `homeRam` 131072, `batchAverage` 0.249 and every spending category (sleeves, gang_expenses, class, other, stock, ...). `metrics.py pull` wrote 51 records to `runtime/spend_history.jsonl`. `metrics.py spend`, baseline B1 (late spend outside the batch, % of late earnings): cycle 6 88%, cycle 7 70%, cycle 8 so far 50% (the 14:55 $4.74t home step). Cycle 7 B2: cash 2.71t, batch 2.71t (9 augs), 2.67b left. Next: R1 shadow allocator on branch `allocator-shadow`.

**Every spender now leaves late-cycle cash to the aug batch (2026-11-10 15:21 PC clock, Ken session).** Audit of every script that spends: capital_manager (cloud, home RAM, programs), sleeve_buyer (sleeve augs, memory, sleeves), gang-controller (gear, gang augs), aug_install (the batch itself), player controller (travel, classes: negligible). New shared `lateCycleLimit` in `capital_logic.js`: in the first `earlyCycleHours` (1.5) no extra limit; after that, 0 for purchases an install wipes and `lateSpendFraction` (1%) of cash per purchase for lasting ones. Applied to home RAM (capital_manager; on top of the demand test) and to sleeve_buyer (augs blocked late; memory and sleeves held to 1%). Before this, once The Covenant joined (hacking 837/850 at 15:05), sleeve_buyer would have spent all cash above the reserve on memory, about $210t across run 1's 4th sleeve. Gang left as is: money mode buys only gear with 30-minute payback within 1% of cash; reputation mode buys the rep the batch is short of. Measured this cycle: sleeves $0, gang gear none since install 7. 573 tests pass (2 new). Both scripts restarted 15:20; live 15:21: capital late, homeDemand 0.0023, no action; sleeve_buyer late, limits lasting $18.8b, wiped 0.

**Home RAM now needs demand (2026-11-10 15:14 PC clock, Ken session).** Ken: the 131TB cap is not the fix; make sure it cannot happen again. Root cause: `chooseCapitalAction` bought home RAM whenever home was below `homeRamTarget`, with no check that anything would use it (cloud RAM already had one, `ramUtilization`). Now home RAM is bought only below `homeRamFloor` or while `homeDemand` (home RAM used by everything except xp_filler's leftover workers, plus managers waiting to start and mcp.js if down, over home size) is at least `homeDemandFloor` (0.5). Idle home RAM also no longer holds cash back from cloud. Tests: 3 new, one replays the 14:53 purchase (refused); 571 pass. Deployed, `capital_manager.js` restarted 15:13, `homeRamTarget` back to 262144 as a ceiling; live 15:14: homeDemand 0.0023, no action.

**Home RAM buying stopped (2026-11-10 15:09 PC clock, Ken session).** Ken saw cash fall from over $4t to under $1t. Cause: `capital_manager` upgraded home RAM to 131TB at 14:53 for $4.74t (`capital_status.json` purchases); home RAM was exempt from the late-cycle stop because it survives installs. Live 15:07: home 131.07TB, 299.7GB used (0.23%), so the RAM is idle. The aug batch is cash-limited: 19 gang-sold augs are rep-ready, the plan at $0.88t buys 7, and $4.74t at the x1.9 step would have bought about 3 more. `capital_policy.json` `homeRamTarget` 262144 -> 131072 (pushed, read back 15:09:49). Cloud buying itself stopped on schedule: last cloud upgrade 13:39, late phase from 13:45.

**2026-11-10 14:15 Pacific, 2-hourly task, BN10 run 2: steady, no changes.** Not a stand-aside run (no session
running; Ken's session idle since 12:01). Live (metrics sample 14:10, readiness 14:13, game `ps` 14:16): BN10, $1.97t
(readiness $2.18t at 14:13), hacking 800, str/def/dex/agi 3369/6919/920/1247 (all four past the Covenant's 850), cha
3037, karma -112k, 54 installed, 1 queued (The H4mmer of Daedalus). Every resident running (17 plus gang-controller and
cct_watcher). Player in Rothman's Algorithms class, H800 -> 850 for The Covenant invite (`covenantTarget` true); at
92.8 levels/h the invite should come about 14:45-15:00, and `faction_join.js` accepts it. Gang rep 4.99m, past
`gangRepNeeded` 3.5m. The Black Hand is in `donating` (favor 161). Measured, 13 samples 13:10 to 14:10: rep/h NiteSec
1.06m, BitRunners 95.5k, The Black Hand 56.7k, Tian Di Hui 29k, Tetrads 28.7k, CyberSec 24.1k, Slum Snakes 20.5k, The
Syndicate 4.76k; hacking exp 2.52b/h (92.8 levels/h), karma -393/h, cash 1.77t/h, MCP rate 997m/s average 684m/s, share
1.52. Trend: `n/a` on every series (cycle 1.9h old). Advisor: **wait** ("gang cycle minimum: 2.0h more before an
install (min 4h)"; next Neural Accelerator +8.3%/h vs cycle +37.1%/h; batch value 0.73). Decision: **wait, agree**:
the cycle is under 2h and the Covenant invite is imminent. `metrics.py cycles` for cycle 7 (06:20-12:15, 5.93h,
rebuild 0.75h): rep earned NiteSec 13.4m, The Black Hand 252k, BitRunners 172k, Tian Di Hui 80k; favor banked NiteSec
+25.9, CyberSec +19.3, Tian Di Hui +12.2 (the tool does not list BitRunners or The Black Hand, which readiness showed
pending at 12:14). Run target unchanged. World Daemon: not present (no Red Pill installed or queued; hacking 800).

**BN10 run 2, install 7 ran 2026-11-10 12:15 Pacific, 2-hourly task: 9 bought, 44 -> 54 installed.** Not a
stand-aside run (no session running; Ken's session idle since 12:01). Before (metrics sample 12:10, readiness 12:14,
game `ps` 12:15): BN10, $2.52t (12:10) to $2.71t (12:15), hacking 683, str/def/dex/agi 1776/3648/830/1073, cha 907,
karma -111k, 44 installed, 1 queued (The B00ts of Perseus). Every resident running (17 plus gang-controller and
cct_watcher). Player in the gym on dexterity (830/850). Measured, 13 samples 11:10 to 12:10: rep/h NiteSec 755k (gang
on money since 09:21), BitRunners 36.5k, Tian Di Hui 19k, The Black Hand 17.6k, Tetrads 14.3k, CyberSec 12.5k, Slum
Snakes 7.72k, The Syndicate 3.44k; hacking exp 3.13b/h (13.3 levels/h), karma -441/h, cash 1.84t/h, MCP rate 392m/s
average 441m/s, share 1.53. Trend: `cash/h 106b>-180b>1.84t STEADY | MCP 349m>406m>392m STEADY | hackExp/h
1.96b>3.08b>3.13b STEADY | lvl/h 22.2>20.1>13.3 context | rep work SWITCH | rep best NiteSec 1.1m>721k>755k STEADY`.
Nothing decelerating. Advisor: **install** ("best next Neural Accelerator adds +2.9%/h, under the cycle's +28.2%/h";
batch +147% vs cycle average +24.8%; cycle 5.9h). Decision: **install, agree**. Cash was the only limit, and $2.7t
covered all 8 planned NiteSec augs. Lost: dexterity 830 of 850. But hacking binds the Covenant gate (683 of 850 at 13
levels/h), and this batch adds hacking multipliers. Favor banked (pending gain at 12:14): BitRunners +104 (0 -> ~104),
The Black Hand +27 (133 -> ~161, past 150, so donations open there next cycle), NiteSec +26 (live after: 363).
`capital_manager.js` killed 12:15. Backup `saves/bitburnerSave_pre-install7_BN10run2_2026-11-10.json.gz` (gzip and
player parsed: node 10, 44 augs, 1 queued, 6 sleeves, $2.69t, no Red Pill; SHA-256
d041e0ef66d12983d6ca6306d883b7d234a24f6ce11cf65a13a3aa4823f4ea9a). `aug_install.js --install` at 12:15 ($2.71t)
bought PC Direct-Neural Interface Optimization Submodule, Neuralstimulator, Neotra, HyperSight Corneal Implant,
SmartJaw, Photosynthetic Cells, Embedded Netburner Module Core Implant, CRTX42-AA Gene Modification, Combat Rib I (all
NiteSec); no NeuroFlux, no donations; home 64TB, 2 cores. After: game `ps` 12:16 shows every resident restarted (17
plus gang-controller and cct_watcher); readiness 12:16 shows **54 installed**, 0 queued, $184m, advisor wait;
`capital_status.json` `cyclePhase` early (floor 0); gang back on reputation by itself at 12:17 (17.1k of 3.5m).
`metrics.py cycles` for cycle 7 (06:20-12:15, 5.9h) is left for the next run, once a new-cycle sample exists. Run
target unchanged. World Daemon: not present (no Daedalus, no Red Pill). Share A/B: already recorded 2026-11-05.

**Gang objective is `auto` (set 2026-11-10 09:20 PC clock, Ken session; commit 667d2ab).** The gang earns NiteSec
rep until it covers every aug NiteSec sells (`gangRepNeeded`, 3.5m now), then switches itself to Money Laundering;
an install resets the rep, so it returns to reputation on its own. Nothing to set or undo at installs. Live 09:21:
rep 11.2m >= 3.5m, all 12 on Money Laundering, gang money about $50b/h (cash 120b/h before), penalty 0.999.
Overnight, cycle 6 had run about 2h past 3.5m on Cyberterrorism for no use. capital_manager is not part of this:
it now limits cloud buying late in each cycle by itself (next note).

**Cloud buying is now automatic by cycle phase (10:16, Ken session; commit 085ffe8). Nothing to undo at installs.**
Game-only `capital_policy.json` is `{"reserve":0,"homeRamTarget":262144,"cloudDemandFloor":0,"lateCloudDemandFloor":0.5,
"earlyCycleHours":1.5}`: for 1.5h after each install cloud RAM is bought freely (floor 0, fast hacking rebuild), then
only while MCP's own jobs fill half of it (in practice, no more cloud buying). Home RAM is bought throughout.
`capital_status.json` `cyclePhase` shows the phase; live 10:16: late, floor 0.5, no purchases. Evidence, cycle 7 metrics: cloud RAM grew 1.8PB -> 5.5PB
from 07:40 to 10:10 ($5.1t spent this cycle, about 95% of hacking income) while hacking income stayed flat at about
$1.7t/h; MCP's own jobs fill 0.2% of cloud RAM, so the extra RAM only fed xp_filler (hack exp 0.9b -> 1.9b/h), which an
install wipes. Floor 0 is right early in a cycle (fast hacking rebuild); late in a cycle, cash should go to the batch.

**2026-11-10 08:15 Pacific, 2-hourly task, BN10 run 2: steady, no changes.** Not a stand-aside run (no session
running). Live (metrics sample 08:10, game `ps` 08:16, readiness 08:13): BN10, $164b, hacking 584, str/def/dex/agi
1406/2888/679/888, karma -110k, **44 installed** (confirms install 6), **1 queued: The B00ts of Perseus** (darknet
reward). Joined BitRunners (favor 0, +35.8 pending). Every resident running (17 plus gang-controller and cct_watcher).
Player in the gym on dexterity (678/850, last combat stat short of the Covenant gate). Measured, 12 samples 07:15 to
08:10: rep/h NiteSec 3.81m (gang), The Black Hand 82.1k, BitRunners 28.9k, Tian Di Hui 14.5k, Tetrads 11.4k, CyberSec
8.63k, Slum Snakes 6.15k, The Syndicate 4.79k; hacking exp 898m/h (78.4 levels/h), karma -355/h, cash 120b/h, MCP rate
406m/s average 309m/s, share 1.49. Trend: `n/a` on every series (cycle 1.8h old; rep work The Black Hand SWITCH).
Cycle 6 (`metrics.py cycles`, 02:19-06:20): 4.02h, rebuild hacking 1.26h, rep earned NiteSec 11.1m, The Black Hand
209k, Tian Di Hui 23.2k; favor banked NiteSec +77.5, CyberSec +13.9, Tian Di Hui +8.2 (live favor: NiteSec 337, The
Black Hand 133). Advisor: **wait** ("gang cycle minimum: 2.1h more"; batch +50.2% vs cycle average +26.5%; plan PC
Direct-Neural Interface Optimization Submodule, Neuralstimulator, Enhanced Myelin Sheathing, Bionic Arms from NiteSec,
$162b; next valued The Black Hand, 61.7k rep, about 0.8h). Decision: **no install, agree**; the minimum ends about
10:20. Covenant gate: hacking 584/850 is binding again, dexterity 679/850 the only combat stat short. World Daemon:
not present (no Daedalus, no Red Pill). Share A/B: already recorded 2026-11-05; not repeated.

**BN10 run 2, install 6 ran 2026-11-10 06:20 Pacific, 2-hourly task: 6 bought, 38 -> 44 installed.** Not a
stand-aside run (no session running). Before (metrics sample 06:10, game `ps` 06:14, readiness 06:18): BN10, $133b
(06:10) to $250b (06:20), hacking 472, str/def/dex/agi 848/777/556/841, karma -109k, 38 installed, 0 queued. Every
resident running (17 plus gang-controller and cct_watcher). Player in the Algorithms class. Measured, 12 samples 05:15
to 06:10: rep/h NiteSec 3.09m (gang), The Black Hand 12.1k, Tian Di Hui 6.95k, Tetrads 6.39k, CyberSec 5.14k, Slum
Snakes 3.08k; hacking exp 826m/h (17.4 levels/h), karma -514/h, cash 108b/h, MCP rate 247m/s average 143m/s, share
1.5. Trend: `cash/h 33.2b>2.97b>108b STEADY | MCP 104m>119m>247m ACCELERATING | hackExp/h 351m>656m>826m ACCELERATING
| lvl/h 59.2>29.8>17.4 context | rep work The Black Hand SWITCH | rep best NiteSec 2.72m>2.76m>3.09m STEADY`. Nothing
decelerating. Advisor: **wait** to the end ("gang cycle minimum: 1m more" at 06:18:50; batch +121% to +130% vs cycle
average +30% to +33%; next valued aug none). Decision: **install, agree in substance**: the 4h gang minimum was its only
blocker and passed at about 06:19:50; NiteSec rep (10.9m) covers its whole shop, so cash alone limited the batch. Lost
by installing: combat near 850, but the Covenant gate is bound by hacking (472 of 850), and combat rebuilt
147 -> 848 in this 4h cycle. Favor banked about NiteSec +40.9 (to ~337), The Black Hand +45.8 (to ~133, toward 150).
`capital_manager.js` killed 06:15. Backup `saves/bitburnerSave_pre-install6_BN10run2_2026-11-10.json.gz` (gzip and
player parsed: node 10, 38 augs, 0 queued, 6 sleeves, $181.8b, no Red Pill; SHA-256
cce7761a42d8fb4799e33891ae27528baf9170606b58936400cb3dc56d9fd96b). `aug_install.js --install` at 06:20 ($250.2b)
bought Graphene Bone Lacings, Xanipher, PC Direct-Neural Interface, NEMEAN Subdermal Weave, CashRoot Starter Kit,
Neural Wit Amplifier (all NiteSec); no NeuroFlux; home stays 16TB, 2 cores. After (game `ps` 06:20): every resident
restarted (17 plus gang-controller and cct_watcher). No money phase this cycle, so nothing to undo. Installed count and
post-install stats not read live yet; next run confirms 44 and adds the cycle-6 `metrics.py cycles` line (cycle 6,
02:19-06:20, 4.0h). Run target unchanged. **Next:** rebuild toward the Covenant gate (hacking 850 binding). World
Daemon: not present (no Red Pill). Share A/B: already recorded 2026-11-05; not repeated.

**2026-11-10 04:15 Pacific, 2-hourly task, BN10 run 2: steady, no changes.** Not a stand-aside run (no session
running). Live (metrics sample 04:10, game `ps` 04:15, readiness 04:12): BN10, $65.3b (sample) / $98.8b
(readiness), hacking 425, str/def/dex/agi 757/678/496/734, karma -108k, **38 installed** (confirms install 5), 0 queued.
Every resident running (17 plus gang-controller and cct_watcher). Player on The Black Hand work (+114k rep for The
Black Hand, about 1.1h). Favor live: NiteSec 296, The Black Hand 87.4, Tian Di Hui 120, Tetrads 118. Measured, 12
samples 03:15 to 04:10: rep/h NiteSec 2.74m (gang), The Black Hand 94.5k, Tian Di Hui 5.92k, Tetrads 5.6k, CyberSec
3.76k, Slum Snakes 2.7k; hacking exp 373m/h (54.5 levels/h), karma -445/h, cash 30.4b/h, MCP rate 101m/s average
113m/s, share 1.46. Trend: `n/a` on every series (cycle 1.8h old). Cycle 5 (`metrics.py cycles`): 22:17-02:19,
4.03h, rebuild hacking 3.79h, rep earned NiteSec 4.43m, The Black Hand 92.3k, Tian Di Hui 20.1k; favor banked NiteSec
+88.8, Tian Di Hui +46.8, The Black Hand +27.4, CyberSec +5.9, Slum Snakes +5.1, Tetrads +3.5. Advisor: **wait** (gang
cycle minimum, 2.1h more; batch +111% vs cycle average +58.6%; plan Graphene Bone Lacings, Xanipher, PCMatrix,
LuminCloaking-V2, $98.8b). Decision: **no install, agree**; the minimum ends about 06:19, when The Black Hand should
also be rep-ready. Combat is nearing the Covenant 850 gate; hacking 425 is the binding one. World Daemon: not present
(no Daedalus, no Red Pill). Share A/B: already recorded 2026-11-05; not repeated.

**BN10 run 2, install 5 ran 2026-11-10 02:19 Pacific, 2-hourly task: 6 bought + 1 NeuroFlux; money phase
undone.** Not a stand-aside run (no session running). Before (metrics sample 02:10, game `ps` 02:14, readiness
02:18): BN10, $950b (02:10) to $1.03t (02:19), hacking 394, str/def/dex/agi 147/203/145/146, karma -107k, 32
installed, 0 queued. Every resident running (17 plus gang-controller and cct_watcher). Player on The Black Hand
hacking work. Measured, 13 samples 01:10 to 02:10: rep/h NiteSec 366k (gang, on money), The Black Hand 57.2k, Tian
Di Hui 5.16k, Tetrads 5.14k, CyberSec 2.85k, Slum Snakes 2.24k; hacking exp 433m/h (12.3 levels/h), karma -436/h,
cash 534b/h, MCP rate 103m/s average 116m/s, share 1.48. Trend: `cash/h 31.3b>389b>534b ACCELERATING | MCP
128m>138m>103m STEADY | hackExp/h 274m>442m>433m STEADY | lvl/h 62.1>23.3>12.3 context | rep work The Black Hand
SWITCH | rep best NiteSec 1.83m>590k>366k DECELERATING`. NiteSec's slowdown is the money phase itself (gang off
reputation), not a fault; it argued for installing on time. The money phase worked: cash went $35b to $1t in 2h with
capital buying paused. Advisor: **install** at 02:18 ("best next The Black Hand adds +15.2%/h, under the cycle's
+105.3%/h"; batch +288%); at 02:13 it was still wait for the 4h gang minimum. Decision: **install, agree**.
`capital_manager.js` killed 02:15. Backup `saves/bitburnerSave_pre-install5_BN10run2_2026-11-10.json.gz` (gzip and
player parsed: node 10, 32 augs, 0 queued, 6 sleeves, $992b, hacking 394; SHA-256
aef82102d6f800cacc4f3dc6cc30206d8a6a6b3f74812a8a2298f002d02a53e3). `aug_install.js --install` at 02:19 ($1.032t)
bought Graphene Bionic Spine Upgrade, Embedded Netburner Module Analyze Engine, ECorp HVMind Implant, CordiARC Fusion
Reactor, SPTN-97 Gene Modification, Synthetic Heart (all NiteSec) and 1 NeuroFlux; home stays 16TB, 2 cores. After
(game `ps` 02:19): every resident restarted (17 plus gang-controller and cct_watcher). Money phase undone and checked
live: `set_gang_objective.js reputation` (gang_status 02:19:45 mode reputation), `capital_policy.json` pushed back to
`{"reserve":0,"homeRamTarget":262144,"cloudDemandFloor":0}` (read back). Player controller on its usual post-install
gym baseline. Installed count after install not read live yet; next run confirms it and adds the cycle-5 `metrics.py
cycles` line (cycle 5, 22:17-02:19, 4.0h, rep earned NiteSec 4.43m, The Black Hand 92.3k at 02:16). Run target
unchanged. **Next:** gang rep rebuild, then the Covenant gate (hacking and combat 850, $75b). World Daemon: not present
(no Daedalus, no Red Pill). Share A/B: already recorded 2026-11-05; not repeated.

**2026-11-10 00:15 Pacific, 2-hourly task, BN10 run 2: steady, no changes.** Not a stand-aside run (no session
running). Live (metrics sample 00:10, game `ps` 00:14, readiness 00:12): BN10, $39.7b (to $35.1b at 00:12),
hacking 357, str/def/dex/agi 133/181/131/131, karma -106k, 32 installed, 0 queued. Every resident running (19 plus
gang-controller and cct_watcher). Player in the Algorithms class toward hacking 365 for I.I.I.I. Cycle-4 favor
confirmed live: NiteSec 260 (was 171), Tian Di Hui 116, Tetrads 115; `metrics.py cycles` still prints "favor banked:
none" for cycle 4 (18:15-22:17), a display gap in the tool, not lost favor. Measured, 13 samples 23:10 to 00:10: rep/h
NiteSec 1.83m (gang), Tian Di Hui 8.12k, CyberSec 6.2k, Tetrads 4.26k, Slum Snakes 1.86k; hacking exp 274m/h (62.1
levels/h), karma -526/h, cash 31.3b/h, MCP rate 128m/s average 82m/s, share 1.44. Trend: `n/a` on every series
(cycle 1.9h old). Advisor: **wait** ("gang cycle minimum: 2.1h more"; batch +16.8% vs cycle average +8.8%; plan
Embedded Netburner Module Analyze Engine, DataJack, Augmented Targeting II from NiteSec, $35.0b). Decision: **no
install, agree**; the minimum ends about 02:17, and the next run should install if cash still limits the batch rather
than rep. World Daemon: not present (no Daedalus, no Red Pill). Share A/B: already recorded 2026-11-05; not repeated.

**BN10 run 2, install 4 ran 2026-11-09 22:17 Pacific, 2-hourly task: 3 bought + W1ngs of Icarus, 32 installed.**
Not a stand-aside run (no session running). Before (metrics sample 22:10, game `ps` 22:15, readiness 22:14): BN10,
$97.6b (22:10) falling to $81b (capital_manager spending), hacking 391, str/def/dex/agi 126/170/121/116, karma -105k,
28 installed, 1 queued (The W1ngs of Icarus). Every resident running (19 plus gang-controller and cct_watcher). Player
on Tian Di Hui work; Neuroreceptor Management Implant came rep-ready at about 22:15 (player moved to The Black Hand).
Measured, 12 samples 21:15 to 22:10: rep/h NiteSec 1.16m (gang), Tian Di Hui 55.2k, The Black Hand 11.7k, Tetrads
5.09k, CyberSec 3.76k, Slum Snakes 2k; hacking exp 489m/h (16 levels/h), karma -515/h, cash 1.05b/h (spending, not
income loss: cash rose $40b to $98b over the cycle), MCP rate 103m/s average 114m/s, share 1.47. Trend: `cash/h
37.2b>53.9b>1.05b STEADY | MCP 121m>148m>103m STEADY | hackExp/h 148m>413m>489m ACCELERATING | lvl/h 50.5>31.8>16
context | rep work Tian Di Hui 34.2k>39.8k>55.2k ACCELERATING | rep best NiteSec 851k>1m>1.16m ACCELERATING`. Nothing
decelerating. Advisor: **wait** ("gang cycle minimum: 1m more", 22:14; batch +17.5% vs cycle average +4.4%; next
valued aug The Black Hand at +2.2%/h, 11h away). Decision: **install, agree in substance**: the 4h minimum was its
only blocker and passed at 22:16; NiteSec rep (3.4m) already covers what it sells, so only cash limits the batch, and
the install banks NiteSec favor 171 -> about 258 and Tian Di Hui 69 -> about 115. `capital_manager.js` killed 22:15.
Backup `saves/bitburnerSave_pre-install4_BN10run2_2026-11-09.json.gz` (gzip and player parsed: node 10, 28 augs, 1
queued, 6 sleeves, $94.1b, hacking 393; SHA-256 8f3e68c8fedec34859f04499249f420d7ea074d7334f104a59c3951600063703).
`aug_install.js --install` at 22:17 ($101.7b at run time) bought Embedded Netburner Module Direct Memory Access Upgrade
($66.5b), FocusWire ($8.55b), both NiteSec, and Neuroreceptor Management Implant ($5.23b, Tian Di Hui); no NeuroFlux;
home stays 16TB, 2 cores. After (game `ps` about 22:19): every resident restarted (19 plus gang-controller and
cct_watcher). `metrics.py cycles`: cycle 4 (18:15-22:17) 4.0h, rebuild hacking 1.00h, rep earned NiteSec 3.5m, Tian
Di Hui 150k, The Black Hand 16.3k, Tetrads 15.9k; favor banked still listed pending (no new-cycle sample yet; next run
adds it). Gang-planner M1/M6 met (`docs/gang-planner.md`). Run target unchanged. **Next:** cycle-4 favor line; gang
recovery after install; Covenant gate (hacking and combat 850, $75b) still far. World Daemon: not present (no Daedalus,
no Red Pill). Share A/B: already recorded 2026-11-05; not repeated.

**2026-11-09 20:15 Pacific, 2-hourly task, BN10 run 2: steady, no changes.** Not a stand-aside run (no session
running). Live (metrics sample 20:10, game `ps` 20:15, readiness 20:13, gang_status 20:15, autosave): BN10, $40.4b to
$51.7b, hacking 342-346, str/def/dex/agi 113/147/106/105, karma -96.1k, 28 installed, **1 queued: The W1ngs of Icarus**
(darknet lab 1 reward, picked up since install 3). Every resident running (19 plus gang-controller and cct_watcher).
Player on Tian Di Hui hacking work for Neuroreceptor Management Implant (+98.7k rep to go). Measured, 12 samples 19:15
to 20:10: rep/h NiteSec 870k (gang), Tian Di Hui 34.7k, Tetrads 4.12k, CyberSec 2.06k, Slum Snakes 1.62k; hacking exp
158m/h (49.7 levels/h), karma -3.44k/h, cash 41.6b/h, MCP rate 123m/s average 79.8m/s, share 1.43. Trend: `n/a` on
every series (cycle 1.9h old). Gang (planner checks): NiteSec rep 1.35m, penalty 0.989 (out of cleanup), 60/60
rootkits, 36 gang augs bought, 20 ascensions (last x1.25 at 20:14). M1: 870k/2.71 = about 321k/h at zero favor vs the
89k/h baseline. Advisor: **wait** ("gang cycle minimum: 2.0h more"; batch +30.8% vs cycle average +15.6%). Decision:
**no install, agree**; the 4h minimum ends about 22:15, and cash, not rep, will limit the next batch. World Daemon:
not present (no Daedalus, no Red Pill). Share A/B: already recorded 2026-11-05; not repeated.

**BN10 run 2, install 3 ran 2026-11-09 18:15 Pacific (Ken session): gang-planner deployed; 4 augmentations + 2
NeuroFlux, 27 installed.** The NiteSec install hold is lifted: the advisor now times gang-faction gaps itself (minimum
cycle 4h, cap 12h; `docs/gang-planner.md`). Branch `gang-planner` merged to main (47b5559) at 18:14; the daemon sync was
checked on the game copies (gang-controller, gang_logic, install_advisor_logic, augmentation_readiness, policy, run
target). Before: NiteSec rep 617k (gate 550k) at about 217k/h (favor 72), penalty 0.932, cash $60b; capital_manager
killed 18:14. Backup `saves/bitburnerSave_pre-install3_BN10run2_2026-11-09.json.gz` (parsed: node 10, 23 augs, 0 queued,
$58.9b, hacking 297; SHA-256 9662296849d2f32c20bedacea0fd92b54bce476cd8eceda8fa9052d08b76dfb6). `aug_install.js` bought
The Illustrated Primer, Artificial Bio-neural Network Implant, Cranial Signal Processors - Gen III and Bionic Spine (all
NiteSec) plus 2 NeuroFlux; $2.3b left, below the cheapest stepped price ($2.35b), so 4 not the hoped-for 7. `--install`
18:15; startup restarted 18 scripts and gang-controller. After (live 18:18): favor 171, NiteSec rep 16.7k; gang in
wanted recovery (penalty 0.953 rising, wanted 291k falling about 1m/h, 10 Cyberterrorism + 2 Ethical Hacking) toward
the new 0.985 exit; 12 of 60 rootkits bought (cash still small), no gang augs yet, no ascension yet (none in cleanup);
advisor **wait** ("gang cycle minimum: 3.9h more"), 39 gang-sold augs; sleeves on Homicide for money (no non-gang rep
target). **Next:** M1-M7 in `docs/gang-planner.md` against the baseline: rootkits fill as cash grows, Neuralstimulator
by 21:15, rep/h at zero favor (rate / 2.71) in hours 1-4 vs 89k/h. The controller wiring has no tests: watch for
ascensions resuming after cleanup, at least 90 s apart.

**2026-11-09 16:16 Pacific, 2-hourly task, BN10 run 2: steady, no changes; install hold kept.** Not a stand-aside
run (no session running; the Ken session that set the hold had stopped). Live (metrics sample 16:10, game `ps` 16:15,
readiness 16:12, autosave): BN10, $16.8b to $19.9b, hacking 257-260, str/def/dex/agi 103/145/94/97, karma -64.8k, 23
installed, 0 queued. Every resident running (19 plus gang-controller and cct_watcher). Player on Tetrads field work for
Bionic Arms (+105k rep to go). Measured, 12 samples 15:15 to 16:10: rep/h NiteSec 136k (gang), Tetrads 16.3k, Tian Di
Hui 4.03k, Slum Snakes 3.09k, CyberSec 1.41k; hacking exp 59.9m/h (30.7 levels/h), karma -1.99k/h, cash 13.9b/h, MCP
rate 95.3m/s average 35.5m/s, share 1.41. Trend: `n/a` on every series (cycle 1.9h old). Advisor: **install** ("nothing
left worth waiting for", batch +35.6%). Decision: **no install, disagree**, per the NiteSec hold: NiteSec rep 236k of
the 550k gate; at the measured 136k/h that is about 2.3h, so the gate should clear around 18:30. World Daemon: not
present (no Daedalus, no Red Pill). Share A/B: already recorded 2026-11-05; not repeated.

**BN10 run 2, install 2 ran 2026-11-09 14:16 Pacific, 2-hourly task: 9 augmentations, 23 installed.** Not a
stand-aside run (no session running). Before (metrics sample 14:10, game `ps` 14:15, readiness 14:14, autosave): BN10,
$170b to $177b, hacking 270, str/def/dex/agi 103/103/109/114, karma -58.7k, 14 installed, 0 queued. Every resident
running (19 plus gang-controller). Player on Tetrads field work for Bionic Arms (+54.6k rep to go). Measured, 13
samples 13:10 to 14:10: rep/h NiteSec 37.4k (gang), Tetrads 11.8k, Tian Di Hui 2.54k, CyberSec 2.25k, Slum Snakes
1.31k; hacking exp 306m/h (6.92 levels/h), karma -288/h, cash 51.1b/h, MCP rate 72.8m/s average 65m/s, share 1.5.
Trend: `cash/h -1.53b>7.26b>51.1b ACCELERATING | MCP 58.2m>103m>72.8m STEADY | hackExp/h 146m>268m>306m ACCELERATING |
lvl/h 9.05>9.52>6.92 context | rep work Tetrads 12.1k>11.3k>11.8k STEADY | rep best NiteSec SWITCH`. Nothing
decelerating. Advisor: **wait** 1.2h for Bionic Arms (+19.2%/h vs cycle +6.9%/h; batch +48.5%, cycle 7.3h).
Decision: **install, disagree**. The advisor's 1.2h divides the gap by `repPerHour` 45.8k, which is the sum over
factions; Bionic Arms is Tetrads rep at 11.8k/h, so about 4.6h, and +21% over 4.6h is below the cycle's +6.9%/h. As a
10th purchase it would also cost about 1.9^9 times its base, out of reach of $51b/h. Installing now also meets the
Covenant's 20-installed gate. (Advisor follow-up: it should use the next augmentation's faction rate, not the total.)
`capital_manager.js` killed 14:15 so it would not spend the cash. Backup
`saves/bitburnerSave_pre-install2_BN10run2_2026-11-09.json.gz` (gzip checked, player parsed, node 10, 14 augs, 0 queued,
6 sleeves, $177b, hacking 270, SHA-256 1c10bd6f2f979eac4098c2adb3e2aec91032a8c6eec895c31f4f5b4db08c1bde).
`aug_install.js` (buy only) bought The Shadow's Simulacrum, Neural-Retention Enhancement, Embedded Netburner Module,
Eloquence Module, Magnetism Amplifier, Neurotrainer III, Nanofiber Weave, Cranial Signal Processors - Gen II and
DermaForce Particle Barrier, all from NiteSec; no donations, no NeuroFlux. `--install` then installed (home stays 16TB,
2 cores). After (game `ps` 14:16, autosave 14:17): **23 installed, 0 queued**, BN10, $0.6m, hacking 1, karma -58.7k,
NiteSec still joined (gang), player in Powerhouse Gym (strength, physicalTarget 75). Every resident restarted: MCP,
supervisor, crawler, steward, mcp_xp, money, stack_manager, HUD, run_report, player controller, xp_filler,
faction_join, metrics_logger, dnet_root, sleeve_controller, sleeve_buyer, capital_manager, gang-controller,
cct_watcher. **`covenantTarget` set true** in `profiles/bn10/config/player_activity_config.json` (23 installs; build
548/548 tests pass; the game copy already matched after the daemon sync). It stays inactive until cash reaches $37.5b
and the gym estimate to 850 combat is under 48h, so it does not pull the player off faction work yet; the controller's
14:17 status still showed false (written before the sync), not rechecked. `metrics.py cycles`: cycle 2 closed at
7.27h, rebuild hacking 3.77h, rep rate 0.77h, rep earned NiteSec 75.8k, Tetrads 70.4k, Tian Di Hui 27.7k, CyberSec
23.1k, Slum Snakes 13.2k; favor banked not yet computed (no new-cycle sample at 14:18). **Next:** check the rebuild
and the cycle-2 favor line; Bionic Arms via NiteSec or Tetrads. World Daemon: not present (no Red Pill). Share A/B:
already recorded 2026-11-05; not repeated.

**2026-11-09 12:16 Pacific, 2-hourly task, BN10 run 2: steady, no changes.** Not a stand-aside run (no session
running). Live (metrics sample 12:15, game `ps` 12:16, readiness 12:15): BN10, $59.7b, hacking 254, str/def/dex/agi
98/98/102/108, karma -58.2k, 14 installed, 0 queued. Every resident running (19 plus gang-controller). Player on
Tetrads field work for Bionic Arms (+77.9k rep to go). Measured, 13 samples 11:15 to 12:15: rep/h Tetrads 12.1k,
NiteSec 11.1k, CyberSec 4.11k, Tian Di Hui 2.97k, Slum Snakes 1.83k; hacking exp 160m/h (9.6 levels/h), karma -322/h,
cash -8.48b/h (capital_manager buying servers; money still up from $41.8b at 10:15), MCP rate 58.7m/s average
59.5m/s, share 1.47. Trend: `cash/h 4.41b>53.7b>-8.48b STEADY | MCP 86.9m>85.1m>58.7m STEADY | hackExp/h
76.9m>111m>160m ACCELERATING | lvl/h 16.1>11>9.63 context | rep work Tetrads 12.4k>11.6k>12.1k STEADY | rep best
Tetrads STEADY`. Nothing decelerating. Advisor: **wait** 14m for Combat Rib I (+37.7%/h vs cycle +2.5%/h; batch
+12.9%, cycle 5.3h). Decision: **no install, agree** (batch small, Bionic Arms still to come). World Daemon: not
present (no Red Pill). Share A/B: already recorded 2026-11-05; not repeated.

**2026-11-09 10:15 Pacific, 2-hourly task, BN10 run 2: steady, no changes.** Not a stand-aside run (no session
running). Live (metrics sample 10:15, game `ps` 10:15, readiness 10:14): BN10, $41.8b, hacking 233, str/def/dex/agi
92/92/94/98, karma -57.4k, 14 installed, 0 queued. Every resident running (19, unchanged). Player on Tetrads field work
for Bionic Arms (+101k rep; priority aug), since about 08:19. Measured, 12 samples 09:20 to 10:15: rep/h Tetrads 12.6k,
Tian Di Hui 3.73k, CyberSec 3.65k, Slum Snakes 2.44k, NiteSec 433; hacking exp 83.6m/h (15.9 levels/h), karma -390/h,
cash 6.47b/h, MCP rate 87.2m/s average 49.1m/s, share 1.45. Trend: `cash/h 8.74b>20.1b>6.47b STEADY | MCP
36.1m>102m>87.2m STEADY | hackExp/h 17.3m>42.6m>83.6m ACCELERATING | lvl/h 41.2>21.4>15.9 context | rep work Tetrads
-->11.5k>12.6k n/a | rep best Tetrads SWITCH`. Nothing decelerating. Advisor: **wait** 17m for Augmented Targeting I
(+14.2%/h vs cycle +2.4%/h; batch +7.6%, just LuminCloaking-V2). Decision: **no install, agree** (cycle 3.3h, batch
tiny). Next gate crush-fitness at hacking 270. World Daemon: not present (14 installed, no Red Pill). Share A/B: already
run and recorded 2026-11-05 (docs/experiments.md, result x1.48 rep, kept on); not repeated.

**2026-11-09 08:20 Pacific, 2-hourly task, BN10 run 2: rebuild after install 1 healthy; no changes.** Not a
stand-aside run (no session running). Live (metrics sample 08:15, game `ps` 08:15, readiness 08:14, gang and sleeve
status 08:15-08:16): BN10, $7.5b to $9.5b, hacking 195 (85 at install), str/def/dex/agi 79/77/77/81, karma -56.6k,
14 installed, 0 queued, home 16TB. Every resident running (MCP, supervisor, crawler, steward, mcp_xp, money,
stack_manager, HUD, run_report, player controller, xp_filler, faction_join, metrics_logger, dnet_root,
sleeve_controller, sleeve_buyer, gang-controller, cct_watcher, capital_manager). Player in Powerhouse Gym (defense);
the controller has already decided Tetrads field work for Bionic Arms (+125k rep) and switches when its cooldown ends.
Sleeves: all 6 at shock 0 (sleeve 5 sync 72), on Slum Snakes, CyberSec, Tian Di Hui, Tetrads faction work and two on
Mug. Gang (NiteSec): 8 members on Plant Virus, respect 8.37k, wanted 1077, penalty 0.886, NiteSec rep 153 (about
380/h). Measured, 13 samples 07:15 to 08:15: rep/h Tian Di Hui 10.6k, CyberSec 3.62k, Slum Snakes 1.67k, NiteSec 136;
hacking exp 16.6m/h (44 levels/h), karma -598/h, cash 7.95b/h, MCP rate 33.4m/s average 10.1m/s, share 1.3. Trend:
`n/a` on every series (cycle 1.3h old, too short). Advisor: **build** (nothing to install; best next LuminCloaking-V2
in 2.6h). Decision: **no install, agree** (one hour into the cycle). Next gate avmnite-02h at hacking 210, about 20
minutes away at the current rate. World Daemon: not present (14 installed, no Red Pill). Share A/B not run (player not
yet settled on one faction's work; next quiet hour). `metrics.py cycles` for the new cycle: still too young for
rebuild figures.

**BN10 run 2, install 1 ran 2026-11-09 06:59 Pacific, 2-hourly task: 13 augmentations and 2 NeuroFlux levels.** Not a
stand-aside run (no session running). Before (metrics sample 06:15, game `ps` 06:15, readiness 06:14-06:58, gang
status 06:15): BN10, $209b at 06:15, hacking 239, combat 97-98, karma -55.5k, 0 installed, 0 queued; player on Tetrads
field work. Every resident running. Gang (NiteSec): 6 members, respect 578, wanted 72.8, penalty 0.89, members cycling
through cleanup as designed after the 04:16 fix. Measured, 12 samples 05:20 to 06:15: rep/h Tetrads 6.08k, Tian Di Hui
2.29k, CyberSec 2.29k, Slum Snakes 1.84k; hacking exp 222m/h (1.93 levels/h), karma -392/h, cash 144b/h, MCP rate
28.9m/s average 39.3m/s, share 1.5. Trend: `cash/h -12.9b>-79.8b>144b STEADY | MCP 56.5m>38.5m>28.9m DECELERATING |
hackExp/h 220m>222m>222m STEADY | lvl/h 2.7>2.29>1.93 context | rep work Tetrads 5.17k>5.84k>6.08k STEADY | rep best
Tetrads STEADY`. MCP decelerating: cause not checked (likely the target drained or retargeted as hacking crept up); it
did not matter, since the install resets the targets. Advisor at 06:14: **wait** 20m for Cranial Signal Processors -
Gen I (CyberSec, +4.9% weighted). Waited: CyberSec rep came at about 2.4k/h, not the 6.1k/h the advisor assumed (that
is Tetrads' rate), so it took about 40m. Cash fell $209b to $125b from 06:15 to 06:35 while capital_manager bought cloud
servers the install would discard, so `capital_manager.js` was killed at 06:35 (startup.js restarted it after the
install). By 06:58 Cranial Signal Processors was in the plan; the advisor then said **wait** 8m for Augmented Targeting
I (+3.8%, combat). Decision: **install, disagree**. Every short wait turns up another small augmentation, Augmented
Targeting adds little to the run target, and the cycle (21.4h, batch +65.7% weighted) had run long. Backup
`saves/bitburnerSave_pre-install1_BN10run2_2026-11-09.json.gz` (gzip checked, player parsed, node 10, 0 augs, 0 queued,
6 sleeves, $186b, SHA-256 2d76a516c2342c9d71c436395b7bd20a860c607b4467d527a1c2e3fe605ded8e). `aug_install.js` (buy
only, 06:58) bought Power Recirculation Core, Cranial Signal Processors - Gen I, Speech Processor Implant,
HemoRecirculator, S.N.A, Nuoptimal Nootropic Injector, ADR-V1 Pheromone Gene, Speech Enhancement, BitWire, Synaptic
Enhancement Implant, LuminCloaking-V1, Neurotrainer I and Wired Reflexes, plus 2 NeuroFlux levels; no donations (no
favor yet). `aug_install.js --install` then spent the remaining $34b on home RAM and cores (**home 16TB, 2 cores**) and
installed. After (game `ps` 07:00, autosave 07:02): **14 installed, 0 queued**, karma -55.9k, hacking 85, cash $1.7m,
the player in Powerhouse Gym for strength (controller's physicalTarget 75), and every resident running (MCP, supervisor,
crawler, steward, mcp_xp, money, stack_manager, HUD, run_report, player controller, xp_filler, faction_join,
metrics_logger, dnet_root, sleeve_controller, sleeve_buyer, gang-controller, cct_watcher, capital_manager). `metrics.py
cycles`: cycle 1 closed at 21.39h (logged 87%), rep earned Tetrads 69.7k, Tian Di Hui 23.8k, CyberSec 22.2k, Slum
Snakes 9.27k, NiteSec 2.24k, favor banked none; the new cycle has no rebuild figures yet. **Next:** watch the rebuild
(hacking, MCP, faction rejoin); the install set sleeves back to shock 100 with no stats (`Sleeve.prestige`), so sleeve work restarts slowly. Gang
respect and members survive. World Daemon: not present (14 installed, no Red Pill). Share A/B not run (install this
check).

**2026-11-09 04:20 Pacific, 2-hourly task, BN10 run 2: gang cleanup deadlock fixed; install at next check.** Not a
stand-aside run (no session running). Live (metrics sample 04:15, game `ps` 04:15, readiness 04:12, gang status
04:15-04:19): BN10, $76.2b, hacking 235, combat 94-95, karma -54.7k, 0 installed, 0 queued; player on Tetrads field work
for Bionic Arms (71k rep short). Every resident running, `gang-controller.js` included. Measured, 13 samples 03:15 to
04:15: rep/h Tetrads 5.17k, Tian Di Hui 1.43k, CyberSec 1.42k, Slum Snakes 1.05k; hacking exp 220m/h (2.7 levels/h),
karma -303/h, cash -12.9b/h (net of capital_manager buying RAM; cash still rose $72.5b to $76.2b since 02:20), MCP rate
56.5m/s average 39.1m/s, share 1.5. Trend: `cash/h -8.98b>-856m>-12.9b STEADY | MCP 32.6m>42.5m>56.5m ACCELERATING |
hackExp/h 221m>218m>220m STEADY | lvl/h 3.78>2.69>2.7 context | rep work Tetrads 4.36k>5.11k>5.17k STEADY | rep best
Tetrads STEADY`. **Bug found and fixed:** the gang earned nothing for two hours. At 04:15 it had respect 1, wanted 1, all
three members on Ethical Hacking in `wanted-recovery`. Reputation mode entered cleanup below an absolute penalty of 0.80
(bn10 policy), but penalty is respect/(respect+wanted) and wanted cannot go below 1, so at respect 1 the penalty is
stuck at 0.5 and cleanup never ended. `reputationCleanupMode` now scales both thresholds by the attainable penalty
respect/(respect+1) (unchanged for a large gang); test added, 548 pass in build/bn10; game copy verified, controller
restarted 04:16. Observed after: respect 1 to 2.5 (04:17) to 4.4 (04:18), cycling between respect work and cleanup as
designed; first recruit at respect 5. Advisor: **wait** (1.2h for Cranial Signal Processors - Gen I, +4.3%/h vs cycle
+3.3%/h; plan 12 augs $55.4b, batch +60.8% weighted, Tetrads, Tian Di Hui, CyberSec). Decision: **no install, agree**:
the margin is small, but gang rep from a 4-respect gang is negligible so waiting loses little, and the next aug lands
before the next check. **Install at the next check (about 06:15)** unless the advisor's next aug is under 30 minutes away;
save export first. Gang respect and members survive the install, so the gang keeps growing through it. World Daemon:
not present (0 installed, no Red Pill). Share A/B not run (install due next check).

**2026-11-09 02:20 Pacific, 2-hourly task, BN10 run 2: gang created with NiteSec; install still waits.** Not a
stand-aside run (no session running). Live (metrics sample 02:15, game `ps` 02:15, gang, sleeve and readiness status
02:16-02:18): BN10, $72.5b, hacking 230, combat 92, karma -54.1k, 0 installed, 0 queued; player on Tetrads field work for
Bionic Arms (81k rep short). Every resident running. Measured, 13 samples 01:15 to 02:15: rep/h Tetrads 4.44k, Slum
Snakes 412, Tian Di Hui 382, CyberSec 379, NiteSec 379; hacking exp 221m/h (3.96 levels/h), karma -2.68k/h, cash
-13.3b/h, MCP rate 33.4m/s average 38.8m/s, share 1.48. Trend: `cash/h 9.47b>-8.57b>-13.3b DECELERATING | MCP
36.7m>54.5m>33.4m STEADY | hackExp/h 123m>180m>221m ACCELERATING | lvl/h 3.48>3.49>3.96 context | rep work Tetrads
3.47k>3.21k>4.44k STEADY | rep best Tetrads SWITCH`. Cash/h is net of spending: total RAM is now 1.65m GB (664k at
20:16), so capital_manager is buying capacity while cash still rose ($65.6b to $72.5b since 00:17); not a falling
income. **Gang:** karma passed -54k, but `gang_create.js` defaults to The Black Hand (Ken's run 1 choice), whose invite
needs a backdoor on I.I.I.I (bitburner-src `FactionInfo.tsx`), out of reach at hacking 230. NiteSec is the other hacking
gang (`Gang/data/Constants.ts`) and the player was already a member, so `run gang_create.js NiteSec` created it at
about 02:16 (karma -54109) and started `gang-controller.js` (3 members training hacking, reputation mode). NiteSec's
small rep reset to 0 (startGang). The choice is permanent for this BitNode. Side effect fixed by itself: sleeve 1 was
still on NiteSec targets and the game refused it ("started a gang with them") until the readiness file named the gang
faction (02:17); from 02:17:44 it takes money crime. Run target first step relabelled, gang policy objective text no
longer names The Black Hand (both pushed). Advisor: **wait** (1.1h for Power Recirculation Core, +19.0%/h vs cycle
+2.5%/h; plan 10 augs $15.0b, Tetrads, Tian Di Hui, CyberSec). Decision: **no install, agree**; the gang now exists, so
the last check's hold is lifted. Install once the advisor turns or by the next check, after some gang respect has built
(gang members and respect survive an install; the gang faction's rep does not), with a save export first. World Daemon:
not present (0 installed, no Red Pill). Share A/B not run (install due within hours).

**2026-11-09 00:17 Pacific, 2-hourly task, BN10 run 2: sleeve-aug bug fixed; install held for the gang.** Not a
stand-aside run (no session running). Live (autosave summary, game `ps`, readiness and sleeve status 00:15-00:16): BN10,
$65.6b, hacking 222, karma -48.2k, 0 installed, 0 queued, factions NiteSec, Tetrads, Slum Snakes, Tian Di Hui, CyberSec;
player on Tetrads field work for Bionic Arms (89k rep short). Every resident running. Measured, 12 samples 23:20 to
00:15: rep/h Tetrads 3.47k, CyberSec 2.21k, NiteSec 1.39k, Tian Di Hui 1.39k, Slum Snakes 151; hacking exp 123m/h (3.48
levels/h), karma **-1.53k/h** (was -5.15k/h), cash 9.47b/h, MCP rate 36.7m/s average 38.7m/s, share 1.48. Trend:
`cash/h 7.24b>-2.41b>9.47b STEADY | MCP 38.2m>52.3m>36.7m STEADY | hackExp/h 117m>121m>123m STEADY | lvl/h
5.01>4.11>3.48 context | rep work Tetrads 3.99k>3.48k>3.47k STEADY | rep best Tetrads SWITCH`. **Bug found and fixed:**
`sleeve_buyer.js` bought 30 sleeve augmentations (S.N.A, Speech Enhancement, BitWire and others, $30m-class) about
23:20-23:30, and each purchase zeroes that sleeve's exp (bitburner-src `Sleeve.installAugmentation`): all six sleeves fell
to 3265 combat exp each (save check 00:16), sleeve Homicide chance 29% to 15%, karma stalled 23:20-23:35. The buyer now
holds sleeve augs while karma is above `crimeKarmaTarget` unless the sleeve's combat exp is under 1000 (just after an
install); 548 tests pass in build/bn10; restarted in game 00:16 and the game copy carries the change (status 00:16:
`save`). Advisor: **wait** (3.4h for Power Recirculation Core, +5.8%/h vs cycle +2.9%/h; plan 10 augs $15.0b, batch
+41% weighted). Decision: **no install, agree**, and this changes the last check's plan to install now: an install sets
every sleeve back to shock 100 with no stats (`Sleeve.prestige`), which would stall sleeve karma for many hours with the
gang 5.8k karma away (about 4h at the measured rate, sooner as sleeve exp regrows). Install once the gang exists
(`gang-controller.js` via `startup.js`), with a save export first. World Daemon: not present (0 installed, no Red Pill).
Share A/B not run (install due within hours). Save check `saves/check_BN10run2_2026-11-09_0020.json.gz`.

**2026-11-08 22:20 Pacific, 2-hourly task, BN10 run 2: NiteSec joined; first install held one more check.** Not a
stand-aside run (no session running). Live (autosave summary, game `ps`, readiness and sleeve status 22:14-22:18): BN10,
$62.7b, hacking 214, karma -41.2k, 0 installed, 0 queued, factions **NiteSec** (rep 934), Tetrads, Slum Snakes, Tian Di
Hui, CyberSec; player on Tetrads field work for Bionic Arms (96k rep short). Every resident running (same list as
20:16). Sleeves 0-4 on Homicide (29% chance, shock 1.9). Measured, 13 samples 21:15 to 22:15: rep/h Tetrads 3.99k,
NiteSec 1.32k, CyberSec 1.3k, Tian Di Hui 1.3k, Slum Snakes 151; hacking exp 117m/h (5.01 levels/h), karma -5.15k/h,
cash 7.24b/h, MCP rate 38.2m/s average 36.4m/s, share 1.47. Trend: `cash/h -12.7b>-7.76b>7.24b ACCELERATING | MCP
41.2m>31.5m>38.2m STEADY | hackExp/h 60.3m>116m>117m STEADY | lvl/h 6.98>8.27>5.01 context | rep work Tetrads
3.08k>3.63k>3.99k ACCELERATING | rep best Tetrads ACCELERATING`. Nothing decelerating. Advisor: **wait** (31m for S.N.A,
+14.7%/h vs cycle +2.4%/h); installPlan 7 augs, $2.57b (Tetrads, Tian Di Hui, CyberSec), no factions held. Decision:
**no install yet**, agree. Why: rep is still accelerating, the next aug is 31m out, NiteSec rep is only 934 (none of its
augs reachable this cycle anyway), and karma reaches -54k for the gang in about 2.5h at -5.15k/h; an install now also
throws away the purchased-server fleet (rebuild took about 6h last cycle) for a +30% weighted batch. Plan: install at the
next check (about 00:15) unless the advisor still shows a better-than-cycle next aug; export and validate the save
first. World Daemon: not present (0 installed, no Red Pill). Share A/B not run (install due next check).

**2026-11-08 20:16 Pacific, 2-hourly task, BN10 run 2: steady, no changes.** Not a stand-aside run (no session
running). Live (autosave summary, game `ps`, readiness and sleeve status 20:14-20:16): BN10, $47.4b, hacking 201, karma
-31.0k, 0 installed, 0 queued, factions Tetrads, Slum Snakes, Tian Di Hui, CyberSec; player on Tetrads field work for
Bionic Arms (104k rep short). Every resident running (MCP, supervisor, crawler, steward, money, stack_manager,
run_report, faction_join, player controller, capital_manager, metrics_logger, HUD, dnet_root, cct_watcher,
sleeve_controller, sleeve_buyer, xp_filler, share). Sleeves 0-4 on Homicide (28% chance, shock 5.5). Measured, 12
samples 19:20 to 20:15: rep/h Tetrads 3.14k, others 151; hacking exp 62.6m/h (6.88 levels/h), karma -4.63k/h, cash
-3.56b/h (net spending this hour, cause not verified; total RAM now 664k GB), MCP rate 47.5m/s average 18.5m/s, share
1.44. Trend: `cash/h 3.05b>10b>-3.56b STEADY | MCP 64.6m>27.8m>47.5m STEADY | hackExp/h 31.2m>53m>62.6m ACCELERATING |
lvl/h 12.3>9.69>6.88 context | rep work Tetrads 3.77k>3.26k>3.14k STEADY | rep best Tetrads STEADY`. Advisor: **wait**
(48m for S.N.A, +9.1%/h vs cycle +2.8%/h); decision: **no install**, agree; the run target holds the first install for
NiteSec (hacking 211, about 1.5h at 6.88 levels/h). World Daemon: not present (no Red Pill). Share A/B not run (first
install due within hours). **Next:** NiteSec gate (~21:45), then first install; gang at -54k karma in about 5h.

**2026-11-08 18:16 Pacific, 2-hourly task, BN10 run 2: steady, no changes.** Not a stand-aside run (no session
running). Live (autosave summary, game `ps`, readiness and sleeve status 18:14-18:16): BN10, $22.0b, hacking 184, karma
-21.7k, 0 installed, 0 queued, factions Tetrads, Slum Snakes, Tian Di Hui, CyberSec; player on Tetrads field work for
Bionic Arms (110k rep short). Every resident running (MCP, supervisor, crawler, steward, money, stack_manager,
run_report, faction_join, player controller, capital_manager, metrics_logger, HUD, dnet_root, cct_watcher,
sleeve_controller, sleeve_buyer, xp_filler). Sleeves: 0-4 on Homicide (25% chance, shock 9.2), sleeve 5 on Synchronize
at sync 43. Measured, 13 samples 17:15 to 18:15: rep/h Tetrads 3.77k, CyberSec 1.31k, Tian Di Hui 1.31k, Slum Snakes
157; hacking exp 31.2m/h (12.3 levels/h), karma -4.44k/h, cash 3.05b/h, MCP rate 64.6m/s average 11.5m/s, share 1.42.
Trend: `cash/h 2.86b>7.3b>3.05b STEADY | MCP 9.8m>57.3m>64.6m ACCELERATING | hackExp/h 6.58m>18.7m>31.2m ACCELERATING |
lvl/h 22.4>18.6>12.3 context | rep work Tetrads 3.06k>3.13k>3.77k STEADY | rep best Tetrads STEADY`. Levels/h falls
only because level follows the log of exp; exp/h is still rising. Advisor: **wait** (1.5h for HemoRecirculator, +8.7%/h vs
cycle +2.0%/h); decision: **no install**, agree; the run target holds the first install for NiteSec (hacking 211, about
2.2h at 12.3 levels/h). World Daemon: not present (no Red Pill). Share A/B not run (income still ramping).
**Next:** NiteSec gate (~20:30), then first install; gang at -54k karma in about 7h at -4.44k/h.

**2026-11-08 16:16 Pacific, 2-hourly task, BN10 run 2: steady, no changes.** Not a stand-aside run (no session
running). Live (autosave summary, game `free`/`ps`, readiness and sleeve status 16:14-16:16): BN10, $4.60b, hacking 154,
karma -12.95k, 0 installed, 0 queued, factions Tetrads, Slum Snakes, Tian Di Hui, CyberSec; player on Tetrads field work
for Bionic Arms (117k rep short). Home now **2.05TB** (1.20TB used); every resident running (MCP, supervisor, crawler,
steward, money, stack_manager, run_report, faction_join, player controller, capital_manager, metrics_logger, HUD,
dnet_root, cct_watcher, sleeve_controller, sleeve_buyer, xp_filler). Sleeves: **6**; 0-4 on Homicide (22% chance,
shock 12.8), sleeve 5 new (memory 1) on Synchronize at sync 36. Measured, 12 samples 15:20 to 16:15: rep/h Tetrads
3.03k, Tian Di Hui 1.08k, CyberSec 1.08k, Slum Snakes 151; hacking exp 7.03m/h (22.1 levels/h), karma -3.67k/h, cash
3.19b/h, MCP rate 10.4m/s average 1.78m/s, share 1.31. Trend: `cash/h 42.5m>589m>3.19b ACCELERATING | MCP
444k>1.62m>10.4m ACCELERATING | hackExp/h 496k>1.26m>7.03m ACCELERATING | lvl/h 13.5>14.7>22.1 context | rep work
Tetrads SWITCH | rep best Tetrads SWITCH`. Advisor: **wait** (20m for Neurotrainer I); decision: **no install**, agree;
the run target holds the first install for NiteSec (hacking 211, about 2.6h at 22 levels/h). World Daemon: not present
(no Red Pill). Share A/B not run: income is ramping several-fold per hour, which would swamp any share effect.
**Next:** NiteSec gate (~18:45), then first install; gang at -54k karma in about 11h at -3.67k/h.

**2026-11-08 14:15 Pacific, 2-hourly task, BN10 run 2: steady, no changes.** Not a stand-aside run (no session
running). Live (autosave summary, `ps`/`free` and readiness 14:14-14:15): BN10, $104m, hacking 117, karma -6.10k, 0
installed, 0 queued, factions Tetrads, Slum Snakes, Tian Di Hui, CyberSec; player on Tetrads field work for Bionic Arms
(rep 2.2k). Home **256GB** (214GB used); every resident is back: MCP, supervisor, crawler, steward, money,
stack_manager, run_report, faction_join, player controller, capital_manager, metrics_logger, HUD, dnet_root,
cct_watcher, sleeve_controller, sleeve_buyer, xp_filler. Measured, 12 samples 13:20 to 14:15: rep/h Tetrads 2.69k, Tian
Di Hui 2.58k, Slum Snakes 147, CyberSec 146; hacking exp 515k/h (13.5 levels/h), karma -2.24k/h, cash 50.5m/h, MCP rate
407k/s average 146k/s, share 1.21. Trend: `cash/h -->30.8m>50.5m n/a | MCP -->5.71k>407k n/a | hackExp/h -->287k>515k
n/a | lvl/h -->23.8>13.5 context | rep work Tetrads SWITCH | rep best Tetrads SWITCH` (cycle 4.7h, MCP only back since
12:16). Advisor: **wait** (13m for ADR-V1 Pheromone Gene); decision: **no install**, agree, and the run target holds the
first install for NiteSec (hacking 211, about 7h at the measured rate). World Daemon: not present (no Red Pill). Share A/B
not run (player switched faction work this cycle). **Next:** NiteSec gate, then first install; gang at -54k karma in
about 21h at -2.24k/h.

**2026-11-08 12:18 Pacific, 2-hourly task, BN10 run 2: MCP was down; fixed.** Not a stand-aside run (no session
running). Live (autosave 12:14, `player_activity_status.json` 12:14, game `ps`/`free` 12:15): BN10, $15.7m, hacking 79,
karma -3.07k, 0 installed, 0 queued, factions Slum Snakes and Tian Di Hui. Home **128GB**, but the residents
(player controller 36.8GB, capital_manager 17.25, HUD 15.45, stack_manager 11.05, faction_join 10.1 and the rest) used
127.95GB, so `mcp.js` (16.95GB) had not run since about 09:38 (steward recovery count 207). **Fix:** killed HUD and
`cct_watcher.js`, restarted `capital_manager.js`, started `mcp.js` (running at 12:16, 4.4GB free); `capital_manager.js`
now holds back `mcp.js`'s RAM while MCP is down (547 tests pass in build/bn10). Swapped `dnet_root.js` (registry empty,
darknet idle) for `metrics_logger.js`. Run 1's 1MB `metrics_log.txt` (which broke `metrics.py pull`) renamed in game to
`metrics_log_bn10run1.txt` (local copy `runtime/metrics_log_bn10run1.txt`), so run 2's log starts fresh. **No measured
rates or trend line this run** (no run 2 samples yet). Player controller has the player at Powerhouse Gym toward its 75
combat baseline (strength 68/75), not on Homicide (its candidate: 59% chance, about 0.59 karma/s); left as is. Advisor:
**build** ("nothing to install yet; best next Wired Reflexes in 7.2h"); decision: no install, agree. World Daemon: not
present in run 2 (needs The Red Pill). Still off for RAM: HUD, `cct_watcher.js`, `dnet_root.js`, `sleeve_controller.js`,
`xp_filler.js`; they return as home grows (256GB next). **Next:** check MCP income and the first run 2 metrics samples.

**2026-11-09 10:41 (PC clock), BN10 run 2 (Ken session): gang ascension enabled.** The gang (NiteSec, 9 members,
karma -57.6k, formed overnight) had never ascended: `shouldAscendMember` refused in reputation mode, and its 0.998
penalty floor could not be met while the 0.80/0.90 reputation band runs the penalty near 0.86. Every member qualified
at x2.5 to x5.1 hacking multiplier (formula sqrt((exp-1000)/2000)). Ken approved the change: ascend in either mode
outside cleanup/severe/territory-power, threshold x1.5 (was 1.25), penalty floor = the band's `reputationCleanupEnter`
in reputation mode (old floor kept for money mode), one per loop, largest gain first; `gang_status.json` reports
`lastAscension`. 548 tests pass. Live: **...4769 ascended x5.16, then ...9467 x3.28** (the next largest that kept the
penalty at 0.80); respect 49.3k -> 36.1k, cleanup entered at 0.80 and was recovering (0.818 by 10:41). Both were back
over hacking 75 within 2 minutes (117, 88). Ascension also strips bought gear (augmentations stay): each lost 4
items. **Next:** watch that ascensions and cleanup alternate rather than hold the gang at the floor; if respect
growth stalls, raise the threshold or the floor.

**2026-11-08 10:26 Pacific, BN10 run 2 (Ken session): player on Homicide, sleeves on Shoplift.** Home grew to 64GB
(capital_bootstrap handed over to capital_manager; the steward fills spare RAM at once, so a one-shot needs a
`kill <pid>; run ...` on one line). BN10 stat levels are about 0.4x: 6.7k strength exp gave strength 41, so the
gym target was 42 str / 44 def (Powerhouse Gym, ~12 exp/s at $2.4k/s), not 100. `player_now.js` (new, core/dev, pushed
by hand) put the player on Homicide: **measured 30 kills in ~5 min, about 30% success, about 0.3 karma/s** (Shoplift
0.05/s); BN10 does not appear to lower crime success. Ken moved the sleeves to Larceny; reverted to Shoplift with
his agreement (at dex/agi 27 Larceny succeeds 17%: $1.5k/s vs $7.5k/s; it wins only near dex/agi 146).
`sleeve_crime_now.js` now takes `gym:<stat>` and sleeve indices. **Next:** sleeves on Homicide need str/def ~42
(about 1h and $9m per sleeve; then about 0.23 karma/s each but $3.4k/s vs $7.5k/s money). Train them two at a time
once hacking income replaces sleeve money; all six would bring the -54k gang gate to about 9h instead of 27h.


**2026-11-08 09:20 PST (10:20 PC clock), 2-hourly task, run 2 check: steady, no changes.** Not a stand-aside run (no session running; Ken's "Bitburner session" idle since 09:10). Live (autosave 09:19, `capital_status.json` 09:16): BN10, $20m, hacking 54, karma -466, 0 installed, factions Slum Snakes and Tian Di Hui, player at Powerhouse Gym (defense). Home **64GB**, 1 core; `capital_manager.js` is saving $47.8m for the next home upgrade at about $22k/s. 6 sleeves on Shoplift, shock 23.5. Running (game `ps` 09:16): mcp_money, capital_manager, steward, money, faction_join, run_report, dnet_root. Not yet running for lack of RAM: mcp.js, stack_manager, HUD, player controller, metrics_logger, sleeve_controller. No metrics for run 2 yet (logger not running; `metrics.py pull` still fails on the 1.1MB run 1 `metrics_log.txt`), so no measured rates or trend line. World Daemon: not present in run 2 (needs The Red Pill); the "World Daemon ready" line above is run 1. Note: `game_terminal.py` returned empty output for `free`/`ps` several times (output is sliced by line count; a full terminal buffer gives nothing), and once refused with "terminal holds typed text: sa 3". **Next:** after the home upgrade, check capital_manager starts the rest; if sleeve_controller still does not fit, consider moving some sleeves from Shoplift to Mug for karma.

**BN10 run 2 entered 2026-11-08 (Ken destroyed the World Daemon and chose BN10 himself, in his session).**
Save backup before the daemon: `saves/bitburnerSave_pre-worlddaemon_BN10_2026-11-08.json.gz` (node 10, hacking 8032,
79 installed). Live after entry (autosave): BN10, SF 1.2, 2.1, 4.3, 5.3, 10.1, 15.1; $82k, home 32GB, karma -0.8;
player on Shoplift (Ken). **6 sleeves** (min(3, SF10 1 + 1 in BN10) + 4 Covenant): 5 at memory 100 and sync 100, the new
6th at memory 1 and sync 25; all at shock 24.9 (BN10 entry caps shock at 25). Same 32GB squeeze as run 1, so as
then: killed `mcp.js` (17GB); `sleeve_crime_now.js` (new, core/dev, pushed by hand) put all 6 sleeves on Shoplift
for money and karma, since `sleeve_controller.js` (26GB) does not fit; `capital_bootstrap.js` runs (buys home RAM);
`early_spread.js joesguns` rooted 5 and started 41 loop threads, plus 6 on home. **Next: as home grows, kill the
weakenGrowHack loops and `run startup.js`; sleeve_controller then takes the sleeves (it recovers shock to 5 first).**
`run_target.json` rewritten for run 2: gang first (karma -54k), NiteSec, Covenant (6th sleeve memory, $100q 5th
sleeve as a bonus), Red Pill, World Daemon. Authority: Ken confirmed run 1's terms carry over (installs approved with a
backup, stop at the World Daemon or any reset); recorded in `AGENTS.md`.

**Gang change 2026-11-08 (Ken session; Ken away overnight, left it in the agent's hands).** In reputation mode the
gang had spent over 95% of its time with all 9 members on Ethical Hacking: 1.9 respect/s. That was the 0.998/0.999
attainable-penalty cleanup band, tuned for the old 13m-respect gang. Reputation mode now uses an absolute
wanted-penalty band from `gang_capital_policy.json` (`reputationCleanupEnter`/`Exit`). Results: bn10 at 0.90/0.95
measured about 50 respect/s and 8 Black Hand rep/s; at 0.80/0.90 (kept) about 74 respect/s and 12 rep/s, with 10
members. Ken: money should not weigh in gang work now; reputation (Daedalus for the Red Pill, Black Hand for augs) is
the focus. Not done: rank gear by respect rather than money payback in reputation mode; allow ascension in reputation
mode (disabled now). Also check whether Daedalus or The Covenant rep work serves the Red Pill route better.
