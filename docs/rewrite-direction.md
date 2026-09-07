# BitBurner rewrite direction

## Purpose

Build a smaller, more reliable control and monitoring foundation for **all
current game capabilities**, including MCP, rooting, contracts, Darknet,
stock trading, purchased cloud workers, IPvGO, player activity, HUDs, and
recovery. Use the existing repository as the behavioral record, test corpus,
and source of real failure cases. This is not a line-for-line replacement and
does not authorize disruption of the protected Steam save.

The immediate return sought from this direction is a **strong planning
document**, not an early rewrite. It must be evidence-backed and decomposed
so a sequence of Terra-level agents, or several such agents working in
parallel on independent research slices, can take it up with a high success
rate. Each planned work item must name its scope, source evidence, dependency
inputs, expected artifact, acceptance checks, authority level, browser-test
need, rollback/stop condition, and the exact handoff record for the next
agent. The plan must make parallelism explicit only where the work is actually
independent; integration, authority changes, and live testing remain ordered
gates.

The planning agent must also produce an explicit documentation-and-test
coordination plan as an independent, prior planning artifact -- not a
description extracted from the implementation after it exists. The
authoritative documents define the behavior, decision rules, interfaces,
evidence requirements, and acceptance tests that implementation must meet;
the test plan comes from those documents, not from the code. The plan must
identify the documents to create or revise, their owners and update triggers,
the unit/replay/browser-live test layers, fixtures and telemetry needed by
each, expected evidence, and how results gate later work. Where the risk,
novelty, or consequence warrants it, the plan must schedule an external or
independent audit of the design, implementation, test evidence, or live
behavior, with a defined question, scope, acceptance standard, and disposition
path for findings. An audit is not assumed to be valuable by default; the
plan must say why it is warranted for that item.

## Method for the next planning round

Run the next round as a documented evidence process, not a free-form set of
opinions:

1. Prepare a versioned evidence packet: repository/config state, known
   incidents, current telemetry samples, relevant game/version environment,
   and sync/deployment observations. Agents may investigate beyond it, but
   must distinguish supplied evidence from newly found evidence.
2. Publish the scoring rubric before assignment: evidence quality,
   operational safety, testability, decomposition/handoff quality, rollback
   clarity, and whether a Terra-level agent can execute each package without
   guessing.
3. Require a claim ledger for every material assertion: source, date, method,
   confidence, and consequence for the plan.
4. Use deliberate passes: independent research, independent plans,
   evidence-based comparison and synthesis, then an adversarial review of the
   consolidated plan.
5. Use a common deliverable shape -- executive summary, work-package table,
   evidence/claim appendix -- and time-box research so depth remains
   comparable and reviewable.
6. Keep a visible decision-and-change log. Scope changes, such as adding a
   subsystem or a deployment-isolation constraint, must version the direction
   and be carried into every active plan.
7. Before implementation, run a small browser-save proof of the deployment
   isolation, release identity, and event-contract assumptions. Do not treat
   a planning conclusion as established until this proof produces evidence.

## Direction, not a closed specification

Any agent assigned rewrite work is directed to use this document as a
**starting point, not an ending point**. Before carrying a requirement,
design, or assumption into the new system, it must study the relevant current
code, tests, durable state, incident history, Remote API implementation, and
actual Bitburner behavior. It must correct this document when that evidence
changes the direction, recording the reason and the evidence. Do not copy
legacy complexity merely because it exists; do not discard a guardrail merely
because it is inconvenient.

## Operating boundary

Ken uses the Steam save only. Codex may use a separate browser Bitburner save
through computer use as a disposable integration-test environment. Use that
environment for real execution, restart, recovery, reconnect, and
failure-injection tests before a new control path is offered to the Steam
save. Local unit tests remain necessary but are not proof of game behavior.

