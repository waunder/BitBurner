# Rewrite execution plan: a small, observable control foundation

## Decision and operating frame

This is an execution plan, not a decision to replace all automation. The
first migration target is the money/XP MCP control path and the minimum
deployment/observation machinery it needs. Darknet, stock trading, purchase
automation, IPvGO, coding contracts, player activity, and `mcpMulti` remain
separate legacy consumers until an evidence-backed queue item says otherwise.
They must not be folded into a new general controller merely because they
exist.

The objective is to make the following answerable from durable system data:

> What was observed; what desired state won; what action was proposed or
> taken; why it was permitted; which exact release and generation did it; did
> it work; is it still worth its resource cost; and how is it stopped?

The plan deliberately does **not** restore the retired tiered-governance
apparatus. It uses ordinary engineering evidence gates, a small stop-list,
feature flags, and a reversible deployment path. A passing implementation
test is not approval to spend capital, reset progress, or re-enable a
restricted subsystem.

### Scope and non-goals

In scope:

- a versioned release/delivery/running identity model;
- one durable event contract and projections of it;
- a versioned observed-state and desired-state/control contract;
- shadow policy and then one narrow, idempotent reconciler for MCP lifecycle;
- test fixtures, replay, browser integration evidence, Steam promotion and
  rollback runbooks;
- an R1--R8 evidence assessment and a traceable rewrite queue; and
- propose-only capacity and automation ROI records.

Out of scope until separately queued: a batching rewrite, multi-target MCP
promotion, changing game progression goals, autonomous capital deployment,
augmentation/reset actions, Darknet re-expansion, and a broad replacement of
every existing script.

### Evidence that corrects the starting direction

The direction document is right about the target shape, but repository
evidence changes several planning assumptions:

1. `sync_manifest.json` is a *file allow-list*, not a release manifest. The
   Steam daemon (`tools/bb_remote.py`) full-pushes the mutable working-tree
   contents on each connection; browser `sync_from_github.js`/`startup_browser.js`
   fetch `main`. Neither binds a delivery to immutable content, verifies a
   content digest, or tells a process a release identity. `mcp.js` records a
   hash of only its own source (`scriptVersion`), not imports, config, worker
   scripts, or launch files. The new manifest must therefore be a generated
   content inventory, not a renamed copy of `sync_manifest.json`.
2. The Remote API is mature enough to study, not to assume safe for a rewrite.
   Its JSON-RPC server has one game connection; on connect it performs a full
   watched-file push followed by a telemetry pull, then polls both every
   two seconds. It has useful mock/self-test coverage, readback for restart
   trigger writes, root-path alarms, and a 20 MB WebSocket limit. It does not
   currently provide release transactions, file digests/readback for every
   source file, delivery journal records, authorization by control command,
   or an atomic activation boundary. A transport cutover is a later, tested
   work item, not a foundation to take on faith.
3. Browser and Steam have different, irreducible delivery boundaries. Chrome
   blocks Bitburner's public web origin from connecting to `ws://localhost`
   under Private Network Access; adding the server header did not solve it.
   Browser integration must use the GitHub/`ns.wget` sync/bootstrap path and
   tests real Netscript, save persistence, process lifecycle, UI and recovery.
   It cannot validate the Steam Remote API path. Steam Remote API tests must
   be a separate, bounded transport test on the protected environment, only
   after browser and local gates pass and without changing gameplay authority.
4. Current events are valuable but not unified. `mcp.js` writes JSON lines
   with `t`, `seq`, `runId`, `ver`, and `kind`, while other scripts use their
   own status files, tail/terminal messages, or histories. The MCP event file
   is trimmed only on startup; the status log is unbounded; the local daemon
   has a different plain-text log. These are migration inputs, not the new
   event interface.
5. Current runtime controls are not yet a control surface. `set_objective.js`
   writes a game-only objective override which survives source resync—a good
   precedent—but it has no actor, expiry, typed record, shared command
   grammar, or durable audit event. A source config is also not a safe home
   for mutable operator state, because it is delivered from disk.
