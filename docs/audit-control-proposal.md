# Independent audit-control proposal

**Purpose:** establish an ongoing control system that verifies compliance with
standing orders and explicit directives, rather than relying on Codex to
remember and self-report them accurately.

This proposal is submitted for independent review. It is intentionally
stronger than the current informal process because recent failures showed that
context retention is not the same thing as operational compliance.

## Why this is needed

Two recent incidents demonstrate the control gap:

1. `mcp_formulas_shadow.js` wrote a valid file, but overwrote it on every
   sample. The run was technically successful but produced inadequate
   evidence. The first review treated implementation as evidence.
2. The corrected shadow report existed in-game, but was not in the Remote API
   daemon's pull set. Codex asked for a live run, then could not retrieve the
   result. The end-to-end evidence path had not been checked before declaring
   the run useful.

The control objective is therefore not merely “the instruction was remembered”
or “the script ran.” It is:

```text
directive → acceptance test → execution → retrievable evidence → review → recorded outcome
```

## Core recommendation: separate roles

Codex must not be the sole authority that defines, executes, and certifies its
own compliance. The system should have four distinct roles:

### 1. Directive owner

Ken owns the meaning and priority of standing orders, safety boundaries, and
approval decisions. Ambiguous or materially expanded directives require his
clarification.

### 2. Implementer

Codex performs investigation and implementation within the approved scope.
Codex may propose changes to the contract, but may not silently redefine it.

### 3. Mechanical auditor

A local auditor checks objective conditions: files, manifests, tests,
evidence artifacts, pull configuration, prohibited symbols, documentation
coverage, and repository state.

### 4. Independent reviewer

An independent person or separately operated review task decides whether the
evidence supports completion, promotion, or closure. Codex's own statement that
“done” was reached is not sufficient evidence for high-impact work.

## Three enforcement layers

### Layer A — automatic recurring audit

Run a repository auditor from `launchd` on a fixed interval and after relevant
file changes. It should write timestamped reports outside the game and expose
the latest status in a small dashboard or terminal-readable file.

The recurring audit should detect, at minimum:

- missing or stale standing-order documents;
- pending human actions not represented in `docs/kensTodo.md`;
- generated files absent from the Remote API pull manifest;
- watched source files absent from the push manifest;
- changed scripts without corresponding `docs/processes.md` review;
- live claims without a local evidence artifact;
- reports that overwrite evidence when cumulative evidence is required;
- uncommitted changes and branch divergence;
- prohibited stock-order calls;
- production changes made without a recorded approval gate;
- scripts that can consume unbounded RAM, time, or telemetry storage.

The recurring audit is an alarm and evidence system. It cannot by itself stop
Codex from making a bad statement.

### Layer B — hard repository gates

Use pre-commit or CI checks to block mechanically detectable violations.

Examples:

- fail if `buyStock`, `sellStock`, `buyShort`, `sellShort`, `placeOrder`, or
  `cancelOrder` appears without an explicit approval record;
- fail if a changed game script adds files or arguments without a
  `docs/processes.md` update;
- fail if a generated diagnostic file is written by a script but is absent
  from the pull manifest or an explicitly documented exception list;
- fail if tests or syntax checks required by the contract have not passed;
- fail if a production integration is attempted while its status is
  `shadow-only` or `review-required`.

These gates should block commits or promotion, not merely print warnings.

### Layer C — approval gates for live or irreversible actions

Mechanical checks cannot determine whether a measured improvement is worth a
production risk. The following require explicit human or independent-reviewer
approval:

- production allocation changes;
- stock capital deployment;
- augmentation or other irreversible progression choices;
- backdoor/stasis-link expenditure in the Darknet;
- promotion of a shadow recommendation into production;
- declaring a high-risk live experiment complete.

The approval record must identify scope, expected benefit, stop conditions,
rollback, and the evidence reviewed.

## Required audit artifact

Every material task should produce a machine-readable record with these fields:

```text
directive_id
directive_text
owner
scope
acceptance_criteria[]
required_checks[]
evidence_paths[]
evidence_timestamps[]
live_status: not-run | local-only | shadow | live-confirmed | blocked
approval_status: not-required | pending | approved | rejected
rollback
remaining_uncertainty[]
auditor_result
independent_review_result
```

“Implemented” and “live-confirmed” must remain different states. A file's
existence is not proof that its contents were retrieved, interpreted, or
validated.

## Mandatory workflow checkpoints

### Session start

1. Read the directive ledger and current pending human actions.
2. Run the mechanical auditor.
3. Identify the active task, its owner, and its acceptance criteria.
4. Check for conflicting uncommitted work before editing.

### Before a live action

1. Confirm the action is authorized.
2. Confirm the input artifact reaches the game.
3. Confirm the output artifact has a retrieval path.
4. Record the rollback and stop condition.

### Before claiming completion

1. Retrieve the actual output locally.
2. Verify the evidence is complete, cumulative where required, and correctly
   labeled.
3. Run local checks and the mechanical auditor.
4. Update process and human-action documentation.
5. Obtain independent review when the contract requires it.

## Specific R8 controls

R8 remains `shadow-only` until all of the following exist:

- five-sample or otherwise approved bounded shadow evidence retrieved locally;
- actual pool-capacity comparison rather than a fixed synthetic pool alone;
- explained material differentials;
- labeled income, ramp, target-churn, RAM, latency, and invariant data;
- Formulas.exe lifecycle/fallback decision;
- senior recommendation: Adopt, Keep shadow-only, or Reject;
- independent review of that recommendation.

The auditor must specifically verify that `mcp_formulas_shadow.txt` is both
written in-game and present in the daemon's pull set before an R8 run can be
marked complete.

## Specific IPvGO controls

IPvGO must remain disabled by default until it has:

- a measured per-move time and RAM budget;
- a process-identity check preventing duplicate players;
- a watchdog or explicit stop path that remains usable while the game is
  degraded;
- a bounded game count or session duration;
- live evidence that it does not make the game UI unusable.

Local unit tests are not sufficient evidence for these requirements.

## Limits of this proposal

An auditor cannot independently understand every natural-language directive.
It can only enforce requirements translated into observable checks. Therefore
each important directive must include an acceptance test and an evidence
channel at the time it is issued.

Codex must not be allowed to mark its own work `live-confirmed` merely because
it observed a successful command invocation. A separate artifact retrieval or
independent reviewer is required.

## Recommendation to the independent reviewer

Approve implementation of the three-layer model, with these non-negotiable
controls:

1. automatic recurring audit;
2. hard repository gates for objective safety rules;
3. explicit independent approval for live promotion and irreversible actions;
4. mandatory local retrieval of live evidence before completion claims;
5. default-disabled status for IPvGO until its live resource behavior is
   measured;
6. R8 remains shadow-only until its complete evidence chain is independently
   reviewed.

The key question is not whether Codex has been instructed to follow the
standing orders. The key question is whether the surrounding system makes a
violation visible, blocks it where possible, and prevents self-certification
where visibility is insufficient.
