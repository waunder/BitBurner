# Formulas.exe review and whole-game improvement plan

**Date:** 2026-08-14  
**Scope:** what Formulas.exe exposes, what it can improve across the whole
Bitburner position, and which important systems it cannot model.  
**Target:** replace guesswork with exact calculations where the API supports
them, then use the resulting decisions to compound money, RAM, reputation,
access, and long-term progression.

## Executive recommendation

Formulas.exe is a calculation layer, not a general game-strength upgrade. It
is valuable where a decision depends on hypothetical player/server state:
hacking percentages, hack/grow/weaken timing and yield, hacknet upgrades,
gang outcomes, work/reputation estimates, Bladeburner actions, and darknet
operations. It has no Go namespace and does not replace the stock market's
4S signal or the game's live faction/augmentation decisions.

The best immediate use is to audit `mcp.js`, darknet deployment, server/RAM
allocation, and any future gang or Bladeburner automation for places where we
are using measured values, heuristics, or repeated live calls when an exact
formula is available. Each replacement should be benchmarked against the
current behavior, because exact calculation is only useful if it improves the
decision that follows.

The operating sequence is:

1. Inventory every supported `ns.formulas.*` namespace and each current
   approximation in the repo.
2. Replace the highest-value approximation in the money/RAM engine first.
3. Measure income, timing, RAM, and failure behavior before and after.
4. Extend the same exact-state approach to darknet, gangs, work, and
   Bladeburner only when those systems are active.
5. Keep systems without a formulas surface—stocks, IPvGO, and UI-driven
   choices—on their own evidence and simulation paths.

## Step-wise plan using the existing R1–R7 framework

The hacking strategy's R1–R7 sequence is the best template for this review:
rank changes by expected gain divided by risk and implementation cost, ship
one coherent step at a time, and confirm each step live before depending on
it. The formulas review changes the priority of some steps: several of the
largest gains do not require Formulas.exe, while Formulas.exe is most useful
for exact hypothetical-state comparisons.

### R1 — Keep the balance-point controller as the economic foundation

R1 sizes hack/grow from target economics rather than a fixed RAM fraction.
This is already implemented and confirmed live. The important lesson is that
`ns.hackAnalyze()` plus `ns.growthAnalyze(target, 2)` recover the exact
marginal quantities needed for a continuous farm; Formulas.exe is not
required.

**Next review:** verify that the live controller still holds money near its
intended operating range as hacking level, RAM, and targets change.

### R2 — Keep the stuck-target detector honest

R2 resets progress timing at the security floor instead of treating the
normal floor state as a stuck target. This is a state-machine correction, not
a formulas problem.

**Next review:** use exact security/time inputs only where they change the
decision; do not add formulas calls merely because they are available.

### R3 — Redeploy on quantity mismatch

R3 compares desired and running thread counts rather than only action types.
This is another control-loop correctness fix. Formulas.exe cannot repair a
bad actuator decision; it can only improve the inputs to the plan.

**Next review:** measure wasted RAM and redeploy frequency, then use formulas
only if a more exact hypothetical server state would change allocation.

### R4 — Use exact target economics and ramp cost

R4 is the highest-value formulas candidate. Target ranking must include
growth limitation, security, hack chance, time, available threads, and the
cost of ramping a target from its current money state. The current code can
approximate much of this with 0–1GB calls, but Formulas.exe can evaluate
hypothetical server states at minimum security and chosen money levels.

**Plan:** build a pure `computeTargetScore` comparison function with a mock
server/player fixture, then compare:

- current-state estimates;
- minimum-security estimates;
- ramp-adjusted effective income over a long horizon.

Only replace the live scorer if the ranking changes materially and a replay
or controlled live sample confirms higher income. This is the clearest place
where Formulas.exe may pay for itself.

### R5 — Redeploy per script

R5 limits collateral disruption when one action's thread count changes. It
protects weaken latency and reduces security ratchets. No formulas dependency
is needed.

**Next review:** measure plan flips, process kills, security recovery time,
and income per second before considering any formula-driven refinement.

### R6 — Treat XP as a separate objective

