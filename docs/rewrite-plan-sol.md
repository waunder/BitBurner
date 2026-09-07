# BitBurner rewrite execution plan

**Status:** planning artifact only; no rewrite implementation is authorized by this document.  
**Prepared:** 2026-09-07.  
**Target reader:** a sequence of Terra-level agents, with parallel work only where the packages below declare it safe.  
**Protected environment:** Ken's Steam save. The browser save is the disposable game-integration environment.

## 1. Outcome and limits

The rewrite should replace the current collection of coupled managers, status files, one-off controls, and deployment paths with a smaller foundation that can answer, from its own evidence:

1. What has been observed, and how fresh is it?
2. What is the resolved desired state, including overrides and expiry?
3. What action is proposed, and which inputs caused that decision?
4. Why is the action allowed under the current authority policy?
5. Which source release was prepared, delivered, and actually started by every long-running process?
6. What happened, did it conform, and did it pay off?
7. How can the current action or release be stopped or rolled back?

This is not a line-for-line rewrite of `mcp.js`, not an HWGW-batcher project, not a multi-target mandate, and not a new governance system. The current repository remains the behavioral record and supplies proven algorithms, incidents, and regression cases. The new system earns authority incrementally; the old system is retired component by component only after equivalence or an explicitly approved behavior change is demonstrated.

The plan follows `AGENTS.md` and `docs/agent-working-agreement.md`. In particular:

- There are only two real parties: agent and human. A bounded fresh-agent critique can be useful evidence, but no permanent reviewer, controller persona, promotion ledger, or unsatisfiable sign-off role may be recreated.
- `STATE.md` remains the one session-continuity file. It records one objective, completed work, one concrete next action, and real blockers. It is not expanded into a queue or state machine.
- Tested, reversible, flag-gated work and browser trials are ordinary work. Human approval is reserved for the actual stop-list and genuine external/requirements blockers.
- Technical and operator-facing documentation change with the behavior, in the same commit.

## 2. Evidence baseline and corrections to the direction

The first implementation agent must not start from the prose direction alone. The following evidence was directly checked for this plan and is the minimum baseline to preserve or disprove.

### 2.1 Current evidence

- The local JavaScript suite passes: 235 tests, 47 suites, 0 failures on 2026-09-07 via `node --test *.test.js`. Most of this is pure-logic coverage; it is not evidence of Bitburner process, file, UI, or save behavior.
- The Remote API in-process mock/self-test passes its request correlation, errors, concurrent requests, push/pull, incremental sync, reconnect-hook behavior, and moved-repository alarms. This proves the local Python implementation against its own mock, not compatibility with every current game lifecycle.
- `tools/bb_remote.py` implements the external WebSocket server. The game dials out as the WebSocket client, and JSON-RPC requests are sent from the external server to the game. The local daemon also exposes a loopback control socket.
- Source push and generated-file pull are different authority directions. `sync_manifest.json` drives source push. `PULL_FILES` drives game-generated state back to disk. `mcp_objective_override.txt` is intentionally runtime-owned and pulled, not source-pushed.
- The existing source manifest is a file list, not a content-addressed release. Routine Steam sync writes live filenames individually, and most files are not read back and hashed after delivery. The browser sync fetches the mutable `main` branch and can continue boot after a partial or failed fetch. Neither path currently proves an atomic, complete release.
- Current MCP identity is only a hash of `mcp.js`, not a manifest identity for the whole running suite. Most other long-running scripts do not report a common release/generation.
- Current logging is fragmented. `mcp_events.txt` has useful predicate inputs, but local daemon logs and the many subsystem status/history files do not use the same event contract. Current files observed during planning include an approximately 470 KB MCP event file and an 8.4 MB status log, so bounded in-game retention plus acknowledged export must be designed rather than assuming “append forever” is safe.
- Current controls are fragmented across committed config, runtime override files, script arguments, restart flags, one-shot scripts, and subsystem-specific configs. `set_objective.js` demonstrates a useful runtime-owned override pattern, but it has no general typed command envelope, setter identity, expiry, revision precondition, or unified audit event.
- `maintenance_steward.js` already has a useful bounded recovery shape: sustained-stale detection and a 15-minute cooldown. It does not yet carry the required common authority decision, idempotency record, or unified result event.
- `purchase_worker_server.js` purchases immediately if its local input checks pass. It does not create an investment proposal, show marginal return/payback/opportunity cost, or require a separately visible purchase-authority policy.
- IPvGO measures games, wins, streak/favor, and move time. It does not yet demonstrate marginal faction progression against a baseline or account for its RAM/renderer-time opportunity cost. Activity is not ROI.

### 2.2 Corrections and contradictions that must become fixtures

These are not documentation cleanup footnotes; they are proof that the discovery phase is required.

1. **R8 is no longer “never observed firing.”** Current `mcp_events.txt` records live `r8_switch_veto_eval` and `r8_switch_veto` events on 2026-09-07 for run `mtrh1gm6-ig7p`, version `62f735`. The review must replace the stale claim in `STATE.md`/strategy history with generation-specific evidence.
2. **The same trace exposes a scheduler handoff question.** A productive-target comparison named `b-and-a` as the raw-score outbid candidate; after R8 later allowed the outbid, the target was dropped and `phantasy` was immediately adopted again. This may follow from comparing raw potential before the drop and effective score after it, but it creates an observable no-op drop/re-adopt cycle. Preserve this trace as a replay fixture and require the R4/R8 review to explain or correct it.
3. **R7 is not one current requirement.** Historical R7 added `home` to the worker pool. Current `mcp.js` explicitly excludes `home` to reserve it as the control plane. The grow-security clamp and `SECURITY_CAP=1` remain. Review the R7 subitems separately; do not restore home allocation because an old status paragraph says R7 is “done.”
4. **R4 has evolved beyond the maintained strategy prose.** `FORMULA_RANKING_ENABLED` exists, is set to `1` in current config, and the primary target-ranking path attempts floor-corrected Formulas scoring before falling back. Historical R4 evidence proves the balance/scoring change produced a large gain, not that this newer ranking path is fully live-validated.
5. **R6 state is ambiguous across generations.** The strategy says the revised XP path lacks a mode-specific live run. `STATE.md` records an XP override from an earlier run, while the current pulled status reports an active override resolving to money. Only a fresh current-generation XP trial can close R6.
6. **Browser Remote API feasibility must be re-tested.** Browser docs say Chrome PNA makes localhost Remote API impossible and therefore use GitHub `wget`. The current Python server adds `Access-Control-Allow-Private-Network: true` and says that header was live-confirmed to fix the browser connection on 2026-09-03. Keep the GitHub path until a bounded test resolves this contradiction; do not assume either statement is current truth.
7. **`remote_api_keepalive.js` has an unproven observation channel.** It reads `/tools/bb_remote_events.log` from the game, while the daemon writes that log locally and the manifest does not deploy it as a live file. The Remote API study must prove how, if at all, this script can see fresh daemon state.
8. **Documentation is not uniformly current.** `docs/processes.md` itself contains dated status claims contradicted by later sections and live files. Every claim used for migration must carry source location, evidence date, environment, and release/run identity.

