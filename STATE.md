# Current BitBurner Handoff

Last refreshed: 2026-11-04 01:15 PST (02:15 on the PC clock), on the PC. Sources: Steam game via
DevTools, Remote API status files.

**Hourly check, 2026-11-05 about 14:15 Pacific (PC clock 15:15): steady, no changes.** Live (autosave, game `ps`,
`augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json` over the API): BN10, about $372b,
hacking 464, karma -6540, 23 installed, 1 queued (The W1ngs of Icarus), same five factions. All 16 resident scripts,
run_report and 4 stack batches run; nothing died. Slum Snakes 42.3k of 45k for SmartSonar Implant (about 12k/h, so
about 15 minutes, modelled); next run buys it and installs both with a save backup. Sleeve 0: shock 0, sync 99.0,
Homicide. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-05 about 13:15 Pacific (PC clock 14:15): steady, no changes.** Live (game `ps`,
`augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json` over the API, autosave): BN10, about
$196b, hacking 454, karma -5747, 23 installed, 1 queued (The W1ngs of Icarus), same five factions. All 16 resident
scripts, run_report and 4 stack batches run; nothing died. Slum Snakes 29.9k of 45k for SmartSonar Implant (about 10.8k/h
from 19.1k at 12:15, so about 1.4h, modelled); install both then. Sleeve 0: shock 0, sync 99.0, Homicide. No Red Pill, so
no World Daemon.

**Hourly check, 2026-11-05 about 12:15 Pacific (PC clock 13:15): steady, darknet aug queued.** Live (autosave,
game `ps`, `augmentation_readiness.json`, `sleeve_status.json` over the API): BN10, about $207b, hacking 440, karma -5121,
23 installed, **1 queued: The W1ngs of Icarus** (labyrinth reward via `dnet_loot.js` since the last check; cash fell from
about $230b). Same five factions. All 16 resident scripts, run_report and 4 stack batches run; nothing died. Slum Snakes
19.1k of 45k for SmartSonar Implant (about 10k/h from 9.0k at 11:15, so about 2.5h, modelled). Not installing for one aug:
bundle it with SmartSonar. Sleeve 0: shock 0, sync 99.0, Homicide. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-05 about 11:15 Pacific (PC clock 12:15): steady, no changes.** Live (autosave, game `ps`,
`augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json` over the API): BN10, about $230b,
hacking 424, karma -4381, 23 installed, 0 queued, same five factions. All 16 resident scripts and 4 stack batches run;
nothing died. Player on Slum Snakes field work: 9.0k of 45k for SmartSonar Implant (about 8k/h from 0.7k at 10:15, so
roughly 4.5h, modelled). Sleeve 0: shock 0, sync 99.0, Homicide. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-05 about 10:15 Pacific (PC clock 11:15): Covenant gym goal gated on reachability.** Live
(autosave, `player_activity_status.json`, game `ps`): BN10, about $75.0b, hacking 398, karma -3724, 23 installed, 0 queued,
factions The Black Hand, NiteSec, Slum Snakes, Tian Di Hui and CyberSec. The Covenant goal had the player in the gym, but
the gate is out of reach: from the skill formula, strength 92 at 14.2k exp (effective mult 0.87) needs about 1e16 exp for
850, and the gym gives about 20 exp/s; hacking 850 likewise needs about 3.6e16 exp (1.6e9 now). Fix: `covenantTraining`
infers each stat's multiplier from level and exp and skips the goal when the gym would take over `covenantMaxTrainHours`
(48). 504 tests pass in `build/bn10`; synced, `restart_player.js` run, and the controller now decides Slum Snakes field
work for SmartSonar Implant (0.7k/45k rep), held by the 10-minute switch cooldown when read (switch not yet observed).
`covenantTarget` stays true. Sleeve 0: shock 0, sync 99.0, Homicide. No Red Pill; `w0r1d_d43m0n` unlinked, needs hacking
6000. **Implication:** The Covenant needs far higher stat multipliers (many more installs and NeuroFlux), so the run is in
a long aug-grinding phase; worth Ken's review whether BN10's Covenant goal is realistic.

**Hourly check, 2026-11-05 about 09:20 Pacific (PC clock 10:20): fixed the Covenant gym start.** Live (autosave, game
`ps`, `augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json` over the API): BN10, about $38.6b,
hacking 345, karma -3227, **23 installed** (install 4 confirmed), 0 queued, factions NiteSec, Tian Di Hui and CyberSec.
The controller had picked the Covenant goal (strength 27/850) but `gymWorkout` was refused every poll: the player was in
Chongqing and Powerhouse Gym is in Sector-12. Fix: gym decisions now carry `city` (`gymCity`, default Sector-12) and the
controller travels first (503 tests pass in `build/bn10`); pushed, controller restarted, live work read back as CLASS str at
Powerhouse Gym. All 16 resident scripts and 4 stack batches run. Sleeve 0: shock 0, sync 99.0, Homicide. No Red Pill, so no
World Daemon. **Watch:** the Covenant goal needs cash >= $37.5b each poll, with no hysteresis, so spending can flip the
player back to NiteSec work; add hysteresis if that is seen.

**BN10 install 4 ran 2026-11-05 about 08:15 Pacific (PC clock 09:15), hourly task.** Before (autosave, game `ps`,
`augmentation_readiness.json`, `sleeve_status.json`): BN10, about $241.7b, hacking 405, karma -2618, 19 installed, 0
queued, factions The Black Hand, NiteSec, Tetrads, Slum Snakes, Tian Di Hui and CyberSec. Neural Wit Amplifier rep-ready
and Combat Rib I within 27 rep. Backup `saves/bitburnerSave_pre-install4_BN10_2026-11-05.json.gz` (gzip checked, player
parsed, node 10, 19 augs, no Red Pill, SHA-256 c5fa0f867b4eeac4fca13242ebc5960941bc331b7b7e80071cfc99feeb4128c1).
`aug_install.js --install` (`aug_install_status.json`) bought Combat Rib I, Neural Wit Amplifier, LuminCloaking-V1 and
V2, no failures, plus 6 NeuroFlux; home stays 16TB, 3 cores. After (game `ps`): all 16 resident scripts back. Expected 23
installed (not yet read back live). **`covenantTarget` set true** in `profiles/bn10/config/player_activity_config.json`
(503 tests pass in `build/bn10`; pushed and read back from the game): once cash reaches $37.5b the player trains combat
to 850, then hacking to 850, for The Covenant (also $75b). Sleeve 0: shock 0, sync 99.0, Homicide. No Red Pill, so no
World Daemon. **Next:** confirm 23 installed and that the controller picks the Covenant goal; start `sleeve_buyer.js`
after joining The Covenant.

