# Codex current work ledger

Concise, current list. `STATE.md` at the repo root is the authoritative
session-continuity file (objective/done/next/blockers) — this file mirrors
it with a bit more detail. `docs/claude-todo.md` and the historical audit
reports are evidence/history, not current authority.

The working method is `docs/agent-working-agreement.md`; project-specific
rules (the stop-list, session continuity) are in `AGENTS.md`.

## Now

- [x] **Configuration-validate the landed R8 switch-veto.** Commit `07b216a`
  landed the patch; the local suite passed (148/148), and the connected game
  accepted a bounded `R8_SWITCH_VETO_ENABLED` `0 → 1 → 0` check without
  invariant failures. No qualified target switch occurred, so the live veto
  branch remains unobserved rather than claimed as validated.
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
