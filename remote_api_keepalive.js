/** Remote API keep-alive — periodic health check on bb_remote.py daemon
 *
 * Polls daemon's control port every CHECK_INTERVAL_MS to verify the game
 * connection is still active. Logs state changes and reports disconnects.
 *
 * Daemon must be running: python3 tools/bb_remote.py daemon [--control-port N]
 *
 * Usage (one-shot):
 *   ns.run('remote_api_keepalive.js', 1, '--control-port 12527 --interval 30000')
 *
 * Usage (background, checks every 30s, survives restart):
 *   ns.run('remote_api_keepalive.js', 1, '--control-port 12527 --interval 30000 --background')
 */

const fs = require('fs');
const { execSync } = require('child_process');

const DEFAULT_CONTROL_PORT = 12527;
const DEFAULT_INTERVAL_MS = 30000;  // 30s
const LOG_FILE = '/Users/Shared/BitBurner/remote_api_keepalive.log';

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (e) {
    // log file not writable, just print
  }
}

function parseArgs(args) {
  const opts = { controlPort: DEFAULT_CONTROL_PORT, intervalMs: DEFAULT_INTERVAL_MS, background: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--control-port' && i + 1 < args.length) {
      opts.controlPort = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--interval' && i + 1 < args.length) {
      opts.intervalMs = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--background') {
      opts.background = true;
    }
  }
  return opts;
}

function checkDaemon(controlPort) {
  try {
    const result = execSync(
      `python3 tools/bb_remote.py ctl-status --control-port ${controlPort}`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const data = JSON.parse(result);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function keepalive(opts) {
  let lastState = null;

  while (true) {
    const check = checkDaemon(opts.controlPort);

    if (check.ok) {
      const connected = check.data.connected || check.data.game_connected;
      const currentState = connected ? 'connected' : 'disconnected';

      if (currentState !== lastState) {
        log(`Daemon state: ${currentState}`);
        if (connected) {
          log(`Connected to game (uptime: ${check.data.uptime_s || 'unknown'}s)`);
        }
        lastState = currentState;
      }
    } else {
      if (lastState !== 'daemon_error') {
        log(`Daemon error: ${check.error}`);
        lastState = 'daemon_error';
      }
    }

    // Wait for next check
    await new Promise(resolve => setTimeout(resolve, opts.intervalMs));
  }
}

// Main
const args = process.argv.slice(2);
const opts = parseArgs(args);

log(`Keep-alive starting: control-port=${opts.controlPort}, interval=${opts.intervalMs}ms`);

if (opts.background) {
  log('Running in background mode');
  // Run without blocking
  keepalive(opts).catch(e => log(`Fatal: ${e.message}`));
} else {
  // Block and run
  keepalive(opts).catch(e => {
    log(`Fatal: ${e.message}`);
    process.exit(1);
  });
}
