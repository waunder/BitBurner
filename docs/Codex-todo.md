# Codex current work ledger

Concise, current list. `STATE.md` at the repo root is the authoritative
session-continuity file (objective/done/next/blockers) — this file mirrors
it with a bit more detail. `docs/claude-todo.md` and the historical audit
reports are evidence/history, not current authority.

The working method is `docs/agent-working-agreement.md`; project-specific
rules (the stop-list, session continuity) are in `AGENTS.md`.

## Now

- [x] **Make XP targeting actually XP-aware.** XP mode now ranks target
  hosts by XP per hack-thread second, rather than money potential, and uses
  the 0.95/0.05 hack/grow split. The change is local-test verified (190/190)
  and needs a live restart/rate comparison.
- [x] **Configuration-validate the landed R8 switch-veto.** Commit `07b216a`
  landed the patch; the local suite passed (148/148), and the connected game
  accepted a bounded `R8_SWITCH_VETO_ENABLED` `0 → 1 → 0` check without
  invariant failures. No qualified target switch occurred, so the live veto
  branch remains unobserved rather than claimed as validated.
- [x] **Enable R8 for ordinary operation.** Explicitly approved on
  2026-08-18; `R8_SWITCH_VETO_ENABLED` is committed as `1` and synced. The
  fresh post-augmentation manager will evaluate it once it has a qualified
  target-switch candidate.
- [ ] **Observe R8 with Formulas.exe available.** The five pre-purchase
  evaluations correctly failed open because the reset had removed the
  program. Formulas.exe is now repurchased and mcp.js restarted; inspect the
  first new qualified switch for finite scores and `available:true`.
- [x] **Switch to XP mode.** Ken requested it on 2026-08-18; the in-game
  `set_objective.js xp` override is active, hot-reloaded without restart, and
  reports about 1,377 XP/s in the current recovery phase. Use
  `set_objective.js clear` to return to the committed money default.
- [x] **Land the real idle-RAM allocation correction.** The
  `core-missing-action-redeploy` worktree—not `pool-invariant`, which only
  muted the alarm—was integrated as `24c9ba0`/`f5a17e6`; 151 local tests
  passed and the connected game restarted cleanly at 99.8% utilization.
- [x] **Assess the two former open worktrees.** `core-missing-action-redeploy`
  was landed as the real correction; `pool-invariant` only suppressed a
  diagnostic and was intentionally left unlanded.
- [ ] **Establish the post-augmentation baseline.** `startup.js` launched
  the supervisor, crawler, manager, HUD, and stats; after the crawler roots
  the first fresh servers, confirm target adoption and worker deployment.
- [x] **Launch the approved adaptive stock trader.** Its first live instance
  started as PID 955 with `trade=1`; the trader and its logic module are now
  part of the Remote API watched set for durable sync.

## Standing operating facts

- `/Users/Shared/BitBurner` is the connector-synced checkout; editing a
  `tools/bb_remote.py::WATCHED_FILES` path can push it into the running
  game.
- Ordinary work (edits, tests, docs, landing tested/flag-gated/reversible
  code, restarts) doesn't need Ken's approval. The full stop-list — the only
  things that do — is in `AGENTS.md`.
- `mcp_stock_trader.js trade=1` is explicitly authorized and live as of
  2026-08-18; the remaining stop-list is in `AGENTS.md`.
