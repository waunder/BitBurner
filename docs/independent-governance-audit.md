# Independent project-wide governance audit

**Date:** 2026-08-15
**Role:** elevated independent auditor
**Decision on the current governance system:** **REVISE**
**R8 disposition:** **KEEP shadow-only, paused at the evidence gate**
**Primary mandate:** progress through safe, reversible, evidence-producing work

## Scope and evidence boundary

This is a project-wide governance review. The earlier
`docs/independent-review-r8-audit.md` was reviewed only as an appendix and
evidence source; its R8 findings did not define this audit's scope.

The reviewed governance corpus was `AGENTS.md`, preserved `CLAUDE.md`,
`README.md`, `docs/standing-orders.md`, `docs/processes.md`,
`docs/kensTodo.md`, `docs/claude-todo.md`,
`docs/audit-control-proposal.md`, `docs/process-backlog.md`, the status
dashboard, both 2026-08-07 audits, and the approved elevated-auditor brief.
The subsystem corpus included the MCP mechanics/strategy, all three Darknet
plans, both stock plans, the IPvGO strategy, both Remote API plans/logs, and
the complete Formulas contract, review plan, test plan, differential report,
senior review, next-session handoff, and R8 audit. Source inspection covered
the startup, Remote API manifests, R8 monitor, stock trader, share worker and
deployer, IPvGO player/HUD, and repository-wide capital-API and infinite-loop
searches.

The branch comparison was performed against local `main`:

- current branch: `codex/codex-work-2026-08-14` at
  `5af5055fd89c53020656f65aeb437c7015b2924c`;
- local/main: `f54ca829798c4b25c2bbb1b26ac9e56c197c3c67`;
- relationship: 29 commits ahead, 0 behind, 38 changed tracked paths between
  `main...HEAD`;
- working state: mixed tracked production changes, governance changes, and
  untracked artifacts, including an untracked capital-moving trader;
- `CLAUDE.md`: unchanged from `main`, SHA-256
  `9b7e26cdc794a057b50ae96cfea0da6aff3f1bd4cf12261cf097d33b9a381478`.

No game process was started, stopped, deployed, restarted, or promoted by this
audit. No capital was moved. Existing local telemetry was inspected, but no
new live behavioral claim is made from it. Evidence labels below use the
Standing Orders categories: **static**, **local**, **live**, **telemetry**,
**exploratory observation**, and **independent**. Conclusions are labeled
**fact**, **requirement**, **assumption**, **hypothesis**, or **unknown** where
the distinction matters.

## 1. Executive status

The project is not globally blocked. The established core MCP baseline and
all genuinely local work can continue. The unsafe actions are narrow and now
have machine-readable boundaries.

| Activity | Tier | Gate | Reason and next safe action |
|---|---:|---|---|
| Read/inspect, governance docs, local tests, static analysis, already-pulled telemetry | 0 | **PASS** | No approval. Continue even when another subsystem is held. |
| Local source implementation in a non-synced worktree | 0 | **PASS** | The connected checkout is deployment-capable; isolate production-source edits. |
| `run startup.js` established core set | 2 | **PASS** | Static inspection confirms exactly supervisor, crawler, MCP, MCP HUD, and stats; none of the held subsystems is listed. Preserve evidence before a diagnostic restart and check health afterward. |
| Routine Remote API read-only status/pull | 1 | **PASS with provenance check** | Local self-test passes. The auditor did not inspect current connector/game state. Pulling evidence is reversible; source push still needs an action gate. |
| R8 calculator/tests/report analysis | 0 | **PASS** | Production remains untouched. Continue local work. |
| Another R8 live shadow run | 1 | **BLOCK: formulas-r8 only** | Source is dirty and explicit-push-only, `openTail` is absent, and the reported output is absent locally. First retrieve the existing output and implement/test tail opening locally. |
| R8 production scorer integration | 3 | **BLOCK** | No promotion evidence or approval; prior reviews explicitly withheld production integration. |
| Read-only stock mechanics analysis | 0 | **PASS** | No market process is required. |
| Stock panel live run | 1 | **BLOCK by current directive** | Ken chose to avoid the stock subsystem during the stability baseline. Continue local analysis. |
| `mcp_stock_trader.js` sync/run/commit for promotion/capital use | 3 | **BLOCK** | Static source contains `buyStock` and `sellStock`; no approval exists. Keep it unsynced and unexecuted pending a separate cleanup or approval decision. |
| IPvGO local tests/profiling in a non-synced worktree | 0 | **PASS** | The live hold does not block local diagnosis. |
| IPvGO player or HUD re-enable | 3 | **BLOCK** | Repeated responsiveness incidents, dirty synced source, and no approved containment canary. |
| Darknet static work/historical telemetry review | 0 | **PASS** | Current hold is live-only. |
| Darknet start/restart | 2/3 | **BLOCK by current directive** | Ken explicitly chose not to start it. Reconcile the current entry point and rollback before asking to lift the hold. |
| Faction-share local fix/test design | 0 | **PASS** | Continue locally without using game RAM. |
| Faction-share execution | 3 after incident | **BLOCK** | The dirty local `scripts/share.js` now has an explicit one-second cooldown, but its exact live identity, focused regression evidence, bounded canary, and re-enable approval are absent. Attest/test the fix, then use a bounded approved canary. |
| Governance commit/CI preparation | 0 | **PASS** | Auditor fixtures and CI profile pass. Scope staging at the commit boundary. |
| Merge to protected `main`, heartbeat installation, or branch-protection change | 3/external | **NOT PERFORMED** | These are separate authority boundaries. Ken/repository owner enables them after review. |

