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

- **Date**: started 2026-11-05 19:15 Pacific (hourly task): hour A, share off,
  `share_deploy.js stop` (stopped share.js on 8 hosts). Player on NiteSec hacking
  work (favor push, about 2h left, modelled). Next hourly run: `cloud 8` at the
  start of hour B. Run once, at a quiet hour: no install due, the player
  on one faction's work for the whole two hours, not in a stand-aside run.
- **Context before A** (measured, 13 samples, 18:10 to 19:10 Pacific, share on
  1.46): NiteSec 76.2k rep/h, hacking exp 3.35b/h, MCP average 252m/s.
- **Change**: hour A `home; run share_deploy.js stop` (share off); hour B
  `home; run share_deploy.js cloud 8` (share on, as now). Same faction, same
  work type, focus unchanged. Leave share on afterwards.
- **Metric**: rep/h for that faction (expected about x1.46 with share on, the
  share power); hacking exp/h (expected lower with share on, since share takes
  8 cloud servers from `xp_filler.js`); MCP average unchanged.
- **Baseline window**: hour A, from the first 5-minute sample after `stop`
  (2026-11-05 19:20 to 20:20 Pacific).
- **After window**: hour B, from the first sample after `cloud 8`. Started
  2026-11-05 20:14 Pacific (hourly task, `home; run share_deploy.js cloud 8`),
  so hour B is 2026-11-05 20:20 to 21:15 Pacific. Leave share on after it.
  The 20:15 sample read share power 1.53.
- **Hour A measured** (11 samples, 19:20 to 20:10 Pacific, share 1.00): NiteSec
  56.2k rep/h, hacking exp 7.37b/h, MCP average 277m/s. Against the hour before
  (12 samples, 18:20 to 19:15, share 1.46): NiteSec 77.5k rep/h, so share-on was
  x1.38 rep (share power predicts x1.46). Exp is confounded: it more than doubled
  while the MCP rate rose 211m to 327m/s, so most of that rise is MCP, not the 8 servers.
- **Hour B measured** (11 samples, 20:20 to 21:10 Pacific, share 1.39 average):
  NiteSec 83.1k rep/h, hacking exp 3.19b/h, MCP average 290m/s (rate 246m/s).
- **Result** (hourly task, 2026-11-05 21:15 Pacific): share on gives NiteSec x1.48
  rep/h against hour A (83.1k vs 56.2k), in line with the share power (1.39 to 1.53)
  and with the x1.38 of the hour before A. Hacking exp was 3.19b/h on against 7.37b/h
  off, but the MCP rate also differed (246m against 277 to 327m/s), so the exp cost
  of the 8 servers is at most about 4b/h and probably less. Decision: keep share on;
  rep is the bottleneck for the next installs, and hacking 574 is far from any gate
  except The Covenant's 850. Share stays on (`cloud 8`).

## 2026-11-05

### Share on (`share_deploy.js cloud 8`)

- **Date**: 2026-11-05 about 17:30 Pacific, macro review session.
- **Change**: `share_deploy.js cloud 8`, 8 cloud servers moved from `xp_filler.js` to share.
- **Metric**: faction rep/h up by the share power; hacking exp/h down.
- **Baseline window**: point read only: share power 1.00 before, 1.46 after (`ns.getSharePower()`).
- **After window**: point read only: 14.4 rep/s focused at The Black Hand on the work page.
- **Result**: measured by the share A/B above: x1.38 to x1.48 faction rep/h; kept on.

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