## 3. Required architecture invariants

These are contract requirements to write down and test before implementation design is accepted.

### 3.1 Separation of concerns

- Collectors observe and timestamp facts. They neither select goals nor execute actions.
- Policy consumes an immutable observed-state snapshot and returns an explainable proposal.
- The safety gate resolves authority, budgets, cooldowns, idempotency, preconditions, and stop rules.
- The reconciler makes one approved desired state converge idempotently. It owns effects; policy does not.
- Game agents are narrow executors with explicit ownership and generation. They do not independently broaden their task.
- Projections render the authoritative event/state models. They do not invent parallel facts or separately authored prose logs.

### 3.2 Release and generation identity

One immutable release manifest must contain every loadable file, its canonical game path, its content digest, manifest/schema version, and release digest. “Source,” “delivered,” and “running” are distinct states:

- **Source identity:** digest of the prepared immutable manifest and contents.
- **Delivered identity:** every target-game file read back and matching the manifest; partial delivery is never activatable.
- **Running identity:** every long-running process reports the release digest and its launch generation.

The control surface shows all three. Any mismatch is `version_drift`, not “probably synced.” Delivery and activation are two phases. The active-release marker is written only after complete verification. Reconciliation retires only processes owned by the superseded component/generation and starts the intended generation; it never makes every script kill peers indiscriminately.

The last known good release and desired-state revision stay available. Rollback is activation of that immutable release followed by the same scoped reconciliation path, not source editing under pressure.

### 3.3 Event system of record

Every local- and game-originated message enters one versioned event envelope containing at least:

- event time and observed/received time;
- source component and environment;
- release and generation;
- severity and event kind;
- event ID plus correlation/action/idempotency ID where applicable;
- stable human message derived from fields;
- relevant decision inputs, thresholds, authority result, and outcome;
- schema version.

Decision events include every predicate input. State snapshots link to the event range that produced them. Unknown write/log failures must themselves become visible invariant events.

The durable local stream is authoritative after acknowledged export. The game keeps a bounded outbox/ring sufficient to survive disconnects and restarts; records are removed only after the local side acknowledges a contiguous sequence. Define gap, duplicate, reorder, reconnect, clock-skew, and corrupt-line behavior. “Preserve every occurrence” means no loss across the acknowledged stream, not infinite save-file growth.

All views use one canonical renderer. The in-game tail displays meaningful console events and coalesces only deliberately equivalent repetitions by kind, level, normalized message, and relevant context. It shows count plus first/last time and periodic summaries. Changed inputs, warnings, errors, decisions, and outcomes are never swallowed. The full occurrence stream remains durable.

### 3.4 Observed and desired state

Observed state is versioned, timestamped per collector, and explicit about unavailable/stale/unsupported values. A combined snapshot must not hide that its inputs were sampled at different times.

Desired state is runtime data, never part of source sync. It has a monotonic revision, typed values, validation result, setter/source, set time, optional expiry, reason, and authority mode. Overrides are first-class records with precedence shown. Every mutation uses an expected revision or idempotency key and emits accepted/rejected events. Reconnecting or deploying source cannot silently overwrite desired state.

The same command semantics are usable from the local controller and in-game terminal. A raw file push is a transport primitive, not an operator command.

### 3.5 Authority and bounded stewardship

Authority modes are `observe`, `propose`, and narrowly named `act` capabilities. There is no global “automation on” bit. Every action records the policy capability that allowed it.

The stewardship loop may collect, check freshness/invariants, propose, and reconcile explicitly authorized state. It cannot invent objectives, widen authority, reset progress, spend capital, or re-enable a restricted subsystem. Recovery requires a reason, precondition, cooldown, idempotency key, bounded attempt count, verification, and result event.

## 4. Authority, environment, and rollback matrix

| Capability | Browser sandbox | Steam save | Initial mode | Promotion evidence | Rollback/stop |
| --- | --- | --- | --- | --- | --- |
| Read files/state/processes | Allowed | Allowed | Observe | Freshness and schema checks | Stop collector; no game mutation |
| Deliver an inactive release | Allowed | Only after delivery tests; use non-active paths/marker | Observe | Complete digest/readback report | Discard staged release; active marker unchanged |
| Start read-only collectors/projections | Allowed | Allowed after browser pass | Observe | Browser restart/reconnect evidence and RAM budget | Stop only owned generation; return to legacy views |
| Change runtime desired state | Allowed for non-stop-list values | Allowed after typed-command/browser tests | Propose first | Accepted/rejected/replay/idempotency evidence | Restore previous desired-state revision or let override expire |
| Restart an owned controller | Failure-inject freely within the test save | Reversible ordinary work after browser proof | Named act capability | Cooldown, generation ownership, successful health check | Reactivate last-known-good release/generation |
| Change worker allocation/target | Allowed after shadow comparison | One bounded capability at a time after Steam shadow | Shadow/propose | Explained deltas, invariants, ROI, browser game run | Disable capability; legacy controller resumes from preserved state |
| Purchase cloud capacity | Proposal may be evaluated; purchase only under visible policy | Propose-only initially | Propose | Cost/capacity/marginal gain/payback plus post-purchase measurement design | Deny/expire proposal; purchased capacity is not treated as reversible |
| Trade with stock capital | No action without Ken's explicit approval | No action without Ken's explicit approval | Observe/propose only | Ken's explicit approval plus bounded policy | Disable trader; record positions and exit policy; do not assume liquidation authority |
| Re-enable faction-share automation | No action without Ken's explicit approval | No action without Ken's explicit approval | Observe/propose only | Root-cause explanation, cooldown/tests/browser canary, Ken approval | Stop owned share workers; verify RAM reclaimed |
| Augmentation install/reset/permanent forfeiture | No action without Ken's explicit approval | No action without Ken's explicit approval | Observe/propose only | Ken's explicit approval and recovery runbook | No technical rollback; stop before action if evidence incomplete |
| Darknet automation | Browser trial allowed; preserve bounded profile | New rewrite path begins observe/propose despite legacy clearance | Observe | Cost/health/ROI, failure-injection, generation ownership | Stop owned generation; fall back to current known-good profile |