Mechanical session result after the controls were built:

```text
gateStatus=PASS
portfolioStatus=BLOCK (scoped holds only)
WARN=1, REVIEW_REQUIRED=4, BLOCK=3
```

The three blockers are stock-trader capital calls, R8's missing automatic
tail, and R8's unretrieved output. The four review findings are dirty source
identity for IPvGO, R8, the untracked trader, and faction share. None applies
to the core MCP baseline.

**Independent QA correction:** the first control draft recognized only the
canonical `core-mcp` ID, so the reasonable documented command using
`--subsystem mcp-core` failed as unknown. That was an acceptance failure
against progress preservation. `mcp-core` is now an explicit promotion-state
alias, the directive scope includes both names, the resolver canonicalizes
only declared aliases, and a regression fixture proves `mcp-core` passes while
an actually unknown name still fails closed. Final QA returned gate **PASS**
with exit `0` for
`python3 tools/standing_orders_audit.py --profile action --subsystem mcp-core --tier 2`,
while the otherwise identical `another-core` control returned
`unknown-subsystem`, gate **BLOCK**, and exit `3`.

## 2. Standing Orders compliance matrix

Status in this matrix is scoped. **BLOCK** means do not cross the named live or
promotion boundary; it does not stop Tier 0 or unrelated established work.