R6 changes the hack/grow split and target selection when the objective is XP.
The core result comes from cycle time and RAM, not Formulas.exe. Formulas.exe
could help compare hypothetical targets at common security and player state,
but it should not be introduced until `OBJECTIVE="xp"` is actually active.

**Gate:** defer XP-specific formula work until an augmentation cycle makes XP
the bottleneck.

### R7 — Take cheap capacity wins

R7 uses home RAM, corrects grow-security reservation, and tidies the security
cap. These are capacity and API correctness improvements. They should be
completed before buying complexity: an exact formula cannot compensate for
RAM left idle or incorrectly reserved.

**Next review:** measure free RAM, core bonuses, grow reservation, and actual
income before and after each cheap item.

### R8 — Formulas.exe audit layer

R8 is not just a written review and it is not an automatic rewrite of the
live scripts. It is an executable review-and-validation pipeline that can
produce code recommendations backed by tests and live evidence. The safe
sequence is:

```text
formulas review
→ pure calculator
→ unit tests and assertions
→ shadow comparison
→ live measurement
→ deliberate integration
```

After R1–R7 are stable, add a formulas-backed comparison layer rather than
scattering `ns.formulas.*` calls through the manager.

#### R8.1 — Senior developer defines the decision under review

Write one short design note for each candidate decision:

- What decision does the script make now?
- Which inputs does it use?
- Which formulas calculation might improve it?
- What does “better” mean: income, XP, reputation, time, RAM, success rate,
  or fewer failures?
- What behavior must not change?

Start with one decision only—recommended first candidate: R4 target scoring.
Do not review every formulas namespace simultaneously.

**Deliverable:** one decision contract and a list of measurable success and
failure conditions.

#### R8.2 — Junior coder builds a pure calculator

Create a small module with no `ns` calls and no game side effects. It should
accept plain input objects and return plain output objects. For example:

```js
export function computeFormulaTargetScore({ server, player, pool, horizon }) {
  // return score, rampSeconds, assumptions, and warnings
}
```

The live script should remain responsible for reading the game state. The
calculator should not buy, hack, deploy, restart, or mutate global state.

Return enough explanation to inspect the result later:

- normalized inputs;
- formula version/tag;
- predicted income or outcome;
- ramp cost;
- recommended target/action;
- warnings for missing or suspicious inputs.

#### R8.3 — Add assertions and unit tests

Assertions are part of the feature, not optional polish. Add tests for normal,
boundary, and invalid cases:

- money is between zero and maximum money;
- security is at least minimum security;
- thread counts are finite, non-negative integers;
- predicted time is positive and finite;
- a zero-capacity pool cannot produce positive income;
- a non-hackable target returns an explicit ineligible result;
- increasing available RAM cannot reduce the computed achievable capacity;
- the fallback calculation agrees with known API-derived values within a
  documented tolerance;
- invalid or incomplete formula inputs fail closed with a warning, not a
  live action.

Use the repository's existing `node --test` style. Keep fixtures small and
hand-readable so a junior coder can diagnose a failure without opening the
game source.

#### R8.4 — Add a differential test against the current implementation

For a fixed set of server/player fixtures, calculate both:

1. the current production estimate; and
2. the formulas-backed estimate.

Report the difference rather than assuming the formulas result is superior.
The senior developer reviews every large difference and labels it as one of:

- expected correction;
- input mismatch;
- unit/convention error;
- formula API misunderstanding;
- production bug;
- harmless numerical variation.

No live code change is authorized from an unexplained difference.

#### R8.5 — Add shadow mode to the live script

Shadow mode reads the same live state as production and computes the new
recommendation, but does not act on it. Each shadow record should include:

```text
timestamp
scriptVersion
formulaVersion
target/action chosen by production
target/action recommended by formulas
all decision inputs
predicted score/income/time
observed result on the next measurement
```

Shadow mode must be independently switchable and must not change the normal
RAM allocation or order of side effects. If it is too expensive to run every
tick, sample it at a bounded interval.

#### R8.6 — Define live assertions and invariant counters

Assertions that can safely run in-game should raise a toast/status counter and
record the offending inputs. They should not crash the income engine for a
recoverable data problem. Examples:

- formulas score is finite;
- selected target is still rooted and hackable;
- requested threads fit the measured available RAM;
- predicted target money does not exceed `moneyMax`;
- a recommendation is not based on stale or missing server data.

