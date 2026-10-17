#!/bin/bash
# Force the existing daemon to push the manifest without breaking its connection.
set -euo pipefail
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
exec "$REPO_DIR/tools/remote_api_monitor.sh" --resync "$@"
