# 2026-10-24 harvest admission trial evidence

All embedded `ts` fields are Unix milliseconds from Steam scheduler status,
read through the local Remote API. JSON snapshots are raw manager telemetry.
See `../../harvest-efficiency-2026-10-24.md` for interpretation and limitations.

- `results.json`: completed equal-share B and legacy A windows. Match their
  rates to the B/A start and final measure timestamps; the earlier B attempt
  was interrupted by transport and must not be concatenated with the later B.
- `results-weighted.json`: completed weighted C window after inherited
  security preparation drained. New money preparation remains a confounder.
- `results-control-recheck-interrupted.json`: incomplete same-run A2 recheck.
  The raw short window is preserved; no completed 3-minute rate is claimed.
- `results-final-verification.json`: fresh legacy health window after recovery,
  excluding the disconnected wall-clock gap. Not a controlled efficacy test.
- `control-original.json`: original Remote API envelope. Later control files
  and timestamped verification envelopes record the live flag changes.
- `source-verification.json`: exact local/game source SHA-256 comparison.
- `verification-*` and `final-*`: timestamped maintenance/control evidence.

B: efficient admission on, weighted off. A/A2/final: both flags off.
C: both flags on. Existing cohorts were preserved throughout. Never compute
counter deltas across differing `runId` values or across excluded gaps.