6. Current documentation is internally inconsistent and must not be treated
   as live truth: `AGENTS.md` says `home` is excluded from MCP workers, while
   the present `mcp.js`/config include `HOME_RAM_RESERVE` and allocate home;
   historical sections of `processes.md` still describe earlier Remote API
   and R8 states; `STATE.md` says an XP override is active while committed
   config says `money`. These are investigation items, not defects to
   “fix” by editing a rewrite blindly.
7. `sync_manifest.json` currently includes `mcp_stock_trader.js` and its
   logic, while `AGENTS.md` says the trader must not be run, synced, or added
   to a watched path without explicit capital-deployment approval. It is not
   started by the normal startup list, but its inclusion is a material
   allow-list/authority discrepancy. The planning baseline must flag it for
   the owner before any manifest automation is broadened; no agent may
   silently normalize this by syncing, running, or deleting it.

The implementation agents must record any later correction in the evidence
index with source, date, method, and consequence for the plan.

## Boundaries, authority, and rollback

### Environments

| Environment | Allowed purpose | Not evidence for | Delivery path |
| --- | --- | --- | --- |
| Local repository/Node | schemas, pure policy, fixtures, replay, lint/syntax and protocol mocks | Netscript behavior, browser UI, Steam transport | local files only |
| Disposable browser save | real game execution, process/restart/recovery/failure injection, tail/UI and save-persistence tests | Steam Remote API behavior or protected-save safety | pinned GitHub content through `ns.wget`; bootstrap manually when needed |
| Steam save | protected live observation; later, visible reversible promotion | reset/capital/restricted-subsystem approval | Remote API only after its own transport gate, or existing approved operational path |

No browser test may claim to prove a Remote API result; no unit/replay test
may claim to prove game behavior; no Steam observation may be called a
promotion unless its release, generation, control state, and rollback record
are captured.

### Authority modes

Every desired-state record and every action must carry one of these modes:

| Mode | May do | May not do |
| --- | --- | --- |
| `observe` | collect, validate, emit events and proposals | change game processes/configuration |
| `propose` | calculate and publish an explainable plan or ROI card | execute the proposal |
| `act` | reconcile only the explicitly allowed, typed capability | change its own policy, broaden scope, spend money, reset progress, re-enable restricted subsystems |
| `paused` | retain/read evidence and expose the stop reason | start/recover work |

The existing direct-stop boundaries remain controlling: no autonomous capital
deployment, augmentation or other reset/forfeit action, or faction-share
re-enable. Darknet remains subject to its current stated restrictions. A
cloud-worker purchase is `propose` only until a separately visible policy
decision and the required user authority exist. The plan never treats
“passing tests” as an authority escalation.

### Rollback contract

Before the first action-capable reconciler is written, define and test this
rollback algorithm:

1. Persist the prior approved desired state, release manifest digest and
   generation before activation; assign an action/correlation id.
2. On stop, timeout, invariant failure, version drift, failed verification,
   or operator command, switch the control state to `paused` or the prior
   approved desired state and emit the reason.
3. A reconciler retires only processes it owns and can prove are from a
   superseded generation (owner/capability/generation metadata); it must not
   indiscriminately kill peers. It verifies their exit before launching the
   intended generation.
4. It confirms observed state and reports success, partial success, or a
   stable failure. Retry requires a cooldown and the same idempotency key;
   a new attempt gets a new action id.
5. A rollback leaves immutable evidence: before/after desired state,
   release/delivery/running identities, targeted PIDs, action outcome and
   operator-visible next step.

Initial active scope is only “start/stop/restart the MCP generation already
approved by desired state.” It cannot select a target, alter objective,
purchase capacity, launch Darknet/stock/share/IPvGO work, or repair arbitrary
scripts. Each later capability repeats the full gate sequence.

## Contracts that must exist before implementation

Documentation and tests are deliverables, not post-hoc summaries. The first
implementation commit for a capability is blocked until its contract and
test cases below are accepted in review.