**Hourly check, 2026-11-05 about 07:20 Pacific (PC clock 08:20): steady, no changes.** Live (autosave, game `ps`,
`augmentation_readiness.json`, `sleeve_status.json` over the API): BN10, about $106b, hacking 388, karma -2062, 19
installed, 0 queued, same five factions. All 16 resident scripts and 4 stack batches run; nothing died. Slum Snakes 7.8k of
10k for Neural Wit Amplifier (LuminCloaking-V1 already rep-ready). **Plan unchanged:** install once Neural Wit is
rep-ready (the 08:15 Pacific check), reaching 20, then set `covenantTarget` true. Sleeve 0: shock 0, sync 99.0,
Homicide. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-05 about 06:15 Pacific (PC clock 07:15): steady, joined Slum Snakes.** Live (autosave, game
`ps`, `augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json` over the API): BN10, about $46b,
hacking 364, karma -1575, 19 installed, 0 queued, factions The Black Hand, NiteSec, Slum Snakes, Tian Di Hui and
CyberSec. Every resident script, crawler and run_report run; nothing died. The planner moved the player to Slum Snakes
field work for its cheap augs: LuminCloaking-V1 (3k rep, $25m) at 1.2k, then Neural Wit Amplifier (10k, $50m), at about
3.7k/h (modelled from 1.2k over ~19 min). **Plan:** install 4 (reaches 20) once Neural Wit is rep-ready, about 08:45
Pacific, then set `covenantTarget` true. Sleeve 0: shock 0, sync 99.0, Homicide. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-05 about 05:20 Pacific (PC clock 06:20): install 3 confirmed, steady.** Live (autosave, game
`ps`, `augmentation_readiness.json`, `aug_install_status.json`, `sleeve_status.json` over the API): BN10, about $13.1b,
hacking 313 (reset at 04:15 Pacific), karma -1088, **19 installed**, 0 queued, factions NiteSec, Tian Di Hui and CyberSec
(The Black Hand not yet rejoined after the reset). Every resident script, crawler and run_report run; nothing died. Rep
target CRTX42-AA Gene Modification (NiteSec 13.9k of 90k, $1.125b); player works NiteSec hacking. Sleeve 0: shock 0, sync
99.0, Homicide for karma. `covenantTarget` still false: set it after the next install (20+). No Red Pill, so no World Daemon.

**BN10 install 3 ran 2026-11-05 about 04:15 Pacific (PC clock 05:15), hourly task.** Before (autosave, game `ps`,
`augmentation_readiness.json`, `sleeve_status.json`): BN10, about $194.6b, hacking 385, karma -701, 17 installed, 0 queued,
factions The Black Hand, NiteSec, Tian Di Hui and CyberSec; Black Hand 33.0k, so Magnetism Amplifier (30k) was rep-ready
beside Nanofiber Weave, the planned trigger. Backup `saves/bitburnerSave_pre-install3_BN10_2026-11-05.json.gz` (gzip
checked, player parsed, node 10, 17 augs, SHA-256 e7c77a76c30807bda4ef31a975afdb527a57e100d82a9f912217c368f4b68015).
`aug_install.js --install` (`aug_install_status.json`) bought both planned (Magnetism Amplifier, Nanofiber Weave), no
failures, plus 10 NeuroFlux; home now 16TB (from 8.19TB), 3 cores. After (game `ps`, PIDs restarted from 2): every resident
script back (mcp, supervisor, crawler, steward, mcp_xp, money, stack_manager, HUD, run_report, controller, xp_filler,
faction_join, dnet_root, sleeve_controller, capital_manager, cct_watcher). Expected 19 installed (not yet read back live:
status files and autosave had not refreshed at check time). Sleeve 0 (the only sleeve): shock 0, sync 99.0, Homicide for
karma. No Red Pill, so no World Daemon. **Next:** confirm 19 installed; next rep target Neuroreceptor Management Implant
(Tian Di Hui 150k, rep now reset); one more install reaches 20, then set `covenantTarget` true (Covenant also needs
hacking 850 and combat 850).

