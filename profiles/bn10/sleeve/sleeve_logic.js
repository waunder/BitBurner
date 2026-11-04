/**
 * Pure policy for sleeve tasks. Game rules below are from bitburner-src `dev`
 * (checked 2026-11-04), not memory:
 *  - Work/SleeveFactionWork.ts: rep = faction rep formula * shockBonus, credited straight to the
 *    player's faction. No sync factor. The work stops itself if the faction is the player's gang.
 *  - Work/SleeveCrimeWork.ts: success pays Player.karma -= crime.karma * sync/100, with no shock
 *    factor; money and exp are scaled by (100 - shock)/100 and money is 0 on failure.
 *  - Work/Work.ts applySleeveGains: money goes 100% to the player; exp shared with the player is
 *    scaled by sync.
 *  - NetscriptFunctions/Sleeve.ts setToFactionWork: needs faction membership and throws when another
 *    sleeve already works that faction. The player's own work is not checked, so sharing with the
 *    player is allowed. Sleeve.workForFaction returns false when the faction does not offer the type.
 *  - Sleeve.process: any work drains shock 0.0001/cycle; recovery adds 0.0002 on top
 *    (x intelligence bonus). Synchronize adds sync 0.0002/cycle (player intelligence bonus).
 */

const SLEEVE_CRIMES = [
  { name: "Shoplift", time: 2e3, money: 15e3, karma: 0.1, diff: 1 / 20, weights: { dexterity: 1, agility: 1 } },
  { name: "Rob Store", time: 60e3, money: 400e3, karma: 0.5, diff: 1 / 5, weights: { hacking: 0.5, dexterity: 2, agility: 1 } },
  { name: "Mug", time: 4e3, money: 36e3, karma: 0.25, diff: 1 / 5, weights: { strength: 1.5, defense: 0.5, dexterity: 1.5, agility: 0.5 } },
  { name: "Larceny", time: 90e3, money: 800e3, karma: 1.5, diff: 1 / 3, weights: { hacking: 0.5, dexterity: 1, agility: 1 } },
  { name: "Deal Drugs", time: 10e3, money: 120e3, karma: 0.5, diff: 1, weights: { dexterity: 2, agility: 1, charisma: 3 } },
  { name: "Bond Forgery", time: 300e3, money: 4.5e6, karma: 0.1, diff: 0.5, weights: { hacking: 0.05, dexterity: 1.25 } },
  { name: "Traffick Arms", time: 40e3, money: 600e3, karma: 1, diff: 2, weights: { strength: 1, defense: 1, dexterity: 1, agility: 1, charisma: 1 } },
  { name: "Homicide", time: 3e3, money: 45e3, karma: 3, diff: 1, weights: { strength: 2, defense: 2, dexterity: 0.5, agility: 0.5 } },
  { name: "Grand Theft Auto", time: 80e3, money: 1.6e6, karma: 5, diff: 8, weights: { hacking: 1, strength: 1, dexterity: 4, agility: 2, charisma: 2 } },
  { name: "Kidnap", time: 120e3, money: 3.6e6, karma: 6, diff: 5, weights: { strength: 1, dexterity: 1, agility: 1, charisma: 1 } },
  { name: "Assassination", time: 300e3, money: 12e6, karma: 10, diff: 8, weights: { strength: 1, dexterity: 2, agility: 1 } },
  { name: "Heist", time: 600e3, money: 120e6, karma: 15, diff: 18, weights: { hacking: 1, strength: 1, defense: 1, dexterity: 1, agility: 1, charisma: 1 } },
]

export const DEFAULT_SLEEVE_CONFIG = {
  enabled: true,
  shockRecoverAbove: 40,    // start recovery above this shock
  shockResumeBelow: 5,      // a recovering sleeve keeps going until here
  syncBelow: 60,            // synchronize before karma crime below this sync (karma is the only goal scaled by sync)
  syncResumeAt: 99,
  karmaWhileShocked: false, // karma is not scaled by shock, so a shocked sleeve could still earn it
  crimeKarmaTarget: -54_000,
  repInvestmentMaxPriceMultiple: 250,
  factionWorkTypes: ["hacking", "field", "security"],
  crimeKeepRatio: 0.9,      // keep the current crime unless the best beats it by more than 1/ratio
  statusMaxAgeMs: 5 * 60 * 1000,
}

function number(value) { return Number.isFinite(Number(value)) ? Number(value) : 0 }

