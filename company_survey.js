/** @param {NS} ns
 * One-shot: writes company_survey.json with the rep each charisma-augmentation company and faction would pay
 * per second now, from the Formulas API, plus current rep and invitations. Takes no actions. */
export async function main(ns) {
  const p = ns.getPlayer()
  const s = ns.singularity
  const companies = ["Bachman & Associates", "Four Sigma", "OmniTek Incorporated", "Clarke Incorporated", "NWO", "Blade Industries", "KuaiGong International"]
  const out = { ts: Date.now(), money: p.money, skills: p.skills, jobs: p.jobs, invitations: s.checkFactionInvitations(),
    queued: s.getOwnedAugmentations(true).filter(name => !s.getOwnedAugmentations(false).includes(name)), companies: [] }
  for (const company of companies) {
    const row = { company, rep: s.getCompanyRep(company), favor: s.getCompanyFavor(company), jobs: [] }
    for (const field of ["Software", "Business"]) {
      for (const job of ns.enums.JobName ? s.getCompanyPositions(company).filter(name => s.getCompanyPositionInfo(company, name).field.toLowerCase().startsWith(field.toLowerCase())) : []) {
        const info = s.getCompanyPositionInfo(company, job)
        const req = info.requiredSkills
        const ok = p.skills.hacking >= req.hacking && p.skills.charisma >= req.charisma && row.rep >= info.requiredReputation
        let perSec = null
        try {
          const clone = { ...p, jobs: { ...p.jobs, [company]: job } }
          perSec = ns.formulas.work.companyGains(clone, company, job, s.getCompanyFavor(company)).reputation * 5
        } catch (e) { perSec = String(e).slice(0, 80) }
        row.jobs.push({ job, ok, perSec, requiredReputation: info.requiredReputation, req: [req.hacking, req.charisma] })
      }
    }
    out.companies.push(row)
  }
  ns.write("company_survey.json", JSON.stringify(out), "w")
  ns.tprint("company_survey.json written")
}