Unexpected exceptions still use the project's invariant path: visible alert,
status counter, and event record—not a swallowed print-only message.

#### R8.7 — Measure the shadow recommendation

Collect enough observations to compare decisions fairly. For R4 target
scoring, record at least:

- income per second;
- target changes per hour;
- ramp duration;
- average target money percentage;
- security floor time;
- redeploy count;
- RAM utilization;
- prediction error.

Compare the same target pool and objective. Do not mix money-mode and XP-mode
results, or pre/post augmentation data, without labeling the population.

#### R8.8 — Senior review and code recommendation

At the end of shadow collection, produce a short recommendation with one of
three outcomes:

- **Adopt:** formulas decision is measurably better and safe.
- **Keep shadow-only:** useful diagnostics, but no demonstrated improvement.
- **Reject:** wrong model, too expensive, or harmful to another subsystem.

The recommendation must name the exact production functions/configuration it
would change, the expected benefit, the observed evidence, and the rollback
command or patch.

This is where R8 produces code recommendations. The review of Formulas.exe by
itself only identifies available calculations; R8 supplies the tested bridge
from those calculations to production changes.

#### R8.9 — Deliberate integration and rollback

If the senior review says Adopt:

1. Update the pure calculator and production integration in one change.
2. Keep the old calculation behind a fallback/config flag for one validation
   cycle.
3. Run the full local test suite.
4. Syntax-check every changed Netscript file.
5. Push through the custom Remote API daemon.
6. Restart the affected game script; Bitburner does not hot-reload.
7. Confirm the live script version and first status/event records.
8. Compare against the pre-change baseline.
9. Remove the fallback only after the rollback window passes.

#### R8.10 — Team split for junior coders led by a senior

**Senior developer:** owns the decision contract, API interpretation, review
of formulas assumptions, acceptance thresholds, and production promotion.

**Junior coder A:** builds the pure calculator and fixture inputs.

**Junior coder B:** writes boundary/property tests and differential reports.

**Junior coder C:** adds shadow-mode telemetry and status fields, following
the existing event/invariant conventions.

**Senior plus one junior:** performs live deployment, observes the first
window, and executes rollback if any stop condition fires.

No junior task should independently change live allocation, stock orders,
augmentation behavior, or an always-on supervisor.

#### R8.11 — Promotion gates

Do not promote a formulas-backed decision unless all gates pass:

- local tests pass;
- invalid-input assertions pass;
- differential discrepancies are explained;
- shadow mode has enough labeled observations;
- no meaningful RAM or latency regression;
- the primary metric improves or remains within the agreed tolerance;
- secondary systems do not regress;
- rollback is tested or trivially available;
- the senior developer records the decision and version.

Candidate namespaces, in order of likely relevance to this repo:

- `formulas.hacking` — target ranking, hack chance/percent, times, grow;
- `formulas.hacknetNodes` / `hacknetServers` — purchase and upgrade return;
- `formulas.dnet` — darknet operation time/success economics;
- `formulas.reputation` and `formulas.work` — faction/company work choices;
- `formulas.gang` — only if a gang becomes active;
- `formulas.bladeburner` — only if Bladeburner becomes active.

IPvGO and stocks remain outside this R8 layer: there is no Go formulas
namespace, and stock decisions already use the stock API/4S data path.

## Senior review before implementation

This plan is deliberately not yet a work order. Before a junior coder starts,
the senior developer should approve the following decisions in writing.

### Review gate 1 — Confirm the real API surface

Do not infer availability from an interface name or from a remembered version
of Bitburner. Confirm in the installed game/build which namespaces and
signatures are callable after owning Formulas.exe. Record:

- namespace and function name;
- required object shape;
- return units and conventions;
- RAM cost;
- player/server fields that must be supplied;
- whether the function is usable in the current BitNode.

If a function is not confirmed, it stays out of production code and is marked
`unknown`, not approximated as fact.

### Review gate 2 — Select one decision and freeze the baseline

R4 target scoring is the recommended first candidate, but the team must first
capture a baseline from the current live system:

- current script version and config;
- target-selection inputs and selected target;
- income per second over a fixed window;
- target switches and redeploys;
- RAM and CPU timing;
- errors/invariant violations;
- current objective (`money` or `xp`).