The browser save is disposable but the stop-list still applies. “Disposable” authorizes safe game integration and failure injection; it does not silently authorize resets, capital use, or restricted re-enablement.

## 5. Documentation and test coordination — mandatory before code

### 5.1 Documentation set

Wave A produces these reviewed artifacts before any rewrite implementation package begins:

| Artifact | Purpose and required content | Maintainer hat | Update trigger |
| --- | --- | --- | --- |
| `docs/rewrite/system-contract.md` | Component boundaries, invariants, state transitions, unavailable behavior, success test | Architecture package agent | Any component boundary or invariant change |
| `docs/rewrite/operator-guide.md` | Plain-language controls, modes, what is running/why, expiry, stop and rollback | Control-surface package agent | Any operator-visible behavior or command change |
| `docs/rewrite/event-contract.md` | Event fields, kinds, correlation, canonical rendering, coalescing, retention/ack/gap rules | Event package agent | Any event or retention behavior change |
| `docs/rewrite/state-command-contract.md` | Observed-state freshness, desired-state revisions, override precedence, typed commands, rejection semantics | State/control package agent | Schema/control behavior change |
| `docs/rewrite/release-contract.md` | Manifest/digest algorithm, two-phase delivery, active marker, generations, drift and rollback | Release package agent | Deployment/lifecycle change |
| `docs/rewrite/remote-api-study.md` | Both protocol sides, actual request/response shapes, connection ownership, reconnect/resync, limits, failure behavior, browser/Steam transport decision | Remote API research agent | Protocol/library/game-version change or transport incident |
| `docs/rewrite/r1-r8-assessment.md` | The single completed review described in §7 | Scheduler review agent | Evidence changes or queued scheduler work lands |
| `docs/rewrite/authority-roi-contract.md` | Capability matrix, budgets/cooldowns, proposal format, ROI cards, stop rules | Safety/ROI agent | Authority or investment policy change |
| `docs/rewrite/test-plan.md` | Requirement-to-test mapping, fixtures, layers, evidence locations, gates and failure injection | Verification agent before implementation | Contract or test-layer change |
| `docs/rewrite/migration-runbook.md` | Browser setup, Steam boundary, activation, rollback, old-component retirement, emergency recovery | Integration agent | Lifecycle/recovery behavior change |

These are living documents, not a new approval ledger. Their relevant sections change in the same commit as code. `docs/processes.md` remains the concrete script/file/failure-mode map and must be updated when scripts, arguments, files, or failure behavior change. `STATE.md` records only the current package and next action. Human-only steps go immediately into `docs/kensTodo.md` and are checked off only after confirmation.

### 5.2 Contract-to-test rule

Before code, `docs/rewrite/test-plan.md` must map every MUST-level behavior in the contracts to:

- test layer;
- fixture/input;
- expected observable result;
- evidence artifact and naming convention;
- gate that consumes it;
- reason if the behavior cannot be automated.

A test copied from implementation does not satisfy this rule. The verification agent designs boundary and failure cases from the contracts and legacy incidents first. Implementation agents may add cases, but may not weaken expected behavior to fit code without changing the authoritative contract and recording why.

### 5.3 Test layers and evidence gates

| Layer | Proves | Required fixtures/evidence | Does not prove |
| --- | --- | --- | --- |
| T0: document/schema examples | Contracts are internally consistent; examples validate against schemas | Valid/invalid event, state, command, release and ROI examples | Runtime behavior |
| T1: pure unit/property | Deterministic policy, math, validation, reducers, coalescing, ownership and idempotency rules | Generated edge cases plus R1–R8 regressions | Netscript APIs or lifecycle |
| T2: replay/golden traces | Decisions and projections remain explainable across real sequences | Sanitized current telemetry and incident traces, including restart loss, tick delays, stale state, config corruption, R8/no-op readopt | Real game timing/process/file behavior |
| T3: component/protocol | Local controller, event spool, release delivery, reconnect and command handling work together | Spec-accurate mock plus adversarial server/client, partial files, oversized messages, duplicate/out-of-order replies, disconnect mid-release | Current Bitburner implementation |
| T4: browser live | Actual Netscript API, file rules, import/load, process ownership, tail behavior, restart/recovery, throttling and failure injection | Timestamped browser run, release IDs, exported events, screenshots only where UI matters | Steam transport/save equivalence |
| T5: Steam shadow | Read-only new path agrees or explains differences on Ken's actual save | Matched-time legacy/new snapshots, proposal diffs, release/delivery/running IDs | Safety of mutations not exercised |
| T6: Steam bounded act | One named capability behaves and rolls back under real conditions | Pre-state, authority decision, action, result, conformance, ROI and rollback evidence | Any capability not explicitly exercised |

Claims use the working agreement's vocabulary: implemented, locally tested, integration-tested, live-confirmed, assumed. Every evidence report states environment, release, generation/run, time window, inputs, expected result, actual result, and proof limit.

### 5.4 Required fixture catalog

Wave A must capture or construct at least:

- healthy money-mode harvest and weaken/work transitions;
- current `poolNotIdle` violation;
- slow/throttled ticks and stale status;
- corrupt/partial config while the prior valid value remains active;
- source edit without process restart;
- event-write failure and invalid Bitburner filename extension;
- orphaned tail after killed process;
- Remote API connect, disconnect, reconnect, second-client refusal, request timeout/error, oversized response, moved repo, missing file, partial resync, concurrent push/pull, and daemon restart;
- browser GitHub sync success, manifest fetch failure, one-file failure, and mutable-branch drift;
- R8 unavailable-score fail-open, veto, threshold pass, and the current raw-outbid/no-op-readopt sequence;
- XP target selection and zero-money quarter-XP behavior;
- home control-plane starvation risk and current home-excluded behavior;
- maintenance stale/recovery cooldown and duplicate recovery request;
- cloud purchase proposal at insufficient funds, cap reached, attractive payback, and unattractive payback;
- IPvGO baseline/on/off windows with RAM, renderer time, faction progress, and competing MCP output.

Generated telemetry can seed fixtures only after sensitive/save-specific data is minimized and the relevant lines are copied into bounded, committed test fixtures with provenance. Tests must never depend on today's mutable gitignored files.

