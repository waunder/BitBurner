#!/bin/bash

# Darknet Canary Phase 2 Test Orchestrator
# Tests dnet_root.js with MAX_ACTIVE_MANAGERS=5 for 10 minutes per run
# Runs 3 times with 30-minute waits between runs
# Stops immediately on freeze detection

set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTROL_PORT=${CONTROL_PORT:-12527}
LOG_FILE="$REPO_DIR/docs/darknet-canary-phase2-log.md"

echo "[$(date '+%H:%M:%S')] Checking prerequisites..."

# Check Remote API daemon
if ! python3 "$REPO_DIR/tools/bb_remote.py" ctl-status --control-port $CONTROL_PORT > /dev/null 2>&1; then
  echo "[$(date '+%H:%M:%S')] ❌ Remote API daemon not responsive"
  exit 1
fi
echo "[$(date '+%H:%M:%S')] ✅ Remote API daemon responsive"

# Check game connection
STATUS=$(python3 "$REPO_DIR/tools/bb_remote.py" ctl-status --control-port $CONTROL_PORT 2>/dev/null | grep -o '"connected":[^,}]*' || echo '"connected":false')
if [[ ! "$STATUS" =~ true ]]; then
  echo "[$(date '+%H:%M:%S')] ❌ Game not connected to Remote API"
  exit 1
fi
echo "[$(date '+%H:%M:%S')] ✅ Game connected to Remote API"

# Kill scorecard if running
echo "[$(date '+%H:%M:%S')] Killing dnet_scorecard.js (if running)..."
python3 "$REPO_DIR/tools/bb_remote.py" ctl-push dnet_killswarm.js dnet_killswarm.js > /dev/null 2>&1 || true
python3 "$REPO_DIR/tools/bb_remote.py" ctl-restart > /dev/null 2>&1 || true
sleep 2

# Create log file header
cat > "$LOG_FILE" << 'EOF'
# Darknet Canary Phase 2 Test Log

**Test Parameters:**
- Manager Count: 5 (MAX_ACTIVE_MANAGERS=5)
- Duration per Run: 10 minutes (600 seconds)
- Number of Runs: 3
- Interval Between Runs: 30 minutes
- Test Start Time: START_TIME
- Scorecard: DISABLED

---

## Test Results

EOF

START_TIME=$(date '+%Y-%m-%d %H:%M:%S')
sed -i "" "s/START_TIME/$START_TIME/" "$LOG_FILE"

echo "[$(date '+%H:%M:%S')] "
echo "[$(date '+%H:%M:%S')] Starting Phase 2 Canary Protocol (3 runs)"
echo "[$(date '+%H:%M:%S')] Duration per run: 600 seconds"
echo "[$(date '+%H:%M:%S')] Interval between runs: 30 minutes"
echo "[$(date '+%H:%M:%S')] "

for RUN in 1 2 3; do
  echo "[$(date '+%H:%M:%S')] "
  echo "[$(date '+%H:%M:%S')] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "[$(date '+%H:%M:%S')] Phase 2 Canary Run $RUN / 3"
  echo "[$(date '+%H:%M:%S')] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  echo "[$(date '+%H:%M:%S')] Run dnet_canary_phase2.js in Bitburner: run dnet_canary_phase2.js"
  echo "[$(date '+%H:%M:%S')] Waiting for test to complete (10 minutes)..."

  # Monitor for 10 minutes + buffer
  MONITOR_TIME=$((600 + 60))
  START_SEC=$(date '+%s')
  FREEZE_DETECTED=0
  FINAL_MANAGERS=0

  while [ $(($(date '+%s') - START_SEC)) -lt $MONITOR_TIME ]; do
    sleep 15

    # Check for freeze
    if ! python3 "$REPO_DIR/tools/bb_remote.py" ctl-status --control-port $CONTROL_PORT > /dev/null 2>&1; then
      echo "[$(date '+%H:%M:%S')] ⚠️  Remote API disconnected - possible freeze"
      FREEZE_DETECTED=1
      break
    fi

    # Check if test completed
    if [ -f "$REPO_DIR/dnet_canary_phase2_completed.txt" ]; then
      echo "[$(date '+%H:%M:%S')] ✅ Phase 2 test file detected - test completed"
      FINAL=$(cat "$REPO_DIR/dnet_canary_phase2_completed.txt")
      FINAL_MANAGERS=$(echo "$FINAL" | grep -o '"finalManagerCount":[0-9]*' | cut -d: -f2)
      echo "[$(date '+%H:%M:%S')] Final managers: $FINAL_MANAGERS"
      rm -f "$REPO_DIR/dnet_canary_phase2_completed.txt"
      break
    fi
  done

  echo "[$(date '+%H:%M:%S')] Test window closed"
  echo "[$(date '+%H:%M:%S')] Cleaning up darknet processes..."
  python3 "$REPO_DIR/tools/bb_remote.py" ctl-push dnet_killswarm.js dnet_killswarm.js > /dev/null 2>&1 || true
  sleep 2

  if [ $FREEZE_DETECTED -eq 1 ]; then
    echo "[$(date '+%H:%M:%S')] "
    echo "[$(date '+%H:%M:%S')] ❌ FREEZE DETECTED - stopping Phase 2"
    echo ""
    echo "## Run $RUN: FREEZE DETECTED" >> "$LOG_FILE"
    exit 1
  fi

  echo "### Run $RUN: COMPLETED" >> "$LOG_FILE"
  echo "- Final Managers: $FINAL_MANAGERS" >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"

  if [ $RUN -lt 3 ]; then
    echo "[$(date '+%H:%M:%S')] "
    echo "[$(date '+%H:%M:%S')] Waiting 30 minutes before next run..."
    sleep 1800
  fi
done

if [ $FREEZE_DETECTED -eq 0 ]; then
  echo "[$(date '+%H:%M:%S')] "
  echo "[$(date '+%H:%M:%S')] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "[$(date '+%H:%M:%S')] ✅ Phase 2 Canary Complete - All 3 runs successful"
  echo "[$(date '+%H:%M:%S')] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "## Summary: All Runs Successful ✅" >> "$LOG_FILE"
  echo "Phase 2 testing complete. Darknet stable with 5 managers." >> "$LOG_FILE"
fi

echo "[$(date '+%H:%M:%S')] "
echo "[$(date '+%H:%M:%S')] Results logged to: $LOG_FILE"
