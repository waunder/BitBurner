# Remote API recovery and supervision

Steam's native Bitburner save is the live environment. The game connects to
our WebSocket listener at `127.0.0.1:12526`; local control clients talk to
`127.0.0.1:12527`. The daemon cannot initiate the game's connection.

## Routine recovery

Run this from an authorized local terminal (a sandbox may deny loopback):

```bash
/Users/Shared/BitBurner/tools/remote_api_monitor.sh
```

This is safe to repeat. It reads daemon health first, takes a kernel-managed
lock if recovery is needed, and starts a detached daemon only when the
control connection is refused and both ports are free. It never kills a
process from a saved PID or restarts a listener merely because Steam is
offline. The shell wrapper selects `.venv/bin/python3` and absolute paths.
`BB_PYTHON`, `DAEMON_PORT` and `CONTROL_PORT` can override the defaults.

For a read-only check without recovery:

```bash
/Users/Shared/BitBurner/.venv/bin/python3 /Users/Shared/BitBurner/tools/remote_api_monitor.py
```

The JSON result distinguishes these states:

| State | Meaning and action |
|---|---|
| `connected` | Daemon and game are connected. Read freshness and pass results before trusting telemetry. |
| `game_disconnected` | Daemon is alive. In Steam, Options → Remote API: plain WebSocket, host `127.0.0.1`, port `12526`, then Connect. A listener restart will not fix this state. |
| `sync_degraded` | Connected, but a sync/pull pass or filesystem root has an error; inspect returned details. |
| `health_unknown` with `permission_denied` | The caller's sandbox/network policy blocked the check. Retry with authorized local network access; do not restart anything based on this error. |
| `daemon_missing` | Read-only probe found no listener; run the shell recovery command. |
| `listener_or_permission_conflict` | Recovery could not safely bind both ports; inspect the error, without killing another listener. |
| `start_failed` | New process failed; inspect the bounded events log and daemon stderr. |

One-shot monitor exit status is 0 for `connected` or a complete `synced`
result, and 2 otherwise. `bb_remote.py ctl-status` preserves exit 0 when the
daemon responds, even if the game is disconnected; always inspect
`result.connected`. Its specific nonzero codes are 3 for permission denial,
4 for connection refused, 5 for response timeout, or 1 for another failure.

`--daemon` checks every 60 seconds and reports state changes. The macOS
LaunchAgent `com.bitburner.remote-api-monitor` is installed and loaded for the
current user; it runs `tools/remote_api_monitor.sh --daemon` at login and
restarts it if it exits. Inspect it with
`launchctl print gui/$(id -u)/com.bitburner.remote-api-monitor`. Do not run
competing supervisors. The old `--stop` PID-file kill is intentionally
disabled; use `launchctl bootout gui/$(id -u) tools/com.bitburner.remote-api-monitor.plist`
to stop supervision, and `launchctl bootstrap gui/$(id -u) tools/com.bitburner.remote-api-monitor.plist`
to load it again.

## Complete source sync without a disconnect

```bash
/Users/Shared/BitBurner/tools/force_sync.sh
```

This now uses the existing connection and asks for a full manifest push. It
returns success only when at least one file was pushed and no file failed or
was missing. It no longer kills/restarts the daemon, and does not claim
success merely because one old sync counter is nonzero. Netscript source
changes still require restarting the affected in-game scripts separately.

## Connection and telemetry evidence

`ctl-status` reports connection/disconnect times, the last close reason,
last RPC response time, sync/pull pass outcomes, last successful full sync,
and last successful telemetry read. Times ending in `_ms` are Unix
milliseconds. The current-connection counts are zero when disconnected;
previous timestamps remain as historical evidence. A freshly read game file
may itself contain stale telemetry, so also inspect its embedded timestamp.

A missing remote file is recorded as `missing`. A transport timeout or
connection failure is recorded as `failed`; neither is a successful pull.
No game reconnection guarantee is made for a nonzero delay setting. If the
game remains disconnected, click Connect and verify a fresh full sync/pull.

## Bounded diagnostics

`tools/bb_remote_events.log` retains lifecycle events, errors and full pass
outcomes, with 5 MiB per file and two rotated backups (about 15 MiB total).
Payloads are capped at 2,000 characters. Set `BB_REMOTE_TRACE=1` before
starting the daemon to include routine RPC trace; rotation still applies.
Daemon logging is not duplicated into unbounded stdout. Unhandled process
crashes still appear in the service's stderr/daemon log.

If replacing a running daemon, first stop the identified process and preserve
its oversized legacy logs as dated evidence; never truncate an active
process's file. Historical backups are outside the rolling retention set and
may be deleted after diagnosis is complete.

`remote_api_keepalive.js` is an old in-game display that reads a presumed
copy of a host `.log` file. Netscript cannot inspect the host filesystem,
and that log is not delivered by the manifest. It is not a health probe or
recovery mechanism; use the local status/recovery tools above.
