# State

The one durable file for session continuity. Read this first. Format and
purpose are defined in `docs/agent-working-agreement.md`.

## Current objective

Ken revised the stats formatting preference to compact decimal amounts such as `24.8G`; `get_stats.js` now uses K/M/G/T/P with one decimal place, replacing the comma-separated dollar display.

Stats readability September 12: `get_stats.js` available/maximum money now use comma-separated whole dollars without truncating larger figures. Syntax check passed; Steam source delivered and existing phantasy-only panel restarted/verified (`283,052,797 / 600,000,000`). Remote API reconnected. User had independently switched to money mode and Algorithms study; preserved those choices.

Approved 256GB cloud purchase completed September 12: mcp-worker-0 cost $14.08m; MCP restarted as mtysbeyw-7ja7 with reputation retained. Sharing moved to cloud, PID726, 62 threads/254.2GB; power1.169990, no invariant violations. NiteSec UI shows3.365rep/sec at H304 (prior measurement3.297 at H303; level growth contributes to difference). Old share host released for hacking. Evidence `docs/evidence/reputation-objective/cloud-purchased.json`. Next action is observe sustained money/XP opportunity cost before any further sharing investment.

Cloud reputation quote September 12: recommend one 256GB server ($14.08m), then MCP restart to relocate existing share worker. Live Formulas project +1.73% beyond current sharing (~205 extra NiteSec rep/hour); current host has four cores, cloud one. Larger servers have no further reputation benefit under the 256GB cap. Purchase script delivered; no purchase executed. Details and commands: `docs/reputation-objective.md`; quotes: `docs/evidence/reputation-objective/cloud-quote.json`.

Consolidated HUD objective display added and Steam-confirmed September 12: compact MCP row and expanded `Objective: reputation` read the resolved manager status. HUD restarted; syntax check passed.

Measured Steam reputation impact September 12: controlled NiteSec on/off/on rates 3.297/2.868/3.297 rep/sec at H303, +14.96% or ~1,544 rep/hour for 127.1GB sharing. Enabled sharing restored, reputation override preserved. Evidence `docs/evidence/reputation-objective/steam-impact.json`. Next action is sustained money/XP opportunity-cost measurement if deciding whether to allocate more capacity; current short preparation-phase sample cannot establish that cost.

Steam activation authorized explicitly by Ken overriding the historical share restriction, 2026-09-12. Policy enabled, exact release source delivered/readback-verified, reputation override selected and MCP restarted. Remote liveness checks corrected to explicitly name home/worker hosts; regression fixture now enforces host semantics (102 tests pass). Evidence: `docs/evidence/reputation-objective/steam-active.json`. Ken upgraded home RAM during deployment. To deactivate: `run set_objective.js xp` or `money`, or disable `reputation_config.json`. Earlier disabled-policy notes below describe the pre-authorization implementation boundary.

2026-09-12 reputation objective: implemented `set_objective.js reputation`, bounded owned sharing (maximum 256GB), status/HUD/events and fail-closed policy. 102 local tests pass. Disposable browser test confirmed two threads at 8.2GB, power 1.043944 across five samples and clean return to money (zero worker RAM, power 1). Evidence: `docs/evidence/reputation-objective/browser-test.json`; usage and limits: `docs/reputation-objective.md`. R8 money veto is bypassed in XP mode. No Steam upload/restart/activation; automatic source sync remains disabled. Historic share incident root cause remains unknown, so Steam policy stays disabled under AGENTS.md. Next action: resolve that restriction before a bounded Steam pilot and measure actual faction reputation against the money/XP opportunity cost.

Latest review (2026-09-12): scheduler review completed in `docs/scheduler-review-2026-09-12.md`, with R1–R8 table and evidence under `docs/evidence/scheduler-review-2026-09-12/`. Current Steam state is H275, ~$680m, NiteSec work, MCP XP on phantasy, 492GB across 16 hosts. Live-confirmed defect: R8 rejects an XP-qualified foodnstuff switch using money scores. Next recommended work is objective-specific R8 handling, followed by completion-aware worker replacement and launch-order repair; multiple targets should be evaluated after those fixes. No scheduler edits or gameplay changes made. September 11 QLink funding recommendations below are historical. Remote API is reconnected, automatic source sync/pulls disabled.

Latest user-directed assessment (2026-09-11): QLink acquisition advice completed; see `docs/qlink-assessment-2026-09-11.md`. Live Steam API reconnected on 12526 with source sync/pull disabled. Cash $35.479t / $50t; Illuminati rep already sufficient. Recommended one measured 4TB cloud-worker trial ($672.682m), not purchased. No reset, purchase, or automation-policy changes made. Older disconnect blocker below is superseded by this verified connection. Next action is Ken deciding whether to pursue the capacity recommendation; no implementation is requested yet.

