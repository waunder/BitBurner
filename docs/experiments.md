# Experiments

One entry per gameplay change whose effect we want to know. Rates come from the
metrics series (`core/maintenance/metrics_logger.js`, one sample every 5 minutes
in the game's `metrics_log.txt`), read with `tools/metrics.py`:

    .venv\Scripts\python.exe tools/metrics.py pull
    .venv\Scripts\python.exe tools/metrics.py rates --from 2026-11-06T01:00 --to 2026-11-06T02:00

`rates` prints the window and, by default, the equal-length window just before
it (`--before MIN` changes that; `--before 0` drops it). Times without an
offset are Pacific (UTC-8). A window that crosses an install keeps only the
later cycle. Compare windows on the same activity and faction; note anything
else that changed in between.

Entry format:

- **Date** (Pacific) and who ran it
- **Change**: exactly what was switched, with the command or config key
- **Metric**: what is expected to move, and which way
- **Baseline window**: from/to, or "point read" when no series existed
- **After window**: from/to
- **Result**: measured numbers, sample counts, verdict; "pending" until measured

The series started 2026-11-05 at 17:45 Pacific. Entries before that have point-read
baselines only (two status reads a few minutes apart, or one work-page reading);
treat their "before" numbers as rough.

## Planned

### Share A/B (for the hourly task)

- **Date**: not yet run. Run once, at a quiet hour: no install due, the player
  on one faction's work for the whole two hours, not in a stand-aside run.
- **Change**: hour A `home; run share_deploy.js stop` (share off); hour B
  `home; run share_deploy.js cloud 8` (share on, as now). Same faction, same
  work type, focus unchanged. Leave share on afterwards.
- **Metric**: rep/h for that faction (expected about x1.46 with share on, the
  share power); hacking exp/h (expected lower with share on, since share takes
  8 cloud servers from `xp_filler.js`); MCP average unchanged.
- **Baseline window**: hour A, from the first 5-minute sample after `stop`.
- **After window**: hour B, from the first sample after `cloud 8`.
- **Result**: pending. Fill in with `metrics.py rates --from <B start> --to <B end> --before 60`,
  skipping the first sample after each switch. Decide: keep share on if rep/h
  gain beats the exp loss for the current goal.

## 2026-11-05

### Share on (`share_deploy.js cloud 8`)

- **Date**: 2026-11-05 about 17:30 Pacific, macro review session.
- **Change**: `share_deploy.js cloud 8`, 8 cloud servers moved from `xp_filler.js` to share.
- **Metric**: faction rep/h up by the share power; hacking exp/h down.
- **Baseline window**: point read only: share power 1.00 before, 1.46 after (`ns.getSharePower()`).
- **After window**: point read only: 14.4 rep/s focused at The Black Hand on the work page.
- **Result**: pending, not measured. The share A/B above measures it.

### NiteSec favor push (`favorTarget`)

- **Date**: 2026-11-05 about 17:30 Pacific, macro review session.
- **Change**: bn10 config `favorTarget: NiteSec` in the player controller, after
  `priorityAugs`: work NiteSec until favor plus pending gain reaches 150
  (`getFavorToDonate()`), so installs can donate for rep and NeuroFlux.
- **Metric**: NiteSec rep/h while targeted; time until favor + gain reaches 150
  (favor banks at each install).
- **Baseline window**: point read only: NiteSec favor 113.2 (+1.9 pending), about 250k
  more NiteSec rep needed (modelled).
- **After window**: from the first sample on NiteSec work; then `metrics.py cycles` favor banked per install.
- **Result**: pending.

### Rep target by value per rep

- **Date**: 2026-11-05 about 16:55 Pacific.
- **Change**: `augmentation_readiness.js` tags candidates with the advisor's
  weighted `value`; the controller ranks cash-ready candidates by value per rep
  and skips zero-value ones.
- **Metric**: valued augmentations bought per install; weighted value per hour
  of rep work (not measured directly; read from installs over time).
- **Baseline window**: point read only: player moved from NiteSec (DataJack,
  value 0) to The Black Hand (value 0.165, 192.8k rep gap, about 7.1h modelled).
- **After window**: next install cycles, via `metrics.py cycles` and the install notes.
- **Result**: pending.

### `physicalTarget` 75 plus Tetrads travel

- **Date**: 2026-11-05 about 17:50 Pacific.
- **Change**: bn10 `physicalTarget` 0 to 75 (gym first after every install);
  `faction_join.js` travels to Chongqing for city-gated factions (Tian Di Hui, Tetrads).
- **Metric**: combat skills reach 75 (modelled about 17 gym minutes); Tetrads invite
  and rep/h there; gym time lost from faction work per install (rebuild hours in `metrics.py cycles`).
- **Baseline window**: point read only: combat about 39-42 (agility 39 at 17:52).
- **After window**: from the 17:45 sample on; gym time is visible as `work.type` CLASS.
- **Result**: pending.