## 6. Remote API study requirements

The Remote API is a component under study, not an assumed transport. Package A2 below must read and test both the local implementation and the current Bitburner side (official source or bundled source plus actual game behavior).

The study must resolve:

1. Exact supported methods, parameter/result/error shapes, message-size behavior, concurrent request rules, and connection close behavior.
2. Single-client ownership and what the game does when another endpoint connects.
3. Whether reconnect is automatic in current Steam and browser builds, and how configured delay behaves.
4. Ordering and exclusion between the connect hook, full push, full pull, and incremental loops; whether a lock/queue is required.
5. What `pushFile` success guarantees and whether readback can differ.
6. Atomicity limits: files are written one at a time, imports resolve at process start, and running scripts do not hot-reload.
7. Safe release staging and activation despite those limits.
8. Local pull-write atomicity and behavior if the daemon dies mid-write.
9. Browser PNA status with the current response header. If still blocked, document the observed handshake. If fixed, compare reliability with GitHub sync before changing the browser default.
10. Steam-specific transport validation that can be done without activating code: stage an inert release namespace, read it back, disconnect/reconnect, and verify no active process changed.
11. The source/pull allow-lists, path normalization, unexpected files visible via `getFileNames`, and protections against pushing runtime-owned state.
12. Authentication/trust assumptions for the loopback control port and public browser source. No credential mechanism should be invented unless a concrete threat/failure warrants it.
13. Whether the in-game keepalive can actually observe daemon state; replace the current impossible/unclear file path with a proven heartbeat channel or remove it.

The study ends with a decision: preserve, wrap, or replace each part. It must not begin by rewriting the daemon.

## 7. R1–R8 assessment sequence

One agent owns one assessment artifact and reviews R1 through R8 in numeric order so terminology and evidence standards stay consistent. Research within a step may be delegated, but the final artifact is one coherent review. No scheduler rewrite item enters the implementation queue until all eight rows are complete.

Each row must record: plain-language purpose; current code location; exact inputs; current enablement and effective runtime value; local tests; browser/Steam live evidence with release/run and date; known limitations; measured benefit and confidence; dependencies; rollback; and one disposition (`preserve`, `simplify`, `replace`, `measure`, or `retire`).

### R1 — balance-point work sizing

- Inspect `computeWorkWeights`, `buildPlan`, security-maintenance math, readiness ramp, and per-host rounding.
- Preserve the source-derived grow/hack balance model unless replay or current game source disproves it.
- Separate R1's effect from R4 target choice in benefit claims; historical ~60x evidence is the combined chain, not R1 alone.
- Required evidence: unit/property conservation, replay of the foodnstuff zero-hack case, browser sustained money trajectory, realized/modelled delta, and rollback to shadow/legacy sizing.

### R2 — stuck-target detection

- Inspect `evaluateStuckTarget`, floor reset, progress window, and skip-state persistence.
- Required evidence: floor is never misclassified; real non-improvement is; restart does not erase the durable explanation; browser failure injection by withholding effective weaken.
- Preserve the behavior, not necessarily the current timer implementation.

### R3 — desired-vs-running allocation reconciliation

- Inspect `computeDesiredAllocation`, `hostNeedsRedeploy`, missing-action escape hatch, timing maturity, RAM basis, and `poolNotIdle` evidence.
- Treat this as a reconciler requirement: compare complete desired allocation with observed processes, then apply scoped effects.
- Required evidence: property tests for RAM/security budgets, stale/missing/extra/wrong-target process replays, browser long-action timing, and no unrelated process kill.

### R4 — target scoring, ramp cost, and switching

- Inspect current approximate and Formula floor-corrected ranking, raw versus effective score use, horizon, hold, and switch factor as one policy.
- Distinguish the historical R4 implementation from the newer `FORMULA_RANKING_ENABLED` path.
- Make the 2026-09-07 `b-and-a` outbid followed by immediate `phantasy` re-adoption a mandatory fixture. A proposal and post-drop selection must use explicitly compatible bases or explain why a no-op transition is desirable.
- Required evidence: score differential replay, browser target sequence, realized/modelled rate, switch cost, no-op switch count, and a reversible shadow flag.

### R5 — per-script redeploy

- Inspect shared running-count logic, action order, maturity wait, and unconditional cleanup call sites.
- Preserve scoped ownership: reduce kills without leaving extra-generation workers.
- Required evidence: per-script unit cases, browser in-flight action test, plan-flips/redeploys per hour before/after, and tail cleanup behavior.

### R6 — XP objective

- Inspect XP-specific score, 95/5 split, zero-money quarter-XP rule, security maintenance, and per-host over-hack clamp risk as capacity grows.
- Resolve the stale/conflicting live claims with one current-release browser trial and one bounded Steam shadow/live observation only after browser success.
- Required evidence: target ranking, sustained XP/sec, money-not-exactly-zero behavior, invariants, and comparison with the current baseline. Do not infer value from the objective flag alone.

### R7 — cheap-item bundle, split into independent decisions

- Review home worker participation, growth-security saturation, `SECURITY_CAP`, and tick-bound monitoring separately.
- Current default hypothesis: preserve home as control-plane-only unless measured spare capacity and starvation-proof reconciliation justify a named policy; preserve the game-derived growth-security clamp; retain `SECURITY_CAP=1` if current formulas/source still support it; treat slow ticks as an environment signal, not a tunable failure.
- Required evidence: browser home-starvation injection, control availability under full worker load, security budget properties, and explicit disposition per subitem.

### R8 — Formula switch guard

- State in plain language: R8 never selects a target. Only after the ordinary scheduler has a qualified switch may it retain the current target when the candidate's minimum-security Formula score is below the threshold; missing/invalid data fails open to the existing switch.
- Do not conflate R8 with primary Formula ranking even though they share a scoring primitive.
- Replace “never fired” with the current live events, then test unavailable, veto, threshold-pass, and repeated-evaluation/coalescing behavior.
- Required evidence: scores, threshold, ratio, verdict, candidate, current target, scheduler qualification inputs, and resulting target transition. Investigate the current repeated per-tick veto events and no-op re-adoption.

The assessment's final queue must show cross-dependencies. At minimum R1/R3, R3/R5, and R4/R8 cannot be reasoned about as isolated toggles. R6 and the R7 home decision affect capacity and therefore scoring assumptions.

## 8. Control, logging, investment, and ROI requirements