The baseline is immutable. A junior coder must not “clean up” production code
while collecting it, because that would make the comparison uninterpretable.

### Review gate 3 — Define ownership and change boundaries

The senior developer owns the production boundary. Junior work is limited to
pure calculators, fixtures, tests, parsers, and shadow telemetry until an
explicit promotion decision is made. No experimental formulas call may:

- buy or sell stocks;
- change a target;
- launch or kill worker scripts;
- change augmentation or faction behavior;
- alter the supervisor or restart path.

Every new field must have one owner, one writer, one documented unit, and one
consumer. This prevents the parallel-field drift already identified elsewhere
in the repository.

### Review gate 4 — Make the experiment falsifiable

Before shadow mode starts, write down what would prove the formulas approach
wrong. Examples:

- target ranking changes but realized income does not improve;
- prediction error is larger than the current heuristic's error;
- RAM or move time rises beyond the agreed budget;
- target switching increases without a compensating income gain;
- one objective improves while another silently regresses.

“The formulas result looks more exact” is not an acceptance criterion.

### Review gate 5 — Use a staged branch and artifact checklist

Each candidate change should have these artifacts before live deployment:

1. decision contract;
2. API note with source/version evidence;
3. pure calculator;
4. fixture set;
5. unit/property tests;
6. differential report;
7. shadow schema and sample records;
8. baseline comparison;
9. rollback patch or configuration switch;
10. senior sign-off.

Missing artifacts block promotion. This lets a junior team work in parallel
without allowing incomplete work to become a live economic change.

### Review gate 6 — Treat telemetry as a product

Shadow data must be bounded, versioned, and useful after a restart. Prefer a
small capped event log or summary file over unbounded per-tick output. Every
record needs enough context to reproduce the decision later; at minimum:

```text
timestamp, runId, scriptVersion, formulaVersion, objective,
target, inputHash, productionDecision, shadowDecision,
prediction, observedOutcome, errorClass
```

If the game cannot write a desired extension, use a supported text extension
and document the content format. A caught write failure must increment the
invariant counter and surface visibly.

### Review gate 7 — Promotion is a decision, not a merge

The senior developer reviews the evidence and records one outcome:

- **Adopt:** integrate behind a fallback and monitor;
- **Shadow-only:** retain the diagnostic because it is informative but not
  demonstrably better;
- **Reject:** remove it because it is wrong, too costly, or destabilizing.

The code review must state what changed, what did not change, how to roll it
back, and which live metric will decide whether the fallback is removed.

## Current forces and how they relate to IPvGO

| Existing force | Current role | IPvGO relationship | Decision |
|---|---|---|---|
| `ipvgo_player.js` + `ipvgo_logic.js` | MCTS/UCB1, opening priors, local rules simulation | The direct strength engine | Preserve; measure before changing |
| `ipvgo_status.json` / HUD | Persistent record, rolling win rate, opponent stats | Supplies evidence for tuning | Make opponent/board/algorithm dimensions explicit |
| `mcp.js` | Main hacking income manager | Funds RAM, servers, augments, and future capacity | Keep primary income protected |
| Rooted worker pool | Provides hacking throughput | Indirectly funds IPvGO-related capacity | Do not sacrifice it for speculative Go gains |
| Home RAM | Runs manager, supervisors, panels, and optional workloads | Determines whether higher simulations are affordable | Measure free RAM before raising simulations |
| `share_deploy.js` | Converts RAM into faction reputation while faction work is active | Can improve faction progression, but does not improve move quality | Use only when actively doing faction work |
| Stock trader / `mcp_stocks.js` | Capital growth and market visibility | No direct Go benefit | Leave unchanged |
| Darknet automation | Credentials, models, loot, and income | Indirect money/reputation progression; can compete for RAM | Keep separate and avoid starving IPvGO |
| Formulas.exe | Exact formulas for hacking and other supported systems | No `ns.formulas.go` API exists | No direct IPvGO use |
| Augmentations | Improve player stats and reset active positions/scripts | Can improve income and long-term capacity; resets IPvGO state | Finish/stop active games before installs when possible |
| Source Files | Unlock special capabilities | `ns.go.cheat.*` requires SF14.2; not a legitimate current lever | Do not plan around cheats |
| Remote API daemon | Pushes tested code and pulls telemetry | Required for reliable deployment/evidence | Keep it running before live experiments |