| Standing order | Observable acceptance test | Enforcement mechanism | Evidence | Status | Owner |
|---|---|---|---|---|---|
| Primary mandate: reliable progress | Tier 0 gate passes despite every live hold; every blocker returns correction, parallel work, evidence, owner | `GOV-PROGRESS-PRIMARY`; profile-specific exit logic | 17 auditor fixtures; IPvGO Tier 0 gate PASS while portfolio reports holds (**local**) | **PASS** under new controls | Codex |
| Gate 1 — problem understood | Objective, scope, constraints, unknowns, evidence class, and minimum tier exist before material work | Contract/claim records; independent review | Strong R8 and subsystem research; current-state claims were previously scattered (**static**) | **WARN**: good analysis, weak current-state consolidation before this audit | Senior lead/documenter |
| Gate 2 — contract approved | Material implementation cites an approved behavioral contract and authority record | Directive ledger; approval ledger; promotion state | R8 contract exists; stock trader and share deployment crossed/approached boundaries without durable authority (**static + exploratory**) | **REVIEW_REQUIRED** for affected artifacts | Senior lead / Ken for Tier 3 |
| Gate 3 — tests designed | Every acceptance criterion maps to local, integration, or live-only check | Test plans, traceability, CI | R8 test plan is strong; 144 Node tests pass; share's cooldown is present locally but lacks focused worker/canary tests (**local**) | **WARN**: broad coverage, specific incident gaps | Tester |
| Gate 4 — implementation complete | Implementation matches contract; deviations are recorded before promotion | Scoped diff review; claim registry; promotion state | Dirty R8/IPvGO/share source and the quarantined trader are not promotion-identifiable (**local/static**) | **REVIEW_REQUIRED** for those subsystems | Developer + reviewer |
| Gate 5 — local evidence complete | Relevant unit/static/regression tests and auditor fixtures pass | Local commands and CI workflow | 144/144 Node tests, 17/17 auditor tests, Remote API self-test, JSON/plist/diff checks all pass (**local**) | **PASS** for local control implementation; not live proof | Tester |
| Gate 6 — live validation approved | Exact source, bounded run, output, stop, rollback, owner, and approval are present | Action gate; promotion state; approval ledger | Core has standing Tier 2 authority; held subsystems fail their scoped action gates (**static/local**) | **BLOCK** only for R8/stock/IPvGO/Darknet/share live actions | Independent reviewer + Ken where required |
| Gate 7 — outcome recorded | Run artifact is retrieved, source/run attested, result and remaining unknowns recorded | Claim/evidence validator; artifact manifest | User reports R8 text exists in game, but it is absent locally; incident observations lack full run packages (**exploratory + local**) | **REVIEW_REQUIRED** | Codex + reviewer |
| Evidence standards | Every current claim labels classification/evidence and states what it proves/does not prove; `live-confirmed` requires retained attestation | `docs/claim-evidence.json`; validator | Current registry passes; historical prose contains stale “live” claims now bannered as history (**static**) | **PASS** for registry, **WARN** for remaining historical prose debt | Codex |
| Role separation | Consequential promotion is reviewed by a role independent of implementer; auditor cannot mark its own controls adopted | Promotion/approval records; protected review | Prior R8 audit was independent but too narrow; this auditor built the controls and therefore does not self-adopt them (**independent**) | **REVIEW_REQUIRED** until Ken adopts and external enforcement is enabled | Ken / independent reviewer |
| Parallel-work rules | Disjoint owners/paths; held subsystem still returns useful parallel work; shared files are not overwritten | Scoped findings; non-synced worktree rule | Action gates preserve Tier 0 and core work (**local**) | **PASS** under new architecture | Senior lead / Codex |
| Documentation current with behavior | Current permission banner and machine state override historical launch prose; Ken's list contains only actual asks | AGENTS overlay; process banners; doc WARN checks | Stale share/Darknet asks and dashboard “live” labels were corrected; historical files remain intentionally verbose (**static**) | **WARN**, non-blocking debt | Codex |
| Live claims are not inferred from local tests | `live-confirmed` claim has sourceVersion, observedAt, runId, and retained artifact | Claim validator and promotion gate | No unsupported current claim is labeled live-confirmed; R8 remains reported-not-retrieved (**local**) | **PASS** for claim discipline; R8 promotion **BLOCK** | Codex / reviewer |
| Destructive and irreversible actions have approval/rollback | Tier 3 record names limits, stop, rollback, evidence, independent decision; unknown action fails closed | Append-only approval ledger; promotion state | Ledger contains only a non-authorizing initialization record; startup's broad `killall` is an explicitly established Tier 2 recovery operation (**static**) | **PASS** for fail-closed control; no Tier 3 action approved | Ken + independent reviewer |
| Stock trading remains read-only without explicit approval | Promotable source has no capital API, or exact source has active approval plus approved-production state | Capital-API scan; CI/action/promotion gates | `mcp_stock_trader.js` has `buyStock`/`sellStock`; no approval; prior `trade=1` process reported (**static + exploratory**) | **BLOCK: stock-trader only** | Ken |
| Synced source has reproducible identity | Dirty `WATCHED_FILES` source cannot be restarted/promoted as though it were Tier 0 | Dirty-source scan; artifact manifest; non-synced worktree | `ipvgo_logic.js` is dirty and watched; R8 source is dirty/explicit-push-only (**local**) | **REVIEW_REQUIRED** for affected live actions | Codex |

## 3. Directive and document conflicts

