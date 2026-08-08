# BitBurner MCP Monitor

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

From a clean state (after `killall`, or an augmentation install, which wipes
running scripts):

```bash
run startup.js
```

Brings up the whole suite in one shot — see
[`docs/processes.md`](docs/processes.md#startupjs) for exactly what it
starts and in what order. `mcp_supervisor.js` comes up first, so restarts and
file inspection become remote-triggerable from then on; see
[`docs/processes.md`](docs/processes.md#mcp_supervisorjs).

Use the BitBurner File Sync extension's "Download Files Matching Pattern..."
(pattern in [`docs/kensTodo.md`](docs/kensTodo.md)) to sync the generated
status files back to this repo.

## Local workflow

Once `mcp_status.json` is present in the workspace, run:

```bash
cd /Users/kth/Documents/BitBurner
python3 mcp_status_parser.py
```

That prints a summary of the latest manager status, including per-host allocations.

## Notes

- `mcp.js` writes `mcp_status.json` every loop, overwriting the previous status.
- `mcp_status_log.txt` is appended each loop for historical review.
- The parser is written in Python for local execution without Node.
