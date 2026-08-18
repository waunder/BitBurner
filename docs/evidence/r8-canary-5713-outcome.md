# R8 one-sample shadow canary — run 5713

**Decision:** PASS for the bounded shadow-output contract only.

- **Source identity:** isolated commit
  `a21b3effbca14b6f408753cafe0fb0d5bd93cb0e`; SHA-256
  `12d5bd7d25e8adb481b0da64c9b34f97f78d1897b9ff4b42aa55f747e166102e`.
- **Delivery:** `mcp_formulas_shadow_ctl_push_5675.json` records the one-file
  explicit push as `{"ok":true,"result":"OK"}`. Source sync was disabled.
- **Pre-launch readback:** `mcp_formulas_shadow_ctl_get_5675_prelaunch.json`
  is the raw control response. Its unmodified `.result` hashes to the exact
  attested SHA-256 above.
- **Launch and UI evidence:** the game launched PID 5713 with arguments
  `60000 1`; `mcp_formulas_shadow_tail_5713.png` and its paired `.txt`
  transcript show the titled tail and printed `ready:true` record.
- **Retrieved output:** pull-only retrieval completed with no failures or
  missing artifacts. `mcp_formulas_shadow.txt` contains the fresh snapshot
  `ts: 1786911112572`, `ready: true`, and poolThreads `20772`.
- **Proof limit:** this verifies one read-only shadow sample and its evidence
  channel. It does not establish scoring quality, a repeat-run budget, core
  MCP changes, capital use, or any production integration. Those remain out
  of scope; production remains Tier 3 and denied.