Persistent maintenance is active: observe health every 30 seconds, refresh
contract inventory every ten minutes, and sequentially claim only supported,
fingerprint-guarded contracts with at least ten tries. Pause with a durable
reason on an unsupported type or a rejection; recovery remains bounded and
never controls stock, resets, or Darknet expansion.

Post-reset repair: the contract watcher now prefers cloud workers but safely
falls back to rooted ordinary MCP worker hosts when an augmentation reset
removes purchased servers. Contract panels distinguish this reset's earnings
from retained prior-run/lifetime records.

Resume real gameplay-progress work now that the governance deadlock
(retired 2026-08-18, see `AGENTS.md`) is cleared. R8 is enabled and has now
been live-observed using Formulas.exe: it vetoed a below-threshold switch and
later allowed the same candidate once its formula score cleared the 0.8
threshold. The local Remote API daemon is healthy but the game disconnected
after the last pulled telemetry; reconnect before making a new live claim.

## Done

- **Evidence-based cross-skill guidance added, 2026-09-01:** Operations and
  XP HUDs now default to the nearest discovered normal-server Hacking gate
  and name the required level/action. When no such gate remains they do not
  guess at gym, crime, or faction work: a fresh Darknet heartbeat is shown as
  passive Charisma growth, otherwise the panel explicitly reports that no
  alternate requirement has been observed.

- **Focused XP HUD added, 2026-09-01:** `mcp_xp.js` is a quiet 20-second panel
  for player Hacking/Charisma, MCP script XP rate/objective/target, the next
  discovered hacking gate and a direct player action. It starts with startup
  and is refreshed after MCP restarts; its gate walk is cached for ten minutes.

- **Console-output hygiene implemented, 2026-09-01:** MCP no longer prints a
  duplicate full status line every tick; routine Darknet manager retries are
  retained in home-visible heartbeat data instead of remote tails; the legacy
  scorecard now refreshes every 30 seconds. `automation_review.js` is a quiet
  home-side consumer of those durable status records, emitting only changed
  actionable alerts and a bounded review log.

- **Darknet freeze safeguards implemented, 2026-08-31:** analysis isolated
  unbounded 200ms phishing output/workers, stale local manager-cap snapshots,
  and `dnet_root.js` rereading hundreds of credential shards every second.
  The paused suite now defaults to one gateway manager, one phish worker, no
  propagation, no per-attempt phish log, and 60s/15s credential/registry
  maintenance. It still requires Ken's explicit approval for a bounded live
  re-enable experiment.
- **Darknet canary launch race fixed, 2026-08-31:** `restart_mcp.js --darknet`
  previously started `dnet_killswarm.js --restart` and immediately restarted
  MCP, sometimes leaving too little home RAM for the cleanup process's final
  `dnet_root.js` launch. It now waits up to two minutes for cleanup to exit,
  launches the root from the parent, and only then returns MCP.
- **Darknet containment canary live-validated, 2026-08-31:** after
  DarkScapeNavigator.exe was purchased, the diagnostic profile ran through
  its first manager recrawl with a responsive Remote API, a fresh root
  heartbeat, and exactly one manager (`darkweb`). It remains intentionally
  limited to one silent phish worker and no propagation; this validates the
  containment profile, not a return to unrestricted Darknet automation.
- **Darknet controlled expansion staged, 2026-08-31:** the next approved
  profile permits two managers and exactly one root-launched terminal child.
  Both that child and every manager recrawl use `--no-spread`, preventing
  recursive fan-out while allowing a meaningful two-node load check.
- **Darknet root repeated-delegation fix staged, 2026-08-31:** remote
  `ns.ps()` can omit a live DNET manager, which made root relaunch the gateway
  crawler every five seconds. Root now treats the fresh home-side manager
  registry as the durable ownership signal as well.
- **Darknet generation ownership staged, 2026-09-01:** each root launch now
  gives its crawlers/managers a unique ownership generation and folds only
  matching heartbeats into the active registry. This lets a bounded restart
  replace inherited managers cleanly instead of treating their continued
  heartbeats as part of the new two-node profile.

- **Darknet loot log spam removed**, 2026-08-31: normal and no-op
  `dnet_loot.js` runs no longer write a terminal report or routine
  reallocation line. Meaningful results remain in immutable loot shards;
  cache and shipping errors stay visible.
