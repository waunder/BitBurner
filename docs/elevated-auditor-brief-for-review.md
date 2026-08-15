# Brief for elevated independent auditor

**Status:** Approved by Ken and dispatched on 2026-08-15.

## 1. Primary mandate

The project's primary mandate is **progress**: make the Bitburner system more
productive, capable, reliable, and understandable.

Governance exists to enable that mandate. It must reduce repeated failure,
preserve evidence, make rollback cheap, and prevent unsafe or unauthorized
actions. It must not turn ordinary engineering, diagnosis, documentation, or
reversible experimentation into a permission queue.

The auditor must therefore optimize for:

```text
safe forward motion → useful evidence → reversible decisions → compounding progress
```

An auditor that mainly stops work, repeats already-settled questions, or
requires senior approval for low-risk activity is failing its assignment.

## 2. Review scope

Review the entire operating system of the repository, not only R8. Read and
cite the current versions of:

- `AGENTS.md`;
- `CLAUDE.md` as preserved background context, while recognizing the explicit
  Codex branch overlay in `AGENTS.md`;
- `README.md`;
- `docs/standing-orders.md`;
- `docs/processes.md`;
- `docs/kensTodo.md`;
- `docs/claude-todo.md`;
- `docs/audit-control-proposal.md`;
- all relevant subsystem plans for MCP, Darknet, stock, IPvGO, Remote API,
  and Formulas.exe;
- the current branch, its uncommitted changes, and its comparison with main.

Do not treat a document's checkbox, claim, or historical “confirmed” wording
as evidence without inspecting the underlying artifact or live record.

## 3. Required outputs

Produce a report with these sections:

1. Executive status: what is safe to do now, what is blocked, and why.
2. Standing Orders compliance matrix.
3. Directive and document conflicts.
4. Current control coverage and gaps.
5. Proposed control architecture.
6. Concrete implementation instructions for the controls.
7. Ordered work plan that preserves forward progress.
8. Revised Standing Orders, if strengthening is warranted.
9. Independent decision and unresolved uncertainties.

The Standing Orders matrix must use this form:

| Standing order | Observable acceptance test | Enforcement mechanism | Evidence | Status | Owner |
|---|---|---|---|---|---|

At minimum, cover the seven change gates, evidence standards, role
separation, parallel-work rules, documentation requirements, live-validation
requirements, destructive-action boundaries, and the stock-trading rule.

## 4. The auditor must establish the controls

Do not merely recommend a Python auditor or contract. Either provide exact,
implementation-ready instructions for establishing them, or build the
controls yourself in a disjoint, reviewable change set.

If building them, create at minimum:

- a machine-readable directive ledger;
- an append-only approval-record format;
- a single live-artifact manifest;
- `tools/standing_orders_audit.py`;
- fixture tests for the auditor;
- a claim/evidence validator;
- a forbidden-API and unsafe-loop scan;
- source/pull-manifest consistency checks;
- a documented scheduler/heartbeat installation plan;
- a fail-closed promotion-state mechanism for high-risk changes.

Do not silently install launch agents, modify protected branches, send
messages, deploy production code, or run capital-moving actions. Those are
separate approval boundaries. The auditor may create local files and tests
within the approved repository scope.

## 5. Required risk tiers

The controls must distinguish activity by risk.

### Tier 0 — local/read-only progress

File inspection, documentation, local tests, syntax checks, static analysis,
and analysis of already-retrieved telemetry. These should never require human
approval.

### Tier 1 — reversible diagnostic progress

Bounded shadow runs, read-only probes, telemetry pulls, process inspection,
and diagnostic restarts. Permit these when source, timeout, output path, and
rollback are known. Require evidence retrieval after execution.

### Tier 2 — ordinary operating progress

Starting the established MCP baseline, routine crawler operation, and other
documented reversible operations. Require health checks and recovery paths,
not a fresh senior decision each time.

### Tier 3 — high-risk or irreversible action

Production promotion, stock capital deployment, augmentation decisions,
backdoor/stasis expenditure, new always-on automation, or re-enabling a
subsystem after a stability incident. Require explicit scope approval,
independent review, stop conditions, rollback, and retained evidence.

The auditor must identify the minimum tier applicable. It must not elevate a
Tier 0 or Tier 1 task merely because the surrounding project contains risk.

## 6. Enforcement requirements

Separate warnings from blockers:

- `PASS`: proceed;
- `WARN`: proceed and record the debt;
- `REVIEW_REQUIRED`: independent or human judgment needed;
- `BLOCK`: do not perform the specific unsafe action.

Only objective safety, provenance, approval, or rollback failures may produce
`BLOCK`. Documentation imperfections alone should normally produce `WARN`.

The auditor must state who runs and who enforces each control:

| Control point | Runner | Enforcer | Output |
|---|---|---|---|
| Session start | Codex | Auditor status gate | Fresh audit report |
| File/telemetry health | Scheduled local job | Alarm, not silent suppression | Heartbeat/report |
| Commit/merge | Hook and protected CI | Branch protection | Check result bound to commit |
| Live diagnostic | Codex | Source/output/schema gate | Bound run artifact |
| High-risk action | Codex prepares; independent auditor reviews | Ken approves scope | Approval record |
| Production promotion | Independent auditor | Approval/promotion manifest | Signed decision and rollback |

## 7. Progress-preservation requirements

The auditor must always report a next safe action. It must not end with only
“blocked.” Every blocker must include:

- the exact failed condition;
- the smallest corrective action;
- whether useful parallel work remains unblocked;
- the expected evidence that clears it;
- the responsible owner.

When a high-risk path is blocked, the auditor should actively identify useful
Tier 0 or Tier 1 work that can continue. Examples include tests, documentation,
fixture creation, static audits, telemetry tooling, and rollback preparation.

The auditor should prefer a narrow reversible experiment over a broad pause,
and a scoped branch over a mixed working tree. It should never demand a clean
repository as a prerequisite for harmless local analysis; cleanliness becomes
a gate at commit, merge, deployment, or promotion boundaries.

## 8. Standing Orders revision authority

Review `docs/standing-orders.md` for omissions, contradictions, and controls
that are too weak or too broad. Propose strengthened wording where needed.

Any proposed revision must preserve:

- evidence distinctions;
- contract-first work for material changes;
- independent review for consequential promotion;
- explicit approval for capital-moving or irreversible actions;
- Codex's responsibility for documentation and version-control hygiene;
- progress as the primary mandate.

Do not weaken a safety order merely because enforcement is inconvenient. Do
not strengthen an order into a blanket prohibition when a tiered, testable
control would preserve the same safety property.

Each proposed revision must include:

| Current wording | Proposed wording | Reason | New acceptance test | Migration impact |
|---|---|---|---|---|

## 9. Independent-review standard

The auditor must not self-certify its own recommendations as adopted. It must
label each conclusion as fact, requirement, assumption, hypothesis, or
unknown, and distinguish static, local, live, and independent evidence.

For any proposed production or governance change, provide:

- exact files and scope;
- tests and expected results;
- stop conditions;
- rollback;
- evidence-retention path;
- independent decision: `ADOPT`, `KEEP`, `REVISE`, or `REJECT`.

## 10. Final question the auditor must answer

At the end of the review, answer plainly:

> Does this control system make the project more able to make safe progress,
> or does it mainly make the project wait?

If it mainly makes the project wait, revise the design before recommending
adoption.
