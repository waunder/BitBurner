# Standing orders for AI-assisted engineering teams

These orders define the reusable working method for this project and future
projects. The application under development may change; the separation between
requirements, implementation, testing, and evidence does not.

## Purpose

The team exists to produce reliable changes while making assumptions visible.
The software or game being worked on is the test object. The deeper objective
is disciplined collaboration between specialized AI roles.

The team must distinguish clearly between:

- what the system is supposed to do;
- what the existing system actually does;
- how the system is implemented;
- what has been tested locally;
- what has been confirmed in the live environment.

No one of these categories may silently stand in for another.

## 2026-08-15 amendment — progress-enabled controls

**Status:** adopted by Ken provisionally, subject to review after it has
controlled and enabled real work. The detailed operating implementation is in
`docs/governance-control-operations.md`; the independent basis is
`docs/independent-governance-audit.md`.

Progress remains the primary mandate. Controls exist to prevent repeated
failure, preserve evidence, and keep rollback cheap; they must not turn
ordinary investigation into a permission queue.

Work uses the minimum applicable tier:

| Tier | Work | Rule |
|---|---|---|
| 0 | Local/read-only analysis, tests, docs, fixtures, retrieved-telemetry review | Always proceed. |
| 1 | Bounded, reversible diagnostics | Proceed when source, duration, output, stop condition, rollback, and retrieval path are explicit. |
| 2 | Established operating baseline | Proceed under its documented health and recovery checks; no repeated approval is needed. |
| 3 | Capital movement, production promotion, irreversible expenditure, new always-on automation, or re-enabling an incident-held subsystem | Requires a narrow append-only approval, independent review, stop conditions, rollback, and retained evidence. |

Use `PASS`, `WARN`, `REVIEW_REQUIRED`, and `BLOCK` precisely. A `BLOCK` may
only stop its named action for an objective safety, provenance, authority, or
rollback failure. Documentation debt normally produces `WARN`. Every block
must state its smallest correction, owner, clearing evidence, and parallel
safe work.

For a material live diagnostic, completion requires exact source identity,
retrieved output, schema/sample validation where applicable, and an outcome
record. An in-game file existing or a command ending does not by itself prove
completion. A current `live-confirmed` claim must retain its source identity,
observed time, run ID, retrievable artifact, proof limit, and reviewer when
consequential.

The authoritative current state is the combination of the Codex overlay in
`AGENTS.md`, `docs/directive-ledger.json`, and `docs/promotion-state.json`.
Historical prose remains evidence but cannot grant present permission. In the
connector-synced checkout, a watched-source edit is deployment-capable;
develop live source in a non-synced worktree and promote one attested source
identity at the proper boundary.

## Operating principle

Work contract-first:

```text
observe and investigate
→ document behavior and desired outcomes
→ challenge and approve the contract
→ derive tests
→ implement
→ run tests
→ validate in the live environment
→ update evidence and documentation
```

The team does not begin with code merely because code is easier to produce.
When the desired behavior is unclear, the first deliverable is clarification,
not implementation.

## Team roles

### Senior reviewer / lead

The senior reviewer owns coherence and final decisions. Responsibilities:

- define or confirm the objective;
- identify which claims require evidence;
- approve the behavioral contract;
- resolve disagreements between documentation, tests, and implementation;
- protect safety, scope, and rollback boundaries;
- decide whether a change is ready for live validation;
- record the final outcome and remaining uncertainty.

The senior reviewer must not allow an implementation preference to become a
requirement merely because it is convenient to code.

### High-level documenter

The documenter describes the system and its intended behavior without making
the document depend on a particular implementation.

The documenter records:

- purpose and scope;
- inputs and outputs;
- state transitions;
- invariants;
- failure modes;
- external constraints;
- measurable acceptance criteria;
- known facts, assumptions, hypotheses, and unknowns.

The documenter should describe observable outcomes rather than prescribe code
structure. If implementation detail is necessary, it must be labeled as a
constraint or design decision, not disguised as behavior.

### Developer

The developer implements the approved contract and reports when the contract
is ambiguous, contradictory, unsafe, or infeasible.

The developer must not quietly redefine the requirement to fit the code. If a
change in behavior is needed, the contract must be updated and re-approved.

### Tester

The tester derives tests from the approved contract, not from the developer's
implementation and not from assumptions found only in source code.

The tester must:

- map each acceptance criterion to one or more tests;
- cover normal, boundary, invalid, and failure cases;
- test invariants and observable outcomes;
- challenge ambiguous or untestable requirements;
- distinguish unit, integration, live, and exploratory evidence;
- report what the tests do not prove.

The tester is independent of the implementation assumptions but collaborates
closely with the documenter. The tester must be willing to reject or revise a
documented requirement when it is internally inconsistent or cannot be
observed reliably.

## The behavioral contract

Before implementation, the documenter and senior reviewer should produce a
small behavioral contract. It should answer:

1. What outcome is required?
2. What is explicitly out of scope?
3. What inputs and environmental conditions matter?
4. What outputs or state changes are observable?
5. What must always remain true?
6. What happens on invalid input or external failure?
7. How will success be measured?
8. What evidence would falsify the design?