| Contract/document | Owner work package | Must define | Update trigger |
| --- | --- | --- | --- |
| `docs/rewrite/charter.md` | W1 | in/out scope, environment boundary, ownership map, legacy component disposition | scope or component ownership changes |
| `docs/rewrite/evidence-index.md` | W1 | fact/provenance/status vocabulary; links to fixtures, browser runs, Steam observations, unresolved conflicts | each claim used to promote/retire work |
| `docs/rewrite/r1-r8-assessment.md` | W2 | purpose, locations, inputs, enabled state, unit/live evidence, limitation, benefit, rollback and next action for every R | a relevant code/config/live result changes |
| `docs/rewrite/schemas.md` plus versioned JSON schemas/fixtures | W3 | release manifest, observed state, desired state, control, event, action result, ROI card; compatibility and retention | field/semantic/version change |
| `docs/rewrite/test-and-evidence-plan.md` | W3 | acceptance behavior and test layer before code; fixtures, assertions, owners, evidence location and promotion gates | new capability or incident |
| `docs/rewrite/operations-runbook.md` | W4 | delivery, verification, browser test, Steam offer, stop/rollback/recovery, evidence capture | transport/lifecycle/control change |
| `docs/rewrite/component-queue.md` | W2 + W5 | prioritized work derived from assessment/observed gaps only; dependencies and rejection rationale | assessment finding or ROI review |

### Minimum schema rules

The schemas must be versioned and validated on read. Unknown future fields
are preserved where safe; invalid control or authority fields fail closed to
`observe`/`paused`, never to an implicit default action.

- **Release manifest:** `schemaVersion`, immutable `releaseId` (content
  digest), ordered paths with per-file digest and size, generator version,
  build timestamp, source revision/ref, exclusions, and signature/checksum
  of the manifest itself. “Source identity” is this manifest; the delivered
  and running identity refer to it, not to `main` or a one-file hash.
- **Delivery receipt:** manifest digest, environment, transport, every file
  attempted/verified, readback digest, partial failures, timestamps and
  correlation id. Delivery must be staged before activation; a partial
  receipt cannot activate a release.
- **Observed state:** timestamp/freshness, schema/release/generation,
  collectors and their errors, owned process inventory (PID/script/args/start
  time/generation where available), current runtime facts, and stale/unknown
  markers. It records observations, not decisions.
- **Desired state/control:** typed capability, mode, baseline policy and
  override list; value, validation result, setter/actor, issued/expiry time,
  precedence, reason, source release, correlation id, and resolved effective
  state. Runtime controls live in durable game state separate from delivered
  source/config so source sync cannot overwrite them.
- **Event:** `schemaVersion`, unique event id, occurrence time, source,
  release id, generation, severity, kind, correlation/action id, mode/actor,
  stable human message, normalized context, predicate/decision inputs,
  proposed and actual action, outcome/error. One canonical renderer derives
  tail, console, local view and dashboard text from this record.
- **ROI card:** capability/generation, resource cost, output/progress metric,
  baseline and comparison window, marginal result, confidence/assumptions,
  opportunity cost, cap/budget impact, stop rule and next review date.

The event design must retain every occurrence durably while controlling game
file growth. Specify bounded segments, rotation/compaction ownership,
sequence continuity, retention duration, export/pull behavior and what loss
is observable. Do not repeat the present “unbounded until restart” pattern.
Tail coalescing is a projection only: equivalence is kind + severity +
normalized message + relevant context; warnings, errors, changed inputs and
decisions are never collapsed. The raw event remains available in the segment.

## Test layers and evidence gates

Every work package names its tests in the test-and-evidence plan before it
alters code. The required layers are cumulative:

| Layer | Proves | Typical fixtures/evidence | Cannot prove |
| --- | --- | --- | --- |
| Contract/unit | schema validation, pure policy, render/coalescing, idempotency and rollback decisions | versioned JSON fixtures; `node --test`; Python Remote API selftest | game APIs/process/UI behavior |
| Replay | a recorded observed/event stream deterministically gives the expected proposal/reconciliation plan and explanation | anonymized/captured MCP status/events, edge fixtures for stale/missing/drift/duplicate action | live timing or transport |
| Transport mock | protocol request/order/error/readback behavior | spec-accurate remote mock and injected disconnect/partial-write/oversize failures | Steam game connection |
| Browser live | actual Netscript lifecycle, game files, save persistence, tail rendering, startup/recovery/failure injection | pinned release receipt, screenshots/structured dumps, event segment, process list, status snapshots | Steam Remote API |
| Steam bounded promotion | protected environment delivery, identity agreement and reversible behavior | delivery receipt, controller view, before/after state, action record, rollback drill when appropriate | authority not explicitly granted |

Promotion gates:

1. **G0, factual baseline:** W1/W2 evidence index resolves or explicitly
   quarantines every conflict that could affect scope/authority. In particular,
   resolve the actual home-worker policy, runtime objective, live Remote API
   daemon/version, and trader allow-list discrepancy. No rewrite activation
   before this.
2. **G1, contract gate:** schemas, behavior spec, test/evidence plan and
   rollback runbook are reviewed; negative cases are named. Code cannot define
   the acceptance criteria retrospectively.
3. **G2, local gate:** full relevant unit/replay/transport suite passes from a
   clean checkout; fixture and manifest checks prove deterministic results.
   The current full Node suite passed 235 tests in the planning baseline, but
   it is legacy regression evidence—not proof of the rewrite.
4. **G3, browser gate:** a pinned release reaches a verified running
   generation; normal lifecycle plus each package’s failure injection passes;
   stop/rollback evidence is captured. Browser must never silently “continue
   with stale code” for a release activation test: that legacy best-effort
   behavior is itself a fixture/failure case.
5. **G4, Steam offer gate:** G0--G3 evidence and the exact reversible scope
   are summarized for the operator. Steam deployment starts in observe or
   shadow mode; an action-capable capability must also have a visible policy
   state and a release/delivery/running-identity match.
6. **G5, retirement gate:** an old component is retired only after normal
   operation, restart recovery, reconnect/transport handling where relevant,
   known failure scenario, evidence capture, and rollback have all been
   demonstrated. Retire one ownership path at a time.

Mandatory negative tests include bad/missing/unknown schema versions,
expired override, conflicting controls, stale observed state, release drift,
partial delivery, duplicate action/restart request, action timeout,
disconnect mid-delivery, reconnect full resync, oversize telemetry,
orphaned/old-generation process, tail repetition, and a failed rollback.

## R1--R8 assessment sequence

W2 assesses all eight before scheduling any scheduler replacement. The table
below is the baseline to verify, not a claim that documentation is current.

| R | Present evidence to inspect | Required assessment result / next gate |
| --- | --- | --- |
| R1 balance-point weights | `computeWorkWeights`, MCP tests, strategy’s 2026-08-14 live account | confirm inputs/assumptions and retained diagnostics; replay money ramp/harvest; preserve only if measured outcome still supports it |
| R2 stuck detection | `evaluateStuckTarget`, regression tests and live cycle evidence | model stale/single-cycle timing and ensure new observed state exposes every predicate input |
| R3 allocation-diff redeploy | `computeDesiredAllocation`, `hostNeedsRedeploy`, allocation tests | replay in-flight actions and prove the reconciler does not turn allocation changes into broad process kills |
| R4 scoring/ramp/formulas ranking | target score/effective score, current-security fallback and formulas path | quantify fallback versus floor model, record formula availability, verify target selection only after policy shadow explains differences |
| R5 per-script redeploy | `countRunningByScript`, missing-action escape hatch and current live evidence | retain action-level ownership; prove no unrelated in-flight action is killed by a generation transition |
| R6 XP objective | XP selector/split tests; `STATE.md`, status/config/override reality | resolve the live-status conflict, run the browser XP observation with no money-degradation eviction, and measure sustained XP before queueing changes |
| R7 ancillary scheduler fixes | home reserve, security/grow offset, tick/plan data and contradictory docs | split into independently justified behaviors; establish current home policy rather than inheriting historical prose |
| R8 switch veto | `evaluateFormulaSwitchVeto`, config, formulas score source, events | verify it remains only a post-qualified-switch guard, fails open on unavailable data, renders scores/verdict, and capture a browser qualified-evaluation path before claiming live effectiveness |

