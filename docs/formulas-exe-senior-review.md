# Senior review: Formulas.exe work package

> **Superseding governance status, 2026-08-15:** keep shadow-only, but pause
> before another live run until exact source identity, explicit tail opening,
> and retrieval/attestation of the already-produced cumulative output are
> complete. The bounded-shadow approval below was conditional and did not
> authorize production integration.

**Date:** 2026-08-14  
**Decision:** proceed with bounded shadow work; do not integrate into production yet.

## Executive decision

The work completed so far is technically sound and has produced a credible
candidate improvement to R4. The team may proceed to a second shadow phase
using the manager's actual worker pool and a bounded sampling interval.

Production target selection must remain unchanged until the shadow phase shows
better realized income or equivalent income with acceptable timing, RAM, and
stability costs.

## Findings

1. Formulas.exe is live and callable in Bitburner v3.0.1.
2. The pure calculator and tests provide a clean, reusable decision layer.
3. Current-security scoring can materially under-rate grow-limited targets.
4. The pool-sized shadow confirms the effect at realistic thread counts, but
   it does not yet prove realized production income.
5. The first longitudinal observation was confounded by existing workload
   instability: `poolNotIdle` and tick violations were present.
6. IPvGO, specifically `ipvgo_player.js`, was independently identified as the
   cause of the severe game-surface slowdown. It must not be treated as a
   formulas performance result.

## Augmentation lifecycle risk

Formulas.exe ownership after augmentation is currently unknown. The live probe
establishes access only in the current save state. Before making formulas a
runtime dependency, the team must record whether ownership persists, and if
not, the purchase cost and timing required to restore it.

The useful output is divided into:

- reusable formulas knowledge, fixtures, measurements, and validated code;
- runtime formulas access, which may be absent after augmentation.

Any future production adapter must detect unavailable Formulas.exe and fall
back to the existing R4 calculation or remain read-only. It must never assume
that ownership persists or repeatedly purchase it without an explicit economic
policy.

## Approved next work package

1. Keep current R4 production selection unchanged.
2. Run a bounded shadow adapter against the manager's actual pool.
3. Record target, current and hypothetical scores, formulas-call latency,
   sample interval, income, target switches, and invariant violations.
4. Keep the monitor low-frequency and stop it if game responsiveness changes.
5. Compare against a clean baseline with IPvGO player stopped.
6. At the next augmentation, test Formulas.exe persistence before relying on
   it and record the result in this review.

## Promotion gate

No production change is approved until all of the following are true:

- formulas availability and fallback behavior are specified;
- current and hypothetical models are compared over a fixed observation window;
- realized income improves or the same income is achieved with a measurable
  stability benefit;
- formulas latency and RAM cost stay within an agreed budget;
- no unexplained increase in switching, pool-idle, or tick violations occurs;
- the senior developer signs off on the exact production diff.

## Current status

The formulas review is positive but incomplete. We have enough evidence to
continue investigation, not enough evidence to replace the live selector.
