/**
 * One-shot diagnostic: dumps the actual hack/grow economics for a target
 * AND empirically measures real XP/sec for each action type, to ground both
 * the money-mode bucket-weighting question and the new money-vs-XP mode
 * design in real numbers instead of theory or a reverse-engineered formula.
 *
 * The XP measurement is NOT passive: it actually runs one thread each of
 * weaken/grow/hack against the target from this script, in that order, to
 * time and measure them directly. Real, if minor, side effects — a handful
 * of threads' worth against whatever mcp.js is already doing continuously.
 * Takes real wall-clock time to finish (roughly hackTime + growTime +
 * weakenTime, could be a few minutes), not instant.
 *
 * Not part of the running suite — run once, read the output, done.
 * Everything prints via ns.tprint so it's readable over CDP through the
 * terminal, no tail window needed.
 *
 * RAM: hackAnalyze 1.0 + hackAnalyzeChance 1.0 + growthAnalyze 1.0 (each
 * charged separately despite sharing a cost-table symbol — that symbol is a
 * shared VALUE, not a shared charge; corrected here after getting this
 * wrong on the first pass) + hack 0.1 + grow 0.15 + weaken 0.15 + getPlayer
 * 0.5, all read from the game's own cost table, + 1.6GB baseline ≈ 5.5GB.
 * One-shot diagnostic, not part of the always-running suite, so this isn't
 * being budgeted as tightly as mcp_hud.js etc. are.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const target = ns.args[0] || "sigma-cosmetics"
  const money = ns.getServerMoneyAvailable(target)
  const maxMoney = ns.getServerMaxMoney(target)
  const sec = ns.getServerSecurityLevel(target)
  const minSec = ns.getServerMinSecurityLevel(target)

  const hackFrac = ns.hackAnalyze(target) // fraction of current money one hack THREAD steals
  const hackChance = ns.hackAnalyzeChance(target)
  const hackTime = ns.getHackTime(target) / 1000
  const growTime = ns.getGrowTime(target) / 1000
  const weakenTime = ns.getWeakenTime(target) / 1000

  // growthAnalyze(target, multiplier) = threads needed to multiply CURRENT
  // money by `multiplier`. Sample a couple of multipliers to see how thread
  // cost scales, since that's the crux of the grow/hack tradeoff.
  const growThreadsFor = (mult) => ns.growthAnalyze(target, mult)

  ns.tprint(`econ_probe: ${target}`)
  ns.tprint(`  money=${money.toFixed(0)} / ${maxMoney.toFixed(0)} (${((money / maxMoney) * 100).toFixed(1)}%)`)
  ns.tprint(`  security=${sec.toFixed(2)} (floor ${minSec.toFixed(2)})`)
  ns.tprint(`  hackAnalyze (steal frac/thread) = ${hackFrac.toFixed(6)}`)
  ns.tprint(`  hackAnalyzeChance = ${(hackChance * 100).toFixed(1)}%`)
  ns.tprint(`  hackTime=${hackTime.toFixed(1)}s growTime=${growTime.toFixed(1)}s weakenTime=${weakenTime.toFixed(1)}s`)
  ns.tprint(`  growthAnalyze threads for x1.05 = ${growThreadsFor(1.05).toFixed(2)}`)
  ns.tprint(`  growthAnalyze threads for x1.1  = ${growThreadsFor(1.1).toFixed(2)}`)
  ns.tprint(`  growthAnalyze threads for x1.5  = ${growThreadsFor(1.5).toFixed(2)}`)
  ns.tprint(`  growthAnalyze threads for x2.0  = ${growThreadsFor(2.0).toFixed(2)}`)
  ns.tprint(`  growthAnalyze threads for x5.0  = ${growThreadsFor(5.0).toFixed(2)}`)
  ns.tprint(`  growthAnalyze threads for x10.0 = ${growThreadsFor(10.0).toFixed(2)}`)
  ns.tprint(`  hacking level = ${ns.getHackingLevel()}`)

  ns.tprint(`econ_probe: measuring real XP/sec (one thread each, in order weaken -> grow -> hack)...`)

  const measure = async (label, action) => {
    const before = ns.getPlayer().exp.hacking
    const start = Date.now()
    const result = await action()
    const elapsedS = (Date.now() - start) / 1000
    const gained = ns.getPlayer().exp.hacking - before
    ns.tprint(
      `  ${label}: gained ${gained.toFixed(4)} exp in ${elapsedS.toFixed(1)}s real (nominal ${((label === "weaken" ? weakenTime : label === "grow" ? growTime : hackTime)).toFixed(1)}s) ` +
        `= ${(gained / elapsedS).toFixed(4)} exp/sec/thread` +
        (label === "hack" ? ` (result=${result})` : "")
    )
    return gained / elapsedS
  }

  const weakenRate = await measure("weaken", () => ns.weaken(target))
  const growRate = await measure("grow", () => ns.grow(target))
  const hackRate = await measure("hack", () => ns.hack(target))

  const best = Math.max(weakenRate, growRate, hackRate)
  const bestLabel = best === weakenRate ? "weaken" : best === growRate ? "grow" : "hack"
  ns.tprint(`econ_probe: best exp/sec/thread on this target right now = ${bestLabel} (${best.toFixed(4)})`)
}