| Conflict | Evidence and judgment | Resolution / remaining status |
|---|---|---|
| `CLAUDE.md` preservation versus Codex control | Ken explicitly approved preserving Claude's environment while overriding it for Codex (**requirement**) | `AGENTS.md` now contains the explicit Codex branch overlay; `CLAUDE.md` is untouched. **Resolved for Codex.** |
| Auditor brief still said “Draft” after dispatch | User assignment explicitly approved and dispatched it (**requirement**) | Brief status corrected to approved. **Resolved.** |
| Progress mandate versus heavyweight seven-gate reading | Standing Orders could be read as requiring a full contract queue for trivial work (**static**) | Tier 0/1/2/3 architecture makes gates proportional. **Resolved in controls; Standing Order wording revision still needs Ken's adoption.** |
| Current stock hold versus strategy/process launch prose | Strategy said trader was requested and process doc advertised `trade=1`; AGENTS forbids adding capital calls; trader contains them (**static**) | Strategy/processes bannered; trader listed prohibited/quarantined; action gate blocks it. **Live boundary resolved; artifact disposition still requires Ken.** |
| Current no-share directive versus `kensTodo` launch ask | `kensTodo` asked Ken to run balanced share; user later said not to share; worker has no explicit sleep (**static + requirement**) | Ask cancelled; processes/dashboard/control state corrected. **Execution remains blocked pending containment.** |
| IPvGO hold versus “live” dashboard/next-step prose | Repeated unresponsiveness was reported while strategy/dashboard invited continued play (**exploratory + static**) | Current banner and promotion state override history; dashboard labels it historical/off. **Execution remains blocked.** |
| Darknet hold versus pending Phase 3b check and live architecture prose | User explicitly chose not to start Darknet (**requirement**) | Ken task cancelled; strategy bannered as historical capability. **Execution remains blocked by directive, local work open.** |
| R8 cumulative/visible evidence requirement versus actual source | Append+print correction exists, but no `openTail`; local output is missing (**static/local**) | Manifest, claim, and promotion state now encode the defect. **Another run remains blocked; local repair/retrieval open.** |
| Remote API is complete versus prototype-era docs | Local self-test and historical live records support both push/pull; older docs said pull was mock-only (**local + historical live evidence**) | AGENTS/README/process map/migration doc updated or bannered. **Resolved for current workflow.** |
| `docs/Codex-todo.md` referenced but absent | AGENTS named a nonexistent current ledger (**static**) | Concise Codex ledger created; Claude's long ledger preserved as history. **Resolved.** |
| Broad “push main at discretion” versus this task's protected-branch restriction | Task-specific instruction is higher authority (**requirement**) | Overlay explicitly narrows the default; no commit/push was made. **Resolved for this audit.** |

The likely explanation for the still-missing local R8 output is a
**hypothesis**, not a fact: `mcp_formulas_shadow.txt` was added to the local
`PULL_FILES` only in an uncommitted `tools/bb_remote.py` change, while a
long-running daemon keeps the list loaded from its start. Reopening the game
connector would not reload that Python process. An explicit read-only
`ctl-get /mcp_formulas_shadow.txt` can discriminate this hypothesis without
rerunning the game script; daemon restart is not required for the first check
and was not authorized in this audit.

## 4. Current control coverage and gaps

### Established in this audit

| Required control | Artifact | Result |
|---|---|---|
| Machine-readable directive ledger | `docs/directive-ledger.json` | Active authority, scope, owner, test, block scope, and next-safe action |
| Append-only approval format | `docs/approval-records.schema.json`, `docs/approval-records.jsonl` | Exact Tier 3 record; initial line grants no authority; committed prefix check |
| Single live-artifact manifest | `docs/artifact-manifest.json` | Exact watched/pulled/explicit/prohibited sets plus key producers/consumers |
| Mechanical auditor | `tools/standing_orders_audit.py` | Session, heartbeat, CI, action, and promotion profiles; scoped exit codes |
| Auditor fixture tests | `tools/test_standing_orders_audit.py` | 17 tests for capital APIs, unsafe loops, manifests, claims, approvals, fail-closed state, Tier 0, and the `mcp-core` alias |
| Claim/evidence validator | auditor + `docs/claim-evidence.json` | Typed claims; live attestation requirements; proof limits |
| Forbidden API scan | auditor | Finds capital calls; blocks tracked CI or exact action/promotion without approval |
| Unsafe loop scan | auditor | Generic asynchronous boundary check plus explicit `ns.share` cooldown rule |
| Source/pull consistency | auditor | Exact comparison with `WATCHED_FILES`/`PULL_FILES`; direction and ignore checks |
| Scheduler/heartbeat plan | operations doc + reviewed plist template | 15-minute alarm plan; deliberately not installed |
| Fail-closed promotion state | `docs/promotion-state.json` | Unknown/Tier 3 deny; core baseline allowed; current holds narrow |
| Commit/merge check definition | `.github/workflows/governance-audit.yml` | Fixture + CI profile; not externally enforced until pushed/protected |
| Codex/Claude boundary | `AGENTS.md` overlay | Codex authority explicit; Claude file preserved |

### Residual gaps

1. **External enforcers are not yet active (fact, local).** The workflow file
   is uncommitted and branch protection was not changed. The heartbeat plist
   is a template and was not installed. This is correct for the audit's
   authority boundary, but Ken/repository owner must adopt them before they are
   organizational enforcement rather than implementation-ready controls.