### The key resource is not money alone

IPvGO strength is constrained by the product of search quality and usable
time per move. More RAM only helps if it permits more simulations without
starving the shared game loop. The current player deliberately moved expensive
chain/liberty work into local pure JavaScript, dropping its estimated live
cost from roughly 34GB to roughly 18GB before the latest measured run. That is
the right architecture: use the game API only for authoritative state and
move submission; do hypothetical play locally.

## What Formulas.exe changes

Formulas.exe is valuable for hacking and other supported formula namespaces,
but it does not expose a Go formula namespace. It cannot directly calculate a
better move, territory value, or Go win probability. It can improve the wider
economy that funds RAM and augmentations, so its IPvGO value is indirect.

Do not add a `formulas` dependency to `ipvgo_player.js` unless a future game
version exposes an actual Go formula surface. It would add conceptual weight
without adding move information.

## Algorithm ladder, from cheapest to strongest

### Level 0: stabilize and measure — do this first

- Keep the current live version unchanged while the 7/8 result is fresh.
- Record every completed game with opponent, board size, algorithm tag,
  color, score margin, move count, average/max move time, and result.
- Report Wilson or confidence intervals, not just a raw percentage.
- Compare only the same algorithm generation; do not dilute a new version
  with old losses.
- Identify whether losses are tactical collapses, endgame scoring losses,
  opening losses, or timeout/performance failures.

**Cost:** no meaningful RAM or code risk.  
**Expected value:** highest information per unit effort.

### Level 1: low-cost tactical rollouts — current candidate

The local change makes sampled rollouts prefer captures. The next small
extension, only if the current change holds, is to recognize one-liberty
friendly chains and prefer legal saving moves during rollouts. Keep this
sampled rather than scanning every point with the 16GB live analysis API.

**Cost:** negligible RAM; small CPU increase.  
**Risk:** a tactical bias can overvalue local fights; gate it with tests and
head-to-head games.

### Level 2: progressive bias

Add a small, decaying prior to move selection for cheap static features:

- captures;
- saving an atari group;
- connecting friendly networks;
- cutting a vulnerable enemy connection;
- avoiding self-atari;
- corner/edge/center preference conditioned on game phase.

The bias must decay as visits increase so search evidence eventually
overrides the heuristic. This is the principle described by Chaslot et al.'s
progressive-bias work, rather than a permanent hand-written move ordering.

**Cost:** low code/RAM cost.  
**Expected value:** useful when the simulation budget is small.

### Level 3: RAVE/AMAF or a compact transposition table

RAVE shares information about moves seen later in a simulation with their
earlier action estimates, which is particularly useful in Go's large
branching factor. A transposition table shares statistics for repeated board
states. Implement only one first:

- **RAVE:** likely better early-search efficiency, but more bookkeeping and
  possible bias.
- **Transpositions:** conceptually simpler, but needs a correct board hash
  including side to move and ko state, plus a bounded memory policy.

The research literature treats RAVE as a standard MCTS improvement for Go,
while KataGo's public implementation explicitly uses graph-search/cache ideas
for repeated positions.

**Cost:** medium implementation effort; bounded memory required.  
**Gate:** only after the current version has a reliable baseline sample.

### Level 4: score-aware search

The current MCTS backpropagates win/loss, which matches the 90% objective but
throws away margin. Add a secondary score signal carefully:

`reward = win + small_margin_weight * normalized_score_margin`

The win component must dominate. This can improve endgame choices without
turning a winning position into a risky margin chase. KataGo's design is a
useful reference because it predicts both outcome and score/ownership rather
than outcome alone.

**Cost:** medium; requires fixture tests around komi and area scoring.  
**Risk:** optimizing margin too aggressively can lower win rate.

### Level 5: external policy/value model — deferred

AlphaZero/KataGo-style neural policy and value guidance is the strongest
general direction, but it is outside the low-cost Bitburner plan. It needs an
external training/inference pipeline, model assets, transport, and careful
latency control. Formulas.exe does not substitute for that model.

