# Parallel work models: what failed, what worked — 2026-11-03

Ken asked why handing the three BN10 work packages (`docs/bn10-plan.md`) to parallel
workers failed twice and then worked. Evidence comes from the app's session records
(`%LOCALAPPDATA%\Claude-Data\...\claude-code-sessions\local_*.json`), `git worktree list`,
and `~/.claude.json`. Where the cause cannot be seen, this says so.

## Timeline

| Time (Pacific) | Attempt | Result |
| --- | --- | --- |
| 19:28 | 3 separate Claude sessions, each with its own git worktree, Sonnet, auto mode | All failed 0.2s after creation |
| ~19:35 | Ken clicked Trust; I sent the briefs as messages to those sessions | Undelivered: "this session never started ... a message does not start it" |
| 19:38 | 3 new sessions, same settings | All failed the same way, 0.15s after creation |
| 20:15 | 3 background subagents from this session, each with `isolation: worktree` | All launched; 3 worktrees and branches exist (`.claude/worktrees/agent-*`) |

## Failure 1: new sessions stopped at a repository trust gate

Each session record has `error: "Claude needs you to trust this repository before it can
work here."`, `errorCategory: "repository_review_needed"`, set within a fraction of a
second of `createdAt`. Each was still holding its brief under `pendingFirstStart`. Setup
stopped before any work: `git worktree list` showed no worktree for any of them.

They pointed at the same folder as this session (`cwd C:\Users\kenne\BitBurner`), with
`useWorktree: true` and `permissionMode: auto`. The CLI's own trust record for that folder
is already accepted (`~/.claude.json`, `hasTrustDialogAccepted: true`). So this gate is the
desktop app's own check, separate from the CLI dialog. This session never met it because it
was started in a scratch folder and moved here by `change_directory`, which Ken approved.

**Why it fired is not visible.** No local file I can read records the app's review
decision, and the repo has no `.claude` settings or hooks that a review would cover.

## The messages were not a second model

Sending the briefs could not have worked. The app's reply says a message does not start a
session whose setup never finished; the brief was already stored, so the session had to be
started again from its own row. This was my mistake about how the tool works, not a failure
of the sessions.

## Failure 2: the new sessions hit the same gate after Trust

The second batch failed exactly like the first, after Ken had clicked Trust. So that click
did not carry over to sessions created afterwards. The records cannot tell which of these
happened:
- The click applies only to the session it was shown in, and takes effect when that session is restarted.
- The decision is stored per session, not per repository.
- The click had not completed.

Either way, each new session would need its own Trust click. That defeats unattended
parallel starts.

## Why subagents worked

A subagent runs inside this session's own process, so it never goes through the app's
session launcher, where the gate sits. It inherits this session's permission settings and
cannot exceed them. Claude Code made its worktree directly with git under
`.claude/worktrees/`, which `.gitignore` covers. The worktree keeps its edits off `main`,
and therefore away from the sync daemon that feeds the live BN15 game.

"Worked" so far means started. At the time of writing none has finished. Their code is
unreviewed until each final report arrives and its branch is checked.

## Choices

1. **Subagents from this session (now in use).** No trust prompts, runs in parallel, no
   more access than this session, and results come back here for review before merging.
   Limits: you cannot open or steer one, I see only its final report, and the work lives in
   this conversation's history.
2. **Separate sessions in worktrees.** Visible in the sidebar, steerable, and they outlive
   this conversation. Each currently needs a Trust click. A two-minute test would settle
   whether trust can persist: start one stalled session from its row, then have me start one
   new test session.
3. **Sessions sharing this checkout (no worktree).** Not safe here: the sync daemon pushes
   changed scripts from this folder straight into the live game.
4. **One worker, in this session, serially.** Simplest and slowest. Fine for small packages.

## Recommendation

- Keep subagents for bounded code work like the BN10 packages: build, test, and report back
  for review.
- Use separate sessions only for long-lived work you want to watch or steer, after running
  the test in choice 2 once.
- Archive the six stalled sessions.
