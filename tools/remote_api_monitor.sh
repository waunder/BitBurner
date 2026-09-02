#!/bin/bash
# Remote API daemon monitor — ensures bb_remote.py daemon stays running and healthy
#
# Run periodically (e.g. every minute via cron):
#   */1 * * * * /Users/Shared/BitBurner/tools/remote_api_monitor.sh
#
# Or in background:
#   nohup /Users/Shared/BitBurner/tools/remote_api_monitor.sh --daemon &

set -e

REPO_DIR="/Users/Shared/BitBurner"
DAEMON_PORT=${DAEMON_PORT:-12526}
CONTROL_PORT=${CONTROL_PORT:-12527}
LOG_FILE="${LOG_FILE:-${REPO_DIR}/tools/bb_remote_monitor.log}"
LOCK_FILE="/tmp/bb_remote_daemon.lock"
PID_FILE="/tmp/bb_remote_daemon.pid"

# Log with timestamp
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Check if daemon is running and connected
daemon_healthy() {
  if [ ! -f "$PID_FILE" ]; then
    return 1
  fi

  local pid=$(cat "$PID_FILE" 2>/dev/null)
  if ! kill -0 "$pid" 2>/dev/null; then
    return 1
  fi

  # Try to reach control port
  if python3 "$REPO_DIR/tools/bb_remote.py" ctl-status --control-port "$CONTROL_PORT" &>/dev/null; then
    return 0
  fi
  return 1
}

# Start daemon
start_daemon() {
  log "Starting remote API daemon on port $DAEMON_PORT (control: $CONTROL_PORT)"

  cd "$REPO_DIR"
  nohup python3 tools/bb_remote.py daemon \
    --port "$DAEMON_PORT" \
    --control-port "$CONTROL_PORT" \
    >> "tools/bb_remote_daemon.log" 2>&1 &

  local daemon_pid=$!
  echo "$daemon_pid" > "$PID_FILE"
  log "Daemon started with PID $daemon_pid"

  # Wait a moment for daemon to bind ports
  sleep 1
}

# Stop daemon gracefully
stop_daemon() {
  if [ -f "$PID_FILE" ]; then
    local pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      log "Stopping daemon (PID $pid)"
      kill "$pid" 2>/dev/null || true
      rm -f "$PID_FILE"
      sleep 1
    fi
  fi
}

# Check daemon health and restart if needed
check_and_restart() {
  if daemon_healthy; then
    # Daemon is fine
    return 0
  fi

  log "Daemon health check failed, restarting..."
  stop_daemon
  sleep 1
  start_daemon
}

# Continuous monitoring mode
monitor_loop() {
  log "Monitor entering loop (check every 60s)"

  while true; do
    check_and_restart
    sleep 60
  done
}

# Main
if [ "$1" = "--daemon" ]; then
  # Run continuously in background
  monitor_loop
elif [ "$1" = "--stop" ]; then
  stop_daemon
else
  # Single check (suitable for cron)
  check_and_restart
fi
