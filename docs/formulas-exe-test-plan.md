# Formulas.exe R4 target-scoring test plan

**Role:** independent tester  
**Status:** test design only; no production implementation or deployment is
authorized by this document.  
**Source contract:** R8.1–R8.9 in `docs/formulas-exe-review-plan.md`, the
R4 target-scoring outcomes, and `docs/standing-orders.md`.

## Purpose and independence boundary

This plan defines tests from intended outcomes, not from the current function
names or implementation details. The repository already contains local tests
for the current R4-style `computeTargetScore` and
`computeTargetEffectiveScore` functions in `mcp_logic.test.js`. Those tests
are useful baseline evidence, but they do not prove that a future
Formulas.exe-backed calculator is correct, equivalent, or better.

The developer may choose different module names or data structures. The
tests should preserve the observable contract: a calculator receives explicit
server/player/pool/horizon inputs, returns a finite and explainable result (or
an explicit ineligible/warning result), makes no game-changing call, and can
be compared with the current scorer under identical fixtures.

## R4 behavioral outcomes to verify

1. Target ranking accounts for achievable economics, not merely maximum money,
   hack chance, and hack time.
2. Growth limitation is represented: a target that cannot be regrown fast
   enough must not receive an artificially high score.
3. Available worker capacity affects achievable output. Zero capacity cannot
   produce positive income; more usable capacity must not reduce achievable
   capacity.
4. Current target readiness and the cost of returning to the money goal are
   represented separately from raw target potential.
5. A longer horizon reduces the relative effect of ramp cost and approaches
   raw potential without exceeding it.
6. Invalid, incomplete, non-hackable, or non-finite inputs fail closed and
   cannot produce an actionable live recommendation.
7. The formulas-backed calculation is explainable enough to audit: normalized
   inputs, formula/version tag, score or outcome, ramp estimate, recommendation,
   and warnings are available to the comparison layer.
8. Shadow mode computes and records a recommendation without changing
   production actions, RAM allocation, or side-effect order.
9. Promotion requires evidence of improved or acceptably preserved outcomes,
   not merely a passing unit test or a changed ranking.

## Test layers and ownership

| Layer | Owner | What it proves | What it cannot prove |
|---|---|---|---|
| Pure unit tests | Tester | Deterministic calculator behavior and boundaries | Game API correctness or income improvement |
| Differential fixture tests | Tester with senior review | Differences from the current scorer are visible and classifiable | Which scorer wins in the live game |
| Shadow-mode integration | Developer implements; tester verifies | Same live inputs are read, recommendation is side-effect-free, telemetry is complete | Long-term economic superiority without enough observations |
| Live validation | Senior-approved team | Actual Bitburner accepts the calls and observed outcomes match the contract | General superiority outside the sampled player, targets, and patch |
| Promotion review | Senior reviewer | Adopt/shadow-only/reject decision is evidence-backed | A guarantee of future win rate or income |

## Fixture catalog

Fixtures must be small, hand-readable, and explicit about units. They should
not be copied from a production object by reference. Each fixture should
include a stable ID and expected qualitative outcome.

### F1 — Normal high-growth target

Use a rooted, hackable target with positive money, finite hack chance, finite
hack/grow/weaken times, positive growth, and enough pool capacity. Expected:
eligible; finite positive raw score; finite effective score; no warnings.

### F2 — Same money/chance/time, poor growth

Hold maximum money, hack chance, and hack time constant while reducing growth.
Expected: the poor-growth target scores lower. This catches the historical
misranking where growth was absent from the score.

### F3 — Zero-capacity pool

Set available pool threads/RAM to zero while retaining otherwise valid target
inputs. Expected: score and achievable income are zero, with an explicit
capacity explanation if the contract provides warnings.

### F4 — Capacity monotonicity sequence

Evaluate the same target at 0, 1, 10, 100, and a very large capacity.
Expected: achievable score is non-decreasing, finite, and approaches a
documented growth-throughput ceiling rather than exceeding it.

### F5 — Already-ready target

Set current money at or above the configured money goal and security at its
minimum. Expected: ramp time is zero; effective score equals raw score (within
the documented numeric tolerance); no negative ramp cost.

### F6 — Drained target

Set current money near zero with a valid growth model. Expected: positive raw
potential may remain, but effective score is lower than raw score and ramp
seconds are positive and finite when growth capacity is available.

### F7 — No growth capacity for a drained target

