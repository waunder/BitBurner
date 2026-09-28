/**
 * IPvGO Reward-Scaling Experiment Orchestrator
 *
 * Usage: run ipvgo_experiment.js <boardSize> <thinkingMs> <numGames>
 * Example: run ipvgo_experiment.js 9 10000 5
 *
 * Writes experiment config, kills/restarts ipvgo_player.js under controlled conditions,
 * polls ipvgo_status.json for completion, and logs a per-run delta to
 * ipvgo_experiment_results.jsonl. `gamesPlayed` is a lifetime counter for an
 * algorithm generation, so it is deliberately never used as a trial result.
 *
 * @param {NS} ns
 */

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback
}

/** A small, serializable snapshot of the fields whose *change* is evidence. */
export function captureBaseline(status = {}) {
  const recentGames = Array.isArray(status.recentGames) ? status.recentGames : []
  return {
    algorithm: typeof status.algorithm === "string" ? status.algorithm : null,
    gamesPlayed: finite(status.gamesPlayed),
    wins: finite(status.wins),
    opponentLifetimeWins: finite(status.opponentLifetimeWins),
    opponentLifetimeLosses: finite(status.opponentLifetimeLosses),
    favorRep: Number.isFinite(status.favorRep) ? status.favorRep : null,
    bonusPercent: Number.isFinite(status.bonusPercent) ? status.bonusPercent : null,
    recentGamesCount: finite(status.recentGamesCount, recentGames.length),
    // Keep the actual rolling records as an audit boundary, rather than only
    // their count. A small experiment cannot otherwise be reconstructed once
    // later games have pushed these records out of the player's window.
    recentGameRecords: recentGames.slice(),
    lastGameTs: recentGames.length
      ? recentGames[recentGames.length - 1].ts ?? null
      : null,
  }
}

/** Returns only outcomes completed after `baseline`, never a rolling rate. */
export function measureTrial(baseline, status = {}, targetGames = 0) {
  const games = Math.max(0, finite(status.gamesPlayed) - baseline.gamesPlayed)
  const wins = Math.max(0, finite(status.wins) - baseline.wins)
  const losses = Math.max(0, games - wins)
  const recentGames = Array.isArray(status.recentGames) ? status.recentGames : []
  return {
    games,
    wins,
    losses,
    winRate: games ? wins / games : null,
    // The player stops at a completed-game boundary. These are the exact
    // records for this finite run unless the rolling status window overflowed.
    gameRecords: games ? recentGames.slice(-games) : [],
    gameRecordsComplete: games <= recentGames.length,
    opponentLifetimeWins: Math.max(0, finite(status.opponentLifetimeWins) - baseline.opponentLifetimeWins),
    opponentLifetimeLosses: Math.max(0, finite(status.opponentLifetimeLosses) - baseline.opponentLifetimeLosses),
    favorRepDelta: Number.isFinite(status.favorRep) && Number.isFinite(baseline.favorRep)
      ? status.favorRep - baseline.favorRep
      : null,
    bonusPercentStart: baseline.bonusPercent,
    bonusPercentEnd: Number.isFinite(status.bonusPercent) ? status.bonusPercent : null,
    complete: games === targetGames,
  }
}

function readStatus(ns) {
  try {
    const raw = ns.read("ipvgo_status.json")
    return raw ? JSON.parse(raw) : {}
  } catch (_) {
    return {}
  }
}

export async function main(ns) {
  const boardSize = parseInt(ns.args[0]) || 9
  const thinkingMs = parseInt(ns.args[1]) || 20000
  const numGames = parseInt(ns.args[2]) || 5

  ns.tprint(`IPvGO Experiment: ${boardSize}x${boardSize}, ${thinkingMs}ms thinking, ${numGames} games target`)

  // Snapshot before restarting the player. Its counters are lifetime counters
  // for the current algorithm, and can already be non-zero before this trial.
  const baselineStatus = readStatus(ns)
  const baseline = captureBaseline(baselineStatus)
  const runId = `ipvgo-${Date.now()}-${Math.floor(Math.random() * 1e6)}`

  // The player reads this config only for an explicitly launched experiment.
  // It exits after recording the Nth new completed game, before it can reset
  // the board into a further game.
  const config = {
    schemaVersion: 2,
    runId,
    experimentMode: true,
    boardSize,
    thinkingMs,
    gamesTarget: numGames,
    startTime: Date.now(),
    baseline,
    stopAfterGamesPlayed: baseline.gamesPlayed + numGames,
  }

  ns.write("ipvgo_experiment_config.json", JSON.stringify(config, null, 2), "w")
  ns.tprint(`Config written. Starting ipvgo_player.js...`)

  // Kill any existing ipvgo_player
  ns.kill("ipvgo_player.js")
  await ns.sleep(100)

  // Start ipvgo_player with The Black Hand / experiment config
  ns.run("ipvgo_player.js", 1, "The Black Hand", boardSize)
  ns.tprint(`Launched. Polling for completion...`)

  // Poll the lifetime count only as a completion signal. Results are computed
  // as deltas from `baseline`, never from this absolute value or a rolling rate.
  const startTime = Date.now()
  const maxWaitMs = 120000 * numGames // ~2min per game is conservative

  let lastLoggedCount = 0
  let completionLogged = false

  while (Date.now() - startTime < maxWaitMs) {
    await ns.sleep(1000)

    try {
      const status = readStatus(ns)
      const trial = measureTrial(baseline, status, numGames)
      const currentCount = trial.games

      // Log progress when game count changes (but not after completion)
      if (currentCount > lastLoggedCount && currentCount < numGames) {
        const rate = trial.winRate == null ? "N/A" : trial.winRate.toFixed(2)
        ns.tprint(`Progress: ${currentCount}/${numGames} new games (trial win rate: ${rate})`)
        lastLoggedCount = currentCount
      }

      // Target reached
      if (trial.complete && !completionLogged) {
        completionLogged = true
        ns.tprint(`Completed exactly ${currentCount} new games!`)

        // Write results snapshot
        const result = {
          schemaVersion: 2,
          runId,
          config: { boardSize, thinkingMs, targetGames: numGames, opponent: status.opponent ?? "The Black Hand" },
          baseline,
          trial,
          ending: {
            algorithm: status.algorithm ?? null,
            isFactionMember: status.isFactionMember ?? null,
            bonusDescription: status.bonusDescription ?? null,
            lastResult: status.lastResult ?? null,
          },
          ts: Date.now(),
          elapsedMs: Date.now() - startTime,
        }

        ns.write("ipvgo_experiment_results.jsonl", JSON.stringify(result), "a")
        ns.tprint(`Results logged to ipvgo_experiment_results.jsonl`)

        // Clear experiment mode
        config.experimentMode = false
        ns.write("ipvgo_experiment_config.json", JSON.stringify(config, null, 2), "w")
        return
      }
    } catch (_) {}
  }

  const timeoutStatus = readStatus(ns)
  const partial = measureTrial(baseline, timeoutStatus, numGames)
  ns.tprint(`ERROR: Timeout after ${(Date.now() - startTime) / 1000}s; recorded ${partial.games}/${numGames} completed games. No partial result was logged.`)
  config.experimentMode = false
  ns.write("ipvgo_experiment_config.json", JSON.stringify(config, null, 2), "w")
}
