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

# Check if daemon is running and connected.
#
# Reachability via the control port is the ONLY health signal (2026-09-03
# fix, after a confirmed live incident). The old version required PID_FILE
# to hold the exact PID of a live process *before* even trying the control
# port -- but start_daemon() below unconditionally overwrites PID_FILE with
# whatever `nohup ... &` returns, even when that process is about to die
# from a failed bind. Once PID_FILE drifts to a doomed spawn (because a
# working daemon already holds the port under some other PID -- e.g. one
# started independently, outside this monitor's tracking), `kill -0` on
# that dead PID fails immediately, this function returns unhealthy WITHOUT
# ever trying ctl-status, and check_and_restart's stop+start cycle spawns
# another equally-doomed clone -- forever, once a minute, while the actual
# working daemon sits there the whole time, completely invisible to this
# check. Confirmed live: a real daemon ran healthy and reachable for 23+
# hours while this monitor churned uselessly around it every ~61s because
# its own PID_FILE had drifted to a series of instantly-dead clones.
#
# A daemon that answers ctl-status IS healthy, full stop, regardless of
# whether its PID happens to match what this monitor last spawned.
daemon_healthy() {
  if python3 "$REPO_DIR/tools/bb_remote.py" ctl-status --control-port "$CONTROL_PORT" &>/dev/null; then
    return 0
  fi
  return 1
}

# Start daemon. Verifies the daemon actually became reachable before
# declaring success (2026-09-03 fix, same incident as daemon_healthy above)
# -- previously this recorded whatever PID `nohup ... &` handed back
# unconditionally, even when that process was about to die from a failed
# bind (e.g. because the port is already held by a daemon started outside
# this monitor). A doomed spawn's PID landing in PID_FILE was exactly what
# fed the infinite restart loop. Now: if the daemon doesn't become
# reachable within a few seconds, that's logged as a real problem instead
# of silently trusted.
start_daemon() {
  log "Starting remote API daemon on port $DAEMON_PORT (control: $CONTROL_PORT)"

  cd "$REPO_DIR"
  nohup python3 tools/bb_remote.py daemon \
    --port "$DAEMON_PORT" \
    --control-port "$CONTROL_PORT" \
    >> "tools/bb_remote_daemon.log" 2>&1 &

  local daemon_pid=$!
  echo "$daemon_pid" > "$PID_FILE"
  log "Spawned PID $daemon_pid, verifying it's actually reachable..."

  local tries=0
  while [ $tries -lt 5 ]; do
    sleep 1
    tries=$((tries + 1))
    if daemon_healthy; then
      log "Daemon confirmed reachable (spawned PID $daemon_pid, took ${tries}s)"
      return 0
    fi
  done

  log "WARNING: daemon spawned (PID $daemon_pid) but never became reachable on control port $CONTROL_PORT after ${tries}s. Something else may be wrong (port genuinely blocked by an unresponsive process, firewall, etc.) -- not silently retrying every cycle. Check tools/bb_remote_daemon.log and 'lsof -nP -iTCP:$DAEMON_PORT'."
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