- **Low-impact Darknet HUD added**, 2026-08-31: `dnet_hud.js` reads only the
  root heartbeat and compact manager registry every 15 seconds; it neither
  scans shards nor writes telemetry. It is source-synced but intentionally
  opt-in, and can be run safely while Darknet itself remains paused.
- **Coding-contract reward HUD added**, 2026-09-01: `cct_hud.js` retains the
  verified pre-ledger aggregate (12 accepted contracts; CSEC intentionally
  unconfirmed) and then shows each guarded submission's durable, bounded
  reward history at a quiet 30-second refresh.
- **XP-targeting upgrade implemented and locally verified**, 2026-08-31:
  XP mode now ranks hosts by relative XP per hack-thread second rather than
  money potential, and uses the evidence-backed 95% hack / 5% grow split.
  This path is gated by the existing XP objective, leaving money selection
  and allocation unchanged. `node --check` passed and the full local suite
  passed (190/190); it still needs a live restart and rate observation.
- **R8 switch-veto: implemented and tested**, in an isolated worktree —
  `/private/tmp/bitburner-r8.fyf9mg`, branch `codex/r8-evidence-tail`,
  commit `ff24542`. Adds `evaluateFormulaSwitchVeto` (`mcp_logic.js`) and
  wires it into `mcp.js`'s target-switch decision, gated by
  `R8_SWITCH_VETO_ENABLED` (default `0`). It can only veto a switch the
  existing scheduler already chose to make — never select a target itself —
  and fails open (no veto) on any missing/invalid data. Verified directly:
  `node --check mcp.js`, `node --check mcp_logic.js`, and `node --test
  *.test.js` (148 pass, 0 fail) in that worktree, 2026-08-18.
- **Formulas shadow monitor: live-validated.** `mcp_formulas_shadow.js` ran
  in-game 2026-08-16 (run 5713), confirmed via hash-verified source push,
  retrieved `ready:true` output, and a titled evidence-tail screenshot. See
  `docs/evidence/` (kept — this is real evidence, not retired governance
  paperwork). The live sample showed a real, large gap: the manager's actual
  income was ~422M/s while the formulas-computed minimum-security ceiling
  for its own active target was ~968M/s. The veto patch above is a first,
  conservative step toward that gap, not the thing that closes it — closing
  it further likely means also fixing the `poolNotIdle` allocation issue
  (see Next).
- **Governance apparatus retired**, 2026-08-18: `standing-orders.md`,
  `governance-control-operations.md`, `directive-ledger.json`,
  `promotion-state.json`, the approval/claim/artifact ledgers, the auditor
  tool and its tests, the R8 controller/canary/attestation docs, and the
  unused CI workflow that ran the auditor. Replaced by
  `docs/agent-working-agreement.md` plus this file and the short stop-list
  in `AGENTS.md`.
- **R8 configuration live-validated**, 2026-08-18: the Remote API reconnected
  and synced all 47 watched files; a restart produced run `msz5bovs-bokp`
  with the new R8 source and accepted config. The flag was toggled `0 → 1 →
  0` for a bounded window, with the live status confirming both transitions
  and no invariant violations. No scheduler-qualified switch occurred, so
  this does not live-confirm the veto branch itself.
- **Idle-RAM allocation correction landed**, 2026-08-18: commits `24c9ba0`
  and `f5a17e6` start a desired-but-missing action using only actual free RAM
  while an unrelated in-flight action finishes. The full local suite passed
  (151/151); the synced game restarted as `msz5gi2y-3g38` and showed 99.8%
  RAM utilization with no invariant violations in its initial weaken phase.
- **Augmentations installed and reset completed**, 2026-08-18: installed the
  eight purchased augmentations (including NeuroFlux Governor level 38),
  confirmed the fresh player state, and ran `startup.js`. It started the
  supervisor, crawler, manager, HUD, and stats successfully (5 started,
  none failed). The new manager correctly began with no hackable target
  while `hacking/crawler.js` started rooting the fresh network.
- **R8 switch-veto enabled**, 2026-08-18: Ken explicitly approved enabling
  it. `R8_SWITCH_VETO_ENABLED` is now committed as `1`, pushed, and synced to
  the connected game. It will act only when the scheduler has a qualified
  switch candidate; the fresh post-reset manager has not reached one yet.
- **R8’s pre-Formulas.exe behavior observed**, 2026-08-18: five enabled
  evaluations correctly failed open with `reason:"unavailable-score"` and
  zero scores, allowing the scheduler's switches. After Ken repurchased
  Formulas.exe, `mcp.js` was restarted as `msz75bg7-bz3o` to acquire the
  API; no post-restart qualified switch has occurred yet.
