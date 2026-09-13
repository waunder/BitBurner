# Codex current work ledger

Concise, current list. `STATE.md` at the repo root is the authoritative
session-continuity file (objective/done/next/blockers) — this file mirrors
it with a bit more detail. `docs/claude-todo.md` and the historical audit
reports are evidence/history, not current authority.

The working method is `docs/agent-working-agreement.md`; project-specific
rules (the stop-list, session continuity) are in `AGENTS.md`.

## Now

- [x] **Full-money scheduler repair deployed:** 119 local/eight browser checks passed; exact five-file Steam readback; `1f5usex` finite workers, reputation retained. Phantasy recovery reached minimum security, then 24 hack threads and maintenance weaken with zero grow/failures. Evidence and limitations: `full-money-harvest.md`.

- [x] **Execute approved 256GB cloud investment:** $14.08m mcp-worker-0 purchased; sharing moved to62threads/254.2GB, reputation preserved, NiteSec3.365rep/sec at H304. Evidence `evidence/reputation-objective/cloud-purchased.json`.

- [x] **Implement reputation objective, 2026-09-12.** Bounded owned sharing, validated disabled policy, objective command, status/HUD and events; 102 local tests pass. Browser test confirms stable single allocation and cleanup on money. Details: `reputation-objective.md`.
- [x] **Steam sharing activation explicitly authorized by Ken, 2026-09-12.** Restriction overridden; source verified, policy enabled, reputation selected, MCP restarted. Explicit-host liveness fix included; 102 tests pass.
- [x] **Measure faction-reputation benefit.** Controlled NiteSec on/off/on at H303: 3.297/2.868/3.297 rep/sec, +14.96%, ~1,544 extra rep/hour; sharing restored. Evidence: `evidence/reputation-objective/steam-impact.json`.
- [ ] **Measure sustained money/XP opportunity cost before expanding sharing.** Current short preparation-phase sample has zero hacking income and is not a fair money baseline.
- [x] **Review scheduler after the changed September 12 game state.** See `scheduler-review-2026-09-12.md` and the accompanying R1–R8 evidence table. H275, XP mode: R8 live-vetoes a 2.87× XP candidate based on money scores. Two worker replacement defects reproduced locally; 90 existing tests pass. Review complete, fixes not implemented.
- [ ] **Next scheduler work:** measured single-target baseline, then two-target pilot using current cloud capacity. Repair mcpMulti lifecycle, host lookups, per-target caps and ownership before launch; update target ranking to model capped harvesting. Read-only assessment: `cloud-multitarget-2026-09-12.md`. R8 XP bypass and worker repairs are now deployed.

- [x] **Make player-time guidance cross-skill but evidence-based.** HUDs now
  prioritize the next discovered normal-server Hacking gate; without one,
  they show live Darknet Charisma as passive growth or explicitly state that
  no physical/crime/faction requirement has been observed, rather than
  guessing a universal training path.

- [x] **Build persistent maintenance stewardship.** The 30-second steward
  keeps a bounded health record, starts the ten-minute cloud contract cycle,
  requests only one cooled-down MCP recovery after sustained staleness, and
  leaves stock, resets, and Darknet untouched. The queue submits one guarded
  supported contract at a time and durably pauses on a rejection or unknown
  type.

- [x] **Show Coding Contract gains in-game.** `cct_hud.js` is a quiet,
  read-only panel over a bounded durable reward ledger; its opening balance
  records the verified twelve accepts while deliberately leaving CSEC
  unconfirmed.

- [x] **Contain the Darknet freeze paths before another live run.** The
  paused default is one gateway manager, one silent phish worker, and no
  propagation; root shard scans are throttled to 60s (credentials) / 15s
  (manager registry). A bounded live re-enable still needs Ken's approval.

- [x] **Silence routine Darknet loot output.** `dnet_loot.js` now keeps
  normal/no-op results in its event shards rather than terminal/log spam,
  while preserving cache and shipping error output.
- [x] **Add a safe Darknet health panel.** `dnet_hud.js` is opt-in and reads
  just the root heartbeat plus compact manager registry every 15 seconds;
  it avoids the scorecard's shard scans and emits no telemetry writes.
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
- [x] **Observe R8 with Formulas.exe available.** On 2026-09-07, run
  `mtrh1gm6-ig7p` emitted finite `available:true` scores, vetoed
  `phantasy → b-and-a` at ratio 0.79943, and allowed it once the ratio reached
  0.80511 (later adopting `b-and-a` at 1.01298). Both paths are now live
  evidenced.
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
