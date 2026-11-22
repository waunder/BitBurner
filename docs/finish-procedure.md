# Finishing a BitNode and entering the next

**Status: NOT READY for the real game.** Rehearsed in a disposable copy 2026-11-22 (30 of 30,
docs/evidence/finish-rehearsal-2026-11-22/). Until every box under "Before first real use" is ticked and this line
says READY, stop at the World Daemon, back up and tell Ken, as before. Scheduled check-ins never tick these boxes.

## What the rehearsal established

- The game enforces The Red Pill: without it installed, `w0r1d_d43m0n` is "Invalid host". (It is still in the save.
  Editing the pill out of a finished save leaves it reachable, which first gave a false result.)
- `destroyW0r1dD43m0n(next, callback)` finishes, grants the Source-File, enters and runs the callback in about 1 second.
- It never reports success: the calling script dies. An unmet requirement returns silently too. So success is read from
  the autosave only (node, nodeResetAt, Source-File level).
- A finish script can die between rooting and finishing with no error in its status file: computed calls such as
  `ns[name]()` escape the RAM count and the game kills it. Name every call.
- A missing callback still destroys, and leaves nothing running. The watchdog then starts a BitNode the active profile
  covers (about 1 min) and holds in one it does not.
- **A `startup.js` callback bypasses that hold:** entering BN11 it started the BN12 profile at once. So the callback is
  only for a next node the active profile covers. Otherwise: no callback, `profile.py switch <next> --live`, then startup.
- A validated backup undoes a finish completely (node, Source-Files, augmentations, run stamp), tested twice. In the
  Steam game restoring means a save import and reload, which is not rehearsed there.
- Auto install holds in every newly entered run until that run is in tools/install_approvals.json.

## Procedure

1. Next node is on docs/route.md and its profile builds and passes its tests.
2. The Red Pill installed, hacking at the requirement, no graft running.
3. Save backup, decoded: same node and nodeResetAt, pill installed. No backup, no finish.
4. Tell Ken what is about to happen and why that node.
5. Root and destroy (callback rule above).
6. Within 2 minutes the save shows the new node, the new stamp and one more Source-File level; otherwise stop.
7. Switch profile if needed; residents up; add the run's install approval quoting Ken's handover; page clear.

## Before first real use

- [ ] The finish script in the repo, outside every manifest, pushed only at step 5 and removed after.
- [ ] Its preflight refusals tested: route, pill, hacking, backup, profile, callback.
- [ ] The same script and this whole procedure, profile switch included, pass in a disposable copy.
- [ ] A way to restore a backup in the Steam game, known and written here.