For each R, the assessment records purpose, exact files/functions, data
inputs, current config/enablement, source/unit/replay/browser/Steam evidence,
known limitation, measurable benefit, rollback mechanism, owner and next
action. “Implemented” without one of those fields is not queue eligibility.

## Work packages

Each package below is small enough for one Terra-level agent. Agents may run
only the explicitly parallel research/documentation packages concurrently;
integration, authority changes and live testing remain sequential.

### W0 — Baseline preservation and conflict register (first, ordered)

- **Scope/output:** create the evidence index and a read-only baseline
  snapshot inventory: git/ref state, current manifests, Remote API daemon
  configuration/status, test commands/results, live-file freshness if safely
  readable, process map, controls, known incidents, and every documentary
  conflict listed above.
- **Inputs:** `AGENTS.md`, `STATE.md`, `processes.md`, hacking strategy,
  current source/tests, `sync_manifest.json`, Remote API docs/log and code.
- **Acceptance:** each assertion is labelled source/derived/observed/open;
  historical claims are not promoted to present state without verification;
  the stock-trader allow-list discrepancy is visible to the owner.
- **Authority/browser/rollback:** read-only, no browser required, no Steam
  mutation. Stop if observation would require a protected action. Handoff is
  evidence-index revision plus unresolved-question list and fixture candidates.

### W1 — Legacy behavior and incident fixture extraction (parallel after W0)

- **Scope/output:** define the legacy component map and turn the most
  consequential incidents into replayable fixtures: stale source after sync
  loss, non-TTY Remote API disconnect, stale repository root, oversized pull,
  invalid event-file extension, orphan tail, target floor false-stuck,
  allocation churn, source/config versus objective override, and browser PNA
  refusal. Include explicit “not reproducible locally” labels.
- **Inputs/dependencies:** W0 inventory; existing tests, docs and logs.
- **Acceptance:** every fixture has provenance, expected observable result,
  and the layer in which it can be tested. No synthetic fixture may be passed
  off as a live incident capture.
- **Authority/browser/rollback:** read-only. Browser is deferred to W6 for
  actual lifecycle cases. Handoff is fixture catalogue and component map.

### W2 — R1--R8 assessment and queue (parallel after W0)

- **Scope/output:** produce the assessed R table described above and the
  component queue. Assess `mcpMulti` only as a separate experiment, never as
  an implicit replacement; identify which legacy behavior is retained,
  shadowed, deferred or retired.
- **Acceptance:** every entry has all required fields and at least one
  measurable metric/baseline. R6/R8 are not called live-confirmed merely from
  unit tests or an enabled flag.
- **Authority/browser/rollback:** observe only. Browser evidence is planned,
  not fabricated. Handoff is queue ordered by value/risk/dependency.

### W3 — Contract, documentation and test-plan design (depends W1/W2)

- **Scope/output:** publish the six documents and versioned schemas in the
  contract table. Define canonical event rendering/coalescing and retention;
  desired-state precedence and expiry; release/delivery/running identity;
  action idempotency; and the test matrix before implementation tickets.
- **Acceptance:** examples validate against schemas; valid and invalid
  fixture cases exist; a reader can derive every acceptance test from the
  documents without reading code; control source-sync non-overwrite rule is
  explicit.
- **Authority/browser/rollback:** documentation/test fixtures only. No live
  change. Handoff is schema version, compatibility decision, test IDs and
  implementation-ready interface checklist.

### W4 — Deterministic release and transport proof of concept (depends W3)