### 8.1 Operator control surface

The first surface is read-only. It must show:

- environment and freshness;
- source/delivered/running release identities and drift;
- resolved desired state and revision;
- every active override, setter/source, reason, set time, expiry, and precedence;
- current authority capabilities and whether the loop is observing, proposing, or acting;
- observed conformance and owned/unowned processes;
- current proposal, predicate inputs, safety verdict, cooldown/idempotency state, and most recent outcome;
- current alerts/invariants and event-stream continuity;
- per-automation health and ROI card;
- exact stop and rollback action.

The initial command set should remain small: inspect; set/clear a typed expiring override; approve/deny a specific proposal where authority permits; reconcile a named component; activate/rollback an already verified release; and stop an owned component. Additional commands need a demonstrated operator need.

### 8.2 Logging acceptance requirements

- No component calls console/file logging directly except through the common event adapter, apart from the smallest bootstrap failure path when the adapter cannot load.
- Bootstrap failures use a well-defined emergency event/file and are imported into the durable stream later.
- Event serialization and human rendering are deterministic and golden-tested.
- Tail coalescing never changes durable occurrence count.
- The controller detects event sequence gaps and shows them as evidence loss.
- Local and game clocks are not assumed identical; receive time is retained.
- Local export is crash-safe; in-game retention is bounded; acknowledged events survive reconnect exactly once semantically, even if transport retries duplicate bytes.
- Decisions always contain their inputs, thresholds, chosen/rejected alternatives, authority verdict, and outcome correlation.

### 8.3 Cloud-worker investment card

Every proposal includes: proposal ID and expiry; requested RAM/capacity; current capacity and utilization; purchase cost; available budget and reserve; predicted marginal money/XP output; payback time; model and assumptions; opportunity cost; cap/slot effect; uncertainty; stop rule; and post-purchase measurement window. The first implementation is propose-only. Purchase authority is a separate visible capability and never inferred from affordability.

After a purchase, the same card records delivered capacity, time to first useful work, realized marginal output against a matched baseline, model error, and the next decision. A purchase that cannot be reversed requires more conservative evidence than an ordinary process restart.

### 8.4 Automation ROI card

Every continuing automation gets a card with:

- release/generation and authority mode;
- RAM, renderer CPU/time, game time, and operator attention cost;
- direct output/progress metric;
- baseline/counterfactual and measured marginal benefit;
- sample start/end, size, confidence and confounders;
- opportunity cost and displaced work;
- budget/cap and automatic stop rule;
- next review date and current decision: continue, reduce, pause, or propose expansion.

Inventory at least MCP farming, rooting, maintenance/contracts, player activity, Darknet, IPvGO, stock observation/trading, faction sharing, and any multi-target experiment. One-shot diagnostics have cost/outcome evidence but do not need a permanent card.

IPvGO's acceptance metric is useful faction reputation/progression gained per unit of RAM and renderer time against a comparable disabled/baseline window. Win count or move count alone fails. The measurement must keep opponent/faction membership, board size, algorithm generation, player state, and competing workloads visible. Until that exists, new capacity is not granted on the basis of activity.

## 9. Work packages and dependencies

Each package is small enough for one Terra-level agent. The package owner must read the named sources, produce the named artifacts, run the named checks, and leave the handoff record in the artifact plus the one current next action in `STATE.md`. Agents may not silently expand package authority.

### Wave A — discovery and pre-code contracts

#### A0. Baseline capture and contradiction register

- **Scope/sources:** `AGENTS.md`, working agreement, `STATE.md`, `docs/processes.md`, rewrite direction, strategy/mechanics docs, current code/tests/config, generated telemetry, incident/audit docs.
- **Dependencies:** none.
- **Outputs:** bounded provenance-stamped fixtures; current topology/authority/file map; contradictions and unresolved facts section in the system contract.
- **Acceptance:** every migration claim names evidence date/environment/release; no mutable gitignored file is a test dependency; baseline test commands/results recorded.
- **Authority/browser:** read-only; browser not required.
- **Rollback/stop:** no mutations; stop if telemetry provenance cannot be established and label it unusable.
- **Handoff:** “A0 complete” record listing fixture paths, test baseline, unresolved contradictions, and the exact inputs consumed by A1–A4.

#### A1. Documentation and test contract

- **Scope/sources:** §3–§5 of this plan, legacy incidents, existing test organization.
- **Dependencies:** A0 evidence inventory.
- **Outputs:** system, operator, event, state/command, release, test-plan, and migration-runbook skeletons with normative requirements and requirement IDs.
- **Acceptance:** each MUST maps to a planned test/evidence layer; both technical and non-technical docs exist; no code design is smuggled in as an untested assumption.
- **Authority/browser:** planning only; browser scenarios specified, not run.
- **Rollback/stop:** revise documents if an impossible requirement is found; a genuine product fork goes to Ken, otherwise agent decides and records.
- **Handoff:** requirement index, schema/example gaps, and Gate A checklist.

#### A2. Remote API and deployment study

- **Scope/sources:** `tools/bb_remote.py` in full, `remote_api_keepalive.js`, monitor script, sync manifest, browser sync/startup, Remote API docs/game source, existing selftest and diagnosis history.
- **Dependencies:** A0; may run in parallel with A3/A4.
- **Outputs:** `remote-api-study.md`, protocol fixtures, preserve/wrap/replace decisions, browser-PNA result, staged-release transport recommendation.
- **Acceptance:** all §6 questions answered or explicitly assigned an experiment; mock and failure tests specified; Steam tests remain inert/readback-only.
- **Authority/browser:** read-only local research plus bounded browser connection/file tests in non-active paths; no Steam active-file change.
- **Rollback/stop:** close test connection and discard staged files; preserve current GitHub browser path until alternative is proven.
- **Handoff:** chosen transport per environment, known limits, and exact requirements for B2.

#### A3. R1–R8 assessment

- **Scope/sources:** strategy/mechanics, current `mcp.js`/logic/config/tests, multi-target shadow, status/events/evidence.
- **Dependencies:** A0; internally sequential R1→R8; may run in parallel with A2/A4.
- **Outputs:** completed assessment and review-derived scheduler queue.
- **Acceptance:** all required fields and evidence/proof limits complete; current contradictions resolved; no implementation item lacks a review disposition.
- **Authority/browser:** local/read-only; browser measurements allowed only after A1's evidence format exists.
- **Rollback/stop:** measurements revert flags/overrides to prior revision; stop on any stop-list action.
- **Handoff:** ordered queue with dependency, expected benefit, rollback, and first shadow experiment.

