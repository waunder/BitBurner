# IPvGO Reward-Scaling Experiment Guide

## Quick Start

This experiment measures how reward and win rate scale across board sizes and thinking times.

### Test Plan

Run these three commands in sequence in the Bitburner terminal. Each will play 5 games and log results.

```
run ipvgo_experiment.js 9 5000 5
run ipvgo_experiment.js 9 20000 5
run ipvgo_experiment.js 13 10000 5
```

That's it. Let each batch complete (takes ~15-20 minutes per batch in real time). You'll see progress logged to the terminal.

### After All Batches Complete

Once all three are done, run:

```
run ipvgo_experiment_analyze.js
```

This will show:
- Win rates for each configuration
- Bonus percentages
- Back-to-back win odds (needed for favor conversion)
- A recommendation on which configuration optimizes reputation farming

## What Each Parameter Means

- **Board size** (9 or 13): 9x9 or 13x13 grid
- **Thinking time** (5000, 10000, 20000, etc.): milliseconds per move (5s, 10s, 20s, etc.)
- **Num games** (5): target number of games to complete before analyzing

## Expected Outcomes

The key metric is **back-to-back win odds**, which determines how often the bot converts wins into faction favor:

- 66% win rate → 44% back-to-back odds (0.66²)
- 50% win rate → 25% back-to-back odds
- 10% win rate → 1% back-to-back odds

The bigger question: does bonus % scale enough with board size (13x13 gives much larger territory) to offset much lower win rates?

## Files Created

- `ipvgo_experiment.js` — orchestrator (you run this)
- `ipvgo_experiment_analyze.js` — analysis (run after experiments)
- `ipvgo_experiment_config.json` — config (read by ipvgo_player.js during experiment)
- `ipvgo_experiment_results.jsonl` — results log (appended to by each batch)

The modified `ipvgo_player.js` checks for experiment config at startup and respects board size / thinking time overrides when in experiment mode.

## Example Output

```
=== IPvGO Experiment Analysis ===

9x9 @ 5000ms          | 5g/2w (40.0%) | bonus 3.2%  | b2b 16.0% | 4821ms
9x9 @ 20000ms         | 5g/3w (60.0%) | bonus 3.8%  | b2b 36.0% | 16234ms
13x13 @ 10000ms       | 5g/0w (0.0%)  | bonus 5.1%  | b2b  0.0% | 9876ms

Best 9x9: 60.0% win rate, 36.0% back-to-back odds
Best 13x13: 0.0% win rate, 0.0% back-to-back odds

RECOMMENDATION: Stick with 9x9 and higher thinking time.
```

That recommendation is based on favor conversion needing back-to-back wins. Unless the in-game bonus calculation massively favors bigger boards (unlikely given the doc says it's "territory %" → "hacking multiplier"), higher win rate wins.