- **R8’s Formulas.exe path live-validated**, 2026-09-07: run
  `mtrh1gm6-ig7p` emitted `available:true` with finite scores. It vetoed
  `phantasy → b-and-a` at a 0.79943 ratio (below the 0.8 threshold), then
  failed open at 0.80511 and ultimately adopted `b-and-a` when its ratio
  reached 1.01298. This confirms both the guarded veto and permissive paths;
  the event stream recorded no new R8-related invariant failure.
- **XP objective enabled**, 2026-08-18: Ken requested the shift; the
  supported `set_objective.js xp` override was accepted live without a
  restart. Status confirmed `OBJECTIVE:"xp"`, `objectiveOverrideActive:true`,
  and roughly 1,377 XP/s during the current weaken phase. The committed
  config remains `money`, so `run set_objective.js clear` returns to it.
- **Adaptive stock trader launched live**, 2026-08-18: Ken explicitly
  approved in-game capital deployment and PID 955 started with `trade=1`.
  The trader begins with a 10% portfolio cap, persists its entry costs and
  adaptive result state, and its script plus logic module now participate in
  normal Remote API source sync.
- **Darknet stability incident: root cause found and fixed**, 2026-08-30
  (Claude Code session). The prior "disabled after a stability incident"
  status (`AGENTS.md` stop-list) had no postmortem behind it — this file's
  own incident record only ever named IPvGO/faction-share. Ken restarted
  darknet with Claude's caution flagged but unconfirmed; it froze Bitburner
  completely shortly after. Confirmed via OS-level `ps`: the renderer
  process pegged at 165-169% CPU, Remote API connection dropped at the same
  instant. Root cause: `dnet_crawl.js` spreads to every reachable neighbor
  with no cap, and every host it lands on gets a permanent resident
  `dnet_manager.js` polling at minimum every 1s forever — unbounded
  steady-state load on the single-threaded renderer. Fixed same day:
  `MAX_ACTIVE_MANAGERS` cap (15) enforced in `dnet_crawl.js` before it
  spawns a manager, backed by a shard-and-merge registry
  (`dnet_manager_registry.json`) following the existing credential/loot/
  deployer shard pattern in `dnet_lib.js` exactly. 11 new `node --test`
  cases, 177/177 full suite clean. **Not yet live-confirmed** — the actual
  restart that proves the cap holds hasn't happened yet.
- **Darknet cap: first live restart overshot it, tightened same day.** Ken
  restarted under the new cap; registry showed 30 entries against a cap of
  15 (48 known hosts) before he killed it — no sluggishness reported at that
  peak, unlike the original freeze. Root cause: a real race between
  propagation speed and the registry's merge cadence, not a logic bug —
  Bitburner's NS API has no cross-host locking primitive to close it fully.
  Mitigated: merge cadence 5s→1s, cap 15→8, documented as a *soft* cap in
  `dnet_lib.js` rather than overclaiming precision. Also fixed a second bug
  the same pass: `dnet_crawl.js`'s duplicated `MAX_ACTIVE_MANAGERS` had
  already drifted stale; added tests that import both files' exported
  copies and assert they match. 181/181 full suite. Still not live-verified
  under the tightened values.