#### A4. Authority, controls, stewardship, and ROI inventory

- **Scope/sources:** all startup/restart/control/config paths; maintenance, activity, contract, cloud, Darknet, IPvGO, stocks, share, crawler and experimental controllers.
- **Dependencies:** A0; may run in parallel with A2/A3.
- **Outputs:** authority/ROI contract, complete current effect-owner map, typed minimal command catalog, initial ROI measurement designs.
- **Acceptance:** every effect has one proposed owner/capability; stop-list is represented without a new tier system; every ongoing automation has a card plan.
- **Authority/browser:** observe/propose only.
- **Rollback/stop:** no activation; unresolved ownership conflicts block Gate A until decided.
- **Handoff:** capability list, legacy conflicts, and inputs for B1/B5.

#### Gate A — contracts before code

Code work may begin only when A0–A4 are complete, the documentation set exists, the test plan maps every contract requirement, the R1–R8 review is complete, and unresolved items are either non-blocking assumptions with falsifiers or genuine blockers in `STATE.md`. This is a finite quality gate, not a standing review role.

### Wave B — local foundations

#### B1. Versioned schemas and replay harness

- **Scope/sources:** event/state/command/authority/ROI contracts and A0 fixtures.
- **Dependencies:** Gate A.
- **Outputs:** schema validators, reducers, canonical renderer, replay CLI/tests, version/upgrade rules.
- **Acceptance:** T0/T1/T2 pass for valid/invalid, duplicates, gaps, ordering, stale inputs, coalescing, decisions and restart traces; old fixtures produce stable explanations.
- **Authority/browser:** local only, no game effects.
- **Rollback/stop:** additive files behind no runtime path; revert package cleanly.
- **Handoff:** schema versions, compatibility statement, fixture coverage, and APIs consumed by B3–B5.

#### B2. Release builder and transport adapter

- **Scope/sources:** release contract and A2 findings.
- **Dependencies:** Gate A; schema event envelope from B1 for final event integration, but digest/delivery work can start in parallel.
- **Outputs:** immutable manifest build, staged delivery/readback, active marker, last-known-good metadata, drift report, rollback operation.
- **Acceptance:** T1/T3 prove changed same-length content changes identity, partial/failed delivery cannot activate, reconnect is idempotent, concurrent loops cannot interleave releases, readback mismatch is loud, rollback restores prior identity.
- **Authority/browser:** local/mock first; no Steam active release.
- **Rollback/stop:** active marker remains unchanged on any fault; staged release can be abandoned.
- **Handoff:** release protocol, transport-specific limits, and browser package prerequisites.

#### B3. Read-only collectors and observed-state assembly

- **Scope/sources:** current status producers, independent `get_stats` measurements, process/file APIs, freshness contract.
- **Dependencies:** B1; parallel with B2/B4/B5.
- **Outputs:** collectors with explicit sample times/unavailable reasons, combined snapshot reducer, legacy adapter.
- **Acceptance:** T1/T2 show collectors cannot choose/act; cross-time samples stay labeled; stale/missing/corrupt data does not become zero/healthy; independent process reality can disagree visibly with controller belief.
- **Authority/browser:** observe only.
- **Rollback/stop:** stop collector generation; legacy status files remain untouched.
- **Handoff:** field coverage, RAM cost estimate, unsupported APIs, and B6 integration contract.

#### B4. Unified event spool and projections

- **Scope/sources:** B1 event contract, MCP event lessons, daemon logs, tail/HUD constraints.
- **Dependencies:** B1; parallel with B2/B3/B5.
- **Outputs:** game outbox, local durable ingest/ack, common adapters, tail and local human renderers.
- **Acceptance:** T1/T2/T3 prove every occurrence survives retries/reconnect, gaps are detected, retention is bounded after ack, console/tail/local render identically, repetition coalesces only in the tail.
- **Authority/browser:** observation only.
- **Rollback/stop:** dual-write behind a flag during migration; legacy logs remain until equivalence proven.
- **Handoff:** throughput/storage results, event adapter contract, and browser failure-injection list.

#### B5. Read-only operator surface and control core

- **Scope/sources:** state/command/authority/ROI contracts and A4 inventory.
- **Dependencies:** B1; can build read-only view in parallel, command mutation waits for B1 validation.
- **Outputs:** one surface showing identities, desired/observed state, overrides, authority, proposals, actions, alerts and ROI; typed command validator running in dry-run/reject-only mode.
- **Acceptance:** T0/T1/T2 cover precedence, expiry, expected revision, duplicate IDs, unauthorized requests, unavailable state, and plain-language R8 wording.
- **Authority/browser:** observe/propose only; no command executes an effect.
- **Rollback/stop:** disable surface/validator; runtime state remains unchanged.
- **Handoff:** command catalog, UX ambiguities, and B6 acceptance cases.

#### B6. Local foundation integration

- **Scope/sources:** B1–B5 outputs.
- **Dependencies:** B1–B5 complete.
- **Outputs:** one local integration path from fixture/transport through observed state, proposal/authority display, event stream, and projections.
- **Acceptance:** all T0–T3 tests pass; full existing suite remains green; failure evidence names release/generation; no game effect path exists.
- **Authority/browser:** local only.
- **Rollback/stop:** packages remain independently removable; schema incompatibility returns to B1 rather than patched in projections.
- **Handoff:** Gate B report and exact browser release candidate.

### Wave C — browser game boundary

#### C1. Browser release/bootstrap validation

- **Scope/sources:** B2 release protocol, current GitHub and candidate Remote API paths, browser startup behavior.
- **Dependencies:** B6 and A2 transport decision.
- **Outputs:** verified browser release, delivery/readback/running identity report, transport choice and fallback.
- **Acceptance:** T4 covers full success, one-file failure, disconnect mid-delivery, stale local files, restart, import resolution, and last-known-good rollback. Startup must not launch a mixed/partial release.
- **Authority/browser:** browser only; launch read-only foundation first.
- **Rollback/stop:** restore last-known-good browser release; if identity cannot be proved, no later browser package runs.
- **Handoff:** release IDs, evidence window, failures, rollback result, and C2 candidate.

#### C2. Browser collector/event/operator integration

