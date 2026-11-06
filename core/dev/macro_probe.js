/** One-shot macro review snapshot (dev only, pushed by hand). Writes macro_probe.json. */
export async function main(ns) {
  const out = { ts: Date.now() }
  const tryGet = (key, fn) => { try { out[key] = fn() } catch (e) { out[key] = { error: String(e?.message || e) } } }
  tryGet("bitNodeMults", () => {
    const m = ns.getBitNodeMultipliers()
    const keys = ["HackingLevelMultiplier", "ScriptHackMoney", "ScriptHackMoneyGain", "ServerMaxMoney", "FactionWorkRepGain",
      "FactionPassiveRepGain", "RepToDonateToFaction", "AugmentationRepCost", "AugmentationMoneyCost", "CrimeMoney",
      "HacknetNodeMoney", "CodingContractMoney", "PurchasedServerLimit", "PurchasedServerMaxRam", "StrengthLevelMultiplier",
      "DefenseLevelMultiplier", "DexterityLevelMultiplier", "AgilityLevelMultiplier", "ClassGymExpGain", "CrimeExpGain",
      "GangSoftcap", "GangUniqueAugs", "FavorToDonateToFaction" ]
    return Object.fromEntries(keys.map((k) => [k, m[k]]))
  })
  tryGet("money", () => ns.getMoneySources())
  tryGet("player", () => { const p = ns.getPlayer(); return { skills: p.skills, exp: p.exp, mults: p.mults, money: p.money, factions: p.factions, karma: p.karma } })
  tryGet("favor", () => Object.fromEntries(ns.getPlayer().factions.map((f) => [f, {
    favor: ns.singularity.getFactionFavor(f), gain: ns.singularity.getFactionFavorGain(f), rep: ns.singularity.getFactionRep(f) }])))
  tryGet("invites", () => ns.singularity.checkFactionInvitations())
  tryGet("sharePower", () => ns.getSharePower())
  tryGet("hacknet", () => ({ nodes: ns.hacknet.numNodes(), max: ns.hacknet.maxNumNodes() }))
  tryGet("stock", () => ({ wse: ns.stock.hasWSEAccount(), tix: ns.stock.hasTIXAPIAccess(), s4: ns.stock.has4SData(), s4api: ns.stock.has4SDataTIXAPI() }))
  tryGet("ram", () => {
    const hosts = ["home", ...ns.cloud.getServerNames()]
    let max = 0, used = 0
    for (const h of hosts) { max += ns.getServerMaxRam(h); used += ns.getServerUsedRam(h) }
    return { cloudCount: hosts.length - 1, max, used, home: { max: ns.getServerMaxRam("home"), used: ns.getServerUsedRam("home") } }
  })
  tryGet("work", () => ns.singularity.getCurrentWork())
  tryGet("reset", () => ns.getResetInfo())
  ns.write("macro_probe.json", JSON.stringify(out, null, 1), "w")
  ns.tprint("macro_probe.json written")
}
