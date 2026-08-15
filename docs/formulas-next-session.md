# Next-session handoff: Formulas.exe

> **Governance status, 2026-08-15:** the bounded command below has already been
> reported complete and must not simply be run again. R8 is paused until the
> exact source is attested, explicit tail opening is implemented/tested, and
> the existing cumulative output is pulled and independently parsed.

## Current state

- Formulas.exe was validated live in Bitburner v3.0.1.
- Pure R4 calculator, tests, live probe, one-target shadow, and pool shadow are complete.
- Production target selection has not been changed.
- `ipvgo_player.js` caused the game-surface slowdown and is stopped.
- The bounded monitor was updated to accept `[intervalMs] [samples]`, with a 120-second default and 60-second minimum.

## Live run

The intended command is:

```text
run mcp_formulas_shadow.js 120000 5
```

The output is written to `mcp_formulas_shadow.txt`. The monitor is read-only.

## Synchronization lesson

`ctl-resync` did not push this newly added source file because it was not in
the daemon's watched-file set. An explicit push succeeded:

```text
python3 tools/bb_remote.py ctl-push mcp_formulas_shadow.js mcp_formulas_shadow.js
```

After source changes, verify from the game with `cat mcp_formulas_shadow.js`.
Bitburner does not hot-reload a running process; kill the old PID before rerunning.

## Next decision

Read the final snapshot and compare income, target, pool size, latency/stability
indicators, and invariant violations against a clean baseline with IPvGO stopped.
Do not integrate formulas into production until the senior-review promotion
gates pass, including checking whether Formulas.exe survives augmentation or
must be repurchased.
