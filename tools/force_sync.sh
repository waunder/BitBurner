#!/bin/bash
# Force a complete code refresh into the running game
# Kills daemon, restarts it fresh, and forces a full push of all watched files

set -e

REPO_DIR="/Users/Shared/BitBurner"
DAEMON_PORT=${DAEMON_PORT:-12526}
CONTROL_PORT=${CONTROL_PORT:-12527}

echo "[force_sync] Killing old daemon..."
pkill -f "python3 tools/bb_remote.py daemon" 2>/dev/null || true
sleep 2

echo "[force_sync] Starting fresh daemon on port $DAEMON_PORT (control: $CONTROL_PORT)..."
cd "$REPO_DIR"
nohup python3 tools/bb_remote.py daemon \
  --port "$DAEMON_PORT" \
  --control-port "$CONTROL_PORT" \
  >> tools/bb_remote_daemon.log 2>&1 &

DAEMON_PID=$!
sleep 3

# Verify daemon is alive
if ! python3 tools/bb_remote.py ctl-status --control-port "$CONTROL_PORT" &>/dev/null; then
  echo "[force_sync] ERROR: Daemon failed to start. Check tools/bb_remote_daemon.log"
  exit 1
fi

echo "[force_sync] Daemon started (PID $DAEMON_PID). Waiting for game to reconnect..."
echo "[force_sync] IN GAME: Go to Options → Remote API → Reconnect"
echo "[force_sync]"

# Wait for connection with status updates
attempts=0
while [ $attempts -lt 30 ]; do
  sleep 2
  attempts=$((attempts + 1))

  status=$(python3 tools/bb_remote.py ctl-status --control-port "$CONTROL_PORT" 2>/dev/null || echo "{}")
  connected=$(echo "$status" | grep -o '"connected": *true' || echo "")
  synced=$(echo "$status" | grep -o '"files_synced_this_connection": *[0-9]*' | grep -o '[0-9]*$' || echo "0")

  if [ -n "$connected" ]; then
    echo "[force_sync] ✓ Connected! Files synced this connection: $synced"
    if [ "$synced" -gt 0 ]; then
      echo "[force_sync] ✓ SYNC COMPLETE. Latest code is now in the game."
      echo "[force_sync] You can now: run ipvgo_player.js \"The Black Hand\" 9"
      exit 0
    fi
  else
    echo "[force_sync] Waiting for game connection... ($attempts/30)"
  fi
done

echo "[force_sync] WARNING: Game didn't reconnect in 60s. Game might be closed."
echo "[force_sync] Once you reconnect the game in-game (Options → Remote API → Reconnect),"
echo "[force_sync] the latest code will sync automatically."
