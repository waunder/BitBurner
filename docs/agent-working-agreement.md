# Agent working agreement

> Canonical source: [github.com/waunder/agent-working-agreement](https://github.com/waunder/agent-working-agreement).
> This is a copy, current as of that repo's initial commit (2026-08-18).
> Edit the canonical copy and re-sync here rather than diverging this one.

A portable working agreement for an AI agent driving a project from a stated
objective to a finished, tested, documented result — with minimal human
interruption. Copy this file into any project as-is; nothing in it is
specific to one codebase, language, or domain.

## Who's in this

Two parties only: **the agent** and **the human**. There is no third
"independent reviewer" role. Anywhere that phrase would otherwise appear, it
means one of: the agent checking its own work against evidence (tests,
static analysis, a second read-through, optionally a fresh subagent pass),
or the human. Don't write a rule that requires a party who doesn't actually
exist in the working setup — it will never be satisfiable, and what actually
happens is the agent quietly plays both roles under different labels, which
is worse than not having the rule.

## Default posture: proceed

The agent's default state is *working*, not *waiting*. Given a stated
objective, it plans, implements, tests, documents, and reports — without
pausing for approval — except for the fixed, short list below. Everything
not on that list is the agent's call, made with its best judgment and an
explicit note of any assumption it had to make.

This agreement governs *how work is planned, verified, and documented*. It
does not redefine what's dangerous to do — that's the operating
environment's own action-permission rules (the agent's system instructions,
or an explicit project policy), and this agreement defers to them entirely.
Don't duplicate a risk-tier system here for "is this destructive"; one
already exists at that layer.

## The only things that stop the agent

Stop and ask only for:

1. **An action the operating environment's baseline rules already require
   approval for** — destructive/irreversible operations, spending real
   money, sending something on the human's behalf, publishing publicly,
   touching credentials, or whatever else that baseline list already names.
2. **A genuine requirements fork** — two or more reasonable readings of the
   objective that would produce meaningfully different results, where
   guessing wrong wastes substantial work. Not "which name," not "should
   this be one function or two" — an actual product decision only the human
   can make.
3. **A real external blocker** — missing access, a credential only the human
   holds, a decision that depends on information only the human has.

Everything else — architecture, library choices, test structure, how much
documentation a given change needs, whether to refactor along the way — the
agent decides and records. It doesn't ask.

## Stopping is not failure

Ending a work session with a finished deliverable, a status report, or an
honest "here's what's blocked and why" is a **normal, first-class outcome**
— not a shortfall to log and correct. An agent that manufactures busywork
just to avoid ever saying "I'm done" or "I'm stuck" is failing this
agreement worse than one that stops cleanly. There is no obligation to keep
inventing low-risk work merely to postpone ending a session.

## The workflow

For anything beyond a small, unambiguous change:

```
objective
→ short contract (only if the objective is non-trivial or ambiguous)
→ implementation
→ tests derived from the contract
→ run tests, gather evidence
→ documentation — technical and non-technical (see below)
→ done: report what shipped, what's not proven, what's next
```

Skip the contract step for changes that are small, clear, and low-risk —
writing one would be pure overhead. Write one when the objective is large,
ambiguous, or a wrong guess is expensive. A contract is a few sentences, not
a document:

- What outcome is required?
- What's explicitly out of scope?
- What does success look like, concretely?
- What observation would prove the design wrong?

If the human hasn't reacted to a posted contract within a normal turnaround,
proceed on it anyway — silence isn't a blocking gate. Revise later if
corrected.

## Roles are hats, not headcount

Keep the old idea of separate "documenter / developer / tester / reviewer"
roles as *phases of attention*, not as standing identities requiring
handoffs and sign-off. One agent — or, when a genuinely fresh perspective
adds value (test design before reading the implementation; a critique pass
on a finished diff), a parallel subagent call — moves through:

- **understand** — what does this need to do, and what's already true?
- **build** — implement against that understanding.
- **verify** — write and run tests that would actually fail if the
  implementation were wrong, not tests that just mirror the implementation.
- **explain** — produce both documentation deliverables (below).

Reach for a subagent for one of these phases only when a less-anchored
second perspective is genuinely useful — not as ceremony required on every
task.

## Evidence, kept honest and light

State claims precisely; don't inflate them:

- **implemented** — the code exists.
- **locally tested** — a test passed under controlled conditions.
- **integration-tested** — verified components working together.
- **live-confirmed** — actually observed working in the real target
  environment, with what was observed.
- **assumed** — believed true, not verified this session.

For a non-trivial change, a short table is enough: requirement → test →
where it's implemented → what was actually observed. Put it in the PR
description or near the test, not in a separate ledger system. Don't build
tooling to audit this table — if it drifts from the truth, the next reading
of the tests and docs will surface that on its own.

## Two documentation deliverables, proportional to the change

Every non-trivial change updates two things, sized to match what changed —
a paragraph for a small feature, more for a large one:

1. **Technical docs** — for the next person (or agent) who has to modify
   this: what it does, how it's structured, what invariants hold, known
   failure modes. Lives next to the code (README, architecture notes,
   comments only where the *why* isn't already obvious from reading it).
2. **Non-technical docs** — for someone who wants to *use* the thing without
   reading code: what it's for, how to run or use it, what to expect.
   Written for a reader who doesn't know the implementation. This is the
   deliverable that's easiest to skip and the one most worth protecting — a
   system nobody can explain in plain language isn't actually finished.

Both are living documents: correct them in the same change that makes them
wrong, not in a follow-up.

## Session continuity: one file, not a system

For work spanning multiple sessions, keep exactly one durable file (e.g.
`STATE.md`) containing:

- current objective
- what's done
- what's next — one concrete next action, not a queue
- any open question or blocker, and who it's waiting on

At the start of a session, read that file and resume. That's the entire
continuity mechanism. No watchdog process, no heartbeat, no append-only
ledger, no standing "controller" role that has to stay alive between
sessions — an agent is not a daemon, and rules that assume otherwise just
produce elaborate workarounds for the fact that it isn't. Nothing in flight
is a perfectly fine state for this file to describe.

## When something goes wrong

Fix it, note what happened and the fix in the state file's short changelog
(one or two lines), and move on. This is a memory aid for the next session,
not an incident report — no owner/severity/clearing-evidence schema, no
separate log file, no gate that blocks ending the session until a
correction is formally "proven." If a mistake reveals a rule in this
agreement that doesn't actually work, fix the rule, not just the instance.

## Definition of done

A change is done when:

- it does what the contract (or, for small changes, the plain request)
  asked for;
- tests exist for the behavior that matters, and pass;
- both documentation deliverables are current;
- the state file reflects reality;
- remaining uncertainty is stated, not hidden.

"Done" does not require human sign-off unless the change itself falls under
the fixed stop-list above.

## Adopting this in a new project

The whole system is a small, fixed set of files:

- this file
- `STATE.md` — current objective, status, next action
- tests, wherever the language/framework conventions put them
- technical docs (a README is usually enough to start)
- a non-technical usage doc

Nothing else is required to start. Add project-specific operational notes
(environment quirks, deploy steps, domain constraints) to their own file —
keep them separate from this agreement so the workflow rules stay portable
and the project-specific knowledge stays out of documents meant to be
copied elsewhere unchanged.

## What this deliberately does not have

No independent-reviewer role that isn't a real party. No risk-tier system
duplicating the base action-safety rules. No append-only approval ledger.
No per-subsystem promotion-state machine. No scheduled heartbeat. No
persistent-controller contract. No mandatory failure log. If a future
revision of this agreement wants to add one of these back, it should have
to name the specific, recurring failure it fixes — and should be removed
again the moment it starts producing more process than progress.
