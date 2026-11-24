# Finishing a BitNode and entering the next

**Status: READY** (2026-11-22 15:05). All four boxes below are ticked. A real finish follows this procedure, by
`tools/finish_node.py`, in a session or a scheduled check-in. Since 2026-11-23 (Ken: "Yes, automate it") check-ins
finish a ready BitNode themselves into docs/route.md "Next finish", by docs/mac-bn10-checkin-task.md, telling Ken
before and after; on any STOP they alert Ken and change nothing more.

## What the rehearsals established

First rehearsal (30 of 30, docs/evidence/finish-rehearsal-2026-11-22/), finish and entry in a copy:
- The game enforces The Red Pill: without it installed, `w0r1d_d43m0n` is "Invalid host". (It is still in the save.
  Editing the pill out of a finished save leaves it reachable, which first gave a false result.)
- `destroyW0r1dD43m0n(next, callback)` finishes, grants the Source-File, enters and runs the callback in about 1 second.
- It never reports success: the calling script dies. An unmet requirement returns silently too. So success is read from
  the save only (node, nodeResetAt, Source-File level).
- A finish script can die between rooting and finishing with no error in its status file: computed calls such as
  `ns[name]()` escape the RAM count and the game kills it. Name every call.
- A missing callback still destroys, and leaves nothing running. The watchdog then starts a BitNode the active profile
  covers (about 1 min) and holds in one it does not.
- **A `startup.js` callback bypasses that hold:** entering BN11 it started the BN12 profile at once. So the callback is
  only for a next node the active profile covers. Otherwise: no callback, `profile.py switch <next> --live`, then startup.
- Auto install holds in every newly entered run until that run is in tools/install_approvals.json.

Second rehearsal (16 of 16, docs/evidence/finish-tool-2026-11-22/), the real tool in a copy with a cloned repo and
its own Remote API daemon, so pushes, the profile switch and every file written were the real path:
- Refusals by the tool: no Red Pill and hacking too low; a node off the route; a node on the route with no profile.
  Refusals by the game script itself: a stale run stamp; a missing callback.
- BN12 to BN12 (same profile, callback): finished, SF12 +1, residents running, finish script and watchdog pause
  removed, installs approved for the new run quoting the handover.
- BN12 to BN10 (profile switch, no callback): finished, profile bn10 pushed and active, startup run, residents up,
  installs approved.
- Both finishes undone by importing the tool's backup through the game's own import (below): node, run stamp,
  installed augmentations and Source-Files exactly as before.

## Procedure

1. Next node is on docs/route.md and a profile covers it (the tool builds it and runs its tests).
2. Ready one of two ways, no graft running in either: the World Daemon path (The Red Pill installed, hacking at the
   requirement), or, in a Bladeburner node (BN6, BN7), the Bladeburner path (all 21 black operations won, run page
   `blackOps`; no pill or root needed, per Bitburner 3.0.1 `destroyW0r1dD43m0n`). The tool picks the path
   (`finish_path`: World Daemon first) and checks the backup is ready the same way.
3. Tell Ken what is about to happen and why that node (a check-in: `tools/notify.py`).
4. `.venv/bin/python3 tools/finish_node.py --next <N>` (preflight only; changes nothing). Then the same with `--go`,
   which: pauses the watchdog; backs up the save to `saves/pre-finish-bn<node>-<time>.json.gz` and decodes it (same
   node and run stamp, pill installed; no backup, no finish); pushes `tools/finish_node.js` (which is in no manifest);
   runs it with the callback rule above; reads the result from the save within 3 minutes; removes the script; switches
   profile and runs startup if needed; adds the run's install approval quoting the handover; unpauses; checks residents.
5. The tool refuses the real game (DevTools 9222, control 12527) unless the status line above says READY.
6. Afterwards: page clear, STATE.md, docs/route.md progress, tell Ken.

If the tool stops after the finish (any STOP line in runtime/finish_node.log), nothing is restored automatically.

## Restoring a backup in the Steam game

Restoring overwrites the save, so it is Ken's call (AGENTS.md, "Not covered"). The way, from the game's own code
(Bitburner 3.0.1, `menu.js` and `ImportSaveComparison.tsx`):

1. In the game window: **File > Load From File**, pick the backup in `saves/` (`.json.gz` is accepted as is).
2. The comparison page opens. Check its node and playtime. **Proceed with import**, then **Confirm**.
3. The game imports and reloads. Then run `startup.js` (or let the watchdog do it).

The rehearsal used the browser build's Options > Import Game > Compare Save, which opens the same comparison page and
calls the same import. Steam's File > Load From File itself has not been run (it would overwrite the real save).

## Bladeburner path (built 2026-11-23, not yet rehearsed)

`finish_node.js` takes the path as its 4th argument; on `bladeburner` it checks `getNextBlackOp()` is null and skips
rooting, then calls `destroyW0r1dD43m0n` as on the other path. Unit-tested (tools/tests/test_finish_node.py) only:
a disposable-copy rehearsal from a save with 21 black ops won is still owed before BN7's finish. Winning Operation
Daedalus itself only counts the black op and gives rank; the node ends only through this tool. bn7's
bladeburner_config.json sets `allowDaedalus` true so the controller attempts it; bn6's default stays false.

## Before first real use

- [x] The finish script in the repo, outside every manifest, pushed only at step 4 and removed after
  (`tools/finish_node.js`; a unit test fails if any manifest names it).
- [x] Its preflight refusals tested: route, pill, hacking, graft, profile, backup, callback, stale run, READY, ports
  (tools/tests/test_finish_node.py; the live ones again in the copy).
- [x] The same script and this whole procedure, profile switch included, pass in a disposable copy (16 of 16).
- [x] A way to restore a backup in the Steam game, known and written here.