/** Mirrors Crime.successRate. The BitNode's CrimeSuccessRate is invisible to scripts without SF5, so it is an input. */
export function crimeChance(crime, skills = {}, mults = {}, bitNodeMult = 1) {
  let chance = 0
  for (const [skill, weight] of Object.entries(crime.weights)) chance += weight * number(skills[skill])
  chance += 0.025 * number(skills.intelligence)
  chance /= 975 * crime.diff
  chance *= (mults.crime_success === undefined ? 1 : number(mults.crime_success)) * bitNodeMult
  chance *= 1 + Math.pow(number(skills.intelligence), 0.8) / 600
  return Math.max(0, Math.min(chance, 1))
}

/** Expected karma or money per second for each crime, for one sleeve. Karma is scaled by sync, money is not. */
export function rankCrimes(sleeve, goal, bitNodeMult = 1) {
  const sync = number(sleeve.sync) / 100
  return SLEEVE_CRIMES.map((crime) => {
    const chance = crimeChance(crime, sleeve.skills, sleeve.mults, bitNodeMult)
    const perSecond = crime.time > 0 ? chance / (crime.time / 1000) : 0
    return { crime: crime.name, chance, score: goal === "karma" ? crime.karma * sync * perSecond : crime.money * perSecond }
  }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score || a.crime.localeCompare(b.crime))
}

function pickCrime(sleeve, goal, config, bitNodeMult) {
  const rows = rankCrimes(sleeve, goal, bitNodeMult)
  if (!rows.length) return null
  const current = sleeve.task?.type === "CRIME" ? rows.find((row) => row.crime === sleeve.task.crimeType) : null
  if (current && current.score >= rows[0].score * number(config.crimeKeepRatio)) return current
  return rows[0]
}

/** Factions worth sleeve rep, nearest augmentation first. Mirrors the player controller's rep-target filter. */
export function factionTargets(readiness, { gangFaction = null, money = 0, config = DEFAULT_SLEEVE_CONFIG } = {}) {
  const list = readiness?.ok ? (readiness.workCandidates || [readiness.workCandidate].filter(Boolean)) : []
  const priceLimit = number(money) * Math.max(1, number(config.repInvestmentMaxPriceMultiple))
  const repReady = new Set(list.filter((item) => number(item.repGap) <= 0).map((item) => item.name))
  const byFaction = new Map()
  for (const item of list) {
    if (!item.faction || item.faction === gangFaction || item.canWorkForRep === false) continue
    if (repReady.has(item.name) || number(item.repGap) <= 0) continue
    if (!(item.cashReady || number(item.price) <= priceLimit)) continue
    const known = byFaction.get(item.faction)
    if (!known || number(item.repGap) < known.repGap) byFaction.set(item.faction, { faction: item.faction, augmentation: item.name, repGap: number(item.repGap) })
  }
  return [...byFaction.values()].sort((a, b) => a.repGap - b.repGap || a.faction.localeCompare(b.faction))
}

/** Does the sleeve's current task (ns.sleeve.getTask, null when idle) already satisfy the desired one? */
export function sameTask(current, desired) {
  if (!desired || desired.action === "hold") return current === null || current === undefined
  if (!current) return false
  if (desired.action === "recovery") return current.type === "RECOVERY"
  if (desired.action === "synchronize") return current.type === "SYNCHRO"
  if (desired.action === "crime") return current.type === "CRIME" && current.crimeType === desired.crime
  if (desired.action === "faction") return current.type === "FACTION" && current.factionName === desired.faction && desired.workTypes.includes(current.factionWorkType)
  return false
}

/**
 * One task per sleeve. Each sleeve is {index, shock, sync, skills, mults, task}. Returns
 * [{index, task, reason}], task.action being recovery | synchronize | crime | faction | hold.
 */
