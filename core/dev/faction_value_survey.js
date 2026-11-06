import { DEFAULT_WEIGHTS, augValue } from "./install_advisor_logic.js"
/** One-shot (dev, pushed by hand): writes faction_value_survey.json. For every faction, the weighted value of
 * its unowned augmentations; for each company, current rep and the best job's rep/s from the Formulas API. */
const COMPANIES = ["ECorp", "MegaCorp", "KuaiGong International", "Four Sigma", "NWO", "Blade Industries", "OmniTek Incorporated",
  "Bachman & Associates", "Clarke Incorporated", "Fulcrum Technologies"]

export async function main(ns) {
  const s = ns.singularity
  const p = ns.getPlayer()
  let weights = DEFAULT_WEIGHTS
  try { weights = JSON.parse(ns.read("run_target.json") || "{}").augWeights || DEFAULT_WEIGHTS } catch {}
  const owned = new Set(s.getOwnedAugmentations(true))
  const factions = []
  for (const faction of Object.values(ns.enums.FactionName)) {
    const augs = s.getAugmentationsFromFaction(faction)
      .filter((name) => !owned.has(name) && name !== "NeuroFlux Governor")
      .map((name) => ({ name, value: augValue(s.getAugmentationStats(name), weights), rep: s.getAugmentationRepReq(name) }))
      .filter((a) => a.value > 0)
      .sort((a, b) => b.value / b.rep - a.value / a.rep)
    if (!augs.length) continue
    factions.push({ faction, joined: p.factions.includes(faction), value: augs.reduce((t, a) => t + a.value, 0),
      maxRep: Math.max(...augs.map((a) => a.rep)), augs })
  }
  factions.sort((a, b) => b.value - a.value)
  const companies = []
  for (const company of COMPANIES) {
    const row = { company, rep: s.getCompanyRep(company), favor: s.getCompanyFavor(company), best: null }
    for (const job of s.getCompanyPositions(company)) {
      const info = s.getCompanyPositionInfo(company, job)
      const req = info.requiredSkills
      if (p.skills.hacking < req.hacking || p.skills.charisma < req.charisma || row.rep < info.requiredReputation) continue
      if (p.skills.strength < req.strength || p.skills.defense < req.defense || p.skills.dexterity < req.dexterity || p.skills.agility < req.agility) continue
      let perSec = 0
      try {
        perSec = ns.formulas.work.companyGains({ ...p, jobs: { ...p.jobs, [company]: job } }, company, job, row.favor).reputation * 5
      } catch { continue }
      if (!row.best || perSec > row.best.perSec) row.best = { job, field: info.field, perSec }
    }
    companies.push(row)
  }
  ns.write("faction_value_survey.json", JSON.stringify({ ts: Date.now(), weights, skills: p.skills, jobs: p.jobs,
    invites: s.checkFactionInvitations(), factions, companies }, null, 1), "w")
  ns.tprint("faction_value_survey.json written")
}
