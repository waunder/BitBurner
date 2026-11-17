# Lessons by BitNode, and what carries over

Read this on entering any BitNode, after `STATE.md`. Each lesson: what happened, what to do instead,
and where it is already built in. Newest BitNode first. Started 2026-11-16 at the end of BN6 run 1.

## Every BitNode (general lessons)

1. **Audit on entry: does each script apply here, and is it producing results?** BN6 ran a day and a half
   with `sleeve_buyer.js` exiting at start ("not BitNode 10") and the gang buying nothing (no BN6 gang policy,
   so a BN2-era default applied). Nothing failed loudly; results were simply absent.
   *Do:* run `tools/audit.py` in the first hour and after every install; read each status file's reason,
   not just whether the script runs. *Built in:* audit.py, the 2-hourly check step 4.
2. **Fixed bars stall progress; look for what is not happening.** Black ops sat behind a 0.9 odds bar for
   hours (then 0.6, then 0.35 in game; every one at 0.35+ was won). A sleeve with a near-empty contract held
   idle. *Do:* when a gate is not passed for an hour, question the bar; prefer expected value (chance x
   gain / time, minus failure cost) over thresholds (docs/opportunities.md, "Optimize, don't threshold").
3. **Find the compounding loop early.** BN6 rank went 26k to 1.36m in 13 hours once rank fed skills that fed
   rank. Growth was linear until the blockers above cleared. *Do:* on entry, name the node's loop
   (rank -> skills, money -> RAM -> money, rep -> augs) and remove what slows it first.
4. **Every cash outlet competes with the install batch.** The gang spent $59b in one cycle (6x the batch) for
   no territory power. *Do:* spenders keep cash for the install plan (`reserveInstallPlan` in gang policy;
   the allocator's batch reserve, `docs/allocator-design.md`). Keep `allocator.js` running in shadow in
   every node once home RAM allows (about 5.5GB).
5. **Installs are cheap when the main progress measure survives them.** In BN6 rank, skills and sleeve exp
   survive; rank/h rose after install 4 instead of dipping. Small batches still pay: the 1.9x price ladder
   resets and rep turns into favor. *Do:* in such nodes, install whenever the advisor says so.
6. **Sleeve augmentations: buy early in a cycle, buy the set.** All 7 sleeves took 6 augs in 35 minutes
   after install 4 for $0.71b; contract odds stayed 100% despite the exp reset. *Do:* keep the early-cycle
   rule; the "3 augs per wipe" guard protected nothing there. Next: buy by role (faction work, crime).
7. **A ready end-of-node waits on Ken: notify at once, with a phone push.** BN6's Daedalus was unlocked
   ~19:15 and started 21:40. *Do:* the moment `daedalusReady` or the daemon's level is reached, push a
   notification (Remote Control on, or phone push) and back up the save.
8. **Fresh node: get everyone to Homicide fast.** Shoplift trains only dex/agi; Mug trains str/def at the same pay
   and leads to Homicide (karma for the gang). Until the controllers fit, run the early-crime chooser
   (docs/opportunities.md) or step crimes by hand with crime_now.js / sleeve_crime_now.js.
9. **One-off probes beat guesses.** Small scripts that write one JSON file (bb_probe.js, bn_probe.js,
   sleeve price reads) settled questions in minutes. Delete them after.

## BN6 (Bladeburners), run 1: 2026-11-14 17:15 to 2026-11-16 21:47 (about 52.5 hours)

Code that stays ready: `profiles/bn6/` (bladeburner.js, bladeburner_logic.js, bb_probe.js, gang policy).
BN7 also has Bladeburner and can reuse it.

- **Day one:** 32GB home; Shoplift for player and 7 sleeves; gang karma; join Bladeburner when stats allow.
- **Black ops:** bar 0.35 (`blackOpMinChance` default now 0.35); they gate the chain and pay large rank.
- **Chaos:** hop to a calm city (chaos < 25, enough population) instead of running Diplomacy.
- **Sleeves:** 100% contract odds early; only one sleeve per contract, so the rest infiltrate (up to 4) to
  refill counts. Contract counts, not odds, were the limit.
- **Skills:** Hyperdrive and the success-chance skills compound rank; let the controller spend points.
- **Ending:** Daedalus needs 400k rank and all prior black ops; 7m16s at 100% odds. Enter the next node with
  `ns.singularity.destroyW0r1dD43m0n(N, "startup.js")` after it completes, then `profile.py switch`.
- **Would have been about a day** with these settings from the start.

## Carry to BN10 run 4

Applies directly: lessons 1, 2, 4, 5 (BN10 installs reset more: weigh it), 6, 7. Sleeves are the same
layer; the gang cap is in core gang code (set `reserveInstallPlan` in the BN10 gang policy).
Does not apply: Bladeburner (no SF7).