2. **The Remote API daemon does not consult promotion state before pushing a
   watched file (fact, static).** The current mitigation is a non-synced
   worktree and dirty-source action gate. A later, separately reviewed support
   change should add a pre-push policy callback or explicit promotion queue.
   Do not alter the live daemon casually; that is a Tier 2 support change with
   rollback and self-tests.
3. **Current process absence is not mechanically observed (unknown).** The
   auditor intentionally makes no live connection. User reports all scripts
   were killed on restart and later approved the core baseline, but this audit
   does not claim the present `ps` state. A future read-only process snapshot
   may be attached to heartbeat evidence without granting kill authority.
4. **R8's existing output is not retained locally (fact, local).** This is the
   immediate evidence gap. Do not solve it by generating another run.
5. **The static loop scan is conservative (fact).** It is fixture-tested, but
   it is not a full JavaScript parser. An uncertain hit should remain
   REVIEW_REQUIRED unless the active directive—such as the explicit share
   cooldown—makes the result objective.
6. **Approval records are repository-authenticated, not cryptographically
   signed (fact).** For this private hobby repository, append-only history plus
   protected review is proportionate. Cryptographic signing would add more
   ceremony than safety now.
7. **Historical documents remain long and internally time-layered (fact).**
   Current banners prevent them from granting permission. Further archival
   cleanup is WARN-level debt, not a reason to defer productive work.
8. **Role independence is episodic (fact).** The same primary agent often
   documents, implements, and tests. Consequential promotion still needs an
   independent reviewer; low-risk work does not need artificial role theater.

## 5. Progress-enabling tiered control architecture

The architecture separates the portfolio report from the requested gate. A
held Tier 3 subsystem can make `portfolioStatus=BLOCK` while a Tier 0 or core
MCP request returns `gateStatus=PASS` and exit 0.

| Tier | Admission rule | Evidence at exit | Human decision |
|---:|---|---|---|
| 0 | Always admit local/read-only work; production-source edits must occur outside the connector-synced checkout | Local test/static result and any debt warning | None |
| 1 | Admit bounded diagnostic when source identity, duration, output, retrieval, stop, and rollback are known | Retrieved run artifact tied to source/run; explicit limits | Only if a current directive/incident hold says so |
| 2 | Admit documented established operation when launch set, health check, and recovery are known | Fresh health/recovery evidence | Standing authority; no repeated permission request |
| 3 | Deny by default; require exact scope, limits, independent decision, stop, rollback, and retained evidence | Append-only approval + approved promotion state + commit-bound result | Ken approves scope; independent reviewer decides promotion |

Enforcement is intentionally split:

| Control point | Runner | Enforcer | Output |
|---|---|---|---|
| Session start | Codex | Auditor status gate | Fresh report; unrelated holds do not fail the session |
| File/telemetry health | Scheduled local job, if installed | Alarm only | `.audit/heartbeat.json`; never kills/suppresses |
| Commit | Codex/local hook | Staging discipline and auditor CI profile | Scoped check result |
| Merge | Hosted workflow | Protected-branch required check, after owner enables it | Result bound to commit |
| Live diagnostic | Codex | Source/output/schema action gate | Bound run decision and retained artifact |
| High-risk action | Codex prepares; independent auditor reviews | Ken approves exact scope | Append-only approval record |
| Production promotion | Independent reviewer | Approval + promotion manifest + protected CI | Signed-off decision and rollback |

The auditor has no kill, deploy, restart, capital, or source-rewrite power. Its
enforcement mechanism is denial of the specific requested boundary. This
keeps the auditor from becoming another production controller.

## 6. Concrete instructions to establish and operate the controls

The complete operational contract is
`docs/governance-control-operations.md`. The implementation sequence is:

1. **Ken reviews this report and decides whether to adopt the control spine.**
   This auditor's `REVISE` decision is not self-adoption.
2. **Codex runs session and fixture gates at each work session:**

   ```text
   python3 tools/test_standing_orders_audit.py
   python3 tools/standing_orders_audit.py --profile session
   ```

3. **Codex identifies the minimum tier and exact subsystem before live work:**

   ```text
   python3 tools/standing_orders_audit.py --profile action --subsystem mcp-core --tier 2
   python3 tools/standing_orders_audit.py --profile action --subsystem formulas-r8 --tier 1
   ```

   Exit 0 admits the requested boundary. Exit 2 needs judgment. Exit 3 denies
   only that action and prints the correction/evidence/owner/parallel path.
