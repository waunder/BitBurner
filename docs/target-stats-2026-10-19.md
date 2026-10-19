# Target-stats operational truth — 2026-10-19

Ken observed that money mode was productive while get_target_stats did not
communicate its activity accurately. Verified with Steam UI, source and direct
Remote API on 2026-10-19, approximately 12:48–12:50 PDT.

## Findings

The five-second panel sampled current action threads while its phase label
came from ten-second manager cohort records. A fast hack could complete between
refreshes, leaving grow/weaken or no live jobs beneath a persistent `harvest`
label. This was not proof that hacks were absent. At a live manager sample,
realized finite-mode income was about $1.91m/s and cumulative run receipts
about $554m despite quiet-looking process snapshots.

RAM totals also included home and unrooted/ineligible hosts. The old 3.40 TB
network total was not MCP's eligible 1.45 TB worker pool. Home itself was only
256 GB; the excess was not all reserved home RAM. Rows/counts were restricted
to manager-listed targets, hiding unlisted live work.

## Change and validation

- Eligible worker pool RAM, action RAM, other workloads and free RAM are now
  explicit; reserved home RAM/use is separate.
- All actual action targets are included even when absent from manager status.
- Live W/G/H is separate from original batch W/G/H. Batch phase and live state
  appear together, so `harvest / no live jobs` has an unambiguous meaning.
- Direct cumulative hacking receipts produce a rolling observed-window income
  rate and payout sum, independent of wallet spending. The window warms up
  after panel restart and measures all hacking income, not per-target profits.
- Header shows manager age/mode; missing status is explicit. Fullness is called
  FULL, not READY. Snapshot limitations are visible. Removed thread-share labels
  that implied income share despite being instantaneous allocation shares.
- Existing page commands use the same union of targets as the panel. Opening
  fits line width/height to the screen; manual size changes remain afterwards.

Seven focused tests pass: paging, eligible RAM and other-work accounting,
unlisted action inclusion, finished batches, duplicate targets, draining phase,
short-job payout retention, rolling expiry and counter/clock reset.

Remote readback of final get_target_stats.js exactly matched local source.
Steam confirmed final panel PID 3622 after `run get_target_stats.js restart`;
prior tail was closed. MCP itself was not restarted or changed. Restored the
user's Active Scripts page and visually checked the panel: columns and headers
fit without wrapping. At approximately 12:50:46 PDT it displayed 1.45 TB worker
RAM, 256 GB reserved home and $19.1m receipts over its first 5 seconds. An earlier
35-second observation showed $57.3m, about $1.6m/s. These are short-window samples,
not a sustained benchmark. Live sigma-cosmetics W/G/H 53/537/0 beside planned
53/537/245 showed exactly why the previous view obscured successful hacking.

No new live scripts or generated output files were introduced. Income history
is in memory only. Live process counts remain five-second samples; the improved
labels and receipt window explain rather than conceal this sampling limit.