**Hourly check, 2026-11-05 about 03:15 Pacific (PC clock 04:15): steady, no changes.** Live (autosave, game `ps`,
`augmentation_readiness.json`, `sleeve_status.json` over the API): BN10, about $177b, hacking 377, karma -428, 17
installed, 0 queued, factions The Black Hand, NiteSec, Tian Di Hui and CyberSec. Every resident script, crawler and
run_report run. Black Hand 20.0k of 30k for Magnetism Amplifier (about 15k/h, so roughly 40 min, modelled); Nanofiber
Weave still held for that batch. Sleeve 0: shock 0, sync 99.0, Homicide for karma. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-05 about 02:15 Pacific (PC clock 03:15): Nanofiber rep-ready, install held.** Live (autosave,
game `ps`, `augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json` over the API): BN10, about
$169b, hacking 368, karma -248, 17 installed, 0 queued, factions The Black Hand, NiteSec, Tian Di Hui and CyberSec. Every
resident script, crawler and run_report run. Tian Di Hui 76.6k, so Nanofiber Weave ($625m) is the whole install plan;
held for a bigger batch, as with CSP Gen II. Player now works The Black Hand for Magnetism Amplifier (5.1k of 30k, about
15k/h, so roughly 1.6 h, modelled). **Next:** when Magnetism is rep-ready, back up, then `aug_install.js --install`.
Sleeve 0: shock 0, sync 99.0, now on Homicide for karma (1.5% chance; still the best karma rate by the logic's model).
Next gate rothman-uni at hacking 392. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-05 about 01:15 Pacific (PC clock 02:15): steady, no changes.** Live (autosave, game `ps`,
`augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json` over the API): BN10, about $71.1b,
hacking 355, karma -217, 17 installed, 0 queued, factions The Black Hand (newly joined), NiteSec, Tian Di Hui and CyberSec.
Every resident script, crawler and run_report run. Tian Di Hui 62.9k of 75k for Nanofiber Weave (about 19k/h, so under
an hour, modelled). Next gate rothman-uni at hacking 392. Sleeve 0: shock 0, sync 96.3, synchronizing. No Red Pill, so no
World Daemon.

**Hourly check, 2026-11-05 about 00:15 Pacific (PC clock 01:15): steady, no changes.** Live (autosave, game `ps`,
`augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json` over the API): BN10, about $79.6b,
hacking 339, karma -209, 17 installed, 0 queued, factions NiteSec, Tian Di Hui and CyberSec. Every resident script,
crawler and run_report run. Tian Di Hui 43.6k of 75k for Nanofiber Weave (about 18k/h, so roughly 1.7 h, modelled). Next
gate I.I.I.I at hacking 344. Sleeve 0: shock 0, sync 92.5, synchronizing. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-04 about 23:15 Pacific (PC clock 00:15 11-05): steady, no changes.** Live (autosave, game `ps`,
`augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json` over the API): BN10, about $38.9b,
hacking 309, karma -199, 17 installed, 0 queued, factions NiteSec, Tian Di Hui and CyberSec. Every resident script,
crawler and run_report run. Tian Di Hui 25.3k of 75k for Nanofiber Weave (about 16k/h, so roughly 3 h, modelled). Next
gate computek at hacking 312. Sleeve 0: shock 0, sync 88.8, synchronizing. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-04 about 22:15 Pacific (PC clock 23:15): install 2 confirmed, steady, no changes.** Live
(autosave, game `ps`, `augmentation_readiness.json`, `player_activity_status.json`, `mcp_status.json`, and
`sleeve_status.json` and `capital_status.json` over the API): BN10, about $9.6b, hacking 247, karma -191, **17 installed**,
0 queued, factions NiteSec (rejoined), Tian Di Hui and CyberSec. Every resident script, crawler and run_report run.
MCP about $37m/s, total about $66m/s; capital_manager took cloud workers 0-8 to 2TB after the reset. Player works Tian Di
Hui for Nanofiber Weave (9.5k of 75k); NiteSec at 0.3k, so CRTX42-AA (90k) is further. Sleeve 0: shock 0, sync 85.0,
synchronizing. Next gate johnson-ortho at hacking 267. No Red Pill, so no World Daemon.

**BN10 install 2 ran 2026-11-04 about 21:17 Pacific (PC clock 22:17), hourly task.** Before (save export 21:16, readiness
file): BN10, $107.7b, hacking 278, karma -162, 14 installed, 0 queued, factions NiteSec, Tian Di Hui and CyberSec; NiteSec
42.2k rep, so Embedded Netburner Module (30k) and Neural-Retention (40k) were rep-ready beside CSP Gen II. Backup
`saves/bitburnerSave_pre-install2_BN10_2026-11-04.json.gz` (gzip checked, player parsed, node 10, 14 augs, SHA-256
e8c3f229bc80854782ae8654e78fb5b3f197a7568eb744da2be7c311bbd8f6f1). `aug_install.js --install` (`aug_install_status.json`)
bought all 3 planned (Neural-Retention, ENM, CSP Gen II), no failures, plus 10 NeuroFlux; home stays 8.19TB, 2 cores.
After (game `ps` 21:18): every resident script back (mcp, supervisor, crawler, steward, mcp_xp, money, stack_manager, HUD,
run_report, controller, xp_filler, faction_join, dnet_root, sleeve_controller, capital_manager, cct_watcher); controller on
crime for cash; `reserve` 0. Expected 17 installed (not yet read back live). NiteSec lost again; the crawler should
re-backdoor avmnite-02h at hacking 211. `covenantTarget` left false: Covenant also needs hacking 850 and combat 850, far off.
Sleeve 0: shock 0, sync 81.5. No Red Pill, so no World Daemon. **Next:** confirm 17 installed and NiteSec rejoin; CRTX42-AA
(NiteSec 90k) is the next rep target.

**Hourly check, 2026-11-04 about 19:15 Pacific (PC clock 20:15): steady, no changes.** Live (autosave, game `ps`,
`augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json`, `mcp_status.json` over the API): BN10,
about $102.6b, hacking 265, karma -147, 14 installed, 0 queued, factions NiteSec, Tian Di Hui and CyberSec. Home 8.19TB.
MCP about $83m/s. Every resident script, crawler and run_report run. NiteSec 15.7k of 30k for Embedded Netburner Module
(about 14k/h since the 18:16 switch, so roughly 1 h, modelled); CSP Gen II still rep-ready via CyberSec. Next: install
that batch once ENM is rep-ready. Sleeve 0: shock 0, sync 73.9, synchronizing. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-04 about 18:15 Pacific (PC clock 19:15): rep target now the smallest gap.** Live (autosave,
game `ps`, `augmentation_readiness.json`, `player_activity_status.json`, `sleeve_status.json`, `capital_status.json` over
the API): BN10, about $97b, hacking 257, karma -139, 14 installed, 0 queued, factions NiteSec, Tian Di Hui and CyberSec.
Income about $64m/s; every resident script, crawler and run_report run; `reserve` 0. CyberSec reached 37.9k, so CSP Gen
II is rep-ready ($625m, the whole install plan); install held for a bigger batch. Change: the controller ranked
cash-ready rep targets cheapest first and had moved to Tian Di Hui for Nanofiber Weave (66k gap) over NiteSec's
Embedded Netburner Module (29k gap). `player_activity_logic.js` now takes the smallest gap when cash is ready (cheapest
otherwise); 503 tests pass; synced, controller restarted 18:16, its next decision chose NiteSec (`switched` true).
Sleeve 0: shock 0, sync 70.1, synchronizing. Next gate johnson-ortho at hacking 279. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-04 about 17:15 Pacific (PC clock 18:15): steady, no changes.** Live (autosave, game `ps`,
`augmentation_readiness.json`, `sleeve_status.json`, `capital_policy.json` and `capital_status.json` over the API): BN10,
about $32.9b, hacking 245, karma -132, 14 installed, 0 queued, factions NiteSec, Tian Di Hui and CyberSec. The cash drop
from $51b is capital_manager upgrading cloud workers 0-8 to 64TB at $25.5b each (income about $58m/s). Every resident
script, crawler and run_report run; `reserve` 0. CyberSec 34.1k of 37.5k for CSP Gen II (about 20 min, modelled). Next
gate: johnson-ortho at hacking 279. Sleeve 0: shock 0, sync 66.4, synchronizing. No Red Pill, so no World Daemon.

**Hourly check, 2026-11-04 about 16:15 Pacific (PC clock 17:15): steady, NiteSec rejoined by itself.** Live (autosave,
game `ps`, `augmentation_readiness.json`, `sleeve_status.json` and `capital_policy.json` over the API): BN10, about $51b,
hacking 231, karma -125, 14 installed, 0 queued, factions NiteSec, Tian Di Hui and CyberSec. NiteSec is back without a
manual step, so the crawler backdoor retry works. Every resident script, crawler and run_report run; `reserve` 0. CyberSec
22.8k of 37.5k for CSP Gen II (about 10k/h, so roughly 1.5 h, modelled). Next gate: johnson-ortho at hacking 279. Sleeve 0:
shock 0, sync 62.7, synchronizing. No Red Pill, so no World Daemon. No changes made.

**Run report window, 2026-11-04 about 15:20 Pacific (PC clock 16:20).** New resident `run_report.js` shows
`run_report.json` in a "Run report" tail window; the hourly task now writes and pushes a short report at the end of
every run (prompt updated). First report (the 15:15 check) seen live in the game. capital_manager.js keeps it alive
after its next restart (source pushed, not restarted). The HUD process runs (PID 10) but its tail window was not
on screen at 15:20; left alone.

**Hourly check, 2026-11-04 about 15:15 Pacific (PC clock 16:15): steady, no changes.** Live (autosave, game `ps`,
status files, `capital_policy.json` and `sleeve_status.json` read over the API): BN10, $8.4-9.3b, hacking 205, karma -116,
14 installed, 0 queued, factions Tian Di Hui and CyberSec. Every resident script plus crawler runs; `reserve` 0. CyberSec rep
12.6k of 37.5k for CSP Gen II (about 9k/h, so roughly 3 h, modelled). The avmnite-02h gate now reads hacking 216
(`player_activity_status.json`), not 211. Sleeve 0: shock 0, sync 58.9, synchronizing. No Red Pill, so no World Daemon.
Note: `runtime/capital_policy.json` is a stale pull (shows the old $70b); read the live file with `ctl-get`.

**Hourly check, 2026-11-04 about 14:15 Pacific (PC clock 15:15): crawler now retries faction backdoors.** Live (autosave,
game `ps`, status files, `capital_policy.json` read over the API): BN10, $1.06b, hacking 165, karma -108, home 8.19TB (half
used), 14 installed, 0 queued, factions Tian Di Hui and CyberSec (NiteSec lost at the install). Every resident script
runs; `reserve` is 0. Player works CyberSec for CSP Gen II (3.5k of 37.5k). Sleeve 0: shock 0, sync 55, synchronizing.
No Red Pill, so no World Daemon. Change: `hacking/crawler.js` now runs `backdoor.js` on CSEC, avmnite-02h, I.I.I.I and
run4theh111z whenever one is rooted, within hacking level and not backdoored (worm.js only tried at its own nuke, which is
why avmnite-02h needed a manual backdoor). 502 tests pass; synced, crawler restarted (pid 6119). Not yet observed firing:
avmnite-02h needs hacking 211. **Next:** confirm NiteSec rejoins by itself at 211; rebuild cash toward install 2.

**BN10 install 1 ran 2026-11-04 about 13:25 Pacific (PC clock 14:25), hourly task.** NiteSec reached 20,207 rep at
13:24 (`augmentation_readiness.json`). Before (save over DevTools): BN10, $171.4b, hacking 233, karma -91.5, 0 installed.
Backup `saves/bitburnerSave_pre-install1_BN10_2026-11-04.json.gz` (gzip checked, player parsed, node 10, SHA-256
554930090510642f1be0f57767f380e01b827c217f0d24fee6b9264d4de7b0cf). `aug_install.js --install` (`aug_install_status.json`)
bought all 13 planned, no failures: Artificial Synaptic Potentiation, CSP Gen I, Speech Processor, Neurotrainer II, S.N.A,
Nuoptimal, ADR-V1, Augmented Targeting I, Speech Enhancement, BitWire, Synaptic Enhancement, Neurotrainer I, Wired
Reflexes, plus 2 NeuroFlux. After (status files 13:32): 14 installed, $1.6m, controller on crime for cash, `ps` shows every
resident script (mcp, capital_manager, steward, money, stack_manager, HUD, controller, xp_filler, faction_join, dnet_root,
sleeve_controller, cct_watcher). `capital_policy.json` `reserve` set back to 0 (read back). Sleeve 0 synchronizing (sync
52.5). Next readiness candidate: CSP Gen II at CyberSec (37.5k short). No Red Pill, so no World Daemon. **Next:** rebuild
cash and hacking; aim for the next install batch; Covenant needs 20 installed, $75b, hacking 850, combat 850.

**Hourly check, 2026-11-04 about 12:15 Pacific (PC clock 13:15): reserve raised for the install.** Live (autosave,
game `ps`, status files): BN10, cash $32.8-36.9b, hacking 227, karma -82.5, home 8.19TB (4TB used), 0 installed,
0 queued, 4 factions. Every resident script runs. NiteSec rep 11,749 (about 1.8 rep/s): Artificial Synaptic Potentiation
12.5k minutes away, Neurotrainer II and CSP Gen I 20k in about 75 min (modelled). Tian Di Hui's Speech Processor 176
short. Sleeve 0: shock 0, sync 47.7, synchronizing. `aug_install.js --dry` still plans the 9 ($8.9b); adding NiteSec's
three makes 12 at about $63b (1.9x per purchase, modelled). capital_manager had spent about $25b per 10 min on cloud
upgrades (mcp-worker-8 to 13 to 64TB, 11:17-12:12), which an install wipes, so I set `capital_policy.json` `reserve`
to $70b (was 0; confirmed read at 12:16). At about $43m/s cash covers the batch within the hour. **Next: install once
NiteSec reaches 20k (backup first), then set `reserve` back to 0.** No Red Pill, so no World Daemon.

**Hourly check, 2026-11-04 about 11:15 Pacific (PC clock 12:15).** Live (autosave, game `ps`, status files): BN10,
cash $45.9b, hacking 221, karma -77.5, home 8.19TB (half used), 0 installed, 0 queued, 4 factions. Every resident
script runs. Player works NiteSec hacking: 5,184 rep in an hour (about 1.4 rep/s); Artificial Synaptic Potentiation
12.5k (about 1.5 h, modelled), Neurotrainer II and CSP Gen I 20k (about 3 h). Tian Di Hui's Speech Processor 327 short.
MCP on omega-net, $42m/s now ($26.5m/s average). Install plan unchanged (9 augmentations, $8.9b), still held for NiteSec.
No Red Pill, so no World Daemon. Changed nothing in the game.

**Hourly check, 2026-11-04 about 10:15 Pacific (PC clock 11:15): NiteSec joined.** Live (autosave, game `ps`, status
files): BN10, cash $29.7-32.3b, hacking 214 (past avmnite-02h's 211), karma -71.5, 0 installed, 0 queued. Every resident
script runs. The worm's backdoor of avmnite-02h fires only once, at rooting, when hacking was still too low, so I ran
`hacking/backdoor.js avmnite-02h` by hand ("backdoor installed"); faction_join took the invite within a minute (4
factions). NiteSec rep 0: Artificial Synaptic Potentiation 12.5k, Neurotrainer II and CSP Gen I 20k. The controller
finishes Tian Di Hui's Speech Processor (747 rep short), then its cheapest-first rule picks Neurotrainer II at NiteSec;
config unchanged. Install plan still 9 augmentations, $8.9b, held for NiteSec (run_target step 2). At about 1.5 rep/s
that is a few hours (modelled). No Red Pill, so no World Daemon. Gate now crush-fitness 235.

**HUD run target, 2026-11-04 about 09:35 Pacific (PC clock 10:35).** At Ken's request the HUD now opens with a pinned
run-target block (Goal, Now with progress bars, Next, Work) from `run_target.json` (`profiles/bn10/config`). Seen live:
"NiteSec gate, hack 208/211, 98%". **Keep `run_target.json` current as the plan changes** (edit, `profile.py build bn10`,
`ctl-push run_target.json profiles/bn10/config/run_target.json`); see `docs/processes.md`. Augmented Targeting I has joined
the install plan (7 augmentations, $2.4b).

**Hourly check, 2026-11-04 about 09:15 Pacific (PC clock 10:15).** Live (autosave, game `ps`, status files): BN10,
cash $22.6-23.0b, hacking 204 (NiteSec gate avmnite-02h needs 211; it is rooted), karma -67.5, home 4TB (2TB used),
0 installed, 0 queued. faction_join added Sector-12; the player works Sector-12 hacking for Augmented Targeting I
(1,434 rep short); Tian Di Hui is 289 short of Nuoptimal (10,000). Install plan now 6 augmentations, $1.21b (ADR-V1,
Speech Enhancement, BitWire, Synaptic, Neurotrainer I, Wired Reflexes). Every resident script runs; MCP $19.5m/s
($20.9m/s average), 15 cloud servers. Still holding the install for NiteSec, now 7 hacking levels away. No Red Pill,
so no World Daemon. Changed nothing in the game.

**Hourly check, 2026-11-04 about 08:15-08:25 Pacific (PC clock 09:15).** Live (autosave, game `ps`, status files):
BN10, cash $15-21b, hacking 190, karma -58.5, home 4.10TB (1.95TB used), 0 installed, 0 queued, same 3 factions. Every
resident script runs (as at 07:20). MCP harvesting omega-net, $45m/s now ($16m/s average), 15 of 15 cloud servers.
CyberSec 7,801 rep, Tian Di Hui 4,097 (about 1.6 rep/s); the player is on Tian Di Hui for Speech Enhancement (5,000).
Rep-ready install plan: BitWire, Synaptic, Neurotrainer I, Wired Reflexes ($279m). **Held the install:** these are
small multipliers, and installing now resets hacking to 1 (NiteSec's avmnite-02h needs 211; the worm backdoors it once
rooted) and throws away CyberSec's progress toward CSP Gen I (20,000). Install once NiteSec augmentations join the
batch or rep stalls. No Red Pill, so no World Daemon. Changed nothing in the game.

**Hourly check, 2026-11-04 about 07:20 Pacific (PC clock 08:20).** Live (autosave, game `ps`, Remote API files):
BN10, cash $15.0b, hacking 169, karma -50.5, home 4.10TB (half used), 0 installed, 0 queued. Factions CyberSec, Tian Di
Hui, Sector-12. Every resident script runs (MCP, capital_manager, steward, faction_join, sleeve_controller, xp_filler,
HUD, player controller, dnet_root, 4 stack batches); gang-controller is not running (no gang yet). Only **one** sleeve
exists (the plan expected two): shock 3.0, sync 29, synchronizing for karma. Rep, not cash, is the limit: CyberSec 3,617
(Synaptic at 4,000, BitWire 7,500, CSP Gen I 20,000); rep-ready now: Neurotrainer I, Wired Reflexes. No install yet:
wait for the CyberSec batch. No Red Pill, so no World Daemon. Changed nothing.

**Augmentations under way, 2026-11-04 about 05:55 Pacific.** Home is 1TB (capital_bootstrap/capital_manager bought it
with coding-contract and cache money; cash $680m). capital_manager had restarted hud, player_activity_controller and
dnet_root, but not the startup.js-only scripts, so I ran faction_join, sleeve_controller, xp_filler, gang-controller
(no gang yet, karma -45). Factions: CyberSec, plus Tian Di Hui joined by faction_join (Sector-12 and Chongqing invites
left; city factions). Player works CyberSec hacking rep for Neurotrainer I (rep gap 1879, cash ready), then Synaptic
Enhancement, BitWire, CSP Gen I. Sleeve 0: shock 4.9, synchronizing. The game terminal had been left connected to CSEC;
`home` first.

**MCP back, 2026-11-04 about 04:35 Pacific (PC clock 05:35), Ken awake.** capital_manager bought home 32 to
64GB ($15.1m) at 04:33. The loops are gone: new `early_stop.js` (core/dev, pushed by hand, not in the manifest)
killed weakenGrowHack on 24 servers. `run startup.js` (after killing hud_consolidated and capital_manager for its
4.55GB): started mcp_supervisor, crawler, mcp.js, capital_bootstrap, maintenance_steward, mcp_xp, money.js,
stack_manager; failed for RAM: hud_consolidated, player_activity_controller, xp_filler, faction_join,
gang-controller, dnet_root, sleeve_controller. MCP is preparing targets across all 24 rooted servers. Home is
full again; capital_bootstrap keeps buying home RAM (next $47.8m) until capital_manager fits, so HTTPWorm waits
until then. Correction to the 04:15 test: the darknet does earn. With dnet_root off, the self-spreading `dnet_crawl.js`
on darknet hosts kept opening darkweb caches, four of them cash ($8.7m to $9.0m each, $35.3m by 04:42). BN10 money sources
then: coding contracts $220.8m, hacking $120.9m, darknet $35.3m. **Next: as home grows, rerun `run startup.js` (free 4.55GB first); do not rerun early_spread now that MCP runs.**

**BN10 early game, 2026-11-04 about 04:15 Pacific.** Darknet versus hacking test: in 30 min the darknet
earned $1,353 (but charisma 18 to 70); hack loops on rooted starter servers earned $1.37m in about 18 min
(game money sources). So: `mcp.js` is paused (it cannot fit beside the rest on 32GB anyway), `dnet_root.js`
runs on home for charisma and cracking, and `scripts/weakenGrowHack.js joesguns` loops fill every rooted
server (Ken's idea). BruteSSH bought; 12 servers rooted, 118 threads. `early_spread.js` (core/dev, pushed by
hand, not in the manifest) roots what the owned openers allow and fills free RAM; rerun after each port
opener. Update 04:25 Pacific: FTPCrack bought; 19 servers rooted, about 218 loop threads. The hourly run
briefly restarted mcp.js; capital_bootstrap handed over to `capital_manager.js` (17.25GB), which also
started `maintenance_steward.js`; home is full, so `dnet_root.js` is off until home grows. **When home fits `mcp.js` again: kill the weakenGrowHack loops first, then `run startup.js`.**

**Update 2026-11-04 04:20 Pacific (PC clock 05:20), hourly run.** Live (Steam, game terminal and autosave): BN10, hacking 94,
$6.3m at 04:18, home 32GB full (mcp_supervisor, crawler, capital_manager, maintenance_steward), 0 augs, no factions, karma -7,
player studying CS at Rothman. capital_manager bought relaySMTP by itself. I stopped the steward, ran
`early_spread.js joesguns`: 8 more rooted, 384 more loop threads (about 600 in all); the steward came straight back.
Next opener: HTTPWorm $30m (capital_manager buys it; then rerun early_spread the same way). Times in the 04:25 note
above were the PC clock, which runs an hour ahead of Pacific (PST since 2026-11-01).

**BN10 entered 2026-11-04 about 03:30 Pacific (PC clock 04:30).** Ken destroyed the World Daemon; at his word I
entered BN10.1 (default options). SF15 awarded. Cutover done: `restructure` merged to main (f58e530), daemon
restarted (map manifest, clean full sync of 142), `profile.py switch bn10 --live` (backup
`saves/pre-switch-bn10-20261104-033022.json.gz`, pushed 146, deleted 0), `check --content` OK, profile
manifest committed. `run startup.js`: home is 32GB, so only mcp_supervisor, crawler, mcp.js, mcp_xp started; 11
failed for RAM (incl. player_activity_controller 36.8GB, sleeve_controller 26.3GB, dnet_root 7.45GB). By hand:
killed mcp_xp, started capital_bootstrap.js (raises home RAM), player studying Computer Science (free) at
Rothman. Next: rerun `run startup.js` as home grows. Audit finding 6 was wrong: mcp.js plus mcp_xp left
capital_bootstrap 0.15GB short on 32GB. GitHub refused pushes 03:20-03:35 (outage); main pushed after.

## Repo layout (restructure branch; applies once it is merged at the BN10 cutover)

The repo is a tree (`core/`, `profiles/<name>/`, `tools/`, `docs/`); the game still has the flat
file names below. `sync_manifest.json` maps game path to repo path. **Status and event files pulled
from the game now land in `runtime/<game path>`** (e.g. `runtime/mcp_status.json`,
`runtime/augmentation_readiness.json`), not at the repo root: refresh STATE from there. Until the
merge, the root copies are the live ones. See `docs/architecture-profiles.md`.

**BN10 cutover checks, 2026-11-04 03:25 PC clock (Ken awake, reviewing).** Live: BN15, hacking 7,100
of 6,000, 66 installed, daemon connected. `restructure` merged with main (78f0ea1, committed locally;
push refused while GitHub reports an outage): 465/492 node tests, 27 Python, selftest all pass. Save backup
`saves/bitburnerSave_pre-worlddaemon_BN15_2026-11-04.json.gz` (SHA-256 a009e9a3…). Waiting on Ken's call
at the World Daemon.

## Current live state (supersedes everything below)

**2026-11-04 01:15 PST (02:15 PC clock): World Daemon ready, Ken notified (hourly task).** Live save over DevTools: node 15, hacking 6,656 of the required 6,000 (`w0r1d_d43m0n` `requiredHackingSkill` read from the save), $128t, karma -6,681, 66 installed, none queued, Remote API connected, player on Daedalus hacking work. The daemon shows **rooted** (`hasAdminRights` true) by the existing automation since 00:43 PST; not backdoored, not destroyed, no BitNode chosen. The push notification tool reported "not sent" because the app terminal was active; the message is in the `bitburner-bn15-progress` session instead. **Next: Ken opens a BitBurner session and says "review the BN10 startup steps" (`docs/bn10-cutover-runbook.md`). The hourly task makes no further changes.**

**Install 7 ran 00:39 PST 2026-11-04 (hourly task): the hacking augmentations are installed.** Before (00:15-00:39, save over DevTools, `ctl-status`, `augmentation_readiness.json`): node 15, $1.61q, hacking 3,795 of 6,000, karma -6,669, 52 installed, The L4w of Bayes queued, Remote API connected, MCP about $100b/s net. OmniTek InfoLoad became rep-ready at 00:38 (626.4k of 625k, about 126 rep/s as modelled). Backup `saves/bitburnerSave_pre-install7_BN15_2026-11-04.json.gz` (gzip checked, player parsed, L4w queued, SHA-256 5eae137658eccd4562f1a690eff0e3c09142cce6777f8412da6b74849ff4996b). `aug_install.js --install` (`aug_install_status.json`) bought 13: ENM Analyze Engine, PC Direct-Neural Interface, OmniTek InfoLoad, nextSENS, Neuronal Densification, Social Dynamics Processor, Synfibril Muscle, Bionic Legs, Bionic Spine, Combat Rib II and III, Augmented Targeting II and III; 6 NeuroFlux ($81.7b donated for NeuroFlux rep), no failures; home to 2,097,152GB, 7 cores.
**After it (save 00:41 PST, `ps`):** 66 installed, none queued, all startup scripts running, controller on crime for cash as in earlier rebuilds. **Hacking 4,629 two minutes after the install** (exp 4.1e8). By level = mult x 0.6 x (32 ln exp - 200), 6,000 needs about 2.3e10 exp (modelled), so probably within the next hour or two. World Daemon not rooted, not touched.
**Next:** the hourly task checks hacking against `getServerRequiredHackingLevel("w0r1d_d43m0n")` (6,000) and notifies Ken when reached. Nothing else to buy for the daemon.

**23:15-23:17 PST 2026-11-03 (hourly task; save over DevTools, `ctl-status`, `augmentation_readiness.json`, `player_activity_status.json`, `hacking_survey.json`):** node 15, $1.02q, hacking 3,737 of 6,000 (World Daemon required level read live by the controller's gate scan: 6,000; not ready, not rooted), exp 5.68e11, mult 9.35, karma -6,641, 52 installed, The L4w of Bayes queued (no hacking stats; not in the survey), Remote API connected. Clarke rep 423.7k to 438.8k in 120s (about 125 rep/s with share), so nextSENS and Neuronal are both rep-ready. At 23:16:14 the controller switched itself to OmniTek hacking work for OmniTek InfoLoad (needs +621.8k; status file, the save had not autosaved yet). At 125 rep/s that is about 83 minutes, so InfoLoad rep about 00:40 PST (modelled); PC Direct-Neural Interface (x1.08, 375k, OmniTek) comes on the way.
**Why wait for InfoLoad before installing:** level = mult x 0.6 x (32 ln exp - 200). With nextSENS and Neuronal only (mult about 12.9), 6,000 needs about 1.7e13 exp, roughly 68 hours at 7e7/s. With InfoLoad and PC DNI too (mult about 16.7, exp mult about 20.9), it needs about 7e10 exp, under an hour (modelled). Xanipher (NWO) is not needed. **Next:** when OmniTek reaches 625k: back up, then `aug_install.js --install`.
Clock note: the PC's clock is British Columbia time (UTC-7, `BCDT`), an hour ahead of US Pacific (PST, UTC-8) since 2026-11-01. Entries below marked "Pacific" on 2026-11-03 after about 18:00 used the PC clock.

**23:14-23:24 Pacific 2026-11-03 (hourly task; save over DevTools, `ctl-status`, status files, game page):** node 15, $621t, hacking 3,682 of 6,000 (World Daemon not ready, not rooted), exp 4.05e11 rising about 6.9e7/s, karma -6,610, 52 installed, none queued, Remote API connected. Clarke faction joined: 128.7k rep at about 80 rep/s unshared (Neuronal Densification 187.5k, nextSENS 437.5k). Favor (save): Clarke 0, Daedalus 87, so neither takes donations; BitRunners 218, Bachman 179, NiteSec 153.
**Changed:** `share_deploy.js cloud 8`: 2.09m share threads on 8 cloud servers (save). `companyTarget` Clarke to OmniTek Incorporated (pushed, read back). The controller switched at 23:17 on its own, and the page shows focused Business Analyst work at 314.9 company rep/s, 35.3k so far, so the 400k invite is about 20 minutes away (modelled). After the invite, the controller goes back to priority faction work unaided (Neuronal, nextSENS, then OmniTek InfoLoad). Effect of share on faction rep not yet measured. The 23:20 save showed focus off; the page at 23:23 showed focused work.
**Next:** when nextSENS, Neuronal and InfoLoad are rep-ready: back up, then `aug_install.js --install`. Optionally set `companyTarget` to NWO for Xanipher first; that is about 1.5 hours more, modelled.

**22:15-22:20 Pacific 2026-11-03 (hourly task; save over DevTools, `hacking_survey.json`, `company_survey.json`): hacking 6,000 is out of reach at the current multiplier. One more install with hacking augmentations is needed.** Live: node 15, $177t, hacking 3,512, hacking mult 9.35, exp mult 15.17, exp 1.62e11 rising about 7e7/s, karma -6,591, 52 installed, none queued, Remote API connected. World Daemon still needs 6,000 (read from the save), not rooted. Level is mult x 0.6 (BN15 `HackingLevelMultiplier`, read) x (32 ln exp - 200), so each doubling of exp adds only about 124 levels: 6,000 at mult 9.35 needs about 1.7e17 exp, a million times today's. At exp 1e13 it needs mult about 13.2 (x1.41). Unowned hacking augmentations (survey): nextSENS x1.20 (438k) and Neuronal Densification x1.15 (188k) at Clarke Incorporated; OmniTek InfoLoad x1.20 (625k); Xanipher x1.20 (NWO, 875k); ENM Core V3 x1.10 (1.75m, Daedalus, joined); QLink x1.75 (Illuminati, $75t, needs combat 1,200, combat is 2-169). Clarke plus OmniTek gives mult about 15.5, and 6,000 then needs about 3e11 exp, about an hour of today's rate (modelled).
**Changed:** `player_activity_config.json` `companyTarget` Bachman (joined) to Clarke Incorporated, Business; `priorityAugs` now nextSENS, Neuronal Densification, OmniTek InfoLoad, Xanipher, ENM Core V3. Pushed and read back from the game. Business Intern at Clarke models 246 rep/s (Formulas, `company_survey.js`), so the company invite should take well under an hour; not yet seen. It had been on Daedalus hacking work for Synfibril Muscle (combat, no hacking value); seen switched to Clarke company work at 22:19 (save). **Next:** once Clarke's faction invites and nextSENS is rep-ready, switch `companyTarget` to OmniTek Incorporated; install when both are bought (backup first), then rebuild to 6,000. New one-shot `hacking_survey.js`.

**At the World Daemon, follow `docs/bn10-cutover-runbook.md`.** The hourly task notifies Ken when hacking reaches 6000. Ken then reviews the BN10 startup steps with a session and hands the cutover over. Live 21:50 Pacific: hacking 3,055 of 6,000.

**Branches waiting for the BN10 cutover (not on `main`, not in the game):** `restructure`, which contains `bn10-prep`, holds the BN10 packages and the core/profiles layout (`docs/architecture-profiles.md`). Verified 21:45 Pacific: the bn15 build matches the live file set byte for byte, except the manifest, two browser-sync scripts and the newly listed `formulas_logic.js`. 465 tests pass in `build/bn15` and 492 in `build/bn10` (bn10 now extends bn15 for the darknet; profile startup lists drive `startup.js`), plus 26 Python tests and 33 `bb_remote.py` selftest checks. Untested against the real game: the map-form sync, `profile.py switch` and `profile.py check`. Cutover steps are in `docs/bn10-plan.md` on that branch and run only after Ken chooses BN10.

**Install 6 ran 21:16 Pacific 2026-11-03: The Red Pill is installed (seen in the post-install save).** The Eternal lab had been solved between 18:58 and 21:15 by the existing automation; this run found The Red Pill queued. Before the install (21:15, save over DevTools): node 15, $609t, hacking 3,189, charisma 6,295, karma -6,538, 42 installed. Backup `saves/bitburnerSave_pre-install6_BN15_2026-11-03.json.gz` (gzip checked, player parsed, Red Pill queued, SHA-256 4c212f767a3a41cca8f437343e0791e2d767be8b91dcefb394a3ae1ab6b40d07). `aug_install.js --install` bought 9 Tetrads/Slum Snakes augmentations and 9 NeuroFlux ($63.5b donated for NeuroFlux rep), home to 1,048,576GB and 7 cores. After it: 52 installed, none queued, $67k, hacking 5, hacking mult 9.35, hacking exp mult 15.17, controller on crime for cash, `ps` shows all startup scripts.
**World Daemon:** `w0r1d_d43m0n` now exists in the save, needs hacking **6,000** and 5 ports; not rooted or backdoored. Nothing automated backdoors it (`worm.js` backdoors only the four faction gateways; XP scripts only weaken; MCP hacks only servers with money). **Next: rebuild to hacking 6,000, then stop and tell Ken. Do not backdoor it; choosing the next BitNode (planned BN10, `docs/bn10-plan.md`) is Ken's call.**
`player_activity_config.json`: `charismaTarget` 0 and `charismaAugs` empty, read back from the game 21:16, because no lab remains and charisma work would slow the hacking rebuild.

**Install 5 ran 18:56 Pacific 2026-11-03: The St4ff of Asclepius installed.** Uber lab (`ub3r_l4byr1nth`, depth 23) solved 18:38:38 by `dnet_lab.js` on `the_void` (depth 22, 152 moves), 1h45m after install 4; the route came from `tools/dnet_map.py` once links reached rows 19-20. Before the install: $189t, hacking 2,402, charisma 4,422, karma -3,956, Staff queued. Backup `saves/bitburnerSave_pre-install5_BN15_2026-11-03.json.gz` (gzip checked, player parsed, SHA-256 ddd3230d10bafa1731e4f4b28b3928b08a317c8c255d85c6c4238451799b2dde). `aug_install.js --install` bought The Black Hand, Neuregen, Magnetism Amplifier and 15 NeuroFlux ($7.9b donated for NeuroFlux rep), home to 524,288GB and 6 cores. After it: $1,262, controller on crime for cash, `ps` shows all startup scripts. `charismaTarget` 3000 (read back from the game).
**Next: Eternal lab, depth 29, charisma 3,000, reward The Red Pill.** Row 24 is the next empty row, so lifting is needed again (floor 21 from rows 17-23). Then the World Daemon: stop before destroying it and tell Ken.

**Live 17:16-17:17 Pacific 2026-11-03 (save over DevTools, `ctl-status`, status files), 80 minutes after install 4:** node 15, hacking 1,738, **charisma 3,085 (already past the Staff lab's 2,500)**, $3.19b, karma -960, 38 installed, none queued. Remote API connected, last full sync 15:06 clean. Now joined 7 factions including Chongqing (was left alone; Sector-12 now excluded). Player on Black Hand hacking work; controller wants Chongqing for Neuregen (34.4k rep short), held by its 10-minute cooldown. Install plan so far: Magnetism Amplifier only ($750m).
MCP rebuilding: run `mw1cf1hs-k7uy`, 1,574 batches, about $172m/s hacking over 1 minute, RAM use 5%, objective override on. `capital_manager.js` is spending income on cloud upgrades (16TB to 32TB), so net cash is about +$9m/s. Contracts idle.
Darknet: scout cracking `rho_construction` at depth 13 (`hacker&net`); lab status `waiting`, no lab linked yet; `dnet_lift.js` refused (`n07_a_5erver`, session). Staff needs depth 23, so the row 16 crossing is the blocker, not charisma.

**Darknet 17:18-18:07 Pacific (status files, logged every 3s):** row 16 is already crossed: riders on lifted hosts reached depth 18-20 (`crack%tech`, `granny-s$blade_industries`), and admin hosts sit at row 17. The lab (row 23) links only from row 22. What stopped chains at 17-19 was cracking: `KingOfTheHill` had no solver and `RateMyPix.Auth` ran out of its 180s at about 50 guesses (needs about 70 at difficulty 19-21).
**Fixed and deployed:** `KingOfTheHill` solver in `dnet_feedback.js` from the game source (Gaussian hills; simulated median 13 guesses, p90 16). **Seen working live 18:05-18:06:** `charlie` cracked `dark_5o1ution5` and the chain hopped to depth 20, then started on `lightdata;oasis` (depth 21, RateMyPix). `RateMyPix.Auth` now gets 290s (under the 5-minute scout stale mark); not yet seen succeeding. Old file copies kept travelling host to host, so the scout now pulls its files from home at start and the rider before each scout; new one-shot `dnet_refresh.js` pushed the kit to 15 live hosts (5,557 stored passwords are stale). `tools/dnet_map.py` now reads the map during focused work; the page shows only rows up to about 2 past the deepest admin host, so no route to the lab yet.

**Install 4 ran about 15:55 Pacific 2026-11-03 (`aug_install_status.json`):** donated $320b to BitRunners, which was enough for every planned item: bought ENM Core V2, BitRunners Neurolink, Neuroreceptor, DataJack, CRTX42-AA, Nanofiber, then 13 NeuroFlux; home 262144GB, cores 3 to 5. After it: 38 installed, none queued, $1,262, hacking 3, charisma 143, karma -923; startup scripts all running (`ps`), controller on crime for cash as in earlier rebuilds. `charismaTarget` now 2500 for the Staff lab (depth 23). The donation formula is now seen working. Next: rebuild, darknet to depth 23 (lifting needs difficulty-21 hosts from row 17), charisma 2,500, solve, install The Staff.
**15:52 Pacific 2026-11-03: Ken approved installs up to readiness to complete BN15 (standing exception in AGENTS.md; still stop before `w0r1d_daemon` or any BitNode choice).** Merciless lab solved: The H4mmer of Daedalus queued. Live: charisma 3,403 (mult 7.27), hacking 1,498, $28.5t, faction rep mult 2.70, 31 installed. Backup `saves/bitburnerSave_pre-install4_BN15_2026-11-03.json.gz` (gzip checked, SHA-256 71df6993172cb8587c3d68fb0fa843b7e96256cde6d4db33c3cd1fc3b42a5af0).
**Rep boosters:** BitRunners favor 161 is past the 150 donation threshold, so `aug_install.js` now donates (up to 25% of cash) to lift each donating faction to its dearest unowned offer, and buys NeuroFlux rep the same way; dry run: $321b to BitRunners, then ENM Core V2, Neurolink, Neuroreceptor, DataJack, CRTX42-AA, Nanofiber. The donation formula (amount / 1e6 x faction rep mult) is from memory of the game source; the real run reads rep back, so a short donation only drops an item. No joined faction sells a rep-mult augmentation (`rep_survey.js`); The Shadow's Simulacrum (x1.15, 37.5k) needs Speakers for the Dead, The Dark Army or The Syndicate. Favor after this install, modelled from `getFactionFavorGain`: NiteSec 131, Tian Di Hui 112, Bachman 145, so none new reaches 150. Invites pending: Sector-12, Chongqing (left alone; they exclude each other).
**Fixed:** the controller worked BitRunners rep for DataJack, which NiteSec already sold; a target rep-ready at any faction is now skipped. **HUD:** the Augmentation section shows queued names, what the install would buy and its cost (`augmentation_readiness.json` `installPlan`), and the controller's rep target; seen live. `maintenance_steward.js` now copies `aug_install_logic.js` and `player_activity_config.json` with the readiness script, since it imports the planner; a steward-written status with `installPlan` was seen.

**14:58 Pacific 2026-11-03: the game crashed (APPCRASH c0000005 in bitburner.exe, Windows event log 14:58:26) the moment a DevTools `Input.dispatchKeyEvent` Enter (keyDown with `"text": "\r"`, keyUp with `"text": null`) was sent to run `run restart_player.js` in the terminal. Cause confirmed 15:10-15:16: the dump (CrBrowserMain, decoded with Electron 41.4.0 breakpad symbols) crashed while deserializing `params.text` in `Input.dispatchKeyEvent`; Edge rejects the same message with -32602. New `tools/game_terminal.py` (Runtime.evaluate only) tested on the disposable web game (ls, help, typed-text refusal, None guard), then live: `run restart_player.js` (controller now PID 2818) and `ps`, game stayed up and refocused.** Install 3 had already run at about 14:42 (31 installed, 14 bought, no NeuroFlux, home 262144GB / 3 cores); Neuroreceptor Management Implant was squeezed out of its plan by price compounding. New `priorityAugs` in `player_activity_config.json` (Neuroreceptor) now leads faction work and is reserved for in `aug_install.js`'s plan; tests pass (455) and the code is on the game.
**Relaunched through Steam 15:06 Pacific; Remote API reconnected on its own.** Save summary over DevTools: 31 installed, $549m, hacking 962, charisma 1,845 (past the 1,500 Merciless gate), karma -878. The relaunch restarted saved scripts from current source, so no `restart_player.js` was needed: `player_activity_status.json` 15:07:54 picks Tian Di Hui, "needs +55541 rep for Neuroreceptor Management Implant (priority)".

**Live 14:34 Pacific 2026-11-03 (save over DevTools, status files): pre-install checklist done, install not run.** node 15, hacking 842, charisma 1,204, $21.9t, karma -858, 16 installed, Boots queued, Bachman faction rep 383.8k (past 375k; the player had moved on to BitRunners for Neurolink, 579k of 875k). `capital_policy.json` reserve now 0 and `charismaTarget` 1500, both read back from the game. Backup `saves/bitburnerSave_pre-install3_BN15_2026-11-03.json.gz` (gzip checked, player data parsed; SHA-256 4091d6e855d9a60efed0aa573c0811ac25fc5543dfd9477c8121eb08aec9850d), so `save_export.py --out` is now seen working. Next: Ken runs `run aug_install.js --install` (optionally `--dry` first).

**Live 15:21 Pacific (game page, status files):** node 15, hacking 783, charisma 1,042, $3.24t, net $345m/s over 1 minute, karma -471, 16 installed, Boots queued. Bachman rep 49.1k at 13.0 rep/s on the page, so 375k about 22:20 Pacific if the rate holds. Stacks and MCP earning; Remote API connected. `player_activity_status.json` lags the page, so read the page for the rep rate.
**Decision: install at 375k, do not wait for 472k.** This replaces "worth deciding then" below. 375k already gives about 139 Bachman favor by the fit below, so about 97k more in a later cycle reaches 150 donations without the 2.2-hour delay now. More charisma augmentations are not needed: Boots, ESI, SmartJaw and ADR-V2 (62.5k rep, same faction) take the level multiplier to about 7, so 1,500 needs about 216k exp, 2,500 about 12m and 3,000 about 90m, all modelled with the fit in the charisma route below, and Hammer and Staff cut those further. Cash will not limit the buy: about $180b modelled for the 8 augmentations rep will allow, at x1.9 each.
Row 16: `dnet_lift.js` now takes only neighbours able to clear the next wall (difficulty 13 from rows 9-15, 21 from rows 17-23), so charges are not spent on hosts that cannot cross. Tests pass (453) and it is on the game; it has not run, because lifting stops once the lab is solved. The game source (v3.0.1) shows stasis links are 1 plus Wings, Hammer and Staff, so 2 now. Merciless and later labs drop only the manual UI; scripts walk them the same way. Offset labs change only the start and end, which the search does not assume.
`tools/save_export.py` reads and validates the save over DevTools; `--out NAME` writes `saves/NAME.json.gz`. The summary and the DevTools read are seen working; `--out` has not been run, so check its output at the first backup.

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