Combine drained money with zero grow capacity or a non-positive growth rate.
Expected: no actionable positive effective recommendation; return an explicit
blocked/ineligible result rather than infinity, NaN, or an unbounded score.

### F8 — Very long horizon

Evaluate F6 over short, normal, and very long horizons. Expected: effective
score increases toward raw score as horizon grows, never exceeds raw score,
and remains finite.

### F9 — Boundary and invalid inputs

Cover zero and negative money, money above maximum, security below minimum,
zero/negative/NaN/Infinity times, negative thread counts, missing player
level, invalid target growth, zero hack chance, and non-hackable skill.
Expected: deterministic fail-closed output with warnings; never an actionable
recommendation based on invalid data.

### F10 — Ranking separation

Create at least three targets: high raw potential/slow ramp, medium potential/
fast ramp, and poor-growth/high-money. Run at least two horizons. Expected:
the result exposes the ranking and the inputs that caused it; any ranking
change versus the current scorer is reported, not silently accepted.

## Unit test assertions

The junior tester should implement these against the approved calculator
interface once the senior reviewer approves the contract. Tests must assert
outcomes rather than private variables.

### Result shape

- Result is an object with an explicit eligibility/status field.
- Score, effective score, and ramp seconds are numbers or documented
  sentinels; actionable results are finite.
- Recommendation identifies the target/action or explicitly says none.
- Warnings identify missing, clamped, stale, or suspicious inputs.
- Formula/version metadata is present and stable for a given implementation
  version.

### Numeric invariants

- `0 <= currentMoney <= maxMoney` after normalization, or the input is
  rejected/flagged; silent nonsensical normalization is not acceptable.
- `rampSeconds >= 0` for eligible results.
- `effectiveScore >= 0` and `effectiveScore <= rawScore`.
- Zero capacity implies zero achievable income/score.
- Increasing capacity cannot lower the achievable score for the same state.
- Increasing horizon cannot lower effective score and cannot make it exceed
  raw score.
- A non-hackable target is never actionable.
- No invalid fixture emits a live-action recommendation.

### Boundary assertions

- Exact minimum security is valid; below minimum is either clamped with a
  warning or rejected according to the approved contract.
- Exact zero money is handled without division by zero or NaN.
- Exact maximum money has no positive ramp cost.
- A one-thread pool is handled distinctly from a zero-thread pool.
- A one-second horizon and a very large horizon remain finite.
- Equal-score ties have deterministic ordering or an explicitly documented
  tie policy.

## Differential comparison with the current scorer

For every fixture in F1–F10, run both the current R4 scorer and the proposed
formulas-backed calculator using the same normalized inputs and objective.
The test report must include:

```text
fixtureId
current score/effective score
formulas score/effective score
absolute and relative difference
current ranking
formulas ranking
input normalization and formula version
classification/status
```

Differences must be classified before any production change:

- expected correction from a documented formulas capability;
- input mismatch or unit conversion;
- formula API misunderstanding;
- rounding/tolerance difference;
- current production bug;
- harmless numerical variation;
- unresolved.

An unexplained large difference is a test failure for the review process even
if both functions return finite numbers. A changed ranking is evidence to
investigate, not evidence that the formulas result is superior.

## Shadow-mode test plan

Shadow mode is an integration behavior and must be tested with a mocked game
API before live use.

### Mocked shadow checks

- Production and formulas paths receive the same snapshot object or equivalent
  values.
- Shadow calculation does not call hack, grow, weaken, purchase, kill,
  deploy, restart, or other state-changing APIs.
- Enabling shadow mode does not change production target, thread counts, RAM
  allocation, action order, or timing decisions.
- Disabling shadow mode restores the exact production path.
- One malformed formulas result records a bounded warning/counter and leaves
  production behavior intact.
- Telemetry contains timestamp, script version, formula version, inputs,
  production decision, shadow recommendation, predictions, and subsequent
  observation fields where available.
- Sampling is bounded; telemetry cannot grow without limit in memory or in a
  game file.
- Repeated identical snapshots produce equivalent recommendations.

### Live shadow checks

After local mocked checks pass and the senior reviewer approves deployment:

- Confirm the game accepts the formulas API calls with Formulas.exe owned.
- Confirm the live script remains operational while shadow mode is enabled.
- Confirm no orders, process changes, or RAM changes are attributable solely
  to shadow computation.
- Collect observations over the approved window and compare income/sec,
  target changes, ramp duration, money percentage, security floor time,
  redeploy count, RAM utilization, and prediction error.