- **Scope/sources:** B3–B5 and C1 release.
- **Dependencies:** C1.
- **Outputs:** live read-only state, unified events, tail/local projections, drift/conformance display.
- **Acceptance:** T4 validates real file restrictions, finite tail, orphan handling, throttled ticks, reconnect/outbox ack, corrupt inputs, collector RAM cost, and all operator success questions except acting/ROI outcome.
- **Authority/browser:** observe/propose only.
- **Rollback/stop:** stop owned read-only generation; existing gameplay controllers continue unchanged.
- **Handoff:** live gaps, measured resource cost, event continuity, and Gate C report.

#### Gate C — safe game foundation

Requires a complete browser release identity, real-game event continuity, correct read-only state, no mixed generation, successful rollback, and all known failures surfaced. Browser evidence is necessary but not sufficient for Steam-specific transport/save claims.

### Wave D — policy and one effect at a time

#### D1. Scheduler shadow policy

- **Scope/sources:** A3 queue, B1 replay, C2 collectors; no worker effects.
- **Dependencies:** Gate C.
- **Outputs:** new proposals alongside legacy decisions, explained difference events, realized-outcome comparator.
- **Acceptance:** T2/T4 cover all R1–R8 fixtures; every difference is classified as intended, legacy defect, new defect, or unresolved; unresolved safety/economics differences block authority.
- **Authority/browser:** shadow/propose only.
- **Rollback/stop:** stop shadow component; legacy MCP unaffected.
- **Handoff:** difference report, expected benefit, residual uncertainty, and first reconciler capability recommendation.

#### D2. Generation-aware reconciler foundation

- **Scope/sources:** release/state contracts and R3/R5 review.
- **Dependencies:** Gate C; can develop locally in parallel with D1, but browser activation waits for D1's first capability definition.
- **Outputs:** ownership discovery, dry-run convergence plan, idempotency/cooldown enforcement, scoped stop/start primitives.
- **Acceptance:** T1–T4 show no kill of unrelated/legacy processes, old generations retire in order, duplicates converge, failed start is visible, retry is bounded, restart preserves event evidence.
- **Authority/browser:** dry-run first, then browser act for one harmless owned read-only process.
- **Rollback/stop:** disable reconciler and stop only its owned generation.
- **Handoff:** proven effect primitive, ownership rules, and named next capability.

#### D3. Bounded MCP recovery capability

- **Scope/sources:** maintenance stale logic, supervisor/restart path, D2 primitives.
- **Dependencies:** D2.
- **Outputs:** one named restart capability with stale precondition, 60-second persistence, 15-minute cooldown or review-derived replacements, idempotency and health verification.
- **Acceptance:** browser kill/wedge/duplicate-request tests; exactly one recovery; source/delivered/running identities converge; old tail/process handling is correct; failure leaves legacy manual recovery available.
- **Authority/browser:** browser named act; Steam remains shadow.
- **Rollback/stop:** capability off; activate previous release and legacy restart path.
- **Handoff:** recovery evidence and Steam-shadow prerequisites.

#### D4. Scheduler/allocator capability sequence

- **Scope/sources:** only the ordered work from A3/D1; one policy/effect capability per subpackage.
- **Dependencies:** D1, D2, successful D3 lifecycle evidence.
- **Outputs:** separately flaggable capabilities, each with browser test and rollback.
- **Acceptance:** for each capability, replay/property tests, matched browser shadow, bounded act, conformance, realized metric, and rollback pass. R1/R3 or R3/R5 may be packaged together only if the assessment demonstrates they are inseparable.
- **Authority/browser:** browser only until each capability passes; never broad “new scheduler active.”
- **Rollback/stop:** disable the named capability; legacy decision/effect owner resumes without competing workers.
- **Handoff:** one evidence report per capability and recommendation for the next, not an automatic cascade.

#### D5. Stewardship and typed controls

- **Scope/sources:** A4 contract, B5 validator, D2 reconciler.
- **Dependencies:** D2/D3.
- **Outputs:** runtime desired-state store, local/game command adapters, proposals, explicit capability policy, expiring overrides and audited outcomes.
- **Acceptance:** T1–T4 cover revisions, duplicates, expiry, rejection, cooldown, restart persistence, reconnect, unauthorized stop-list commands, and source sync not overwriting runtime state.
- **Authority/browser:** observe/propose by default; only D3's proven capability initially acts.
- **Rollback/stop:** set all capabilities observe-only and restore prior desired-state revision.
- **Handoff:** effective policy snapshot and list of capabilities still propose-only.

#### D6. ROI and investment decisions

- **Scope/sources:** A4 inventory, live observed metrics, cloud/IPvGO/current automations.
- **Dependencies:** C2 for measurements, B5 for display; can run measurement design alongside D2–D5.
- **Outputs:** populated cards, cloud propose-only engine, IPvGO matched baseline experiment, stop/next-review rules.
- **Acceptance:** cards distinguish activity from marginal value; predictions and outcomes use comparable windows; uncertainty/confounders visible; no purchase occurs in initial package.
- **Authority/browser:** observe/propose only. Any restricted subsystem remains on the stop-list.
- **Rollback/stop:** stop measurement collectors if material cost; deny/expire proposals.
- **Handoff:** continue/pause recommendations with evidence and any explicit authority decision needed.

### Wave E — Steam shadow, bounded promotion, retirement

#### E1. Steam inactive delivery and read-only shadow

- **Scope/sources:** Gate C release path, D1 shadow, D5 controls, D6 cards.
- **Dependencies:** browser pass for the exact release; Steam transport inert-readback test.
- **Outputs:** delivered verified release, read-only processes, matched legacy/new evidence, operator surface.
- **Acceptance:** source=delivered=running for new read-only components; no legacy process changed; proposals/differences stable through reconnect and restart; resource overhead acceptable.
- **Authority/browser:** Steam observe/propose only.
- **Rollback/stop:** stop owned read-only generation; active legacy system unchanged.
- **Handoff:** Steam shadow report and recommendation for exactly one act capability.

#### E2. One-capability Steam promotion

- **Scope/sources:** the single recommended capability and its browser evidence.
- **Dependencies:** E1 observation window and all capability-specific gates.
- **Outputs:** visible policy change, bounded act evidence, conformance/ROI, tested rollback.
- **Acceptance:** pre-state, authority decision, action, result, identity, invariants and rollback are all present in the event stream; no unexplained delta; stop-list approvals obtained if applicable.
- **Authority/browser:** Steam named act only; no adjacent capability implied.
- **Rollback/stop:** automatic stop rule or operator rollback to legacy/last-known-good; invoke immediately on invariant, drift, event gap, or unexplained behavior.
- **Handoff:** disposition: keep active, revert for correction, or pause for a genuine blocker; name only one next capability.

