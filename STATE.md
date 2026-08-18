# State

The one durable file for session continuity. Read this first. Format and
purpose are defined in `docs/agent-working-agreement.md`.

## Current objective

Resume real gameplay-progress work now that the governance deadlock
(retired 2026-08-18, see `AGENTS.md`) is cleared. First concrete step: land
the R8 formulas-based switch-veto safeguard, which was fully implemented
and tested but stuck behind a review gate that had no one able to clear it.

## Done

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

## Next

1. Reconnect Bitburner's Remote API to the local daemon on port 12526. The
   daemon was restarted at 2026-08-18 13:58 PDT and is healthy but currently
   reports `connected:false`; its normal manifest sync will then push the
   committed, still-inert R8 source and configuration.
2. Restart `mcp.js` to pick up the inert change, then flip
   `R8_SWITCH_VETO_ENABLED` on for a bounded live check, watch the
   `r8_switch_veto`/`r8_switch_veto_eval` events, and report what happened.
   Restart with the flag back at `0` is the rollback if anything looks off.
3. Separately worth a look: two other in-flight worktrees exist —
   `/private/tmp/bitburner-core.I2zdam` (branch
   `codex/core-missing-action-redeploy`) and
   `/private/tmp/bitburner-pool-invariant` (branch `codex/pool-invariant`).
   The second name lines up with the `poolNotIdle` issue mentioned above and
   hasn't been assessed yet — worth checking before assuming R8 is the only
   loose end.

## Blockers

Bitburner must reconnect its Remote API to the running local daemon on port
12526 before the live R8 validation can begin. The source is committed and
locally tested; no gameplay claim has been made from the unavailable link.

## Changelog

- **2026-08-18** — Governance apparatus retired (see Done). Confirmed via
  direct inspection (not just the plan doc) that the R8 veto patch actually
  compiles and its tests actually pass.
- **2026-08-18** — Landed R8 switch-veto as `07b216a`; `node --check` for
  both touched scripts and `node --test *.test.js` passed (148/148). Replaced
  a stalled Remote API daemon; the fresh daemon is awaiting a game connection.
- **2026-08-16** — Incident: a Ken-supplied process list showed
  `mcp_stock_trader.js` running with `trade=1` before a restart — the
  standing read-only-stock-trading rule was crossed operationally at least
  once. No confirmed order execution. The file remains present (untracked)
  as evidence; running or syncing it stays off-limits without Ken's
  explicit capital-deployment go-ahead (see `AGENTS.md`'s stop-list).
- **Earlier** — IPvGO and faction-share (`share_deploy.js`) both had
  stability incidents (game unresponsiveness); both stay off pending a
  root-cause understanding, per the stop-list.