Every requirement should be labeled when useful:

- **fact** — directly observed or sourced;
- **requirement** — explicitly desired behavior;
- **assumption** — currently believed but not verified;
- **hypothesis** — proposed explanation or expected improvement;
- **unknown** — unresolved and requiring investigation.

The contract is complete enough when a tester can write tests without reading
the implementation to discover what the system is meant to do.

## Documenter–tester handoff

The documenter gives the tester:

- the approved contract;
- a glossary of terms and units;
- examples and counterexamples;
- acceptance criteria;
- expected failure behavior;
- a list of unresolved questions.

The tester returns:

- a requirement-to-test traceability matrix;
- ambiguities found while deriving tests;
- missing boundary cases;
- requirements that cannot be observed or measured;
- proposed clarifications for senior review.

The handoff is not complete until both roles agree that every acceptance
criterion is testable or is explicitly marked as exploratory/live-only.

## Traceability

For each material change, maintain this chain:

```text
requirement
→ acceptance criterion
→ test or live check
→ implementation location
→ observed result
```

Traceability can be lightweight—a table in a planning document, issue, or
test file is sufficient—but it must exist for changes with meaningful risk.

Recommended fields:

| ID | Requirement | Test/check | Implementation | Evidence | Status |
|---|---|---|---|---|---|

Do not mark a requirement complete merely because code exists or a unit test
passes.

## Evidence standards

Evidence must state what it proves and what it does not prove.

- **Static inspection:** the code has a property; it does not prove runtime
  behavior.
- **Syntax/type check:** the file parses or types; it does not prove logic.
- **Unit test:** a focused behavior works under controlled inputs.
- **Integration test:** components work together in a controlled environment.
- **Live validation:** the real application accepted and exhibited the
  behavior.
- **Telemetry:** the behavior persisted or occurred over time.
- **Exploratory observation:** useful evidence, but not a substitute for a
  repeatable test.

Use precise language: “implemented,” “locally tested,” “live-confirmed,” and
“inferred” are different statuses.

## Assertions and failure handling

Assertions should protect the contract, not merely check implementation
details. Prefer assertions about:

- valid ranges and units;
- conservation or monotonicity properties;
- state-machine transitions;
- resource limits;
- safety boundaries;
- consistency between reported state and actions.

Recoverable runtime anomalies should surface through the project's visible
error/invariant channel and a bounded status counter. They must not disappear
inside a print-only catch block. Destructive or capital-moving actions require
an explicit approval boundary and a dry-run or shadow mode where practical.

## Parallel work rules

Parallel agents may work concurrently only when their boundaries are clear.

- The documenter may investigate and specify behavior while the developer
  prototypes, but neither may silently finalize the contract alone.
- The tester may build fixtures and tests before implementation exists.
- The developer may implement against a provisional contract only when the
  provisional status is explicit and no irreversible action is involved.
- Shared files require a named owner for the current edit or a coordinated
  patch plan.
- Agents must report conflicts, not overwrite another role's assumptions.

The senior reviewer should prefer parallel investigation, documentation, and
test design, followed by a deliberate contract-approval checkpoint before
integration.

## Change gates

### Gate 1 — Problem understood

Scope, objective, constraints, and unknowns are documented.

### Gate 2 — Contract approved

Desired outcomes and failure behavior are explicit and testable.

### Gate 3 — Tests designed

The tester has mapped acceptance criteria to tests or identified why a check
must be live-only.

### Gate 4 — Implementation complete

The developer has implemented the contract and documented any deviations.

### Gate 5 — Local evidence complete

Tests, assertions, syntax checks, and relevant regressions pass.

### Gate 6 — Live validation approved

The senior reviewer has approved deployment, scope, rollback, and observation
window.

### Gate 7 — Outcome recorded

The team records the live result, updates the contract and tests if needed,
and labels remaining uncertainty.

## Disagreement protocol

When roles disagree:

1. State the exact disagreement.
2. Identify whether it concerns a fact, requirement, assumption, or design.
3. Find or request evidence.
4. Prefer a small discriminating test or observation.
5. Have the senior reviewer decide if the disagreement remains.
6. Record the decision and its rationale.

The team must not resolve disagreement by allowing the implementation to win
by default.

## Completion definition

A change is complete only when:

- the intended behavior is documented;
- the implementation matches the approved contract or deviations are
  approved;
- tests are derived from the contract and pass;
- failure and boundary behavior are covered;
- live-only claims are validated where required;
- deployment and rollback are understood;
- documentation, tests, and evidence are current.

## The learning objective

The project is also a training ground for directing AI teams. At the end of a
work cycle, the senior reviewer should ask:

- Did the team separate observation from assumption?
- Did the documenter describe outcomes rather than implementation preference?
- Did the tester independently challenge the contract?
- Did the developer expose ambiguity instead of hiding it?
- Did evidence distinguish local confidence from live confirmation?
- Did parallel work reduce elapsed time without reducing coherence?
- What instruction, role boundary, or artifact should be improved next time?

The process itself is subject to review. Improve the standing orders when a
failure reveals a reusable lesson, while preserving the separation of
responsibilities that makes the lesson visible.
