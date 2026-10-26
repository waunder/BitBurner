# Gang-first strategy assessment — 2026-10-25

## Recommendation

Treat “all in on gang” as a staged allocation toward the current gang bottleneck,
not an immediate permanent switch of all members to faction-reputation tasks.
The live gang is already the larger projected cash engine than MCP, but wanted
is not yet fully recovered and territory is at its 1/7 starting share. First
stabilize wanted, then finish the bounded combat floor and test safe power
building. Only after those gates should a short reputation-focused allocation
be compared with the money baseline. Keep MCP money as the default during the
first gang trial; the current faction-reputation balance is approaching the
near-term 50k Black Hand gate, while the separately documented QLink target is
much farther away and cash remains far below its historical cost.

No objective change, clash activation, equipment purchase, augmentation, or
reset was made for this assessment.

## Evidence and freshness

Live reads below came from the Steam save through the Remote API on 2026-10-25.
The daemon health check was connected at 15:03:41 PDT, with 104 source files
synced and a full 29/29 telemetry pull, with no failures. Full source and
telemetry passes last completed at 14:26 PDT; the direct gang read below was
fresh at 15:03:44 PDT. Other listed observations retain their own earlier
timestamps.

| Source | Time (PDT) | Observation |
|---|---:|---|
| `gang_status.json` | 15:03:44 | 12 members; money objective; `territory-training`; respect 92,183; wanted 3,070; wanted multiplier 0.96777; wanted rising 0.3633 per game cycle; faction rep 39,315.6 at observed +1.397/s; territory 0.142857; power 1; weighted clash chance 0.0498; clashes off. Five members train combat and seven run Money Laundering. |
| `mcp_status.json` | 14:57:38 | Money objective; finite multi-target harvest on Max Hardware; average cash rate $190.3k/s; 97.7% RAM use; 184 completed batches; no worker launch failures. One instantaneous sample was $0 between batches, so use the rolling average. |
| Gang capital ROI window | 14:56:54 | Observed whole-player net cash +$1.847m/s for the controller's latest 60-second window. This is not gang-only attribution. The controller's formula projection was $312.7k per game cycle, about $1.56m per active game second at five cycles per second. |
| Local handoff | 14:29 | Says MCP XP; stale versus live MCP status and `mcp_objective_override.txt`, both now money. |
| `mcp_multi_status.json` | 2026-08-30 | Stale; excluded from current comparisons. |

The current gang telemetry is from the previously deployed controller: its
territory-power fields are absent. The source changes described below are
local and un-deployed. `mcp-xp-yield-2026-10-25.md` records prior XP trials:
the 50/50 split produced phase-inclusive medians around 401–425 XP/s, while
the 60/40 window was only 2–8% above the two controls and was not phase-matched.
Those are historical XP measurements, not the live objective or a direct
cash-versus-XP comparison.

## What the returns mean

Gang money and gang faction reputation come from the same member task choices.
Gang respect gains also increase the gang faction's reputation automatically;
the game applies faction-reputation and favor multipliers to respect gains.
Current gang status shows about +1.31 faction rep/s, but that short observed
rate may include other concurrent work and is not a clean gang-only marginal
rate. The script's reputation objective assigns trained members to the best
respect tasks, preserving a cleaner subset when wanted recovery is active.

At the current live cash projection, the gang yields roughly 8 times MCP's
rolling hacking cash rate, before accounting for the whole-player net window.
Moving all trained members to respect tasks will forfeit some gang cash. It
does not directly replace MCP XP: keep MCP in XP only when hacking level is the
binding progression constraint, and compare its measured XP/s with the next
level or objective gate. The current live MCP configuration is money, not XP.

