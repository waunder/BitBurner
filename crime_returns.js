import { capturePriorTailPosition, loadTailPosition, saveTailPosition } from "./tail_geometry.js"
/**
 * Live expected crime returns per minute for this player's current stats.
 * Run with: run crime_returns.js [column] [h|l]
 * Examples: run crime_returns.js str l   (Strength XP, low to high)
 *           run crime_returns.js hack    (Hacking XP, high to low)
 * @param {NS} ns
 */
const CRIMES = [
  { name: "Shoplift", time: 2e3, money: 15e3, karma: .1, diff: 1/20, weights: { dexterity: 1, agility: 1 }, exp: { dexterity: 2, agility: 2 } },
  { name: "Rob Store", time: 60e3, money: 400e3, karma: .5, diff: 1/5, weights: { hacking: .5, dexterity: 2, agility: 1 }, exp: { hacking: 30, dexterity: 45, agility: 45 } },
  { name: "Mug", time: 4e3, money: 36e3, karma: .25, diff: 1/5, weights: { strength: 1.5, defense: .5, dexterity: 1.5, agility: .5 }, exp: { strength: 3, defense: 3, dexterity: 3, agility: 3 } },
  { name: "Larceny", time: 90e3, money: 800e3, karma: 1.5, diff: 1/3, weights: { hacking: .5, dexterity: 1, agility: 1 }, exp: { hacking: 45, dexterity: 60, agility: 60 } },
  { name: "Deal Drugs", time: 10e3, money: 120e3, karma: .5, diff: 1, weights: { dexterity: 2, agility: 1, charisma: 3 }, exp: { dexterity: 5, agility: 5, charisma: 10 } },
  { name: "Bond Forgery", time: 300e3, money: 4.5e6, karma: .1, diff: .5, weights: { hacking: .05, dexterity: 1.25 }, exp: { hacking: 100, dexterity: 150, charisma: 15 } },
  { name: "Traffick Arms", time: 40e3, money: 600e3, karma: 1, diff: 2, weights: { strength: 1, defense: 1, dexterity: 1, agility: 1, charisma: 1 }, exp: { strength: 20, defense: 20, dexterity: 20, agility: 20, charisma: 40 } },
  { name: "Homicide", time: 3e3, money: 45e3, karma: 3, diff: 1, weights: { strength: 2, defense: 2, dexterity: .5, agility: .5 }, exp: { strength: 2, defense: 2, dexterity: 2, agility: 2 }, kills: 1 },
  { name: "Grand Theft Auto", time: 80e3, money: 1.6e6, karma: 5, diff: 8, weights: { hacking: 1, strength: 1, dexterity: 4, agility: 2, charisma: 2 }, exp: { strength: 20, defense: 20, dexterity: 20, agility: 80, charisma: 40 } },
  { name: "Kidnap", time: 120e3, money: 3.6e6, karma: 6, diff: 5, weights: { strength: 1, dexterity: 1, agility: 1, charisma: 1 }, exp: { strength: 80, defense: 80, dexterity: 80, agility: 80, charisma: 80 } },
  { name: "Assassination", time: 300e3, money: 12e6, karma: 10, diff: 8, weights: { strength: 1, dexterity: 2, agility: 1 }, exp: { strength: 300, defense: 300, dexterity: 300, agility: 300 }, kills: 1 },
  { name: "Heist", time: 600e3, money: 120e6, karma: 15, diff: 18, weights: { hacking: 1, strength: 1, defense: 1, dexterity: 1, agility: 1, charisma: 1 }, exp: { hacking: 450, strength: 450, defense: 450, dexterity: 450, agility: 450, charisma: 450 } },
]
const STATS = ["hacking", "strength", "defense", "dexterity", "agility", "charisma"]
const LABELS = ["Crime", "%", "$ /m", "Karma/m", "Hack", "Str", "Def", "Dex", "Agi", "Cha"]
const WIDTHS = [20, 5, 7, 8, 7, 7, 7, 7, 7, 7]
const WINDOW_FILE = "crime_returns_window.json"
const SORTS = [
  { key: "name", label: "Crime", column: 0, aliases: ["crime", "name"] },
  { key: "chance", label: "Success chance", column: 1, aliases: ["chance", "success", "%"] },
  { key: "money", label: "Money/min", column: 2, aliases: ["money", "cash", "$"] },
  { key: "karma", label: "Karma/min", column: 3, aliases: ["karma", "karma/min", "k"] },
  ...STATS.map((stat, i) => ({ key: stat, label: `${LABELS[i + 4]} XP/min`, column: i + 4, aliases: [stat, LABELS[i + 4].toLowerCase()] })),
]

function compact(n, cash = false) {
  if (!Number.isFinite(n) || n <= 0) return "—"
  for (const [scale, suffix] of (cash ? [[1e12,"t"],[1e9,"b"],[1e6,"m"],[1e3,"k"]] : [[1e9,"b"],[1e6,"m"],[1e3,"k"]]))
    if (n >= scale) return `${(n / scale).toFixed(n / scale >= 100 ? 0 : 1)}${suffix}`
  return n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2)
}
const cell = (text, i) => i ? String(text).padStart(WIDTHS[i]) : String(text).padEnd(WIDTHS[i])

