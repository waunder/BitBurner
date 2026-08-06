# BitBurner MCP Monitor

This workspace contains a BitBurner manager script plus helper status and parser tools.

## Files

- `mcp.js` - main manager script
- `mcp_status.js` - BitBurner UI tail helper for `mcp.js`
- `mcp_status.json` - generated runtime status file written by `mcp.js`
- `mcp_status.log` - appended runtime summary log written by `mcp.js`
- `mcp_status_parser.py` - local Python script to parse `mcp_status.json`

## In-game workflow

1. Start the manager:

```bash
run mcp.js
```

2. Start the tail helper for live UI log viewing:

```bash
run mcp_status.js home 20
```

3. Use the BitBurner File Sync extension to sync `mcp_status.json` and `mcp_status.log` back to this repo.

## Local workflow

Once `mcp_status.json` is present in the workspace, run:

```bash
cd /Users/kth/Documents/BitBurner
python3 mcp_status_parser.py
```

That prints a summary of the latest manager status, including per-host allocations.

## Notes

- `mcp.js` writes `mcp_status.json` every loop, overwriting the previous status.
- `mcp_status.log` is appended each loop for historical review.
- The parser is written in Python for local execution without Node.
