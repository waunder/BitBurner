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
  bladeburner: true,        // spare sleeves take Bladeburner contracts when bladeburner.js reports odds (BN6+)
  bladeburnerMinChance: 0.8, // low end of the sleeve's own estimate, to start a contract
  bladeburnerKeepChance: 0.7, // a sleeve already on a contract keeps it down to here (no flapping at the bar)
  infiltrateBelow: 300,     // one spare sleeve infiltrates Synthoid communities when any contract/op count is below this
  contractStartCount: 20,   // a sleeve starts a contract only with this many left (keeps it down to 1); stops a near-empty
                            // contract (Tracking at ~1, 2026-11-16) from holding a sleeve idle between refills
  maxInfiltrators: 2,       // spare sleeves left without a contract while counts are low also infiltrate, up to this many
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
  const gangSells = new Set(readiness?.gangSells || [])
  const byFaction = new Map()
  for (const item of list) {
    if (gangSells.has(item.name)) continue
    if (!item.faction || item.faction === gangFaction || item.canWorkForRep === false) continue
    if (repReady.has(item.name) || number(item.repGap) <= 0) continue
    if (!(item.cashReady || number(item.price) <= priceLimit)) continue
    const known = byFaction.get(item.faction)
    if (!known || number(item.repGap) < known.repGap) byFaction.set(item.faction, { faction: item.faction, augmentation: item.name, repGap: number(item.repGap) })
  }
  return [...byFaction.values()].sort((a, b) => a.repGap - b.repGap || a.faction.localeCompare(b.faction))
}

/**
 * Faction work types ordered by the sleeve's own reputation rate (bitburner-src Faction work formulas):
 * hacking ~ (hack + int/3), field ~ 0.9 x (hack + str + def + dex + agi + cha + int) / 5.5,
 * security ~ 0.9 x (hack + str + def + dex + agi + int) / 4.5. 2026-11-16 (BN6): sleeves with hacking 59
 * and combat ~205 did hacking work at about a third of their security/field rate.
 * Returns { types, scores } (types best first); null skills keep the configured order.
 */
export function workTypeRank(skills, fallback = DEFAULT_SLEEVE_CONFIG.factionWorkTypes) {
  if (!skills) return { types: [...fallback], scores: null }
  const k = (name) => number(skills[name])
  const hack = k("hacking"), int = k("intelligence")
  const scores = {
    hacking: hack + int / 3,
    field: (0.9 * (hack + k("strength") + k("defense") + k("dexterity") + k("agility") + k("charisma") + int)) / 5.5,
    security: (0.9 * (hack + k("strength") + k("defense") + k("dexterity") + k("agility") + int)) / 4.5,
  }
  const types = [...fallback].sort((a, b) => number(scores[b]) - number(scores[a]))
  return { types, scores }
}

/** Does the sleeve's current task (ns.sleeve.getTask, null when idle) already satisfy the desired one? */
export function sameTask(current, desired) {
  if (!desired || desired.action === "hold") return current === null || current === undefined
  if (!current) return false
  if (desired.action === "recovery") return current.type === "RECOVERY"
  if (desired.action === "synchronize") return current.type === "SYNCHRO"
  if (desired.action === "crime") return current.type === "CRIME" && current.crimeType === desired.crime
  if (desired.action === "bladeburner") return desired.bbAction === "Infiltrate Synthoids"
    ? current.type === "INFILTRATE"
    : current.type === "BLADEBURNER" && current.actionName === desired.contract
  if (desired.action === "faction") {
    if (current.type !== "FACTION" || current.factionName !== desired.faction || !desired.workTypes.includes(current.factionWorkType)) return false
    // Close enough to the sleeve's best type (within 10%)? Keeps a sleeve on the best type the faction offers
    // without retrying, and moves it off a much worse one (hacking work for a combat sleeve).
    const scores = desired.workScores
    if (!scores) return true
    const best = Math.max(...desired.workTypes.map((t) => number(scores[t])))
    return number(scores[current.factionWorkType]) >= 0.9 * best
  }
  return false
}

/**
 * One task per sleeve. Each sleeve is {index, shock, sync, skills, mults, task}. Returns
 * [{index, task, reason}], task.action being recovery | synchronize | crime | faction | hold.
 */