**Decision:** defer unless the simpler search ladder plateaus and an external
runtime is explicitly approved.

## Bitburner-specific operating plan

### Runtime and RAM

- Keep IPvGO isolated from `mcp.js` worker allocation where possible.
- Measure `ns.getScriptRam()` in the live game rather than trusting arithmetic
  estimates.
- Measure average and maximum move time after every search change.
- Never raise simulations and add a new heuristic in the same experiment.
- If move latency approaches the shared-loop danger zone, revert the change
  before judging its win rate.

### Income and capacity

- `mcp.js` remains the protected source of growth.
- Formulas.exe should improve hacking calculations only where it produces a
  measured throughput benefit.
- Do not divert RAM to `share_deploy.js` unless faction work is actively
  running; otherwise it burns capacity without the intended reputation gain.
- Darknet jobs should be treated as a separate RAM consumer and measured for
  opportunity cost before being allowed to crowd out the farm.
- Stock trading remains independent and unchanged.

### Augmentation and reset discipline

Augmentation installs reset active scripts and IPvGO in-memory state. Before
an install:

1. Let the current game finish if practical.
2. Pull `ipvgo_status.json` so the record is not stranded in the save.
3. Install augments.
4. Restart the suite and IPvGO explicitly.
5. Confirm the algorithm tag and persisted counters before comparing results.

### Deployment discipline

The custom Remote API daemon is the source-of-truth deployment path. The
expected flow is:

```bash
python3 tools/bb_remote.py daemon --port 12526 --control-port 12527
python3 tools/bb_remote.py ctl-push ipvgo_logic.js ipvgo_logic.js
python3 tools/bb_remote.py ctl-push ipvgo_player.js ipvgo_player.js
```

Then in-game:

```text
run ipvgo_player.js
```

Always verify the live copy and pull status after a search change. The game
does not hot-reload a running script.

## Experiment matrix

Change one variable per block and stop early if the player regresses.

| Block | Version | Opponent | Games | Keep if |
|---|---|---|---:|---|
| A | Current baseline | Current opponent | 20 | establishes the comparison |
| B | Tactical rollout | Same opponent | 20 | win rate improves without latency regression |
| C | Tactical rollout | Next harder opponent | 20 | no catastrophic tactical-loss pattern |
| D | Progressive bias | Same opponent | 20 | beats B on matched conditions |
| E | RAVE or table | Same opponent | 20 | beats D with acceptable timing/RAM |

Use the same opponent and board size within each comparison. A single 7/8
sample is encouraging but too small to distinguish a durable gain from a
short streak.

## Stop conditions

Stop and revert an upgrade if any of these occur:

- live runtime error or stale deployment;
- move latency threatens the shared game loop;
- the player repeatedly loses obviously won tactical fights;
- rolling win rate drops materially over a matched sample;
- RAM pressure causes `mcp.js` income or other essential automation to
  degrade;
- a change improves score margin but lowers actual wins.

## Research basis

- [AlphaGo Zero: Starting from scratch](https://deepmind.google/blog/alphago-zero-starting-from-scratch/)
  — policy/value-guided MCTS and self-play as the high-end direction.
- [Accelerating Self-Play Learning in Go (KataGo)](https://arxiv.org/abs/1902.10565)
  — efficient training, score/ownership targets, and domain-specific search
  improvements; useful as a design reference, not a Bitburner dependency.
- [Progressive Strategies for Monte-Carlo Tree Search](https://project.dke.maastrichtuniversity.nl/games/files/articles/pMCTS.pdf)
  — progressive bias and progressive unpruning.
- [Continuous Rapid Action Value Estimates](https://proceedings.mlr.press/v20/couetoux11.html)
  — RAVE-family methods for faster early action estimates.

## Bottom line

The whole-game objective is compounding capability. `mcp.js` is the economic
engine; RAM and rooted hosts are the throughput base; augmentations and
factions are permanent progression; darknet and stocks are optional income or
access multipliers; Formulas.exe improves exact calculations where supported;
and IPvGO is one reputation/favor activity with its own 7/8 result and 90%
long-run target. Keep those priorities visible so an attractive local win in
one subsystem does not quietly weaken the position as a whole.