The existing approval boundaries remain in force: no autonomous progress
reset, restricted-subsystem re-enable, or unapproved capital deployment.
New authority begins as observe-only or propose-only and becomes active only
through a visible policy decision. Including stock trading in the rewrite
means rebuilding its monitoring, decision, controls, accounting, and eventual
execution path; it does not override the current requirement for explicit
capital-deployment approval before any live trading authority.

## Target shape

```text
collectors → observed state → policy/proposals → safety gate → reconciler → game agents
                  ↓                    ↓                         ↓
             event stream        operator controls          health checks
                  ↓
          tail / dashboard / local views
```

- **Collectors** read state; they do not choose or execute work.
- **Policy** produces explainable proposed plans from observed state.
- **Safety gate** enforces authority, budgets, cooldowns, and stop conditions.
- **Reconciler** idempotently makes observed processes match an approved plan.
- **Game agents** are thin, narrow executors rather than independent managers.

## Non-negotiable capabilities

### One release identity

Generate a content manifest for each source release, verify it after delivery
to the game, and have every long-running process report the release and
generation it started from. Show source, delivered, and running identities
together; any difference is version drift. Reconciliation retires only
superseded processes before starting the intended generation.

### One event interface

Every game-side and local-controller message passes through one structured
event interface. Events include time, source, release/generation, severity,
kind, action/correlation id, human message, and the decision inputs that
matter. The durable event stream is authoritative; files, dashboard, Remote
API, and console are projections of it.

The in-game tail displays each meaningful console event, but coalesces true
repeats by normalized event kind/message/context into a count with first/last
time and periodic summary. Warnings, errors, changed inputs, and decisions
remain individually visible. The tail is never treated as complete evidence.

### One operator surface

Provide a small, typed, validated set of controls instead of scattered
one-off levers. It must show resolved desired state, overrides, setter,
expiry, release/generation, observed conformance, and recent actions. Changes
are durable audited events and cannot be silently reverted by source sync.

### Bounded stewardship

An always-on loop may collect state, check freshness/invariants, reconcile
authorized state, and make proposals. It may not invent goals, spend money,
reset progress, re-enable restricted subsystems, or expand its own authority.
Every recovery has a cooldown, idempotency key, visible reason, and recorded
outcome. The UI distinguishes observing, proposing, and acting.

### Evidence-backed investment and ROI

Cloud-worker purchases start propose-only. Each proposal must disclose cost,
current and added capacity, projected marginal money/XP gain, payback time,
assumptions, opportunity cost, budget/cap effect, and measured outcome.

Every ongoing automation has an ROI card: resource cost, output/progress
metric, measured marginal benefit against a baseline, sample window,
confidence, opportunity cost, stop rule, and next review date. Activity is
not value. IPvGO must demonstrate useful faction-reputation/progression gain
at acceptable cost before receiving continuing capacity.

## Legacy assessment before migration

Review R1–R8 together and create a traceable queue. For each: plain-language
purpose, code location, inputs, enablement, unit/live evidence, limitations,
measurable benefit, rollback, and next action. Only review-derived work enters
the rewrite queue.

R8 specifically is a switch guard, not a target selector. If enabled, it may
keep the current target only after the normal scheduler has already qualified
a switch and the candidate's Formulas-at-minimum-security score is below the
configured relative threshold. Otherwise it fails open. The new control
surface must state this plainly and show the scores and verdict for every
evaluation.

## Migration sequence

1. Study and record the legacy behavior, Remote API implementation, and
   browser-test observations as executable fixtures.
2. Define versioned observed-state and event schemas plus their local replay
   harness.
3. Build the read-only collector, event projections, and operator surface.
4. Run the new policy in shadow mode against existing behavior; explain every
   difference before granting it authority.
5. Introduce one bounded reconciler capability at a time, browser-test it,
   then make it reversible and visible in the Steam environment.
6. Retire an old component only after it has handled normal operation, known
   failures, reconnection, restart recovery, and evidence capture.

## Success test

At any point, an operator can answer from the system itself: what it believes,
what it intends to do, why that action is allowed, what code generation is
running, what it has done, whether it is paying off, and how to stop or roll
back the current action.
