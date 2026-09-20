# BitBurner — Working Guide

This is a one-person hobby farm. Keep this file to live, non-negotiable
operating facts; detailed design, incidents, and history belong in `docs/`.
Git history preserves the previous long-form guide (retired 2026-09-20).

## Authority and cadence

Everything is Codex's call unless it installs an augmentation, resets the
game, or permanently forfeits progress. Stop for Ken's explicit approval for
that one category only.

For everything else, proceed without asking: deploy capital (including stock
capital), change automation, commit/push, restart scripts, and use reversible
feature flags when their risk and ROI justify it. Record decision inputs and
observed results. Keep working while useful work remains, report material
progress periodically, and say plainly when there is nothing left to do.

## Current authority

`STATE.md` is the durable current objective, next action, and blocker. Read
it first. `docs/Codex-todo.md` adds working detail. Historical audit reports
and `docs/claude-todo.md` are evidence, not current authority.

Keep `docs/processes.md` current when a script gains an argument, an input or
output file, or a failure mode. Add an item to `docs/kensTodo.md` only when a
real in-game/manual action requires Ken; check it off after confirmation.

## Operating facts worth keeping in working memory

- The Steam save is the live environment; use the disposable browser save for
  new or destructive-path testing whenever practical.
- Netscript does not hot-reload. Source changes require the relevant restart
  before claiming live behaviour.
- A killed script leaves its tail window behind. New self-superseding scripts
  must close their prior tail with `ns.ui.closeTail(pid)`.
- `ns.write` accepts only `.txt`, `.json`, `.css`, or script extensions.
- Generated game telemetry is not source. Never broadly download game files
  over local source; the exact safe pull sets live in `tools/bb_remote.py`.
- The Remote API sync is authoritative when connected. It can drop; inspect
  daemon status and use the legacy watcher only as a recovery path. A
  reconnect resync must be verified before relying on it.
- `sync_manifest.json` is the single source of truth for scripts delivered to
  the game. Add a new live script there in the same commit.
- Tail windows are finite DOM views, not durable logs. Durable state/events
  are the evidence source; logs should record decision inputs as well as
  outcomes.

## Project shape and current direction

`mcp.js` is the money/XP scheduler. `hacking/crawler.js` →
`hacking/worm.js` grows its worker pool. `restart_mcp.js` is the routine
restart entry point; the HUDs are projections, not separate truth.

Current priority is `STATE.md`'s named work. Capital purchases must show
their expected payoff, cost, opportunity cost, and actual outcome. Darknet,
stock, sharing, cloud capacity, IPvGO, and every persistent automation need a
measurable ROI case beside their health data. Darknet is additive to MCP, not
a substitute unless evidence says otherwise.

The rewrite's technical requirements live in `docs/rewrite-direction.md`;
the current implementation plan lives in `docs/rewrite-plan-consolidated.md`.
Read those only when doing rewrite work. Do not recreate retired governance
gates or a parallel approval process.

## Communication and git

Ken directs from the counter. Lead with the recommendation and outcome,
avoid tool narration, and put durable detail in the project docs/dashboard.
For a task that needs his physical action, make only the initial request and
the final result visible in chat.

Commit and push non-force changes at Codex's discretion. Preserve unrelated
dirty-worktree changes. Never use destructive git commands without explicit
direction. `mcp_config.json` is committed source; generated status/event
files are gitignored.

## Read on demand

- System map and arguments/files/failures: `docs/processes.md`
- Remote API protocol and recovery: `docs/remote-api-migration.md`
- Darknet tactics and prior incidents: `docs/darknet-strategy.md`
- Scheduler rationale and evidence: `docs/scheduler-review-2026-09-12.md`
- Working-method background: `docs/agent-working-agreement.md`
- Retired long-form AGENTS context: Git revision immediately before this
  reduction, plus the dated audit and strategy documents above.
