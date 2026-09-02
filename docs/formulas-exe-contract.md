# R4 formulas-backed target-scoring audit contract

**Role:** high-level documenter  
**Status:** approved for the pure-calculator milestone only; no live integration authorized  
**Date:** 2026-08-14  
**Scope:** first Formulas.exe work package: audit R4 target scoring with a formulas-backed calculator

## 1. Purpose and boundary

This work package investigates whether hypothetical, minimum-security server
calculations improve the existing R4 target-ranking decision. It must produce
an auditable comparison between the current scoring model and a formulas-backed
model.

It does not authorize changing target selection, worker allocation, switching
thresholds, restart behavior, stock behavior, or any other live action. The
initial output is a calculator, evidence, and a recommendation. Production
integration requires a later senior approval gate.

## 2. Repository facts

The following are facts established from local source and documentation:

| ID | Fact | Evidence |
|---|---|---|
| F-01 | `ns.formulas` requires `Formulas.exe` on `home`. | `NetscriptDefinitions.d.ts`, Formulas API declaration |
| F-02 | The local API declaration exposes `formulas.hacking` functions for hack chance, hack percent, hack time, grow time, weaken time, grow amount/threads, hack experience, and weaken effect. | `NetscriptDefinitions.d.ts`, `HackingFormulas` |
| F-03 | Formula hacking functions accept server/player objects for hypothetical calculations; `growThreads` and `growAmount` also accept target money/threads and optional cores. | `NetscriptDefinitions.d.ts` |
| F-04 | Formula times are documented in milliseconds. | `NetscriptDefinitions.d.ts` |
| F-05 | Current R4 production scoring is computed through pure functions in `mcp_logic.js` and consumed by `mcp.js`. | `mcp_logic.js`, `mcp.js` |
| F-06 | Current `computeTargetScore` uses current-state inputs: hack time, hack percent, grow-log rate, max money, hack chance, pool threads, security-effect ratios, and action/security constants. | `mcp_logic.js` |
| F-07 | Current `computeTargetEffectiveScore` applies a ramp-time discount based on current money, target money goal, pool capacity, grow rate, hack time, and a configured horizon. | `mcp_logic.js`, `mcp_config.json` |
| F-08 | Current R4 implementation does not construct a minimum-security server state before scoring. The current-security-versus-floor issue is explicitly documented as a gap. | `docs/hacking-strategy.md`, R4 status section |
| F-09 | Current R4 has unit tests in `mcp_logic.test.js`; the repository uses Node’s test runner for pure logic. | `mcp_logic.js`, `mcp_logic.test.js` |
| F-10 | Local documentation reports R1–R5 and R7 implemented and live; R6 XP mode is not started. | `docs/hacking-strategy.md` |
| F-11 | Live R4 evidence reported a large income increase after the non-formulas R4 scoring/ramp/switch change, but that is evidence for the current R4 change, not evidence that a formulas-backed alternative is better. | `docs/hacking-strategy.md`, R4 status section |

## 3. Assumptions and unknowns

These must remain visible until tested or confirmed in the game:

### Assumptions

- **A-01:** The installed game build accepts the server/player object shapes
  declared in the local type definitions after Formulas.exe ownership.
- **A-02:** A copied server object with `hackDifficulty` set to its
  `minDifficulty` is a valid input for the relevant formulas calls.
- **A-03:** A formulas-backed hypothetical score can be compared fairly with
  the current score when both use the same target pool, player state, pool
  capacity, horizon, and objective.
- **A-04:** The calculator can remain side-effect-free even if live collection
  of its inputs requires `ns` calls in a separate adapter.

### Unknowns

- **U-01:** Whether every relevant formula call is callable in the current
  live Bitburner build, not merely declared locally.
- **U-02:** Whether the game requires additional server/player fields or a
  particular cloning/normalization convention for hypothetical states.
- **U-03:** Which exact formulas-backed score best represents the production
  objective; the API supplies component calculations, not a repository-defined
  target-ranking policy.
- **U-04:** Whether floor-state scoring materially changes target ranking,
  realized income, ramp time, or switching behavior.
- **U-05:** Whether formulas calls have acceptable live execution time when
  evaluated for all candidates at the intended sampling rate.
- **U-06:** Whether current live telemetry is sufficient to compare predictions
  with outcomes without first adding bounded shadow records.

Unknowns are investigation work, not permission to invent a fallback result.

## 4. Decision contract

### Required behavior

The first work package shall provide a pure calculator that accepts a complete,
explicit input object and returns a structured audit result for one target. It
shall calculate or report both:

1. the current R4 scoring basis; and
2. a formulas-backed hypothetical basis using an explicitly labeled server
   state, initially proposed as minimum security.

The calculator shall not read global game state, call `ns`, launch or kill
scripts, change configuration, choose a live target, or perform a financial or
other irreversible action.

The result shall make the comparison inspectable. It shall include the input
normalization, model labels, component values, score values, warnings, and an
eligibility/error state. A score without its units, model label, or warnings is
not a sufficient result.

### Out of scope

- Replacing the current production scorer.
- Changing `OPPORTUNITY_SWITCH_FACTOR`, `SCORE_HORIZON_SECONDS`, or any other
  live tuning value.
- Adding formulas calls directly to the manager’s decision loop.
- Claiming improved income from static or unit-test evidence.
- Testing R6 XP mode or other formulas namespaces in this package.
- Automatic target switching, deployment, restart, or rollback.

## 5. Inputs

The calculator’s input schema must use plain serializable data and explicit
units. The final schema is a developer decision subject to senior review, but
it must cover the following:

| Input group | Required content | Unit/label requirement |
|---|---|---|
| Target identity | server name or stable identifier | string; not used as an implicit lookup |
| Current server | money available, money max, current security, minimum security, required hacking skill, growth, and relevant server fields | money in game currency; security in game security points |
| Hypothetical server | the exact fields changed from current state, especially security; unchanged fields must be explicit or derivable | state label such as `current` or `minimum-security` |
| Player | the player fields needed by the selected formulas | source/version and field units recorded |
| Pool | available thread capacity and any core assumptions | threads as numeric capacity; cores explicit where used |
| Objective | current objective and scoring horizon | `money`/other approved value; horizon in seconds |
| Current-model constants | security/time ratios and current R4 parameters | named constants, not unexplained literals |
| Formula/API metadata | API/model version and availability result | recorded as metadata, not inferred |

Missing, non-finite, or dimensionally invalid inputs must produce an explicit
ineligible/error result rather than a plausible-looking score.

## 6. Outputs

The result must contain, at minimum:

- `eligible` and a machine-readable reason when false;
- target identity and input-state labels;
- normalized inputs or a hash/reference to a bounded record containing them;
- current-model component values and score;
- formulas-backed component values and score;
- score units and time units;
- rank/order comparison fields suitable for comparing a target set;
- warnings for approximation, missing API confirmation, stale data, or
  unsupported state construction;
- formula/API version metadata;
- a recommendation status limited to `compare`, `needs-investigation`, or
  `not-comparable`.

The calculator must not return `adopt` or directly authorize a production
change. Adoption is a senior-review outcome based on a wider experiment.

## 7. Invariants and assertions

Assertions protect the behavior contract, not a particular implementation:

- All required numeric inputs and outputs are finite.
- Times are positive when a target is eligible and are consistently converted
  to the declared unit.
- Money values are non-negative and do not exceed the declared maximum in a
  normalized server state.
- Security is not below minimum security in a valid current or hypothetical
  state.
- Thread capacity is non-negative; zero capacity cannot yield positive
  achievable income.
- An ineligible target cannot receive a positive production recommendation.
- The current and formulas-backed results identify their model/state basis;
  they must never be silently conflated.
- Repeating the same immutable input produces the same result.
- Changing only the hypothetical security field changes only values that the
  selected formulas actually depend on; unrelated input fields must not be
  silently rewritten.
- Invalid API availability or state construction fails closed with a reason.

The tester should add boundary cases for zero/negative/NaN inputs, a target at
minimum security, a target above minimum security, zero pool capacity, and an
ineligible target. Exact monotonicity expectations must be approved after the
formula semantics are confirmed; they must not be guessed from intuition.

## 8. Acceptance criteria

### Contract and API

- AC-01: A senior reviewer can identify the exact decision, scope, objective,
  inputs, outputs, and non-goals from this contract.
- AC-02: The developer records the callable formulas signatures, object shape,
  units, RAM cost, and live availability evidence before relying on them.
- AC-03: Any unconfirmed API behavior remains labeled unknown and cannot be
  used as a production premise.

### Pure calculator

- AC-04: The calculator has no `ns` calls or game side effects.
- AC-05: The calculator returns both model results or an explicit reason why a
  comparison is not possible.
- AC-06: The result exposes enough labeled components and inputs to reproduce
  or explain a score difference.
- AC-07: Invalid and incomplete inputs fail closed and are covered by tests.

### Independent tests

