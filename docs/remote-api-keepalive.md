# Remote API Keep-Alive Setup

The BitBurner Remote API daemon (`python3 tools/bb_remote.py daemon`) holds the WebSocket connection to the game and must stay running for file sync, restart triggers, and status dumps to work.

Two keep-alive mechanisms are provided:

## Option 1: System-Level Monitor (Recommended for Production)

**File:** `tools/remote_api_monitor.sh`

Monitors the daemon health at system level and auto-restarts if it crashes. Suitable for running via cron or as a background process.

### Single Check (for cron)
```bash
# Run every minute to check/restart if needed
*/1 * * * * /Users/Shared/BitBurner/tools/remote_api_monitor.sh
```

### Background Continuous Monitoring
```bash
# Start in background (checks every 60s)
nohup /Users/Shared/BitBurner/tools/remote_api_monitor.sh --daemon &

# Stop the monitor
/Users/Shared/BitBurner/tools/remote_api_monitor.sh --stop
```

### Environment Variables
```bash
DAEMON_PORT=12526          # Game-facing port (default 12526)
CONTROL_PORT=12527        # Local control channel (default 12527)
LOG_FILE=...log_path...   # Monitor log (default tools/bb_remote_monitor.log)
```

### Logs
- **Daemon log:** `tools/bb_remote_daemon.log` (daemon's own output)
- **Monitor log:** `tools/bb_remote_monitor.log` (health checks and restarts)

---

## Option 2: In-Game Keep-Alive (For Visibility During Play)

**File:** `remote_api_keepalive.js`

Runs inside the Bitburner game as a background script, periodically checks the daemon via `ctl-status`, and logs state to a local file.

### Usage
```bash
# One-shot check every 30 seconds (exits on first failure)
ns.run('remote_api_keepalive.js', 1, '--control-port 12527 --interval 30000')

# Background (continuous, survives restart)
ns.run('remote_api_keepalive.js', 1, '--control-port 12527 --interval 30000 --background')
```

### Output
Logs to `remote_api_keepalive.log` with timestamps:
```
[2026-09-02T13:25:00.123Z] Keep-alive starting: control-port=12527, interval=30000ms
[2026-09-02T13:25:00.456Z] Daemon state: connected
[2026-09-02T13:25:00.456Z] Connected to game (uptime: 3600s)
```

---

## Recommended Setup

For a production game session:

1. **Start the daemon** (one-time, from terminal or scripts):
   ```bash
   nohup python3 tools/bb_remote.py daemon --port 12526 --control-port 12527 \
     >> tools/bb_remote_daemon.log 2>&1 &
   ```

2. **Start system monitor** (cron or background):
   ```bash
   # Either via cron (checks every minute):
   */1 * * * * /Users/Shared/BitBurner/tools/remote_api_monitor.sh
   
   # Or continuous background (checks every 60s):
   nohup /Users/Shared/BitBurner/tools/remote_api_monitor.sh --daemon &
   ```

3. **Optional: In-game visibility** (from game console):
   ```javascript
   ns.run('remote_api_keepalive.js', 1, '--control-port 12527 --interval 60000 --background')
   ```

---

## Troubleshooting

### Daemon won't start
- Check port 12526 isn't already in use: `lsof -i :12526`
- Verify `tools/bb_remote.py` exists and is executable
- Check `tools/bb_remote_daemon.log` for error output

### Monitor reports "Daemon error" repeatedly
- Ensure daemon is running: `python3 tools/bb_remote.py ctl-status --control-port 12527`
- If daemon crashed, monitor will auto-restart it (check `tools/bb_remote_monitor.log`)
- Verify game hasn't disconnected from the daemon (check game's Options → Remote API)

### Game connection dropped but daemon still running
- The daemon will hold the connection open and reconnect when the game comes back
- Monitor logs will show `disconnected` state during the gap
- No action needed — reconnect happens automatically

### File sync not working despite daemon running
- Verify `ctl-status` shows `connected: true`
- Check `tools/bb_remote_events.log` for push/pull errors
- Ensure watched files exist and are readable (see `docs/processes.md` for file list)

---

## Files

| File | Purpose |
|------|---------|
| `tools/remote_api_monitor.sh` | System-level daemon supervision |
| `remote_api_keepalive.js` | In-game keep-alive polling |
| `tools/bb_remote.py` | WebSocket server (unchanged) |
| `tools/bb_remote_daemon.log` | Daemon's own output log |
| `tools/bb_remote_events.log` | Detailed daemon events (connect/disconnect/messages) |
| `tools/bb_remote_monitor.log` | Monitor's health checks and restarts |
| `remote_api_keepalive.log` | In-game keep-alive status log |