- **Darknet cap: tightened values froze the game again, faster — the real
  fix was propagation throttling, not resident-count capping.** Second live
  restart overshot worse (36 entries vs. cap 8, several sharing the exact
  same millisecond timestamp) and froze faster than the first attempt.
  Diagnosis: the network is now mostly pre-cracked from earlier runs, so
  re-authentication is near-instant, letting propagation outrace any
  registry-based coordination regardless of cap tightness or merge speed —
  a rate problem, not a ceiling problem. Entered plan mode a third time
  given two prior live misses. Shipped `MAX_SPREAD_PER_PASS` (2,
  `dnet_crawl.js` hard-stops its spread loop, including authentication, at
  2 successful spreads per pass) and `jitteredRecrawlMs` (±15%,
  `dnet_manager.js`, desyncs recrawl clocks so managers spawned together
  don't stay permanently synchronized). 187/187 full suite. Explicitly
  documented that node tests can't prove live safety here — two prior
  live misses despite clean logic. Still not live-verified a third time.
- **Darknet: two more live freezes, root cause still not found — darknet
  paused, not another retune.** Third restart under the propagation
  throttle grew gradually (no burst, throttle worked as designed) yet
  froze anyway at a lower resident count than either prior attempt. A
  cleanly isolated fourth restart (darknet alone — mcp.js/scorecard/HUD/
  supervisor all confirmed off, hacknet/factions passive-only) froze
  within ~90 seconds with only 6 real, cleanly-propagated resident
  managers, well under the cap of 8. Rules out aggregate load, propagation
  burst speed, and resident count as the primary driver — a minimal,
  well-behaved deployment with nothing else running still failed fast.
  Also found and fixed procedurally (not a code bug): Ken's terminal alias
  chaining `run dnet_killswarm.js;run dnet_root.js` let the kill scan
  (which targets `dnet_root.js` and covers `home`) race and kill the
  process the same line just launched — always run as two separate
  commands. **Four live freezes total this session. Darknet stays off**
  pending actual investigation of what `ns.dnet.probe()`/
  `getServerDetails()`/`authenticate()` cost against this save's darknet
  graph — not fixable by further Netscript-level throttling alone. Full
  arc: `docs/darknet-strategy.md`'s 2026-08-30 status banner.

## Next

1. Measure actual faction-reputation gain against the money/XP opportunity cost of the active share allocation. Worker replacement repairs remain queued separately.

## Blockers

No activation blocker: Ken explicitly overrode the sharing restriction. Steam worker PID 657 remained stable over 30 seconds, 31 threads/127.1GB on avmnite-02h, share power 1.149527, no reported invariant violations. Historical incident cause and actual faction-reputation ROI remain unmeasured.

## Changelog

- **2026-08-18** — Governance apparatus retired (see Done). Confirmed via
  direct inspection (not just the plan doc) that the R8 veto patch actually
  compiles and its tests actually pass.
- **2026-08-18** — Landed R8 switch-veto as `07b216a`; `node --check` for
  both touched scripts and `node --test *.test.js` passed (148/148). Replaced
  a stalled Remote API daemon; the fresh daemon is awaiting a game connection.
- **2026-08-18** — Bitburner reconnected. R8 source/config were synced and
  the manager restarted; the bounded `0 → 1 → 0` configuration check was
  accepted live with no invariant failure. No qualified target switch arose.
- **2026-08-18** — Assessed both open worktrees: `pool-invariant` only muted
  the alarm, so it was not landed; `core-missing-action-redeploy` repaired
  the allocation behavior and was landed, tested, pushed, synced, and
  restarted live (initial utilization 99.8%, no invariant violation).
- **2026-08-18** — Ken explicitly approved augmentation installation. Eight
  purchased augmentations installed; the reset was confirmed at $1.001m and
  hacking level 2, and `startup.js` launched all five baseline scripts.
- **2026-08-18** — Ken explicitly approved R8 activation. The flag changed
  from 0 to 1, was committed, pushed, and confirmed in the Remote API sync.
- **2026-08-18** — Formulas.exe repurchased after augmentation reset. Five
  prior R8 checks had correctly failed open; restarted mcp.js so the new
  runtime can expose the Formulas API.
- **2026-08-18** — Switched objective to XP using the in-game override;
  config-change event confirmed money → xp without restart.
- **2026-08-18** — Ken explicitly approved live stock-capital deployment.
  The trader's portfolio-wide adaptive cap, correct entry-cost accounting,
  persisted state, and loss exit passed 155 local tests before its first
  approved live launch.
- **2026-08-18** — Synced and launched the approved stock trader as PID 955
  with `trade=1`; added its implementation and imported logic module to the
  Remote API watched files to make future reconnects durable.
- **2026-08-16** — Incident: a Ken-supplied process list showed
  `mcp_stock_trader.js` running with `trade=1` before a restart — the
  standing read-only-stock-trading rule was crossed operationally at least
  once. No confirmed order execution. The file remains present (untracked)
  as evidence; running or syncing it stays off-limits without Ken's
  explicit capital-deployment go-ahead (see `AGENTS.md`'s stop-list).
- **Earlier** — IPvGO and faction-share (`share_deploy.js`) both had
  stability incidents (game unresponsiveness); both stay off pending a
  root-cause understanding, per the stop-list.
- **2026-08-30** — Darknet restarted per Ken's request, froze Bitburner
  completely within the session (renderer pegged at 165-169% CPU per `ps`,
  Remote API connection dropped simultaneously). Diagnosed the mechanism
  (unbounded resident `dnet_manager.js` accumulation — see Done) and shipped
  a `MAX_ACTIVE_MANAGERS` cap the same day. Ken force-recovered via
  Bitburner's "reload and kill all scripts"; `startup.js` relaunched cleanly
  afterward. Fix not yet live-tested.
