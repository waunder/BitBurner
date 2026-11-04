# BitBurner MCP Monitor

> **What this repo actually is.** A personal sandbox for learning to work
> with AI coding assistants (Claude and Codex), using the game
> [Bitburner](https://github.com/bitburner-official/bitburner-src) as the
> exercise. Every script here was written through conversation with Claude
> and Codex, not by me. I have no meaningful coding background of my own
> that isn't 50 years out of date, and I make no claim to have progressed
> through the game on my own programming skill — this is a "vibe coding"
> log, not an example of hand-authored strategy code. If that's useful or
> interesting to you as a reference for AI-assisted development, great;
> just don't mistake it for my own engineering work.

This workspace contains a BitBurner manager script plus helper status and parser tools.

**See [`docs/processes.md`](docs/processes.md)** for what every script does, what it reads
and writes, and how they fit together. The list below is just the short version.

## Files

The repo is a tree; the game gets a flat copy of it (see
[`docs/architecture-profiles.md`](docs/architecture-profiles.md)).

- `core/` - Netscript that runs in every BitNode (`core/mcp/mcp.js` is the main manager script)
- `profiles/bn15/`, `profiles/bn10/` - what only one BitNode needs; `profiles/_template/` starts a new one
- `sync_manifest.json` - generated map of game path to repo path for the active profile
- `tools/` - out-of-game Python and shell, including `profile.py`, `stage.py` and `mcp_status_parser.py`
- `runtime/` - gitignored telemetry pulled from the game (`mcp_status.json`, `mcp_status_log.txt`, ...)
- `editor/` - Netscript definitions and `tsconfig.json` for editor support

## In-game workflow

Any time — after an augmentation install (which wipes running scripts), or
whenever you want everything freshly running:

```bash
run startup.js
```

Kills everything else on the host, then brings up the established core suite — see
[`docs/processes.md`](docs/processes.md#startupjs) for exactly what it
starts and in what order. `mcp_supervisor.js` comes up first, so restarts and
file inspection become remote-triggerable from then on; see
[`docs/processes.md`](docs/processes.md#mcp_supervisorjs).

The Remote API daemon now provides routine source sync and generated-file
pulls. Editing a watched source in this connected checkout is itself
deployment-capable — the file must be in the active profile's manifest, see
`tools/profile.py`. The working
method and the short list of things that need Ken directly are in
[`docs/agent-working-agreement.md`](docs/agent-working-agreement.md) and
`AGENTS.md`.

## Local workflow

Once `runtime/mcp_status.json` has been pulled from the game, run:

```bash
python3 tools/mcp_status_parser.py
```

To run the tests: `python tools/stage.py bn15`, then `cd build/bn15 && node --test`.

That prints a summary of the latest manager status, including per-host allocations.

## Notes

- `mcp.js` writes `mcp_status.json` in the game every loop, overwriting the previous status;
  the daemon pulls it to `runtime/mcp_status.json`.
- `mcp_status_log.txt` is appended in the game each loop for historical review (pulled to `runtime/`).
- The parser is written in Python for local execution without Node.
- Start a work session with `AGENTS.md` and `STATE.md`; both are deliberately
  short current context. Read the dated archive only when historical evidence
  is relevant.
- Current objective/status lives in `STATE.md`; routine Remote API checks,
  reconnects and source-sync verification are in
  [`docs/remote-api-keepalive.md`](docs/remote-api-keepalive.md). The limited
  explicit-approval cases are in `AGENTS.md`.
