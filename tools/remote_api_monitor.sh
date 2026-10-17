#!/bin/bash
# Safe repeated recovery. A disconnected game is never a reason to kill a daemon.
set -euo pipefail
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BB_PYTHON="${BB_PYTHON:-$REPO_DIR/.venv/bin/python3}"
if [ ! -x "$BB_PYTHON" ]; then
  BB_PYTHON="$(command -v python3)"
fi
if [ "${1:-}" = "--stop" ]; then
  echo "Use the installed launchd service manager to stop supervision; this recovery tool never kills a PID from a stale file." >&2
  exit 2
fi
exec "$BB_PYTHON" "$REPO_DIR/tools/remote_api_monitor.py" --ensure "$@"
