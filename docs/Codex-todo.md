# Codex current work ledger

Concise, current list. `STATE.md` at the repo root is the authoritative
session-continuity file (objective/done/next/blockers) — this file mirrors
it with a bit more detail. `docs/claude-todo.md` and the historical audit
reports are evidence/history, not current authority.

The working method is `docs/agent-working-agreement.md`; project-specific
rules (the stop-list, session continuity) are in `AGENTS.md`.

## Now

- [ ] **Land the R8 switch-veto patch.** Implemented and tested in
  `/private/tmp/bitburner-r8.fyf9mg` (branch `codex/r8-evidence-tail`,
  commit `ff24542`) — merge into this checkout's tracked `mcp.js`/
  `mcp_logic.js`, run the local suite, commit. Flag (`R8_SWITCH_VETO_ENABLED`)
  stays off for the merge itself; enabling it for a bounded live check is
  ordinary work under the new rules, not something to ask about first.
- [ ] **Check the two other open worktrees** — `codex/core-missing-action-
  redeploy` and `codex/pool-invariant` — before assuming R8 is the only
  loose end. `pool-invariant` likely bears on the `poolNotIdle` condition
  noted in `STATE.md`.

## Standing operating facts

- `/Users/Shared/BitBurner` is the connector-synced checkout; editing a
  `tools/bb_remote.py::WATCHED_FILES` path can push it into the running
  game.
- Ordinary work (edits, tests, docs, landing tested/flag-gated/reversible
  code, restarts) doesn't need Ken's approval. The full stop-list — the only
  things that do — is in `AGENTS.md`.
- Do not run, sync, or otherwise activate `mcp_stock_trader.js`. See
  `AGENTS.md`'s stop-list and `STATE.md`'s changelog for why.
