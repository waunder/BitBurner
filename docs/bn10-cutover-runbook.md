# BN10 cutover runbook

For the session that takes BitBurner from BN15's World Daemon into BN10. Written 2026-11-03
by the session that planned it. If you are a new session: read `AGENTS.md`,
`docs/governance.md` and `STATE.md` first, then this file.

## How this starts

1. The hourly task `bitburner-bn15-progress` sends Ken a notification when hacking reaches the
   World Daemon's 6000. It adds a line at the top of `STATE.md` and stops changing things.
2. Ken opens a session in `C:\Users\kenne\BitBurner` (the "BitBurner" preset) and says
   something like "review the BN10 startup steps".
3. **Review with Ken first.** Walk him through the steps below in plain words: what each does,
   what can go wrong, and how to roll back. Do nothing to the game until he hands it over.
4. Ken destroys the World Daemon and chooses BN10 himself, or tells you to. Choosing a BitNode
   is his call alone (`AGENTS.md`). Once he hands over, BN10 runs under the same guidance as BN15.

## Before the review (read-only checks)

- `git fetch` and confirm `origin/restructure` exists and contains `origin/main`
  (`git merge-base --is-ancestor origin/main origin/restructure`). If `main` has moved on,
  merge it into `restructure` in a separate worktree, never in the main checkout. Then rebuild
  and retest as below.
- In a worktree of `restructure`, run the verification:
  - `python tools/profile.py build bn15`, which must leave `sync_manifest.json` unchanged;
  - `python tools/stage.py bn15` and `python tools/stage.py bn10`, then `node --test` in each
    `build/<profile>` (465 and 492 tests as of 2026-11-03);
  - `python -m unittest discover -s tools/tests`;
  - `python tools/bb_remote.py selftest` (an offline mock; it never touches the game).
- Live state: `tools/save_export.py` (summary only), `tools/bb_remote.py ctl-status`.

## The cutover (only after Ken's handover and the game is in BN10)

Steps 1 to 7 of "Cutover at BN10 start" in `docs/bn10-plan.md`, on branch `restructure`.
In short:
1. Merge `restructure` into `main`, in the main checkout. This is the moment the new layout
   reaches the sync daemon.
2. Restart the Remote API daemon (the "BitBurner daemon supervisor" task restarts it), then
   check that `ctl-status` reports `"manifest_format": "map"` and a clean full sync.
3. `python tools/profile.py plan bn10`, then `python tools/profile.py switch bn10 --live`. This
   backs up the save first.
4. `python tools/profile.py check`, then `run startup.js` with `tools/game_terminal.py`. Expect
   the core scripts, `dnet_root.js`, and `sleeve_controller.js`.
5. Settings: `capital_policy.json` reserve and `homeRamTarget` once income is known.
   `covenantTarget` true near 20 installs. `sleeve_buyer.js` after joining The Covenant.
6. Update `STATE.md` (new node, what runs, what is unverified), the BitNode line of the hourly
   task's prompt and its title, and the inventory in `docs/governance.md`.

## First live use: watch for these

None of these has ever run against the real game:
- the map-form manifest in `bb_remote.py`;
- `profile.py switch` and `profile.py check`;
- the `ctl-list` and `ctl-delete` commands;
- the profile startup list in `startup.js`.

Check each result rather than trusting it. If the sync or the switch misbehaves, stop. The
rollback is to revert the merge on `main`, restart the daemon, and restore the save backup
from step 3. Tell Ken in plain words.

## Hard rules (from AGENTS.md and docs/governance.md)

- Never backdoor or destroy `w0r1d_d43m0n`, and never choose a BitNode, without Ken.
- Never send DevTools `Input.*` events to the game; use `tools/game_terminal.py`.
- Never widen your own or any other agent's permissions.
- Questions and doubts go at the top of replies.
