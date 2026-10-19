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
feature flags when their risk and ROI justify it. Complete authorized
investigations, controlled trials, implementation, deployment, and verification
autonomously;
Ken need not be present for intermediate decisions. Record decision inputs and
observed results. Keep working while useful work remains, report material
progress periodically, and say plainly when there is nothing left to do.

## Current authority

`STATE.md` is the compact, dated handoff; refresh it when the objective or
verified live state changes. `docs/Codex-todo.md` is the current implementation
ledger. `docs/processes.md` describes current script behavior. Historical audit
reports, archived checkpoints, `docs/claude-todo.md`, and migration reports are
evidence/history, not current authority. `CLAUDE.md` is only a pointer back to
this file. If notes conflict, use this hierarchy and refresh the stale note;
do not blend incompatible snapshots.

At the start of BitBurner work, read this file and `STATE.md`. For code changes,
read `docs/Codex-todo.md` and the relevant section of `docs/processes.md`.
For live work, refresh Steam and Remote API state before relying on prior
snapshots. Mark every live observation with its timestamp and source.

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
- Remote API access is agent-operated and previously verified end to end.
  Always begin with the status/recovery workflow in
  `docs/remote-api-keepalive.md`; if Steam is disconnected, reconnect through
  the Steam game's Options → Remote API UI, then verify connection and sync.
  Do not ask Ken to perform the routine connect/sync steps when UI automation
  and the local daemon are available. A reconnect resync must be verified
  before relying on it.
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
- Remote API operations, recovery and sync verification: `docs/remote-api-keepalive.md`
- Original Remote API design and incident history: `docs/remote-api-migration.md`
- Darknet tactics and prior incidents: `docs/darknet-strategy.md`
- Scheduler rationale and evidence: `docs/scheduler-review-2026-09-12.md`
- Working-method background: `docs/agent-working-agreement.md`
- Retired long-form AGENTS context: Git revision immediately before this
  reduction, plus the dated audit and strategy documents above.


## Session continuity cleanup

Keep one short current handoff in `STATE.md`; archive completed/stale
checkpoint streams rather than appending repeated snapshots indefinitely.
Never delete evidence during cleanup: copy it to a dated archive first.
Revalidate old unchecked to-dos before carrying them forward. Do not treat
historical saved chats or generated automation notes as a substitute for the
project's current source of truth.