- **Scope/output:** build the release-manifest generator/verifier and
  delivery receipt workflow in a staging namespace; adapt neither the live
  sync daemon nor startup path until mock/readback proof exists. Decide
  explicitly whether Remote API is retained as Steam transport or wrapped;
  browser release delivery gets a revision/content verification path rather
  than mutable-branch trust.
- **Acceptance:** a source manifest exactly changes when any listed source,
  import, config or worker changes; staged delivery verifies each content
  digest/readback; partial delivery cannot activate; source/delivered/running
  mismatch produces a drift event and an operator-visible state. Exercise
  reconnect, duplicate delivery, bad digest and no-connection cases.
- **Authority/browser/rollback:** observe/staging only. Browser must verify a
  pinned content receipt through its GitHub path; Steam Remote API proof is a
  bounded transport-only action, no process launch or policy change. Rollback
  is delete/abandon staging generation, never overwrite active source.
  Handoff: manifest, receipt, mock/log evidence, exact transport decision.
- **Audit:** independent review is warranted before activation because this
  package controls what reaches the protected game. Review the path traversal
  allow-list, digest/readback rules, partial-delivery behavior, one-connection
  semantics and rollback—not generic code quality. Findings are blockers for
  activation, triaged into fix/accepted limitation/rejected with rationale.

### W5 — Read-only observation, event projections and operator surface (depends W3/W4)

- **Scope/output:** implement collectors that do not decide or act; canonical
  event writer/renderer; versioned observed state; controller/dashboard/tail
  projections; release drift and freshness status. Migrate MCP first by
  adapting existing `mcp_status.json`/event data, not by deleting it.
- **Acceptance:** one emitted event produces identical semantic content in
  durable segment, local view and tail projection; tail coalesces only
  defined repeats; a killed/timed-out collector becomes explicit stale/error
  data; UI shows source/delivered/running identities, desired/effective mode,
  overrides, conformance and recent actions. Existing event fields needed to
  explain a decision remain preserved or have a documented mapping.
- **Authority/browser/rollback:** `observe`; browser normal/restart/tail
  persistence tests required. Rollback is disable the new projection and keep
  legacy status/event producers intact. Handoff is schema samples, mapping
  table, browser evidence and known telemetry gaps.

### W6 — Shadow policy and R replay (depends W2/W5)

- **Scope/output:** run a policy which consumes only observed state and
  emits proposed desired state/actions without execution. It calculates MCP
  lifecycle/target policy and R1--R8-relevant verdicts while legacy MCP
  remains authoritative.
- **Acceptance:** replay is deterministic; each divergence from legacy has
  a reason with recorded inputs; browser run covers normal ramp/harvest,
  switch qualification/R8 availability path, stale observation, expired
  control, and fail-open formulas behavior. No unexplained divergence may be
  promoted to an active reconciler.
- **Authority/browser/rollback:** `propose`; browser required, Steam only
  shadow observation after G4. Rollback is disabling the shadow consumer;
  no game process it did not own has changed. Handoff is divergence ledger,
  measured R metrics and capability proposal limited to lifecycle reconcile.

### W7 — MCP lifecycle reconciler (depends W4/W5/W6, strictly ordered)

- **Scope/output:** introduce exactly one action capability: reconcile
  approved MCP lifecycle desired state to its owned process generation.
  It consumes the safety gate, release receipt and shadow-validated plan;
  writes action results and honors cooldown/idempotency.
- **Acceptance:** browser tests prove start, stop, controlled restart,
  old-generation retirement, duplicate request, RAM/start failure, process
  crash, stale state, stop command and full rollback. Each action shows why
  allowed and its exact process targets. A successful restart must display a
  matching source/delivered/running identity, not merely a new PID.
- **Authority/browser/rollback:** first deploy `observe`, then `propose`,
  then a narrowly visible `act` policy. Steam action is offered only after
  browser evidence and G4; no broad `killall`, no capability expansion.
  Handoff includes before/after receipt, action event, rollback drill and
  post-run health sample.
