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

    const results = resultsRaw
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line))

    ns.tprint("\n=== IPvGO Experiment Analysis ===\n")

    const table = results.map((r) => ({
      config: `${r.boardSize}x${r.boardSize} @ ${r.thinkingMs}ms`,
      games: r.actualGames,
      wins: r.wins,
      winRate: (r.winRate * 100).toFixed(1) + "%",
      bonus: r.bonusPercent.toFixed(1) + "%",
      avgMove: r.avgMoveMs.toFixed(0) + "ms",
      backToBackOdds: (r.winRate * r.winRate * 100).toFixed(1) + "%",
    }))

    for (const row of table) {
      ns.tprint(
        `${row.config.padEnd(20)} | ` +
          `${row.games}g/${row.wins}w (${row.winRate.padStart(5)}) | ` +
          `bonus ${row.bonus.padStart(4)} | ` +
          `b2b ${row.backToBackOdds.padStart(5)} | ` +
          `${row.avgMove.padStart(6)}`
      )
    }

    // Analysis
    ns.tprint("\n=== Analysis ===\n")

    // Back-to-back win probability (needed for favor conversion)
    const backToBackByConfig = results.map((r) => ({
      config: `${r.boardSize}x${r.boardSize} @ ${r.thinkingMs}ms`,
      b2b: r.winRate * r.winRate,
      winRate: r.winRate,
      bonus: r.bonusPercent,
    }))

    const best9x9 = results.filter((r) => r.boardSize === 9).sort((a, b) => b.winRate - a.winRate)[0]
    const best13x13 = results.filter((r) => r.boardSize === 13).sort((a, b) => b.winRate - a.winRate)[0]

    if (best9x9) {
      ns.tprint(
        `Best 9x9: ${(best9x9.winRate * 100).toFixed(1)}% win rate, ${(best9x9.winRate * best9x9.winRate * 100).toFixed(1)}% back-to-back odds`
      )
    }
    if (best13x13) {
      ns.tprint(
        `Best 13x13: ${(best13x13.winRate * 100).toFixed(1)}% win rate, ${(best13x13.winRate * best13x13.winRate * 100).toFixed(1)}% back-to-back odds`
      )
    }

    ns.tprint("\nKey Finding: Back-to-back win odds (needed for favor conversion):")
    for (const item of backToBackByConfig) {
      ns.tprint(`  ${item.config.padEnd(25)} → ${(item.b2b * 100).toFixed(1)}% per pair`)
    }

    ns.tprint("\n=== Recommendation ===\n")

    // Simple recommendation logic
    if (best9x9 && best13x13) {
      if (best9x9.winRate > 0.60 && best9x9.winRate * best9x9.winRate > 0.30) {
        ns.tprint("RECOMMENDATION: Stick with 9x9 and higher thinking time.")
        ns.tprint(
          `  - ${(best9x9.winRate * 100).toFixed(1)}% win rate gives ${(best9x9.winRate * best9x9.winRate * 100).toFixed(1)}% favor-conversion rate (back-to-back wins).`
        )
        ns.tprint(
          `  - 13x13 at ${(best13x13.winRate * 100).toFixed(1)}% only achieves ${(best13x13.winRate * best13x13.winRate * 100).toFixed(1)}% conversion rate -- too low for farming reputation efficiently.`
        )
      } else if (best13x13.winRate * best13x13.winRate > best9x9.winRate * best9x9.winRate * 0.8) {
        ns.tprint("RECOMMENDATION: 13x13 may be competitive if bonus % scales favorably with board size.")
        ns.tprint(`  - Depends on whether in-game bonus calculation rewards bigger boards enough to offset the lower win rate.`)
      } else {
        ns.tprint("RECOMMENDATION: 9x9 is strongly preferred.")
        ns.tprint(`  - Higher back-to-back odds (${(best9x9.winRate * best9x9.winRate * 100).toFixed(1)}%) favors reputation farming.`)
      }
    } else {
      ns.tprint("Insufficient data. Run experiments on both 9x9 and 13x13 to compare.")
    }

    // Games-per-hour (rough estimate)
    ns.tprint("\n=== Throughput (estimated games/hour) ===\n")
    for (const r of results) {
      const gamesPerHour = (r.actualGames / (r.elapsedMs / 1000)) * 3600
      const favorsPerHour = gamesPerHour * r.winRate * r.winRate * 0.5 // 500 rep per conversion, scaled for rate
      ns.tprint(`${`${r.boardSize}x${r.boardSize} @ ${r.thinkingMs}ms`.padEnd(25)} → ~${gamesPerHour.toFixed(1)} games/hr`)
    }
  } catch (e) {
    ns.tprint(`Error reading results: ${e}`)
  }
}
