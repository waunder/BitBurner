/**
 * Walk the terminal connection one hop at a time toward a named server.
 * Defaults to World-Daemon. If the target is not present or reachable, walk
 * to the deepest discovered server.
 * This only changes the terminal's current server; it never roots, hacks, or
 * backdoors anything.
 *
 * Without Source-File 4, Singularity is unavailable. In that case this
 * prints the route and a pasteable sequence of ordinary terminal commands.
 * The route then starts at home because the current terminal server cannot
 * be queried without Singularity; place the terminal at home before pasting.
 *
 * @param {NS} ns
 * @param {string} [ns.args[0]] destination server name
 */
const DEFAULT_DESTINATION = "World-Daemon"

function hasSourceFile4(ns) {
	return (ns.getResetInfo().ownedSF.get(4) || 0) > 0
}

function scanNetwork(ns, start) {
	const queue = [start]
	const parent = new Map([[start, null]])
	const depth = new Map([[start, 0]])
	const order = []
	for (let cursor = 0; cursor < queue.length; cursor++) {
		const current = queue[cursor]
		order.push(current)
		for (const next of ns.scan(current)) {
			if (!parent.has(next)) {
				parent.set(next, current)
				depth.set(next, depth.get(current) + 1)
				queue.push(next)
			}
		}
	}
	return { parent, depth, order }
}

function buildPath(parent, target) {
	if (!parent.has(target)) return null
	const path = []
	for (let node = target; node !== null; node = parent.get(node)) path.unshift(node)
	return path
}

/** @param {NS} ns */
export async function main(ns) {
	const destination = String(ns.args[0] ?? DEFAULT_DESTINATION).trim()
	if (!destination) {
		ns.tprint(`Usage: run ${ns.getScriptName()} [server-name]`)
		return
	}
	const hasSF4 = hasSourceFile4(ns)
	const start = hasSF4 ? ns.singularity.getCurrentServer() : "home"
	const { parent, depth, order } = scanNetwork(ns, start)
	const destinationExists = ns.serverExists(destination)
	const target = destinationExists && parent.has(destination)
		? destination
		: order.reduce((deepest, server) =>
			depth.get(server) > depth.get(deepest) ? server : deepest, start)
	const path = buildPath(parent, target)

	if (!path || path.length === 0) {
		ns.tprint(`${ns.getScriptName()}: no scanned route from ${start} to a destination`)
		return
	}

	if (target !== destination) {
		const reason = destinationExists ? "not reachable in the scanned network" : "not present in this run"
		ns.tprint(`${destination} is ${reason}; closest discovered endpoint is ${target}.`)
	}
	ns.tprint(`Route (${path.length - 1} hops): ${path.join(" -> ")}`)

	if (!hasSF4) {
		const commands = ["home", ...path.slice(1).map((hop) => `connect ${hop}`)]
		ns.tprint("No Source-File 4: terminal connection cannot be automated by Netscript.")
		ns.tprint(`PASTE: ${commands.join(";")}`)
		return
	}

	for (const hop of path.slice(1)) {
		if (!ns.singularity.connect(hop)) {
			ns.tprint(`Stopped: connect ${hop} failed. Terminal remains at ${ns.singularity.getCurrentServer()}.`)
			return
		}
		ns.print(`Connected to ${hop}`)
		await ns.sleep(100)
	}
	ns.tprint(`Connected to ${ns.singularity.getCurrentServer()}. No backdoor was installed.`)
}
