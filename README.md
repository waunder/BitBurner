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

- `mcp.js` - main manager script
- `mcp_status.js` - BitBurner UI tail helper for `mcp.js`
- `mcp_status.json` - generated runtime status file written by `mcp.js`
- `mcp_status_log.txt` - appended runtime summary log written by `mcp.js`
- `mcp_status_parser.py` - local Python script to parse `mcp_status.json`

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
deployment-capable — see `tools/bb_remote.py::WATCHED_FILES`. The working
method and the short list of things that need Ken directly are in
[`docs/agent-working-agreement.md`](docs/agent-working-agreement.md) and
`AGENTS.md`.

## Local workflow

Once `mcp_status.json` is present in the workspace, run:

```bash
cd /Users/Shared/BitBurner
python3 mcp_status_parser.py
```

That prints a summary of the latest manager status, including per-host allocations.

## Notes

- `mcp.js` writes `mcp_status.json` every loop, overwriting the previous status.
- `mcp_status_log.txt` is appended each loop for historical review.
- The parser is written in Python for local execution without Node.
- Current objective/status lives in `STATE.md`; the short list of things
  that need Ken's explicit go-ahead is in `AGENTS.md`.