function parseSort(args) {
  const columnArg = String(args[0] ?? "money").toLowerCase()
  const sortInfo = SORTS.find(sort => sort.aliases.includes(columnArg))
  if (!sortInfo || args.length > 2) return null
  const directionArg = String(args[1] ?? "h").toLowerCase()
  const direction = ["l", "low", "asc", "ascending"].includes(directionArg) ? "asc"
    : ["h", "high", "desc", "descending"].includes(directionArg) ? "desc" : null
  return direction ? { key: sortInfo.key, direction, sortInfo } : null
}

function usableWindow(value) {
  return value && ["x", "y", "width", "height"].every(key => Number.isFinite(value[key])) && value.width > 0 && value.height > 0
}

function readWindow(ns) {
  try {
    const value = JSON.parse(ns.read(WINDOW_FILE))
    return usableWindow(value) ? value : null
  } catch { return null }
}

export async function main(ns) {
  ns.disableLog("sleep")
  const sort = parseSort(ns.args)
  if (!sort) {
    ns.tprint("Usage: run crime_returns.js [crime|chance|money|karma|hack|str|def|dex|agi|cha] [h|l]")
    ns.tprint("h = high to low (default); l = low to high. Example: run crime_returns.js str l")
    return
  }

  // A tail belongs to a process ID, so replace the prior process while
  // carrying its position and size forward to the replacement window.
  let window = readWindow(ns)
  const savedPosition = await capturePriorTailPosition(ns, "crime_returns.js") ?? loadTailPosition(ns, "crime_returns.js")
  if (Number.isFinite(savedPosition.x) && Number.isFinite(savedPosition.y)) window = { ...window, ...savedPosition }
  const prior = ns.ps().filter(process => process.filename.replace(/^\//, "") === "crime_returns.js" && process.pid !== ns.pid)
  for (const process of prior) {
    const running = ns.getRunningScript(process.pid)
    if (usableWindow(running?.tailProperties)) window = running.tailProperties
    ns.ui.closeTail(process.pid)
    ns.kill(process.pid)
  }
  if (window) await ns.write(WINDOW_FILE, JSON.stringify(window), "w")
  ns.ui.openTail()
  if (window) {
    ns.ui.moveTail(window.x, window.y)
    ns.ui.resizeTail(window.width, window.height)
  }
  while (true) {
    ns.clearLog()
    const sortInfo = sort.sortInfo
    const player = ns.getPlayer()
    let node = {}
    try { node = ns.getBitNodeMultipliers() } catch { /* unavailable without SF5; assume neutral modifiers */ }
    const chanceNode = Number(node.CrimeSuccessRate) || 1
    const expNode = Number(node.CrimeExpGain) || 1
    const moneyNode = Number(node.CrimeMoney) || 1
    ns.print("EXPECTED CRIME RETURNS / MIN  ·  current player stats")
    ns.print("XP includes ¼ rewards on failure; excludes focus bonus")
    ns.print(LABELS.map((label, i) => cell(i === sortInfo.column ? `${label}${sort.direction === "desc" ? "↓" : "↑"}` : label, i)).join(" "))
    ns.print("-".repeat(WIDTHS.reduce((a,b)=>a+b,0)+WIDTHS.length-1))
    const rows = CRIMES.map(crime => {
      let weighted = Object.entries(crime.weights).reduce((sum, [stat, weight]) => sum + weight * (Number(player.skills[stat]) || 0), 0)
      weighted += .025 * (Number(player.skills.intelligence) || 0)
      const intelligence = 1 + Math.pow(Number(player.skills.intelligence) || 0, .8) / 600
      const chance = Math.min(1, weighted / 975 / crime.diff * (Number(player.mults.crime_success) || 1) * chanceNode * intelligence)
      const perMin = 60_000 / crime.time
      const expFactor = (chance + (1 - chance) * .25) * perMin * expNode
      const money = chance * perMin * crime.money * (Number(player.mults.crime_money) || 1) * moneyNode
      const karma = expFactor * crime.karma * (Number(node.CrimeKarma) || 1)
      const exp = STATS.map(stat => expFactor * (crime.exp[stat] || 0) * (Number(player.mults[`${stat}_exp`]) || 1))
      return { crime, chance, values: [money, karma, ...exp] }
    }).sort((a, b) => {
      const value = row => sort.key === "name" ? row.crime.name : sort.key === "chance" ? row.chance : sort.key === "money" ? row.values[0] : sort.key === "karma" ? row.values[1] : row.values[STATS.indexOf(sort.key) + 2]
      const delta = sort.key === "name" ? value(a).localeCompare(value(b)) : value(a) - value(b)
      return (sort.direction === "desc" ? -delta : delta) || a.crime.name.localeCompare(b.crime.name)
    })
    for (const row of rows) {
      const values = [row.crime.name, `${(row.chance*100).toFixed(0)}%`, ...row.values.map((v,i)=>compact(v,i===0))]
      ns.print(values.map(cell).join(" "))
    }
    ns.print(`Updated ${new Date().toLocaleTimeString()}  ·  sort: ${sortInfo.label} ${sort.direction === "desc" ? "↓" : "↑"}`)
    const running = ns.getRunningScript(ns.pid)
    if (usableWindow(running?.tailProperties))
      await ns.write(WINDOW_FILE, JSON.stringify(running.tailProperties), "w")
    await saveTailPosition(ns, "crime_returns.js")
    await ns.sleep(5000)
  }
}