- **Audit:** independent implementation/evidence review is warranted before
  Steam `act`: ask whether ownership/generation matching can kill or restart
  an unrelated process, whether retries are bounded, and whether the claimed
  rollback was actually exercised. Any P0/P1 safety finding blocks promotion.

### W8 — Controls, investment and ROI (depends W5; action portions after W7)

- **Scope/output:** migrate objective/feature controls to the typed control
  contract; build propose-only cloud-worker ROI cards; create health/ROI cards
  for each continuing automation, beginning with MCP and IPvGO. Keep money
  actions unavailable.
- **Acceptance:** an operator can set/query/clear an allowed control from
  game and local controller paths; setter, reason, expiry and precedence are
  visible/audited; expiry takes effect deterministically; a source resync
  does not erase runtime control state. Every purchase proposal includes cost,
  current/additional RAM, predicted marginal money/XP, payback, assumptions,
  alternative use, cap/budget and post-action measurement plan. Every ROI
  card carries baseline, sample window, confidence, stop rule and review date.
- **Authority/browser/rollback:** controls begin `observe`/`propose`; cloud
  purchases stay `propose` even after browser tests. Steam capital deployment
  requires the existing explicit user approval. Rollback expires/clears the
  override and records it; never edits source configuration to undo runtime
  state. Handoff is control ledger/ROI card/evidence.

### W9 — Incremental retirement and expansion (depends W7/W8 per capability)

- **Scope/output:** retire or replace a single old ownership path only after
  G5. Candidate order is MCP launch/restart glue, then only those R-derived
  scheduler behaviors where shadow evidence supports it. Every other system
  needs its own queue item, contract and gates.
- **Acceptance:** normal operation, restart recovery, known failure,
  reconnection where applicable, evidence capture, rollback and ROI all pass;
  docs/process map and operator surface are updated in the same change.
- **Authority/browser/rollback:** no implied new authority. The old path is
  retained flag-off or recoverable until the retirement gate passes; handoff
  records disposition and removal rationale.

## Audit triggers and disposition

Do not schedule an “independent audit” by default. Schedule one when a change
can silently broaden authority, alter release delivery, affect multiple
process owners, make recovery destructive, or carries a live result that
cannot be reproduced in browser. Required audits are W4 transport/identity
and W7 active reconciler. Conditional audits are triggered by: repeated
unexplained browser instability; a release/delivery/running mismatch; failed
rollback; partial transport receipt; an R-policy divergence without a
recorded predicate; any capital/restricted-subsystem proposal; or a claim of
benefit based only on activity rather than a baseline.

Audit records name the question, exact reviewed artifacts and evidence,
acceptance standard, reviewer independence/limitations, findings by severity,
owner/due decision, and disposition. A finding can be fixed, accepted with a
bounded documented limitation, or rejected with evidence; it cannot vanish
into a status update. Stop the affected promotion path for an unresolved
critical safety or authority finding.

## Handoff record template

Every package ends with one short, machine-readable and human-readable
handoff record in the evidence index:

```text
work package / capability / schema version:
scope completed and deliberately excluded:
source revision + release manifest digest:
dependencies and gates met (test IDs/results, fixture IDs):
browser evidence (environment, start/end, failure injections, artifacts):
Steam evidence or “not attempted” and why:
effective authority/mode and controls/expiry:
release, delivery and running generation verdict:
rollback/stop exercise and outcome:
open risks, contradictions, audit findings and exact next owner/action:
```

The next agent starts from this record and `STATE.md`; it does not infer
success from an earlier agent’s prose or from a passing local test suite.

## Completion definition

The rewrite foundation is complete only when its own operator surface can
answer the opening question for MCP under normal operation, browser recovery,
and a bounded Steam observation; its data has coherent release/delivery/
running identity; its controls and action authority are visible and
reversible; its events are one durable interface with correct projections;
and its ROI records distinguish measured value from activity. Until then,
the legacy system remains the behavioral record and the rewrite proceeds one
capability at a time.
