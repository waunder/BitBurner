# Governance control operations

**Status:** implementation-ready local control spine; independent adoption
decision remains in `docs/independent-governance-audit.md`.

This document answers who runs each control, who enforces it, when it runs,
what it emits, and how it fails without turning ordinary work into a queue.
The controls are repository-local and make no Bitburner, connector, branch,
capital, or operating-system change by themselves.

## Control files

| File | Job |
|---|---|
| `docs/directive-ledger.json` | Current machine-readable authority and acceptance tests |
| `docs/approval-records.jsonl` | Append-only Tier 3 approvals; the initialization line grants nothing |
| `docs/approval-records.schema.json` | Exact approval record format |
| `docs/artifact-manifest.json` | One source/pull/prohibited artifact map |
| `docs/claim-evidence.json` | Current typed claims and evidence limits |
| `docs/promotion-state.json` | Fail-closed live state by subsystem |
| `tools/standing_orders_audit.py` | Mechanical evaluator and action gate |
| `tools/test_standing_orders_audit.py` | Fixture tests for the evaluator itself |

`CLAUDE.md` is preserved. The Codex-specific precedence and current operating
overlay live in `AGENTS.md`.

## Risk tiers and normal path

| Tier | Typical work | Default |
|---|---|---|
| 0 | Read/inspect, governance docs, local tests, static analysis, already-pulled telemetry | Proceed; no human approval |
| 1 | Bounded read-only probe/shadow, pull, process inspection, diagnostic restart | Proceed when source, duration, output, stop, rollback, and retrieval gates pass |
| 2 | Established `startup.js` core baseline and other documented reversible operation | Proceed under standing authority with health/recovery evidence |
| 3 | Capital movement, promotion, augmentation choice, expensive Darknet action, always-on re-enable after incident | Fail closed pending scoped approval and independent review |

Important exception: editing a file in `WATCHED_FILES` inside the connected
checkout is deployment-capable, so it is not Tier 0. Do local implementation
in a non-synced worktree. Documentation, tests, and the auditor files in this
change are disjoint from `WATCHED_FILES`.

## Commands

Session start (reports every hold but exits nonzero only for broken global
controls):

```text
python3 tools/standing_orders_audit.py --profile session
```

Auditor fixture tests:

```text
python3 tools/test_standing_orders_audit.py
```

Ask whether a specific action may proceed, always naming the minimum tier:

```text
python3 tools/standing_orders_audit.py --profile action --subsystem mcp-core --tier 2
python3 tools/standing_orders_audit.py --profile action --subsystem formulas-r8 --tier 1
python3 tools/standing_orders_audit.py --profile action --subsystem ipvgo --tier 0
```

`mcp-core` is a declared operator-facing alias of the canonical `core-mcp`
promotion-state ID. Only aliases explicitly listed in promotion state resolve;
all other unknown subsystem names remain fail-closed.

The last command deliberately passes the Tier 0 gate while still reporting
the live IPvGO hold. To request a production promotion:

```text
python3 tools/standing_orders_audit.py --profile promotion --subsystem NAME --tier 3
```

Exit `0` means the requested gate is PASS/WARN, `2` means judgment is still
required, and `3` means the named action is blocked. Portfolio BLOCK in the
text report means one or more narrow holds exist; it does not override a PASS
for unrelated work.

## Runner, enforcer, output

| Control point | Runner | Enforcer | Output / response |
|---|---|---|---|
| Session start | Codex | Auditor gate | Fresh text result; continue Tier 0 regardless of unrelated holds |
| File/telemetry health | Optional scheduled local job | Alarm only | `.audit/heartbeat.json`; never kills or suppresses a process |
| Commit | Codex or local hook | Staging discipline | Fixture tests plus `--profile ci`; scope the staged paths |
| Merge | Hosted CI | Protected-branch required check | Check bound to the commit; repository owner enables branch protection |
| Live diagnostic | Codex prepares | `--profile action` | Bound source/duration/output/rollback decision |
| Tier 3 action | Codex prepares; independent reviewer decides | Ken's append-only approval | Approval ID, limits, stop conditions, rollback, evidence path |
| Production promotion | Independent reviewer | Promotion state plus protected CI | `ADOPT/KEEP/REVISE/REJECT`, exact source, retained evidence |

The auditor never enforces by killing a process, rewriting source, deploying,
or moving money. It enforces by denying the specific requested boundary and
naming the correction. Ken remains the authority for Tier 3 scope; protected
CI is the merge enforcer after the repository owner enables the required
check.

## Append-only approval procedure

1. Codex prepares the exact action, scope, limits, stop conditions, rollback,
   evidence path, and independent decision.
2. Ken approves that exact scope. General enthusiasm or a request to explore
   is not a capital/deployment approval.
3. Codex appends one line conforming to
   `docs/approval-records.schema.json`; prior lines are never edited.
4. A revocation, expiry, consumption, or correction is another record with a
   new ID and `supersedes`; it does not mutate history.
5. `docs/promotion-state.json` references the active approval ID only after
   independent review. The auditor rejects an approved-production state with
   a missing or inactive ID.

## Scheduled heartbeat plan (not installed by this audit)

The reviewed template is
`tools/com.waunder.bitburner-governance-audit.plist.example`. Installation is
an operating-system mutation and therefore remains separate:

1. Review the absolute repository and Python paths in the template.
2. Copy it to `~/Library/LaunchAgents/com.waunder.bitburner-governance-audit.plist`.
3. Bootstrap it with the normal per-user `launchctl` workflow.
4. Confirm `.audit/heartbeat.json` updates and that stdout/stderr are bounded.
5. If it alarms, inspect the JSON. Do not let the job stop Bitburner or alter
   source.
6. Rollback is bootout plus removal of that one plist; repository controls
   remain usable manually.

The job runs every 15 minutes and at login. Its command is read-only except
for replacing the local generated heartbeat/report files. Staleness is an
alarm, never permission to claim PASS.

## CI and branch protection

`.github/workflows/governance-audit.yml` runs the fixture tests and CI profile
on pushes and pull requests. It is only a repository artifact until committed
and pushed; it becomes an enforcement point only after Ken or the repository
owner makes its check required on protected branches. No audit agent may
self-certify that external setting.

At commit/merge/promotion boundaries, review a scoped staged diff. A dirty or
mixed worktree is never a reason to stop harmless Tier 0 analysis. If a
capital-moving source becomes tracked, CI blocks it without an active approval
and approved-production state. Existing disabled legacy hazards remain narrow
action/promotion blocks so governance repair can itself be committed.

## Heartbeat and report retention

The scheduler writes `.audit/heartbeat.json`, `.audit/heartbeat.out`, and
`.audit/heartbeat.err`; `.audit/` is generated and gitignored. Live evidence
belongs at the path declared in `docs/artifact-manifest.json` and must be tied
to source version and run ID in `docs/claim-evidence.json`. A reported user
observation may remain evidence, but it cannot be upgraded to live-confirmed
without the retained artifact.

## Failure and rollback

- Malformed/missing control files: global BLOCK for live boundaries; restore
  the named file. Tier 0 inspection remains open.
- Documentation drift: WARN; fix alongside the next related change.
- Dirty watched source: block execution/promotion of its subsystem, not other
  work; move development to a non-synced worktree and attest source.
- Disabled subsystem: block only its live action; follow its
  `nextSafeAction` and `conditionsToAdvance`.
- False positive in the auditor: add a failing fixture first, correct the
  scanner, and obtain independent review if the change weakens a safety rule.
- Bad governance deployment: revert these disjoint governance files; no game
  process or live source needs a restart because none is in `WATCHED_FILES`.