export function chooseSleeveTasks({ sleeves = [], karma = null, config = {}, activity = null, readiness = null, money = 0, now = Date.now(), bitNodeMult = 1, bladeburner = null } = {}) {
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
  const assignFaction = (sleeve, target, note) => {
    const rank = workTypeRank(sleeve.skills, workTypes)
    return results.set(sleeve.index, {
    index: sleeve.index,
    task: { action: "faction", faction: target.faction, workTypes: rank.types, workScores: rank.scores, augmentation: target.augmentation, repGap: target.repGap },
    reason: `${target.faction} needs +${Math.ceil(target.repGap)} rep for ${target.augmentation}${note}`,
  })
  }
  const rest = []
  const spare = []
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
    spare.push(sleeve)
  }
  const bbFresh = cfg.bladeburner !== false && bladeburner && Number.isFinite(Number(bladeburner.ts)) && now - Number(bladeburner.ts) <= 2 * 60 * 1000
  for (const r of bbFresh ? assignBladeburner(spare, bladeburner, cfg) : []) results.set(r.index, r)
  for (const sleeve of spare) {
    if (results.has(sleeve.index)) continue
    const pick = pickCrime(sleeve, "money", cfg, bitNodeMult)
    if (pick) results.set(sleeve.index, { index: sleeve.index, task: { action: "crime", crime: pick.crime, chance: pick.chance, goal: "money" }, reason: "crime for money: no unclaimed faction rep target" })
    else if (number(sleeve.sync) < 100) results.set(sleeve.index, { index: sleeve.index, task: { action: "synchronize" }, reason: "no crime with a chance of success; synchronizing" })
    else results.set(sleeve.index, { index: sleeve.index, task: { action: "hold" }, reason: "nothing useful to do" })
  }
  return sleeves.map((s) => results.get(s.index))
}

/**
 * Spare sleeves on Bladeburner (bitburner-src dev, checked 2026-11-16): a sleeve's contract success gives
 * the player's division full rank and uses the shared count but not the player's stamina; only one sleeve
 * may run a given contract (setToBladeburnerAction throws otherwise); Infiltrate Synthoids adds count to
 * every contract and operation. Failures cost the sleeve HP (shock), which the recovery rule handles.
 * bb = bladeburner_status.json sleeveContracts: { contracts: {name: {count, repGain}}, minCount,
 * sleeves: [{index, contracts: {name: {chance: [lo, hi], timeMs}}}] }.
 */
export function assignBladeburner(spare = [], bb = {}, config = DEFAULT_SLEEVE_CONFIG) {
  const cfg = { ...DEFAULT_SLEEVE_CONFIG, ...config }
  const odds = new Map((bb.sleeves || []).map((row) => [row.index, row.contracts || {}]))
  const usable = (sleeve, name, bar = cfg.bladeburnerMinChance, minCount = number(cfg.contractStartCount) || 1) => {
    const o = odds.get(sleeve.index)?.[name]
    const c = bb.contracts?.[name]
    if (!o || !c || number(c.count) < Math.max(1, minCount) || number(o.chance?.[0]) < bar) return null
    return { name, chance: number(o.chance[0]), score: (number(o.chance[0]) * number(c.repGain)) / Math.max(0.001, number(o.timeMs) / 1000) }
  }
  const out = []
  const used = new Set()
  const claimed = new Set()
  const take = (sleeve, pick) => {
    used.add(sleeve.index); claimed.add(pick.name)
    out.push({ index: sleeve.index, task: { action: "bladeburner", bbAction: "Take on contracts", contract: pick.name, chance: pick.chance }, reason: `Bladeburner ${pick.name} at ${(pick.chance * 100).toFixed(0)}%` })
  }
  // Keep sleeves already on a still-good contract, so reassignment never trips the one-sleeve rule.
  for (const sleeve of spare) {
    if (sleeve.task?.type !== "BLADEBURNER" || claimed.has(sleeve.task.actionName)) continue
    const pick = usable(sleeve, sleeve.task.actionName, Math.min(cfg.bladeburnerKeepChance, cfg.bladeburnerMinChance), 1)
    if (pick) take(sleeve, pick)
  }
  // Then the best remaining (sleeve, contract) pairs.
  while (true) {
    let best = null
    for (const sleeve of spare) {
      if (used.has(sleeve.index)) continue
      for (const name of Object.keys(bb.contracts || {})) {
        if (claimed.has(name)) continue
        const pick = usable(sleeve, name)
        if (pick && (!best || pick.score > best.pick.score)) best = { sleeve, pick }
      }
    }
    if (!best) break
    take(best.sleeve, best.pick)
  }
  if (number(bb.minCount) < cfg.infiltrateBelow) {
    const free = spare.filter((s) => !used.has(s.index))
    // Current infiltrators first (no churn); the game's per-infiltration gain falls as 1/sqrt(infiltrators), so total refill grows as sqrt(n).
    free.sort((a, b) => (b.task?.type === "INFILTRATE") - (a.task?.type === "INFILTRATE"))
    for (const infiltrator of free.slice(0, Math.max(1, number(cfg.maxInfiltrators) || 1))) {
      used.add(infiltrator.index)
      out.push({ index: infiltrator.index, task: { action: "bladeburner", bbAction: "Infiltrate Synthoids" }, reason: `Infiltrate Synthoids: lowest contract/op count ${number(bb.minCount).toFixed(0)} < ${cfg.infiltrateBelow}` })
    }
  }
  return out
}

/** The Sleeve API throws this outside BitNode 10 without Source-File 10. */
export function sleeveApiUnavailable(error) {
  return /do not (currently )?have access to the Sleeve API|not in BitNode-10/i.test(String(error?.message ?? error ?? ""))
}
