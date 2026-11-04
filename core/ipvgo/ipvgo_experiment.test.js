import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { captureBaseline, measureTrial } from "./ipvgo_experiment.js"

describe("IPvGO experiment trial accounting", () => {
  test("uses counter deltas rather than a lifetime or rolling win rate", () => {
    const baseline = captureBaseline({
      algorithm: "mcts-v5", gamesPlayed: 84, wins: 42,
      opponentLifetimeWins: 100, opponentLifetimeLosses: 80, favorRep: 500,
      recentGames: [{ ts: 1 }],
    })
    const trial = measureTrial(baseline, {
      gamesPlayed: 89, wins: 45, recentWinRate: 0.9,
      opponentLifetimeWins: 103, opponentLifetimeLosses: 82, favorRep: 650,
      recentGames: [{ won: false }, { won: true }, { won: false }, { won: true }, { won: true }],
    }, 5)
    assert.deepEqual({ games: trial.games, wins: trial.wins, losses: trial.losses, winRate: trial.winRate },
      { games: 5, wins: 3, losses: 2, winRate: 0.6 })
    assert.equal(trial.complete, true)
    assert.equal(trial.favorRepDelta, 150)
  })

  test("does not call an overshot or partial sample complete", () => {
    const baseline = captureBaseline({ gamesPlayed: 84, wins: 42 })
    assert.equal(measureTrial(baseline, { gamesPlayed: 88, wins: 45 }, 5).complete, false)
    assert.equal(measureTrial(baseline, { gamesPlayed: 90, wins: 46 }, 5).complete, false)
  })
})
