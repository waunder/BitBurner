# Opportunities and flaws

Running list kept by Claude on its own initiative (Ken, 2026-11-16: "exercise initiative in searching
for flaws and opportunities"). Newest first. Each entry: finding, evidence, expected gain, status.
The 2-hourly check reviews this once per cycle (first run after an install).

## Open

- **Sleeves on money crime vs building contract capability.** Four sleeves commit Homicide for money
  while their Bladeburner contract odds sit below the 0.8 bar (Bounty Hunter ~0.53). Training combat
  (gym) or Field Analysis might put more sleeves on contracts within the cycle. Evidence needed: sleeve
  money share of income vs rank from one more contract sleeve. Status: to measure.
- **Install cadence in BN6.** Installs keep Bladeburner rank and skills, so the usual cost of an install
  is lower here; more frequent installs may compound stat multipliers faster. Evidence needed: rank/h
  before and after each install (`metrics.py cycles` once rank is logged). Status: to measure.
- **Bladeburner rank not in metrics_logger.** Rank/h is only in bladeburner_status.json (1h window), so
  cycles cannot be compared. Gain: every Bladeburner tuning decision becomes measurable. Status: next.
- **Bladeburner skill value model.** Points went to Reaper, Evasive System and Cyber's Edge as well as the
  weighted skills; check the value-per-point weights against measured success-chance gains. Status: to review.
- **Stamina rest thresholds (0.55 / 0.95).** Unmeasured share of time spent in the regeneration chamber;
  a narrower band or Training while low might earn more. Status: to measure.

## Done

- 2026-11-16 **Sleeve augmentations never bought in BN6** (Ken's question). sleeve_buyer.js exited outside
  BN10. Fixed f4d8ecd; then per-sleeve batches, combat list, contract-odds priority (cbb0d37). Measure
  sleeve odds and rank/h next cycle against this one (baseline: no sleeve augs).
- 2026-11-16 **Nothing read script status files.** tools/audit.py added (b916843) and put in the 2-hourly check.
- 2026-11-16 **Two crawler.js copies running.** crawler.js now replaces older copies (5b226f2).