4. **Production implementation leaves the synced checkout.** Codex creates a
   task branch in a non-synced worktree, for example:

   ```text
   git worktree add /Users/Shared/BitBurner-worktrees/TASK -b codex/TASK HEAD
   ```

   This is an example path and must be created only when the task is approved;
   the audit did not create it. Local tests run there. Promotion returns one
   exact commit or source hash to the synced checkout after its gate passes.
5. **Tier 3 authority is appended, never edited.** Codex prepares the record
   fields from `docs/approval-records.schema.json`; Ken approves exact scope;
   Codex appends one JSON line; the independent reviewer decides; promotion
   state references the active approval ID. Revocation/correction is a new
   superseding record.
6. **CI is activated after review.** Commit the disjoint governance paths,
   push through the normal non-protected path, then Ken/repository owner marks
   `governance-audit / standing-orders` required on protected branches. The
   audit did neither the push nor the external setting.
7. **Heartbeat is optional and alarm-only.** Review
   `tools/com.waunder.bitburner-governance-audit.plist.example`, copy it to the
   per-user LaunchAgents directory, bootstrap it, and confirm the generated
   `.audit/heartbeat.json`. Rollback is bootout plus deletion of that one
   plist. No heartbeat may kill a game process or promote source.
8. **A source identity crosses live only once.** Record a commit or SHA-256,
   verify the game-side source through the Remote API, execute the bounded
   action, pull the output, and add the claim/evidence record. A reconnect or
   restart alone is not source proof.

Stop conditions for the control system itself are: it blocks Tier 0, requires
Ken to repeat a standing Tier 2 decision, emits a global block for mere docs
debt, silently changes the game, or cannot name parallel useful work. Any of
those requires reverting/revising the control implementation before adoption.

Rollback is simple because the audit artifacts are disjoint from game source:
revert the governance files and disable the optional CI/heartbeat. No
Bitburner restart is required. Existing production source was not changed by
the auditor.

## 7. Ordered work plan that preserves forward progress

1. **Continue the core MCP baseline now.** It passes Tier 2. Continue manual
   reputation work and augmentation purchases under Ken's existing choices;
   do not start the held helper subsystems.
2. **Adopt or revise the control spine.** Ken reviews this report. While that
   decision is pending, Tier 0 and established core work still proceed.
3. **Scope the working tree at the next boundary.** Preserve every existing
   user change. Stage governance controls separately from R8, Darknet/share,
   IPvGO, and the quarantined stock artifact. No protected branch change is
   authorized by this audit.
4. **Close R8's existing evidence gap before another run.** First use the
   read-only Remote API to inspect/retrieve the already-existing
   `/mcp_formulas_shadow.txt`. Parse line count/schema and record source/run
   uncertainty. In parallel, implement and test explicit tail opening in a
   non-synced worktree. Then attest exact source and rerun the Tier 1 gate.
5. **Resume the highest-value MCP work that passes its own gate.** R8 need not
   remain the work focus if another MCP improvement has higher expected value;
   governance should not make R8 a compulsory queue.
6. **Keep the trader quarantined.** Ask Ken for a separate disposition only
   when useful: delete/move it, preserve it as a non-promotable design sample,
   or begin a formal Tier 3 capital proposal. Do not treat accumulated money
   as implied approval to deploy it.
7. **Finish validating share only if reputation acceleration again matters.**
   Review and attest the dirty local one-second cooldown, add focused tests,
   and design one bounded canary and stop path. The live hold remains until
   Ken approves re-enable after the incident.
8. **Treat IPvGO as an incident-containment project, not routine tuning.** Keep
   local profiling open; do not run player or HUD until CPU/RAM/move-time,
   duplicate prevention, stop conditions, and source identity are reviewed.
9. **Leave Darknet off until Ken changes the objective.** Local plan cleanup
   can continue, but the next live request must name the current root/manager
   architecture and Darknet-only rollback, not the superseded deployer path.
10. **After controls prove useful for several sessions, reduce ceremony.**
    Remove checks that only duplicate evidence; strengthen only controls that
    catch a real failure. The success metric is fewer repeated runs and faster
    safe progress, not more governance artifacts.

## 8. Proposed strengthened Standing Orders

`docs/standing-orders.md` was not modified by the auditor. The following
revisions are warranted but remain proposed until Ken adopts them.

