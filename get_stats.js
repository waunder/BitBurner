/** 
 * @param {NS} ns 
 **/
 /*
Gets stats of each hacked server.
RAM: 2.55GB
 */
function get_all_servers(ns, all=false) {
	/*
	Scans and iterates through all servers.
	If all is false, only servers with root access and have money are returned.
	*/
	var servers = ["home"]
	var result = []

	var i = 0
	while (i < servers.length) {
		var server = servers[i]
		var s = ns.scan(server)
		for (var j in s) {
			var con = s[j]
			if (servers.indexOf(con) < 0) {
				servers.push(con)
				if (all || (ns.hasRootAccess(con) && parseInt(ns.getServerMaxMoney(con)) > 0)) {
					result.push(con)
				}
			}
		}
		i += 1
	}
	return result
}

function get_activity(ns, host) {
	/*
	One ns.ps() call, both derivations: what's running (there can be several
	actions at once, e.g. weaken + grow + hack) and what they're aimed at.
	Reports every distinct target rather than just the first process's, so a
	host mid-retarget doesn't silently misreport what it's actually doing.
	*/
	var procs = ns.ps(host)
	if (procs.length == 0) {
		return { action: "-", target: "-" }
	}
	var parts = []
	var targets = []
	for (var proc of procs) {
		var name = proc.filename.replace("scripts/", "").replace(".js", "")
		parts.push(`${name}:${proc.threads}`)
		var target = proc.args.length > 0 ? String(proc.args[0]) : null
		if (target && targets.indexOf(target) < 0) {
			targets.push(target)
		}
	}
	return {
		action: parts.join("+"),
		target: targets.length > 0 ? targets.join(",") : "-",
	}
}

function pad_str(string, len) {
	/*
	Prepends the requested padding to the string.
	*/
	var pad = "                      "
	return String(pad + string).slice(-len)
}

function get_server_data(ns, server) {
	/*
	Creates the info text for each server. Currently gets money, security, and ram.
	NOTE: ns.getServer() can return a server object and obtain all of the necessary properties.
	However, ns.getServer() costs 2GB, which doubles the RAM requirement for this script.
	*/
	var moneyAvailable = ns.getServerMoneyAvailable(server)
	var moneyMax =  ns.getServerMaxMoney(server)
	var securityLvl = ns.getServerSecurityLevel(server)
	var securityMin = ns.getServerMinSecurityLevel(server)
	var ram = ns.getServerMaxRam(server)
	var activity = get_activity(ns, server)
	return `${pad_str(server, 17)}`+
			` money:${pad_str(parseInt(moneyAvailable), 12)}/${pad_str(parseInt(moneyMax), 12)}(${pad_str((moneyAvailable / moneyMax).toFixed(2), 4)})` +
			` security:${pad_str(securityLvl.toFixed(2), 6)}(${pad_str(securityMin, 2)})` +
			` RAM:${pad_str(parseInt(ram), 4)}` +
			` Action:${activity.action} ${activity.target}`
}

function get_servers(ns) {
	/*
	Gets servers. If specific servers requested, then returns those only.
	Otherwise, scans and returns all servers.
	return: list of servers
	*/
	if (ns.args.length >= 1) {
		return ns.args.map(String)
	} else {
		return get_all_servers(ns, false)
	}
}

// Width in pixels of Bitburner's left nav sidebar, so the tail box sits
// beside it instead of underneath it. Adjust if it doesn't line up.
const SIDEBAR_WIDTH = 233

// Bitburner renders ANSI escapes in tail windows. White separates our panels
// from the game's green. Basic codes only — this build has no 256-colour
// support, so \u001b[38;5;15m would render as literal text.
const WHITE = "\u001b[37m"
const RESET = "\u001b[0m"

/**
 * Bitburner gives every running script its own tail window, so re-running this
 * to change the server list or reposition it leaves the old window behind.
 * Three copies had accumulated before this existed. Kill any earlier copy.
 *
 * ns.ps reports filenames without a leading slash — the same trap that made
 * killActionScripts in mcp.js silently match nothing for hours.
 *
 * ns.kill does NOT close the killed script's tail window — confirmed by
 * observation: after two startup.js runs, ps showed exactly one process of
 * each script, yet duplicate tail windows were still visible, one live and
 * one a frozen ghost from the instance startup.js had just killed.
 * ns.ui.closeTail(pid) is the separate call that actually closes it.
 */
function killPriorInstances(ns) {
	var self = ns.pid
	for (var proc of ns.ps(ns.getHostname())) {
		var name = proc.filename.charAt(0) === "/" ? proc.filename.slice(1) : proc.filename
		if (name === "get_stats.js" && proc.pid !== self) {
			if (ns.ui && typeof ns.ui.closeTail === "function") ns.ui.closeTail(proc.pid)
			ns.kill(proc.pid)
		}
	}
}

function openTail(ns) {
	// This script always runs on the host it was launched from, so tail it
	// there. Previously this read ns.args[1], which collided with get_servers()
	// treating every arg as a server name: `run get_stats.js n00dles foodnstuff`
	// tried to open the tail window on foodnstuff.
	if (ns.ui && typeof ns.ui.openTail === "function") {
		ns.ui.openTail("get_stats.js", ns.getHostname(), ...ns.args)
	}
	if (ns.ui && typeof ns.ui.moveTail === "function") {
		ns.ui.moveTail(SIDEBAR_WIDTH, 0)
	}
}

// Extra buffer beyond the measured text size, to comfortably avoid word-wrap.
const TAIL_PADDING_X = 60
const TAIL_PADDING_Y = 40

function resizeTailToFit(ns, lines) {
	if (!ns.ui || typeof ns.ui.resizeTail !== "function" || typeof ns.ui.getStyles !== "function") {
		return
	}
	var styles = ns.ui.getStyles()
	var charWidth = styles.tailFontSize * 0.6
	var lineHeight = styles.tailFontSize * styles.lineHeight

	var maxLen = 0
	for (var line of lines) {
		if (line.length > maxLen) {
			maxLen = line.length
		}
	}
	var width = Math.max(150, Math.ceil(maxLen * charWidth) + TAIL_PADDING_X)
	var height = Math.max(30, Math.ceil((lines.length + 1) * lineHeight) + TAIL_PADDING_Y)
	ns.ui.resizeTail(width, height)
	if (typeof ns.ui.renderTail === "function") {
		ns.ui.renderTail()
	}
}

function disableLogs(ns) {
	const logs = [
		"scan",
		"run",
		"getServerSecurityLevel",
		"getServerMoneyAvailable",
		"getServerMaxMoney",
		"getServerMinSecurityLevel",
		"getServerUsedRam",
	]
	for (const log of logs) {
		ns.disableLog(log)
	}
}

export async function main(ns) {
	disableLogs(ns)
	killPriorInstances(ns)
	openTail(ns)

	while (true) {
		ns.clearLog()
		var servers = get_servers(ns)
		var stats = []
		for (var server of servers) {
			stats.push({
				maxMoney: ns.getServerMaxMoney(server),
				line: get_server_data(ns, server),
			})
		}
		stats.sort((a, b) => a.maxMoney - b.maxMoney)
		for (var item of stats) {
			ns.print(WHITE + item.line + RESET)
		}
		resizeTailToFit(ns, stats.map((item) => item.line))
		await ns.sleep(5000)
	}
}