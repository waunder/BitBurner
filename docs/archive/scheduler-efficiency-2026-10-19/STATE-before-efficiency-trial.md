# Current BitBurner Handoff

Last refreshed: 2026-10-19 12:50 PDT. Sources: Steam UI and direct Remote API.
Prior handoff: `docs/archive/target-stats-2026-10-19/STATE-before-target-stats.md`.

## Current objective and outcome

Ken reports productive money mode but misleading target stats. Corrected and
live-verified the panel: worker-only RAM, live versus planned batch threads,
actual unlisted action targets and rolling realized hacking receipts. Seven
focused tests pass. Evidence: `docs/target-stats-2026-10-19.md`.

## Verified live state

- Steam Remote API connected at 127.0.0.1:12526/control 12527. Final source
  readback matched. Existing manifest entry get_target_stats.js was pushed;
  final panel PID 3622, old tail closed, layout visually checked.
- MCP kept running in money mode. Current worker pool 1484 GB across 28 hosts;
  home 256 GB excluded. The former 3.40 TB display included home AND other
  ineligible/unrooted hosts; do not attribute all excess to home.
- Panel demonstrated actual sigma-cosmetics W/G/H 53/537/0 versus planned
  53/537/245 after fast hacks completed. It now retains realized income in
  a rolling observed window: earlier +$57.3m over 35s (~$1.6m/s); final panel
  warmup sample +$19.1m over 5s. Short samples are not sustained benchmarks.
- Steam at ~12:50 showed H649, ~$556m and Algorithms coursework. Ken bought
  remaining programs (including SQLInject/DarkscapeNavigator) and invoked
  dnet through his terminal during this session. Darknet state needs a fresh
  assessment before relying on the earlier zero-manager snapshot.
- Watchdog/steward PID 2693, reviewer PID 2488 from 12:45 activation. Progress
  watchdog monitors severe underutilization without progress and applies
  evidence-based repair with a 15-minute cooldown (commit 7cfa842).
- Prior XP-transition prevention remains live (50cadbe). Player activity
  controller previously failed startup; preserve manually selected work.

## Remaining work and limits

No action required from Ken. GTS income history is in memory and warms up on
restart; live threads remain five-second snapshots. No scheduler change was
made for this display correction. Recheck live state before gameplay actions;
augmentation installs/resets require explicit approval.
