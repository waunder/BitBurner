import { DEFAULT_WEIGHTS, augValue } from "./install_advisor_logic.js"
/** One-shot (dev, pushed by hand): writes gang_faction_survey.json. Every augmentation the gang
 * faction sells that is not owned or queued: rep required, current price, prerequisites, weighted
 * value (run_target.json augWeights). Answers "how far to buying everything there".
 * Start: run gang_faction_survey.js [faction; default the gang's] */
export async function main(ns) {
  const s = ns.singularity
  const faction = String(ns.args[0] ?? ns.gang.getGangInformation().faction)
  let weights = DEFAULT_WEIGHTS
  try { weights = JSON.parse(ns.read("run_target.json") || "{}").augWeights || DEFAULT_WEIGHTS } catch {}
  const owned = new Set(s.getOwnedAugmentations(true))
  const augs = s.getAugmentationsFromFaction(faction)
    .filter((name) => !owned.has(name) && name !== "NeuroFlux Governor")
    .map((name) => ({ name, rep: s.getAugmentationRepReq(name), price: s.getAugmentationPrice(name),
      prereq: s.getAugmentationPrereq(name).filter((p) => !owned.has(p)),
      value: augValue(s.getAugmentationStats(name), weights) }))
    .sort((a, b) => a.rep - b.rep)
  const out = { ts: Date.now(), faction, rep: s.getFactionRep(faction), favor: s.getFactionFavor(faction),
    favorGain: s.getFactionFavorGain(faction), money: ns.getServerMoneyAvailable("home"), count: augs.length, augs }
  ns.write("gang_faction_survey.json", JSON.stringify(out), "w")
  ns.tprint(`gang_faction_survey: ${faction} ${augs.length} augs left, max rep ${Math.max(0, ...augs.map((a) => a.rep))}`)
}
