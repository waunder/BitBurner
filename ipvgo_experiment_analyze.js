/**
 * IPvGO Experiment Analysis & Optimization Recommendation
 *
 * Reads ipvgo_experiment_results.jsonl and produces analysis with recommendation.
 *
 * @param {NS} ns
 */

export async function main(ns) {
  try {
    const resultsRaw = ns.read("ipvgo_experiment_results.jsonl")
    if (!resultsRaw) {
      ns.tprint("No results file found. Run ipvgo_experiment.js first.")
      return
    }

    const lines = resultsRaw.split("\n").filter((line) => line.trim())
    const parsed = []
    let malformed = 0
    for (const line of lines) {
      try {
        parsed.push(JSON.parse(line))
      } catch (_) {
        malformed++
      }
    }
    // Version 1 rows stored lifetime/rolling counters and cannot be compared
    // with real trial deltas. Keep them in the durable log as history, but do
    // not silently mix them into a recommendation.
    const results = parsed.filter((r) => r.schemaVersion === 2 && r.trial?.complete === true)
    const ignored = parsed.length - results.length + malformed

    ns.tprint("\n=== IPvGO Experiment Analysis ===\n")
    if (ignored) ns.tprint(`Ignored ${ignored} legacy, incomplete, or malformed row(s); only schema-v2 completed trials are comparable.`)
    if (!results.length) {
      ns.tprint("No completed schema-v2 trials found. Run ipvgo_experiment.js first.")
      return
    }

    const table = results.map((r) => ({
      config: `${r.config.boardSize}x${r.config.boardSize} @ ${r.config.thinkingMs}ms`,
      games: r.trial.games,
      wins: r.trial.wins,
      winRate: (r.trial.winRate * 100).toFixed(1) + "%",
      favor: r.trial.favorRepDelta == null ? "n/a" : r.trial.favorRepDelta.toFixed(1),
      avgMove: r.ending.lastResult?.avgMoveMs == null ? "n/a" : r.ending.lastResult.avgMoveMs.toFixed(0) + "ms",
      backToBackOdds: (r.trial.winRate * r.trial.winRate * 100).toFixed(1) + "%",
    }))

    for (const row of table) {
      ns.tprint(
        `${row.config.padEnd(20)} | ` +
          `${row.games}g/${row.wins}w (${row.winRate.padStart(5)}) | ` +
          `favor Δ ${row.favor.padStart(5)} | ` +
          `b2b ${row.backToBackOdds.padStart(5)} | ` +
          `${row.avgMove.padStart(6)}`
      )
    }

    // Analysis
    ns.tprint("\n=== Analysis ===\n")

    // Back-to-back win probability (needed for favor conversion)
    const backToBackByConfig = results.map((r) => ({
      config: `${r.config.boardSize}x${r.config.boardSize} @ ${r.config.thinkingMs}ms`,
      b2b: r.trial.winRate * r.trial.winRate,
      winRate: r.trial.winRate,
      favorRepDelta: r.trial.favorRepDelta,
    }))

    const best9x9 = results.filter((r) => r.config.boardSize === 9).sort((a, b) => b.trial.winRate - a.trial.winRate)[0]
    const best13x13 = results.filter((r) => r.config.boardSize === 13).sort((a, b) => b.trial.winRate - a.trial.winRate)[0]

    if (best9x9) {
      ns.tprint(
        `Best 9x9: ${(best9x9.trial.winRate * 100).toFixed(1)}% trial win rate, ${(best9x9.trial.winRate * best9x9.trial.winRate * 100).toFixed(1)}% back-to-back odds`
      )
    }
    if (best13x13) {
      ns.tprint(
        `Best 13x13: ${(best13x13.trial.winRate * 100).toFixed(1)}% trial win rate, ${(best13x13.trial.winRate * best13x13.trial.winRate * 100).toFixed(1)}% back-to-back odds`
      )
    }

    ns.tprint("\nKey Finding: Back-to-back win odds (needed for favor conversion):")
    for (const item of backToBackByConfig) {
      ns.tprint(`  ${item.config.padEnd(25)} → ${(item.b2b * 100).toFixed(1)}% per pair`)
    }

    ns.tprint("\n=== Recommendation ===\n")

    // Simple recommendation logic
    if (best9x9 && best13x13) {
      if (best9x9.trial.winRate > 0.60 && best9x9.trial.winRate * best9x9.trial.winRate > 0.30) {
        ns.tprint("RECOMMENDATION: Stick with 9x9 and higher thinking time.")
        ns.tprint(
          `  - ${(best9x9.trial.winRate * 100).toFixed(1)}% trial win rate gives ${(best9x9.trial.winRate * best9x9.trial.winRate * 100).toFixed(1)}% favor-conversion rate (back-to-back wins).`
        )
        ns.tprint(
          `  - 13x13 at ${(best13x13.trial.winRate * 100).toFixed(1)}% only achieves ${(best13x13.trial.winRate * best13x13.trial.winRate * 100).toFixed(1)}% conversion rate -- too low for farming reputation efficiently.`
        )
      } else if (best13x13.trial.winRate * best13x13.trial.winRate > best9x9.trial.winRate * best9x9.trial.winRate * 0.8) {
        ns.tprint("RECOMMENDATION: 13x13 may be competitive if bonus % scales favorably with board size.")
        ns.tprint(`  - Depends on whether in-game bonus calculation rewards bigger boards enough to offset the lower win rate.`)
      } else {
        ns.tprint("RECOMMENDATION: 9x9 is strongly preferred.")
        ns.tprint(`  - Higher back-to-back odds (${(best9x9.trial.winRate * best9x9.trial.winRate * 100).toFixed(1)}%) favors reputation farming.`)
      }
    } else {
      ns.tprint("Insufficient data. Run experiments on both 9x9 and 13x13 to compare.")
    }

    // Games-per-hour (rough estimate)
    ns.tprint("\n=== Throughput (estimated games/hour) ===\n")
    for (const r of results) {
      const gamesPerHour = r.elapsedMs > 0 ? (r.trial.games / (r.elapsedMs / 1000)) * 3600 : 0
      const favorPerHour = r.trial.favorRepDelta == null || r.elapsedMs <= 0 ? null : r.trial.favorRepDelta / (r.elapsedMs / 3600000)
      const favorText = favorPerHour == null ? "favor Δ unavailable" : `favor Δ/hr ${favorPerHour.toFixed(1)}`
      ns.tprint(`${`${r.config.boardSize}x${r.config.boardSize} @ ${r.config.thinkingMs}ms`.padEnd(25)} → ~${gamesPerHour.toFixed(1)} games/hr, ${favorText}`)
    }
  } catch (e) {
    ns.tprint(`Error reading results: ${e}`)
  }
}
