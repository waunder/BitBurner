# Profile template

Copy this folder to `profiles/<name>/` (lowercase letters, digits, `_`, `-`) and edit `profile.json`:

- `bitnodes`: the BitNode numbers this profile may be switched into.
- `files`: `{ "<game path>": "<repo path>" }` for scripts only this BitNode needs. Keep the game path flat
  (or `hacking/x.js`-style if a script already imports it that way); put the repo file under `profiles/<name>/`.
- `config`: same shape, for config files that replace a core default of the same game path.
- `startup`: scripts `startup.js` should launch beyond the core list (recorded for now; see
  `docs/architecture-profiles.md`, Placement decisions).
- `extends`: normally `["core"]`.

Keep tests beside their file. Then `python tools/profile.py build <name>` and
`python tools/stage.py <name>`, and run `node --test` in `build/<name>`.
`profile.py` refuses names that start with `_`, so this template is never built or switched to.
