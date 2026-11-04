/**
 * Choose the sort column and direction for the live crime_returns.js table.
 * Run this at any time; the table applies the change on its next refresh.
 * @param {NS} ns
 */
const SORT_FILE = "crime_returns_sort.json"
const COLUMNS = [
  ["chance", "Success chance"],
  ["money", "Money/min"],
  ["hacking", "Hacking XP/min"],
  ["strength", "Strength XP/min"],
  ["defense", "Defense XP/min"],
  ["dexterity", "Dexterity XP/min"],
  ["agility", "Agility XP/min"],
  ["charisma", "Charisma XP/min"],
]

export async function main(ns) {
  const current = (() => {
    try { return JSON.parse(ns.read(SORT_FILE)) } catch { return { key: "money", direction: "desc" } }
  })()
  const column = await ns.prompt("Sort the crime table by:", {
    type: "select",
    choices: COLUMNS.map(([key, label]) => `${label}${current.key === key ? (current.direction === "desc" ? " (currently ↓)" : " (currently ↑)") : ""}`),
  })
  if (column === null) return
  const index = COLUMNS.findIndex(([, label]) => column.startsWith(label))
  if (index < 0) return
  const [key, label] = COLUMNS[index]
  const direction = await ns.prompt(`Sort ${label}:`, {
    type: "select",
    choices: ["Highest first ↓", "Lowest first ↑"],
  })
  if (direction === null) return
  const value = { key, direction: direction.startsWith("Highest") ? "desc" : "asc" }
  await ns.write(SORT_FILE, JSON.stringify(value), "w")
  ns.tprint(`Crime table sort set to ${label} ${value.direction === "desc" ? "↓" : "↑"}.`)
}