export function chooseSleeveTasks({ sleeves = [], karma = null, config = {}, activity = null, readiness = null, money = 0, now = Date.now(), bitNodeMult = 1 } = {}) {
  const cfg = { ...DEFAULT_SLEEVE_CONFIG, ...config }
  if (cfg.enabled === false) return sleeves.map((s) => ({ index: s.index, task: { action: "hold" }, reason: "disabled in sleeve_config.json" }))

  const karmaNeeded = karma !== null && Number.isFinite(Number(karma)) && Number(karma) > Number(cfg.crimeKarmaTarget)
  const fresh = (status) => status && Number.isFinite(Number(status.ts)) && now - Number(status.ts) <= cfg.statusMaxAgeMs
  const readinessUsable = fresh(readiness) ? readiness : null
  const gangFaction = readinessUsable?.gangFaction ?? null
  const playerFaction = fresh(activity)
    ? (activity.decision?.action === "faction" ? activity.decision.faction : activity.currentWork?.type === "FACTION" ? activity.currentWork.factionName : null)
    : null
  const wanted = (activity?.decision?.workType ? [activity.decision.workType] : []).concat(cfg.factionWorkTypes)
  const workTypes = [...new Set(wanted)]
  const targets = factionTargets(readinessUsable, { gangFaction, money, config: cfg })

  const results = new Map()
  const pending = []
  for (const sleeve of sleeves) {
    const shock = number(sleeve.shock)
    const recovering = sleeve.task?.type === "RECOVERY"
    if ((shock > cfg.shockRecoverAbove || (recovering && shock > cfg.shockResumeBelow)) && !(karmaNeeded && cfg.karmaWhileShocked)) {
      results.set(sleeve.index, { index: sleeve.index, task: { action: "recovery" }, reason: `shock ${shock.toFixed(1)} above ${recovering ? cfg.shockResumeBelow : cfg.shockRecoverAbove}` })
      continue
    }
    if (karmaNeeded) {
      const sync = number(sleeve.sync)
      const syncing = sleeve.task?.type === "SYNCHRO"
      if (sync < cfg.syncBelow || (syncing && sync < cfg.syncResumeAt)) {
        results.set(sleeve.index, { index: sleeve.index, task: { action: "synchronize" }, reason: `sync ${sync.toFixed(1)}: karma is scaled by sync` })
        continue
      }
      const pick = pickCrime(sleeve, "karma", cfg, bitNodeMult)
      if (pick) {
        results.set(sleeve.index, { index: sleeve.index, task: { action: "crime", crime: pick.crime, chance: pick.chance, goal: "karma" }, reason: `crime for karma ${Number(karma).toFixed(0)} -> ${cfg.crimeKarmaTarget}` })
        continue
      }
    }
    pending.push(sleeve)
  }

  // A sleeve already on a wanted faction keeps it, so reassigning never trips the one-sleeve-per-faction rule.
  const claimed = new Set()
  const assignFaction = (sleeve, target, note) => results.set(sleeve.index, {
    index: sleeve.index,
    task: { action: "faction", faction: target.faction, workTypes, augmentation: target.augmentation, repGap: target.repGap },
    reason: `${target.faction} needs +${Math.ceil(target.repGap)} rep for ${target.augmentation}${note}`,
  })
  const rest = []
  for (const sleeve of pending) {
    const target = sleeve.task?.type === "FACTION" && !claimed.has(sleeve.task.factionName)
      ? targets.find((t) => t.faction === sleeve.task.factionName) : null
    if (target) { claimed.add(target.faction); assignFaction(sleeve, target, "") } else rest.push(sleeve)
  }
  // Factions the player is not working come first; the source allows sharing with the player, so use theirs last.
  const order = targets.filter((t) => t.faction !== playerFaction).concat(targets.filter((t) => t.faction === playerFaction))
  for (const sleeve of rest) {
    const target = order.find((t) => !claimed.has(t.faction))
    if (target) {
      claimed.add(target.faction)
      assignFaction(sleeve, target, target.faction === playerFaction ? " (shared with the player)" : "")
      continue
    }
    const pick = pickCrime(sleeve, "money", cfg, bitNodeMult)
    if (pick) results.set(sleeve.index, { index: sleeve.index, task: { action: "crime", crime: pick.crime, chance: pick.chance, goal: "money" }, reason: "crime for money: no unclaimed faction rep target" })
    else if (number(sleeve.sync) < 100) results.set(sleeve.index, { index: sleeve.index, task: { action: "synchronize" }, reason: "no crime with a chance of success; synchronizing" })
    else results.set(sleeve.index, { index: sleeve.index, task: { action: "hold" }, reason: "nothing useful to do" })
  }
  return sleeves.map((s) => results.get(s.index))
}

/** The Sleeve API throws this outside BitNode 10 without Source-File 10. */
export function sleeveApiUnavailable(error) {
  return /do not (currently )?have access to the Sleeve API|not in BitNode-10/i.test(String(error?.message ?? error ?? ""))
}