| Current wording | Proposed wording | Reason | New acceptance test | Migration impact |
|---|---|---|---|---|
| Team exists to produce reliable changes | **Primary mandate is progress: safe forward motion, useful evidence, reversible decisions, compounding capability. Governance that mainly causes waiting must be revised.** | Progress was understood but not operative when process expanded | Tier 0 and standing Tier 2 gates pass despite unrelated holds | Add opening paragraph; no existing safety weakened |
| “Work contract-first” for the workflow generally | **Use a full behavioral contract for material behavior/risk changes. Tier 0 inspection and trivial reversible maintenance may use a one-line objective/acceptance note.** | Avoids making harmless work a permission queue | Auditor never requests approval for Tier 0 | Existing major contracts remain; low-risk work gets lighter |
| No formal risk tiers | **Classify the minimum tier 0–3 using the definitions in the approved brief; never elevate work merely because its subsystem is risky.** | Risk was being inherited too broadly | Every live gate names subsystem and tier | Add tier to plans/action records |
| Seven gates apply without explicit fast paths | **Gates are proportional: Tier 0 may combine 1–5 locally; Tier 1 needs source/output/stop/rollback; Tier 2 uses standing operation plus health; Tier 3 requires every gate and approval.** | Preserves intent without serial role theater | Core startup passes without fresh lead approval; Tier 3 cannot skip a gate | Existing gates retained and mapped |
| Evidence types are distinguished | **A `live-confirmed` current claim must retain source identity, observed time, run ID, retrievable artifact, proof limit, and reviewer where consequential. User report remains exploratory until retrieved.** | R8 repeatedly “completed” without reviewable evidence | Claim validator rejects unsupported live-confirmed status | Add claim registry for current claims only |
| Destructive/capital action needs approval | **Tier 3 approval is append-only and names exact source/action, scope, limits, expiry, stop, rollback, evidence path, independent decision, and supersession. Missing data fails closed.** | “Explicit approval” was not durable or machine-checkable | Promotion references an active valid approval ID | Introduce approval ledger; no retroactive approvals fabricated |
| No directive precedence/supersession protocol | **Latest explicit owner directive supersedes lower repository prose; active machine ledger records source, scope, owner, supersedes, expiry, acceptance, and next-safe action. Conflicts block only the affected live action.** | Historical instructions kept regaining authority | Unique directive IDs; every state authority resolves | Populate current ledger; historical docs remain evidence |
| Local work and deployment boundary assumed separate | **In a connector-synced checkout, editing a watched source is deployment-capable and not Tier 0. Develop locally in a non-synced worktree; promote an attested source.** | Auto-push collapsed implementation and deployment gates | Dirty watched source blocks only its subsystem restart/promotion | Change Codex workflow; no user routine added |
| Assertions/failures should surface visibly | **Unexpected failures must reach a visible channel and retained evidence; an evidence-producing script must prove its output path and the reader's channel before the run counts.** | R8 wrote data but remained operationally inconclusive | Output exists, is cumulative/bounded, visible as promised, retrieved, parsed | Add channel fixture and live retrieval gate |
| No status/block vocabulary | **Use PASS/WARN/REVIEW_REQUIRED/BLOCK. Docs debt normally WARN. Only objective safety, provenance, authority, or rollback failure may BLOCK.** | “Audit concern” had become indistinguishable from stop authority | Every BLOCK cites an objective failed condition | Update reports and tooling |
| Blocker can end at “do not proceed” | **Every blocker gives smallest correction, parallel safe work, expected clearing evidence, and owner.** | Prevents governance dead ends | Finding schema enforces all fields | Existing reviews become more actionable |
| Role separation is conceptual | **Independent review is mandatory for consequential promotion, not every local step. The builder cannot mark its own control/recommendation adopted.** | Real independence where it matters; less artificial handoff | Tier 3 state includes independent decision; Tier 0 has no reviewer queue | External reviewer/Ken needed only at promotion/adoption |
| Parallel work mentions shared-file ownership | **A held subsystem must not stop disjoint Tier 0 or established operation; connector-synced source requires a non-synced worktree owner.** | Current mixed branch made local edits deployment-capable | Action gate returns PASS for unrelated scope | Use scoped worktrees/staging at boundaries |
| Documentation must be current | **Current machine state and a short banner outrank historical prose. Stale docs are WARN unless they create unsafe launch authority; then correct the banner/state before live action.** | Avoids both stale hazards and documentation paralysis | Auditor distinguishes docs WARN from unsafe action BLOCK | Keep history; add current banners |
| Completion includes live validation where required | **A live diagnostic is complete only after retrieval and outcome recording. A run ending or an in-game file existing is not completion by itself.** | Direct lesson from repeated R8 runs | Gate 7 requires retained artifact and claim update | Existing incomplete runs become reported, not falsely failed |
| No waiver format | **An exception is a new scoped, expiring approval record; it never edits history or silently disables a scanner.** | Allows necessary exceptions without weakening the rule | Auditor resolves active scope/expiry/supersession | Adds controlled escape hatch |
| No runner/enforcer schedule | **Session gate is run by Codex; heartbeat alarms locally; CI enforces commit/merge after owner enables protection; Ken enforces Tier 3 scope; independent reviewer controls promotion.** | Answers who runs and who enforces | Each control has runner, enforcer, output | Adopt operations document; optional heartbeat |
| Stock rule lives mainly in AGENTS/strategy | **No capital-moving stock source may be synced, executed, committed for promotion, or promoted without a Tier 3 record naming exact source and limits. Read-only analysis remains Tier 0.** | The trader crossed a boundary despite clear prose | Forbidden API scan + approval/promotion state | Quarantine current artifact; no capital action |

