# The hands-off test

Ken, 2026-11-22: "Yes, make it the test". BN12 run 3 runs untouched; run 2 is for preparing it. The question
is whether the scripts and monitoring are approaching their end state.

## Pass marks

1. **Needs nobody** from entry to a ready World Daemon. Every intervention is logged below with its cause.
   Ken's reserved decisions (entering, install approval for the run, the World Daemon) are not interventions.
2. **Failures announce themselves** within 5 minutes. A failure found by looking is a miss even if harmless.
   Alarms test delivery (advisor fresh, money arriving, karma moving), not only that scripts run.
3. **Improvement has flattened:** two runs in a row within 5% of the time to a ready World Daemon, waiting
   excluded (BN12 run 1: ~20.6h), allowing for the node getting harder and Source-Files getting stronger.
4. **Smaller:** per-run hand edits derived, stray game scripts (54) and leftover files (~43k) archived then
   pruned (Ken confirms the deletion), STATE.md back to a page.

## Rules during the test

- Check-ins observe and log. They intervene only to stop a permanent loss, and that fails mark 1.
- No code or config changes from entry to the World Daemon.
- Installs need Ken's approval for the run, given before entry. Today that is per run (AGENTS.md).

## Preparation during run 2

| Item | Status |
|---|---|
| Outage watchdog on the Mac, including a fresh node with nothing running | not built; a new service needs Ken's OK (governance.md) |
| Freshness and delivery alarms, on the page | not built (the advisor was blind 12 min under "Nothing needs you") |
| Per-run settings derived: donation rate, Daedalus count, run number, price step | not built |
| Auto install holds by itself in a run Ken has not approved | not built; today it relies on someone creating the pause file |
| Fresh-run rehearsal from a 32GB home in a disposable browser save | not built |
| Auto install recovers from a pill bought but not installed | not built (Codex-todo) |

## Interventions, BN12 run 2 (baseline, not under test)

| Time | Intervention | Cause |
|---|---|---|
| 09:27 | ran startup.js | nothing starts a new run |
| 09:29 | startup slimmed and reordered | crime chooser did not fit at 32GB |
| 09:31 | config corrected | grafting, donation rate and run number left from run 1 |
| 09:45 | capital_manager starts MCP | deadlock at 64GB |
| 09:45 | money crime until 128GB | income halved at 64GB |
| 10:36 | steward displaces xp_filler | install advisor blind from 10:26 |

## After it: BitNode 11, three runs (Ken, 2026-11-22: "I think")

The second exam: does it work in a node it was not tuned on? Run 1 may have a setup session; runs 2 and 3
are hands-off. Read from the installed game's bundle (v3.0.1), 2026-11-22:

- **Gain (SF11):** each queued augmentation raises the next price by x1.824 / x1.786 / x1.767 at levels
  1/2/3 instead of x1.9, in every later BitNode. Company salary and rep +32/48/56%.
- **Node:** ServerMaxMoney 0.01, ServerStartingMoney 0.1, ServerGrowthRate 0.2, ServerWeakenRate 2,
  HackingLevel 0.6, HackExp 0.5, AugmentationMoneyCost 2, CloudServerSoftcap 2, CrimeMoney 3,
  CompanyWorkMoney 0.5, CodingContractMoney 0.25, InfiltrationMoney/Rep 2.5, GangUniqueAugs 0.75,
  WorldDaemonDifficulty 1.5 (hacking 4500), 4S data cost 4. GangSoftcap 1 (BN12 0.8), darknet money 1.
- **Traps in our code:**
  1. The 1.9 price step is hard-coded in aug_install, its logic, readiness, the advisor, valuation_logic,
     money_logic and graft_logic. From BN11 run 2 every plan would overprice batches without any error.
  2. `donationRepGain` (0.9612 for BN12 run 2) must be 1 and `countFillersTo` (31) must be 30.
  3. Income is tuned on hacking (BN12 run 1: ~99.99% of it). At 1% server money, and dearer cloud, the
     stack and cloud rules need re-judging; gang, darknet and crime count for more.
- Needs a `bn11` profile. `profile.py switch` is never run unattended, so entry stays a supervised step.
