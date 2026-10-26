# MCP XP yield check — 2026-10-25

## Question

While the live objective was XP, foodnstuff was nearly drained under the
configured 95/5 hack/grow split. Since a hack against exactly zero money earns
only one quarter of normal XP, test whether allocating more RAM to grow can
maintain a productive balance without lowering total XP throughput.

## Source and method

Steam Remote API status was connected throughout. The objective override was
`xp`; manager run `mvnn8tkf-wauz`, script version `1ep5kgh`, 1,100 GB eligible
worker RAM. MCP hot-reloads `mcp_config.json`. The trials changed only
`XP_WEIGHT_HACK` / `XP_WEIGHT_GROW`; target selection, worker pool, player
activity and other settings were not intentionally changed. Status samples
were read locally from the Remote API telemetry every three seconds. All
timestamps below are UTC from `mcp_status.json`.

## Observations

| Split | Window / samples | XP/s | Foodnstuff money | Interpretation |
|---|---:|---:|---:|---|
| 95/5 | Single pre-trial snapshot at 17:19:34 | 464 | 2.7% | Too short for a baseline window; manager was in weaken. |
| 80/20 | 17:19:54–17:20:34, 14 samples | median 307, mean 318 | 3.8% → 1.4%; window median 2.6% | Did not arrest depletion; phase mix was variable. Rejected. |
| 50/50 | 17:20:54–17:21:34, 15 samples | median 464, mean 411 | 2.0% → 3.8% | 12 weaken and 3 work samples. |
| 50/50 | 17:21:44–17:23:24, 33 samples | median 426, mean 381 | 1.7% → 2.9% | 30 weaken and 3 work samples. |
| 50/50 | 17:23:44–17:25:34, 36 samples | median 460, mean 401 | 3.8% → 8.2% | 33 weaken and 3 work samples; subsequent fresh sample at 17:25:44 showed 9.6%. |

At the final fresh sample (17:25:44 UTC), status showed XP objective, continuous
worker mode, foodnstuff, 395 XP/s, 9.6% money, 4.296 security, 98.5% RAM use,
no worker launch failures, and `tickWithinBounds: 14` in invariant counts.

## Decision and limits

Keep the 50/50 split as the live monitored candidate. Compared with the tested
80/20 split, it produced a higher phase-inclusive median and allowed target
money to recover over the final window. This is suggestive, not a causal or
optimality claim: the 95/5 baseline was only one sample, sample windows were
not phase-matched, the extended 50/50 windows contained few work ticks, player
skills changed during observation, and the target's balance/security state
continued evolving. Revisit after collecting longer phase-balanced telemetry
or measuring action-specific XP rates. The setting is reversible in
`mcp_config.json`; it does not require restarting MCP.

## Follow-up A/B/A check — 2026-10-25

Later the same day, with live objective override still `xp`, run ID
`mvo5rnwk-5jnw`, target `foodnstuff`, and split settings hot-reloaded without a
restart, two-minute windows were sampled for 50/50 (A1), 60/40 (B), and 50/50
(A2). Telemetry samples arrived every three seconds; phase mix remained
unbalanced, so XP comparisons are descriptive rather than causal.

| Split/window (UTC) | Samples | XP/s median (mean) | Money pct median | Security median |
|---|---:|---:|---:|---:|
| 50/50, 19:14:32–19:16:32 (A1) | 40 | 425 (358) | 0.622 | 5.07 |
| 60/40, 19:16:52–19:18:52 (B) | 40 | 433 (377) | 0.509 | 5.16 |
| 50/50, 19:19:22–19:21:12 (A2) | 39 | 401 (354) | 0.767 | 4.60 |

Across the full windows, 60/40's median XP was only 2% above A1 and 8% above
A2, while its median target money was lower than either 50/50 window. The
within-window plan mixes differed, and the control's XP changed materially as
the target state evolved. Retain 50/50 as the conservative live setting; this
trial does not establish an XP advantage for 60/40. At the last direct Steam
HUD read, MCP showed about 470 XP/s, with foodnstuff selected; these UI figures
are point-in-time and are not a like-for-like window statistic.
