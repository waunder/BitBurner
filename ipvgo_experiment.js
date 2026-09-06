/**
 * IPvGO Reward-Scaling Experiment Orchestrator
 *
 * Usage: run ipvgo_experiment.js <boardSize> <thinkingMs> <numGames>
 * Example: run ipvgo_experiment.js 9 10000 5
 *
 * Writes experiment config, kills/restarts ipvgo_player.js under controlled conditions,
 * polls ipvgo_status.json for completion, and logs results to ipvgo_experiment_results.jsonl
 *
 * @param {NS} ns
 */

export async function main(ns) {
  const boardSize = parseInt(ns.args[0]) || 9
  const thinkingMs = parseInt(ns.args[1]) || 20000
  const numGames = parseInt(ns.args[2]) || 5

  ns.tprint(`IPvGO Experiment: ${boardSize}x${boardSize}, ${thinkingMs}ms thinking, ${numGames} games target`)

  // Write experiment config
  const config = {
    experimentMode: true,
    boardSize,
    thinkingMs,
    gamesTarget: numGames,
    startTime: Date.now(),
    gameStartCount: 0,
  }

  ns.write("ipvgo_experiment_config.json", JSON.stringify(config, null, 2), "w")
  ns.tprint(`Config written. Starting ipvgo_player.js...`)

  // Kill any existing ipvgo_player
  ns.kill("ipvgo_player.js")
  await ns.sleep(100)

  // Start ipvgo_player with The Black Hand / experiment config
  ns.run("ipvgo_player.js", 1, "The Black Hand", boardSize)
  ns.tprint(`Launched. Polling for completion...`)

  // Poll ipvgo_status.json for game count
  const startTime = Date.now()
  const maxWaitMs = 120000 * numGames // ~2min per game is conservative

  let lastLoggedCount = 0
  let completionLogged = false

  while (Date.now() - startTime < maxWaitMs) {
    await ns.sleep(1000)

    try {
      const status = JSON.parse(ns.read("ipvgo_status.json"))
      const currentCount = status.gamesPlayed || 0

      // Log progress when game count changes (but not after completion)
      if (currentCount > lastLoggedCount && currentCount < numGames) {
        ns.tprint(`Progress: ${currentCount}/${numGames} games (win rate: ${status.recentWinRate?.toFixed(2) || "N/A"})`)
        lastLoggedCount = currentCount
      }

      // Target reached
      if (currentCount >= numGames && !completionLogged) {
        completionLogged = true
        ns.tprint(`Completed ${currentCount} games!`)

        // Write results snapshot
        const result = {
          boardSize,
          thinkingMs,
          targetGames: numGames,
          actualGames: currentCount,
          wins: status.wins || 0,
          winRate: status.recentWinRate || 0,
          bonusPercent: status.bonusPercent || 0,
          avgMoveMs: status.lastResult?.avgMoveMs || 0,
          maxMoveMs: status.lastResult?.maxMoveMs || 0,
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
    } catch (e) {
      // Status file might not exist yet, that's okay
    }
  }

  ns.tprint(`ERROR: Timeout after ${(Date.now() - startTime) / 1000}s`)
  config.experimentMode = false
  ns.write("ipvgo_experiment_config.json", JSON.stringify(config, null, 2), "w")
}