#### E3. Repeat bounded promotions

- **Scope/sources:** remaining D4/D5 capabilities in dependency order.
- **Dependencies:** prior capability stable; no unresolved interaction.
- **Outputs/acceptance/authority/rollback:** same as E2 for each capability. Integration and authority changes are always sequential even when implementation research was parallel.
- **Handoff:** updated operator/technical docs, `docs/processes.md`, and next single capability in `STATE.md`.

#### E4. Legacy retirement and completion

- **Scope/sources:** component ownership map and full evidence history.
- **Dependencies:** replacement has handled normal operation, known failures, reconnect, restart recovery, evidence export and rollback in Steam.
- **Outputs:** removal/disable plan per old component, migrated durable state, final operator guide/process map, residual uncertainty.
- **Acceptance:** no dual effect owners; no startup/manifest references to retired paths; last-known-good recovery retained until the subsequent stable window; full tests and success test pass.
- **Authority/browser:** retirement of ordinary reversible paths is normal work; stop-list actions still require Ken.
- **Rollback/stop:** re-enable the last compatible legacy component/release if retirement causes drift or lost capability.
- **Handoff:** final `STATE.md` outcome with what is live-confirmed, what remains assumed, and no invented backlog.

## 10. Parallelism map

- A0 is first.
- After A0, A2, A3, and A4 may run in parallel; A1 coordinates their contract shapes and closes after consuming their findings.
- Gate A is ordered and blocks all code.
- After B1 establishes schema contracts, B2, B3, B4, and B5 may implement independently. B6 integrates them.
- C1 then C2 are sequential because unverified deployment identity invalidates browser evidence.
- D1 and local D2 work may overlap. D2 browser effects wait for D1 to name the capability. D6 measurement work may overlap D2–D5 because it is observe/propose-only.
- Steam delivery, shadow, authority changes, and retirement are sequential. Never run two controllers with overlapping worker/process ownership.

## 11. Audit triggers without governance deadlock

An audit is a bounded question and evidence review, performed by a fresh agent context or Ken where his approval is actually required. It creates findings in the package artifact and then ends. It is not a standing role or permanent gate.

| Trigger | Why warranted | Audit question/scope | Acceptance | Finding disposition |
| --- | --- | --- | --- | --- |
| Before Gate A closes | Contracts span local/game, authority and irreversible effects | Are requirements testable, non-contradictory, and consistent with stop-list/working agreement? | Every MUST mapped; no fictitious reviewer/daemon authority | Fix contract; record non-blocking assumption; or genuine fork to Ken |
| Event/release schema becomes incompatible | Evidence or rollback could be lost | Can old events/state/releases be read or explicitly migrated without silent reinterpretation? | Migration/rejection tests and rollback fixture pass | Block incompatible activation until fixed |
| First browser reconciler effect | Process ownership mistakes can disrupt all workers | Can it affect any unowned process or retry without bound? | Adversarial ownership/idempotency tests and live rollback pass | Revert capability; correct before retry |
| First Steam act capability and every authority expansion | Browser cannot prove Steam/save interactions | Does evidence support this exact capability and no broader one? | Exact release passed browser, Steam shadow explained, rollback ready | Keep propose-only, revert, or activate named capability |
| Cloud purchase authority | Purchase is irreversible in practice and competes for game funds/cap slots | Is marginal benefit/payback credible and post-purchase measurement defined? | Complete card, conservative uncertainty, budget/stop policy | Deny/expire or approve only named proposal |
| Stock capital, share re-enable, reset/install | Explicit project stop-list | Has Ken explicitly approved the concrete action after receiving evidence and rollback/irreversibility statement? | Explicit approval; all technical gates pass | No action without approval |
| Two failed browser live attempts for the same unexplained mechanism | Repeated tuning risks another Darknet-style miss | Is the model wrong, fixture incomplete, or game boundary misunderstood? | New falsifiable hypothesis and distinguishing test | Pause retuning; investigate source/runtime |
| Drift, event gap, partial release, or unexpected effect in Steam | Evidence trust is compromised | What ran, what was delivered, what acted, and is rollback safe? | Identity and event continuity restored; cause explained | Immediate rollback/observe-only; reopen owning package |
| ROI card misses its stop rule or review date | Ongoing cost without demonstrated value | Is continuation justified by marginal evidence? | Updated matched measurement or explicit pause | Pause/reduce by default; proposal needed to resume/expand |

## 12. Exact handoff record

Every package ends with this compact record in its primary artifact; `STATE.md` points only to the next package/action.

- **Package / objective:** identifier and one-sentence outcome.
- **Inputs read:** exact files, fixtures, releases/runs, evidence dates.
- **Outputs:** paths and schema/release versions.
- **Changes to authoritative docs/tests:** requirement IDs added/changed and why.
- **Checks run:** command/test layer, expected result, actual result.
- **Environment/authority exercised:** local, browser, Steam; observe/propose/named act.
- **Evidence claim:** implemented / locally tested / integration-tested / live-confirmed / assumed, with proof limit.
- **Open uncertainty:** fact, falsifier, impact; “none” if none.
- **Rollback verified:** exact prior release/state/capability and observed result.
- **Audit findings/disposition:** bounded findings and what happened to each; “not triggered” if none.
- **Next package:** one concrete action, dependencies already satisfied, exact artifact to read first.
- **Human action:** only if structurally required; matching `docs/kensTodo.md` item.

## 13. Final acceptance test

The rewrite is complete only when, from the operator surface and durable event stream alone, Ken or a fresh agent can answer:

- what the system observed and how fresh each input is;
- what it intends to do and every decision input;
- why that action is permitted and under which bounded capability;
- which immutable release was prepared, delivered, and started by every active long-running process;
- what actions occurred, their correlated outcomes, and whether observed state conforms;
- the resource cost and measured marginal value of each ongoing automation;
- what is uncertain or unsupported;
- how to stop the active capability and return to the last known good release/state.

It must also demonstrate: all T0–T3 tests passing; browser normal/failure/reconnect/restart/rollback evidence; Steam shadow evidence; at least one Steam capability promoted and rolled back successfully; no overlapping effect owners; no stop-list violation; bounded in-game logs with gap-free acknowledged export; current technical and operator docs; and a truthful final `STATE.md`.

If a smaller foundation cannot meet those tests without recreating the retired governance machinery, simplify the foundation. Reliability is the product; process is only in service of it.
