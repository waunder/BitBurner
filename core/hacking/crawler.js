const IGNORE = ["darkweb"]
const SLEEP_MIN = 2
// Same list as worm.js. worm.js only backdoors on its own fresh nuke, so a server
// rooted before hacking reached its level, or another way, was left without one.
const BACKDOOR_SERVS = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z"]
/** @param {NS} ns */
function disable_logs(ns) {
	var logs = ["scan", "run", 'getServerRequiredHackingLevel', 'getHackingLevel']
	for (var i in logs) {
		ns.disableLog(logs[i])
	}
}

/** @param {NS} ns */
export async function main(ns) {
	disable_logs(ns)
	while (true) {
		let servers = Array(ns.scan())[0]
		let serv_set = Array(servers)
		serv_set.push("home")

		let i = 0
		while (i < servers.length) {
			let server = servers[i]
			if (!ns.hasRootAccess(server) && ns.getServerRequiredHackingLevel(server) <= ns.getHackingLevel() && !IGNORE.includes(server)) {
				ns.print("attempting to hack ", server)
				ns.run("hacking/worm.js", 1, server)
				await ns.sleep(1000)
			} else if (BACKDOOR_SERVS.includes(server) && ns.hasRootAccess(server)
				&& ns.getServerRequiredHackingLevel(server) <= ns.getHackingLevel()
				&& !ns.getServer(server).backdoorInstalled
				&& !ns.isRunning("hacking/backdoor.js", "home", server)) {
				ns.print("backdooring ", server)
				ns.exec("hacking/backdoor.js", "home", 1, server)
			}
			let s = ns.scan(server)
			for (let j in s) {
				let con = s[j]
				if (!serv_set.includes(con)) {
				//if (serv_set.indexOf(con) < 0) {
					serv_set.push(con)
					servers.push(con)
				}
			}
			i += 1
		}

		await ns.sleep(60000 * SLEEP_MIN)
	}

}