## 9. Independent decision and unresolved uncertainties

### Decision

**REVISE.** The pre-audit governance model had strong principles and strong
technical evidence practices, but it lacked durable authority, proportional
risk tiers, runners/enforcers, source-deployment separation, and a mechanical
promotion boundary. That gap allowed a capital-moving trader to appear and run
despite an explicit read-only order, allowed stale launch asks to survive
later holds, and allowed R8 to be rerun repeatedly without closing its evidence
channel.

The new control spine is implementation-ready and its local behavior is
verified, but this auditor does not mark its own work adopted. Ken should
adopt it, revise it, or reject it. External enforcement remains inactive until
the CI check/branch protection and optional heartbeat are separately enabled.

Subsystem decisions:

- **Core MCP: KEEP.** Standing Tier 2 baseline is statically within scope.
- **R8: KEEP shadow-only, paused.** Its technical hypothesis remains valuable;
  retrieve existing evidence and fix the tail before another run.
- **Stock trader: REJECT for execution/promotion now.** Preserve only as
  quarantined local material until Ken decides disposition.
- **IPvGO: KEEP disabled after incident.** Local containment work may proceed.
- **Faction share: KEEP disabled after incident.** The cooldown is present in
  dirty local source; attestation and focused test work may proceed if it
  becomes valuable.
- **Darknet: KEEP disabled by current directive.** This is an objective choice,
  not a claim that its current architecture is defective.

### Conclusions by epistemic type

- **Fact / static:** `startup.js` contains only the five approved core files.
- **Fact / static:** the stock trader contains `buyStock` and `sellStock`.
- **Fact / static:** the dirty local share loop now has an explicit
  `await ns.sleep(POLL_MS)` cooldown; this does not establish which version,
  if any, is present in the game or prove the incident resolved.
- **Fact / static:** the R8 source appends/prints each record but does not open
  a tail.
- **Fact / local:** `mcp_formulas_shadow.txt` is absent locally; 144 Node tests,
  17 auditor fixtures, Remote API self-test, plist, JSON, diff, CI, session,
  core, and Tier 0 gates pass.
- **Fact / local:** the branch is 29 commits ahead and the working tree is
  mixed; this is a boundary concern, not a Tier 0 blocker.
- **Requirement:** core may operate; stock/IPvGO/Darknet/share remain off;
  R8 remains production-inert and paused pending governance/evidence repair.
- **Hypothesis:** the running Remote API daemon may predate the newly added R8
  pull-manifest entry, explaining why a game-side file did not land locally.
- **Unknown:** exact current game process list; exact game-side R8 source/hash;
  contents/sample count of the R8 output; whether any stock order executed;
  unique root cause of each game freeze; whether Formulas.exe persists after
  augmentation; whether hosted branch protection currently exists.

### Final required question

**Does this control system make the project more able to make safe progress,
or mainly make it wait?**

It makes the project more able to make safe progress. Tier 0 is always open,
the established core baseline passes without renewed permission, warnings do
not masquerade as blockers, and every live hold is scoped with a concrete
clearing path. If future use turns the system into a general permission queue,
that is a failed acceptance test and the controls must be revised rather than
allowed to displace the primary mandate.