Territory is a long-run productivity input, not a guaranteed immediate win.
Official game formulas apply task-specific territory exponents and a
GangSoftcap to money/respect; the return is not a simple linear multiplier.
The official Gang implementation builds power only from members on
`Territory Warfare`; without that task, power remains at 1. Territory/power
updates happen every 100 game cycles, and the current controller's training
does not itself build power. Territory clashes can kill only members assigned
to that task, including after a win. Official source references:
[gang formulas](https://github.com/bitburner-official/bitburner-src/blob/dev/src/Gang/formulas/formulas.ts),
[gang implementation](https://github.com/bitburner-official/bitburner-src/blob/dev/src/Gang/Gang.ts),
[member implementation](https://github.com/bitburner-official/bitburner-src/blob/dev/src/Gang/GangMember.ts),
[gang guide](https://github.com/bitburner-official/bitburner-src/blob/dev/src/Documentation/doc/en/advanced/gang.md).

## Proposed stages

### 1. Recover wanted without starving the gang

The fresh multiplier 0.96777 is below the local policy's 99% entry threshold.
After the controller update is deployed, money-mode cleanup should assign the
minimum cleaner subset meeting the normal target of 0.1% wanted reduction per
ten-cycle update; severe 4% cleanup is reserved for multipliers below 5%.
Keep recruitment, money earners, and combat training intact where possible.

**Pass gate:** wanted multiplier at least 99.5% of the respect-dependent
maximum attainable value, wanted level flat or falling for 10 consecutive
minutes, and no cleaner/assignment fault. Record gang money/cycle, respect/cycle,
wanted/cycle, cleaner count, and MCP average cash rate.

**Stop rule:** if wanted rises by 10% or 10,000 between five-minute reads, or
the gang income falls more than 50% while wanted is not declining, suspend
territory training/power work and restore the strongest available cleanup.

### 2. Finish combat training with a bounded cohort

The live roster is full; five members are currently on Train Combat and seven
are earning Money Laundering. Keep the current 300 minimum combat floor and
continue selecting the lowest-money opportunity trainees. Do not train all 12.

**Pass gate:** every member reaches combat floor 300. Track floor completion
time, gang money/cycle, respect/cycle, and wanted multiplier. If training takes
more than 30 minutes without a clear upward skill trend, review task selection
and ascension/equipment effects before expanding the cohort.

### 3. Build power without clash exposure

After wanted recovery and the combat floor pass, assign at most 35% of the
lowest-cash-opportunity trained members to Territory Warfare during money mode.
The rest keep earning. The local controller fix now creates this missing
power-building phase and only assigns the task when the live residual
`territoryClashChance` is zero. It leaves the phase off during wanted recovery
and faction-reputation mode.

**Pass gate to consider clashes:** power and each rival's win chance trend up;
every rival with territory must be at or above 90% win chance, and territory-
weighted expected chance must be at least 90%. Do not widen the cohort before seeing a positive power
and odds slope. Review after 30 minutes; continue only if the observed slope
projects reaching the clash gate within a bounded window (suggested cap: four
hours) and formula projections show the future territory productivity gain can
repay the lost earnings.

**Stop rule:** if power or best-rival odds are flat/declining for 30 minutes,
return the builders to money mode. If the odds gate fails while clashes are on,
disable immediately; the controller removes members from Territory Warfare
and waits for the API clash chance to reach zero before resuming power building.

### 4. Use a short, gated clash pilot

Once the odds gate passes, engage with only the 35% builder cohort on Territory
Warfare; keep the other members on cash tasks. Use the 90% per-rival and
weighted entry gates. Keep all builders at 300 defense or higher.

**Stop-loss:** disable clashes on any member death, any sustained territory
loss, weighted chance below 90%, or any rival below 90%. The controller fails
closed if any rival's odds are missing or invalid. These are conservative
operational cutoffs, not game guarantees.
An individual death costs at least 5% of gang respect plus that member's earned
respect, so the downside is larger than replacement-training time alone.
After any stop, keep fighters off the warfare task until the live clash chance
returns to zero. Record territory delta, power delta, wins/losses/deaths, money
rate, respect rate, and wanted rate.

### 5. Compare faction-reputation mode only after the preceding gates

Run a reversible 30-minute reputation window and a matched 30-minute money
window with player activity, equipment, roster, territory, and MCP objective
held constant. Repeat in A/B/A order if progression is stable enough. Compare
actual faction-reputation delta/s and player cash delta/s; also record respect,
wanted, and assignment role totals. Do not infer marginal gang reputation from
a single observed whole-faction rate.

Keep reputation mode only while it materially shortens time to a named
gang-faction reputation gate and does not block a nearer money or XP gate. The
near-term gate named for this run is 50k Black Hand reputation. Live faction
rep was 39,315.6 at 15:03:44 PDT, leaving about 10,684; at the short observed
rate of +1.397/s that is roughly 2.1 hours if the rate held. This is a rough
constant-rate estimate, not a forecast or a clean gang-only marginal rate.
Measure the actual delta during the bounded reputation/money comparison before
deciding how much gang cash to trade for reaching that gate.

### Selective augmentation budget at the 50k gate

Ken's purchase filter for this run is hacking-related effects, broad skill
experience, and non-company reputation; exclude Hacknet and company-reputation
only effects. Do not count an augmentation as reachable just because its
reputation threshold is at or below 50k: it must be offered by a faction the
player has joined, and all prerequisites must be owned. Gang reputation only
advances Black Hand reputation; it does not unlock NiteSec or CyberSec offers.

Fresh evidence: the Steam Black Hand augmentation page around 15:10 PDT showed
39.55k Black Hand reputation, a 1.9x queue multiplier, and one queued item
(`LuminCloaking-V1 Skin Implant`). The Remote API `augmentation_readiness.json`
at 15:09:41 PDT showed $8.328b cash, five installed augmentations, and the same
single queued item. Its faction rows showed CyberSec at 3.538k and NiteSec at
12.441k reputation. The connection was healthy at 15:05 PDT with a fresh full
sync and 29/29 telemetry pull.

At current memberships and faction standings, the currently-rep-ready target
set by the filter is Neurotrainer I, Neurotrainer II, BitWire (only 212 rep
short at the snapshot), and Synaptic Enhancement Implant, plus Neuralstimulator
when Black Hand reaches 50k. The game shows Neuralstimulator at $5.7b with the
existing 1.9x multiplier. Using base prices from the installed v3.0.1 game
data, queueing all five in descending base-price order costs about $6.13b
starting with the existing queued item. That fits the $8.33b live balance with
about $2.20b remaining, before future income or any unrelated spending. This is
a price projection, not a purchase instruction; the UI states each queued
augmentation raises later prices and installation resets the multiplier.

The Cranial Signal Processor line needs a separate NiteSec reputation plan.
Cranial Signal Processors II needs 18.75k NiteSec rep (currently 12.441k) and
is a prerequisite for Black Hand's 50k Cranial Signal Processors III. Including
both with the five-item set raises the optimized queued cost to about $11.47b.
NiteSec Neural Retention Enhancement (20k) and CRTX42-AA Gene Modification
(45k) are also hacking/experience candidates, but 50k Black Hand rep does not
unlock them. Including CSP II, CSP III, Neural Retention Enhancement, and
CRTX42 in the five-item set yields a nine-item queue costing about $24.33b, and
requires separately reaching the NiteSec rep gates. No faction-reputation
multiplier is offered by the currently joined factions within this rep range;
ADR-V1 is offered by other factions.

Recommendation: keep 50k as this run's purchase target and defer the valuable
50–100k tier to the next run if an install is chosen. Black Hand's own
100k-rep The Black Hand augmentation and Enhanced Myelin Sheathing are strong
hacking upgrades. The 62.5k ADR-V2 Pheromone Gene also qualifies for the
faction-reputation filter (it boosts both faction and company rep), and
75k FocusWire qualifies for broad experience, but neither is offered by the
currently joined factions. Recent observed gang-rep rates vary enough that the
extra 50k to reach 100k could take roughly 10–21 hours if those snapshots held.
Rebuild with the 50k hacking set, then pursue higher-rep offers next run after
joining a faction that sells them. Re-read faction standings and cash before
any purchase or installation review. Official game source for effects, costs,
factions, prerequisites, and rep requirements:
[augmentation data](https://github.com/bitburner-official/bitburner-src/blob/dev/src/Augmentation/Augmentations.ts).
The general queue-and-reset behavior is described in the
[augmentation guide](https://github.com/bitburner-official/bitburner-src/blob/dev/src/Documentation/doc/en/basic/augmentations.md).

QLink is a separate, longer-horizon optional target, not the only relevant
reputation objective. The September 11 assessment documented 1.875m reputation
and $50T; those requirements have not been re-read live in this assessment.
Current cash was $8.33b at 15:09:41 PDT. At the latest whole-player net cash
window of $1.847m/s, the historical $50T price would take roughly 313 days
from the current balance if that rate held. Both QLink estimates are highly uncertain
and the cash estimate excludes any gang-reputation allocation. Do not use the
QLink horizon to defer the nearer 50k Black Hand gate.

## Ascension and equipment policy

Keep ascensions suppressed during a reputation window to preserve the gang's
stored respect pool. On ascension, the game removes the member's earned respect
from gang respect; it does not subtract faction reputation already earned.
Lower gang respect can indirectly reduce future task output and faction
reputation rate through the wanted penalty. Outside the reputation window,
preserve the current 1.25 ascension threshold only when formula-projected task
output can recover the lost gang respect promptly. Compare each candidate's
immediate money/respect output before and after rather than ascending by
multiplier alone.

Keep equipment purchases disabled during this assessment. The fresh controller
candidate was NUKE Rootkit at $4.43m for projected +$20.72 per game cycle,
payback about 213,814 seconds (59.4 hours); it fails the current 30-minute
payback gate. This estimate is money-task-only and does not price combat or
respect gains. Do not buy it for territory or reputation without a separate
formula-based incremental return and a cash-reserve case.

## Script fix completed locally

The controller now has a tested Territory Warfare builder allocation after the
300 combat floor, restricted to full-roster money mode with wanted recovery
inactive. It selects the lowest projected cash earners for the 35% cohort and
engages clashes only when every rival odds gate passes. Ascensions are skipped
during cleanup and power building, limited to one per loop, and blocked when
the projected respect deduction would cross the cleanup-entry floor. Assignments are withheld while
the live residual clash chance is positive, which avoids exposing builders
after a clash toggle-off. Reputation and wanted-recovery allocations retain
priority. This local source change is not deployed; do not treat live gang
status as evidence that the fix is running.