- AC-08: The tester derives a traceability matrix from AC-01 through AC-07
  without reading production implementation to discover intended behavior.
- AC-09: Tests cover normal, boundary, invalid, and model-state cases,
  including current security versus minimum security.
- AC-10: The existing test suite remains passing; no test is accepted merely
  because it matches the implementation’s current formula.

### Audit evidence

- AC-11: A fixed fixture set produces a differential report comparing current
  and formulas-backed scores, rankings, and component differences.
- AC-12: Every material difference is classified as expected correction,
  input mismatch, unit/convention error, API misunderstanding, production
  defect, or harmless numerical variation.
- AC-13: No live behavior is changed by the audit calculator or its tests.

### Promotion boundary

- AC-14: The deliverable ends with a senior recommendation of `adopt`,
  `shadow-only`, or `reject` only after the required evidence exists; this
  package itself may conclude `needs-investigation`.
- AC-15: Any later shadow or live integration separately records baseline,
  sampling window, target pool, objective, prediction error, realized income,
  target switches, redeploys, RAM/latency cost, and rollback conditions.

## 9. Live-only evidence

The following cannot be established by local source inspection or unit tests:

- Formulas.exe is owned and the relevant calls execute in the current save.
- The local type-defined server/player objects are accepted by the live API.
- The hypothetical minimum-security state produces meaningful values in the
  actual game build.
- Formula evaluation cost and latency are acceptable at the intended sample
  rate.
- The formulas-backed ranking changes live target selection in the intended
  target pool.
- The formulas-backed ranking improves realized income or another approved
  objective without unacceptable switching, RAM, latency, or stability cost.
- Predictions match observed outcomes within an agreed tolerance.

Live evidence must be collected in shadow mode first. Shadow mode must read the
same live state as production, calculate without acting, and record bounded,
versioned observations. A live observation is not proof of causation unless the
baseline, comparison population, and confounding changes are documented.

## 10. Handoff and traceability

The documenter hands the tester this contract, glossary, fixture requirements,
acceptance criteria, and unknowns. The tester returns:

- a requirement-to-test matrix;
- ambiguities or untestable statements;
- missing boundary cases;
- proposed contract clarifications.

The developer owns the pure calculator and any live adapter separately. The
senior reviewer owns API interpretation, acceptance thresholds, and the later
promotion decision.

Initial traceability:

| Contract area | Test/check owner | Evidence status |
|---|---|---|
| API signatures and availability | developer + senior reviewer | local declaration fact; live confirmation required |
| Pure calculator behavior | tester | not yet implemented |
| Invalid-input and invariant behavior | tester | not yet implemented |
| Current-vs-formulas differential report | tester/developer | not yet implemented |
| Live shadow comparison | senior-approved live team | explicitly live-only; not started |
| Production adoption | senior reviewer | out of scope for this package |

## 11. Current conclusion

The repository supports a safe first experiment: isolate a formulas-backed,
hypothetical-state calculator beside the existing R4 pure scoring logic, test
it independently, and compare its outputs before changing production.

The local review does **not** establish that the formulas model is superior,
that minimum-security cloning is valid in the live API, or that adoption will
increase income. Those are explicit unknowns and live-only questions for the
next gates.

## 12. Senior reconciliation and implementation boundary

The independent tester's plan agrees with this contract on observable
outcomes, failure behavior, differential comparison, and the live-only
boundary. The following decisions resolve the remaining implementation
ambiguity for the first milestone:

- The pure module receives two explicit metric bundles: `currentModel` and
  `hypotheticalModel`. A future formulas adapter will produce the hypothetical
  bundle from `ns.formulas`.
- The pure module receives neither `ns` nor live `Server`/`Player` objects and
  never calls `formulas.*`. This keeps local tests deterministic and prevents
  an unconfirmed API assumption from entering production code.
- Both bundles use the existing R4 vocabulary: `hackTimeSeconds`,
  `hackPercentPerThread`, `growLogPerThread`, `maxMoney`, `hackChance`, and
  the named security/thread constants required by `computeTargetScore`.
- The audit result reports `rawScore` and `effectiveScore` in dollars per
  second, plus `rampSeconds`, model labels, and warnings. It never chooses a
  target or authorizes an action.
- Minimum-security construction remains unknown until a live formulas probe
  confirms the accepted mock object shape. The pure milestone may use a
  hand-authored hypothetical metric fixture, clearly labeled as such.

**Approved milestone:** implement and test the pure comparison calculator and
fixture suite only. The next gate is senior review of its differential output;
only then may an `ns.formulas` adapter or shadow mode be added.