- Keep money mode and XP mode, pre/post augmentation, and different target
  pools in separate labeled populations.

## Assertions and failure channel

Local tests should throw focused assertion failures with fixture ID, input
units, and the violated invariant. In-game recoverable anomalies must use the
repository's visible invariant path: alert/toast as appropriate, bounded
status counter, and event record. They must not be swallowed in a
print-only catch block. A formulas failure must fail closed to the existing
production decision or no action, according to the approved contract.

## Promotion gates

The senior reviewer must not approve adoption until all gates below are met.

### Gate A — Contract testability

Every R4 acceptance criterion maps to a local test, a mocked integration test,
or an explicitly live-only check. Ambiguous units, formula versions, and tie
policy are resolved or marked as open questions.

### Gate B — Local correctness

Fixtures, boundary tests, invariant tests, and differential tests pass. The
full existing `node --test` suite and syntax checks pass. No production code
is modified by the tester as part of this plan.

### Gate C — Difference review

Every material differential result is classified and signed off. No ranking
change is promoted merely because it appears intuitively better.

### Gate D — Shadow safety

Mocked shadow checks prove no side effects, bounded telemetry, fail-closed
behavior, and production-path preservation.

### Gate E — Live evidence

The approved live window has enough observations to compare like with like.
The report states sample size, observation period, target pool, player state,
objective, and prediction error. It distinguishes observed improvement from
inference.

### Gate F — Decision and rollback

The senior reviewer records exactly one outcome:

- **Adopt:** formulas path is measurably better or meets the agreed
  preservation threshold, with a named production change and rollback.
- **Keep shadow-only:** useful diagnostics but insufficient or inconsistent
  improvement.
- **Reject:** unsafe, incorrect, too costly, or harmful to another objective.

No live capital-moving or destructive behavior is enabled by a passing test
alone.

## Requirements that cannot be tested locally

The following are explicitly outside local unit-test proof:

1. Whether Bitburner's actual `ns.formulas.*` signatures, enum values, units,
   and outputs match the assumed API in the installed game version. This
   requires an in-game probe with Formulas.exe owned.
2. Whether the formulas calculation matches the game's live mechanics across
   real servers, cores, difficulty, augmentations, multipliers, and patch
   version. Local fixtures can only model chosen values.
3. Whether a formulas-backed ranking increases real money/sec, reduces ramp
   waste, or improves stability. This requires controlled live shadow data.
4. Whether shadow telemetry survives the game's file/sync/runtime constraints
   and remains bounded over time. This requires live validation.
5. Whether the Remote API deployment and restart load the intended version.
   This requires the custom connector and in-game confirmation.
6. Whether the sampled live result generalizes to future augmentations,
   target pools, objectives, or game updates. This remains an uncertainty even
   after a successful observation window.

These are not reasons to skip local testing. They define the boundary between
local confidence and live confirmation and must appear in the senior review's
final evidence report.

## Traceability matrix

| Contract outcome | Local test | Live-only check | Promotion evidence |
|---|---|---|---|
| Growth affects achievable score | F2, differential fixture | None for arithmetic; live mechanics still require probe | Correct classified difference |
| Capacity is monotonic and bounded | F3, F4, invariants | Confirm live RAM/thread inputs | Passing local suite + no live contradiction |
| Ramp cost affects readiness | F5–F8 | Compare observed ramp duration | Prediction error and income evidence |
| Invalid state fails closed | F9, result-shape tests | Malformed/stale live snapshot | Counter/event visible, no action |
| Recommendation is explainable | Result-shape and telemetry schema tests | Confirm fields are populated in game | Auditable shadow records |
| Shadow has no side effects | Mocked shadow checks | Observe unchanged production actions | Safety window complete |
| Formulas path improves decisions | Differential tests only | Controlled shadow comparison | Adopt / shadow-only / reject |

## Handoff to the senior reviewer

Before implementation begins, the tester returns:

- this plan;
- the approved calculator interface and glossary, once the documenter and
  senior reviewer supply them;
- fixture files and test results;
- a list of unresolved ambiguities;
- the differential classification report;
- explicit local/live status for every acceptance criterion.

The tester should challenge the documenter if “better,” “same,” “horizon,”
“income,” or “ramp cost” lacks a unit, population, tolerance, or observation
window. The developer may proceed only after the senior reviewer resolves
those questions or records them as provisional assumptions.
